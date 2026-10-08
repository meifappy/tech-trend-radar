/* Radar geometry: sizing, the stable layout of dots per area and ring, camera transform and placement. */
const RD = {
  stage: $('#stage'), box: $('#rbox'), svg: $('#radar'), gB: $('#g-bands'), gT: $('#g-trails'), gN: $('#g-blips'), gL: $('#g-labels'), sweep: $('#sweep'), fx: $('#fx'), fxSel: $('#fx-sel'), fxCue: $('#fx-cue'),
  W: 0, R0: 0, cam: { x: 0, y: 0, k: 1 }, nodes: new Map(), trails: new Map(), bands: [], axes: [], rl: [], rlBoxes: [], qBoxes: [],
  raf: 0, booted: false, revealed: false, hot: null
};
const LABEL_FONT = '500 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, system-ui, sans-serif';
const mctx = document.createElement('canvas').getContext('2d');

function buildBands() {
  RD.bands = RO.map(r => sv('circle', { class: 'band b-' + r }));
  RD.axes = [sv('line', { class: 'axis' }), sv('line', { class: 'axis' })];
  RD.rl = RO.map(r => sv('text', { class: 'rl', 'text-anchor': 'middle' }, RINGS[r].label));
  RD.gB.append(...RD.bands.slice().reverse(), ...RD.axes, ...RD.rl);
}
function size() {
  const st = RD.stage.getBoundingClientRect();
  const short = innerHeight < 520;
  const cs = getComputedStyle(document.documentElement), aside = PHONE ? 0 : parseFloat(cs.getPropertyValue('--side')) + 2 * parseFloat(cs.getPropertyValue('--gap'));
  // Wide screens have no floating news bar under the radar, so the radar can use nearly the full height.
  const below = PHONE ? 0 : WIDE ? 40 : short ? 110 : 150;
  let rs = PHONE ? Math.min(innerWidth, Math.max(220, innerHeight - 250)) : Math.min(st.width - aside - (short ? 24 : 48), st.height - below, 1000);
  rs = Math.max(240, Math.floor(rs));
  RD.stage.style.setProperty('--rs', rs + 'px');
  RD.W = rs;
  RD.room = PHONE ? 0 : Math.max(0, Math.min(140, (st.width - aside - rs) / 2 - 12));
  RD.R0 = rs / 2 - (PHONE ? 16 : 36);
  RD.svg.setAttribute('viewBox', '0 0 ' + rs + ' ' + rs);
  RD.box.classList.toggle('small', rs < 340);
}
function worldLayout() {
  const cells = {}, pos = {};
  for (const t of S.trends) (cells[t.area + '|' + t.ring] = cells[t.area + '|' + t.ring] || []).push(t);
  for (const key in cells) {
    const [area, ring] = key.split('|'), A = AREAS[area], G = RINGS[ring];
    const list = cells[key].slice().sort((a, b) => str(a.id).localeCompare(str(b.id)));
    const n = list.length, m = n > 2 ? 8 : 15, span = 90 - 2 * m;
    const lo = ring === 'act' ? .14 : G.r0 + .04, hi = G.r1 - .04;
    list.forEach((t, i) => {
      const deg = A.a0 + m + (i + .5) * span / n, a = deg * Math.PI / 180;
      const f = n === 1 ? .5 : n === 2 ? (i ? .75 : .3) : [.22, .88, .5, .9, .3][i % 5];
      const r = lo + (hi - lo) * f;
      pos[t.id] = { wx: Math.cos(a) * r, wy: Math.sin(a) * r, deg, wr: r };
    });
  }
  return pos;
}
function makeNode(id) {
  const ping = h('i', { class: 'pg' });
  const dot = sv('circle', { class: 'dot', r: 6 });
  const pop = sv('g', { class: 'pop' }, sv('circle', { class: 'hit', r: 19 }), dot, sv('circle', { class: 'ring', r: 11.5 }));
  // A chevron beside the dot shows a rating move in the last 90 days (pointing in = more urgent).
  const arr = sv('path', { class: 'arr', d: 'M-3.5 -2L0 2L3.5 -2' });
  const mv = sv('g', { class: 'mv' }, arr, pop);
  const el = sv('g', { class: 'blip', role: 'button', tabindex: '-1', 'data-id': id }, mv);
  const lbl = sv('text', { class: 'lbl off', 'data-id': id });
  return { id, el, mv, pop, dot, ping, lbl, arr, sx: 0, sy: 0, text: '', t: null };
}
function buildNodes() {
  const pos = worldLayout(), keep = new Set();
  for (const t of S.trends) {
    keep.add(t.id);
    let n = RD.nodes.get(t.id);
    if (!n) { n = makeNode(t.id); RD.nodes.set(t.id, n); RD.gN.append(n.el); RD.gL.append(n.lbl); RD.fx.append(n.ping); }
    Object.assign(n, pos[t.id]);
    n.t = t;
    RO.forEach(r => n.el.classList.toggle('c-' + r, r === t.ring));
    n.ping.className = 'pg c-' + t.ring;
    n.dot.setAttribute('r', WEIGHT_R[weightOf(t)]);
    n.el.classList.toggle('w1', weightOf(t) === 1); n.el.classList.toggle('w3', weightOf(t) === 3);
    n.lbl.classList.toggle('w3', weightOf(t) === 3);
    const text = str(t.short || t.title);
    if (n.text !== text) { n.text = text; n.lox = null; }
  }
  for (const [id, n] of RD.nodes) if (!keep.has(id)) { n.el.remove(); n.lbl.remove(); n.ping.remove(); RD.nodes.delete(id); }
  const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('.blip');
  S.trends.forEach((t, i) => { const n = RD.nodes.get(t.id); n.el.setAttribute('tabindex', (focused ? n.el === focused : i === 0) ? '0' : '-1'); });
}
function scr(wx, wy) { const c = RD.cam, k = c.k * RD.R0; return [RD.W / 2 + (wx - c.x) * k, RD.W / 2 + (wy - c.y) * k]; }
function place() {
  const [cx, cy] = scr(0, 0), k = RD.cam.k * RD.R0, f = v => v.toFixed(1);
  RD.box.classList.toggle('tiny', k < 170);
  RD.bands.forEach((c, i) => { c.setAttribute('cx', f(cx)); c.setAttribute('cy', f(cy)); c.setAttribute('r', f(RINGS[RO[i]].r1 * k)); });
  const [ah, av] = RD.axes;
  ah.setAttribute('x1', f(cx - k)); ah.setAttribute('x2', f(cx + k)); ah.setAttribute('y1', f(cy)); ah.setAttribute('y2', f(cy));
  av.setAttribute('x1', f(cx)); av.setAttribute('x2', f(cx)); av.setAttribute('y1', f(cy - k)); av.setAttribute('y2', f(cy + k));
  RD.rlBoxes = RD.rl.map((el, i) => {
    const y = cy - RINGS[RO[i]].r1 * k + 15, w = RINGS[RO[i]].label.length * 6.6 + 10;
    el.setAttribute('x', f(cx)); el.setAttribute('y', f(y));
    return { x: cx - w / 2, y: y - 12, w, h: 16 };
  });
  for (const n of RD.nodes.values()) {
    const [x, y] = scr(n.wx + (n.nx || 0), n.wy + (n.ny || 0));
    n.sx = x; n.sy = y;
    n.el.setAttribute('transform', 'translate(' + f(x) + ' ' + f(y) + ')');
    n.ping.style.translate = f(x) + 'px ' + f(y) + 'px';
    const rc = D.recent.get(n.id);
    if (rc) {
      const ang = Math.atan2(cy - y, cx - x) * 180 / Math.PI + (rc.up ? -90 : 90), off = WEIGHT_R[weightOf(n.t)] + 7;
      const rad = Math.atan2(cy - y, cx - x) + (rc.up ? 0 : Math.PI);
      n.arr.setAttribute('transform', 'translate(' + f(Math.cos(rad) * off) + ' ' + f(Math.sin(rad) * off) + ') rotate(' + f(ang) + ')');
      n.arr.style.display = '';
    } else n.arr.style.display = 'none';
  }
  fxRings();
  for (const tr of RD.trails.values()) {
    const [x1, y1] = scr(tr.ox, tr.oy);
    tr.el.setAttribute('x1', f(x1)); tr.el.setAttribute('y1', f(y1)); tr.el.setAttribute('x2', f(tr.n.sx)); tr.el.setAttribute('y2', f(tr.n.sy));
  }
  const s = RD.sweep.style;
  s.left = f(cx - k) + 'px'; s.top = f(cy - k) + 'px'; s.width = s.height = f(2 * k) + 'px';
  if (RD.raf || RD.drag) followLabels();
}
// Selection and news-cue rings live in an HTML layer so their endless animations run on the compositor, not the main thread.
function fxRings() {
  const set = (el, id) => {
    const n = id && RD.nodes.get(id);
    el.classList.toggle('on', !!n && !RD.box.classList.contains('moving'));
    if (n) el.style.translate = n.sx.toFixed(1) + 'px ' + n.sy.toFixed(1) + 'px';
  };
  set(RD.fxSel, S.sel || (B.on ? B.focus : null));
  set(RD.fxCue, RD.cue);
}
function qboxes() {
  const b = RD.box.getBoundingClientRect();
  RD.qBoxes = $$('.quad', RD.box).map(q => { const r = q.getBoundingClientRect(); return { x: r.left - b.left - 4, y: r.top - b.top - 4, w: r.width + 8, h: r.height + 8 }; });
}
