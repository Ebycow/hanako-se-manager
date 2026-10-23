/**
 * SE名を先頭の文字列で簡易的にグループ分けする。接頭語の一覧は持たず、名前だけから推定する。
 *
 * 1. 接頭語らしいもの（先頭の大文字の並び「AB」「XY」や、先頭の記号「?」「:」）を候補にする
 *    例: ABneko14 → AB / Xwarai8 → X / CDEF6 → CDEF / ?hello → ?
 * 2. 候補を使うSEが MIN_GROUP 件以上あればグループとして採用する。
 *    名前の先頭が採用済みのより短い接頭語（2文字以上）で始まるなら、そちらにまとめる（CDEF6 → CD）
 * 3. 接頭語のないSE（小文字・かな・漢字）は、先頭 MIN_SERIES_LEN 文字以上が一致するSEが
 *    MIN_GROUP 件以上あれば、その「幹」でまとめる（sakuramochi → sakura、neko12 → neko）。幹は stemOf を参照
 * 4. 同じグループの中で、接頭語のあとがさらに一致するもの（ABneko〇〇、Xwarai〇〇）は「シリーズ」として少し色をずらす
 *
 * グループは件数の多い順に、黄金角で色相を割り当てる（多いグループほど互いに見分けやすい色になる）。
 */
(function (root) {
    const MIN_GROUP = 4;
    const MIN_SERIES_LEN = 3;
    const MAX_SERIES_LEN = 8;
    const STEM_KEEP = 0.8;
    const GOLDEN_ANGLE = 137.508;
    const SERIES_SHIFTS = [12, -12, 22, -22];

    /** 接頭語の候補。見つからなければ null */
    function prefixCandidate(name) {
        const symbol = name.match(/^[?？!！:：#＃@＠$＄&＆*＊]/);
        if (symbol) return symbol[0];
        // 大文字の並びのあとに大文字以外が続くもの（名前全体が大文字なら接頭語とはみなさない）
        const upper = name.match(/^[A-Z]+(?=[^A-Z])/);
        if (upper) return upper[0];
        return null;
    }

    function countPrefixes(names, minLen, maxLen) {
        const counts = new Map();
        for (const name of names) {
            const chars = [...name];
            for (let len = minLen; len <= Math.min(maxLen, chars.length); len++) {
                const p = chars.slice(0, len).join('');
                counts.set(p, (counts.get(p) || 0) + 1);
            }
        }
        return counts;
    }

    /**
     * 名前の「幹」になる先頭部分。
     * MIN_GROUP 件以上ある最短の先頭部分から始めて、1文字伸ばしても STEM_KEEP 以上の割合が残る間は伸ばす
     * （枝分かれしたところで止める）。例: sak(38) → saku(37) → sakur(37) → sakura(37) → sakuram(5) なので sakura
     */
    function stemOf(name, counts, minLen, maxLen) {
        const chars = [...name];
        let len = minLen;
        let count = counts.get(chars.slice(0, len).join('')) || 0;
        if (chars.length < minLen || count < MIN_GROUP) return null;
        while (len < Math.min(maxLen, chars.length)) {
            const next = counts.get(chars.slice(0, len + 1).join('')) || 0;
            if (next < MIN_GROUP || next < count * STEM_KEEP) break;
            len++;
            count = next;
        }
        return chars.slice(0, len).join('');
    }

    /**
     * @param {string[]} names
     * @returns {{ byName: Map<string, {group: string, series: string|null, hue: number}>, groups: {key: string, count: number, hue: number}[] }}
     */
    function classify(names) {
        // 1-2. 接頭語のグループ
        const candidateCount = new Map();
        for (const name of names) {
            const c = prefixCandidate(name);
            if (c) candidateCount.set(c, (candidateCount.get(c) || 0) + 1);
        }
        const tokens = [...candidateCount].filter(([, n]) => n >= MIN_GROUP).map(([t]) => t);
        // 長い接頭語から当てる。ただし2文字以上の短い接頭語があればそちらへまとめる
        const tokensByLen = tokens.sort((a, b) => b.length - a.length);
        const groupOf = new Map();
        for (const name of names) {
            const hits = tokensByLen.filter((t) => name.startsWith(t) && name.length > t.length);
            if (!hits.length) continue;
            const merged = hits.filter((t) => t.length >= 2);
            groupOf.set(name, merged.length ? merged[merged.length - 1] : hits[0]);
        }

        // 3. 接頭語のないSEは先頭の一致でまとめる
        const rest = names.filter((n) => !groupOf.has(n));
        const restCounts = countPrefixes(rest, MIN_SERIES_LEN, MAX_SERIES_LEN);
        for (const name of rest) {
            const p = stemOf(name, restCounts, MIN_SERIES_LEN, MAX_SERIES_LEN);
            if (p) groupOf.set(name, p);
        }

        // MIN_GROUP 件に届かなかったグループは解散（名前そのものが幹になったものなど）
        const groupCount = new Map();
        for (const g of groupOf.values()) groupCount.set(g, (groupCount.get(g) || 0) + 1);
        for (const [name, g] of groupOf) {
            if (groupCount.get(g) < MIN_GROUP) groupOf.delete(name);
        }
        for (const [g, n] of groupCount) {
            if (n < MIN_GROUP) groupCount.delete(g);
        }

        // 色相: 件数の多い順に黄金角
        const groups = [...groupCount]
            .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
            .map(([key, count], i) => ({ key, count, hue: Math.round((i * GOLDEN_ANGLE + 20) % 360) }));
        const hueOf = new Map(groups.map((g) => [g.key, g.hue]));

        // 4. グループ内のシリーズ（接頭語のあと MIN_SERIES_LEN 文字以上一致）
        const members = new Map();
        for (const [name, g] of groupOf) {
            if (!members.has(g)) members.set(g, []);
            members.get(g).push(name);
        }
        const byName = new Map();
        for (const [g, list] of members) {
            const gLen = [...g].length;
            const counts = countPrefixes(list, gLen + MIN_SERIES_LEN, gLen + MAX_SERIES_LEN);
            const seriesOf = new Map(list.map((name) => [name, stemOf(name, counts, gLen + MIN_SERIES_LEN, gLen + MAX_SERIES_LEN)]));
            // シリーズは件数の多い順に、グループの色相から少しずらす（ほかのグループと紛れない程度）
            const seriesCount = new Map();
            for (const s of seriesOf.values()) if (s) seriesCount.set(s, (seriesCount.get(s) || 0) + 1);
            const shiftOf = new Map(
                [...seriesCount]
                    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
                    .map(([s], i) => [s, SERIES_SHIFTS[i % SERIES_SHIFTS.length]])
            );
            for (const name of list) {
                const series = seriesOf.get(name);
                const hue = (hueOf.get(g) + (series ? shiftOf.get(series) : 0) + 360) % 360;
                byName.set(name, { group: g, series, hue });
            }
        }
        return { byName, groups };
    }

    root.classifySE = classify;
    if (typeof module !== 'undefined') module.exports = classify;
})(typeof window !== 'undefined' ? window : globalThis);
