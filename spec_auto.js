// spec_auto.js — MEP Specifications automation v2.0 (2026-10-07): related, standards, common text, cross-refs, item specifications. Load after the main page: <script src="spec_auto.js?v=2"></script>
// ══════════════════════════════════════════════════════════════════════════
// spec_auto.js — Specification automation, Phase 1
//   #13 Related Requirements built from library links
//   #14 Reference Standards built from a central standards register
//   #16 Common text blocks ({{>KEY}})
//   #19 Cross-reference check (Section XX XXXX that is not in the project)
// Load with:  <script src="spec_auto.js?v=1"></script>  (before </body>)
// It installs itself after the main page script has run. If anything goes
// wrong it leaves the page exactly as it was.
// ══════════════════════════════════════════════════════════════════════════
(function () {
    const AU = window.SPEC_AUTO = { rel: [], std: {}, stdList: [], secstd: [], blocks: {}, loaded: false, missing: '', revs: [], itemRev: {}, itemDraft: {}, itemsLoaded: false, itemsMissing: '', version: '2.0' };
    const AU_TOKEN = /^\{\{\s*(?:AUTO:(RELATED|STANDARDS)|>\s*([A-Za-z0-9_.\-]+))\s*\}\}\.?$/;
    const ORGS = /^(FM|UL|NFPA|ASHRAE|SMACNA|AWWA|ASME|ASTM|ISO|EN|BS|DIN|IEC|NSF|ASSE|CSA|ANSI|IAPMO|MSS|PDI|AWS|API|IGEM|FEMA|IAS|UPC|IPC|SBC|WRAS|EJMA|CIBSE|IEEE|NEMA|UAE|DCD|AHRI)\b/;
    const byNum = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
    let orig = {};
    // ── data ────────────────────────────────────────────────────────────────
    function indexRevs() {
        AU.itemRev = {};
        AU.itemDraft = {};
        AU.revs.forEach(r => {
            if (r.status === 'approved') {
                const c = AU.itemRev[r.item_code];
                if (!c || r.rev > c.rev)
                    AU.itemRev[r.item_code] = r;
            }
            if (r.status === 'draft') {
                const d = AU.itemDraft[r.item_code];
                if (!d || r.rev > d.rev)
                    AU.itemDraft[r.item_code] = r;
            }
        });
    }
    async function loadAuto() {
        const q = t => sb.from(t).select('*').order('sort').range(0, 9999);
        const [r, s, ss, b, rv] = await Promise.all([q('spec_relations'), q('spec_standards'), q('spec_section_standards'), q('spec_blocks'),
            sb.from('spec_item_revs').select('*').order('item_code').order('rev').range(0, 19999)]);
        if (rv.error) {
            AU.revs = [];
            AU.itemsLoaded = false;
            AU.itemsMissing = 'Item specifications are not set up (' + rv.error.message + '). Run spec_item_specs_migration.sql in Supabase.';
        }
        else {
            AU.revs = rv.data || [];
            AU.itemsLoaded = true;
            AU.itemsMissing = '';
        }
        indexRevs();
        const err = r.error || s.error || ss.error || b.error;
        if (err) {
            AU.missing = 'Automation tables are not set up (' + err.message + '). Run spec_automation_migration.sql in Supabase.';
            AU.loaded = false;
            return;
        }
        AU.rel = actv(r.data);
        AU.stdList = s.data || [];
        AU.std = {};
        actv(s.data).forEach(x => { AU.std[x.code] = x; });
        AU.secstd = actv(ss.data);
        AU.blocks = {};
        actv(b.data).forEach(x => { AU.blocks[x.key] = x; });
        AU.missing = '';
        AU.loaded = true;
    }
    function addBuiltin() {
        const b = { k: 'rel_external', t: 'Related requirements: list sections by other disciplines (e.g. 07 84 00 Firestopping)', d: true };
        if (!BUILTIN_OPTS.find(x => x.k === b.k))
            BUILTIN_OPTS.push(b);
        if (!ISSUE_KEYS.includes(b.k))
            ISSUE_KEYS.push(b.k);
        if (!OPTMAP[b.k] && OPTS.length) {
            let g = OPTS.find(x => x.grp === ISSUE_GRP);
            if (!g) {
                g = { col: 2, grp: ISSUE_GRP, items: [] };
                OPTS.push(g);
            }
            g.items.push({ ...b });
            buildOptMap();
        }
    }
    // ── generation helpers ──────────────────────────────────────────────────
    function incSet(o) { return new Set(LIB.filter(S => !isAnnexNum(S.num) && evalCond(S.cond, o)).map(S => S.num)); }
    function countryCode(T) { const k = Object.keys(COUNTRIES).find(c => COUNTRIES[c].name === T.COUNTRY); return k || T.COUNTRY || ''; }
    function relatedLines(S, o, inc) {
        const seen = new Set(), out = [];
        AU.rel.filter(r => r.from_num === S.num && evalCond(r.include_when || '', o)).sort((a, b) => (a.sort || 0) - (b.sort || 0) || byNum(a.to_num, b.to_num)).forEach(r => {
            if (seen.has(r.to_num))
                return;
            seen.add(r.to_num);
            const L = LIB.find(x => x.num === r.to_num);
            if (L) {
                if (isAnnexNum(L.num) || !inc.has(L.num))
                    return;
                out.push({ lvl: 0, text: `Section ${fmtNum(L.num)} - ${titleCase(L.title)}.` });
                return;
            }
            const div = String(r.to_num).slice(0, 2);
            if (LIB.some(x => x.div === div))
                return; // our discipline but not in the library: never print
            if (!evalCond('rel_external', o))
                return;
            out.push(r.label ? { lvl: 0, text: `Section ${fmtNum(r.to_num)} - ${r.label}.` }
                : { lvl: 0, html: `Section ${esc(fmtNum(r.to_num))} - <span class="unres">[title not set in Related links]</span>` });
        });
        return out;
    }
    function stdLines(S, o, T) {
        const codes = [], add = c => { if (c && !codes.includes(c))
            codes.push(c); };
        AU.secstd.filter(x => x.section_num === S.num && evalCond(x.include_when || '', o)).sort((a, b) => (a.sort || 0) - (b.sort || 0)).forEach(x => add(x.code));
        const reg = Object.keys(AU.std).sort((a, b) => b.length - a.length);
        actv(ITEMS.items).filter(i => i.section_num === S.num && evalCond(i.include_when || '', o)).forEach(i => String(i.standards || '').split(';').map(x => x.trim()).filter(Boolean).forEach(s => { const c = reg.find(k => s === k || s.startsWith(k + ' ')); if (c)
            add(c); }));
        if (AU.itemsLoaded)
            includedItems(S, o).forEach(it => {
                const rv = AU.itemRev[it.code];
                if (!rv)
                    return;
                String(rv.standards || '').split(/[;,\n]/).map(x => x.trim()).filter(Boolean).forEach(add);
            });
        const cc = countryCode(T);
        return codes.sort(byNum).map(c => {
            const st = AU.std[c];
            if (!st)
                return { lvl: 0, html: `${esc(c)} <span class="unres">[not in standards register]</span>` };
            const ed = ((st.editions || {})[cc]) || st.edition || '';
            return { lvl: 0, text: `${c} - ${st.title}${ed ? '; ' + ed : ''}.` };
        });
    }
    function blockLines(key, depth) {
        const B = AU.blocks[key];
        if (!B)
            return [{ lvl: 0, html: `<span class="unres">[common text "${esc(key)}" not found]</span>` }];
        const P = parseLib(`## 00 0000 | X |\n# P\n= A\n${B.body || ''}`)[0];
        const items = (P && P.parts[0] && P.parts[0].arts[0]) ? P.parts[0].arts[0].items : [];
        return depth > 0 ? items : items.map(x => ({ ...x, _blk: true }));
    }
    function expand(items, S, o, T, inc, depth) {
        const out = [];
        items.forEach(it => {
            const m = AU_TOKEN.exec(String(it.text || '').trim());
            if (!m) {
                out.push(it);
                return;
            }
            if (!evalCond(it.cond, o))
                return;
            if (!AU.loaded) {
                out.push({ lvl: it.lvl, html: `<span class="unres">[automation not set up – run spec_automation_migration.sql]</span>` });
                return;
            }
            let lines = m[1] === 'RELATED' ? relatedLines(S, o, inc) : m[1] === 'STANDARDS' ? stdLines(S, o, T) : (depth ? [{ lvl: 0, html: '<span class="unres">[nested common text not allowed]</span>' }] : expand(blockLines(m[2], depth), S, o, T, inc, depth + 1));
            lines.forEach(x => out.push({ ...x, lvl: (it.lvl || 0) + (x.lvl || 0), cond: x.cond || '', _auto: true }));
        });
        return out;
    }
    function markXrefs(html, inc) {
        const clean = String(html).replace(/<span class="unres xref"[^>]*>([\s\S]*?)<\/span>/g, '$1');
        return clean.replace(/>[^<]*/g, seg => seg.replace(/\bSection\s+(\d{2})\s?(\d{2})\s?(\d{2})(\.\d+)?\b/g, (m, a, b, c, d) => {
            const num = `${a} ${b}${c}${d || ''}`;
            if (inc.has(num))
                return m;
            const inLib = LIB.some(x => x.num === num);
            if (inLib && isAnnexNum(num))
                return m;
            if (!inLib && !LIB.some(x => x.div === a))
                return m; // other discipline – not checked
            const why = inLib ? 'is not included in this project' : 'is not in the specification library';
            return `<span class="unres xref" title="Section ${a} ${b} ${c} ${why}">${m}</span>`;
        }));
    }
    // ── #20 item specifications ─────────────────────────────────────────────
    const ITEMS_TOK = /^\{\{\s*AUTO:ITEMS(_EXEC)?\s*\}\}$/;
    function includedItems(S, o) { return actv(ITEMS.items).filter(i => i.section_num === S.num && evalCond(i.include_when || '', o)).sort((a, b) => (a.sort || 0) - (b.sort || 0)); }
    function itemHeading(it, r) { return (r && r.heading) || (it.material && it.material !== it.item ? `${it.item} – ${it.material}` : it.item); }
    function itemTextLines(body) { const P = parseLib('## 00 0000 | X |\n# P\n= A\n' + String(body || ''))[0]; return P && P.parts[0] && P.parts[0].arts[0] ? P.parts[0].arts[0].items : []; }
    function renderClauses(items, S, o, T, inc) {
        const cnt = [0, 0, 0, 0], out = [];
        expand(items, S, o, T, inc, 0).forEach(it => {
            if (!it._auto && !evalCond(it.cond, o))
                return;
            if (it._auto && it.cond && !evalCond(it.cond, o))
                return;
            const l = Math.min(it.lvl || 0, 3), n = cnt[l]++;
            for (let j = l + 1; j < 4; j++)
                cnt[j] = 0;
            out.push(`<p class="l${l}"><span>${clauseLbl(l, n)}</span>${it.html != null ? it.html : fill(it.text, T)}</p>`);
        });
        return out;
    }
    function itemBlocks(S, o, T, inc, exec) {
        if (!AU.itemsLoaded)
            return [];
        return includedItems(S, o).map(it => {
            const r = AU.itemRev[it.code];
            if (!r)
                return null;
            const body = exec ? r.part3 : r.part2;
            if (!String(body || '').trim())
                return null;
            const cl = renderClauses(itemTextLines(body), S, o, T, inc);
            if (!cl.length)
                return null;
            return { title: String(itemHeading(it, r)).toUpperCase(), clauses: cl };
        }).filter(Boolean);
    }
    function scheduleArticles(S, o, T) {
        if (!evalCond('items_sched', o))
            return [];
        const its = includedItems(S, o).filter(i => !(AU.itemsLoaded && AU.itemRev[i.code] && String(AU.itemRev[i.code].part2 || '').trim()));
        if (!its.length)
            return [];
        return [{ title: 'PRODUCT SCHEDULE', lines: its.map(i => {
                    const p = [i.rating, i.jointing ? 'jointing: ' + i.jointing : '', i.standards ? 'to ' + i.standards : '', i.application ? 'application: ' + i.application : ''].filter(x => x && x !== '—').join('; ');
                    return `<b>${esc(i.item)}:</b> ${esc(i.material)}${p ? '; ' + fill(p, T) : ''}.` + (i.status === 'TBC' ? ' <span class="unres tbc">[TBC]</span>' : '');
                }) }];
    }
    function genSectionAuto(S, o, T, annex) {
        const inc = incSet(o);
        let h = `<p class="stitle">${annex ? esc(annex) : 'SECTION ' + esc(fmtNum(S.num)) + ' – ' + esc(String(S.title).toUpperCase())}</p>`;
        const titles = S.parts.flatMap(P => P.arts.map(A => A.title.trim()));
        const tok2 = titles.some(t => /^\{\{\s*AUTO:ITEMS\s*\}\}$/.test(t)), tok3 = titles.some(t => /^\{\{\s*AUTO:ITEMS_EXEC\s*\}\}$/.test(t));
        let pn = 0;
        S.parts.forEach(P => {
            if (!evalCond(P.cond, o))
                return;
            pn++;
            h += `<p class="pt">${fill(partLabel(P.title, pn), T)}</p>`;
            let an = 0;
            const art = (t, body) => { an++; h += `<p class="ar"><span>${pn}.${an}</span>${t}</p>` + body; };
            const products = /PRODUCTS/i.test(P.title) && !annex, execution = /EXECUTION/i.test(P.title) && !annex;
            if (products)
                art('MANUFACTURERS', `<p class="l0"><span>A.</span>${esc(mfrWording(o, T))}</p>`);
            P.arts.forEach(A => {
                if (!evalCond(A.cond, o))
                    return;
                const tm = ITEMS_TOK.exec(A.title.trim());
                if (tm) {
                    if (!annex)
                        itemBlocks(S, o, T, inc, !!tm[1]).forEach(X => art(esc(X.title), X.clauses.join('')));
                    return;
                }
                if (products && /^MANUFACTURER/i.test(A.title.trim()))
                    return;
                const hasTok = A.items.some(it => AU_TOKEN.test(String(it.text || '').trim()));
                const out = renderClauses(A.items, S, o, T, inc);
                if (hasTok && !out.length)
                    return;
                art(fill(String(A.title).toUpperCase(), T), out.join(''));
            });
            if (products && !tok2)
                itemBlocks(S, o, T, inc, false).forEach(X => art(esc(X.title), X.clauses.join('')));
            if (execution && !tok3)
                itemBlocks(S, o, T, inc, true).forEach(X => art(esc(X.title), X.clauses.join('')));
            if (products)
                scheduleArticles(S, o, T).forEach(X => art(esc(X.title), X.lines.map((l, n) => `<p class="l0"><span>${clauseLbl(0, n)}</span>${l}</p>`).join('')));
        });
        return annex ? h : markXrefs(h, inc);
    }
    // ── converter: typed lists → library data ───────────────────────────────
    const stripLinks = t => String(t).replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, '$1');
    function parseRel(text) {
        const t = stripLinks(text).replace(/\s+/g, ' ').trim();
        const m = t.match(/^Section\s+(\d{2})\s?(\d{2})\s?(\d{2}(?:\.\d+)?)\s*(?:[-–—:,]\s*(.*))?$/i);
        if (!m)
            return null;
        const label = (m[4] || '').replace(/[.;]\s*$/, '').trim();
        if (/;|:\s/.test(label))
            return null; // qualified reference – keep as text
        return { num: `${m[1]} ${m[2]}${m[3]}`, label };
    }
    function parseStd(text) {
        const t = stripLinks(text).replace(/\s+/g, ' ').trim();
        if (/\{\{/.test(t))
            return null;
        const m = t.match(/^(.{2,45}?)\s+[-–—]\s+(.+)$/);
        if (!m)
            return null;
        const code = m[1].trim();
        let rest = m[2].trim().replace(/\.$/, '');
        if (!/\d/.test(code) && !ORGS.test(code))
            return null;
        if (/^Section\b/i.test(code))
            return null;
        let title = rest, edition = '';
        const k = rest.lastIndexOf(';');
        if (k > 0) {
            const tail = rest.slice(k + 1).trim();
            if (/(19|20)\d{2}|edition|current|adopted|latest|revision/i.test(tail)) {
                edition = tail;
                title = rest.slice(0, k).trim();
            }
        }
        else {
            const y = rest.match(/,\s*((?:19|20)\d{2})$/);
            if (y) {
                edition = y[1];
                title = rest.slice(0, y.index).trim();
            }
        }
        return { code, title, edition };
    }
    function scan(body) {
        const lines = String(body || '').split('\n'), arts = [];
        let cur = null;
        lines.forEach((raw, i) => {
            let s = raw.trim();
            const m = s.match(/^\[if:([^\]]+)\]\s*/);
            const cond = m ? m[1] : '';
            if (m)
                s = s.slice(m[0].length);
            if (s.startsWith('#')) {
                cur = null;
                return;
            }
            if (s.startsWith('= ')) {
                cur = { title: s.slice(2).trim(), items: [] };
                arts.push(cur);
                return;
            }
            if (s.startsWith('- ') && cur)
                cur.items.push({ i, ind: raw.match(/^ */)[0].length, cond, text: s.slice(2) });
        });
        return { lines, arts };
    }
    const isRelArt = t => /^RELATED (REQUIREMENTS|SECTIONS|WORK)/i.test(t);
    const isStdArt = t => /^(REFERENCE STANDARDS|REFERENCES)$/i.test(t.trim());
    const SKIP_BLOCK = /^(RELATED|REFERENCE|REFERENCES|MANUFACTURER|PRODUCT SCHEDULE|SECTION INCLUDES|SUMMARY|SCOPE)/i;
    function analyse(lib, existingStd, existingBlocks) {
        const res = { secs: [], rels: [], secstd: [], std: {}, blocks: [] };
        const secs = lib.filter(S => !isAnnexNum(S.num));
        const scans = {};
        secs.forEach(S => { scans[S.num] = scan(S.body); });
        // repeated identical articles → common blocks
        const groups = {};
        secs.forEach(S => scans[S.num].arts.forEach(A => {
            if (SKIP_BLOCK.test(A.title) || !A.items.length || A.items.some(x => AU_TOKEN.test(x.text.trim())))
                return;
            const sig = A.title.toUpperCase() + '\n' + A.items.map(x => scans[S.num].lines[x.i].replace(/\s+$/, '')).join('\n');
            (groups[sig] = groups[sig] || []).push({ S, A });
        }));
        const used = new Set(Object.keys(existingBlocks));
        const blockFor = new Map();
        Object.entries(groups).filter(([, g]) => new Set(g.map(x => x.S.num)).size >= 3).sort((a, b) => b[1].length - a[1].length).forEach(([sig, g]) => {
            let key = 'COMMON.' + g[0].A.title.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''), k = key, n = 2;
            while (used.has(k))
                k = key + '_' + (n++);
            used.add(k);
            const body = g[0].A.items.map(x => scans[g[0].S.num].lines[x.i].replace(/\s+$/, '')).join('\n') + '\n';
            res.blocks.push({ key: k, title: titleCase(g[0].A.title), body, count: g.length });
            g.forEach(x => blockFor.set(x.A, k));
        });
        secs.forEach(S => {
            const { lines, arts } = scans[S.num], del = new Set(), rep = {}, info = { num: S.num, rel: 0, std: 0, blk: 0, kept: 0 };
            arts.forEach(A => {
                const kind = isRelArt(A.title) ? 'rel' : isStdArt(A.title) ? 'std' : null;
                if (blockFor.has(A)) {
                    A.items.forEach((x, j) => { if (j === 0)
                        rep[x.i] = `- {{>${blockFor.get(A)}}}`;
                    else
                        del.add(x.i); });
                    info.blk++;
                    return;
                }
                if (!kind)
                    return;
                const tok = kind === 'rel' ? '- {{AUTO:RELATED}}' : '- {{AUTO:STANDARDS}}';
                let hasTok = A.items.some(x => AU_TOKEN.test(x.text.trim())), dropping = false;
                A.items.forEach(x => {
                    if (x.ind >= 2) {
                        if (dropping)
                            del.add(x.i);
                        return;
                    }
                    dropping = false;
                    if (AU_TOKEN.test(x.text.trim()))
                        return;
                    const p = kind === 'rel' ? parseRel(x.text) : parseStd(x.text);
                    if (!p) {
                        info.kept++;
                        return;
                    }
                    if (kind === 'rel') {
                        if (p.num !== S.num)
                            res.rels.push({ from_num: S.num, to_num: p.num, label: LIB.find(L => L.num === p.num) ? null : (p.label || null), include_when: x.cond || null });
                        info.rel++;
                    }
                    else {
                        if (!existingStd[p.code] && !res.std[p.code])
                            res.std[p.code] = { code: p.code, title: p.title, edition: p.edition || null };
                        res.secstd.push({ section_num: S.num, code: p.code, include_when: x.cond || null });
                        info.std++;
                    }
                    dropping = true;
                    if (!hasTok) {
                        rep[x.i] = tok;
                        hasTok = true;
                    }
                    else
                        del.add(x.i);
                });
            });
            const changed = del.size || Object.keys(rep).length;
            if (changed) {
                const nb = lines.map((l, i) => del.has(i) ? null : (rep[i] != null ? rep[i] : l)).filter(l => l !== null).join('\n');
                res.secs.push({ ...info, body: nb });
            }
        });
        // de-duplicate link rows
        const uniq = (arr, k) => { const m = new Map(); arr.forEach(x => m.set(k(x), x)); return [...m.values()]; };
        res.rels = uniq(res.rels, x => x.from_num + '>' + x.to_num);
        res.secstd = uniq(res.secstd, x => x.section_num + ':' + x.code);
        return res;
    }
    // ── UI ──────────────────────────────────────────────────────────────────
    const { useState, useEffect, useMemo, useCallback } = React;
    const REL_FIELDS = [['from_num', 'Section no.'], ['to_num', 'Related section no.'], ['label', 'Title (only for sections not in the library)'], ['include_when', 'Include when (blank = whenever the related section is in the project)'], ['sort', 'Sort', 'num'], ['active', 'Active', 'bool']];
    const STD_FIELDS = [['code', 'Code'], ['title', 'Title'], ['edition', 'Default edition / year'], ['editions', 'Edition by country (JSON, e.g. {"UAE":"2019","KSA":"2016"})', 'json'], ['org', 'Organisation'], ['notes', 'Notes'], ['sort', 'Sort', 'num'], ['active', 'Active', 'bool']];
    const SECSTD_FIELDS = [['section_num', 'Section no.'], ['code', 'Standard code'], ['include_when', 'Include when (blank = always)'], ['sort', 'Sort', 'num'], ['active', 'Active', 'bool']];
    const BLK_FIELDS = [['key', 'Key – use {{>KEY}} as a line in any section'], ['title', 'Title'], ['body', 'Text (- lines, 2 spaces per sub-level, [if:key] allowed)', 'text'], ['sort', 'Sort', 'num'], ['active', 'Active', 'bool']];
    function RowEditorX({ cfg, row, isNew, onClose, onSaved, canEdit, who }) {
        const [v, setV] = useState(() => { const o = {}; cfg.fields.forEach(([k, , t]) => { const x = row[k]; o[k] = t === 'json' ? (x === undefined || x === null ? '' : JSON.stringify(x, null, 1)) : (x !== null && x !== void 0 ? x : (t === 'bool' ? true : '')); }); return o; });
        const [msg, setMsg] = useState('');
        const save = async () => {
            const out = {};
            for (const [k, , t] of cfg.fields) {
                let x = v[k];
                if (t === 'json') {
                    if (String(x).trim() === '')
                        x = (k === 'data' || k === 'editions') ? {} : null;
                    else {
                        try {
                            x = JSON.parse(x);
                        }
                        catch (e) {
                            setMsg(k + ': invalid JSON');
                            return;
                        }
                    }
                }
                else if (t === 'num')
                    x = Number(x) || 0;
                else if (t === 'bool')
                    x = !!x;
                else if (t === 'text')
                    x = String(x !== null && x !== void 0 ? x : '').replace(/\r/g, '');
                else
                    x = String(x !== null && x !== void 0 ? x : '').trim() === '' ? null : String(x).trim();
                out[k] = x;
            }
            for (const k of cfg.key.split(','))
                if (!out[k]) {
                    setMsg(k + ' is required.');
                    return;
                }
            if (cfg.audit || 'updated_by' in row || cfg.table === 'spec_items' || cfg.table === 'spec_vendors')
                out.updated_by = who;
            const unk = condKeys(out.include_when || out.dep || '').filter(x => !OPTMAP[x]);
            if (unk.length && !window.confirm('Unknown option key(s): ' + unk.join(', ') + '. This row will never be included. Save anyway?'))
                return;
            const { error } = await sb.from(cfg.table).upsert(out, { onConflict: cfg.key });
            if (error) {
                setMsg('Save failed: ' + error.message);
                return;
            }
            onSaved();
        };
        const del = async () => {
            if (!window.confirm('Delete this row? The previous version is kept in history.'))
                return;
            let q = sb.from(cfg.table).delete();
            cfg.key.split(',').forEach(k => { q = q.eq(k, row[k]); });
            const { error } = await q;
            if (error) {
                setMsg('Delete failed: ' + error.message);
                return;
            }
            onSaved();
        };
        return React.createElement(Modal, { title: (isNew ? 'New ' : 'Edit ') + cfg.title.toLowerCase(), onClose: onClose, wide: cfg.fields.some(f => f[2] === 'text') },
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' } }, cfg.fields.map(([k, label, t]) => {
                var _a;
                return React.createElement("div", { key: k, style: { gridColumn: (t === 'json' || t === 'text' || ['makers', 'standards', 'application', 'material', 'title', 'label', 'include_when'].includes(k)) ? '1/3' : 'auto' } },
                    React.createElement("label", { style: lbl }, label),
                    Array.isArray(t) ? React.createElement("select", { disabled: !canEdit, value: v[k] || t[1], onChange: e => setV({ ...v, [k]: e.target.value }), style: inp }, t.map(o => React.createElement("option", { key: o }, o)))
                        : t === 'bool' ? React.createElement("input", { type: "checkbox", disabled: !canEdit, checked: !!v[k], onChange: e => setV({ ...v, [k]: e.target.checked }) })
                            : t === 'json' ? React.createElement("textarea", { disabled: !canEdit, value: v[k], onChange: e => setV({ ...v, [k]: e.target.value }), rows: k === 'data' ? 10 : 3, style: { ...inp, fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 11 } })
                                : t === 'text' ? React.createElement("textarea", { disabled: !canEdit, value: v[k], onChange: e => setV({ ...v, [k]: e.target.value }), rows: 14, spellCheck: false, style: { ...inp, fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 11.5, whiteSpace: 'pre' } })
                                    : React.createElement("input", { disabled: !canEdit || (!isNew && cfg.key.split(',').includes(k)), value: (_a = v[k]) !== null && _a !== void 0 ? _a : '', onChange: e => setV({ ...v, [k]: e.target.value }), list: k === 'include_when' || k === 'dep' ? 'optKeyListX' : (k === 'section_num' || k === 'from_num' || k === 'to_num') ? 'secNumListX' : k === 'code' && cfg.table === 'spec_section_standards' ? 'stdCodeListX' : undefined, style: inp }));
            })),
            React.createElement("datalist", { id: "optKeyListX" }, Object.keys(OPTMAP).map(k => React.createElement("option", { key: k, value: k }, OPTMAP[k].t))),
            React.createElement("datalist", { id: "secNumListX" }, LIB.map(S => React.createElement("option", { key: S.num, value: S.num }, S.title))),
            React.createElement("datalist", { id: "stdCodeListX" }, Object.values(AU.std).map(s => React.createElement("option", { key: s.code, value: s.code }, s.title))),
            msg && React.createElement("div", { className: "ai-msg bad", style: { marginTop: 8 } }, msg),
            React.createElement("div", { className: "ai-row", style: { marginTop: 12 } },
                !isNew && canEdit && cfg.canDelete && React.createElement("button", { style: { color: '#b91c1c' }, onClick: del }, "Delete"),
                React.createElement("span", { style: { flex: 1 } }),
                !canEdit && React.createElement("span", { className: "ai-note" }, "Read-only \u2014 only Admin, Lead or Associate can edit the library."),
                React.createElement("button", { onClick: onClose }, "Cancel"),
                canEdit && React.createElement("button", { className: "pri", onClick: save }, "Save to library")));
    }
    function LinksPanel({ S, canEdit, who, onChange }) {
        const [to, setTo] = useState(''), [label, setLabel] = useState(''), [code, setCode] = useState(''), [msg, setMsg] = useState('');
        if (!AU.loaded)
            return React.createElement("div", { className: "ai-msg bad", style: { marginTop: 8 } }, AU.missing || 'Automation tables not loaded.');
        const rels = AU.rel.filter(r => r.from_num === S.num).sort((a, b) => byNum(a.to_num, b.to_num));
        const stds = AU.secstd.filter(x => x.section_num === S.num).sort((a, b) => byNum(a.code, b.code));
        const done = async (p, ok) => { const { error } = await p; if (error) {
            setMsg(error.message);
            return;
        } setMsg(ok); await loadAuto(); onChange(); };
        const addRel = async () => {
            const m = to.trim().match(/^(\d{2})\s?(\d{2})\s?(\d{2}(?:\.\d+)?)$/);
            if (!m)
                return setMsg('Section no. format: 22 0553');
            const num = `${m[1]} ${m[2]}${m[3]}`, inLib = LIB.find(x => x.num === num);
            if (!inLib && !label.trim())
                return setMsg(num + ' is not in the library – enter its title (e.g. Firestopping).');
            await done(sb.from('spec_relations').upsert({ from_num: S.num, to_num: num, label: inLib ? null : label.trim(), active: true, sort: 0, updated_by: who }, { onConflict: 'from_num,to_num' }), 'Link added.');
            setTo('');
            setLabel('');
        };
        const addStd = async () => {
            const c = code.trim();
            if (!c)
                return;
            if (!AU.std[c]) {
                const t = window.prompt(`"${c}" is not in the standards register.\nEnter its title to add it (e.g. Standard for the Installation of Sprinkler Systems):`, '');
                if (!t)
                    return;
                const { error } = await sb.from('spec_standards').insert({ code: c, title: t.trim(), editions: {}, sort: 0, active: true, updated_by: who });
                if (error)
                    return setMsg(error.message);
            }
            await done(sb.from('spec_section_standards').upsert({ section_num: S.num, code: c, active: true, sort: 0, updated_by: who }, { onConflict: 'section_num,code' }), 'Standard linked.');
            setCode('');
        };
        const chip = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, background: '#eef2f7', borderRadius: 999, padding: '3px 8px', margin: '0 5px 5px 0' };
        const x = { border: 0, background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontWeight: 800, padding: 0 };
        return React.createElement("div", { style: { marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
            React.createElement("div", { style: { border: '1px solid #e1e1e6', borderRadius: 10, padding: 10 } },
                React.createElement("div", { style: { ...lbl, marginBottom: 6 } },
                    "Related sections \u2014 fills ",
                    '{{AUTO:RELATED}}'),
                React.createElement("div", null, rels.length ? rels.map(r => { const L = LIB.find(z => z.num === r.to_num); return React.createElement("span", { key: r.to_num, style: chip, title: r.include_when ? 'Only when ' + condLabel(r.include_when) : '' },
                    React.createElement("b", null, r.to_num),
                    L ? titleCase(L.title) : (r.label || '(no title)'),
                    !L && React.createElement("i", { style: { color: '#86868b' } }, "other discipline"),
                    canEdit && React.createElement("button", { style: x, onClick: () => done(sb.from('spec_relations').delete().eq('from_num', S.num).eq('to_num', r.to_num), 'Link removed.') }, "\u2715")); }) : React.createElement("span", { style: { fontSize: 11, color: '#86868b' } }, "No links yet.")),
                canEdit && React.createElement("div", { style: { display: 'flex', gap: 6, marginTop: 6 } },
                    React.createElement("input", { value: to, onChange: e => setTo(e.target.value), list: "secNumListX2", placeholder: "Section no.", style: { ...inp, width: 110 } }),
                    React.createElement("input", { value: label, onChange: e => setLabel(e.target.value), placeholder: "Title (other disciplines only)", style: inp }),
                    React.createElement("button", { className: "schedule-action", onClick: addRel }, "Add"))),
            React.createElement("div", { style: { border: '1px solid #e1e1e6', borderRadius: 10, padding: 10 } },
                React.createElement("div", { style: { ...lbl, marginBottom: 6 } },
                    "Reference standards \u2014 fills ",
                    '{{AUTO:STANDARDS}}'),
                React.createElement("div", null, stds.length ? stds.map(s => React.createElement("span", { key: s.code, style: chip, title: (AU.std[s.code] || {}).title || 'Not in register' },
                    React.createElement("b", null, s.code),
                    !AU.std[s.code] && React.createElement("i", { style: { color: '#b91c1c' } }, "not in register"),
                    canEdit && React.createElement("button", { style: x, onClick: () => done(sb.from('spec_section_standards').delete().eq('section_num', S.num).eq('code', s.code), 'Standard removed.') }, "\u2715"))) : React.createElement("span", { style: { fontSize: 11, color: '#86868b' } }, "No standards linked. Standards named in this section's Items are added automatically.")),
                canEdit && React.createElement("div", { style: { display: 'flex', gap: 6, marginTop: 6 } },
                    React.createElement("input", { value: code, onChange: e => setCode(e.target.value), list: "stdCodeListX2", placeholder: "Standard code, e.g. NFPA 13", style: inp }),
                    React.createElement("button", { className: "schedule-action", onClick: addStd }, "Add"))),
            React.createElement("datalist", { id: "secNumListX2" }, LIB.map(z => React.createElement("option", { key: z.num, value: z.num }, z.title))),
            React.createElement("datalist", { id: "stdCodeListX2" }, Object.values(AU.std).map(s => React.createElement("option", { key: s.code, value: s.code }, s.title))),
            msg && React.createElement("div", { style: { gridColumn: '1/3', fontSize: 10.5, color: /fail|error|violates|denied|format|not in/i.test(msg) ? '#b91c1c' : '#16803a' } }, msg));
    }
    function SectionEditorX({ S, onClose, onSaved, canEdit, who }) {
        const [f, setF] = useState(() => ({ num: S ? S.num : '', title: S ? S.title : '', division: S ? S.div : '', include_when: S ? S.cond : '', sort: S ? S.sort : (LIB.reduce((a, x) => Math.max(a, x.sort || 0), 0) + 10), body: S ? S.body : NEW_SECTION_TEMPLATE.replace('= REFERENCE STANDARDS\n- ', '= RELATED REQUIREMENTS\n- {{AUTO:RELATED}}\n= REFERENCE STANDARDS\n- {{AUTO:STANDARDS}}').replace('# PART 2 PRODUCTS\n= \n- \n', '# PART 2 PRODUCTS\n= {{AUTO:ITEMS}}\n') }));
        const [msg, setMsg] = useState('');
        const [hist, setHist] = useState(null);
        const [paste, setPaste] = useState(null);
        const [ver, setVer] = useState(0);
        const preview = useMemo(() => { const s = sectionFromRow({ num: f.num || '?? ????', title: f.title, include_when: f.include_when, body: f.body }); const o = defaultOpts(); OPTS.forEach(g => g.items.forEach(i => { if (!i.type)
            o[i.k] = true; })); const C = Object.keys(COUNTRIES)[0]; return genSection(s, o, tokens({ country: C, city: '*', pf: profileFor(C, '') }, o)); }, [f, ver]);
        const unknown = [...new Set([...condKeys(f.include_when), ...((f.body.match(/\[if:([^\]]+)\]/g) || []).flatMap(x => condKeys(x.slice(4, -1))))])].filter(k => !OPTMAP[k]);
        const missingBlocks = [...new Set((f.body.match(/\{\{\s*>\s*([A-Za-z0-9_.\-]+)\s*\}\}/g) || []).map(x => x.replace(/[{}>\s]/g, '')))].filter(k => !AU.blocks[k]);
        const save = async () => {
            const nm = String(f.num).trim().match(/^(\d{2})\s?(\d{2})\s?(\d{2})(\.\d+)?$/);
            if (!nm)
                return setMsg('Section number must be CSI format, e.g. 22 4000');
            const num = nm[1] + ' ' + nm[2] + nm[3] + (nm[4] || ''), title = f.title.trim().toUpperCase();
            if (!title)
                return setMsg('Title is required.');
            if ((!S || S.num !== num) && LIB.find(x => x.num === num) && !window.confirm('Section ' + num + ' already exists. Overwrite it?'))
                return;
            const row = { num, title, division: (f.division || '').trim() || num.slice(0, 2), include_when: (f.include_when || '').trim() || null, body: f.body.replace(/\r/g, ''), sort: Number(f.sort) || 0, active: true, updated_by: who };
            const { error } = await sb.from('spec_sections').upsert(row, { onConflict: 'num' });
            if (error)
                return setMsg('Save failed: ' + error.message);
            if (S && S.num !== num)
                await sb.from('spec_sections').update({ active: false, updated_by: who }).eq('num', S.num);
            onSaved();
        };
        const deactivate = async () => { if (!window.confirm('Deactivate section ' + S.num + '? It will no longer appear in new specifications (history is kept).'))
            return; const { error } = await sb.from('spec_sections').update({ active: false, updated_by: who }).eq('num', S.num); if (error)
            return setMsg(error.message); onSaved(); };
        const showHist = async () => { const { data, error } = await sb.from('spec_section_history').select('*').eq('section_num', S.num).order('changed_at', { ascending: false }).limit(50); if (error)
            return setMsg(error.message); setHist(data || []); };
        return React.createElement(Modal, { title: S ? 'Edit section ' + S.num : 'New section', onClose: onClose, wide: true },
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '120px 1fr 80px 1.2fr 70px', gap: 8 } }, [['num', 'Section no.'], ['title', 'Title'], ['division', 'Division'], ['include_when', 'Include when (blank = every project)'], ['sort', 'Sort']].map(([k, l]) => { var _a; return React.createElement("div", { key: k },
                React.createElement("label", { style: lbl }, l),
                React.createElement("input", { disabled: !canEdit, value: (_a = f[k]) !== null && _a !== void 0 ? _a : '', list: k === 'include_when' ? 'optKeyListX3' : undefined, onChange: e => setF({ ...f, [k]: e.target.value }), style: inp })); })),
            React.createElement("datalist", { id: "optKeyListX3" }, Object.keys(OPTMAP).map(k => React.createElement("option", { key: k, value: k }, OPTMAP[k].t))),
            React.createElement("div", { style: { fontSize: 10, color: '#86868b', margin: '8px 0' } },
                "Format: ",
                React.createElement("code", null, "# PART 1 GENERAL"),
                " \u00B7 ",
                React.createElement("code", null, "= ARTICLE"),
                " \u00B7 ",
                React.createElement("code", null, "- paragraph"),
                " \u00B7 ",
                React.createElement("code", null, "[if:key]"),
                " \u00B7 fields ",
                React.createElement("code", null, '{{CD}} {{WATER}}'),
                ". Automatic lists: ",
                React.createElement("code", null, '- {{AUTO:RELATED}}'),
                " and ",
                React.createElement("code", null, '- {{AUTO:STANDARDS}}'),
                " as a line in their article \u00B7 common text ",
                React.createElement("code", null, '- {{>COMMON.KEY}}'),
                ". Numbering is automatic."),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
                React.createElement("textarea", { disabled: !canEdit, value: f.body, onChange: e => setF({ ...f, body: e.target.value }), spellCheck: false, style: { ...inp, height: '46vh', fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 11.5, whiteSpace: 'pre' } }),
                React.createElement("div", { className: "spec-doc spec-edit sd", style: { height: '46vh', overflow: 'auto' }, dangerouslySetInnerHTML: { __html: preview } })),
            S && React.createElement(LinksPanel, { S: S, canEdit: canEdit, who: who, onChange: () => setVer(x => x + 1) }),
            S && AU.itemsLoaded && (() => { const its = actv(ITEMS.items).filter(i => i.section_num === S.num).sort((a, b) => (a.sort || 0) - (b.sort || 0)); return its.length ? React.createElement("div", { style: { marginTop: 8, fontSize: 10.5, color: '#424245' } },
                React.createElement("b", null, "Items in this section:"),
                " ",
                its.map(i => React.createElement("span", { key: i.code, style: { marginRight: 8 } },
                    i.code,
                    " ",
                    itemHeading(i, AU.itemRev[i.code]),
                    AU.itemRev[i.code] ? ' (' + fmtRev(AU.itemRev[i.code]) + ')' : ' (schedule line)')),
                " \u2014 edit their text under Library \u203A Item specifications.") : null; })(),
            !S && React.createElement("div", { style: { fontSize: 10.5, color: '#86868b', marginTop: 8 } }, "Save the section first, then reopen it to add related sections and standards."),
            unknown.length > 0 && React.createElement("div", { className: "ai-msg bad", style: { marginTop: 8 } },
                "Unknown option key(s): ",
                unknown.join(', '),
                " \u2014 add them under Project options or those clauses will never be included."),
            missingBlocks.length > 0 && React.createElement("div", { className: "ai-msg bad", style: { marginTop: 8 } },
                "Common text not found: ",
                missingBlocks.join(', '),
                " \u2014 add it under Library \u203A Common text."),
            msg && React.createElement("div", { className: "ai-msg bad", style: { marginTop: 8 } }, msg),
            hist && React.createElement("div", { className: "ai-review", style: { marginTop: 8 } }, hist.length ? hist.map((h, i) => React.createElement("div", { key: i, style: { display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid #ece6fd', padding: '4px 0' } },
                React.createElement("span", { style: { flex: 1 } },
                    fmtWhen(h.changed_at),
                    " \u00B7 ",
                    h.changed_by || '—',
                    " \u00B7 ",
                    h.action,
                    " \u00B7 ",
                    h.title),
                canEdit && React.createElement("button", { className: "schedule-action", onClick: () => setF({ ...f, title: h.title, include_when: h.include_when || '', body: h.body || '' }) }, "Load"))) : 'No previous versions.'),
            paste !== null && React.createElement("div", { style: { marginTop: 8 } },
                React.createElement("textarea", { value: paste, onChange: e => setPaste(e.target.value), placeholder: "Paste the whole section from Word here (PART 1, 1.1, A., 1., a. are converted)", style: { ...inp, height: 160 } }),
                React.createElement("div", { className: "ai-row", style: { marginTop: 6 } },
                    React.createElement("span", { style: { flex: 1 } }),
                    React.createElement("button", { onClick: () => setPaste(null) }, "Cancel"),
                    React.createElement("button", { className: "pri", onClick: () => { const r = convertCSI(paste); setF({ ...f, num: f.num || r.num, division: f.division || r.num.slice(0, 2), title: f.title || r.title, body: r.body }); setPaste(null); } }, "Convert into editor"))),
            React.createElement("div", { className: "ai-row", style: { marginTop: 12 } },
                S && React.createElement("button", { onClick: showHist }, "History"),
                canEdit && React.createElement("button", { onClick: () => setPaste('') }, "Paste from Word\u2026"),
                React.createElement("span", { style: { flex: 1 } }),
                !canEdit && React.createElement("span", { className: "ai-note" }, "Read-only"),
                S && canEdit && React.createElement("button", { style: { color: '#b91c1c' }, onClick: deactivate }, "Deactivate"),
                React.createElement("button", { onClick: onClose }, "Close"),
                canEdit && React.createElement("button", { className: "pri", onClick: save }, "Save to library")));
    }
    function ConvertDialog({ onClose, onDone, who }) {
        const [an, setAn] = useState(null), [busy, setBusy] = useState(''), [err, setErr] = useState('');
        useEffect(() => { setAn(analyse(LIB, AU.std, AU.blocks)); }, []);
        const apply = async () => {
            setBusy('Saving…');
            setErr('');
            try {
                const step = async (label, p) => { setBusy(label); const { error } = await p; if (error)
                    throw new Error(label + ': ' + error.message); };
                const std = Object.values(an.std).map(s => ({ ...s, editions: {}, sort: 0, active: true, updated_by: who }));
                if (std.length)
                    await step('Standards register', sb.from('spec_standards').upsert(std, { onConflict: 'code', ignoreDuplicates: true }));
                if (an.blocks.length)
                    await step('Common text', sb.from('spec_blocks').upsert(an.blocks.map(b => ({ key: b.key, title: b.title, body: b.body, sort: 0, active: true, updated_by: who })), { onConflict: 'key', ignoreDuplicates: true }));
                if (an.rels.length)
                    await step('Related links', sb.from('spec_relations').upsert(an.rels.map(r => ({ ...r, sort: 0, active: true, updated_by: who })), { onConflict: 'from_num,to_num' }));
                if (an.secstd.length)
                    await step('Section standards', sb.from('spec_section_standards').upsert(an.secstd.map(r => ({ ...r, sort: 0, active: true, updated_by: who })), { onConflict: 'section_num,code' }));
                for (const s of an.secs)
                    await step('Section ' + s.num, sb.from('spec_sections').update({ body: s.body, updated_by: who }).eq('num', s.num));
                setBusy('');
                onDone();
            }
            catch (e) {
                setBusy('');
                setErr(e.message + ' — anything saved before this step is kept; you can run the conversion again safely.');
            }
        };
        if (!an)
            return null;
        const tot = an.secs.reduce((a, s) => ({ rel: a.rel + s.rel, std: a.std + s.std, blk: a.blk + s.blk, kept: a.kept + s.kept }), { rel: 0, std: 0, blk: 0, kept: 0 });
        return React.createElement(Modal, { title: "Convert typed lists to automatic", onClose: onClose, wide: true },
            React.createElement("div", { style: { fontSize: 12, lineHeight: 1.55, color: '#424245' } },
                "This reads every library section and moves the typed lists into library data. The previous text of each section is kept in its History.",
                React.createElement("ul", { style: { margin: '8px 0 8px 18px' } },
                    React.createElement("li", null,
                        React.createElement("b", null, tot.rel),
                        " related-section lines \u2192 ",
                        React.createElement("b", null, an.rels.length),
                        " links; the article becomes ",
                        React.createElement("code", null, '{{AUTO:RELATED}}'),
                        "."),
                    React.createElement("li", null,
                        React.createElement("b", null, tot.std),
                        " reference-standard lines \u2192 ",
                        React.createElement("b", null, an.secstd.length),
                        " section links and ",
                        React.createElement("b", null, Object.keys(an.std).length),
                        " new standards in the register; the article becomes ",
                        React.createElement("code", null, '{{AUTO:STANDARDS}}'),
                        "."),
                    React.createElement("li", null,
                        React.createElement("b", null, an.blocks.length),
                        " articles repeated word-for-word in 3 or more sections \u2192 common text blocks (",
                        tot.blk,
                        " articles replaced)."),
                    React.createElement("li", null,
                        React.createElement("b", null, tot.kept),
                        " lines that are not plain references (qualified or project wording) stay as typed text."),
                    React.createElement("li", null,
                        React.createElement("b", null, an.secs.length),
                        " of ",
                        LIB.filter(S => !isAnnexNum(S.num)).length,
                        " sections change."))),
            an.blocks.length > 0 && React.createElement("div", { style: { fontSize: 11, margin: '4px 0 8px' } },
                React.createElement("b", null, "Common text found:"),
                " ",
                an.blocks.map(b => `${b.key} (${b.count} sections)`).join(' · ')),
            React.createElement("div", { className: "schedule-table-wrap", style: { maxHeight: '34vh', minHeight: 0, border: '1px solid #e1e1e6', borderRadius: 8 } },
                React.createElement("table", { className: "schedule-table", style: { minWidth: 0, tableLayout: 'auto' } },
                    React.createElement("thead", null,
                        React.createElement("tr", { className: "labels" },
                            React.createElement("th", null, "Section"),
                            React.createElement("th", null, "Related \u2192 links"),
                            React.createElement("th", null, "Standards \u2192 register"),
                            React.createElement("th", null, "Common text"),
                            React.createElement("th", null, "Kept as text"))),
                    React.createElement("tbody", null, an.secs.map(s => React.createElement("tr", { key: s.num },
                        React.createElement("td", { className: "tag-code" }, s.num),
                        React.createElement("td", { className: "num" }, s.rel),
                        React.createElement("td", { className: "num" }, s.std),
                        React.createElement("td", { className: "num" }, s.blk),
                        React.createElement("td", { className: "num" }, s.kept)))))),
            React.createElement("div", { style: { fontSize: 10.5, color: '#a76200', background: '#fff4e0', borderRadius: 8, padding: '7px 10px', marginTop: 8 } },
                "After converting, check the new ",
                React.createElement("b", null, "Standards"),
                " tab: titles and editions are taken from your text as written (some editions are old). Draft projects pick up the automatic lists at once; issued stages keep their frozen text."),
            err && React.createElement("div", { className: "ai-msg bad", style: { marginTop: 8 } }, err),
            React.createElement("div", { className: "ai-row", style: { marginTop: 12 } },
                React.createElement("span", { style: { flex: 1 } }),
                busy && React.createElement("span", { className: "ai-note" }, busy),
                React.createElement("button", { onClick: onClose }, "Cancel"),
                React.createElement("button", { className: "pri", disabled: !!busy || !an.secs.length, onClick: apply },
                    "Convert ",
                    an.secs.length,
                    " sections")));
    }
    // ── #20 UI: item specifications ─────────────────────────────────────────
    function lineDiff(a, b) {
        const A = String(a || '').replace(/\s+$/, '').split('\n'), B = String(b || '').replace(/\s+$/, '').split('\n');
        const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
        for (let i = n - 1; i >= 0; i--)
            for (let j = m - 1; j >= 0; j--)
                L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
        const out = [];
        let i = 0, j = 0;
        while (i < n && j < m) {
            if (A[i] === B[j]) {
                out.push(['=', A[i]]);
                i++;
                j++;
            }
            else if (L[i + 1][j] >= L[i][j + 1])
                out.push(['-', A[i++]]);
            else
                out.push(['+', B[j++]]);
        }
        while (i < n)
            out.push(['-', A[i++]]);
        while (j < m)
            out.push(['+', B[j++]]);
        return out;
    }
    function DiffView({ a, b, label }) {
        const d = lineDiff(a, b), changed = d.some(x => x[0] !== '=');
        return React.createElement("div", { style: { marginTop: 6 } },
            React.createElement("div", { style: { ...lbl, marginBottom: 3 } },
                label,
                !changed && ' — no change'),
            changed && React.createElement("div", { style: { border: '1px solid #e1e1e6', borderRadius: 8, padding: '6px 8px', font: '11px ui-monospace,Menlo,Consolas,monospace', maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap' } }, d.map((x, k) => React.createElement("div", { key: k, style: { background: x[0] === '+' ? '#e8faf0' : x[0] === '-' ? '#fff0ee' : 'transparent', color: x[0] === '+' ? '#16803a' : x[0] === '-' ? '#b42318' : '#6e6e73', textDecoration: x[0] === '-' ? 'line-through' : 'none' } },
                x[0] === '=' ? '  ' : x[0] + ' ',
                x[1] || ' '))));
    }
    function badLines(t) { return String(t || '').split('\n').filter(l => { let s = l.trim(); if (!s)
        return false; s = s.replace(/^\[if:[^\]]+\]\s*/, ''); return !s.startsWith('- '); }).length; }
    function itemPreview(it, f) {
        const o = defaultOpts();
        OPTS.forEach(g => g.items.forEach(i => { if (!i.type)
            o[i.k] = true; }));
        const C = Object.keys(COUNTRIES)[0], T = tokens({ country: C, city: '*', pf: profileFor(C, '') }, o), S = { num: it.section_num }, inc = incSet(o);
        const h = String(itemHeading(it, { heading: f.heading })).toUpperCase();
        const part = (t, body) => { const cl = renderClauses(itemTextLines(body), S, o, T, inc); return cl.length ? `<p class="pt">${t}</p><p class="ar"><span>x.x</span>${esc(h)}</p>${cl.join('')}` : ''; };
        return (part('PART 2 - PRODUCTS', f.part2) + part('PART 3 - EXECUTION', f.part3)) || '<p style="color:#86868b">No text yet.</p>';
    }
    const fmtRev = r => r ? `Rev ${r.rev}` : '—';
    function ItemSpecEditor({ it, canEdit, who, myEmail, onClose, onSaved }) {
        const cur = AU.itemRev[it.code], dr = AU.itemDraft[it.code];
        const revs = AU.revs.filter(r => r.item_code === it.code).sort((a, b) => b.rev - a.rev);
        const src = dr || cur || {};
        const init = { heading: src.heading || '', part2: src.part2 || '', part3: src.part3 || '', standards: src.standards || '', reason: dr ? (dr.reason || '') : '' };
        const [f, setF] = useState(init);
        const [msg, setMsg] = useState('');
        const [busy, setBusy] = useState('');
        const [cmp, setCmp] = useState(null);
        const mine = dr && myEmail && (dr.created_email || '').toLowerCase() === myEmail;
        const dirty = JSON.stringify(f) !== JSON.stringify(init);
        const nBad = badLines(f.part2) + badLines(f.part3);
        const unknownStd = String(f.standards || '').split(/[;,\n]/).map(x => x.trim()).filter(Boolean).filter(c => !AU.std[c]);
        const run = async (label, fn) => { setBusy(label); setMsg(''); try {
            await fn();
            setBusy('');
            onSaved();
        }
        catch (e) {
            setBusy('');
            setMsg((e && e.message) || String(e));
        } };
        const ok = r => { if (r.error)
            throw new Error(r.error.message); return r; };
        const saveDraft = () => {
            if (!f.reason.trim())
                return setMsg('Enter the reason for this revision, e.g. "Updated to ASTM C534-2023 and current DCD fire rating (supplier request)".');
            if (!f.part2.trim() && !f.part3.trim())
                return setMsg('Enter the Part 2 and/or Part 3 text.');
            if (nBad)
                return setMsg(nBad + ' line(s) do not start with "- ". Every clause line starts with "- " (2 spaces per sub-level).');
            const row = { heading: f.heading.trim() || null, part2: f.part2.replace(/\r/g, ''), part3: f.part3.replace(/\r/g, ''), standards: f.standards.trim() || null, reason: f.reason.trim(), created_by: who };
            return run('Saving draft…', async () => {
                if (dr)
                    ok(await sb.from('spec_item_revs').update(row).eq('id', dr.id));
                else
                    ok(await sb.from('spec_item_revs').insert({ ...row, item_code: it.code, rev: (revs[0] ? revs[0].rev : 0) + 1 }));
            });
        };
        const approve = () => {
            if (!window.confirm(`Approve and publish ${fmtRev(dr)} of ${it.code}?\n\nThe library and every draft project that uses this item take the new text at once. Issued stages keep their frozen text.`))
                return;
            run('Approving…', async () => ok(await sb.rpc('spec_item_rev_approve', { p_id: dr.id })));
        };
        const reject = () => { const n = window.prompt('Reject this draft — reason (required):', ''); if (!n || !n.trim())
            return; run('Rejecting…', async () => ok(await sb.rpc('spec_item_rev_reject', { p_id: dr.id, p_note: n.trim() }))); };
        const discard = () => { if (!window.confirm('Delete this draft revision?'))
            return; run('Deleting…', async () => ok(await sb.from('spec_item_revs').delete().eq('id', dr.id))); };
        const ta = { ...inp, fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 11.5, whiteSpace: 'pre', height: '22vh' };
        return React.createElement(Modal, { title: `Item specification — ${it.code} · ${itemHeading(it, cur)}`, onClose: onClose, wide: true },
            React.createElement("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, marginBottom: 8 } },
                React.createElement("span", { className: "status-chip draft" },
                    "Section ",
                    fmtNum(it.section_num)),
                cur ? React.createElement("span", { className: "status-chip pass" },
                    "Published ",
                    fmtRev(cur),
                    " \u00B7 ",
                    cur.approved_by || '',
                    " \u00B7 ",
                    fmtDay(cur.approved_at)) : React.createElement("span", { className: "status-chip blocked" }, "No published text \u2014 section uses the product schedule line"),
                dr && React.createElement("span", { className: "status-chip review" },
                    "Draft ",
                    fmtRev(dr),
                    " by ",
                    dr.created_by || dr.created_email,
                    " \u2014 awaiting approval"),
                it.include_when && React.createElement("span", { className: "status-chip draft" },
                    "Included when ",
                    condLabel(it.include_when))),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
                React.createElement("div", null,
                    React.createElement("label", { style: lbl }, "Article heading (blank = item name)"),
                    React.createElement("input", { disabled: !canEdit && dr && !mine, value: f.heading, onChange: e => setF({ ...f, heading: e.target.value }), placeholder: itemHeading(it, null), style: inp }),
                    React.createElement("label", { style: { ...lbl, marginTop: 8 } },
                        "Part 2 \u2013 Products (- lines, [if:key], ",
                        '{{FIELDS}}',
                        ", ",
                        '{{>COMMON.KEY}}',
                        ")"),
                    React.createElement("textarea", { value: f.part2, onChange: e => setF({ ...f, part2: e.target.value }), spellCheck: false, style: ta }),
                    React.createElement("label", { style: { ...lbl, marginTop: 8 } }, "Part 3 \u2013 Execution for this item (optional)"),
                    React.createElement("textarea", { value: f.part3, onChange: e => setF({ ...f, part3: e.target.value }), spellCheck: false, style: { ...ta, height: '12vh' } }),
                    React.createElement("label", { style: { ...lbl, marginTop: 8 } }, "Standards cited (codes, separated by ;) \u2014 added to Reference Standards"),
                    React.createElement("input", { value: f.standards, onChange: e => setF({ ...f, standards: e.target.value }), list: "stdCodeListI", placeholder: "ASTM C534; ASTM E84", style: inp }),
                    unknownStd.length > 0 && React.createElement("div", { style: { fontSize: 10, color: '#a76200', marginTop: 3 } },
                        "Not in the standards register yet: ",
                        unknownStd.join(', '),
                        " \u2014 add them under Library \u203A Standards."),
                    React.createElement("label", { style: { ...lbl, marginTop: 8 } }, "Reason for this revision (required)"),
                    React.createElement("input", { value: f.reason, onChange: e => setF({ ...f, reason: e.target.value }), placeholder: "e.g. Supplier advised ASTM C534 2023 edition; fire rating per current UAE FLSC", style: inp }),
                    React.createElement("datalist", { id: "stdCodeListI" }, Object.values(AU.std).map(x => React.createElement("option", { key: x.code, value: x.code }, x.title)))),
                React.createElement("div", null,
                    React.createElement("div", { style: { ...lbl, marginBottom: 4 } }, "Preview"),
                    React.createElement("div", { className: "spec-doc spec-edit sd", style: { height: '36vh', overflow: 'auto', padding: '12px 16px' }, dangerouslySetInnerHTML: { __html: itemPreview(it, f) } }),
                    (cur || cmp) && React.createElement(React.Fragment, null,
                        React.createElement(DiffView, { label: `Part 2 — changes vs ${cmp ? fmtRev(cmp) : 'published ' + fmtRev(cur)}`, a: (cmp || cur).part2, b: f.part2 }),
                        React.createElement(DiffView, { label: "Part 3 \u2014 changes", a: (cmp || cur).part3, b: f.part3 })))),
            React.createElement("div", { style: { marginTop: 10, borderTop: '1px solid #ececf0', paddingTop: 8 } },
                React.createElement("div", { style: { ...lbl, marginBottom: 4 } }, "Revision history"),
                React.createElement("div", { style: { maxHeight: 130, overflow: 'auto' } }, revs.length ? revs.map(r => React.createElement("div", { key: r.id, style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, padding: '3px 0', borderBottom: '1px solid #f0f0f2' } },
                    React.createElement("b", { style: { width: 46 } }, fmtRev(r)),
                    React.createElement("span", { className: 'status-chip ' + (r.status === 'approved' ? 'pass' : r.status === 'draft' ? 'review' : r.status === 'rejected' ? 'blocked' : 'draft') }, r.status),
                    React.createElement("span", { style: { flex: 1, color: '#424245' } },
                        r.reason || '',
                        r.reject_note ? ' — rejected: ' + r.reject_note : ''),
                    React.createElement("span", { style: { color: '#86868b' } },
                        r.created_by || '',
                        " ",
                        fmtDay(r.created_at),
                        r.approved_by ? ' · approved ' + r.approved_by + ' ' + fmtDay(r.approved_at) : ''),
                    React.createElement("button", { className: "schedule-action", onClick: () => setCmp(cmp && cmp.id === r.id ? null : r) }, cmp && cmp.id === r.id ? 'Hide' : 'Compare'),
                    (!dr || canEdit || mine) && r.status !== 'draft' && React.createElement("button", { className: "schedule-action", onClick: () => setF({ heading: r.heading || '', part2: r.part2 || '', part3: r.part3 || '', standards: r.standards || '', reason: `Restored from Rev ${r.rev}` }) }, "Load"))) : React.createElement("span", { style: { fontSize: 11, color: '#86868b' } }, "No revisions yet. Write the text and save a draft."))),
            msg && React.createElement("div", { className: "ai-msg bad", style: { marginTop: 8 } }, msg),
            React.createElement("div", { className: "ai-row", style: { marginTop: 12 } },
                dr && (canEdit || mine) && React.createElement("button", { style: { color: '#b91c1c' }, onClick: discard }, "Delete draft"),
                dr && canEdit && !mine && React.createElement("button", { onClick: reject }, "Reject"),
                React.createElement("span", { style: { flex: 1 } }),
                busy && React.createElement("span", { className: "ai-note" }, busy),
                React.createElement("button", { onClick: onClose }, "Close"),
                (!dr || canEdit || mine) && React.createElement("button", { disabled: !!busy || (!dirty && !!dr), onClick: saveDraft }, dr ? 'Save draft' : 'Save as draft'),
                dr && canEdit && React.createElement("button", { className: "pri", disabled: !!busy || dirty, title: dirty ? 'Save the draft first' : mine ? 'Another Lead / Associate must approve your own draft (Admin may approve)' : '', onClick: approve }, "Approve & publish")),
            React.createElement("div", { style: { fontSize: 10, color: '#86868b', marginTop: 6 } }, "Anyone on the team can propose a revision. A Lead / Associate (not the author) approves it; then the library and all draft projects use it at once. Issued stages keep their frozen text."));
    }
    function findPart2Articles() {
        const out = [];
        LIB.filter(S => !isAnnexNum(S.num)).forEach(S => {
            const lines = String(S.body || '').split('\n');
            let part = '', cur = null;
            const close = () => { if (cur) {
                while (cur.lines.length && !cur.lines[cur.lines.length - 1].trim())
                    cur.lines.pop();
                cur.end = cur.start + 1 + cur.n;
                if (cur.lines.some(l => l.trim()))
                    out.push(cur);
                cur = null;
            } };
            lines.forEach((raw, i) => {
                let t = raw.trim();
                const m = t.match(/^\[if:([^\]]+)\]\s*/);
                const cond = m ? m[1] : '';
                if (m)
                    t = t.slice(m[0].length);
                if (t.startsWith('# ')) {
                    close();
                    part = t;
                    return;
                }
                if (t.startsWith('= ')) {
                    close();
                    const title = t.slice(2).trim();
                    if (/PRODUCTS/i.test(part) && title && !/^(MANUFACTURER|PRODUCT SCHEDULE)/i.test(title) && !/\{\{/.test(title))
                        cur = { S, start: i, n: 0, title, cond, lines: [], on: true };
                    return;
                }
                if (cur) {
                    cur.lines.push(raw.replace(/\s+$/, ''));
                    cur.n++;
                }
            });
            close();
        });
        return out;
    }
    function ConvertItemsDialog({ onClose, onDone, who }) {
        const [c, setC] = useState(() => findPart2Articles());
        const [busy, setBusy] = useState('');
        const [err, setErr] = useState('');
        const sel = c.filter(x => x.on), nSec = new Set(sel.map(x => x.S.num)).size;
        const apply = async () => {
            setErr('');
            let n = Math.max(0, ...ITEMS.items.map(i => +String(i.code).replace(/\D/g, '') || 0));
            const bySec = {};
            sel.forEach(x => { (bySec[x.S.num] = bySec[x.S.num] || []).push(x); });
            try {
                for (const [num, list] of Object.entries(bySec)) {
                    setBusy('Section ' + num + '…');
                    for (let k = 0; k < list.length; k++) {
                        const x = list[k];
                        n++;
                        const code = 'IT-' + String(n).padStart(4, '0'), name = titleCase(x.title);
                        let r = await sb.from('spec_items').upsert({ code, section_num: num, grp: 'Specification', item: name, material: name, include_when: x.cond || null, status: 'Draft', source: 'Converted from section ' + num, sort: 5000 + k * 10, active: true, updated_by: who }, { onConflict: 'code' });
                        if (r.error)
                            throw new Error(code + ': ' + r.error.message);
                        r = await sb.rpc('spec_item_import', { p_item_code: code, p_part2: x.lines.join('\n') + '\n', p_reason: 'Imported from section ' + num + ' (library text, unchanged)' });
                        if (r.error)
                            throw new Error(code + ': ' + r.error.message);
                    }
                    const S = list[0].S, lines = String(S.body || '').split('\n'), drop = new Set();
                    list.forEach(x => { for (let i = x.start; i < x.end; i++)
                        drop.add(i); });
                    const first = Math.min(...list.map(x => x.start));
                    const nb = lines.map((l, i) => i === first ? '= {{AUTO:ITEMS}}' : drop.has(i) ? null : l).filter(l => l !== null).join('\n');
                    const r = await sb.from('spec_sections').update({ body: nb, updated_by: who }).eq('num', num);
                    if (r.error)
                        throw new Error('Section ' + num + ': ' + r.error.message);
                }
                setBusy('');
                onDone();
            }
            catch (e) {
                setBusy('');
                setErr(e.message + ' — sections finished before this point are converted; reopen this dialog to continue.');
            }
        };
        let last = null;
        return React.createElement(Modal, { title: "Split Part 2 articles into item specifications", onClose: onClose, wide: true },
            React.createElement("div", { style: { fontSize: 12, lineHeight: 1.55, color: '#424245' } },
                "Each ticked Part 2 article becomes an ",
                React.createElement("b", null, "item"),
                " with its own specification (published as Rev 1, text unchanged). The section keeps one line ",
                React.createElement("code", null, '= {{AUTO:ITEMS}}'),
                " where the articles were, and prints the items selected for the project in the same place. Part 1 and Part 3 stay in the section. Article conditions (",
                React.createElement("code", null, "[if:\u2026]"),
                ") move to the item. Each section's previous text stays in its History."),
            React.createElement("div", { style: { fontSize: 11, margin: '8px 0' } },
                React.createElement("b", null, sel.length),
                " of ",
                c.length,
                " articles in ",
                React.createElement("b", null, nSec),
                " sections \u00B7 ",
                React.createElement("a", { href: "#", onClick: e => { e.preventDefault(); setC(c.map(x => ({ ...x, on: true }))); } }, "tick all"),
                " \u00B7 ",
                React.createElement("a", { href: "#", onClick: e => { e.preventDefault(); setC(c.map(x => ({ ...x, on: false }))); } }, "untick all")),
            React.createElement("div", { className: "schedule-table-wrap", style: { maxHeight: '46vh', minHeight: 0, border: '1px solid #e1e1e6', borderRadius: 8 } },
                React.createElement("table", { className: "schedule-table", style: { minWidth: 0, tableLayout: 'auto' } },
                    React.createElement("thead", null,
                        React.createElement("tr", { className: "labels" },
                            React.createElement("th", null),
                            React.createElement("th", null, "Section"),
                            React.createElement("th", null, "Article \u2192 item"),
                            React.createElement("th", null, "Clauses"),
                            React.createElement("th", null, "Condition"))),
                    React.createElement("tbody", null, c.map((x, k) => {
                        const head = x.S.num !== last;
                        last = x.S.num;
                        return React.createElement("tr", { key: k, onClick: () => setC(c.map((y, j) => j === k ? { ...y, on: !y.on } : y)), style: { opacity: x.on ? 1 : .45 } },
                            React.createElement("td", null,
                                React.createElement("input", { type: "checkbox", checked: x.on, readOnly: true })),
                            React.createElement("td", { className: "tag-code" }, head ? x.S.num : ''),
                            React.createElement("td", null, titleCase(x.title)),
                            React.createElement("td", { className: "num" }, x.lines.filter(l => l.trim()).length),
                            React.createElement("td", { style: { fontSize: 10 } }, x.cond ? condLabel(x.cond) : ''));
                    })))),
            React.createElement("div", { style: { fontSize: 10.5, color: '#a76200', background: '#fff4e0', borderRadius: 8, padding: '7px 10px', marginTop: 8 } }, "Untick generic articles you want to keep as section text (e.g. \"General requirements\", \"Materials \u2013 general\"). You can split more sections later; converted sections are not offered again."),
            err && React.createElement("div", { className: "ai-msg bad", style: { marginTop: 8 } }, err),
            React.createElement("div", { className: "ai-row", style: { marginTop: 12 } },
                React.createElement("span", { style: { flex: 1 } }),
                busy && React.createElement("span", { className: "ai-note" }, busy),
                React.createElement("button", { onClick: onClose }, "Cancel"),
                React.createElement("button", { className: "pri", disabled: !!busy || !sel.length, onClick: apply },
                    "Create ",
                    sel.length,
                    " items")));
    }
    function ItemSpecsTab({ canEdit, who, myEmail, filter, onChanged }) {
        const [open, setOpen] = useState(null), [sec, setSec] = useState(''), [st, setSt] = useState(''), [conv, setConv] = useState(false);
        if (!AU.itemsLoaded)
            return React.createElement("div", { className: "empty-schedule" }, AU.itemsMissing || 'Item specifications not loaded.');
        const items = actv(ITEMS.items);
        const status = it => AU.itemDraft[it.code] ? 'draft' : AU.itemRev[it.code] ? 'published' : 'none';
        const secs = [...new Set(items.map(i => i.section_num))].sort(byNum);
        const rows = items.filter(it => (!sec || it.section_num === sec) && (!st || status(it) === st) && (!filter || JSON.stringify(it).toLowerCase().includes(filter.toLowerCase())))
            .sort((a, b) => byNum(a.section_num, b.section_num) || (a.sort || 0) - (b.sort || 0));
        const recent = r => r && r.approved_at && (Date.now() - new Date(r.approved_at)) < 14 * 864e5;
        const pending = items.filter(it => AU.itemDraft[it.code]).length, withText = items.filter(it => AU.itemRev[it.code]).length;
        const done = async () => { setOpen(null); setConv(false); await onChanged(); };
        return React.createElement(React.Fragment, null,
            React.createElement("div", { className: "schedule-toolbar", style: { background: '#fff' } },
                React.createElement("select", { value: sec, onChange: e => setSec(e.target.value) },
                    React.createElement("option", { value: "" }, "All sections"),
                    secs.map(n => { const L = LIB.find(x => x.num === n); return React.createElement("option", { key: n, value: n },
                        n,
                        " ",
                        L ? titleCase(L.title) : ''); })),
                React.createElement("select", { value: st, onChange: e => setSt(e.target.value) },
                    React.createElement("option", { value: "" }, "All"),
                    React.createElement("option", { value: "published" }, "Published"),
                    React.createElement("option", { value: "draft" }, "Draft awaiting approval"),
                    React.createElement("option", { value: "none" }, "No specification text")),
                React.createElement("span", { style: { fontSize: 11, color: '#424245' } },
                    withText,
                    " of ",
                    items.length,
                    " items have their own specification",
                    pending ? React.createElement("b", { style: { color: '#a76200' } },
                        " \u00B7 ",
                        pending,
                        " draft",
                        pending === 1 ? '' : 's',
                        " awaiting approval") : ''),
                React.createElement("span", { className: "toolbar-spacer" }),
                canEdit && React.createElement("button", { className: "schedule-action", onClick: () => setConv(true) }, "\u2699 Split section articles into items")),
            React.createElement("table", { className: "schedule-table", style: { minWidth: 900, tableLayout: 'auto' } },
                React.createElement("thead", null,
                    React.createElement("tr", { className: "labels" },
                        React.createElement("th", null, "Item"),
                        React.createElement("th", null, "Section"),
                        React.createElement("th", null, "Name / heading"),
                        React.createElement("th", null, "Specification"),
                        React.createElement("th", null, "Standards"),
                        React.createElement("th", null, "Last change"),
                        React.createElement("th", null))),
                React.createElement("tbody", null,
                    rows.map(it => {
                        const cur = AU.itemRev[it.code], dr = AU.itemDraft[it.code];
                        return React.createElement("tr", { key: it.code, onClick: () => setOpen(it) },
                            React.createElement("td", { className: "tag-code" }, it.code),
                            React.createElement("td", { className: "tag-code" }, it.section_num),
                            React.createElement("td", null,
                                itemHeading(it, cur),
                                it.include_when && React.createElement("div", { style: { fontSize: 9.5, color: '#86868b' } },
                                    "when ",
                                    condLabel(it.include_when))),
                            React.createElement("td", null,
                                cur ? React.createElement(Chip, { k: "pass" }, fmtRev(cur)) : React.createElement(Chip, { k: "draft" }, "schedule line only"),
                                " ",
                                dr && React.createElement(Chip, { k: "review" },
                                    "Draft ",
                                    fmtRev(dr)),
                                " ",
                                recent(cur) && React.createElement(Chip, { k: "review" },
                                    "updated ",
                                    fmtDay(cur.approved_at))),
                            React.createElement("td", { style: { fontSize: 10 } }, (cur && cur.standards) || it.standards || ''),
                            React.createElement("td", { style: { fontSize: 10 } }, cur ? (cur.reason || '') : ''),
                            React.createElement("td", null,
                                React.createElement("button", { className: "schedule-action" }, dr ? 'Review' : 'Open')));
                    }),
                    !rows.length && React.createElement("tr", null,
                        React.createElement("td", { colSpan: 7, className: "empty-schedule" }, "No items.")))),
            open && React.createElement(ItemSpecEditor, { it: open, canEdit: canEdit, who: who, myEmail: myEmail, onClose: () => setOpen(null), onSaved: done }),
            conv && React.createElement(ConvertItemsDialog, { onClose: () => setConv(false), onDone: done, who: who }));
    }
    function LibraryAdminX({ onBack, canEdit, who }) {
        const [tab, setTab] = useState('sections');
        const [ver, setVer] = useState(0);
        const [edit, setEdit] = useState(null);
        const [f, setF] = useState('');
        const [stat, setStat] = useState('');
        const [rows, setRows] = useState({});
        const [msg, setMsg] = useState('');
        const [conv, setConv] = useState(false);
        const [myEmail, setMyEmail] = useState('');
        useEffect(() => { try {
            sb.auth.getSession().then(({ data }) => setMyEmail(((data && data.session && data.session.user.email) || '').toLowerCase()));
        }
        catch (e) { } }, []);
        const reload = useCallback(async () => {
            setMsg('');
            await loadLibrary();
            const res = {};
            for (const [k, c] of Object.entries(LIB_TABLES)) {
                const { data, error } = await sb.from(c.table).select('*').order('sort').range(0, 9999);
                if (error && !c.auto)
                    setMsg(c.table + ': ' + error.message);
                res[k] = data || [];
            }
            const { data: secs } = await sb.from('spec_sections').select('id,num,title,include_when,active,updated_at,updated_by').order('num');
            res.inactive = (secs || []).filter(s => s.active === false);
            setRows(res);
            setVer(x => x + 1);
        }, []);
        useEffect(() => { reload(); }, [reload]);
        const done = async () => { setEdit(null); setConv(false); await reload(); };
        const fl = s => !f || JSON.stringify(s).toLowerCase().includes(f.toLowerCase());
        const tabs = [['sections', 'Sections'], ['itemspecs', 'Item specifications'], ['relations', 'Related links'], ['standards', 'Standards'], ['secstd', 'Section standards'], ['blocks', 'Common text'], ['items', 'Items'], ['vendors', 'Manufacturers'], ['options', 'Project options'], ['locations', 'Locations']];
        const stChip = s => s === 'Verified' ? React.createElement(Chip, { k: "pass" }, "Verified") : s === 'TBC' ? React.createElement(Chip, { k: "blocked" }, "TBC") : React.createElement(Chip, { k: "draft" }, "Draft");
        const cfg = LIB_TABLES[tab];
        const list = cfg ? (rows[tab] || []).filter(fl).filter(r => !stat || r.status === stat) : [];
        const cell = (k, r) => {
            const x = r[k];
            if (k === 'status')
                return stChip(x);
            if (k === 'active')
                return x === false ? 'No' : 'Yes';
            if (k === 'include_when' || k === 'dep')
                return condLabel(x) || 'always';
            if (k === 'to_num') {
                const L = LIB.find(z => z.num === x);
                return React.createElement("span", null,
                    x,
                    React.createElement("div", { style: { fontSize: 9.5, color: '#86868b' } }, L ? titleCase(L.title) : (r.label || 'not in library')));
            }
            if (k === 'code' && tab === 'secstd')
                return React.createElement("span", null,
                    x,
                    !AU.std[x] && React.createElement("div", { style: { fontSize: 9.5, color: '#b91c1c' } }, "not in register"));
            if (k === 'body') {
                const t = String(x || '');
                return React.createElement("span", { style: { fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 10 } }, t.length > 160 ? t.slice(0, 160) + '…' : t);
            }
            if (x && typeof x === 'object')
                return Object.keys(x).length ? JSON.stringify(x) : '';
            return String(x !== null && x !== void 0 ? x : '');
        };
        const usedBy = key => LIB.filter(S => new RegExp('\\{\\{\\s*>\\s*' + key.replace(/[.\-]/g, '\\$&') + '\\s*\\}\\}').test(S.body)).length;
        return React.createElement("div", { className: "global-page", style: { minHeight: '100vh', background: '#f5f5f7' } },
            React.createElement("div", { className: "app-header" },
                React.createElement("div", { style: { maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: '#86868b', fontWeight: 800 } }, "MEP Specifications"),
                        React.createElement("div", { style: { fontSize: 19, fontWeight: 800, letterSpacing: '-.03em' } }, "Specification library")),
                    React.createElement("button", { onClick: onBack, style: { padding: '6px 12px', background: '#fff', color: '#424245', border: '1px solid #d2d2d7', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' } }, "\u2190 All projects"))),
            React.createElement("div", { style: { maxWidth: 1280, margin: '0 auto', padding: '18px 20px' } },
                !canEdit && React.createElement("div", { style: { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#9a3412', marginBottom: 12 } }, "You can view the library. Only Admin, Lead or Associate can change it; every change is kept in history."),
                (() => { const n = Object.keys(AU.itemDraft).length; return n && canEdit && tab !== 'itemspecs' ? React.createElement("div", { style: { background: '#fff4e0', border: '1px solid #f5c27a', borderRadius: 10, padding: '9px 14px', fontSize: 12, color: '#8a4b00', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' } },
                    React.createElement("span", { style: { flex: 1 } },
                        n,
                        " item specification draft",
                        n === 1 ? '' : 's',
                        " awaiting approval."),
                    React.createElement("button", { className: "schedule-action", onClick: () => setTab('itemspecs') }, "Review")) : null; })(),
                AU.missing && React.createElement("div", { style: { background: '#fff0ee', border: '1px solid #f5b5ae', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#b42318', marginBottom: 12 } }, AU.missing),
                msg && React.createElement("div", { className: "ai-msg bad", style: { marginBottom: 10 } }, msg),
                React.createElement("div", { className: "schedule-card" },
                    React.createElement("div", { className: "schedule-toolbar" },
                        React.createElement("div", { className: "density-switch", style: { flexWrap: 'wrap' } }, tabs.map(([k, l]) => React.createElement("button", { key: k, className: tab === k ? 'on' : '', onClick: () => { setTab(k); setStat(''); } }, l))),
                        React.createElement("input", { value: f, onChange: e => setF(e.target.value), placeholder: "Filter\u2026" }),
                        (tab === 'items' || tab === 'vendors') && React.createElement("select", { value: stat, onChange: e => setStat(e.target.value) },
                            React.createElement("option", { value: "" }, "All status"),
                            React.createElement("option", null, "Verified"),
                            React.createElement("option", null, "Draft"),
                            React.createElement("option", null, "TBC")),
                        React.createElement("span", { className: "toolbar-spacer" }),
                        canEdit && tab === 'sections' && AU.loaded && React.createElement("button", { className: "schedule-action", onClick: () => setConv(true), title: "Move typed Related Requirements, Reference Standards and repeated articles into library data" }, "\u2699 Convert typed lists to automatic"),
                        canEdit && tab === 'sections' && (() => {
                            const miss = [...new Set(LIB.filter(S => !isAnnexNum(S.num)).map(S => S.div))].filter(d => !LIB.find(x => x.num === `${d} 9998`));
                            return miss.length ? React.createElement("button", { className: "schedule-action", onClick: async () => {
                                    if (!window.confirm('Add Annexure B (spare parts) entries for Division ' + miss.join(', ') + ' to the library? You can edit the text afterwards.'))
                                        return;
                                    const { error } = await sb.from('spec_sections').upsert(miss.map(d => ({ num: `${d} 9998`, title: annexBTitle(d), division: d, include_when: null, body: ANNEX_B_BODY(d), sort: 99980 + (+d), active: true, updated_by: who })), { onConflict: 'num' });
                                    if (error)
                                        setMsg('Could not add: ' + error.message);
                                    else
                                        reload();
                                } },
                                "\uFF0B Annexure B entries (",
                                miss.join(', '),
                                ")") : null;
                        })(),
                        canEdit && tab !== 'itemspecs' && (tab === 'sections' || !(cfg && cfg.auto && !AU.loaded)) && React.createElement("button", { className: "schedule-action", onClick: () => setEdit(tab === 'sections' ? { sec: null } : { row: tab === 'items' ? { code: 'IT-' + String((rows.items || []).length + 1).padStart(4, '0'), status: 'Draft', active: true } : tab === 'vendors' ? { code: 'VN-' + String((rows.vendors || []).length + 1).padStart(3, '0'), status: 'Draft', active: true } : { active: true }, isNew: true }) }, "\uFF0B New")),
                    cfg && cfg.help && React.createElement("div", { style: { padding: '8px 12px', fontSize: 10.5, color: '#6e6e73', borderBottom: '1px solid #e8e8ed', background: '#fafafb' } }, cfg.help),
                    React.createElement("div", { className: "schedule-table-wrap", style: { maxHeight: 'calc(100vh - 250px)' } }, tab === 'sections' ? React.createElement("table", { className: "schedule-table", style: { minWidth: 900, tableLayout: 'auto' } },
                        React.createElement("thead", null,
                            React.createElement("tr", { className: "labels" },
                                React.createElement("th", null, "Section"),
                                React.createElement("th", null, "Title"),
                                React.createElement("th", null, "Class"),
                                React.createElement("th", null, "Included when"),
                                React.createElement("th", null, "Clauses"),
                                React.createElement("th", null, "Automatic"),
                                React.createElement("th", null, "Last change"),
                                React.createElement("th", null))),
                        React.createElement("tbody", null,
                            LIB.filter(S => !f || (S.num + ' ' + S.title).toLowerCase().includes(f.toLowerCase())).map(S => {
                                const cl = S.parts.reduce((a, P) => a + P.arts.reduce((b, A) => b + A.items.length, 0), 0);
                                const unk = condKeys(S.cond).filter(k => !OPTMAP[k]);
                                const auto = [/\{\{AUTO:ITEMS/.test(S.body) && 'Items', /\{\{AUTO:RELATED\}\}/.test(S.body) && 'Related', /\{\{AUTO:STANDARDS\}\}/.test(S.body) && 'Standards', /\{\{\s*>/.test(S.body) && 'Common text'].filter(Boolean);
                                return React.createElement("tr", { key: S.num, onClick: () => setEdit({ sec: S }) },
                                    React.createElement("td", { className: "tag-code" }, S.num),
                                    React.createElement("td", null, S.title),
                                    React.createElement("td", null,
                                        isAnnexNum(S.num) ? React.createElement(Chip, { k: "draft" }, "Annexure B") : S.cond ? React.createElement(Chip, { k: "review" }, "Project-specific") : React.createElement(Chip, { k: "pass" }, "General"),
                                        hardLocWords(S.body).length ? React.createElement("div", { style: { fontSize: 9, color: '#b42318', marginTop: 3 }, title: "Replace with {{CD}}, {{MUNI}}, {{WATER}}, {{FIRE_CODE}} etc. so the text follows the project location" },
                                            "Hard-coded location: ",
                                            hardLocWords(S.body).join(', ')) : null,
                                        hasLibMfrArticle(S) && !isAnnexNum(S.num) ? React.createElement("div", { style: { fontSize: 9, color: '#a76200', marginTop: 3 }, title: "2.1 MANUFACTURERS is generated automatically" }, "Own MANUFACTURERS article ignored") : null),
                                    React.createElement("td", { style: { fontSize: 10 } },
                                        condLabel(S.cond) || 'every project',
                                        unk.length ? React.createElement("div", { style: { color: '#d8332b' } },
                                            "unknown key: ",
                                            unk.join(', ')) : null),
                                    React.createElement("td", { className: "num" }, cl),
                                    React.createElement("td", { style: { fontSize: 10 } }, isAnnexNum(S.num) ? '' : auto.length ? React.createElement("span", { style: { color: '#16803a', fontWeight: 700 } }, auto.join(' · ')) : React.createElement("span", { style: { color: '#a76200' } }, "typed lists")),
                                    React.createElement("td", { style: { fontSize: 10 } }, S.updated ? fmtDay(S.updated) + ' ' + (S.by || '') : ''),
                                    React.createElement("td", null,
                                        React.createElement("button", { className: "schedule-action" }, canEdit ? 'Edit' : 'View')));
                            }),
                            (rows.inactive || []).length > 0 && React.createElement("tr", null,
                                React.createElement("td", { colSpan: 8, style: { background: '#f5f5f7', fontSize: 10, fontWeight: 800 } },
                                    "DEACTIVATED (",
                                    rows.inactive.length,
                                    ") \u2014 open and save to restore")),
                            (rows.inactive || []).map(r => React.createElement("tr", { key: 'x' + r.num, style: { opacity: .55 }, onClick: async () => { const { data } = await sb.from('spec_sections').select('*').eq('num', r.num).single(); setEdit({ sec: sectionFromRow(data) }); } },
                                React.createElement("td", { className: "tag-code" }, r.num),
                                React.createElement("td", null, r.title),
                                React.createElement("td", null,
                                    React.createElement(Chip, { k: "draft" }, "Inactive")),
                                React.createElement("td", { colSpan: 4 }),
                                React.createElement("td", null,
                                    React.createElement("button", { className: "schedule-action" }, "Open"))))))
                        : tab === 'itemspecs' ? React.createElement(ItemSpecsTab, { canEdit: canEdit, who: who, myEmail: myEmail, filter: f, onChanged: reload })
                            : cfg && cfg.auto && !AU.loaded ? React.createElement("div", { className: "empty-schedule" }, AU.missing || 'Automation tables not loaded.')
                                : React.createElement("table", { className: "schedule-table", style: { minWidth: 900, tableLayout: 'auto' } },
                                    React.createElement("thead", null,
                                        React.createElement("tr", { className: "labels" },
                                            cfg.fields.filter(x => !['sort', 'choices', 'default_value', 'data', 'source'].includes(x[0])).map(([k, l]) => React.createElement("th", { key: k }, l.replace(/\s*\(.*$/, '').replace(/\s*–.*$/, ''))),
                                            tab === 'blocks' && React.createElement("th", null, "Used in"),
                                            React.createElement("th", null))),
                                    React.createElement("tbody", null,
                                        list.map((r, i) => React.createElement("tr", { key: i, onClick: () => setEdit({ row: r, isNew: false }), style: { opacity: r.active === false ? .5 : 1 } },
                                            cfg.fields.filter(x => !['sort', 'choices', 'default_value', 'data', 'source'].includes(x[0])).map(([k]) => React.createElement("td", { key: k, style: { fontSize: 10.5, maxWidth: 320, whiteSpace: 'normal' } }, cell(k, r))),
                                            tab === 'blocks' && React.createElement("td", { className: "num" }, usedBy(r.key)),
                                            React.createElement("td", null,
                                                React.createElement("button", { className: "schedule-action" }, canEdit ? 'Edit' : 'View')))),
                                        !list.length && React.createElement("tr", null,
                                            React.createElement("td", { colSpan: 20, className: "empty-schedule" }, "No rows."))))),
                    React.createElement("div", { style: { padding: '8px 12px', fontSize: 10, color: '#86868b' } },
                        LIB.length,
                        " sections \u00B7 ",
                        (rows.relations || []).length,
                        " related links \u00B7 ",
                        (rows.standards || []).length,
                        " standards \u00B7 ",
                        (rows.blocks || []).length,
                        " common text blocks \u00B7 ",
                        Object.keys(AU.itemRev).length,
                        " item specifications \u00B7 ",
                        (rows.items || []).length,
                        " items \u00B7 ",
                        (rows.vendors || []).length,
                        " manufacturer rows \u00B7 ",
                        Object.keys(COUNTRIES).length,
                        " countries"))),
            edit && edit.sec !== undefined && React.createElement(SectionEditorX, { key: 's' + ver, S: edit.sec, onClose: () => setEdit(null), onSaved: done, canEdit: canEdit, who: who }),
            edit && edit.row && React.createElement(RowEditorX, { key: 'r' + ver, cfg: cfg, row: edit.row, isNew: edit.isNew, onClose: () => setEdit(null), onSaved: done, canEdit: canEdit, who: who }),
            conv && React.createElement(ConvertDialog, { onClose: () => setConv(false), onDone: done, who: who }));
    }
    // ── install ─────────────────────────────────────────────────────────────
    function install() {
        orig = { genSection, loadLibrary, LibraryAdmin };
        LIB_TABLES.relations = { table: 'spec_relations', key: 'from_num,to_num', fields: REL_FIELDS, title: 'Related link', auto: true, audit: true, canDelete: true,
            help: 'One row = "this section refers to that section". Related Requirements is built from these rows and lists only sections included in the project. Sections from other disciplines (not in the library) print with the title entered here when "list sections by other disciplines" is on.' };
        LIB_TABLES.standards = { table: 'spec_standards', key: 'code', fields: STD_FIELDS, title: 'Standard', auto: true, audit: true,
            help: 'Central standards register. Every section prints the same code, title and edition. Edition by country overrides the default edition for projects in that country.' };
        LIB_TABLES.secstd = { table: 'spec_section_standards', key: 'section_num,code', fields: SECSTD_FIELDS, title: 'Section standard', auto: true, audit: true, canDelete: true,
            help: 'Which standards each section cites. Reference Standards also adds any register standard named in the section\'s Items (product schedule).' };
        LIB_TABLES.blocks = { table: 'spec_blocks', key: 'key', fields: BLK_FIELDS, title: 'Common text', auto: true, audit: true,
            help: 'Text written once and used in many sections with a line {{>KEY}}. Change it here and every section that uses it updates.' };
        addBuiltin();
        genSection = function (S, o, T, annex) { try {
            return genSectionAuto(S, o, T, annex);
        }
        catch (e) {
            console.error('spec_auto: genSection', e);
            return orig.genSection(S, o, T, annex);
        } };
        loadLibrary = async function () { addBuiltin(); const ok = await orig.loadLibrary(); try {
            await loadAuto();
        }
        catch (e) {
            AU.missing = 'Automation data could not be loaded: ' + (e.message || e);
        } addBuiltin(); return ok; };
        LibraryAdmin = LibraryAdminX;
        AU.installed = true;
        if (LIB.length)
            loadAuto();
        console.info('spec_auto ' + AU.version + ' installed');
    }
    AU._test = { analyse, parseRel, parseStd, markXrefs, genSectionAuto, loadAuto, install };
    let tries = 0;
    const t = setInterval(() => {
        tries++;
        let ready = false;
        try {
            ready = typeof genSection === 'function' && typeof LibraryAdmin === 'function' && typeof loadLibrary === 'function' && typeof LIB_TABLES === 'object' && typeof BUILTIN_OPTS === 'object';
        }
        catch (e) {
            ready = false;
        }
        if (ready) {
            clearInterval(t);
            try {
                install();
            }
            catch (e) {
                console.error('spec_auto: install failed – page runs without automation', e);
            }
        }
        else if (tries > 3000)
            clearInterval(t);
    }, 10);
})();
