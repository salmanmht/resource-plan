(function () {
  'use strict';
  var h = React.createElement;
  var G = function (n) { try { return (0, eval)(n); } catch (e) { return undefined; } };
  var ROWS = [], LOADED = false, ERR = '';

  async function load() {
    try {
      var r = await sb.from('spec_item_attrs').select('*').order('sort').range(0, 19999);
      if (r.error) { ERR = r.error.message; ROWS = []; LOADED = false; return; }
      ROWS = (r.data || []).filter(function (x) { return x.active !== false; }); LOADED = true; ERR = '';
    } catch (e) { ERR = String((e && e.message) || e); LOADED = false; }
  }
  var opts = function (s) { return String(s || '').split(' | ').map(function (x) { return x.trim(); }).filter(Boolean); };
  var chipStyle = function (k) { return {display:'inline-block', fontSize:9, fontWeight:800, borderRadius:999, padding:'2px 8px',
    background:k === 'Verified' ? '#e8faf0' : k === 'Check' ? '#fff4e0' : '#f1f1f3', color:k === 'Verified' ? '#208a45' : k === 'Check' ? '#a76200' : '#6e6e73'}; };
  var kindStyle = function (k) { return {display:'inline-block', fontSize:9, fontWeight:700, borderRadius:6, padding:'2px 6px',
    background:k === 'Your spec' ? '#e8f0fe' : k === 'Manufacturer' ? '#f1f1f3' : '#eef7ee', color:k === 'Your spec' ? '#1559a6' : k === 'Manufacturer' ? '#555' : '#2f6b3a'}; };

  function csv(rows) {
    var F = ['family', 'item', 'component', 'attribute', 'type', 'options', 'standards', 'source', 'kind', 'status', 'notes'];
    var t = [F.join(',')].concat(rows.map(function (r) { return F.map(function (k) { return '"' + String(r[k] == null ? '' : r[k]).replace(/"/g, '""') + '"'; }).join(','); })).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + t], {type:'text/csv'})); a.download = 'item_attributes.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function Viewer(props) {
    var S = React.useState;
    var s1 = S(0), ver = s1[0], setVer = s1[1];
    var s2 = S(''), item = s2[0], setItem = s2[1];
    var s3 = S(''), kind = s3[0], setKind = s3[1];
    var s4 = S(''), st = s4[0], setSt = s4[1];
    var s5 = S(''), q = s5[0], setQ = s5[1];
    var s6 = S(true), busy = s6[0], setBusy = s6[1];
    var s7 = S({}), open = s7[0], setOpen = s7[1];
    React.useEffect(function () { var c = false; load().then(function () { if (!c) { setBusy(false); setVer(function (x) { return x + 1; }); } }); return function () { c = true; }; }, []);
    var items = React.useMemo(function () { return Array.from(new Set(ROWS.map(function (r) { return r.item; }))); }, [ver]);
    var rows = React.useMemo(function () { return ROWS.filter(function (r) { return (!item || r.item === item) && (!kind || r.kind === kind) && (!st || r.status === st) &&
      (!q || [r.item, r.component, r.attribute, r.options, r.standards, r.source, r.notes].join(' ').toLowerCase().indexOf(q.toLowerCase()) >= 0); }); }, [ver, item, kind, st, q]);
    var groups = React.useMemo(function () { var g = {}; rows.forEach(function (r) { (g[r.item] = g[r.item] || []).push(r); }); return g; }, [rows]);
    var nCheck = ROWS.filter(function (r) { return r.status === 'Check'; }).length;
    var btn = {padding:'6px 12px', background:'#fff', color:'#424245', border:'1px solid #d2d2d7', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer'};
    var setAll = function (f) { setItem(f.item || ''); setKind(f.kind || ''); setSt(f.status || ''); setQ(''); setOpen({}); };
    var isOn = function (f) { return (f.item || '') === item && (f.kind || '') === kind && (f.status || '') === st && !q; };
    var card = function (l, v, n, k, f) { var on = isOn(f); return h('div', {className:'health-card ' + (k || 'capacity'), onClick:function () { setAll(on ? {} : f); }, title:on ? 'Click to show all' : 'Click to show these rows',
      style:{cursor:'pointer', outline:on ? '2px solid #007aff' : 'none', outlineOffset:1, transform:on ? 'translateY(-1px)' : 'none'}}, h('div', {className:'h-label'}, l), h('div', {className:'h-value'}, v), h('div', {className:'h-note'}, n)); };
    var filtered = !!(item || kind || st || q);
    return h('div', {className:'global-page', style:{minHeight:'100vh', background:'#f5f5f7'}},
      h('div', {className:'app-header'}, h('div', {style:{maxWidth:1400, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}},
        h('div', null, h('div', {style:{fontSize:9, letterSpacing:'.15em', textTransform:'uppercase', color:'#86868b', fontWeight:800}}, 'MEP Specifications'), h('div', {style:{fontSize:19, fontWeight:800, letterSpacing:'-.03em'}}, 'Item attributes')),
        h('div', {style:{display:'flex', gap:8}}, h('button', {onClick:props.onLibrary, style:btn}, 'Library'), h('button', {onClick:props.onBack, style:btn}, '\u2190 All projects')))),
      h('div', {style:{maxWidth:1400, margin:'0 auto', padding:'16px 20px'}},
        busy ? h('div', {className:'piw-empty big'}, 'Loading attributes...') :
        !LOADED ? h('div', {className:'ai-msg bad'}, 'Item attributes are not set up yet' + (ERR ? ' (' + ERR + ')' : '') + '. Run spec_item_attrs_schema.sql, then spec_item_attrs_seed_valves.sql, in Supabase SQL Editor.') :
        h('div', null,
          h('div', {className:'schedule-health', style:{marginBottom:10}},
            card('Attributes', ROWS.length, items.length + ' item groups - click to show all', 'capacity', {}),
            card('Verified', ROWS.length - nCheck, 'source says this - click to show', 'pass', {status:'Verified'}),
            card('To check', nCheck, 'conflicting or unclear - click to see what to decide', nCheck ? 'review' : 'pass', {status:'Check'}),
            card('From your specs', ROWS.filter(function (r) { return r.kind === 'Your spec'; }).length, 'taken from your own specifications', 'capacity', {kind:'Your spec'}),
            card('Manufacturer data', ROWS.filter(function (r) { return r.kind === 'Manufacturer'; }).length, 'reference only, per product', 'capacity', {kind:'Manufacturer'})),
          filtered && h('div', {style:{display:'flex', alignItems:'center', gap:10, margin:'0 0 8px', padding:'7px 12px', background:st === 'Check' ? '#fff4e0' : '#eef4ff', border:'1px solid ' + (st === 'Check' ? '#f5c27a' : '#cfe0ff'), borderRadius:8, fontSize:12, color:'#424245'}},
            h('span', {style:{flex:1}}, h('b', null, rows.length + ' of ' + ROWS.length + ' attributes'), ' shown' + (st === 'Check' ? '. Each amber note under the options says what to decide. Your answers go on the "To decide" sheet.' : '.')),
            h('button', {className:'schedule-action', onClick:function () { setAll({}); }}, 'Show all')),
          h('div', {className:'schedule-card'},
            h('div', {className:'schedule-toolbar'},
              h('input', {value:q, onChange:function (e) { setQ(e.target.value); }, placeholder:'Search attribute, option, standard, source'}),
              h('select', {value:item, onChange:function (e) { setItem(e.target.value); }}, h('option', {value:''}, 'All items'), items.map(function (i) { return h('option', {key:i}, i); })),
              h('select', {value:kind, onChange:function (e) { setKind(e.target.value); }}, h('option', {value:''}, 'Any source'), h('option', null, 'Your spec'), h('option', null, 'Manufacturer'), h('option', null, 'Both')),
              h('select', {value:st, onChange:function (e) { setSt(e.target.value); }}, h('option', {value:''}, 'Any status'), h('option', null, 'Verified'), h('option', null, 'Check')),
              h('span', {className:'toolbar-spacer'}),
              h('button', {className:'schedule-action', onClick:function () { var o = {}; Object.keys(groups).forEach(function (k) { o[k] = true; }); setOpen(o); }}, 'Expand all'),
              h('button', {className:'schedule-action', onClick:function () { setOpen({}); }}, 'Collapse all'),
              h('button', {className:'schedule-action', onClick:function () { csv(rows); }}, 'CSV')),
            h('div', {style:{maxHeight:'calc(100vh - 330px)', overflow:'auto'}},
              Object.keys(groups).length === 0 ? h('div', {className:'empty-schedule'}, 'No attributes match.') :
              Object.keys(groups).map(function (name) {
                var list = groups[name];
                var isOpen = open[name] !== undefined ? open[name] : filtered, nc = list.filter(function (r) { return r.status === 'Check'; }).length;
                return h('div', {key:name, style:{borderBottom:'1px solid #e8e8ed'}},
                  h('div', {onClick:function () { var o = Object.assign({}, open); o[name] = !isOpen; setOpen(o); }, style:{display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', background:isOpen ? '#f5f9ff' : '#fff'}},
                    h('span', {style:{width:14, fontSize:11, color:'#86868b'}}, isOpen ? '\u25BE' : '\u25B8'), h('b', {style:{fontSize:13, flex:1}}, name),
                    h('span', {style:{fontSize:10, color:'#86868b'}}, list.length + ' attributes'), nc ? h('span', {style:chipStyle('Check')}, nc + ' to check') : null),
                  isOpen && h('table', {className:'schedule-table', style:{minWidth:900, tableLayout:'auto'}},
                    h('thead', null, h('tr', {className:'labels'}, ['Component', 'Attribute', 'Options / values', 'Standards', 'Source', 'Status'].map(function (x, i) { return h('th', {key:i}, x); }))),
                    h('tbody', null, list.map(function (r) { return h('tr', {key:r.id, style:{cursor:'default'}},
                      h('td', {style:{fontSize:10.5, whiteSpace:'nowrap'}}, r.component),
                      h('td', {style:{fontWeight:700, minWidth:150}}, r.attribute, r.type ? h('div', {style:{fontSize:9, color:'#86868b', fontWeight:500}}, r.type) : null),
                      h('td', {style:{minWidth:380, whiteSpace:'normal'}}, h('ul', {style:{margin:0, paddingLeft:16}}, opts(r.options).map(function (o, i) { return h('li', {key:i, style:{marginBottom:2, fontSize:11}}, o); })),
                        r.notes ? h('div', {style:{marginTop:4, fontSize:10, color:r.status === 'Check' ? '#a76200' : '#6e6e73', background:r.status === 'Check' ? '#fff4e0' : '#f5f5f7', borderRadius:6, padding:'4px 7px'}}, r.notes) : null),
                      h('td', {style:{fontSize:10, maxWidth:150, whiteSpace:'normal'}}, r.standards),
                      h('td', {style:{fontSize:10, maxWidth:260, whiteSpace:'normal'}}, h('span', {style:kindStyle(r.kind)}, r.kind), h('div', {style:{marginTop:3}}, r.source)),
                      h('td', null, h('span', {style:chipStyle(r.status)}, r.status))); })))); })),
            h('div', {style:{padding:'8px 12px', fontSize:10, color:'#86868b'}}, rows.length + ' of ' + ROWS.length + ' attributes shown. Read-only. Verified = the source shown says this. Check = conflicting or unclear, decide before use. Manufacturer rows describe that product only. Click a box above to filter.')))));
  }

  function install() {
    if (window.SPEC_ATTRS && window.SPEC_ATTRS.installed) return;
    var Prev = G('LibraryAdmin');
    function LibraryWithAttrs(props) {
      var m = React.useState('lib'), mode = m[0], setMode = m[1];
      if (mode === 'attrs') return h(Viewer, {onBack:props.onBack, onLibrary:function () { setMode('lib'); }});
      return h('div', null,
        h('div', {className:'no-print', style:{position:'fixed', top:14, left:'calc(50% - 168px)', zIndex:60}},
          h('button', {onClick:function () { setMode('attrs'); }, style:{padding:'6px 14px', background:'#6d3fd6', color:'#fff', border:0, borderRadius:999, fontSize:11, fontWeight:800, cursor:'pointer', boxShadow:'0 2px 8px rgba(109,63,214,.35)', whiteSpace:'nowrap'}}, 'Item attributes')),
        h(Prev, props));
    }
    window.__specAttrsWrap = LibraryWithAttrs;
    (0, eval)('LibraryAdmin = window.__specAttrsWrap');
    window.SPEC_ATTRS = {installed:true, version:'1.2'};
    console.info('spec_attrs 1.2 installed');
  }
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var ok = false;
    try { ok = typeof G('LibraryAdmin') === 'function' && typeof sb !== 'undefined' && !!window.React && (!!window.SPEC_ITEMS_V2 || tries > 400); } catch (e) { ok = false; }
    if (ok) { clearInterval(t); try { install(); } catch (e) { console.error('spec_attrs: install failed, page runs without it', e); } }
    else if (tries > 3000) clearInterval(t);
  }, 10);
})();
