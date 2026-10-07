// spec_items_v2.js — Item Management v2 (add-on for spec.html v1.4.0)
// Categories, readable refs, owners, review dates, auto-classify, draft specifications for items without text.
// Install: upload next to spec.html and add one script line (src = spec_items_v2.js) at the end of the body.
// Needs: spec_item_management_v2.sql run once in Supabase. If anything fails the page keeps working as before.
(function () {
    'use strict';
    const { useState, useMemo, useCallback, useEffect } = React;
    const VERSION = '1.0';
    // ── classification rules ────────────────────────────────────────────────
    const CATS = {
        'Piping': { code: 'PIP', subs: ['Steel', 'Galvanised steel', 'HDPE', 'Ductile iron', 'GRE', 'PP-R / PP-RCT', 'PE-X', 'PVC-U', 'PP', 'Copper', 'Stainless steel', 'Gas', 'Drainage', 'Other'] },
        'Fittings': { code: 'FIT', subs: ['Threaded', 'Grooved', 'Flanged', 'Other'] },
        'Valves': { code: 'VAL', subs: ['Butterfly', 'Gate', 'Ball', 'Check', 'Pressure reducing', 'Strainer', 'Alarm / control', 'Deluge / pre-action', 'Landing', 'Other'] },
        'Pumps': { code: 'PMP', subs: ['Fire pump', 'Booster set', 'Transfer', 'Recirculation', 'Sump / sewage', 'Jockey', 'Controller', 'Other'] },
        'Tanks & Vessels': { code: 'TNK', subs: ['GRP', 'Polyethylene', 'Steel', 'LPG', 'Day tank', 'Other'] },
        'Water Heating': { code: 'WHT', subs: ['Electric heater', 'Boiler', 'Calorifier', 'Heat exchanger', 'Solar', 'Other'] },
        'Water Treatment': { code: 'WTR', subs: ['Softener', 'Filtration', 'UV', 'Chlorination', 'Other'] },
        'Insulation': { code: 'INS', subs: ['Elastomeric', 'Polyolefin', 'Mineral fibre', 'Acoustic', 'Other'] },
        'Fire Protection Equipment': { code: 'FPE', subs: ['Sprinkler', 'Hose cabinet', 'Fire department connection', 'Extinguisher', 'Flow / tamper switch', 'Foam', 'Clean agent', 'Other'] },
        'Drainage & Specialties': { code: 'DRN', subs: ['Floor / roof drain', 'Cleanout / manhole', 'Interceptor', 'Trap / trap primer', 'Backflow / hammer arrestor', 'Hose bibb', 'Air admittance valve', 'Other'] },
        'Supports & Accessories': { code: 'SUP', subs: ['Hangers', 'Escutcheon', 'Isolator / flexible connector', 'Expansion joint', 'Identification', 'Other'] },
        'Instruments': { code: 'GAU', subs: ['Pressure gauge', 'Thermometer', 'Meter', 'Other'] },
        'Gas Equipment': { code: 'GAS', subs: ['Detection', 'Regulator', 'Other'] },
        'Other': { code: 'OTH', subs: ['Other'] },
    };
    const T = (it) => [it.grp, it.item, it.material, it.jointing, it.application].filter(Boolean).join(' ').toLowerCase();
    const has = (t, re) => re.test(t);
    function classify(it) {
        const t = T(it), nm = String(it.item || '').toLowerCase(), mat = String(it.material || '').toLowerCase();
        const R = (c, s) => ({ category: c, subcategory: s });
        if (has(nm, /insulation|lagging/))
            return R('Insulation', has(t, /elastomeric/) ? 'Elastomeric' : has(t, /polyolefin/) ? 'Polyolefin' : has(t, /mineral|fibre/) ? 'Mineral fibre' : has(t, /acoustic|barrier/) ? 'Acoustic' : 'Other');
        if (has(nm, /gas detection/))
            return R('Gas Equipment', 'Detection');
        if (has(nm, /regulator/) && has(t, /gas|lpg/))
            return R('Gas Equipment', 'Regulator');
        if (has(nm, /^gas pipe|gas pipe/))
            return R('Piping', 'Gas');
        if (has(nm, /lpg tank/))
            return R('Tanks & Vessels', 'LPG');
        if (has(nm, /softener|filter|\buv\b|chlorination|carbon/))
            return R('Water Treatment', has(nm, /softener/) ? 'Softener' : has(nm, /filter|carbon/) ? 'Filtration' : has(nm, /uv/) ? 'UV' : 'Chlorination');
        if (has(nm, /pump|booster|controller/))
            return R('Pumps', has(nm, /controller/) ? 'Controller' : has(nm, /jockey/) ? 'Jockey' : has(nm, /booster/) ? 'Booster set' : has(nm, /transfer/) ? 'Transfer' : has(nm, /recirc/) ? 'Recirculation' : has(nm, /sump|sewage/) ? 'Sump / sewage' : has(t, /fire/) || has(t, /nfpa 20/) ? 'Fire pump' : 'Other');
        if (has(nm, /day tank/))
            return R('Tanks & Vessels', 'Day tank');
        if (has(nm, /tank/))
            return R('Tanks & Vessels', has(t, /grp/) ? 'GRP' : has(t, /polyethylene|\bpe\b/) ? 'Polyethylene' : has(t, /steel/) ? 'Steel' : 'Other');
        if (has(nm, /water heater|boiler|calorifier|heat exchanger|solar/))
            return R('Water Heating', has(nm, /boiler/) ? 'Boiler' : has(nm, /calorifier/) ? 'Calorifier' : has(nm, /exchanger/) ? 'Heat exchanger' : has(nm, /solar/) ? 'Solar' : 'Electric heater');
        if (has(nm, /gauge|thermometer|meter/))
            return R('Instruments', has(nm, /gauge/) ? 'Pressure gauge' : has(nm, /thermo/) ? 'Thermometer' : 'Meter');
        if (has(nm, /sprinkler|hose cabinet|fire department|extinguisher|flow switch|tamper switch|foam|clean agent|proportioner/))
            return R('Fire Protection Equipment', has(nm, /sprinkler/) ? 'Sprinkler' : has(nm, /hose cabinet/) ? 'Hose cabinet' : has(nm, /department/) ? 'Fire department connection' : has(nm, /extinguisher/) ? 'Extinguisher' : has(nm, /switch/) ? 'Flow / tamper switch' : has(nm, /foam|proportioner/) ? 'Foam' : 'Clean agent');
        if (has(nm, /drain|cleanout|manhole|interceptor|trap|air admittance|hose bibb|backflow|hammer/))
            return R('Drainage & Specialties', has(nm, /floor|roof|drain/) && !has(nm, /interceptor/) ? 'Floor / roof drain' : has(nm, /cleanout|manhole/) ? 'Cleanout / manhole' : has(nm, /interceptor/) ? 'Interceptor' : has(nm, /trap/) ? 'Trap / trap primer' : has(nm, /backflow|hammer/) ? 'Backflow / hammer arrestor' : has(nm, /bibb/) ? 'Hose bibb' : 'Air admittance valve');
        if (has(nm, /valve|strainer/))
            return R('Valves', has(nm, /butterfly/) ? 'Butterfly' : has(nm, /gate/) ? 'Gate' : has(nm, /ball/) ? 'Ball' : has(nm, /check/) ? 'Check' : has(nm, /pressure[- ]reducing|regulating|prv/) ? 'Pressure reducing' : has(nm, /strainer/) ? 'Strainer' : has(nm, /alarm|zone control/) ? 'Alarm / control' : has(nm, /deluge|pre-?action|dry-?pipe/) ? 'Deluge / pre-action' : has(nm, /landing/) ? 'Landing' : 'Other');
        if (has(nm, /hanger|support|escutcheon|isolator|flexible connector|expansion joint|marker|identification/))
            return R('Supports & Accessories', has(nm, /hanger|support/) ? 'Hangers' : has(nm, /escutcheon/) ? 'Escutcheon' : has(nm, /isolator|flexible/) ? 'Isolator / flexible connector' : has(nm, /expansion/) ? 'Expansion joint' : 'Identification');
        if (has(nm, /fitting/))
            return R('Fittings', has(t, /grooved/) ? 'Grooved' : has(t, /threaded/) ? 'Threaded' : has(t, /flange/) ? 'Flanged' : 'Other');
        if (has(nm, /pipe|piping|main/)) {
            const m = mat + ' ' + String(it.grp || '').toLowerCase();
            const s = has(m, /pp-rct|pp-r|ppr/) ? 'PP-R / PP-RCT' : has(m, /hdpe|pe100/) ? 'HDPE' : has(m, /ductile/) ? 'Ductile iron' : has(m, /\bgre\b/) ? 'GRE' : has(m, /pe-x|pex/) ? 'PE-X' : has(m, /pvc|upvc/) ? 'PVC-U' : has(m, /stainless/) ? 'Stainless steel' : has(m, /copper/) ? 'Copper' : has(m, /galvanised/) ? 'Galvanised steel' : has(m, /steel/) ? 'Steel' : has(m, /\bpp\b|polypropylene/) ? 'PP' : has(String(it.grp || '').toLowerCase(), /drainage/) ? 'Drainage' : 'Other';
            return R('Piping', s);
        }
        return R('Other', 'Other');
    }
    const divOf = n => String(n || '').replace(/\s/g, '').slice(0, 2);
    const today = () => new Date().toISOString().slice(0, 10);
    const byNum = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
    const items = () => (typeof actv === 'function' ? actv(ITEMS.items) : ITEMS.items);
    const hasCols = () => ITEMS.items.length && ('category' in ITEMS.items[0]);
    const AU = () => window.SPEC_AUTO || { itemRev: {}, itemDraft: {}, itemsLoaded: false, std: {} };
    const specState = it => AU().itemDraft[it.code] ? 'draft' : AU().itemRev[it.code] ? 'published' : 'none';
    // ── draft specification text from item data ─────────────────────────────
    function draftFromItem(it) {
        const L = [], add = (k, v) => { if (v && String(v).trim() && String(v).trim() !== '—')
            L.push(`- ${k}: ${String(v).trim().replace(/\.$/, '')}.`); };
        add('Material', it.material);
        add('Rating / class', it.rating);
        add('Jointing', it.jointing);
        add('Application', it.application);
        const reg = Object.keys(AU().std || {}).sort((a, b) => b.length - a.length), codes = [];
        String(it.standards || '').split(';').map(x => x.trim()).filter(Boolean).forEach(s => { const c = reg.find(k => s === k || s.startsWith(k + ' ')); if (c && !codes.includes(c))
            codes.push(c); });
        if (it.standards)
            L.push(`- Comply with ${String(it.standards).split(';').map(x => x.trim()).filter(Boolean).join('; ')}.`);
        return { part2: L.join('\n') + '\n', standards: codes.join('; ') || null, ok: L.length > 0 };
    }
    // ── UI ──────────────────────────────────────────────────────────────────
    const h = React.createElement;
    function ClassifyDialog({ onClose, onDone, who }) {
        const [rows, setRows] = useState(() => items().filter(i => !i.category).sort((a, b) => byNum(a.section_num, b.section_num) || (a.sort || 0) - (b.sort || 0)).map(i => ({ it: i, ...classify(i), on: true })));
        const [busy, setBusy] = useState(''), [err, setErr] = useState('');
        const sel = rows.filter(r => r.on);
        const apply = async () => {
            setErr('');
            try {
                for (let k = 0; k < sel.length; k++) {
                    setBusy(`Saving ${k + 1} of ${sel.length}…`);
                    const r = sel[k], { error } = await sb.from('spec_items').update({ category: r.category, subcategory: r.subcategory || null, updated_by: who }).eq('code', r.it.code);
                    if (error)
                        throw new Error(r.it.code + ': ' + error.message);
                }
                setBusy('');
                onDone();
            }
            catch (e) {
                setBusy('');
                setErr(e.message + ' — rows saved before this point are kept; reopen to continue.');
            }
        };
        const set = (k, patch) => setRows(rows.map((r, j) => j === k ? { ...r, ...patch } : r));
        return h(Modal, { title: 'Auto-classify items', onClose, wide: true }, h('div', { style: { fontSize: 12, lineHeight: 1.55, color: '#424245' } }, `Suggested Category and Subcategory for ${rows.length} items without one, from their names and materials. Change any suggestion, untick what you want to skip, then save. "Other" means no rule matched — please set it.`), h('div', { style: { fontSize: 11, margin: '8px 0' } }, h('b', null, sel.length), ` of ${rows.length} ticked · `, h('a', { href: '#', onClick: e => { e.preventDefault(); setRows(rows.map(r => ({ ...r, on: true }))); } }, 'tick all'), ' · ', h('a', { href: '#', onClick: e => { e.preventDefault(); setRows(rows.map(r => ({ ...r, on: r.category !== 'Other' }))); } }, 'untick "Other"')), h('div', { className: 'schedule-table-wrap', style: { maxHeight: '48vh', minHeight: 0, border: '1px solid #e1e1e6', borderRadius: 8 } }, h('table', { className: 'schedule-table', style: { minWidth: 0, tableLayout: 'auto' } }, h('thead', null, h('tr', { className: 'labels' }, ['', 'Section', 'Item', 'Category', 'Subcategory'].map((x, i) => h('th', { key: i }, x)))), h('tbody', null, rows.map((r, k) => h('tr', { key: r.it.code, style: { opacity: r.on ? 1 : .45 } }, h('td', null, h('input', { type: 'checkbox', checked: r.on, onChange: e => set(k, { on: e.target.checked }) })), h('td', { className: 'tag-code' }, r.it.section_num), h('td', null, r.it.item, r.it.material && r.it.material !== r.it.item ? h('div', { style: { fontSize: 9.5, color: '#86868b' } }, r.it.material) : null), h('td', null, h('select', { value: r.category, onChange: e => set(k, { category: e.target.value, subcategory: (CATS[e.target.value].subs.includes(r.subcategory) ? r.subcategory : 'Other') }), style: { padding: '3px 6px', fontSize: 11 } }, Object.keys(CATS).map(c => h('option', { key: c }, c)))), h('td', null, h('select', { value: r.subcategory || 'Other', onChange: e => set(k, { subcategory: e.target.value }), style: { padding: '3px 6px', fontSize: 11 } }, (CATS[r.category] || CATS.Other).subs.map(s => h('option', { key: s }, s))))))))), err && h('div', { className: 'ai-msg bad', style: { marginTop: 8 } }, err), h('div', { className: 'ai-row', style: { marginTop: 12 } }, h('span', { style: { flex: 1 } }), busy && h('span', { className: 'ai-note' }, busy), h('button', { onClick: onClose }, 'Cancel'), h('button', { className: 'pri', disabled: !!busy || !sel.length, onClick: apply }, `Save ${sel.length} classifications`)));
    }
    function RefsDialog({ onClose, onDone, who }) {
        const plan = useMemo(() => {
            const all = items(), used = {}, out = [];
            all.forEach(i => { const m = String(i.ref || '').match(/^(\d{2})-([A-Z]{3})-(\d{3})$/); if (m) {
                const k = m[1] + '-' + m[2];
                used[k] = Math.max(used[k] || 0, +m[3]);
            } });
            all.filter(i => !i.ref && i.category).sort((a, b) => byNum(a.section_num, b.section_num) || (a.sort || 0) - (b.sort || 0)).forEach(i => {
                const k = divOf(i.section_num) + '-' + ((CATS[i.category] || CATS.Other).code);
                used[k] = (used[k] || 0) + 1;
                out.push({ it: i, ref: k + '-' + String(used[k]).padStart(3, '0') });
            });
            return out;
        }, []);
        const skipped = items().filter(i => !i.ref && !i.category).length;
        const [busy, setBusy] = useState(''), [err, setErr] = useState('');
        const apply = async () => {
            try {
                for (let k = 0; k < plan.length; k++) {
                    setBusy(`Saving ${k + 1} of ${plan.length}…`);
                    const { error } = await sb.from('spec_items').update({ ref: plan[k].ref, updated_by: who }).eq('code', plan[k].it.code);
                    if (error)
                        throw new Error(plan[k].it.code + ': ' + error.message);
                }
                setBusy('');
                onDone();
            }
            catch (e) {
                setBusy('');
                setErr(e.message);
            }
        };
        return h(Modal, { title: 'Generate readable item refs', onClose, wide: true }, h('div', { style: { fontSize: 12, lineHeight: 1.55, color: '#424245' } }, 'Refs follow Division – Category – Number, e.g. ', h('b', null, '22-VAL-001'), '. The internal code (IT-0105) stays as the key, so revisions, drafts and history are not affected. Existing refs are kept; numbering continues after the highest one.'), skipped > 0 && h('div', { className: 'ai-msg bad', style: { marginTop: 6 } }, `${skipped} item(s) have no Category yet and are skipped — run Auto-classify first.`), h('div', { className: 'schedule-table-wrap', style: { maxHeight: '44vh', minHeight: 0, border: '1px solid #e1e1e6', borderRadius: 8, marginTop: 8 } }, h('table', { className: 'schedule-table', style: { minWidth: 0, tableLayout: 'auto' } }, h('thead', null, h('tr', { className: 'labels' }, ['New ref', 'Code', 'Section', 'Item', 'Category'].map((x, i) => h('th', { key: i }, x)))), h('tbody', null, plan.map(p => h('tr', { key: p.it.code }, h('td', { className: 'tag-code' }, p.ref), h('td', { className: 'tag-code' }, p.it.code), h('td', { className: 'tag-code' }, p.it.section_num), h('td', null, p.it.item), h('td', null, p.it.category, p.it.subcategory ? ' › ' + p.it.subcategory : '')))))), err && h('div', { className: 'ai-msg bad', style: { marginTop: 8 } }, err), h('div', { className: 'ai-row', style: { marginTop: 12 } }, h('span', { style: { flex: 1 } }), busy && h('span', { className: 'ai-note' }, busy), h('button', { onClick: onClose }, 'Cancel'), h('button', { className: 'pri', disabled: !!busy || !plan.length, onClick: apply }, `Create ${plan.length} refs`)));
    }
    function DraftsDialog({ onClose, onDone, who }) {
        const list = useMemo(() => items().filter(i => specState(i) === 'none').sort((a, b) => byNum(a.section_num, b.section_num) || (a.sort || 0) - (b.sort || 0)).map(i => ({ it: i, d: draftFromItem(i) })), []);
        const ready = list.filter(x => x.d.ok), empty = list.length - ready.length;
        const [busy, setBusy] = useState(''), [err, setErr] = useState('');
        const apply = async () => {
            setErr('');
            try {
                for (let k = 0; k < ready.length; k += 40) {
                    setBusy(`Creating drafts ${Math.min(k + 40, ready.length)} of ${ready.length}…`);
                    const rows = ready.slice(k, k + 40).map(x => ({ item_code: x.it.code, part2: x.d.part2, part3: '', standards: x.d.standards, reason: 'Generated from the item data (material, rating, jointing, standards) — review and edit before approval', created_by: who }));
                    const { error } = await sb.from('spec_item_revs').insert(rows);
                    if (error)
                        throw new Error(error.message);
                }
                setBusy('');
                onDone();
            }
            catch (e) {
                setBusy('');
                setErr(e.message + ' — drafts created before this point are kept; reopen to continue.');
            }
        };
        return h(Modal, { title: 'Create draft specifications', onClose, wide: true }, h('div', { style: { fontSize: 12, lineHeight: 1.55, color: '#424245' } }, `${list.length} items have no specification text. This creates one ${''}`, h('b', null, 'draft'), ' for each from its existing data: material, rating, jointing, application and standards. Nothing is published: a Lead / Associate (not you) reviews, edits and approves each draft under Library › Item specifications. Most will need editing — they are a starting point, not finished clauses.'), empty > 0 && h('div', { className: 'ai-msg bad', style: { marginTop: 6 } }, `${empty} item(s) have no data to build a draft from and are skipped (write their text in Item specifications).`), h('div', { className: 'schedule-table-wrap', style: { maxHeight: '42vh', minHeight: 0, border: '1px solid #e1e1e6', borderRadius: 8, marginTop: 8 } }, h('table', { className: 'schedule-table', style: { minWidth: 0, tableLayout: 'auto' } }, h('thead', null, h('tr', { className: 'labels' }, ['Section', 'Item', 'Draft Part 2 (preview)'].map((x, i) => h('th', { key: i }, x)))), h('tbody', null, ready.map(x => h('tr', { key: x.it.code }, h('td', { className: 'tag-code' }, x.it.section_num), h('td', null, x.it.item), h('td', { style: { fontSize: 10, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' } }, x.d.part2)))))), err && h('div', { className: 'ai-msg bad', style: { marginTop: 8 } }, err), h('div', { className: 'ai-row', style: { marginTop: 12 } }, h('span', { style: { flex: 1 } }), busy && h('span', { className: 'ai-note' }, busy), h('button', { onClick: onClose }, 'Cancel'), h('button', { className: 'pri', disabled: !!busy || !ready.length, onClick: apply }, `Create ${ready.length} drafts`)));
    }
    function ItemManager({ onBack, onLibrary, canEdit, who }) {
        const [ver, setVer] = useState(0), [msg, setMsg] = useState(''), [dlg, setDlg] = useState(null);
        const [q, setQ] = useState(''), [div, setDiv] = useState(''), [cat, setCat] = useState(''), [st, setSt] = useState(''), [rv, setRv] = useState('');
        const bump = () => setVer(x => x + 1);
        const reload = async () => { try {
            await loadLibrary();
        }
        catch (e) { } setDlg(null); bump(); };
        const all = items(), cols = hasCols(), A = AU(), td = today();
        const overdue = it => it.review_due && String(it.review_due).slice(0, 10) < td;
        const rows = all.filter(it => (!div || divOf(it.section_num) === div) && (!cat || (cat === '(none)' ? !it.category : it.category === cat)) && (!st || specState(it) === st) && (!rv || (rv === 'overdue' ? overdue(it) : !it.review_due))
            && (!q || [it.code, it.ref, it.item, it.material, it.category, it.subcategory, it.section_num, it.standards].join(' ').toLowerCase().includes(q.toLowerCase()))).sort((a, b) => byNum(a.section_num, b.section_num) || (a.sort || 0) - (b.sort || 0));
        const divs = [...new Set(all.map(i => divOf(i.section_num)))].sort();
        const stats = { total: all.length, cat: all.filter(i => i.category).length, ref: all.filter(i => i.ref).length, spec: all.filter(i => specState(i) !== 'none').length, draft: all.filter(i => specState(i) === 'draft').length, over: all.filter(overdue).length, none: all.filter(i => specState(i) === 'none').length };
        const save = async (it, patch) => {
            setMsg('');
            const { error } = await sb.from('spec_items').update({ ...patch, updated_by: who }).eq('code', it.code);
            if (error) {
                setMsg(it.code + ': ' + (/column|schema/i.test(error.message) ? 'database columns missing — run spec_item_management_v2.sql in Supabase.' : error.message));
                return false;
            }
            Object.assign(it, patch);
            bump();
            return true;
        };
        const bulkDue = async () => {
            const d = window.prompt(`Set the next review date for the ${rows.filter(i => !i.review_due).length} listed items that have none (YYYY-MM-DD):`, new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10));
            if (!d)
                return;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
                return setMsg('Use the format YYYY-MM-DD.');
            for (const it of rows.filter(i => !i.review_due)) {
                if (!(await save(it, { review_due: d })))
                    break;
            }
        };
        const exportCsv = () => {
            const F = ['ref', 'code', 'section_num', 'category', 'subcategory', 'item', 'material', 'owner', 'review_due', 'standards'];
            const csv = [F.join(',')].concat(rows.map(r => F.map(k => { var _a; return '"' + String((_a = r[k]) !== null && _a !== void 0 ? _a : '').replace(/"/g, '""') + '"'; }).join(','))).join('\n');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
            a.download = 'spec_items.csv';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        };
        const inp1 = { padding: '3px 6px', fontSize: 11, border: '1px solid #d2d2d7', borderRadius: 6, width: '100%', background: '#fff' };
        const card = (l, v, n, k) => h('div', { className: 'health-card ' + (k || 'capacity'), style: { cursor: 'default' } }, h('div', { className: 'h-label' }, l), h('div', { className: 'h-value' }, v), h('div', { className: 'h-note' }, n));
        return h('div', { className: 'global-page', style: { minHeight: '100vh', background: '#f5f5f7' } }, h('div', { className: 'app-header' }, h('div', { style: { maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 } }, h('div', null, h('div', { style: { fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: '#86868b', fontWeight: 800 } }, 'MEP Specifications'), h('div', { style: { fontSize: 19, fontWeight: 800, letterSpacing: '-.03em' } }, 'Item management')), h('div', { style: { display: 'flex', gap: 8 } }, h('button', { onClick: onLibrary, style: { padding: '6px 12px', background: '#fff', color: '#424245', border: '1px solid #d2d2d7', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' } }, '📚 Library'), h('button', { onClick: onBack, style: { padding: '6px 12px', background: '#fff', color: '#424245', border: '1px solid #d2d2d7', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' } }, '← All projects')))), h('div', { style: { maxWidth: 1400, margin: '0 auto', padding: '16px 20px' } }, !cols && h('div', { className: 'ai-msg bad', style: { marginBottom: 10 } }, 'The new item columns are not in the database yet. Run spec_item_management_v2.sql in Supabase › SQL Editor, then reload this page.'), msg && h('div', { className: 'ai-msg bad', style: { marginBottom: 10 } }, msg), h('div', { className: 'schedule-health', style: { marginBottom: 10 } }, card('Items', stats.total, `${stats.cat} categorised · ${stats.ref} with ref`), card('Have a specification', stats.spec, `${stats.none} still schedule-line only`, stats.none ? 'review' : 'pass'), card('Drafts awaiting approval', stats.draft, 'Library › Item specifications', stats.draft ? 'review' : 'pass'), card('Review overdue', stats.over, 'past their review date', stats.over ? 'blocked' : 'pass'), card('No category', stats.total - stats.cat, 'needed for refs and vendor lists', stats.total - stats.cat ? 'blocked' : 'pass')), h('div', { className: 'schedule-card' }, h('div', { className: 'schedule-toolbar' }, h('input', { value: q, onChange: e => setQ(e.target.value), placeholder: 'Search ref, name, material, standard…' }), h('select', { value: div, onChange: e => setDiv(e.target.value) }, h('option', { value: '' }, 'All divisions'), divs.map(d => h('option', { key: d, value: d }, 'Division ' + d + (typeof DIVNAMES !== 'undefined' && DIVNAMES[d] ? ' – ' + DIVNAMES[d] : '')))), h('select', { value: cat, onChange: e => setCat(e.target.value) }, h('option', { value: '' }, 'All categories'), h('option', { value: '(none)' }, '(no category)'), Object.keys(CATS).map(c => h('option', { key: c }, c))), h('select', { value: st, onChange: e => setSt(e.target.value) }, h('option', { value: '' }, 'Any specification'), h('option', { value: 'published' }, 'Published'), h('option', { value: 'draft' }, 'Draft awaiting approval'), h('option', { value: 'none' }, 'No specification text')), h('select', { value: rv, onChange: e => setRv(e.target.value) }, h('option', { value: '' }, 'Any review date'), h('option', { value: 'overdue' }, 'Overdue'), h('option', { value: 'none' }, 'No review date')), h('span', { className: 'toolbar-spacer' }), canEdit && cols && h('button', { className: 'schedule-action', onClick: () => setDlg('classify'), title: 'Suggest Category / Subcategory for items without one' }, '⚙ Auto-classify'), canEdit && cols && h('button', { className: 'schedule-action', onClick: () => setDlg('refs') }, '＃ Generate refs'), canEdit && A.itemsLoaded && h('button', { className: 'schedule-action', onClick: () => setDlg('drafts') }, `✎ Draft specifications (${stats.none})`), canEdit && cols && h('button', { className: 'schedule-action', onClick: bulkDue }, '📅 Set review date'), h('button', { className: 'schedule-action', onClick: exportCsv }, '↧ CSV')), h('div', { className: 'schedule-table-wrap', style: { maxHeight: 'calc(100vh - 330px)' } }, h('table', { className: 'schedule-table', style: { minWidth: 1250, tableLayout: 'auto' } }, h('thead', null, h('tr', { className: 'labels' }, ['Ref', 'Code', 'Section', 'Item', 'Category', 'Subcategory', 'Owner', 'Review due', 'Specification', 'Standards'].map((x, i) => h('th', { key: i }, x)))), h('tbody', null, rows.map(it => {
            const s = specState(it), cur = A.itemRev[it.code], dr = A.itemDraft[it.code], ro = !canEdit || !cols;
            const subs = (CATS[it.category] || { subs: [] }).subs;
            return h('tr', { key: it.code, style: { cursor: 'default' } }, h('td', { style: { minWidth: 96 } }, h('input', { defaultValue: it.ref || '', key: it.code + ':' + (it.ref || ''), disabled: ro, placeholder: '—', style: { ...inp1, fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontWeight: 700 }, onBlur: e => { const el = e.target, v = el.value.trim().toUpperCase() || null; if (v !== (it.ref || null))
                    save(it, { ref: v }).then(ok => { if (!ok)
                        el.value = it.ref || ''; }); } })), h('td', { className: 'tag-code' }, it.code), h('td', { className: 'tag-code' }, it.section_num), h('td', { style: { minWidth: 200 } }, it.item, it.material && it.material !== it.item ? h('div', { style: { fontSize: 9.5, color: '#86868b' } }, it.material) : null), h('td', { style: { minWidth: 150 } }, h('select', { value: it.category || '', disabled: ro, style: inp1, onChange: e => save(it, { category: e.target.value || null, subcategory: null }) }, h('option', { value: '' }, '—'), Object.keys(CATS).map(c => h('option', { key: c }, c)))), h('td', { style: { minWidth: 150 } }, h('select', { value: it.subcategory || '', disabled: ro || !it.category, style: inp1, onChange: e => save(it, { subcategory: e.target.value || null }) }, h('option', { value: '' }, '—'), subs.map(x => h('option', { key: x }, x)), it.subcategory && !subs.includes(it.subcategory) ? h('option', { key: 'c' }, it.subcategory) : null)), h('td', { style: { width: 70 } }, h('input', { defaultValue: it.owner || '', key: it.code + ':o' + (it.owner || ''), disabled: ro, placeholder: '—', style: inp1, onBlur: e => { const v = e.target.value.trim().toUpperCase() || null; if (v !== (it.owner || null))
                    save(it, { owner: v }); } })), h('td', { style: { width: 128 } }, h('input', { type: 'date', defaultValue: it.review_due ? String(it.review_due).slice(0, 10) : '', key: it.code + ':d' + (it.review_due || ''), disabled: ro, style: { ...inp1, ...(overdue(it) ? { borderColor: '#ff3b30', background: '#fff6f5' } : {}) }, onBlur: e => { const v = e.target.value || null; if (v !== (it.review_due ? String(it.review_due).slice(0, 10) : null))
                    save(it, { review_due: v }); } }), overdue(it) && h('div', { style: { fontSize: 9, color: '#d8332b', fontWeight: 700, marginTop: 2 } }, 'review overdue')), h('td', null, cur ? h(Chip, { k: 'pass' }, 'Rev ' + cur.rev) : h(Chip, { k: 'draft' }, 'schedule line only'), ' ', dr ? h(Chip, { k: 'review' }, 'Draft rev ' + dr.rev) : null), h('td', { style: { fontSize: 10, maxWidth: 220 } }, (cur && cur.standards) || it.standards || ''));
        }), !rows.length && h('tr', null, h('td', { colSpan: 10, className: 'empty-schedule' }, 'No items match.'))))), h('div', { style: { padding: '8px 12px', fontSize: 10, color: '#86868b' } }, `${rows.length} of ${all.length} items shown · edits save as you leave each field and are kept in the item history`)), h('div', { style: { fontSize: 10.5, color: '#86868b', marginTop: 8 } }, 'Approving the draft specifications is done under Library › Item specifications (a Lead / Associate other than the author).')), dlg === 'classify' && h(ClassifyDialog, { onClose: () => setDlg(null), onDone: reload, who }), dlg === 'refs' && h(RefsDialog, { onClose: () => setDlg(null), onDone: reload, who }), dlg === 'drafts' && h(DraftsDialog, { onClose: () => setDlg(null), onDone: reload, who }));
    }
    // ── install: wrap the existing Library screen with a switch ─────────────
    function install() {
        const Orig = LibraryAdmin;
        function LibraryWithItems(props) {
            const [mode, setMode] = useState('lib');
            if (mode === 'items')
                return h(ItemManager, { ...props, onLibrary: () => setMode('lib') });
            return h('div', null, h('div', { style: { position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 60 } }, h('button', { onClick: () => setMode('items'), style: { padding: '6px 14px', background: '#007aff', color: '#fff', border: 0, borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,122,255,.35)' } }, '▦ Item management')), h(Orig, props));
        }
        LibraryAdmin = LibraryWithItems;
        window.SPEC_ITEMS_V2 = { ItemManager, version: VERSION, classify, draftFromItem, CATS };
        console.info('spec_items_v2 ' + VERSION + ' installed');
    }
    let tries = 0;
    const t = setInterval(() => {
        tries++;
        let ok = false;
        try {
            ok = typeof LibraryAdmin === 'function' && typeof Modal === 'function' && typeof loadLibrary === 'function' && typeof ITEMS === 'object' && window.SPEC_AUTO && window.SPEC_AUTO.installed;
        }
        catch (e) {
            ok = false;
        }
        if (ok) {
            clearInterval(t);
            try {
                install();
            }
            catch (e) {
                console.error('spec_items_v2: install failed – page runs without it', e);
            }
        }
        else if (tries > 3000)
            clearInterval(t);
    }, 10);
})();
