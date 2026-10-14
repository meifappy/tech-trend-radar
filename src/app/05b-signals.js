/* Signals: how strongly each story and each trend pulls right now. The same for every viewer; recomputed only when
   the data changes. docs/RANKING.md explains the method.
   Heat (0 to 100) ranks stories: the scan's quality score (or an estimate from the kind of source when an older
   story has none), plus corroboration (other publishers on the same trend within a
   week, up to +9), plus the urgency of the trend, faded by age.
   Hot: the few stories with heat 75 or more from the last 14 days, at most one per trend and six in all.
   Momentum: a trend's stories in the last four weeks against the four weeks before, shown as eight weekly bars. */
const SIG = { news: null, trends: null, heat: new Map(), why: new Map(), hot: new Map(), mom: new Map(), dups: new Map(), extra: [] };
const HOT_MIN = 75, HOT_DAYS = 14, HOT_MAX = 6;
const EVIDENCE = { rule: 18, paper: 18, advisory: 16, report: 14, podcast: 10, video: 10, announcement: 8 };
const PRIMARY = new Set(['public', 'journal', 'research', 'paper', 'lab']);
// The day a story happened: its publication day, or the day the scan found it when the source names only a month.
const dayOf = n => (/^\d{4}-\d{2}-\d{2}/.test(str(n.at)) ? ts(n.at) : ts(n.seen) || ts(n.at));
const pubOf = n => str(n.src && n.src.name).replace(/\s*\(.*?\)\s*/g, ' ').trim().toLowerCase();
const fadeOf = age => (age <= 3 ? 1 : age <= 7 ? .95 : age <= 14 ? .85 : age <= 30 ? .6 : .3);
const sum = a => a.reduce((x, y) => x + y, 0);

function signals() {
  SIG.news = S.news; SIG.trends = S.trends;
  const now = Date.now(), byT = new Map(), heat = new Map(), why = new Map();
  const add = (k, n) => { if (!byT.has(k)) byT.set(k, []); byT.get(k).push(n); };
  for (const n of S.news) if (!n.minor) for (const k of tkeys(n)) add(k, n);
  // Follow-ups of a known story (stored with dup) are not listed, but they count as coverage.
  const cover = new Map(byT);
  for (const n of SIG.extra) for (const k of tkeys(n)) { if (!cover.has(k)) cover.set(k, []); cover.get(k).push(n); }

  for (const n of S.news) {
    const t = S.byId.get(n.t) || S.byId.get(n.t2);
    if (!t || n.minor) continue;
    const d = dayOf(n), age = Math.max(0, (now - d) / DAY), r = [];
    let base;
    if (typeof n.score === 'number' && n.score > 0) { base = n.score; r.push('scan score ' + n.score); }
    else base = 40 + (EVIDENCE[n.kind] || 8) + (PRIMARY.has(n.src.type) ? 4 : n.src.type === 'vendor' ? -2 : 0);
    if (n.hot) { base = Math.max(base, 88); r.push('flagged by the scan'); }
    else if (n.big) { base = Math.max(base, 80); r.push('major story'); }
    const pubs = new Set();
    for (const k of tkeys(n)) for (const m of cover.get(k) || []) if (Math.abs(dayOf(m) - d) <= 7 * DAY) pubs.add(pubOf(m));
    pubs.delete(pubOf(n));
    const others = pubs.size + (SIG.dups.get(n.id) || 0), conf = Math.min(3, others);
    if (others) r.push((others + 1) + ' sources within a week');
    if (t.ring === 'act') r.push('act-now trend');
    const raw = base + conf * 3 + (t.ring === 'act' ? 6 : t.ring === 'prepare' ? 3 : 0) + (weightOf(t) === 3 ? 3 : 0);
    heat.set(n.id, Math.round(Math.min(100, raw * fadeOf(age))));
    why.set(n.id, r);
  }
  // Hot stays scarce: the strongest story per trend, then the top six overall.
  const hot = new Map(), perT = new Set(), cut = now - HOT_DAYS * DAY;
  S.news.filter(n => (heat.get(n.id) || 0) >= HOT_MIN && dayOf(n) >= cut)
    .sort((a, b) => heat.get(b.id) - heat.get(a.id) || dayOf(b) - dayOf(a))
    .forEach(n => { if (hot.size < HOT_MAX && !perT.has(n.t)) { perT.add(n.t); hot.set(n.id, why.get(n.id).length ? why.get(n.id) : ['strong signal']); } });

  const mom = new Map(), WK = 7 * DAY;
  for (const t of S.trends) {
    const w = new Array(8).fill(0);
    for (const n of cover.get(t.id) || []) { const k = Math.floor((now - dayOf(n)) / WK); if (k >= 0 && k < 8) w[7 - k]++; }
    const before = sum(w.slice(0, 4)), recent = sum(w.slice(4));
    const dir = before + recent < 3 ? 'quiet' : recent >= 3 && recent >= 1.5 * before + 1 ? 'rising' : before >= 3 && recent <= before / 2 ? 'cooling' : 'steady';
    mom.set(t.id, { w, before, recent, dir });
  }
  Object.assign(SIG, { heat, why, hot, mom });
}
const heatOf = n => SIG.heat.get(n.id) || 0;
const MOM = { rising: 'Rising', steady: 'Steady', cooling: 'Cooling', quiet: 'Few signals yet' };
const momText = m => MOM[m.dir] + ': ' + plural(m.recent, 'story').replace('storys', 'stories') + ' in the last 4 weeks, ' + m.before + ' in the 4 before';
// Eight weekly bars, oldest on the left; the last four weeks are brighter.
function spark(m) {
  const mx = Math.max(3, ...m.w), H = 18;
  const el = sv('svg', { class: 'spark s-' + m.dir, viewBox: '0 0 63 ' + H, width: 63, height: H, 'aria-hidden': 'true' });
  m.w.forEach((v, i) => el.append(sv('rect', { x: i * 8, y: H - Math.max(1.5, v / mx * H), width: 6, height: Math.max(1.5, v / mx * H), rx: 1.5, class: i >= 4 ? 'now' : '' })));
  return el;
}
