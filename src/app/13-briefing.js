/* The news briefing: one stop per trend with news, the camera travels the radar. */
const B = { on: false, slides: [], i: 0, playing: false, focus: null, anim: null, animDone: false, markT: 0 };
// One stop per trend that has news, in radar order (act first, then clockwise by area), so the camera travels the radar.
function buildSlides() {
  const fresh = S.news.filter(n => n._new && S.byId.has(n.t));
  const week = Date.now() - 7 * DAY;
  const pool = fresh.length ? fresh : S.news.filter(n => S.byId.has(n.t) && (ts(n.seen) || ts(n.at)) >= week);
  const use = pool.length ? pool : S.news.filter(n => S.byId.has(n.t)).slice(0, 8);
  const by = new Map();
  for (const n of use) { if (!by.has(n.t)) by.set(n.t, []); by.get(n.t).push(n); }
  const order = S.trends.filter(t => by.has(t.id)).sort((a, b) => RO.indexOf(a.ring) - RO.indexOf(b.ring) || AO.indexOf(a.area) - AO.indexOf(b.area));
  B.scope = fresh.length ? 'new for you' : pool.length ? 'from the last 7 days' : 'latest';
  return order.slice(0, 10).map(t => {
    const items = by.get(t.id).slice().sort((a, b) => (isHot(b) ? 1 : 0) - (isHot(a) ? 1 : 0) || ts(b.at) - ts(a.at)).slice(0, 2);
    return { t, items, more: by.get(t.id).length - items.length, dur: 4200 + (items.length - 1) * 2600 };
  });
}
function briefStart() {
  if (!S.trends.length) return;
  const slides = buildSlides();
  if (!slides.length) { toast('No news to brief yet'); return; }
  B.slides = slides;
  B.on = true;
  B.playing = true;
  if (S.quad) { S.quad = null; $('#allbtn').hidden = true; $$('.quad').forEach(b => b.setAttribute('aria-pressed', 'false')); }
  nav('brief');
  showSlide(0);
}
function briefStop(quiet) {
  if (!B.on) return;
  B.on = false;
  B.auto = false;
  B.playing = false;
  if (B.anim) B.anim.cancel();
  B.anim = null;
  clearTimeout(B.markT);
  B.focus = null;
  camTo(0, 0, 1);
  paintRadar();
  if (!quiet && cur().page === 'brief') nav('home');
}
function showSlide(i) {
  if (!B.on) return;
  if (i >= B.slides.length) { briefStop(); toast('Briefing done. The feed continues where you left off.'); return; }
  if (!B.slides.length) { briefStop(); return; }
  B.i = clamp(i, 0, B.slides.length - 1);
  const s = B.slides[B.i], n = s.t && RD.nodes.get(s.t.id);
  B.focus = s.t ? s.t.id : null;
  if (n) camTo(n.wx * .72, n.wy * .72, PHONE ? 1.55 : 1.6, 500); else camTo(0, 0, 1, 500);
  paintRadar();
  if (cur().page === 'brief') { renderPanel(false); P.body.scrollTop = 0; }
  const fill = $('.bseg .sc i', P.body);
  if (B.anim) B.anim.cancel();
  B.animDone = false;
  B.anim = fill ? fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: RM ? s.dur * 1.4 : s.dur, fill: 'forwards' }) : null;
  if (B.anim) B.anim.onfinish = () => { B.animDone = true; advance(); };
  if (!B.playing && B.anim) B.anim.pause();
  clearTimeout(B.markT);
  if (s.items) B.markT = setTimeout(() => markNews(s.items.filter(x => x._new)), 1500);
  if (n && !RM && MO.on) setTimeout(() => n.ping.animate([{ transform: 'scale(.6)', opacity: .9 }, { transform: 'scale(3.2)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.1,.6,.3,1)' }), 700);
}
function advance() { if (B.on && B.playing && B.animDone) showSlide(B.i + 1); }
function togglePlay() {
  B.playing = !B.playing;
  if (B.anim) B.playing ? B.anim.play() : B.anim.pause();
  renderPanel(false);
  if (B.anim && B.anim.currentTime != null) { const f = $('.bseg .sc i', P.body); if (f) { const a = B.anim, cur0 = a.currentTime; B.anim = f.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: a.effect.getTiming().duration, fill: 'forwards' }); B.anim.currentTime = cur0; B.anim.onfinish = () => { B.animDone = true; advance(); }; a.cancel(); if (!B.playing) B.anim.pause(); } }
  if (B.playing) advance();
}
function pageBrief() {
  const s = B.slides[B.i];
  if (!B.on || !s) return [h('p', { class: 'muted', text: 'The briefing has ended.' })];
  const segs = h('div', { class: 'bseg' }, B.slides.map((x, i) => h('button', { type: 'button', class: i < B.i ? 'sd' : i === B.i ? 'sc' : '', 'aria-label': (x.t.short || x.t.title) + ', stop ' + (i + 1) + ' of ' + B.slides.length, onclick: () => showSlide(i) }, h('span', null, h('i')))));
  const slide = h('div', { class: 'bslide c-' + s.t.ring },
    h('p', { class: 'bscope', text: (B.auto ? 'Auto-play. ' : '') + 'Stop ' + (B.i + 1) + ' of ' + B.slides.length + ', news ' + B.scope }),
    h('button', { class: 'bkick', type: 'button', onclick: () => openTrend(s.t.id) }, h('i'), s.t.title, h('small', { text: RINGS[s.t.ring].label })),
    s.items.map(n => { const u = safeUrl(n.src.url); return h('article', { class: 'bitem' },
      h('h2', { class: 'btitle' }, u ? h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, n.title) : n.title),
      n.take ? h('p', { class: 'btext', text: n.take }) : null,
      h('p', { class: 'bsrc' }, hotPill(n), [str(n.src.name), when(n.at)].filter(Boolean).join(', '))); }),
    s.more > 0 ? h('button', { class: 'link', type: 'button', onclick: () => openTrend(s.t.id) }, plural(s.more, 'more update'), ic('i-chev')) : null);
  if (!RM) slide.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
  const ctl = h('div', { class: 'bctl' },
    h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Previous stop', onclick: () => showSlide(B.i - 1), disabled: B.i === 0 }, ic('i-back')),
    h('button', { class: 'primary', type: 'button', 'aria-label': B.playing ? 'Pause the news briefing' : 'Play the news briefing', onclick: togglePlay }, ic(B.playing ? 'i-pause' : 'i-play')),
    h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Next stop', onclick: () => showSlide(B.i + 1) }, ic('i-chev')));
  return [segs, slide, ctl];
}

// Laptops: if a visitor has not touched anything 10 seconds after the radar appears, the briefing starts by itself
// (once per visit). Any click, key, scroll or touch before that cancels it for the visit. It never starts with
// reduced motion or when motion is paused, and it can be paused or closed like any briefing (WCAG 2.2.2).
const AUTO = { t: 0, off: false };
function autoArm() {
  clearTimeout(AUTO.t);
  if (AUTO.off || !WIDE || RM || !MO.on) return;
  AUTO.t = setTimeout(() => {
    if (AUTO.off || document.hidden || B.on || cur().page !== 'home' || !WIDE) return;
    AUTO.off = true;
    briefStart();
    if (B.on) { B.auto = true; renderPanel(false); }
  }, 10000);
}
const autoCancel = () => { if (!AUTO.off) { AUTO.off = true; clearTimeout(AUTO.t); } };
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, autoCancel, { capture: true, passive: true }));
P.body.addEventListener('scroll', () => { if (P.scrolled) autoCancel(); }, { passive: true });
