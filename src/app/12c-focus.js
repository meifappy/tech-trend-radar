/* My focus: the reader's own context (industry, systems, rules, priorities) is a lens over the whole radar. While it
   is on, the feed (All, Top, Audio), the news bar, the briefing, the unread count and the orange dots show only
   matching stories, and the trends they belong to light up on the radar. Terms are typed as a short list, or a strategy text is pasted and reduced to the
   words the radar's sources actually use. Kept in this browser only; nothing is sent anywhere. */
const FOCUS = { terms: [], on: true, edit: false, rx: [], trends: new Set(), tlist: [], score: new Map(), hits: new Map(), tterms: new Set(), news: null };
const STOP = new Set(('about above after again against also among and any are because been before being below between both but can could does ' +
  'doing down during each every few for from further had has have having here how into its itself just more most must need needs not now off ' +
  'once only other our ours out over own same should since some such than that the their them then there these they this those through too ' +
  'under until very was were what when where which while who why will with within without would your yours company business strategy focus ' +
  'want looking claim claims plan plans year years next team teams goal goals make sure better new use using across based moving meeting piloting duties while being doing towards help helps').split(' '));
// A few words expand to the exact terms sources use for the same thing (never to broader topics: "bank" must not
// pull in every payments or finance story).
const SYN = {
  bank: ['banking'], banking: ['bank'], insurance: ['insurer'], insurer: ['insurance'], versicherung: ['insurance', 'insurer'],
  health: ['healthcare'], healthcare: ['health care'], pharma: ['pharmaceutical'], manufacturing: ['manufacturer'], automotive: ['automaker', 'carmaker'],
  telecom: ['telco', 'telecommunications'], mittelstand: ['sme', 'smes'], sme: ['mittelstand'], germany: ['german'], german: ['germany'],
  europe: ['european', 'eu'], eu: ['european union'], 'public sector': ['government'], kubernetes: ['k8s'], 'post-quantum': ['pqc'], pqc: ['post-quantum']
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole words only, with common endings (bank, banks, banking; insurer, insurers): "cloud" no longer matches
// "Cloudflare", and "bank" no longer matches "bankrupt".
const termRx = t => new RegExp('(?:^|[^\\p{L}\\p{N}])(?:' + [t].concat(SYN[t] || []).map(w => esc(w) + (w.length <= 3 ? '' : "(?:s|es|ing|ed|er|ers|'s)?")).join('|') + ')(?![\\p{L}\\p{N}])', 'iu');
const trendText = t => [t.title, t.short, t.line, t.scope].concat(Array.isArray(t.why) ? t.why : [t.why]).map(str).join(' ');
const pts = n => (Array.isArray(n.points) ? n.points.join(' ') : '');

function focusParse(text) {
  const out = [];
  for (const part of str(text).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)) {
    if (part.split(/\s+/).length <= 3) { out.push(part.toLowerCase()); continue; }
    // Prose: first two-word phrases the radar's own texts use ("sovereign cloud"), then acronyms (NIS2, DORA) and
    // longer, specific words. A word that matches more than one text in twelve says nothing about this reader.
    const docs = S.trends.map(trendText).concat(S.news.map(n => n.title + ' ' + n.take));
    const hits = t => { const re = termRx(t); return docs.filter(d => re.test(d)).length; };
    const ws = part.split(/[^\p{L}\p{N}&+-]+/u).filter(Boolean), used = new Set();
    for (let i = 0; i + 1 < ws.length; i++) {
      const a = ws[i].toLowerCase(), b = ws[i + 1].toLowerCase(), bg = a + ' ' + b;
      if (STOP.has(a) || STOP.has(b) || a.length < 3 || b.length < 3) continue;
      if (hits(bg)) { out.push(bg); used.add(i); used.add(i + 1); }
    }
    ws.forEach((w, i) => {
      const lw = w.toLowerCase();
      if (used.has(i) || STOP.has(lw)) return;
      const acro = /^[A-Z][A-Z0-9&+-]{1,7}$/.test(w);
      if (!acro && lw.length < 5) return;
      const n = hits(lw);
      if ((n || acro) && n <= docs.length / 12) out.push(lw);
    });
  }
  return [...new Set(out)].filter(t => t.length >= 2).slice(0, 12);
}
// Scores each story (title 3, text 2, source 1, its trend's definition 1, per term) and each trend (its definition
// 4 per term, plus its stories' own matches). Only clearly relevant trends light up: a third of the best score or more.
function focusSync() {
  FOCUS.news = S.news; FOCUS.tr = S.trends;
  FOCUS.rx = FOCUS.terms.map(t => ({ t, re: termRx(t) }));
  FOCUS.trends = new Set(); FOCUS.tlist = []; FOCUS.own = new Set(); FOCUS.score = new Map(); FOCUS.hits = new Map(); FOCUS.tterms = new Set();
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
      // Only a title or summary match makes a story's trend more relevant; a passing mention in the key points does not.
      if (own && x.re.test(str(n.title) + ' ' + str(n.take))) for (const k of tkeys(n)) if (S.byId.has(k)) bump(k, own);
    }
    if (s) FOCUS.score.set(n.id, s);
  }
  const top = Math.max(0, ...tsc.values()), min = Math.max(3, top / 3);
  FOCUS.tlist = S.trends.filter(t => (tsc.get(t.id) || 0) >= min).sort((a, b) => tsc.get(b.id) - tsc.get(a.id));
  FOCUS.trends = new Set(FOCUS.tlist.map(t => t.id));
  // A story is in focus only when its own words match: title, summary, key points or source. Belonging to a relevant
  // trend raises its rank but never lets an unrelated story in.
  for (const n of S.news) if (FOCUS.score.has(n.id) && own3(n)) FOCUS.own.add(n.id);
  for (const id of [...FOCUS.score.keys()]) if (!FOCUS.own.has(id)) FOCUS.score.delete(id);
}
// In focus: the title or summary names a term; a mention only in the key points or the source name counts when the
// story's trend is itself relevant (so a passing "post-quantum" in a photo-signing story does not pull it in).
const own3 = n => FOCUS.rx.some(x => x.re.test(str(n.title) + ' ' + str(n.take))) ||
  (tkeys(n).some(k => FOCUS.trends.has(k)) && FOCUS.rx.some(x => x.re.test(pts(n) + ' ' + str(n.src.name))));
function focusLoad() { const v = ls.get('focus', []); FOCUS.terms = Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.slice(0, 40)).slice(0, 12) : []; FOCUS.on = ls.get('focusOn', true) !== false; }
function focusSet(terms, keepOpen) {
  FOCUS.terms = terms;
  FOCUS.edit = !!keepOpen;
  if (terms.length) FOCUS.on = true;
  ls.set('focus', terms); ls.set('focusOn', FOCUS.on);
  focusApply();
}
function focusToggle() {
  if (!FOCUS.terms.length || FOCUS.edit) { FOCUS.edit = !FOCUS.edit; FOCUS.prose = false; renderPanel(false); return; }
  FOCUS.on = !FOCUS.on; FOCUS.edit = false;
  ls.set('focusOn', FOCUS.on);
  focusApply();
  toast(FOCUS.on ? 'Focus on' : 'Focus off: showing everything');
}
// Everything follows the lens: the reading state, the radar, the news bar and the feed.
function focusApply() {
  focusSync();
  if (knownNew) { derive(); knownNew = new Set(S.news.filter(n => n._new).map(n => n.id)); }
  FEED.n = 12;
  P.body.scrollTop = 0;
  refresh();
}
const focusFresh = () => { if (FOCUS.news !== S.news || FOCUS.tr !== S.trends) focusSync(); };
const focusActive = () => FOCUS.on && FOCUS.terms.length > 0;
const inFocus = n => !focusActive() || (focusFresh(), FOCUS.score.has(n.id));
const focusDim = id => focusActive() && (focusFresh(), !FOCUS.trends.has(id) && !(S.byT.get(id) || []).some(n => FOCUS.own.has(n.id)));

// Suggestions come from the radar's own vocabulary (trend names, acronyms in the stories, common topics), each with
// the number of stories it would show, so a tap always finds something.
const SUGGEST = ['sovereign cloud', 'post-quantum', 'deepfake', 'ransomware', 'Kubernetes', 'SAP', 'AI Act', 'Cyber Resilience Act', 'agents',
  'humanoid', 'data centre', 'open source', 'supply chain', 'insurance', 'banking', 'healthcare', 'Germany', 'semiconductors', 'robotics', 'identity'];
function focusSuggest(prefix) {
  if (FOCUS.candNews !== S.news || FOCUS.candTr !== S.trends) {
    const docs = S.news.filter(n => !n.minor && S.byId.has(n.t)).map(n => str(n.title) + ' ' + str(n.take)), pool = new Map();
    const add = w => { const k = w.toLowerCase(); if (!pool.has(k)) pool.set(k, w); };
    S.trends.forEach(t => add(t.short || t.title));
    for (const d of docs) for (const m of d.matchAll(/\b[A-Z][A-Z0-9]{1,5}\b/g)) if (!['AI', 'US', 'UK', 'CEO', 'API', 'IT', 'Q1', 'Q2', 'Q3', 'Q4'].includes(m[0])) add(m[0]);
    SUGGEST.forEach(add);
    FOCUS.cand = [...pool.values()].map(w => { const re = termRx(w.toLowerCase()); return { w, n: docs.filter(d => re.test(d)).length }; })
      .filter(x => x.n >= 1).sort((a, b) => b.n - a.n || a.w.localeCompare(b.w));
    FOCUS.candNews = S.news; FOCUS.candTr = S.trends;
  }
  const have = new Set(FOCUS.terms.map(t => t.toLowerCase())), p = str(prefix).trim().toLowerCase();
  return FOCUS.cand.filter(x => !have.has(x.w.toLowerCase()) && (p ? x.w.toLowerCase().includes(p) : x.n >= 2)).slice(0, p ? 8 : 12);
}
// Adding or removing a topic applies at once and keeps the editor open, so the feed below updates as you go.
function focusAdd(w) {
  const add = Array.isArray(w) ? w : str(w).trim().split(/\s+/).length > 3 ? focusParse(w) : [str(w).trim()];
  const have = new Set(FOCUS.terms.map(t => t.toLowerCase()));
  const terms = FOCUS.terms.concat(add.filter(t => t && !have.has(t.toLowerCase()))).slice(0, 12);
  focusSet(terms, true);
}
const focusRemove = w => focusSet(FOCUS.terms.filter(y => y !== w), FOCUS.edit);
function termChip(x) {
  const ok = FOCUS.hits.get(x) || FOCUS.tterms.has(x);
  return h('button', { class: 'term' + (ok ? '' : ' none'), type: 'button', 'aria-label': 'Remove ' + x, title: ok ? stories(FOCUS.hits.get(x) || 0) + ' match' : 'No story mentions this yet', onclick: () => focusRemove(x) }, h('span', { text: x }), ic('i-close'));
}
function focusEditor() {
  const terms = FOCUS.terms;
  if (FOCUS.prose) {
    const ta = h('textarea', { class: 'focus-in', rows: 4, 'aria-label': 'Your strategy text', placeholder: 'Paste a few sentences about your company, priorities or projects. The radar picks out the topics it covers.' });
    requestAnimationFrame(() => ta.focus({ preventScroll: true }));
    return h('form', { class: 'focus edit', onsubmit: e => { e.preventDefault(); FOCUS.prose = false; focusAdd(focusParse(ta.value)); } },
      h('div', { class: 'focus-h' }, h('b', { text: 'Paste a strategy text' }), h('button', { class: 'link sm', type: 'button', onclick: () => { FOCUS.prose = false; renderPanel(false); } }, 'Back')),
      ta, h('div', { class: 'focus-a' }, h('button', { class: 'btn btn-w', type: 'submit' }, 'Find my topics'), h('small', { text: 'Stays in this browser' })));
  }
  const input = h('input', { class: 'focus-add', type: 'text', enterkeyhint: 'done', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Add a topic', placeholder: terms.length ? 'Add another topic' : 'Type a topic, company or rule' });
  const head = h('p', { class: 'sugg-h' }), sug = h('div', { class: 'sugg' });
  const fill = () => {
    const list = focusSuggest(input.value), q = input.value.trim();
    head.textContent = q ? (list.length ? 'Matching topics' : 'Press Enter to add “' + q + '”') : terms.length ? 'Add more' : 'Popular on the radar';
    put(sug, list.map(x => h('button', { class: 'sug', type: 'button', onclick: () => focusAdd(x.w) }, h('span', { text: x.w }), h('small', { text: String(x.n) }))));
  };
  input.addEventListener('input', fill);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); const v = input.value.trim(); if (v) { FOCUS.typing = true; focusAdd(v); } }
    else if (e.key === 'Backspace' && !input.value && terms.length) { FOCUS.typing = true; focusRemove(terms[terms.length - 1]); }
    else if (e.key === 'Escape') { FOCUS.edit = false; renderPanel(false); }
  });
  fill();
  if (FOCUS.typing || (!PHONE && !terms.length)) requestAnimationFrame(() => input.focus({ preventScroll: true }));
  FOCUS.typing = false;
  const n = terms.length ? S.news.filter(x => !x.minor && S.byId.has(x.t) && FOCUS.score.has(x.id)).length : 0;
  return h('div', { class: 'focus edit' },
    h('div', { class: 'focus-h' }, h('b', { text: 'Your focus' }), terms.length ? h('span', { text: stories(n) }) : null,
      h('button', { class: 'btn btn-w sm', type: 'button', onclick: () => { FOCUS.edit = false; renderPanel(false); } }, 'Done')),
    h('div', { class: 'terms' }, terms.map(termChip), input),
    head, sug,
    h('div', { class: 'focus-f' }, h('button', { class: 'link sm', type: 'button', onclick: () => { FOCUS.prose = true; renderPanel(false); } }, 'Paste a strategy text instead'), h('small', { text: 'Stays in this browser' })));
}
function focusBox() {
  if (FOCUS.edit) return focusEditor();
  if (!focusActive()) return null;
  const n = S.news.filter(x => !x.minor && S.byId.has(x.t) && FOCUS.score.has(x.id)).length;
  return h('div', { class: 'focus' },
    h('div', { class: 'focus-h' }, h('b', { text: 'Your focus' }), h('span', { text: stories(n) }),
      h('button', { class: 'link sm', type: 'button', onclick: () => { FOCUS.edit = true; renderPanel(false); } }, 'Edit'),
      h('button', { class: 'link sm', type: 'button', onclick: focusToggle }, 'Off')),
    h('div', { class: 'terms' }, FOCUS.terms.map(termChip)));
}
focusLoad();
