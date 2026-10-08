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
(() => {
  let d = null;
  const start = e => {
    if (!PHONE || (e.button != null && e.button > 0)) return;
    if (e.target.closest('input, a, button') && !e.target.closest('.grab')) return;
    d = { y: e.clientY, h: SH.h, t: performance.now(), id: e.pointerId, moved: false };
    P.el.classList.add('drag');
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
  };
  const move = e => {
    if (!d || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 4) d.moved = true;
    sheetTo(null, clamp(d.h - dy, 140, innerHeight - 54));
  };
  const end = e => {
    if (!d || e.pointerId !== d.id) return;
    P.el.classList.remove('drag');
    const dy = e.clientY - d.y, v = dy / Math.max(1, performance.now() - d.t), wasMoved = d.moved, startDet = SH.det;
    d = null;
    const names = ['peek', 'mid', 'full'];
    if (!wasMoved) { sheetTo(startDet === 'full' ? 'mid' : 'full'); return; }
    let best = names.reduce((a, b) => (Math.abs(detPx(b) - SH.h) < Math.abs(detPx(a) - SH.h) ? b : a));
    if (Math.abs(v) > .55) { const i = names.indexOf(startDet); best = names[clamp(i + (v < 0 ? 1 : -1), 0, 2)]; }
    sheetTo(best);
  };
  [$('#grab'), $('#p-top')].forEach(el => {
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });
})();
