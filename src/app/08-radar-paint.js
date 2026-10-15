/* Paints per-viewer state onto the radar (new, selected, dimmed) and runs camera moves. */
function paintRadar() {
  syncTrails();
  for (const n of RD.nodes.values()) {
    const t = n.t, c = D.newBy.get(n.id) || 0, mv = D.moved.get(n.id), sel = S.sel === n.id || (B.on && B.focus === n.id);
    n.el.classList.toggle('has-new', c > 0);
    n.lbl.classList.toggle('new', c > 0 || !!mv);
    n.el.classList.toggle('sel', sel);
    n.lbl.classList.toggle('sel', sel);
    const dim = (S.ring && t.ring !== S.ring) || (B.on && B.focus && B.focus !== n.id) || (!B.on && focusDim(n.id));
    n.el.classList.toggle('dim', !!dim);
    n.lbl.classList.toggle('dim', !!dim);
    n.ping.style.visibility = dim ? 'hidden' : '';
    const al = (t.title + '. ' + RINGS[t.ring].label + '.' + (c ? ' ' + plural(c, 'new update') + '.' : '') + (mv ? ' Moved from ' + RINGS[mv.from].label + '.' : ''));
    if (n.al !== al) { n.al = al; n.el.setAttribute('aria-label', al); }
  }
  RD.box.dataset.ring = S.ring || '';
  RD.box.classList.toggle('briefing', !!B.on);
  RD.rl.forEach((el, i) => el.classList.toggle('on', S.ring === RO[i]));
  // Re-run geometry only when something that moves dots or labels changed; a plain selection change is paint-only.
  const selN = RD.nodes.get(S.sel), sig = [RD.W, RD.cam.x, RD.cam.y, RD.cam.k, S.trends.length, [...D.newBy].join(), [...D.moved.keys()].join(), selN && selN.lbl.classList.contains('off') ? S.sel : ''].join('|');
  if (sig === RD.sig && !RD.raf) { fxRings(); return; }
  RD.sig = sig;
  place();
  if (!RD.raf) placeLabels();
}
const easeIO = p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
function camTo(x, y, k, ms) {
  cancelAnimationFrame(RD.raf); RD.raf = 0;
  cancelAnimationFrame(WZ.raf); WZ.raf = 0;
  clearTimeout(RD.settleT); RD.drag = false;
  const a = Object.assign({}, RD.cam), t0 = performance.now();
  // Flights take longer the further they go, so a long jump across the radar never feels like a cut. With reduced
  // motion (Windows: Animation effects off) the camera still glides, only shorter: views never jump.
  const far = Math.hypot(x - a.x, y - a.y) + Math.abs(Math.log(k / a.k));
  ms = ms == null ? clamp(520 + far * 520, 560, 1150) : ms;
  if (CALM) ms = Math.min(ms, 480);
  RD.box.classList.add('moving');
  // Clip to the radar from the start of a flight into an area, so nothing slides out of the box and pops away.
  if (k > 1.01) RD.box.classList.add('zoomed');
  hover(null);
  const step = now => {
    const p = ms ? Math.min(1, (now - t0) / ms) : 1, e = easeIO(p);
    RD.cam = { x: a.x + (x - a.x) * e, y: a.y + (y - a.y) * e, k: a.k * Math.pow(k / a.k, e) }; // zoom in log space: an even glide
    place();
    if (p < 1) { RD.raf = requestAnimationFrame(step); return; }
    RD.raf = 0;
    RD.box.classList.remove('moving'); fxRings();
    RD.box.classList.toggle('zoomed', k > 1.01);
    RD.sig = '';
    placeLabels();
    zoomUi();
  };
  RD.raf = requestAnimationFrame(step);
}
function setQuad(q) {
  S.quad = q && AREAS[q] ? q : null;
  if (S.quad) camTo(AREAS[S.quad].cx * .9, AREAS[S.quad].cy * .9, PHONE ? 1.9 : 1.72);
  else camTo(0, 0, 1);
  $$('.quad').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.area === S.quad)));

}
function setRing(r) {
  S.ring = S.ring === r ? null : r;
  paintRadar();
  paintChrome();
  if (cur().page === 'home') renderPanel(false);
}
// The rings draw themselves as soon as the page opens, so nothing flashes while the data is still loading.
function bandsIn() {
  if (CALM || RD.bandsIn || !RD.W) return;
  RD.bandsIn = true;
  const [cx, cy] = scr(0, 0);
  RD.gB.style.transformOrigin = cx + 'px ' + cy + 'px';
  RD.gB.animate([{ opacity: 0, transform: 'scale(.86) rotate(-12deg)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
// The dots pop in from the centre outwards once the trends have loaded; labels and rings follow.
function boot() {
  if (RD.booted) return;
  RD.booted = true;
  if (CALM) {
    // Calm: the dots fade in instead of popping.
    RD.gN.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    return;
  }
  for (const n of RD.nodes.values()) {
    n.pop.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380, delay: 80 + n.wr * 380, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' });
  }
  RD.gL.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, delay: 480, fill: 'backwards' });
  RD.fx.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 520, fill: 'backwards' });
}
