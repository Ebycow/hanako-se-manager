const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8750);
const DB_FILE = process.env.SELIST_DB_FILE || '/data/soundeffect.db';
const SERVER_ID = process.env.SELIST_SERVER_ID;
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!SERVER_ID) {
    console.error('SELIST_SERVER_ID が設定されていません（.env を確認してください）');
    process.exit(1);
}

/**
 * hanako の soundeffect.db（nedb 形式）を読み取り専用で読む。
 * nedb ライブラリは読み込み時にファイルを書き直すので使わない。
 * 1行1ドキュメントの追記形式で、同じ _id は後の行が最新。$$deleted は削除。
 */
function readDocs(file) {
    const docs = new Map();
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let doc;
        try {
            doc = JSON.parse(line);
        } catch {
            // hanako が書き込み中の末尾行などは読み飛ばす
            continue;
        }
        if (doc.$$indexCreated || !doc._id) continue;
        if (doc.$$deleted) docs.delete(doc._id);
        else docs.set(doc._id, doc);
    }
    return [...docs.values()];
}

// ファイルが変わったときだけ読み直す
let cache = { mtimeMs: -1, size: -1, names: [] };

function loadNames() {
    const stat = fs.statSync(DB_FILE);
    if (stat.mtimeMs === cache.mtimeMs && stat.size === cache.size) return cache.names;

    const doc = readDocs(DB_FILE).find((d) => d.id === SERVER_ID);
    const names = doc && Array.isArray(doc.dict) ? doc.dict.map((line) => String(line[0])) : [];
    names.sort((a, b) => a.localeCompare(b, 'ja'));
    cache = { mtimeMs: stat.mtimeMs, size: stat.size, names };
    return names;
}

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
};

function send(res, status, body, type) {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(body);
}

function serveStatic(pathname, res) {
    const file = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, 'not found', 'text/plain');
    fs.readFile(file, (err, data) => {
        if (err) return send(res, 404, 'not found', 'text/plain');
        send(res, 200, data, CONTENT_TYPES[path.extname(file)] || 'application/octet-stream');
    });
}

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed', 'text/plain');
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/se') {
        try {
            return send(res, 200, JSON.stringify({ names: loadNames() }), 'application/json; charset=utf-8');
        } catch (err) {
            console.error('SE一覧の読み込みに失敗', err);
            return send(res, 500, JSON.stringify({ error: 'failed to load' }), 'application/json; charset=utf-8');
        }
    }
    if (pathname === '/healthz') return send(res, 200, 'ok', 'text/plain');
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        return send(res, 400, 'bad request', 'text/plain');
    }
    serveStatic(decoded, res);
});

server.listen(PORT, '0.0.0.0', () => console.log(`selist listening on :${PORT} (db=${DB_FILE}, server=${SERVER_ID})`));

process.on('SIGTERM', () => server.close(() => process.exit(0)));
