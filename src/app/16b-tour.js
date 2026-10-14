/* First-visit tour: an optional 15-second walk-through. On the first visit a small card offers it; the tour then
   spotlights one thing at a time with an arrow and one line of text, moving on by itself every 2.3 seconds.
   Tap anywhere for the next step; Esc, the close button or "Skip" ends it. It can be replayed from How it works. */
const TOUR = { i: 0, t: 0, el: null, steps: [] };
const tourSteps = () => [
  { sel: '#rbox', text: 'The radar. The closer to the centre, the sooner you should act.' },
  { sel: '.blip.has-new .dot, .blip .dot', text: 'An orange dot has news you have not opened. Tap a dot for the trend.' },
  { sel: '.fc', text: 'The latest stories. Tap one for the key points and the source.' },
  { sel: '.chip-play', text: 'Briefing plays the news in one minute, stop by stop on the radar.' },
  { sel: '.chip-focus', text: 'Focus: add your industry or priorities, and everything filters to them.' },
  { sel: '#t-info', text: 'Everything else, and this tour again, is under How it works.' }
];
function tourOffer() {
  if (ls.get('tour', null) || !S.trends.length) return;
  ls.set('tour', 'offered');
  autoCancel();
  const card = h('div', { class: 'tour-offer', role: 'dialog', 'aria-label': 'Quick tour' },
    h('span', { class: 'tour-ico', 'aria-hidden': 'true' }, ic('i-play')),
    h('p', null, h('b', { text: 'New here?' }), h('span', { text: 'See how it works in 15 seconds.' })),
    h('button', { class: 'tour-go', type: 'button', onclick: () => { card.remove(); tourStart(); } }, 'Start tour'),
    h('button', { class: 'tour-no', type: 'button', 'aria-label': 'No thanks', onclick: () => card.remove() }, ic('i-close')));
  document.body.append(card);
}
function tourStart() {
  tourEnd();
  autoCancel();
  if (B.on) briefStop(true);
  if (PHONE && typeof sheetTo === 'function') sheetTo(SH.det);
  TOUR.steps = tourSteps();
  TOUR.i = -1;
  const spot = h('div', { class: 'tour-spot' }), tip = h('div', { class: 'tour-tip', role: 'status', 'aria-live': 'polite' }),
    bar = h('div', { class: 'tour-bar' }, TOUR.steps.map(() => h('i')));
  TOUR.el = h('div', { class: 'tour', onclick: e => { if (!e.target.closest('.tour-x')) tourNext(); } }, spot, tip, bar,
    h('button', { class: 'tour-x', type: 'button', 'aria-label': 'End the tour', onclick: tourEnd }, 'Skip'));
  document.body.append(TOUR.el);
  document.addEventListener('keydown', tourKey, true);
  addEventListener('resize', tourPlace);
  tourNext();
}
function tourKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); tourEnd(); }
  else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); tourNext(); }
}
function tourNext() {
  clearTimeout(TOUR.t);
  // Skip a step whose target is not on screen (for example the briefing chip while the sheet is low on a phone).
  do TOUR.i++; while (TOUR.i < TOUR.steps.length && !tourTarget(TOUR.steps[TOUR.i]));
  if (TOUR.i >= TOUR.steps.length) { tourEnd(); toast('That is it. Enjoy the radar.'); return; }
  const [spot, tip, bar] = TOUR.el.children;
  put(tip, h('small', { text: (TOUR.i + 1) + ' of ' + TOUR.steps.length }), h('span', { text: TOUR.steps[TOUR.i].text }));
  [...bar.children].forEach((x, i) => x.classList.toggle('on', i <= TOUR.i));
  tourPlace();
  TOUR.t = setTimeout(tourNext, 2300);
  void spot;
}
function tourTarget(st) {
  const el = $$(st.sel).find(x => { const r = x.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; });
  return el || null;
}
function tourPlace() {
  if (!TOUR.el || TOUR.i < 0) return;
  const el = tourTarget(TOUR.steps[TOUR.i]);
  if (!el) return;
  const [spot, tip] = TOUR.el.children, r = el.getBoundingClientRect(), pad = el.matches('.dot') ? 14 : 8;
  const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(innerWidth - 8, r.width + pad * 2), hh = Math.min(innerHeight - 8, r.height + pad * 2);
  Object.assign(spot.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px', borderRadius: el.matches('.dot, #rbox') ? '50%' : '16px' });
  // The text sits below the spotlight when there is room, else above (or inside for a big target like the radar).
  const tw = Math.min(320, innerWidth - 32), below = y + hh + 14, above = y - 14;
  let top, dir;
  if (hh > innerHeight * .6) { top = y + hh / 2 - 40; dir = 'none'; }
  else if (below + 110 < innerHeight) { top = below; dir = 'up'; }
  else { top = above - 100; dir = 'down'; }
  const left = clamp(x + w / 2 - tw / 2, 16, innerWidth - tw - 16);
  tip.dataset.dir = dir;
  tip.style.setProperty('--ax', clamp(x + w / 2 - left, 18, tw - 18) + 'px');
  Object.assign(tip.style, { left: left + 'px', top: Math.max(12, top) + 'px', width: tw + 'px' });
}
function tourEnd() {
  clearTimeout(TOUR.t);
  if (TOUR.el) TOUR.el.remove();
  TOUR.el = null;
  ls.set('tour', 'done');
  document.removeEventListener('keydown', tourKey, true);
  removeEventListener('resize', tourPlace);
}
