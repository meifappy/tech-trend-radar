/* Panel navigation stack (home, trend, news, list, search, about, briefing) and shared panel parts. */
const P = { el: $('#panel'), body: $('#p-body'), head: $('#p-head'), q: $('#q'), stack: [{ page: 'home' }] };
P.body.addEventListener('scroll', () => { P.scrolled = true; }, { passive: true });
const cur = () => P.stack[P.stack.length - 1];
const DET = { home: 'mid', trend: 'mid', news: 'full', about: 'full', search: 'full', brief: 'mid', list: 'full' };
function nav(page, arg, mode) {
  const top = cur();
  if (top.page === 'home' && page !== 'home') P.from = document.activeElement;
  if (page === 'home') P.stack = [{ page: 'home' }];
  else if (mode === 'replace' || (top.page === page && page !== 'trend')) P.stack[P.stack.length - 1] = { page, arg };
  else if (!(top.page === page && top.arg === arg)) P.stack.push({ page, arg });
  if (P.stack.length > 12) P.stack.splice(1, P.stack.length - 12);
  afterNav();
}
function back() {
  if (cur().page === 'brief') { briefStop(); return; }
  if (P.stack.length > 1) P.stack.pop();
  afterNav();
}
function afterNav() {
  const c = cur();
  if (B.on && c.page !== 'brief') briefStop(true);
  S.sel = c.page === 'trend' ? c.arg : null;
  if (c.page === 'home' && P.q.value) { P.q.value = ''; S.q = ''; }
  // Wide screens and phones always show the panel: a news column on desktop, the news feed sheet on phones.
  const open = c.page !== 'home' || WIDE || PHONE;
  const wasIn = P.el.contains(document.activeElement);
  $('#app').classList.toggle('open', open);
  $('#app').classList.toggle('wide', WIDE);
  $('#app').classList.toggle('phone', PHONE);
  P.el.toggleAttribute('inert', !open);
  $('#dock').inert = WIDE || PHONE;
  if (wasIn && !open) { const n = S.sel && RD.nodes.get(S.sel); const f = P.from && P.from.isConnected ? P.from : n ? n.el : $('#t-news'); f.focus({ preventScroll: true }); }
  renderPanel(true);
  paintRadar();
  syncHash();
  if (PHONE) setCue(c.page === 'home' ? FEED.cue : null);
  else if (WIDE) setCue(null); // wide screens have no news bar, so nothing to cue
  else if (RD.dockDone) { setCue(c.page === 'home' ? RD.dockT : null); apArm(); } else renderDock();
  if (PHONE && open) sheetTo(DET[c.page] || 'mid');
  if (c.page === 'search') setTimeout(() => P.q.focus(), 60);
  if (c.page === 'trend') scheduleMark(c.arg);
}
function openTrend(id, focusPanel) {
  if (!S.byId.has(id)) return;
  if (B.on) briefStop(true);
  nav('trend', id, cur().page === 'trend' ? 'replace' : null);
  if (focusPanel !== false && !PHONE) requestAnimationFrame(() => setTimeout(() => { const t = $('#p-title'); if (t && cur().page === 'trend') t.focus({ preventScroll: true }); }));
}
function step(d) {
  const c = cur();
  if (c.page !== 'trend' || !S.trends.length) return;
  const i = S.trends.findIndex(t => t.id === c.arg), nx = S.trends[(i + d + S.trends.length) % S.trends.length];
  if (nx) nav('trend', nx.id, 'replace');
}
function renderPanel(anim) {
  const c = cur(), body = P.body;
  if (RD.hotSrc === 'panel') hover(null);
  P.el.dataset.page = c.page;
  const keep = anim ? 0 : body.scrollTop;
  const open = anim ? null : new Set($$('details[open][data-k]', body).map(d => d.dataset.k));
  let kids;
  switch (c.page) {
    case 'trend': kids = pageTrend(c.arg); break;
    case 'news': kids = pageNews(); break;
    case 'about': kids = pageAbout(); break;
    case 'list': kids = pageList(); break;
    case 'search': kids = pageSearch(); break;
    case 'brief': kids = pageBrief(); break;
    default: kids = WIDE ? pageHome() : PHONE ? pageFeed() : [];
  }
  renderHead(c);
  put(body, kids);
  if (open) $$('details[data-k]', body).forEach(d => { if (open.has(d.dataset.k)) d.open = true; });
  if (keep) body.scrollTop = keep; else if (anim && P.scrolled) body.scrollTop = 0;
  P.scrolled = false;
  // Restart the entrance animation without forcing a synchronous layout.
  body.classList.remove('enter');
  if (anim && !RM) requestAnimationFrame(() => body.classList.add('enter'));
}
function renderHead(c) {
  if (c.page === 'home') { P.head.hidden = true; return; }
  P.head.hidden = false;
  const t = c.page === 'trend' ? S.byId.get(c.arg) : null;
  const title = c.page === 'trend' ? (t ? t.short || t.title : '') : { news: 'News', about: 'How it works', search: 'Search', brief: 'News briefing', list: 'All trends' }[c.page] || '';
  const kids = [
    h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Back', onclick: back }, ic('i-back')),
    h('span', { class: 'ht' + (c.page === 'trend' ? ' collapse' : ''), text: title })
  ];
  kids.push(h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close', onclick: () => (c.page === 'brief' ? briefStop() : nav('home')) }, ic('i-close')));
  put(P.head, ...kids);
}
function section(title, aside, ...content) {
  return h('section', { class: 'sec' }, h('h2', null, h('span', { text: title }), aside ? h('span', { text: aside }) : null), content);
}
function trendRow(t, sub) {
  const c = D.newBy.get(t.id) || 0, mv = D.moved.get(t.id);
  return h('button', { class: 'trow c-' + t.ring, type: 'button', onclick: () => openTrend(t.id), onpointerenter: e => e.pointerType !== 'touch' && hover(t.id, 'panel'), onpointerleave: () => hover(null) },
    h('i', { class: 'tdot' }),
    h('span', { class: 'tt' }, h('b', { text: t.title }), sub ? h('small', { text: sub }) : null),
    c ? h('span', { class: 'pillnew', text: c + ' new' }) : mv ? h('span', { class: 'pillmove', text: 'Moved' }) : ic('i-chev', 'chev'));
}
function linkOut(url, text) {
  const u = safeUrl(url);
  return u ? h('a', { class: 'out', href: u, target: '_blank', rel: 'noopener noreferrer' }, h('span', { text }), ic('i-out')) : h('span', { text });
}
function fold(k, title, count, ...content) {
  return h('details', { class: 'fold', 'data-k': k },
    h('summary', null, h('span', { text: title }), count ? h('small', { text: String(count) }) : null, ic('i-chev', 'chev')),
    h('div', { class: 'fold-in' }, content));
}
