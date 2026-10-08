/* Phone home: an endless feed of story cards under the radar. New stories first (hot ones on top), then everything
   recent, then older months from the archive as you keep scrolling. The card at the top of the view lights up its
   trend on the radar, so the radar stays the entry point while you read. */
const FEED = { n: 12, cue: null, obs: null, more: null };

function feedList() {
  const ok = S.news.filter(n => S.byId.has(n.t) && !n.minor);
  const hotFirst = l => l.filter(isHot).concat(l.filter(n => !isHot(n)));
  return hotFirst(ok.filter(n => n._new)).concat(ok.filter(n => !n._new));
}
const olderMonth = () => (S.meta && Array.isArray(S.meta.months) ? S.meta.months : []).filter(m => /^\d{4}-\d{2}$/.test(m) && !S.months[m]).sort().reverse()[0];

// A source mark: the story's own image when the scan stored one, otherwise a quiet monogram of the publisher.
const MARKS = { 'Google DeepMind': 'GDM', 'Google Cloud': 'G', Microsoft: 'MS', McKinsey: 'McK', OpenAI: 'OAI', NVIDIA: 'NV', Anthropic: 'A', 'European Commission': 'EU', 'Stanford HAI': 'HAI', 'MIT Technology Review': 'TR', 'Harvard Business Review': 'HBR', 'Doppelgänger Tech Talk': 'DG' };
function monogram(name) {
  name = str(name).replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (MARKS[name]) return MARKS[name];
  const first = name.split(/[\s,:/]+/)[0] || '?';
  if (/^[A-Z0-9]{2,4}$/.test(first)) return first;
  return first.charAt(0).toUpperCase();
}
function mark(n) {
  const mono = h('span', { class: 'mark', 'aria-hidden': 'true', text: monogram(n.src.name) });
  const u = safeUrl(n.img);
  if (!u) return mono;
  const img = h('img', { class: 'mark', src: u, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => img.replaceWith(mono), { once: true });
  return img;
}

function feedCard(n) {
  const t = S.byId.get(n.t), u = safeUrl(n.src.url);
  const seen = () => { if (n._new) markNews([n]); };
  return h('article', { class: 'fc c-' + t.ring + (n._new ? ' new' : ''), 'data-t': t.id },
    mark(n),
    h('div', { class: 'fc-b' },
      h('p', { class: 'fc-k' },
        n._new ? h('span', { class: 'pillnew', text: 'New' }) : null, hotPill(n),
        h('button', { class: 'link sm', type: 'button', onclick: () => openTrend(t.id) }, h('i', { class: 'tdot' }), t.short || t.title)),
      u ? h('a', { class: 'fc-t', href: u, target: '_blank', rel: 'noopener noreferrer', onclick: seen }, h('span', { text: n.title }), ic('i-out'))
        : h('p', { class: 'fc-t', text: n.title }),
      n.take ? h('p', { class: 'fc-p', text: n.take }) : null,
      h('p', { class: 'fc-m', text: [str(n.src.name), when(n.at)].filter(Boolean).join(', ') })));
}

function pageFeed() {
  const list = feedList(), shown = list.slice(0, FEED.n), fresh = list.filter(n => n._new).length;
  const cards = [];
  shown.forEach((n, i) => {
    if (i === 0) cards.push(h('h2', { class: 'feed-h', text: fresh ? plural(fresh, 'new story').replace('storys', 'stories') + ' for you' : 'Latest' }));
    if (fresh && i === fresh) cards.push(h('h2', { class: 'feed-h', text: 'Earlier' }));
    cards.push(feedCard(n));
  });
  const end = shown.length < list.length || olderMonth()
    ? h('div', { class: 'feed-more', id: 'feed-more' }, h('span', { class: 'skel' }))
    : h('p', { class: 'muted feed-end', text: list.length ? 'That is everything in the archive.' : S.ok.news ? 'No news yet. The radar scans every 12 hours.' : 'Loading…' });
  requestAnimationFrame(feedObserve);
  return [
    h('button', { class: 'brief-row', type: 'button', onclick: () => briefStart() },
      h('span', { class: 'primary', 'aria-hidden': 'true' }, ic('i-play')),
      h('span', null, h('b', { text: 'Play the news briefing' }), h('small', { text: 'One minute, trend by trend' }))),
    h('div', { class: 'feed' }, cards), end];
}

// Grow the feed when its end comes into view, and cue the radar on the card nearest the top.
function feedObserve() {
  if (FEED.obs) FEED.obs.disconnect();
  if (FEED.more) FEED.more.disconnect();
  if (!PHONE || cur().page !== 'home' || typeof IntersectionObserver !== 'function') return;
  FEED.obs = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting && e.target.dataset.t && FEED.cue !== e.target.dataset.t) { FEED.cue = e.target.dataset.t; setCue(FEED.cue); }
  }, { root: P.body, rootMargin: '0px 0px -65% 0px' });
  $$('.fc', P.body).forEach(c => FEED.obs.observe(c));
  const more = $('#feed-more', P.body);
  if (!more) return;
  FEED.more = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    FEED.more.disconnect();
    if (FEED.n < feedList().length) { FEED.n += 12; renderPanel(false); } else { const m = olderMonth(); if (m) loadMonth(m); }
  }, { root: P.body, rootMargin: '400px 0px' });
  FEED.more.observe(more);
}
