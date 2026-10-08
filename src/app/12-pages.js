/* Panel pages. Each returns a list of nodes; renderPanel() swaps them in. */
// One reading flow, news first: title, latest news, what experts say, why it matters, sources, scope.
function pageTrend(id) {
  const t = S.byId.get(id);
  if (!t) return [h('p', { class: 'muted', text: S.ok.trends ? 'This trend is no longer on the radar.' : 'Loading…' })];
  const items = S.byT.get(id) || [], nNew = items.filter(n => n._new).length, mv = D.moved.get(id), all = S.open.has('all:' + id);
  const out = [h('header', { class: 'thead c-' + t.ring },
    h('p', { class: 'kicker' }, h('i'), RINGS[t.ring].label + ', ' + AREAS[t.area].label),
    h('h2', { class: 'title', id: 'p-title', tabindex: '-1', text: t.title }),
    h('p', { class: 'lead', text: t.line }),
    mv ? h('p', { class: 'moved' }, ic(RO.indexOf(mv.ring) < RO.indexOf(mv.from) ? 'i-in' : 'i-outward'), h('span', { text: 'Moved from ' + RINGS[mv.from].label + ' to ' + RINGS[t.ring].label + ', ' + when(mv.at) + '. ' + str(mv.note) })) : null)];
  out.push(section('Latest news', nNew ? nNew + ' new' : items.length ? String(items.length) : '',
    items.length ? h('div', { class: 'news' }, (all ? items : items.slice(0, 4)).map(n => newsItem(n, false))) : h('p', { class: 'muted', text: 'No news yet. The radar scans every 12 hours.' }),
    items.length > 4 && !all ? h('button', { class: 'link', type: 'button', onclick: () => { S.open.add('all:' + id); renderPanel(false); } }, 'Show all ' + items.length, ic('i-down')) : null));
  const ex = expertOf(t);
  if (ex.length) out.push(section('What experts say', null, h('ul', { class: 'quotes' }, ex.map(x => h('li', null,
    h(x.verbatim ? 'q' : 'p', { class: 'qt', text: x.text }),
    h('p', { class: 'qby' }, linkOut(x.url, x.by), x.at ? h('span', { text: when(x.at) }) : null))))));
  const why = (Array.isArray(t.why) ? t.why : t.why ? [str(t.why)] : []).slice(0, 3);
  if (why.length) out.push(section('Why it matters', null, h('ul', { class: 'bul' }, why.map(w => h('li', { text: w })))));
  const an = Array.isArray(t.analysts) ? t.analysts.filter(x => x && x.by && safeUrl(x.url)) : [];
  const src = Array.isArray(t.sources) ? t.sources.filter(x => x && safeUrl(x.url)) : [];
  const refs = an.map(x => ({ url: x.url, text: x.by + ': ' + str(x.list) })).concat(src.map(x => ({ url: x.url, text: x.title || x.name }))).slice(0, 6);
  if (refs.length) out.push(section('Sources', null, h('ul', { class: 'refs' }, refs.map(r => h('li', null, linkOut(r.url, r.text))))));
  out.push(h('p', { class: 'note' }, (t.scope ? 'Covers: ' + str(t.scope) + ' ' : '') + 'The rating is reviewed every quarter' + (validTo(t) ? ' and holds until ' + validTo(t) : '') + '. News is added every 12 hours.'));
  return out;
}

function newsItem(n, showTrend) {
  const t = S.byId.get(n.t), u = safeUrl(n.src.url);
  const seen = () => { if (n._new) markNews([n]); };
  const head = u ? h('a', { class: 'ni-l', href: u, target: '_blank', rel: 'noopener noreferrer', onclick: seen }, h('span', { text: n.title }), ic('i-out')) : h('span', { class: 'ni-l', text: n.title });
  return h('article', { class: 'ni c-' + (t ? t.ring : 'watch') + (n._new ? ' new' : ''), 'data-id': n.id, onpointerenter: e => t && e.pointerType !== 'touch' && hover(t.id, 'panel'), onpointerleave: () => hover(null) },
    h('i', { class: 'nd', title: 'New for you' }),
    h('div', { class: 'ni-b' }, hotPill(n), head,
      n.take ? h('p', { text: n.take }) : null,
      h('small', null, [str(n.src.name), when(n.at)].filter(Boolean).join(', '),
        showTrend && t ? h('button', { class: 'link sm', type: 'button', onclick: () => openTrend(t.id) }, t.short || t.title) : null)));
}

function pageHome() {
  const out = [];
  const list = S.news.filter(n => S.byId.has(n.t) && !n.minor);
  out.push(h('button', { class: 'brief-row', type: 'button', onclick: () => briefStart() },
    h('span', { class: 'primary', 'aria-hidden': 'true' }, ic('i-play')),
    h('span', null, h('b', { text: 'Play the news briefing' }), h('small', { text: D.total ? plural(D.total, 'story') .replace('storys', 'stories') + ' new for you' : 'The latest stories, trend by trend' }))));
  if (!list.length) { out.push(h('p', { class: 'muted', text: S.ok.news ? 'No news yet. The radar scans every 12 hours.' : 'Loading…' })); return out; }
  // Hot stories lead each group; otherwise newest first.
  const hotFirst = l => l.filter(isHot).concat(l.filter(n => !isHot(n)));
  const fresh = hotFirst(list.filter(n => n._new)), rest = hotFirst(list.filter(n => !n._new).slice(0, Math.max(0, 12 - fresh.length)));
  if (fresh.length) out.push(section('New for you', String(fresh.length), h('div', { class: 'news' }, fresh.slice(0, 20).map(n => newsItem(n, true)))));
  if (rest.length) out.push(section(fresh.length ? 'Earlier' : 'Latest', null, h('div', { class: 'news' }, rest.map(n => newsItem(n, true)))));
  out.push(h('button', { class: 'link', type: 'button', onclick: () => nav('news') }, 'All news and archive', ic('i-chev')));
  return out;
}
function pageList() {
  const out = [h('p', { class: 'muted', style: 'margin:0', text: 'The same ' + S.trends.length + ' trends as the radar, from act now to horizon.' })];
  for (const r of RO) {
    const list = S.trends.filter(t => t.ring === r);
    if (list.length) out.push(h('section', { class: 'sec c-' + r }, h('h2', null, h('span', { class: 'rh' }, h('i'), RINGS[r].label), h('span', { text: RINGS[r].hint })), h('div', { class: 'rows' }, list.map(t => trendRow(t, AREAS[t.area].label)))));
  }
  return out;
}
// News: what is new for you, everything recent, and the archive (every month plus every rating change).
function loadMonth(m) {
  if (S.months[m] || !S.db || S.loading === m) return;
  S.loading = m;
  S.db.collection('feed/' + m + '/items').limit(1000).get().then(snap => {
    S.loading = null; S.months[m] = snap.docs.map(asNews); setNews(); refresh(); if (cur().page === 'news') renderPanel(false);
  }, () => { S.loading = null; toast('Could not load ' + monthName(m) + '. Try again.'); renderPanel(false); });
}
const monthName = m => F.month.format(new Date(ts(m)));
function pageNews() {
  if (S.newsTab == null) S.newsTab = D.total ? 'you' : 'all';
  const tab = (k, label, num) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.newsTab === k), onclick: () => { S.newsTab = k; S.archM = null; renderPanel(true); } }, label, num != null ? h('small', { text: String(num) }) : null);
  const out = [h('div', { class: 'seg2 seg3', role: 'tablist', 'aria-label': 'Which news' }, tab('you', 'For you', D.total), tab('all', 'Recent', null), tab('arch', 'Archive', null))];
  const byDay = list => {
    const groups = new Map();
    for (const n of list) { const b = bucket(n.at); if (!groups.has(b)) groups.set(b, []); groups.get(b).push(n); }
    return [...groups].map(([b, items]) => h('div', null, h('h3', { class: 'day', text: b }), h('div', { class: 'news' }, items.map(n => newsItem(n, true)))));
  };
  if (S.newsTab === 'arch') return out.concat(pageArchive(byDay));
  const list = S.newsTab === 'you' ? S.news.filter(n => n._new) : S.news.filter(n => S.byId.has(n.t)).slice(0, 60);
  if (!list.length) {
    out.push(S.newsTab === 'you'
      ? h('div', { class: 'caught' }, ic('i-check'), h('p', { text: 'You are all caught up' }), h('button', { class: 'link', type: 'button', text: 'See recent news', onclick: () => { S.newsTab = 'all'; renderPanel(true); } }))
      : h('p', { class: 'muted', text: S.ok.news ? 'Nothing here yet.' : 'Loading…' }));
    return out;
  }
  out.push(...byDay(list));
  if (S.newsTab === 'you') out.push(h('button', { class: 'link', type: 'button', onclick: markAll }, ic('i-check'), 'Mark all as seen'));
  else out.push(h('button', { class: 'link', type: 'button', onclick: () => { S.newsTab = 'arch'; renderPanel(true); } }, 'Older news in the archive', ic('i-chev')));
  return out;
}
function pageArchive(byDay) {
  const months = (S.meta && Array.isArray(S.meta.months) ? S.meta.months : Object.keys(S.months)).filter(m => /^\d{4}-\d{2}$/.test(m)).sort().reverse();
  if (S.archM) {
    const m = S.archM, items = S.months[m] ? S.months[m].filter(n => !n.dup).sort((a, b) => ts(b.at) - ts(a.at)) : null;
    const out = [h('button', { class: 'link', type: 'button', onclick: () => { S.archM = null; renderPanel(true); } }, ic('i-back'), 'All months'), h('h2', { class: 'arch-h', text: monthName(m) })];
    if (!items) { loadMonth(m); out.push(h('p', { class: 'muted', text: 'Loading ' + monthName(m) + '…' })); return out; }
    return out.concat(items.length ? byDay(items) : [h('p', { class: 'muted', text: 'No news this month.' })]);
  }
  const out = [section('By month', null, h('div', { class: 'rows' }, months.map(m => h('button', { class: 'trow arch-row', type: 'button', onclick: () => { S.archM = m; renderPanel(true); } },
    h('span', { class: 'tt' }, h('b', { text: monthName(m) }), h('small', { text: S.months[m] ? plural(S.months[m].filter(n => !n.dup).length, 'story').replace('storys', 'stories') : 'Tap to load' })), ic('i-chev', 'chev')))))];
  const changes = [];
  for (const t of S.trends) for (const x of Array.isArray(t.history) ? t.history : []) if (x && RINGS[x.ring] && RINGS[x.from]) changes.push({ t, x });
  changes.sort((a, b) => ts(b.x.at) - ts(a.x.at));
  const next = S.trends.map(t => ts(t.validUntil)).filter(Boolean).sort()[0];
  out.push(section('Rating changes', null, changes.length
    ? h('ul', { class: 'changes' }, changes.slice(0, 40).map(({ t, x }) => h('li', null, h('time', { text: when(str(x.at).slice(0, 10)) }),
        h('button', { class: 'link', type: 'button', onclick: () => openTrend(t.id) }, t.title), h('span', { text: RINGS[x.from].label + ' to ' + RINGS[x.ring].label + (x.note ? '. ' + x.note : '') }))))
    : h('p', { class: 'muted', text: 'No rating changes yet. Ratings are reviewed every quarter' + (next ? '; the next review is on ' + fmtDay(next) : '') + '.' })));
  return out;
}

function pageSearch() {
  const raw = S.q.trim(), q = raw.toLowerCase().split(/\s+/).filter(Boolean);
  if (!q.length) return [h('p', { class: 'muted', text: 'Search trends, news and sources.' })];
  const hit = (...f) => { const s = f.map(str).join(' ').toLowerCase(); return q.every(w => s.includes(w)); };
  const tr = S.trends.filter(t => hit(t.title, t.short, t.line, expertOf(t).map(x => x.by + ' ' + x.text).join(' '), Array.isArray(t.why) ? t.why.join(' ') : t.why, Array.isArray(t.analysts) ? t.analysts.map(a => a.by + ' ' + a.as).join(' ') : '', AREAS[t.area].label, RINGS[t.ring].label));
  const nw = S.news.filter(n => hit(n.title, n.take, n.src.name)).slice(0, 12);
  const so = S.sources.filter(s => hit(s.name, s.focus)).slice(0, 6);
  const out = [];
  if (tr.length) out.push(section('Trends', String(tr.length), h('div', { class: 'rows' }, tr.map(t => trendRow(t, t.line)))));
  if (nw.length) out.push(section('News', String(nw.length), h('div', { class: 'news' }, nw.map(n => newsItem(n, true)))));
  if (so.length) out.push(section('Sources', String(so.length), h('ul', { class: 'slist' }, so.map(s => h('li', null, linkOut(s.url, s.name), h('small', { text: s.focus }))))));
  if (!tr.length && !nw.length && !so.length) out.push(h('p', { class: 'muted', text: 'Nothing matches “' + raw + '”.' }));
  return out;
}

function pageAbout() {
  const m = S.meta || {}, basis = Array.isArray(m.basis) ? m.basis : [];
  const out = [h('p', { class: 'lead', style: 'margin:0', text: plural(S.trends.length, 'stable megatrend') + ', sorted by how soon management should act. Fresh news is added every 12 hours, from ' + S.sources.length + ' top-tier sources only.' })];
  out.push(section('How long a rating holds', null, h('p', { class: 'muted', text: 'Each trend\u2019s ring is reviewed every quarter and stays valid until the date on the trend, so trends do not come and go with the news. A move between reviews needs two top-tier sources. News on each trend is added every 12 hours. The ' + S.trends.length + ' trends are defined so they do not overlap: each one says what it covers and what belongs elsewhere.' })));
  out.push(section('Movements', null, h('p', { class: 'muted', text: 'A small arrow next to a dot means its rating changed in the last 90 days: pointing to the centre, it became more urgent; pointing outward, less urgent. A dashed line shows a move since your last visit.' })));
  out.push(section('The rings', null, h('ul', { class: 'rings' }, RO.map(r => h('li', { class: 'c-' + r }, h('i'), h('b', { text: RINGS[r].label }), h('span', { text: RINGS[r].hint }))))));
  out.push(section('New for you', null, h('p', { class: 'muted', text: 'Orange dots mark trends with news you have not opened yet. Opening a trend or a news item clears them. A white Hot read or Hot listen label marks the few stories each scan rates as must-read or must-listen. ' + (Me.mode === 'account' ? 'Your reading state is saved to your account, so it follows you to other devices.' : Me.mode === 'browser' ? 'Your reading state is saved in this browser.' : 'Your reading state lasts for this visit only.') }), h('button', { class: 'link', type: 'button', onclick: resetNew }, 'Show the last 7 days as new again', ic('i-chev'))));
  out.push(section('Motion', null, h('p', { class: 'muted', text: 'The pause button at the top stops the radar beam and the news bar from moving. It starts paused if your device asks for reduced motion.' })));
  if (basis.length) out.push(section('Built on the big trend reports', null, h('div', { class: 'basis' }, basis.map(b => h('span', { text: b }))), m.nextTaxonomyReview ? h('p', { class: 'fine', text: 'Next review of the megatrends: ' + str(m.nextTaxonomyReview).replace(/^After /, 'after ') + '.' }) : null));
  out.push(section('Sources', String(S.sources.length), STYPES.map(([k, l]) => {
    const list = S.sources.filter(s => s.type === k).sort((a, b) => str(a.name).localeCompare(str(b.name)));
    return list.length ? fold('st-' + k, l, list.length, h('ul', { class: 'slist' }, list.map(s => h('li', null, linkOut(s.url, s.name), h('small', { text: s.focus }))))) : null;
  })));
  if (S.scans.length) out.push(section('Recent scans', null, h('ol', { class: 'scans' }, S.scans.slice(0, 6).map(s => h('li', null, h('time', { text: ts(s.at) ? F.scan.format(new Date(ts(s.at))) : '' }), h('span', { text: s.note }))))));
  out.push(section('Keyboard', null, h('ul', { class: 'keys' },
    [['⌘K or /', 'Search'], ['L', 'All trends as a list'], ['N', 'News'], ['B', 'News briefing'], ['P', 'Pause or play motion'], ['1 to 4', 'Zoom into an area'], ['+ and −', 'Zoom in or out (or scroll, pinch, double-click)'], ['0', 'Show the whole radar'], ['Arrow keys', 'Move between dots, news or trends'], ['Esc', 'Back']].map(([k, l]) => [h('kbd', { text: k }), h('span', { text: l })]))));
  return out;
}
