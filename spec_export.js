/* spec_export.js — MEP Specifications: full library export to Excel (v1.0)
   Adds an "Export to Excel" button to the Library screens. It reads every library table directly
   from Supabase and builds one .xlsx workbook in the browser (no data leaves your computer).
   Needs nothing in the database. If anything fails the page works exactly as before. */
(function () {
  'use strict';
  const VERSION = '1.0';
  const MAXCELL = 32000;
  let truncated = 0;

  // ── helpers ─────────────────────────────────────────────────────────────
  const G = name => { try { return (0, eval)(name); } catch (e) { return undefined; } };   // read a page global safely
  const byNum = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, {numeric:true});
  const divOf = n => String(n || '').replace(/\s/g, '').slice(0, 2);
  const nice = n => String(n || '').replace(/^(\d{2})\s?(\d{2})(\d{2})/, '$1 $2 $3');
  const day = d => d ? String(d).slice(0, 10) : '';
  const stamp = d => d ? String(d).replace('T', ' ').slice(0, 16) : '';
  const cl = c => { if (!c) return ''; try { const f = G('condLabel'); return typeof f === 'function' ? f(c) : String(c); } catch (e) { return String(c); } };
  const lbl = (l, n) => l === 0 ? String.fromCharCode(65 + (n % 26)) + '.' : l === 1 ? (n + 1) + '.' : l === 2 ? String.fromCharCode(97 + (n % 26)) + '.' : (n + 1) + ')';
  const clean = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
  const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colName = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const cap = s => { s = clean(s); if (s.length > MAXCELL) { truncated++; return s.slice(0, MAXCELL) + ' … [truncated at ' + MAXCELL + ' characters]'; } return s; };
  const fields = t => [...new Set([...String(t || '').matchAll(/\{\{\s*([A-Za-z0-9_.>:]+)\s*\}\}/g)].map(m => m[1]))];
  const kind = t => { const s = String(t || ''); return /\{\{\s*AUTO:RELATED/.test(s) ? 'Automatic: related sections' : /\{\{\s*AUTO:STANDARDS/.test(s) ? 'Automatic: reference standards' : /\{\{\s*AUTO:ITEMS/.test(s) ? 'Automatic: item specifications' : /\{\{\s*>/.test(s) ? 'Common text' : 'Text'; };
  const list = a => (a || []).filter(x => x && x.active !== false);

  async function fetchTable(name) {
    try {
      const r = await sb.from(name).select('*').range(0, 19999);
      if (r.error) return {rows:[], error:r.error.message};
      return {rows:r.data || [], error:null};
    } catch (e) { return {rows:[], error:String((e && e.message) || e)}; }
  }

  // library markup → structure
  function parseBody(body) {
    const parts = []; let P = null, A = null;
    String(body || '').split('\n').forEach(raw => {
      if (!raw.trim()) return;
      const ind = raw.match(/^ */)[0].length; let s = raw.trim(), cond = '';
      const m = s.match(/^\[if:([^\]]+)\]\s*/); if (m) { cond = m[1]; s = s.slice(m[0].length); }
      if (s.startsWith('# ')) { P = {title:s.slice(2).trim(), cond, arts:[]}; parts.push(P); A = null; return; }
      if (s.startsWith('= ')) { if (!P) { P = {title:'(no part)', cond:'', arts:[]}; parts.push(P); } A = {title:s.slice(2).trim(), cond, clauses:[]}; P.arts.push(A); return; }
      if (s.startsWith('- ')) {
        if (!A) { if (!P) { P = {title:'(no part)', cond:'', arts:[]}; parts.push(P); } A = {title:'(no article)', cond:'', clauses:[]}; P.arts.push(A); }
        A.clauses.push({lvl:Math.floor(ind / 2), text:s.slice(2), cond});
      }
    });
    parts.forEach((P, pi) => { P.no = pi + 1; P.arts.forEach((A, ai) => { A.no = (pi + 1) + '.' + (ai + 1); const c = [0, 0, 0, 0]; A.clauses.forEach(k => { const l = Math.min(k.lvl, 3); k.lbl = lbl(l, c[l]++); for (let j = l + 1; j < 4; j++) c[j] = 0; }); }); });
    return parts;
  }
  function renderClauses(text) {            // item specification text → readable lines
    const c = [0, 0, 0, 0], out = [];
    String(text || '').split('\n').forEach(raw => {
      if (!raw.trim()) return;
      const ind = raw.match(/^ */)[0].length; let s = raw.trim(), cond = '';
      const m = s.match(/^\[if:([^\]]+)\]\s*/); if (m) { cond = m[1]; s = s.slice(m[0].length); }
      if (!s.startsWith('- ')) { out.push(s); return; }
      const l = Math.min(Math.floor(ind / 2), 3); const n = c[l]++; for (let j = l + 1; j < 4; j++) c[j] = 0;
      out.push('  '.repeat(l) + lbl(l, n) + ' ' + (cond ? '[when ' + cl(cond) + '] ' : '') + s.slice(2));
    });
    return out.join('\n');
  }
  const nClauses = t => String(t || '').split('\n').filter(l => /^\s*(\[if:[^\]]+\]\s*)?- /.test(l)).length;

  // ── xlsx writer (zip of XML) ────────────────────────────────────────────
  function cellXml(ref, c) {
    let v = c, s = 0;
    if (c && typeof c === 'object' && 'v' in c) { v = c.v; s = c.s || 0; }
    if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${s}"/>`;
    if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
    if (typeof v === 'boolean') v = v ? 'Yes' : 'No';
    return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xe(cap(v))}</t></is></c>`;
  }
  function sheetXml(sh, selected) {
    const hasH = !!sh.headers, rows = sh.rows || [];
    const n = Math.max(hasH ? sh.headers.length : 0, (sh.widths || []).length, ...rows.map(r => r.length), 1);
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    const total = (hasH ? 1 : 0) + rows.length;
    x += `<dimension ref="A1:${colName(n - 1)}${Math.max(total, 1)}"/>`;
    x += `<sheetViews><sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ''}${sh.noGrid ? ' showGridLines="0"' : ''}>`;
    if (sh.freeze && hasH) x += `<pane xSplit="${sh.freezeCols || 0}" ySplit="1" topLeftCell="${colName(sh.freezeCols || 0)}2" activePane="${sh.freezeCols ? 'bottomRight' : 'bottomLeft'}" state="frozen"/>`;
    x += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="13"/>';
    x += '<cols>' + Array.from({length:n}, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${(sh.widths && sh.widths[i]) || 16}" customWidth="1"/>`).join('') + '</cols><sheetData>';
    let r = 1;
    if (hasH) { x += `<row r="1" ht="30" customHeight="1">` + sh.headers.map((h, i) => cellXml(colName(i) + 1, {v:h, s:1})).join('') + '</row>'; r = 2; }
    rows.forEach(row => { x += `<row r="${r}">` + row.map((c, i) => cellXml(colName(i) + r, c)).join('') + '</row>'; r++; });
    x += '</sheetData>';
    if (hasH && sh.filter !== false && rows.length) x += `<autoFilter ref="A1:${colName(n - 1)}${total}"/>`;
    return x + '</worksheet>';
  }
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="5"><font><sz val="9"/><name val="Arial"/></font><font><b/><sz val="9"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FF1E3A5F"/><name val="Arial"/></font><font><i/><sz val="9"/><color rgb="FF6E6E73"/><name val="Arial"/></font><font><b/><sz val="9"/><name val="Arial"/></font></fonts>' +
    '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF2F7"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD2D2D7"/></left><right style="thin"><color rgb="FFD2D2D7"/></right><top style="thin"><color rgb="FFD2D2D7"/></top><bottom style="thin"><color rgb="FFD2D2D7"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="7">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  async function loadZip() {
    if (window.JSZip) return window.JSZip;
    await new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      s.onload = res; s.onerror = () => rej(new Error('The Excel helper (JSZip) could not be loaded. Check the internet connection and try again.'));
      document.head.appendChild(s);
    });
    return window.JSZip;
  }
  const safeName = (s, used) => { let n = String(s).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31).trim() || 'Sheet'; let k = n, i = 2; while (used.has(k.toLowerCase())) k = n.slice(0, 28) + ' ' + (i++); used.add(k.toLowerCase()); return k; };
  async function writeXlsx(sheets) {
    const JSZip = await loadZip(), zip = new JSZip(), used = new Set();
    const names = sheets.map(s => safeName(s.name, used));
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => `<sheet name="${xe(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file('xl/styles.xml', STYLES);
    sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s, i === 0)));
    return zip.generateAsync({type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression:'DEFLATE'});
  }

  // ── build the workbook ──────────────────────────────────────────────────
  async function build(who) {
    truncated = 0;
    const T = {};
    const names = ['spec_sections', 'spec_items', 'spec_item_revs', 'spec_vendors', 'spec_options', 'spec_locations', 'spec_relations', 'spec_standards', 'spec_section_standards', 'spec_blocks'];
    const got = await Promise.all(names.map(fetchTable));
    names.forEach((n, i) => { T[n] = got[i]; });
    if (T.spec_sections.error && T.spec_items.error) throw new Error('The library could not be read: ' + T.spec_sections.error);
    const missing = names.filter(n => T[n].error).map(n => n + ' (' + T[n].error + ')');

    const secs = T.spec_sections.rows.slice().sort((a, b) => byNum(a.num, b.num));
    const secBy = {}; secs.forEach(s => { secBy[s.num] = s; });
    const sTitle = n => (secBy[n] ? secBy[n].title : '');
    const items = T.spec_items.rows.slice().sort((a, b) => byNum(a.section_num, b.section_num) || (a.sort || 0) - (b.sort || 0) || byNum(a.code, b.code));
    const revs = T.spec_item_revs.rows.slice().sort((a, b) => byNum(a.item_code, b.item_code) || a.rev - b.rev);
    const live = {}, draft = {}; revs.forEach(r => { if (r.status === 'approved') live[r.item_code] = r; if (r.status === 'draft') draft[r.item_code] = r; });
    const itemBy = {}; items.forEach(i => { itemBy[i.code] = i; });
    const stds = T.spec_standards.rows.slice().sort((a, b) => byNum(a.code, b.code));
    const stdBy = {}; stds.forEach(s => { stdBy[s.code] = s; });
    const td = new Date().toISOString().slice(0, 10);
    const sheets = [];
    const S = {};   // sheet registry for the summary

    // Items
    {
      const rows = items.map(i => {
        const lv = live[i.code], dr = draft[i.code];
        return [i.ref, i.code, divOf(i.section_num), nice(i.section_num), sTitle(i.section_num), i.category, i.subcategory, i.grp, i.item, i.material, i.rating, i.jointing, i.standards, i.application,
          cl(i.include_when), i.include_when, i.status, i.source, i.owner, day(i.review_due), i.review_due && day(i.review_due) < td ? 'OVERDUE' : '',
          lv ? 'Published' : dr ? 'Draft only' : 'Schedule line only', lv ? lv.rev : '', lv ? lv.approved_by : '', lv ? day(lv.approved_at) : '', lv ? lv.reason : '',
          lv ? lv.standards : '', lv ? nClauses(lv.part2) : '', lv ? nClauses(lv.part3) : '', dr ? 'Draft rev ' + dr.rev : '', i.active === false ? 'No' : 'Yes', i.sort];
      });
      S.items = {name:'Items', headers:['Ref', 'Code', 'Div', 'Section', 'Section title', 'Category', 'Subcategory', 'Group', 'Item', 'Material / option', 'Rating / class', 'Jointing', 'Standards (item data)', 'Application / limits', 'Included when', 'Included when (option keys)', 'Status', 'Source', 'Owner', 'Review due', 'Review', 'Specification', 'Published rev', 'Approved by', 'Approved on', 'Last revision reason', 'Standards (specification)', 'Part 2 clauses', 'Part 3 clauses', 'Pending draft', 'Active', 'Sort'],
        widths:[12, 9, 5, 9, 28, 16, 16, 14, 28, 32, 18, 22, 26, 26, 30, 18, 9, 10, 8, 11, 9, 14, 8, 9, 11, 28, 24, 8, 8, 12, 7, 6], rows, freeze:true, freezeCols:2};
    }
    // Item specifications (published + pending drafts, readable)
    {
      const rows = [];
      items.forEach(i => { [live[i.code], draft[i.code]].filter(Boolean).forEach(r => rows.push([i.ref, i.code, nice(i.section_num), sTitle(i.section_num), i.category, i.subcategory, i.item + (i.material && i.material !== i.item ? ' – ' + i.material : ''), r.heading, r.rev, r.status === 'approved' ? 'Published' : 'Draft', renderClauses(r.part2), renderClauses(r.part3), r.standards, r.reason, r.created_by, day(r.created_at), r.approved_by, day(r.approved_at), cl(i.include_when)])); });
      S.specs = {name:'Item specifications', headers:['Ref', 'Code', 'Section', 'Section title', 'Category', 'Subcategory', 'Item', 'Article heading', 'Rev', 'Status', 'Part 2 – Products (clauses)', 'Part 3 – Execution (clauses)', 'Standards cited', 'Reason for revision', 'Written by', 'Written on', 'Approved by', 'Approved on', 'Included when'],
        widths:[12, 9, 9, 24, 16, 16, 28, 20, 5, 10, 80, 50, 22, 30, 9, 11, 9, 11, 28], rows, freeze:true, freezeCols:2};
    }
    // Revision history (raw text, all revisions)
    {
      const rows = revs.slice().sort((a, b) => byNum(a.item_code, b.item_code) || b.rev - a.rev).map(r => { const i = itemBy[r.item_code] || {}; return [i.ref, r.item_code, nice(i.section_num), i.item, r.rev, r.status, r.reason, r.reject_note, r.created_by, stamp(r.created_at), r.approved_by, stamp(r.approved_at), r.heading, r.standards, r.part2, r.part3]; });
      S.hist = {name:'Item spec history', headers:['Ref', 'Code', 'Section', 'Item', 'Rev', 'Status', 'Reason', 'Rejected because', 'Written by', 'Written on', 'Approved by', 'Approved on', 'Heading', 'Standards', 'Part 2 (library text)', 'Part 3 (library text)'],
        widths:[12, 9, 9, 28, 5, 11, 32, 24, 9, 15, 9, 15, 20, 22, 60, 40], rows, freeze:true, freezeCols:2};
    }
    // Sections
    const parsed = {};
    secs.forEach(s => { parsed[s.num] = parseBody(s.body); });
    {
      const relN = {}, stdN = {}, itN = {}; list(T.spec_relations.rows).forEach(r => { relN[r.from_num] = (relN[r.from_num] || 0) + 1; }); list(T.spec_section_standards.rows).forEach(r => { stdN[r.section_num] = (stdN[r.section_num] || 0) + 1; }); list(items).forEach(i => { itN[i.section_num] = (itN[i.section_num] || 0) + 1; });
      const hardRe = /\b(Dubai|DCD|DEWA|Abu Dhabi|ADCD|Sharjah|SEWA|UAE|Riyadh|Saudi|KSA|SBC|Qatar|QCD|Kahramaa|Oman|Muscat)\b/g;
      const rows = secs.map(s => {
        const P = parsed[s.num], body = String(s.body || ''), auto = [/\{\{AUTO:ITEMS/.test(body) && 'Items', /\{\{AUTO:RELATED/.test(body) && 'Related', /\{\{AUTO:STANDARDS/.test(body) && 'Standards', /\{\{\s*>/.test(body) && 'Common text'].filter(Boolean);
        const hard = [...new Set((body.replace(/\{\{[^}]*\}\}/g, '').match(hardRe) || []))];
        return [nice(s.num), s.division || divOf(s.num), s.title, /9998$/.test(s.num) ? 'Annexure B' : s.include_when ? 'Project-specific' : 'General', cl(s.include_when), s.include_when, P.reduce((a, p) => a + p.arts.length, 0), P.reduce((a, p) => a + p.arts.reduce((b, q) => b + q.clauses.length, 0), 0), itN[s.num] || 0, relN[s.num] || 0, stdN[s.num] || 0, auto.join(', '), hard.join(', '), s.active === false ? 'No' : 'Yes', stamp(s.updated_at), s.updated_by, s.sort];
      });
      S.secs = {name:'Sections', headers:['Section', 'Div', 'Title', 'Class', 'Included when', 'Included when (option keys)', 'Articles', 'Clauses', 'Items', 'Related links', 'Standards linked', 'Automatic lists', 'Hard-coded location words', 'Active', 'Last change', 'By', 'Sort'],
        widths:[10, 5, 40, 14, 40, 22, 8, 8, 7, 8, 9, 22, 18, 7, 15, 8, 6], rows, freeze:true, freezeCols:3};
    }
    // Section clauses (one row per clause, library numbering = every clause on)
    {
      const rows = [];
      secs.forEach(s => parsed[s.num].forEach(P => P.arts.forEach(A => A.clauses.forEach(k => rows.push([nice(s.num), s.title, 'PART ' + P.no + ' – ' + P.title.replace(/^PART\s*\d+\s*[-–—:.]?\s*/i, ''), A.no, A.title, k.lbl, k.lvl + 1, kind(k.text), k.text, fields(k.text).join(', '), cl(k.cond || A.cond || P.cond), k.cond || A.cond || P.cond])))));
      S.clauses = {name:'Section clauses', headers:['Section', 'Section title', 'Part', 'Article', 'Article title', 'Clause', 'Level', 'Type', 'Clause text (library wording)', 'Fields used', 'Condition', 'Condition (option keys)'],
        widths:[10, 30, 22, 7, 28, 7, 6, 18, 90, 20, 30, 20], rows, freeze:true, freezeCols:1};
    }
    // Related links
    {
      const rows = list(T.spec_relations.rows).sort((a, b) => byNum(a.from_num, b.from_num) || byNum(a.to_num, b.to_num)).map(r => [nice(r.from_num), sTitle(r.from_num), nice(r.to_num), secBy[r.to_num] ? sTitle(r.to_num) : r.label, secBy[r.to_num] ? 'In library' : 'Other discipline', cl(r.include_when), r.sort]);
      S.rel = {name:'Related links', headers:['Section', 'Section title', 'Refers to', 'Title of related section', 'Where', 'Only when', 'Sort'], widths:[10, 36, 10, 40, 16, 30, 6], rows, freeze:true};
    }
    // Standards (with usage)
    {
      const bySec = {}, byItem = {};
      list(T.spec_section_standards.rows).forEach(r => { (bySec[r.code] = bySec[r.code] || new Set()).add(r.section_num); });
      const codes = Object.keys(stdBy).sort((a, b) => b.length - a.length);
      list(items).forEach(i => { const txt = [i.standards, (live[i.code] || {}).standards].filter(Boolean).join(';'); txt.split(';').map(x => x.trim()).filter(Boolean).forEach(t => { const c = codes.find(k => t === k || t.startsWith(k + ' ')); if (c) (byItem[c] = byItem[c] || new Set()).add(i.code); }); });
      const rows = stds.map(s => [s.code, s.title, s.edition, s.editions && Object.keys(s.editions).length ? Object.entries(s.editions).map(([k, v]) => k + ': ' + v).join('; ') : '', s.org, s.notes, bySec[s.code] ? bySec[s.code].size : 0, byItem[s.code] ? byItem[s.code].size : 0, s.active === false ? 'No' : 'Yes', stamp(s.updated_at), s.updated_by]);
      S.std = {name:'Standards', headers:['Code', 'Title', 'Default edition', 'Edition by country', 'Organisation', 'Notes', 'Cited by sections', 'Cited by items', 'Active', 'Last change', 'By'], widths:[16, 56, 18, 26, 14, 24, 9, 9, 7, 15, 8], rows, freeze:true};
    }
    // Section standards
    {
      const rows = list(T.spec_section_standards.rows).sort((a, b) => byNum(a.section_num, b.section_num) || byNum(a.code, b.code)).map(r => [nice(r.section_num), sTitle(r.section_num), r.code, stdBy[r.code] ? stdBy[r.code].title : '(not in register)', stdBy[r.code] ? stdBy[r.code].edition : '', cl(r.include_when)]);
      S.sstd = {name:'Section standards', headers:['Section', 'Section title', 'Standard', 'Standard title', 'Edition', 'Only when'], widths:[10, 36, 16, 56, 14, 30], rows, freeze:true};
    }
    // Common text
    {
      const rows = list(T.spec_blocks.rows).sort((a, b) => byNum(a.key, b.key)).map(b => { const re = new RegExp('\\{\\{\\s*>\\s*' + String(b.key).replace(/[.\-]/g, '\\$&') + '\\s*\\}\\}'); return [b.key, b.title, secs.filter(s => re.test(s.body || '')).length, renderClauses(b.body), stamp(b.updated_at), b.updated_by]; });
      S.blocks = {name:'Common text', headers:['Key', 'Title', 'Used in sections', 'Text', 'Last change', 'By'], widths:[34, 26, 9, 90, 15, 8], rows, freeze:true};
    }
    // Vendors
    {
      const vs = T.spec_vendors.rows.slice().sort((a, b) => byNum(a.section_num, b.section_num) || (a.sort || 0) - (b.sort || 0));
      S.vend = {name:'Vendors', headers:['Code', 'Div', 'Section', 'Section title', 'Item / scope', 'Manufacturers', 'Included when', 'Status', 'Source', 'Active'], widths:[9, 5, 9, 32, 34, 60, 28, 9, 9, 7],
        rows:vs.map(v => [v.code, divOf(v.section_num), nice(v.section_num), sTitle(v.section_num), v.item, v.makers, cl(v.include_when), v.status, v.source, v.active === false ? 'No' : 'Yes']), freeze:true};
      const one = []; vs.forEach(v => String(v.makers || '').split(';').map(x => x.trim()).filter(Boolean).forEach(m => one.push([divOf(v.section_num), nice(v.section_num), sTitle(v.section_num), v.item, m, cl(v.include_when), v.status, v.source, v.active === false ? 'No' : 'Yes'])));
      S.vend1 = {name:'Vendors (one per row)', headers:['Div', 'Section', 'Section title', 'Item / scope', 'Manufacturer', 'Included when', 'Status', 'Source', 'Active'], widths:[5, 9, 32, 34, 24, 28, 9, 9, 7], rows:one, freeze:true};
    }
    // Project options (with usage counts)
    {
      const conds = [];
      secs.forEach(s => { conds.push(s.include_when); (String(s.body || '').match(/\[if:[^\]]+\]/g) || []).forEach(m => conds.push(m.slice(4, -1))); });
      items.forEach(i => conds.push(i.include_when)); T.spec_vendors.rows.forEach(v => conds.push(v.include_when)); T.spec_relations.rows.forEach(r => conds.push(r.include_when)); T.spec_section_standards.rows.forEach(r => conds.push(r.include_when)); T.spec_options.rows.forEach(o => conds.push(o.dep));
      const use = k => { const re = new RegExp('(^|[^A-Za-z0-9_])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z0-9_]|$)'); return conds.filter(c => c && re.test(c)).length; };
      const ch = c => Array.isArray(c) ? c.map(x => Array.isArray(x) ? (x[0] === x[1] ? x[0] : x[0] + ' = ' + x[1]) : x).join('; ') : '';
      const rows = T.spec_options.rows.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(o => [o.key, o.grp, o.label, o.type || 'Yes / No', ch(o.choices), o.default_value === null || o.default_value === undefined ? '' : typeof o.default_value === 'object' ? JSON.stringify(o.default_value) : String(o.default_value), o.dep ? cl(o.dep) : '', o.sub || 0, use(o.key), o.active === false ? 'No' : 'Yes', o.sort]);
      S.opt = {name:'Project options', headers:['Key', 'Group', 'Label', 'Type', 'Choices', 'Default', 'Enabled when', 'Indent', 'Used in conditions', 'Active', 'Sort'], widths:[18, 22, 44, 11, 40, 14, 26, 6, 9, 7, 6], rows, freeze:true};
    }
    // Locations (one column per field)
    {
      const keys = []; T.spec_locations.rows.forEach(l => Object.keys(l.data || {}).forEach(k => { if (!keys.includes(k)) keys.push(k); }));
      const rows = T.spec_locations.rows.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(l => [l.country_code, l.country_name, l.city === '*' ? '* (country base)' : l.city, ...keys.map(k => (l.data || {})[k])]);
      S.loc = {name:'Locations', headers:['Country code', 'Country', 'City', ...keys], widths:[10, 22, 18, ...keys.map(() => 24)], rows, freeze:true, freezeCols:3};
    }

    const order = ['items', 'specs', 'hist', 'secs', 'clauses', 'rel', 'std', 'sstd', 'blocks', 'vend', 'vend1', 'opt', 'loc'];
    const desc = {items:'One row per library item: ref, category, material, rating, standards, owner, review date and specification status.',
      specs:'Readable text of each item\'s published specification (and any draft awaiting approval): Part 2 and Part 3 clauses.',
      hist:'Every revision of every item specification with reason, author, approver and the library wording.',
      secs:'One row per section: class, conditions, counts, which lists are automatic, hard-coded location words.',
      clauses:'One row per clause of every section, with part, article, level, condition and fields used (library wording, all clauses on).',
      rel:'Related Requirements links between sections.', std:'Standards register with edition and where each is cited.', sstd:'Which standards each section cites.',
      blocks:'Common text blocks used by several sections.', vend:'Vendor list as stored (section / item, manufacturers separated by ;).', vend1:'Same vendor list with one manufacturer per row, for filtering and pivots.',
      opt:'Project options (the switches on the Systems page) with default and how many conditions use each.', loc:'Country and city defaults (authorities, codes, supply data).'};
    const stats = {};
    const out = order.map(k => { const sh = S[k]; stats[k] = sh.rows.length; return sh; });
    const nTrunc = out.reduce((a, sh) => a + sh.rows.reduce((b, r) => b + r.reduce((c, x) => { const v = (x && typeof x === 'object' && 'v' in x) ? x.v : x; return c + (typeof v === 'string' && v.length > MAXCELL ? 1 : 0); }, 0), 0), 0);
    const sum = [
      [{v:'MEP Specification Library – export', s:2}],
      [{v:'Generated ' + new Date().toLocaleString() + (who ? ' by ' + who : '') + ' · ' + String(G('BUILD_LABEL') || 'Spec builder'), s:3}],
      [''],
      [{v:'Sheet', s:5}, {v:'Rows', s:5}, {v:'What it contains', s:5}],
      ...order.map(k => [{v:S[k].name, s:4}, stats[k], desc[k]]),
      [''],
      [{v:'Notes', s:5}, {v:'', s:5}, {v:'', s:5}],
      [{v:'Wording', s:4}, '', 'Text keeps the library wording, including {{FIELDS}} (filled from each project\'s location) and {{AUTO:…}} / {{>…}} automatic lists. Section numbers are shown as 22 10 05.'],
      [{v:'Numbering', s:4}, '', 'Clause numbering on "Section clauses" counts every clause as included. A project\'s own numbering depends on its option selections.'],
      [{v:'Conditions', s:4}, '', '"Included when" shows the option labels; the next column shows the option keys used in the database.'],
      ...(missing.length ? [[{v:'Not available', s:4}, '', 'These tables could not be read, so related sheets are empty: ' + missing.join('; ')]] : []),
      ...(nTrunc ? [[{v:'Truncated', s:4}, '', nTrunc + ' cell(s) were longer than Excel allows (32,000 characters) and were shortened.']] : []),
    ];
    out.unshift({name:'Summary', rows:sum, widths:[26, 8, 100], noGrid:true});
    const blob = await writeXlsx(out);
    return {blob, name:'MEP_Spec_Library_Export_' + td + '.xlsx', summary:items.length + ' items · ' + secs.length + ' sections · ' + S.clauses.rows.length + ' clauses' + (missing.length ? ' · ' + missing.length + ' table(s) unavailable' : ''), stats, missing};
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  // ── button ──────────────────────────────────────────────────────────────
  function wrap() {
    if (window.SPEC_EXPORT && window.SPEC_EXPORT.installed) return;
    const h = React.createElement, Prev = G('LibraryAdmin');
    const ExportButton = makeButton(h);
    window.__specExportWrap = function LibraryWithExport(props) { return h('div', null, h(ExportButton, {who:props && props.who}), h(Prev, props)); };
    (0, eval)('LibraryAdmin = window.__specExportWrap');
    window.SPEC_EXPORT = {installed:true, version:VERSION, build};
    console.info('spec_export ' + VERSION + ' installed');
  }
  function makeButton(h) {
    return function ExportButton(props) {
      const [st, setSt] = React.useState({busy:false, msg:'', err:false});
      const run = async () => {
        setSt({busy:true, msg:'Reading the library…', err:false});
        try { const r = await build(props.who); download(r.blob, r.name); setSt({busy:false, msg:'Saved ' + r.name + ' — ' + r.summary, err:false}); }
        catch (e) { setSt({busy:false, msg:'Export failed: ' + ((e && e.message) || e), err:true}); }
        setTimeout(() => setSt(s => s.busy ? s : {busy:false, msg:'', err:false}), 14000);
      };
      return h('div', {className:'no-print', style:{position:'fixed', top:14, left:'calc(50% + 84px)', zIndex:60, display:'flex', gap:8, alignItems:'center'}},
        h('button', {onClick:run, disabled:st.busy, title:'Export items, specifications, sections, clauses, standards, vendors and options to one Excel file', style:{padding:'6px 14px', background:'#167344', color:'#fff', border:0, borderRadius:999, fontSize:11, fontWeight:800, cursor:st.busy ? 'default' : 'pointer', opacity:st.busy ? .6 : 1, boxShadow:'0 2px 8px rgba(22,115,68,.35)', whiteSpace:'nowrap'}}, st.busy ? 'Exporting…' : '↧ Export to Excel'),
        st.msg && h('span', {style:{fontSize:11, background:'#fff', border:'1px solid ' + (st.err ? '#f5b5ae' : '#d2d2d7'), color:st.err ? '#b42318' : '#424245', borderRadius:8, padding:'4px 9px', maxWidth:380}}, st.msg));
    };
  }
  window.SPEC_EXPORT = window.SPEC_EXPORT || {installed:false, version:VERSION, build};
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    let ok = false;
    try { ok = typeof G('LibraryAdmin') === 'function' && typeof sb !== 'undefined' && !!window.React && (!!window.SPEC_ITEMS_V2 || tries > 400); } catch (e) { ok = false; }
    if (ok) { clearInterval(t); try { wrap(); } catch (e) { console.error('spec_export: install failed – page runs without it', e); } }
    else if (tries > 3000) clearInterval(t);
  }, 10);
})();
