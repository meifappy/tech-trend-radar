/* Label engine: semantic zoom, collision-free label placement, nudges and leader lines. */
// Semantic zoom: short names at overview, full titles from 1.5x, and the latest headline under each name from 2.3x.
const SUB_FONT = '400 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, system-ui, sans-serif';
const WC = new Map();
function tw(str_, sub) {
  const key = (sub ? 's' : PHONE ? 'p' : 'd') + str_;
  let w = WC.get(key);
  if (w == null) { mctx.font = sub ? SUB_FONT : PHONE ? LABEL_FONT.replace('13px', '11px') : LABEL_FONT; w = Math.ceil(mctx.measureText(str_).width) + 2; WC.set(key, w); }
  return w;
}
const detail = () => (RD.cam.k >= 2.3 ? 2 : RD.cam.k >= 1.5 ? 1 : 0);
function labelText(n, d) {
  const t = n.t, main = d >= 1 ? str(t.title) : str(t.short || t.title);
  let sub = '';
  if (d >= 2) { const x = (S.byT.get(t.id) || [])[0]; if (x) { sub = when(x.at) + ': ' + str(x.title); if (sub.length > 48) sub = sub.slice(0, 46).replace(/\s+\S*$/, '') + '…'; } }
  return { main, sub };
}
function lrect(n, s) {
  const w = n.bw, hgt = n.bh, ex = hgt - 15, g = 11.5, x = n.sx, y = n.sy;
  switch (s) {
    case 'r': return { x: x + g, y: y - 7.5, w, h: hgt, tx: x + g, ty: y + 4.5, a: 'start' };
    case 'ru': return { x: x + g - 2, y: y - 17 - ex, w, h: hgt, tx: x + g - 2, ty: y - 5 - ex, a: 'start' };
    case 'rd': return { x: x + g - 2, y: y + 2, w, h: hgt, tx: x + g - 2, ty: y + 14, a: 'start' };
    case 'l': return { x: x - g - w, y: y - 7.5, w, h: hgt, tx: x - g, ty: y + 4.5, a: 'end' };
    case 'lu': return { x: x - g + 2 - w, y: y - 17 - ex, w, h: hgt, tx: x - g + 2, ty: y - 5 - ex, a: 'end' };
    case 'ld': return { x: x - g + 2 - w, y: y + 2, w, h: hgt, tx: x - g + 2, ty: y + 14, a: 'end' };
    case 'b': return { x: x - w / 2, y: y + 11, w, h: hgt, tx: x, ty: y + 23, a: 'middle' };
    default: return { x: x - w / 2, y: y - 27 - ex, w, h: hgt, tx: x, ty: y - 15 - ex, a: 'middle' };
  }
}
// While the camera moves, labels ride along with their dots instead of disappearing; they are re-laid out at rest.
function followLabels() {
  for (const n of RD.nodes.values()) {
    if (n.lox == null) continue;
    const x = (n.sx + n.lox).toFixed(1), y = (n.sy + n.loy).toFixed(1);
    n.lbl.setAttribute('x', x); n.lbl.setAttribute('y', y);
    if (n.l2) { n.l2.setAttribute('x', x); n.l2.setAttribute('y', (n.sy + n.loy + 14).toFixed(1)); }
  }
}
function placeLabels() {
  const on = RD.R0 * RD.cam.k >= (PHONE ? 150 : 155) && S.trends.length > 0;
  RD.box.classList.toggle('nolabels', !on);
  if (!on) return;
  const base = RD.cam.k < 1.01, d = detail();
  if (base) {
    let had = false;
    for (const n of RD.nodes.values()) if (n.nx || n.ny) { n.nx = n.ny = 0; had = true; }
    if (had) place();
  }
  for (const n of RD.nodes.values()) {
    if (n.ld) n.ld.style.display = 'none';
    const { main, sub } = labelText(n, d);
    if (n.lbl.textContent !== main) n.lbl.textContent = main;
    if (sub && !n.l2) { n.l2 = sv('text', { class: 'lbl2' }); RD.gL.append(n.l2); }
    if (n.l2) { if (n.l2.textContent !== sub) n.l2.textContent = sub; n.l2.style.display = sub ? '' : 'none'; }
    n.bw = Math.max(tw(main), sub ? tw(sub, true) : 0);
    n.bh = sub ? 29 : 15;
  }
  // On phones the faint ring names may sit under a label (its halo masks them); names of trends matter more.
  const W = RD.W, occ = PHONE ? [] : RD.rlBoxes.slice(), [cx] = scr(0, 0);
  const vis = [], dots = [];
  const hide = n => { n.lbl.classList.add('off'); if (n.l2) n.l2.style.display = 'none'; n.lox = null; };
  // Weighting: at overview, weight 2 and 3 trends and any trend with news are named; weight 1 names appear when you zoom in.
  for (const n of RD.nodes.values()) {
    const inView = n.sx > 0 && n.sx < W && n.sy > 0 && n.sy < W;
    if (inView) dots.push(n);
    if (inView && (weightOf(n.t) > 1 || D.newBy.get(n.id) || D.moved.has(n.id) || RD.cam.k >= 1.4 || n.id === S.sel || n.id === B.focus)) vis.push(n);
    else hide(n);
  }
  for (const n of dots) {
    occ.push(dotBox(n));
  }
  if (base) occ.push(...RD.qBoxes);
  else { const ab = $('#allbtn'), r0 = RD.box.getBoundingClientRect(), r1 = ab.getBoundingClientRect(); if (!ab.hidden && r1.width) occ.push({ x: r1.left - r0.left - 6, y: r1.top - r0.top - 4, w: r1.width + 12, h: r1.height + 8 }); }
  const rank = n => (n.id === S.sel || n.id === B.focus ? -40 : 0) - weightOf(n.t) * 6 + RO.indexOf(n.t.ring) * 2 - (D.newBy.get(n.id) || D.moved.has(n.id) ? 1 : 0);
  vis.sort((a, b) => rank(a) - rank(b));
  const room = base ? RD.room : 0;
  const hits = (r, id) => occ.some(o => o.own !== id && o.x < r.x + r.w && r.x < o.x + o.w && o.y < r.y + r.h && r.y < o.y + o.h);
  const inside = r => !(r.x < 2 - room || r.y < 2 || r.x + r.w > W - 2 + room || r.y + r.h > W - 2);
  const fit = n => {
    const order = n.sx >= cx ? ['r', 'rd', 'ru', 'b', 't', 'l', 'ld', 'lu'] : ['l', 'ld', 'lu', 'b', 't', 'r', 'rd', 'ru'];
    for (const s2 of order) { const r = lrect(n, s2); if (inside(r) && !hits(r, n.id)) return r; }
    return null;
  };
  const show = (n, r) => {
    const px = PHONE ? 3 : 5;
    occ.push({ x: r.x - px, y: r.y, w: r.w + px * 2, h: r.h });
    n.lbl.setAttribute('x', r.tx.toFixed(1)); n.lbl.setAttribute('y', r.ty.toFixed(1)); n.lbl.setAttribute('text-anchor', r.a);
    if (n.l2 && n.l2.textContent) { n.l2.setAttribute('x', r.tx.toFixed(1)); n.l2.setAttribute('y', (r.ty + 14).toFixed(1)); n.l2.setAttribute('text-anchor', r.a); n.l2.style.display = ''; }
    n.lox = r.tx - n.sx; n.loy = r.ty - n.sy;
    n.lbl.classList.remove('off');
  };
  const failed = [];
  for (const n of vis) { const r = fit(n); if (r) show(n, r); else failed.push(n); }
  for (const n of failed) {
    let done = false;
    // At overview, a dot whose label found no room moves a few pixels within its ring; the offset is kept when zooming.
    if (base) for (const [dx, dy] of NUDGE) {
      const x0 = n.sx, y0 = n.sy;
      n.sx = x0 + dx; n.sy = y0 + dy;
      const dot = { x: n.sx - 9, y: n.sy - 9, w: 18, h: 18 }, r = !hits(dot, n.id) && fit(n);
      if (r) {
        const k = RD.cam.k * RD.R0;
        n.nx = dx / k; n.ny = dy / k;
        n.el.setAttribute('transform', 'translate(' + n.sx.toFixed(1) + ' ' + n.sy.toFixed(1) + ')');
        n.ping.style.translate = n.sx.toFixed(1) + 'px ' + n.sy.toFixed(1) + 'px';
        occ.push(dotBox(n));
        show(n, r);
        done = true;
        break;
      }
      n.sx = x0; n.sy = y0;
    }
    // Last resort: set the name a little further out and join it to its dot with a hairline.
    if (!done) {
      const g = 11.5, side = n.sx >= cx ? 1 : -1;
      outer: for (const dd of [24, 42]) for (const dy of [0, -18, 18, -32, 32]) for (const sd of [side, -side]) {
        const w = n.bw, y = n.sy + dy, x0 = sd > 0 ? n.sx + g + dd : n.sx - g - dd - w;
        const r = { x: x0, y: y - 7.5, w, h: n.bh, tx: sd > 0 ? x0 : x0 + w, ty: y + 4.5, a: sd > 0 ? 'start' : 'end' };
        if (!inside(r) || hits(r, n.id)) continue;
        show(n, r);
        if (!n.ld) { n.ld = sv('line', { class: 'ld' }); RD.gL.prepend(n.ld); }
        const ex = sd > 0 ? r.x - 3 : r.x + w + 3, len = Math.hypot(ex - n.sx, y - n.sy) || 1;
        n.ld.setAttribute('x1', (n.sx + (ex - n.sx) / len * 8).toFixed(1)); n.ld.setAttribute('y1', (n.sy + (y - n.sy) / len * 8).toFixed(1));
        n.ld.setAttribute('x2', ex.toFixed(1)); n.ld.setAttribute('y2', y.toFixed(1));
        n.ld.style.display = '';
        done = true;
        break outer;
      }
    }
    if (!done) hide(n);
  }
  for (const tr of RD.trails.values()) { tr.el.setAttribute('x2', tr.n.sx.toFixed(1)); tr.el.setAttribute('y2', tr.n.sy.toFixed(1)); }
}
// A label may not cover any dot: the obstacle is the dot plus its selection ring, sized by weight.
const dotBox = n => { const r = D.newBy.get(n.id) ? 13 : WEIGHT_R[weightOf(n.t)] + 4; return { x: n.sx - r, y: n.sy - r, w: 2 * r, h: 2 * r, own: n.id }; };
const NUDGE = [[0, -12], [12, 0], [0, 12], [-12, 0], [10, -10], [10, 10], [-10, 10], [-10, -10], [0, -20], [20, 0], [0, 20], [-20, 0], [16, -16], [16, 16], [-16, 16], [-16, -16], [0, -28], [28, 0], [0, 28], [-28, 0]];
function syncTrails() {
  for (const [id, tr] of RD.trails) if (!D.moved.has(id) || !RD.nodes.has(id)) { tr.el.remove(); RD.trails.delete(id); }
  for (const [id, mv] of D.moved) {
    const n = RD.nodes.get(id);
    if (!n || RD.trails.has(id)) continue;
    const G = RINGS[mv.from], r = (G.r0 + G.r1) / 2 + (mv.from === 'act' ? .04 : 0), a = n.deg * Math.PI / 180;
    const tr = { n, ox: Math.cos(a) * r, oy: Math.sin(a) * r, el: sv('line', { class: 'trail' }) };
    RD.gT.append(tr.el);
    RD.trails.set(id, tr);
  }
}
