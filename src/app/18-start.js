/* Start-up: Claude runtime (live database) or standalone mode (radar-data.json on any static host). */
function fail(msg) { S.problem = msg; S.ok.trends = true; paintChrome(); renderPanel(false); }
function getUse(tries) {
  return new Promise(res => {
    let n = 0;
    const tick = () => {
      const c = window.claude;
      if (c && typeof c.use === 'function') { res(name => Promise.resolve().then(() => c.use(name)).catch(() => null)); return; }
      if (++n > tries) { res(null); return; }
      setTimeout(tick, 100);
    };
    tick();
  });
}
/* Standalone mode (SharePoint, Teams tab, any static host): no Claude runtime, so the radar reads a plain JSON file
   next to the page (or ?data=<url>) and keeps each reader's state in this browser. Same code path as the live app. */
async function staticDb() {
  let url = 'radar-data.json';
  try { url = new URLSearchParams(location.search).get('data') || url; } catch (e) { /* default */ }
  const base = url.replace(/[^/]*$/, '');
  let j;
  try { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) return null; j = await r.json(); } catch (e) { return null; }
  if (!j || !Array.isArray(j.trends)) return null;
  const docs = list => (Array.isArray(list) ? list : []).map(x => ({ id: x.id, exists: true, data: () => x }));
  const snap = list => ({ docs: docs(list), exists: true });
  // A query over a list that may still need loading (older months live in archive/<YYYY-MM>.json).
  const q = load => { const o = { limit: () => o, orderBy: () => o, where: () => o, onSnapshot(next, err) { load().then(l => next(snap(l)), e => err && err(e)); return () => {}; }, get: () => load().then(snap) }; return o; };
  const meta = Object.assign({}, j.meta || {});
  const months = Array.isArray(meta.months) && meta.months.length ? meta.months : [new Date().toISOString().slice(0, 7)];
  const recent = new Set(Array.isArray(j.recentMonths) ? j.recentMonths : [months[0]]);
  const now = l => () => Promise.resolve(Array.isArray(l) ? l : []);
  const month = m => recent.has(m) ? now((j.news || []).filter(n => (n.month || months[0]) === m))
    : () => fetch(base + 'archive/' + m + '.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : { news: [] })).then(x => x.news || []);
  return {
    collection: path => { const f = /^feed\/(\d{4}-\d{2})\/items$/.exec(path); return q(f ? month(f[1]) : now(path === 'trends' ? j.trends : path === 'sources' ? j.sources : path === 'scans' ? j.scans : [])); },
    doc: path => ({ onSnapshot(next) { next(path === 'meta/status' ? { exists: true, id: 'status', data: () => meta } : { exists: false, data: () => undefined }); return () => {}; }, get: () => Promise.resolve({ exists: false, data: () => undefined }), set: () => Promise.reject(new Error('read-only')) })
  };
}
function connect(db, user) {
  S.db = db;
  Me.init(db, user).then(() => { S.ok.me = true; refresh(); maybeReveal(); }, () => { S.ok.me = true; refresh(); maybeReveal(); });
  const dead = () => fail('The radar data is not available right now. Reload to try again.');
  db.collection('trends').limit(300).onSnapshot(snap => {
    setTrends(snap.docs);
    S.ok.trends = true;
    S.problem = '';
    buildNodes();
    layoutAll();
    if (!RD.booted && S.trends.length) boot();
    refresh();
    useWanted();
    maybeReveal();
  }, dead);
  db.doc('meta/status').onSnapshot(d => { S.meta = d.exists ? d.data() : null; watchFeed(); paintChrome(); }, () => watchFeed());
  db.collection('sources').limit(500).onSnapshot(snap => { S.sources = snap.docs.map(d => Object.assign({}, d.data(), { id: d.id })).filter(x => x.on !== false); if (cur().page === 'about') renderPanel(false); }, () => {});
  db.collection('scans').orderBy('at', 'desc').limit(8).onSnapshot(snap => { S.scans = snap.docs.map(d => d.data()); if (cur().page === 'about') renderPanel(false); }, () => {});
}
async function start() {
  buildBands();
  layoutAll();
  afterNav();
  histSync(false);
  paintChrome();
  let use = await getUse(8);
  if (!use) {
    const db = await staticDb();
    if (db) { connect(db, null); return; }
    use = await getUse(32);
  }
  if (!use) return fail('The radar data could not be loaded. Put radar-data.json next to this page, or open it in the Claude app.');
  const [db, user] = await Promise.all([use('db'), use('user')]);
  if (!db) return fail('Sign in to Claude to see the radar.');
  connect(db, user);
}
start();
