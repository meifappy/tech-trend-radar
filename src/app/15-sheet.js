/* Phone bottom sheet with three detents (peek, mid, full) and drag handling. */
const SH = { det: 'mid', h: 0 };
function detPx(name) {
  const full = innerHeight - 54, top = RD.box.getBoundingClientRect().bottom + 6;
  const mid = clamp(innerHeight - top, 180, full), peek = Math.min(mid, 300);
  return name === 'full' ? full : name === 'peek' ? peek : mid;
}
function sheetTo(name, px) {
  if (!PHONE) return;
  if (name) SH.det = name;
  const hgt = px != null ? px : detPx(SH.det);
  SH.h = hgt;
  P.el.style.setProperty('--sh', hgt + 'px');
  P.el.style.setProperty('--shpad', Math.max(0, innerHeight - 54 - hgt) + 'px');
}
// Drag the grabber or the header to resize; pull the content down when it is scrolled to the top (as on iOS);
// swipe up on the content to grow it; pull below the lowest detent or flick down from it to close. Only a tap on the grabber toggles mid/full.
(() => {
  const NAMES = ['peek', 'mid', 'full'];
  let d = null;
  const begin = (y, id) => { d = { y, h: SH.h, t: performance.now(), id, moved: false }; P.el.classList.add('drag'); };
  const drag = y => {
    const dy = y - d.y;
    if (Math.abs(dy) > 4) d.moved = true;
    sheetTo(null, clamp(d.h - dy, 60, innerHeight - 54));
  };
  const finish = (y, tap) => {
    P.el.classList.remove('drag');
    const v = (y - d.y) / Math.max(1, performance.now() - d.t), startDet = SH.det, moved = d.moved;
    d = null;
    if (!moved) { sheetTo(tap ? (startDet === 'full' ? 'mid' : 'full') : startDet); return; }
    if (SH.h < detPx('peek') - 70 || (startDet === 'peek' && v > .55)) { SH.det = 'mid'; nav('home'); return; }
    let best = NAMES.reduce((a, b) => (Math.abs(detPx(b) - SH.h) < Math.abs(detPx(a) - SH.h) ? b : a));
    if (Math.abs(v) > .55) best = NAMES[clamp(NAMES.indexOf(startDet) + (v < 0 ? 1 : -1), 0, 2)];
    sheetTo(best);
  };
  const handle = (el, tapToggles) => {
    el.addEventListener('pointerdown', e => {
      if (!PHONE || (e.button != null && e.button > 0) || e.target.closest('input, a, button')) return;
      begin(e.clientY, e.pointerId);
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
    });
    el.addEventListener('pointermove', e => { if (d && e.pointerId === d.id) drag(e.clientY); });
    const end = e => { if (d && e.pointerId === d.id) finish(e.clientY, tapToggles); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };
  handle($('#grab'), true);
  handle($('#p-head'), false);
  handle($('#p-top'), false);
  // Content pull-down uses touch events, because the page must cancel the native scroll once the sheet moves.
  let t0 = null;
  P.body.addEventListener('touchstart', e => {
    t0 = PHONE && e.touches.length === 1 && P.body.scrollTop <= 0 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  P.body.addEventListener('touchmove', e => {
    if (!t0) return;
    const p = e.touches[0], dx = p.clientX - t0.x, dy = p.clientY - t0.y;
    if (!d) {
      // Down: pull the sheet (or close it). Up: grow the sheet first while it is not full, then scroll.
      if (Math.abs(dx) > Math.abs(dy)) { if (Math.abs(dx) > 10) t0 = null; return; }
      if (!(dy > 8 || (dy < -8 && SH.det !== 'full'))) { if (Math.abs(dy) > 8) t0 = null; return; }
      begin(t0.y, 'touch');
    }
    e.preventDefault();
    drag(p.clientY);
  }, { passive: false });
  const tend = e => { if (d && d.id === 'touch') finish(e.changedTouches[0].clientY, false); t0 = null; };
  P.body.addEventListener('touchend', tend);
  P.body.addEventListener('touchcancel', tend);
})();
