/* The news feed (phones and laptops): one card per story, endless, beside or under the radar.
   Order: stories that were new when this visit started (hot ones first), a calm "up to date" divider, then older
   stories, then earlier months from the archive as you keep scrolling. The order and the New labels stay put for
   the whole visit, so nothing jumps while you read. The story at the top of the view lights up its trend on the
   radar. Tapping a story opens it in place (key points, link to the source, more on the trend). */
const FEED = { n: 12, f: 'all', cue: null, openEl: null, obs: null, more: null, dwell: null, timers: new Map() };
const FILTERS = [['all', 'All'], ['hot', 'Hot'], ['pod', 'Podcasts'], ['ai', 'AI'], ['sec', 'Security'], ['cloud', 'Data'], ['sci', 'Frontier']];
const stories = n => n + (n === 1 ? ' story' : ' stories');
// New at the start of this visit (stable while reading); before the first reveal, fall back to the live flag.
const fresh = n => (knownNew ? knownNew.has(n.id) : !!n._new);

function feedList() {
  const f = FEED.f;
  const ok = S.news.filter(n => {
    const t = S.byId.get(n.t);
    return t && !n.minor && (f === 'all' || (f === 'hot' ? isHot(n) : f === 'pod' ? n.kind === 'podcast' : t.area === f));
  });
  const hotFirst = l => l.filter(isHot).concat(l.filter(n => !isHot(n)));
  return hotFirst(ok.filter(fresh)).concat(ok.filter(n => !fresh(n)));
}
const olderMonth = () => (S.meta && Array.isArray(S.meta.months) ? S.meta.months : []).filter(m => /^\d{4}-\d{2}$/.test(m) && !S.months[m]).sort().reverse()[0];

// Filter chips and the radar's area buttons are one control: choosing an area zooms the radar and filters the feed.
function setFilter(f) {
  if (AREAS[f]) { setQuad(f); return; }
  FEED.f = f;
  FEED.n = 12;
  if (S.quad) setQuad(null);
  else { P.body.scrollTop = 0; renderPanel(false); }
}

// A source mark: the story's own preview image when the scan stored one, otherwise a quiet monogram.
const MARKS = { 'Google DeepMind': 'GDM', 'Google Cloud': 'G', Microsoft: 'MS', McKinsey: 'McK', OpenAI: 'OAI', NVIDIA: 'NV', Anthropic: 'A', 'European Commission': 'EU', 'Stanford HAI': 'HAI', 'MIT Technology Review': 'TR', 'Harvard Business Review': 'HBR', 'Doppelgänger Tech Talk': 'DG' };
function monogram(name) {
  name = str(name).replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (MARKS[name]) return MARKS[name];
  const first = name.split(/[\s,:/]+/)[0] || '?';
  return /^[A-Z0-9]{2,4}$/.test(first) ? first : first.charAt(0).toUpperCase();
}
function mark(n) {
  const mono = h('span', { class: 'mark', 'aria-hidden': 'true', text: monogram(n.src.name) });
  const u = safeUrl(n.img);
  if (!u) return mono;
  const img = h('img', { class: 'mark', src: u, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => img.replaceWith(mono), { once: true });
  return img;
}

function feedCard(n, opts) {
  const t = S.byId.get(n.t) || S.byId.get(n.t2);
  if (!t) return null;
  const isNew = fresh(n), chip = !(opts && opts.chip === false);
  const card = h('article', { class: 'fc c-' + t.ring + (isNew ? ' new' : ''), 'data-id': n.id, 'data-t': t.id,
    onpointerenter: e => e.pointerType !== 'touch' && hover(t.id, 'panel'), onpointerleave: () => hover(null) },
    mark(n),
    h('div', { class: 'fc-b' },
      h('p', { class: 'fc-k' },
        isNew ? h('span', { class: 'pillnew', text: 'New' }) : null, hotPill(n),
        chip ? h('button', { class: 'link sm', type: 'button', onclick: () => openTrend(t.id) }, h('i', { class: 'tdot' }), t.short || t.title) : null),
      h('button', { class: 'fc-t', type: 'button', 'aria-expanded': 'false', onclick: () => toggleCard(card, n) }, n.title),
      n.take ? h('p', { class: 'fc-p', text: n.take }) : null,
      h('p', { class: 'fc-m', text: [str(n.src.name), when(n.at)].filter(Boolean).join(', ') })));
  return card;
}
// Quick view: key points and the two ways on (the source, or more on the trend) without leaving the feed.
function toggleCard(card, n) {
  const opening = !card.classList.contains('open');
  if (FEED.openEl && FEED.openEl !== card) closeCard(FEED.openEl);
  if (!opening) { closeCard(card); return; }
  const t = S.byId.get(n.t) || S.byId.get(n.t2), u = safeUrl(n.src.url), more = (S.byT.get(t.id) || []).filter(x => x.id !== n.id).length;
  const src = str(n.src.name).replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const pts = Array.isArray(n.points) ? n.points.filter(Boolean).slice(0, 3) : [];
  card.classList.add('open');
  $('.fc-t', card).setAttribute('aria-expanded', 'true');
  $('.fc-b', card).append(h('div', { class: 'fc-x' },
    pts.length ? h('ul', { class: 'pts' }, pts.map(p => h('li', { text: p }))) : null,
    h('div', { class: 'fc-a' },
      u ? h('a', { class: 'btn btn-w', href: u, target: '_blank', rel: 'noopener noreferrer' }, src && src.length <= 18 ? 'Read at ' + src : 'Read the source', ic('i-out')) : null,
      h('button', { class: 'btn', type: 'button', onclick: () => openTrend(t.id) }, more ? stories(more) + ' more on ' + (t.short || t.title) : (t.short || t.title), ic('i-chev')))));
  FEED.openEl = card;
  markSeen([n]);
}
function closeCard(card) {
  card.classList.remove('open');
  const x = $('.fc-x', card);
  if (x) x.remove();
  $('.fc-t', card).setAttribute('aria-expanded', 'false');
  if (FEED.openEl === card) FEED.openEl = null;
}

function feedLeft() { return feedList().filter(n => fresh(n) && n._new).length; }
function feedCount() { const el = $('.feed-left', P.body); if (el) el.textContent = feedLeft() ? feedLeft() + ' unread' : 'All read'; }

function pageFeed() {
  const list = feedList(), shown = list.slice(0, FEED.n), nFresh = list.filter(fresh).length;
  const out = [];
  // One row: play the one-minute briefing, then the filters. Keeps the first story above the fold on phones.
  out.push(h('div', { class: 'chips', role: 'toolbar', 'aria-label': 'Briefing and news filters' },
    h('button', { class: 'chip chip-play', type: 'button', 'aria-label': 'Play the one-minute news briefing', onclick: () => briefStart() }, ic('i-play'), 'Briefing'),
    FILTERS.map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(FEED.f === k), onclick: () => setFilter(k) }, l))));
  const cards = [];
  shown.forEach((n, i) => {
    if (i === 0) cards.push(nFresh
      ? h('h2', { class: 'feed-h' }, h('span', { text: 'New for you' }), h('span', { class: 'feed-left', 'aria-live': 'polite', text: feedLeft() ? feedLeft() + ' unread' : 'All read' }))
      : h('h2', { class: 'feed-h' }, h('span', { text: 'Latest' })));
    if (nFresh && i === nFresh) cards.push(h('div', { class: 'uptodate' }, ic('i-check'), h('span', { text: 'You are up to date' })));
    cards.push(feedCard(n));
  });
  const end = shown.length < list.length || olderMonth()
    ? h('div', { class: 'feed-more', id: 'feed-more' }, h('span', { class: 'skel' }), h('span', { class: 'skel short' }))
    : h('p', { class: 'muted feed-end', text: list.length ? 'That is everything in the archive.' : S.ok.news ? 'No stories match this filter.' : 'Loading…' });
  out.push(h('div', { class: 'feed' }, cards), end);
  requestAnimationFrame(feedObserve);
  return out;
}

// Observers: grow the feed near its end, cue the radar on the story at the top, and count a new story as seen
// once at least 60% of it has been on screen for 1.5 seconds.
function feedObserve() {
  [FEED.obs, FEED.more, FEED.dwell].forEach(o => o && o.disconnect());
  FEED.timers.forEach(clearTimeout);
  FEED.timers.clear();
  if (!(PHONE || WIDE) || cur().page !== 'home' || typeof IntersectionObserver !== 'function') return;
  const byId = new Map(S.news.map(n => [n.id, n]));
  FEED.obs = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting && FEED.cue !== e.target.dataset.t) { FEED.cue = e.target.dataset.t; if (!B.on) setCue(FEED.cue); }
  }, { root: P.body, rootMargin: '0px 0px -50% 0px' });
  FEED.dwell = new IntersectionObserver(entries => {
    for (const e of entries) {
      const id = e.target.dataset.id;
      if (e.isIntersecting && e.intersectionRatio >= .6) {
        if (!FEED.timers.has(id)) FEED.timers.set(id, setTimeout(() => { FEED.timers.delete(id); const n = byId.get(id); if (n && n._new) markSeen([n]); }, 1500));
      } else if (FEED.timers.has(id)) { clearTimeout(FEED.timers.get(id)); FEED.timers.delete(id); }
    }
  }, { root: P.body, threshold: [0, .6] });
  $$('.fc', P.body).forEach(c => { FEED.obs.observe(c); if (c.classList.contains('new')) FEED.dwell.observe(c); });
  const more = $('#feed-more', P.body);
  if (!more) return;
  FEED.more = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    FEED.more.disconnect();
    if (FEED.n < feedList().length) { FEED.n += 12; renderPanel(false); } else { const m = olderMonth(); if (m) loadMonth(m); }
  }, { root: P.body, rootMargin: '400px 0px' });
  FEED.more.observe(more);
}

// Keyboard: j and k move story by story, Enter opens the quick view (the focused headline is a button).
function feedStep(d) {
  const cards = $$('.fc', P.body);
  if (!cards.length) return;
  const at = document.activeElement && document.activeElement.closest && document.activeElement.closest('.fc');
  let i = at ? cards.indexOf(at) : -1;
  if (i < 0) { const top = P.body.getBoundingClientRect().top; i = cards.findIndex(c => c.getBoundingClientRect().bottom > top + 8) - (d > 0 ? 1 : 0); }
  const next = cards[clamp(i + d, 0, cards.length - 1)];
  $('.fc-t', next).focus({ preventScroll: true });
  next.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' });
}

// The next trend to read: the next one in radar order with unread news, else simply the next one.
function nextTrend(t) {
  const L = S.trends, i = L.indexOf(t);
  for (let k = 1; k < L.length; k++) { const c = L[(i + k) % L.length]; if (D.newBy.get(c.id)) return { t: c, news: true }; }
  return { t: L[(i + 1) % L.length], news: false };
}
