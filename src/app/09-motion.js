/* Ambient motion: the periodic sweep, move animations and the "new update" toast. Pausable (WCAG 2.2.2). */
/*
   A quick beam (2.4 s) sweeps the radar on arrival and then every 20 seconds; only dots with news you have not
   opened, or that changed ring, ping as it passes. Everything runs on the compositor (transform and opacity only).
   The viewer can pause it (WCAG 2.2.2); it starts paused when the system asks for reduced motion. */
const MO = { on: ls.get('motion', null) == null ? !RM : !!ls.get('motion', true), T: 2400, GAP: 20000, timer: 0 };
const moving = () => MO.on && !document.hidden;
function sweepOnce() {
  clearTimeout(MO.timer);
  if (!moving() || !RD.booted || !S.trends.length) return;
  if (!RD.raf) {
    RD.sweep.animate([{ transform: 'rotate(0deg)', opacity: 0 }, { opacity: .7, offset: .08 }, { opacity: .7, offset: .85 }, { transform: 'rotate(360deg)', opacity: 0 }], { duration: MO.T, easing: 'linear' });
    for (const n of RD.nodes.values()) {
      if (!(D.newBy.get(n.id) || D.moved.has(n.id))) continue;
      n.ping.animate([{ transform: 'scale(.6)', opacity: .9 }, { transform: 'scale(3.2)', opacity: 0 }],
        { duration: 900, delay: (((n.deg + 90) % 360) + 360) % 360 / 360 * MO.T, easing: 'cubic-bezier(.1,.6,.3,1)' });
    }
  }
  MO.timer = setTimeout(sweepOnce, MO.GAP);
}
function sweepSync() {
  $('#app').classList.toggle('still', !MO.on);
  if (moving() && RD.booted) { if (!MO.timer) sweepOnce(); }
  else { clearTimeout(MO.timer); MO.timer = 0; RD.sweep.getAnimations().forEach(x => x.cancel()); }
  const b = $('#t-motion');
  if (b) { b.setAttribute('aria-label', MO.on ? 'Pause motion' : 'Play motion'); put(b, ic(MO.on ? 'i-mpause' : 'i-mplay')); }
}
function setMotion(on) {
  MO.on = on;
  ls.set('motion', on);
  sweepSync();
  apArm();
  toast(on ? 'Motion on' : 'Motion paused');
}
document.addEventListener('visibilitychange', () => { sweepSync(); apArm(); });
function animateMoves() {
  if (RM) return;
  for (const tr of RD.trails.values()) {
    const n = tr.n, [ox, oy] = scr(tr.ox, tr.oy);
    n.mv.animate([{ transform: 'translate(' + (ox - n.sx).toFixed(1) + 'px,' + (oy - n.sy).toFixed(1) + 'px)' }, { transform: 'translate(0px,0px)' }], { duration: 900, delay: 150, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'backwards' });
    tr.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 900, fill: 'backwards' });
  }
}
let knownNew = null;
function maybeReveal() {
  if (!S.ok.trends || !S.ok.news || !S.ok.me || !RD.booted) return;
  derive();
  if (!knownNew) {
    knownNew = new Set(S.news.filter(n => n._new).map(n => n.id));
    paintRadar();
    setTimeout(() => { animateMoves(); sweepSync(); }, RM ? 0 : 650);
    autoArm();
    return;
  }
  const arrived = S.news.filter(n => n._new && !knownNew.has(n.id));
  if (!arrived.length) return;
  arrived.forEach(n => knownNew.add(n.id));
  toast(plural(arrived.length, 'new update') + ' just arrived');
}
