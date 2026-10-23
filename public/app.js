const q = document.getElementById('q');
const list = document.getElementById('list');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
const toast = document.getElementById('toast');

let names = [];
// SE名 → { group, series, hue }（classify.js）
let classes = new Map();

function render() {
    const keyword = q.value.trim().toLowerCase();
    const hits = keyword ? names.filter((n) => n.toLowerCase().includes(keyword)) : names;

    const frag = document.createDocumentFragment();
    for (const name of hits) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.name = name;
        const c = classes.get(name);
        if (c) {
            button.classList.add('g');
            button.style.setProperty('--h', c.hue);
            button.title = c.series ? `${c.group} / ${c.series}` : c.group;
        }
        appendLabel(button, name, c ? c.group.length : 0, keyword);
        li.append(button);
        frag.append(li);
    }
    list.replaceChildren(frag);

    countEl.textContent = keyword ? `${hits.length} / ${names.length}` : `${names.length} 件`;
    statusEl.textContent = hits.length ? '' : names.length ? '見つかりませんでした' : 'SEが登録されていません';
}

/**
 * SE名を表示する。先頭 prefixLen 文字（グループの接頭語）は色付き、検索に一致した部分はマーカーで強調する
 */
function appendLabel(el, text, prefixLen, keyword) {
    const i = keyword ? text.toLowerCase().indexOf(keyword) : -1;
    const markStart = i < 0 ? -1 : i;
    const markEnd = i < 0 ? -1 : i + keyword.length;

    // 接頭語の境目と検索一致の境目で区切り、区間ごとに要素を作る
    const cuts = [...new Set([0, prefixLen, markStart, markEnd, text.length])]
        .filter((n) => n >= 0 && n <= text.length)
        .sort((a, b) => a - b);
    for (let k = 0; k < cuts.length - 1; k++) {
        const [from, to] = [cuts[k], cuts[k + 1]];
        if (from === to) continue;
        let node = document.createTextNode(text.slice(from, to));
        if (from >= markStart && to <= markEnd) {
            const mark = document.createElement('mark');
            mark.append(node);
            node = mark;
        }
        if (to <= prefixLen) {
            const span = document.createElement('span');
            span.className = 'prefix';
            span.append(node);
            node = span;
        }
        el.append(node);
    }
}

async function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
}

let toastTimer;
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
}

list.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    try {
        await copy(button.dataset.name);
        showToast(`「${button.dataset.name}」をコピーしました`);
        button.classList.add('copied');
        setTimeout(() => button.classList.remove('copied'), 600);
    } catch (err) {
        console.error(err);
        showToast('コピーできませんでした');
    }
});

q.addEventListener('input', render);
// ?q=AB のようなリンクで検索した状態から開ける
q.value = new URLSearchParams(location.search).get('q') || '';

fetch('./se')
    .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    })
    .then((data) => {
        names = data.names;
        classes = window.classifySE(names).byName;
        render();
    })
    .catch((err) => {
        console.error(err);
        statusEl.textContent = 'SE一覧を読み込めませんでした';
    });
