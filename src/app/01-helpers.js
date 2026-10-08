/* Small DOM, string and storage helpers used everywhere. No app state lives here. */
const SVGNS = 'http://www.w3.org/2000/svg';
const $ = (q, r) => (r || document).querySelector(q);
const $$ = (q, r) => Array.from((r || document).querySelectorAll(q));
const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'text') el.textContent = str(v);
    else if (k === 'class') el.className = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(3)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(str(c)));
  return el;
}
function sv(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(str(c)));
  return el;
}
const ic = (name, cls) => sv('svg', { class: 'ic' + (cls ? ' ' + cls : ''), viewBox: '0 0 24 24', 'aria-hidden': 'true' }, sv('use', { href: '#' + name }));
function safeUrl(u) { try { const x = new URL(str(u)); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } }
const ls = {
  get(k, d) { try { const v = localStorage.getItem('ttr3.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ttr3.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const mqRM = matchMedia('(prefers-reduced-motion: reduce)'), mqPhone = matchMedia('(max-width: 899px) and (min-height: 500px), (max-width: 559px)');
const mqWide = matchMedia('(min-width: 1100px) and (min-height: 600px)');
let RM = mqRM.matches, PHONE = mqPhone.matches, WIDE = mqWide.matches && !PHONE;
const onMq = (mq, fn) => (mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn));
onMq(mqRM, e => { RM = e.matches; });
