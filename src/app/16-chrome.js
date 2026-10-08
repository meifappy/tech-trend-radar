/* Top bar, toast, URL hash and keyboard shortcuts. */
function paintChrome() {
  const m = S.meta, txt = S.problem ? '' : m && m.lastScan ? 'Updated ' + ago(m.lastScan) : S.ok.trends ? '' : 'Loading…';
  $$('.upd').forEach(el => { el.textContent = txt; });
  $('#r-sum').textContent = S.trends.length ? RO.map(r => S.trends.filter(t => t.ring === r).length + ' ' + RINGS[r].label.toLowerCase()).join(', ') + '. ' + (D.total ? plural(D.total, 'update') + ' new for you.' : 'Nothing new for you.') : '';
  const tc = $('#t-count'); tc.hidden = !D.total; tc.textContent = D.total > 99 ? '99+' : String(D.total);
}
let toastT = 0;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
let hashT = 0;
function syncHash() { clearTimeout(hashT); hashT = setTimeout(syncHashNow, 250); }
function syncHashNow() {
  const c = cur(), want = c.page === 'trend' ? '#t-' + c.arg : /^(news|about|list)$/.test(c.page) ? '#' + c.page : '';
  if ((location.hash || '') === want) return;
  try { history.replaceState(null, '', want || location.pathname + location.search); } catch (e) { /* hash sync is optional */ }
}
function readHash() {
  let x = '';
  try { x = decodeURIComponent((location.hash || '').slice(1)); } catch (e) { x = ''; }
  if (x.slice(0, 2) === 't-') return { page: 'trend', arg: x.slice(2) };
  return /^(news|about|list)$/.test(x) ? { page: x } : null;
}
let wanted = readHash();
function useWanted() {
  if (!wanted || !S.ok.trends) return;
  const w = wanted;
  wanted = null;
  if (w.page === 'trend') { if (S.byId.has(w.arg)) openTrend(w.arg, false); } else nav(w.page);
}
addEventListener('hashchange', () => { wanted = readHash(); useWanted(); });

function focusSearch() { nav('search'); P.q.select(); }
P.q.addEventListener('input', () => {
  S.q = P.q.value;
  if (S.q.trim()) { if (cur().page !== 'search') nav('search'); else renderPanel(false); }
  else if (cur().page === 'search') renderPanel(false);
});
P.q.addEventListener('focus', () => { if (PHONE) sheetTo('full'); });
P.q.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); const first = $('.trow, .ni-l', P.body); if (first) first.focus(); }
});
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); focusSearch(); return; }
  if (e.key === 'Escape') {
    if (typing && P.q.value) { P.q.value = ''; P.q.dispatchEvent(new Event('input')); return; }
    if (typing) { e.target.blur(); return; }
    if (B.on) { briefStop(); return; }
    if (cur().page !== 'home') { back(); return; }
    if (S.quad) { setQuad(null); return; }
    if (S.ring) setRing(S.ring);
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (B.on && cur().page === 'brief' && !(e.target.closest && e.target.closest('.blip'))) {
    if (e.key === ' ' && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); showSlide(B.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); showSlide(B.i - 1); }
    return;
  }
  const onBlip = e.target.closest && e.target.closest('.blip');
  if (cur().page === 'trend' && !onBlip && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); return; }
  if (cur().page === 'home' && !onBlip && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); const l = dockList(); if (l.length) dockGo(e.key === 'ArrowRight' ? 1 : -1); return; }
  if (e.key === '/') { e.preventDefault(); focusSearch(); }
  else if (e.key === 'b') briefStart();
  else if (e.key === 'n') nav('news');
  else if (e.key === 'l') nav('list');
  else if (e.key === 'p') setMotion(!MO.on);
  else if (e.key === '?') nav('about');
  else if ('1234'.includes(e.key) && e.key.length === 1) { const a = AO[+e.key - 1]; setQuad(S.quad === a ? null : a); }
  else if (e.key === '0') setQuad(null);
  else if (e.key === '+' || e.key === '=') zoomAt(RD.W / 2, RD.W / 2, 1.6);
  else if (e.key === '-') { if (RD.cam.k / 1.6 <= 1.05) setQuad(null); else zoomAt(RD.W / 2, RD.W / 2, 1 / 1.6); }
});
