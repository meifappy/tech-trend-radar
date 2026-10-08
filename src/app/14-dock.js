/* The floating news bar on the radar (hidden on wide screens), its autoplay and swipe gestures. */
let dockI = 0;
// Headline stories only (no routine items), and never two stories from the same trend in a row.
function vary(list) {
  const by = new Map(), out = [];
  for (const n of list) { if (!by.has(n.t)) by.set(n.t, []); by.get(n.t).push(n); }
  const qs = [...by.values()];
  while (qs.some(q => q.length)) for (const q of qs) if (q.length) out.push(q.shift());
  return out;
}
function dockList() {
  const ok = S.news.filter(n => S.byId.has(n.t) && !n.minor);
  const fresh = ok.filter(n => n._new), rest = ok.filter(n => !n._new);
  return vary(fresh).concat(vary(rest.slice(0, 12))).slice(0, Math.max(8, fresh.length));
}
const dockRows = () => PHONE ? clamp(Math.floor((RD.stage.clientHeight - RD.W - 165) / 48), 0, 4) : 0;
// The cue marks the trend of the story in view (news bar or feed); its name is shown even when names are thinned out.
function setCue(id) {
  if (RD.cue === id) return;
  RD.cue = id;
  for (const n of RD.nodes.values()) n.el.classList.toggle('cue', n.id === id);
  RD.sig = '';
  if (!RD.raf) paintRadar(); else fxRings();
}
// The dock moves on to the next story every 12 seconds while motion is on; hovering or focusing it holds the story.
const AP = { ms: 12000, t: 0, hold: false };
function apArm() {
  clearTimeout(AP.t);
  const el = $('#dock'), run = !WIDE && !PHONE && moving() && !AP.hold && cur().page === 'home' && !B.on && dockList().length > 1;
  el.classList.toggle('auto', run);
  if (run) AP.t = setTimeout(() => { if (RD.hot || RD.raf) { renderDock('quiet'); return; } dockGo(1, 'auto'); }, AP.ms);
}
function dockGo(d, mode) { const l = dockList(); if (!l.length) return; dockI = (dockI + d + l.length) % l.length; RD.dockId = l[dockI].id; renderDock(mode || (d < 0 ? 'back' : 'fwd')); }
function renderDock(mode) {
  const el = $('#dock');
  el.setAttribute('aria-live', mode === 'fwd' || mode === 'back' ? 'polite' : 'off');
  if (AP.busy || PHONE || WIDE) return;
  if (!S.ok.trends || !S.ok.news || !S.ok.me) { put(el, h('p', { class: 'dk-meta', text: S.problem || 'Loading…' })); return; }
  const list = dockList(), fresh = list.filter(n => n._new).length;
  if (!list.length) { put(el, h('p', { class: 'dk-meta', text: 'No news yet. The radar scans every 12 hours.' })); return; }
  const at = RD.dockId ? list.findIndex(x => x.id === RD.dockId) : -1;
  dockI = at >= 0 ? at : clamp(dockI, 0, list.length - 1);
  const n = list[dockI], t = S.byId.get(n.t);
  RD.dockId = n.id;
  RD.dockT = n.t; RD.dockDone = true;
  setCue(cur().page === 'home' ? n.t : null);
  const kick = n._new ? 'New for you, ' + (dockI + 1) + ' of ' + fresh : 'Latest';
  const open = m => { if (el.dataset.swiped) return; S.open.add(m.id); openTrend(m.t); if (m._new) markNews([m]); };
  const body = h('button', { class: 'dk-body c-' + t.ring, type: 'button', onclick: () => open(n) },
    h('span', { class: 'dk-kick' + (n._new ? ' isnew' : '') }, h('i'), kick, hotPill(n)),
    h('span', { class: 'dk-title', text: n.title }),
    h('span', { class: 'dk-meta', text: [t.short || t.title, str(n.src.name), when(n.at)].filter(Boolean).join(', ') }),
    h('span', { class: 'dk-prog', 'aria-hidden': 'true' }));
  // On tall phones the space under the radar lists what comes next, so the latest news is visible without a tap.
  const kids = [], k = Math.min(dockRows(), list.length - 1);
  RD.dockK = dockRows();
  if (k > 0) kids.push(h('div', { class: 'dk-next' }, Array.from({ length: k }, (_, j) => {
    const m = list[(dockI + 1 + j) % list.length], mt = S.byId.get(m.t);
    return h('button', { class: 'dk-row c-' + mt.ring, type: 'button', onclick: () => open(m) },
      h('i'), h('span', { class: 'dk-rt', text: m.title }), h('span', { class: 'dk-rm', text: when(m.at) }));
  })));
  el.classList.toggle('stack', k > 0);
  const fa = document.activeElement, keep = fa && el.contains(fa) ? fa.getAttribute('aria-label') || '' : null;
  AP.busy = true;
  put(el, body, h('div', { class: 'dk-ctl' },
    h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Previous news', disabled: list.length < 2, onclick: () => dockGo(-1) }, ic('i-back')),
    h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Next news', disabled: list.length < 2, onclick: () => dockGo(1) }, ic('i-chev')),
    h('button', { class: 'primary', type: 'button', 'aria-label': 'Play the news briefing', onclick: () => briefStart() }, ic('i-play'))), ...kids);
  if (keep != null) { const f = keep ? $$('[aria-label]', el).find(x => x.getAttribute('aria-label') === keep) : body; (f || body).focus({ preventScroll: true }); }
  AP.busy = false;
  if (!RM && mode !== 'quiet') {
    const dx = mode === 'back' ? -14 : mode ? 14 : 0;
    const kf = [{ opacity: 0, transform: 'translate(' + dx + 'px,' + (dx ? 0 : 4) + 'px)' }, { opacity: 1, transform: 'none' }];
    body.animate(kf, { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
    $$('.dk-row', el).forEach((r, i) => r.animate(kf, { duration: 240, delay: 30 + i * 30, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  }
  apArm();
}
(() => {
  const el = $('#dock'), hold = on => { if (AP.busy || AP.hold === on) return; AP.hold = on; el.classList.toggle('hold', on); if (!on) renderDock('quiet'); else apArm(); };
  el.addEventListener('pointerenter', e => e.pointerType !== 'touch' && hold(true));
  el.addEventListener('pointerleave', e => e.pointerType !== 'touch' && hold(false));
  el.addEventListener('focusin', () => hold(true));
  el.addEventListener('focusout', e => { if (!el.contains(e.relatedTarget)) hold(false); });
})();
// Swipe (finger or mouse drag) to move through the news bar and the briefing; a swipe never counts as a click.
function swipe(el, target, fn) {
  let st = null;
  el.addEventListener('pointerdown', e => { if ((e.button != null && e.button > 0) || e.target.closest('.dk-ctl, .bctl, .bseg, a')) return; st = { x: e.clientX, y: e.clientY, id: e.pointerId, dx: 0, h: false }; });
  el.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    st.dx = e.clientX - st.x;
    if (!st.h && Math.abs(st.dx) > 10 && Math.abs(st.dx) > Math.abs(e.clientY - st.y) * 1.5) st.h = true;
    const t = st.h && el.querySelector(target);
    if (t) t.style.transform = 'translateX(' + (st.dx * .35).toFixed(1) + 'px)';
  });
  const end = e => {
    if (!st || e.pointerId !== st.id) return;
    const t = el.querySelector(target), go = st.h && Math.abs(st.dx) > 40, d = st.dx < 0 ? 1 : -1;
    if (t) t.style.transform = '';
    if (st.h) { el.dataset.swiped = '1'; setTimeout(() => { delete el.dataset.swiped; }, 350); }
    st = null;
    if (go) fn(d);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('click', e => { if (el.dataset.swiped) { e.stopPropagation(); e.preventDefault(); } }, true);
}
swipe($('#dock'), '.dk-body', d => dockGo(d));
swipe(P.body, '.bslide', d => { if (B.on && cur().page === 'brief') showSlide(B.i + d); });
$('#t-search').addEventListener('click', () => focusSearch());
$('#t-news').addEventListener('click', () => nav('news'));
$('#t-info').addEventListener('click', () => nav('about'));
$('#t-list').addEventListener('click', () => nav('list'));
$('#skip').addEventListener('click', e => { e.preventDefault(); nav('list'); setTimeout(() => { const r = $('.trow', P.body); if (r) r.focus(); }, 80); });
$('#t-motion').addEventListener('click', () => setMotion(!MO.on));
