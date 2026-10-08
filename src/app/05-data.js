/* Turns database snapshots into trends and news. Recent months are live; older months load on demand. */
function setTrends(docs) {
  const list = docs.map(d => Object.assign({}, d.data(), { id: d.id })).filter(t => AREAS[t.area] && RINGS[t.ring] && t.status !== 'archived');
  list.sort(byReading);
  S.trends = list;
  S.byId = new Map(list.map(t => [t.id, t]));
}
function setNews() {
  const all = [];
  for (const m in S.months) for (const n of S.months[m]) all.push(n);
  all.sort((a, b) => ts(b.at) - ts(a.at) || ts(b.seen) - ts(a.seen) || str(a.title).localeCompare(str(b.title)));
  S.news = all.filter(n => !n.dup);
  S.byT = new Map();
  for (const n of S.news) for (const k of tkeys(n)) { if (!S.byT.has(k)) S.byT.set(k, []); S.byT.get(k).push(n); }
}
const asNews = d => {
  const x = Object.assign({}, d.data(), { id: d.id });
  x.src = x.src && typeof x.src === 'object' ? x.src : {};
  return x;
};
function watchFeed() {
  const db = S.db;
  if (!db) return;
  let months = (S.meta && Array.isArray(S.meta.months) ? S.meta.months : []).filter(m => /^\d{4}-\d{2}$/.test(m)).sort().reverse();
  if (!months.length) months = [new Date().toISOString().slice(0, 7)];
  for (const m of Object.keys(S.subs)) if (!months.slice(0, 3).includes(m)) { try { S.subs[m](); } catch (e) { /* already closed */ } delete S.subs[m]; }
  months.slice(0, 3).forEach(m => {
    if (S.subs[m]) return;
    S.subs[m] = db.collection('feed/' + m + '/items').limit(1000).onSnapshot(snap => {
      S.months[m] = snap.docs.map(asNews);
      setNews();
      S.ok.news = true;
      refresh();
      maybeReveal();
    }, () => { S.ok.news = true; refresh(); maybeReveal(); });
  });
}
