/* Radar input: hover tooltip, zoom and pan (wheel, drag, pinch, buttons) and arrow-key navigation. */
/* hover, tooltip, keyboard on the radar */
const tip = $('#tip');
function tipShow(n) {
  if (PHONE || !n || !n.t) return;
  const t = n.t, c = D.newBy.get(n.id) || 0, rc = D.recent.get(n.id);
  tip.className = 'tip c-' + t.ring;
  put(tip, 
    h('span', { class: 'k' }, h('i'), RINGS[t.ring].label + ', ' + AREAS[t.area].label),
    h('b', { text: t.title }),
    rc ? h('span', { class: 'tmove', text: (rc.up ? 'More urgent' : 'Less urgent') + ': moved from ' + RINGS[rc.x.from].label + ', ' + when(str(rc.x.at).slice(0, 10)) }) : null,
    c ? h('span', { class: 'pillnew', text: c + ' new' }) : null);
  const r = RD.box.getBoundingClientRect(), x = r.left + n.sx, y = r.top + n.sy;
  tip.classList.add('on');
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = x + 22;
  if (left + tw > innerWidth - 12) left = x - 22 - tw;
  tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(clamp(y - th / 2, 12, innerHeight - th - 12)) + 'px)';
}
function tipHide() { tip.classList.remove('on'); }
function hover(id, src) {
  if (RD.hot === id) return;
  RD.hot = id;
  RD.hotSrc = id ? src || 'radar' : null;
  RD.box.classList.toggle('hovering', !!id && !RD.raf);
  for (const n of RD.nodes.values()) { const on = n.id === id; n.el.classList.toggle('hot', on); n.lbl.classList.toggle('hot', on); }
  if (id && !RD.raf) tipShow(RD.nodes.get(id)); else tipHide();
}
RD.gN.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const b = e.target.closest('.blip'); if (b) hover(b.dataset.id); });
RD.gN.addEventListener('pointerout', e => { const b = e.target.closest('.blip'); if (b && !b.contains(e.relatedTarget)) hover(null); });
RD.gN.addEventListener('click', e => { if (RD.dragged) return; const b = e.target.closest('.blip'); if (b) openTrend(b.dataset.id); });

/* manual zoom and pan: wheel or trackpad pinch, drag, two-finger pinch, double-click, + and - keys or buttons */
const KMAX = 4;
function clampCam(c) { const k = clamp(c.k, 1, KMAX), lim = Math.max(0, 1 - 1 / k) * 1.1; return { k, x: clamp(c.x, -lim, lim), y: clamp(c.y, -lim, lim) }; }
function zoomUi() {
  const k = RD.cam.k;
  $('#allbtn').hidden = k <= 1.01;
  $('#z-in').disabled = k >= KMAX - .01;
  $('#z-out').disabled = k <= 1.01;
}
function camSet(c) {
  cancelAnimationFrame(RD.raf); RD.raf = 0;
  if (S.quad) { S.quad = null; $$('.quad').forEach(b => b.setAttribute('aria-pressed', 'false')); }
  RD.cam = clampCam(c);
  RD.drag = true;
  RD.box.classList.add('moving');
  hover(null);
  place();
  RD.box.classList.toggle('zoomed', RD.cam.k > 1.01);
  clearTimeout(RD.settleT);
  RD.settleT = setTimeout(() => { RD.drag = false; RD.box.classList.remove('moving'); RD.sig = ''; fxRings(); placeLabels(); zoomUi(); }, 160);
}
function zoomAt(px, py, f) {
  const c = RD.cam, kk = c.k * RD.R0, wx = c.x + (px - RD.W / 2) / kk, wy = c.y + (py - RD.W / 2) / kk;
  const k2 = clamp(c.k * f, 1, KMAX), k2p = k2 * RD.R0;
  camSet({ k: k2, x: wx - (px - RD.W / 2) / k2p, y: wy - (py - RD.W / 2) / k2p });
}
const local = e => { const r = RD.box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
RD.box.addEventListener('wheel', e => {
  if (e.target.closest('.zoomui')) return;
  e.preventDefault();
  const [x, y] = local(e);
  zoomAt(x, y, Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018)));
}, { passive: false });
(() => {
  const pts = new Map();
  let st = null;
  RD.box.addEventListener('pointerdown', e => {
    if (e.target.closest('button, .quad, .zoomui') || (e.button != null && e.button > 0)) return;
    pts.set(e.pointerId, local(e));
    st = { moved: false };
    RD.dragged = false;
  });
  RD.box.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId), p = local(e);
    if (pts.size === 1) {
      const dx = p[0] - prev[0], dy = p[1] - prev[1];
      if (!st.moved && Math.hypot(dx, dy) < 5) return;
      if (RD.cam.k <= 1.01) return;
      if (!st.moved) { st.moved = true; try { RD.box.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } }
      const kk = RD.cam.k * RD.R0;
      camSet({ k: RD.cam.k, x: RD.cam.x - dx / kk, y: RD.cam.y - dy / kk });
      pts.set(e.pointerId, p);
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()], other = [...pts.entries()].find(([id]) => id !== e.pointerId)[1];
      const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]) || 1, d1 = Math.hypot(p[0] - other[0], p[1] - other[1]) || 1;
      st.moved = true;
      pts.set(e.pointerId, p);
      zoomAt((p[0] + other[0]) / 2, (p[1] + other[1]) / 2, d1 / d0);
      void a; void b;
    }
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (st && st.moved) { RD.dragged = true; setTimeout(() => { RD.dragged = false; }, 60); }
  };
  RD.box.addEventListener('pointerup', end);
  RD.box.addEventListener('pointercancel', end);
  RD.box.addEventListener('dblclick', e => {
    if (e.target.closest('button, .quad, .zoomui, .blip')) return;
    const [x, y] = local(e);
    if (RD.cam.k >= KMAX - .01) camTo(0, 0, 1, 450); else zoomAt(x, y, 1.8);
  });
})();
$('#z-in').addEventListener('click', () => zoomAt(RD.W / 2, RD.W / 2, 1.6));
$('#z-out').addEventListener('click', () => { if (RD.cam.k / 1.6 <= 1.05) setQuad(null); else zoomAt(RD.W / 2, RD.W / 2, 1 / 1.6); });
RD.gN.addEventListener('focusin', e => {
  const b = e.target.closest('.blip');
  if (!b) return;
  for (const n of RD.nodes.values()) n.el.setAttribute('tabindex', n.el === b ? '0' : '-1');
  if (b.matches(':focus-visible')) hover(b.dataset.id);
});
RD.gN.addEventListener('focusout', () => hover(null));
RD.gN.addEventListener('keydown', e => {
  const b = e.target.closest('.blip');
  if (!b) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTrend(b.dataset.id, false); return; }
  const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!dir) return;
  e.preventDefault();
  const n = RD.nodes.get(b.dataset.id);
  let best = null, bd = Infinity;
  for (const m of RD.nodes.values()) {
    const dx = m.sx - n.sx, dy = m.sy - n.sy, dist = Math.hypot(dx, dy);
    if (m === n || !dist) continue;
    const cos = (dx * dir[0] + dy * dir[1]) / dist;
    if (cos < .35) continue;
    const score = dist * (2.2 - cos);
    if (score < bd) { bd = score; best = m; }
  }
  if (best) best.el.focus();
});
$$('.quad').forEach(b => b.addEventListener('click', () => setQuad(S.quad === b.dataset.area ? null : b.dataset.area)));
$('#allbtn').addEventListener('click', () => setQuad(null));
