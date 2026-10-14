/* My focus: the reader's own context (industry, systems, rules, priorities) filters and ranks the feed and lights up
   the matching trends on the radar. Terms are typed as a short list, or a strategy text is pasted and reduced to the
   words the radar's sources actually use. Kept in this browser only; nothing is sent anywhere. */
const FOCUS = { terms: [], edit: false, rx: [], trends: new Set(), tlist: [], score: new Map(), hits: new Map(), tterms: new Set(), news: null };
const STOP = new Set(('about above after again against also among and any are because been before being below between both but can could does ' +
  'doing down during each every few for from further had has have having here how into its itself just more most must need needs not now off ' +
  'once only other our ours out over own same should since some such than that the their them then there these they this those through too ' +
  'under until very was were what when where which while who why will with within without would your yours company business strategy focus ' +
  'want looking plan plans year years next team teams goal goals make sure better new use using across based moving meeting piloting duties while being doing towards help helps').split(' '));
// A few business contexts expand to the words the sources use for them.
const SYN = {
  bank: ['banking', 'banks', 'financial', 'finance', 'dora', 'payments'], banking: ['bank', 'banks', 'financial', 'dora'], finance: ['financial', 'bank', 'dora'],
  insurance: ['insurer', 'solvency'], versicherung: ['insurance', 'insurer'], health: ['healthcare', 'hospital', 'medical', 'clinical'],
  pharma: ['drug', 'clinical', 'biotech', 'life sciences'], manufacturing: ['industrial', 'factory', 'factories', 'production', 'operational technology'],
  automotive: ['vehicle', 'automaker', 'cars'], retail: ['commerce', 'shopping', 'consumer'], energy: ['grid', 'utilities', 'utility', 'power'],
  government: ['public sector', 'administration', 'federal'], 'public sector': ['government', 'administration'], telecom: ['telco', 'network operator', '5g'],
  logistics: ['supply chain', 'shipping'], mittelstand: ['sme', 'smes', 'mid-sized'], sme: ['mittelstand', 'mid-sized'], germany: ['german', 'bsi', 'bitkom'],
  europe: ['eu', 'european'], eu: ['european', 'europe'], security: ['cyber', 'cybersecurity'], cyber: ['security', 'cybersecurity']
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRx = t => new RegExp('(?:^|[^\\p{L}\\p{N}])(?:' + [t].concat(SYN[t] || []).map(w => esc(w) + (w.length <= 3 ? '(?![\\p{L}\\p{N}])' : '')).join('|') + ')', 'iu');
const trendText = t => [t.title, t.short, t.line, t.scope].concat(Array.isArray(t.why) ? t.why : [t.why]).map(str).join(' ');
const pts = n => (Array.isArray(n.points) ? n.points.join(' ') : '');

function focusParse(text) {
  const out = [];
  for (const part of str(text).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)) {
    if (part.split(/\s+/).length <= 3) { out.push(part.toLowerCase()); continue; }
    // Prose: keep acronyms and the longer words that occur in the radar's trends or stories.
    // Words that match a sixth of all stories (like "AI") say nothing about this reader, so they are left out.
    const docs = S.trends.map(trendText).concat(S.news.map(n => n.title + ' ' + n.take));
    for (const w of part.split(/[^\p{L}\p{N}&+-]+/u)) {
      const lw = w.toLowerCase();
      if (STOP.has(lw) || !(/^[A-Z][A-Z0-9&+-]{1,7}$/.test(w) || lw.length >= 4)) continue;
      const re = termRx(lw), hits = docs.filter(d => re.test(d)).length;
      if ((hits || /^[A-Z]/.test(w) && w === w.toUpperCase()) && hits <= docs.length / 6) out.push(lw);
    }
  }
  return [...new Set(out)].filter(t => t.length >= 2).slice(0, 12);
}
// Scores each story (title 3, text 2, source 1, its trend's definition 1, per term) and each trend (its definition
// 4 per term, plus its stories' own matches). Only clearly relevant trends light up: a third of the best score or more.
function focusSync() {
  FOCUS.news = S.news; FOCUS.tr = S.trends;
  FOCUS.rx = FOCUS.terms.map(t => ({ t, re: termRx(t) }));
  FOCUS.trends = new Set(); FOCUS.tlist = []; FOCUS.score = new Map(); FOCUS.hits = new Map(); FOCUS.tterms = new Set();
  if (!FOCUS.rx.length) return;
  const tHit = new Map(), tsc = new Map(), bump = (k, v) => tsc.set(k, (tsc.get(k) || 0) + v);
  for (const t of S.trends) {
    const txt = trendText(t), m = FOCUS.rx.filter(x => x.re.test(txt)).map(x => x.t);
    if (m.length) { tHit.set(t.id, m); bump(t.id, 4 * m.length); m.forEach(x => FOCUS.tterms.add(x)); }
  }
  for (const n of S.news) {
    if (n.minor) continue;
    let s = 0;
    const tm = new Set(tkeys(n).flatMap(k => tHit.get(k) || []));
    for (const x of FOCUS.rx) {
      const own = x.re.test(str(n.title)) ? 3 : x.re.test(str(n.take) + ' ' + pts(n)) ? 2 : x.re.test(str(n.src.name)) ? 1 : 0;
      const v = own + (tm.has(x.t) ? 1 : 0);
      if (v) { s += v; FOCUS.hits.set(x.t, (FOCUS.hits.get(x.t) || 0) + 1); }
      if (own) for (const k of tkeys(n)) if (S.byId.has(k)) bump(k, own);
    }
    if (s) FOCUS.score.set(n.id, s);
  }
  const top = Math.max(0, ...tsc.values()), min = Math.max(3, top / 3);
  FOCUS.tlist = S.trends.filter(t => (tsc.get(t.id) || 0) >= min).sort((a, b) => tsc.get(b.id) - tsc.get(a.id));
  FOCUS.trends = new Set(FOCUS.tlist.map(t => t.id));
}
function focusLoad() { const v = ls.get('focus', []); FOCUS.terms = Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.slice(0, 40)).slice(0, 12) : []; }
function focusSet(terms) {
  FOCUS.terms = terms;
  FOCUS.edit = false;
  ls.set('focus', terms);
  focusSync();
  paintRadar();
  P.body.scrollTop = 0;
  renderPanel(false);
}
// Stories that match, strongest match first, then by heat.
function focusList(base) {
  focusFresh();
  return base.filter(n => FOCUS.score.has(n.id)).sort((a, b) => FOCUS.score.get(b.id) - FOCUS.score.get(a.id) || heatOf(b) - heatOf(a) || dayOf(b) - dayOf(a));
}
const focusFresh = () => { if (FOCUS.news !== S.news || FOCUS.tr !== S.trends) focusSync(); };
const focusDim = id => FEED.f === 'focus' && FOCUS.terms.length > 0 && (focusFresh(), !FOCUS.trends.has(id));

function focusBox() {
  const terms = FOCUS.terms;
  if (FOCUS.edit || !terms.length) {
    const ta = h('textarea', { class: 'focus-in', rows: 3, 'aria-label': 'Your focus', placeholder: 'Industry, systems, rules, priorities. For example: bank, SAP, NIS2, sovereign cloud. Or paste a short strategy text.' });
    ta.value = terms.join(', ');
    if (FOCUS.edit) requestAnimationFrame(() => ta.focus());
    return h('form', { class: 'focus', onsubmit: e => { e.preventDefault(); focusSet(focusParse(ta.value)); } }, ta,
      h('div', { class: 'focus-a' },
        h('button', { class: 'btn btn-w', type: 'submit' }, 'Apply'),
        terms.length ? h('button', { class: 'btn', type: 'button', onclick: () => { FOCUS.edit = false; renderPanel(false); } }, 'Cancel') : null,
        h('small', { text: 'Saved in this browser only' })));
  }
  const tr = FOCUS.tlist;
  return h('div', { class: 'focus' },
    h('div', { class: 'terms' },
      terms.map(x => h('button', { class: 'term' + (FOCUS.hits.get(x) || FOCUS.tterms.has(x) ? '' : ' none'), type: 'button', 'aria-label': 'Remove ' + x, title: FOCUS.hits.get(x) ? stories(FOCUS.hits.get(x)) + ' match' : 'No match yet', onclick: () => focusSet(terms.filter(y => y !== x)) }, h('span', { text: x }), ic('i-close'))),
      h('button', { class: 'link sm', type: 'button', onclick: () => { FOCUS.edit = true; renderPanel(false); } }, 'Edit')),
    tr.length ? h('p', { class: 'focus-t' }, h('span', { text: 'Most relevant ' + (tr.length === 1 ? 'trend' : 'trends') + ':' }),
      tr.slice(0, 8).map(t => h('button', { class: 'link sm', type: 'button', onclick: () => openTrend(t.id) }, h('i', { class: 'tdot c-' + t.ring }), t.short || t.title))) : null);
}
focusLoad();
