/* App state (S), per-viewer reading state (Me) and the derived view (D): what is new, what moved. */
const S = {
  // data
  trends: [], byId: new Map(), news: [], byT: new Map(), sources: [], scans: [], meta: null,
  months: {}, subs: {}, loading: null, db: null,
  ok: { trends: false, news: false, me: false }, problem: '',
  // view
  ring: null, quad: null, sel: null, newsTab: null, archM: null, q: '', open: new Set()
};
// Derived per viewer on every refresh: news counts per trend, moves since the last visit, moves in the last 90 days.
let D = { since: 0, newBy: new Map(), total: 0, moved: new Map(), recent: new Map() };

/* ---------- what is new for this viewer ---------- */
// Kept in the viewer's private db subtree when the account allows it, else in this browser, else for this visit only.
const Me = {
  d: { v: 4, mark: null, opened: {}, seenT: {}, last: null, prev: null },
  ref: null, mode: 'visit', busy: false, again: false, timer: 0,
  load(x) {
    if (!x || typeof x !== 'object') return;
    const d = this.d;
    if (ts(x.mark)) d.mark = str(x.mark);
    if (x.opened && typeof x.opened === 'object') for (const k in x.opened) if (typeof x.opened[k] === 'number') d.opened[k] = x.opened[k];
    if (x.seenT && typeof x.seenT === 'object') for (const k in x.seenT) if (ts(x.seenT[k])) d.seenT[k] = str(x.seenT[k]);
    if (ts(x.last)) d.last = str(x.last);
    if (ts(x.prev)) d.prev = str(x.prev);
  },
  async init(db, user) {
    let uid = null;
    try { uid = user && typeof user.id === 'function' ? await user.id() : null; } catch (e) { uid = null; }
    if (db && uid) {
      try {
        const ref = db.doc('data/users/' + uid + '/state'), snap = await ref.get();
        this.ref = ref;
        this.mode = 'account';
        this.load(snap.exists ? snap.data() : ls.get('me'));
      } catch (e) { this.ref = null; }
    }
    if (!this.ref) { this.load(ls.get('me')); this.mode = ls.set('probe', 1) ? 'browser' : 'visit'; }
    const now = Date.now(), last = ts(this.d.last);
    if (!last || now - last > 30 * 6e4) { this.d.prev = this.d.last; this.d.last = new Date(now).toISOString(); this.save(); }
  },
  save() { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 700); },
  async flush() {
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    this.prune();
    const body = JSON.parse(JSON.stringify(this.d));
    if (this.ref) {
      try { await this.ref.set(body); }
      catch (e) { this.ref = null; this.mode = ls.set('me', body) ? 'browser' : 'visit'; }
    } else if (this.mode === 'browser') ls.set('me', body);
    this.busy = false;
    if (this.again) { this.again = false; this.flush(); }
  },
  prune() {
    const s = since(), o = this.d.opened;
    for (const k of Object.keys(o)) if (o[k] <= s) delete o[k];
    const left = Object.keys(o);
    if (left.length > 500) left.sort((a, b) => o[a] - o[b]).slice(0, left.length - 500).forEach(k => delete o[k]);
  }
};
function since() { const m = ts(Me.d.mark), now = Date.now(); return m ? Math.max(m, now - 21 * DAY) : now - 7 * DAY; }
function derive() {
  const s = since(), by = new Map();
  let total = 0;
  for (const n of S.news) {
    const t = ts(n.seen) || ts(n.at);
    n._new = S.ok.me && !n.minor && t > s && !Me.d.opened[n.id] && tkeys(n).some(k => S.byId.has(k));
    if (n._new) { total++; for (const k of tkeys(n)) if (S.byId.has(k)) by.set(k, (by.get(k) || 0) + 1); }
  }
  const moved = new Map();
  if (S.ok.me) for (const t of S.trends) {
    const after = Math.max(s, ts(Me.d.seenT[t.id]));
    let mv = null;
    for (const x of Array.isArray(t.history) ? t.history : []) if (x && RINGS[x.from] && x.from !== x.ring && x.ring === t.ring && ts(x.at) > after) mv = x;
    if (mv) moved.set(t.id, mv);
  }
  const recent = new Map(), cut = Date.now() - 90 * DAY;
  for (const t of S.trends) {
    const h0 = (Array.isArray(t.history) ? t.history : []).filter(x => x && RINGS[x.from] && RINGS[x.ring] && x.from !== x.ring && ts(x.at) > cut).pop();
    if (h0) recent.set(t.id, { up: RO.indexOf(h0.ring) < RO.indexOf(h0.from), x: h0 });
  }
  D = { since: s, newBy: by, total, moved, recent };
}
function markNews(items, force) {
  let ch = !!force;
  for (const n of items) if (!Me.d.opened[n.id]) { Me.d.opened[n.id] = ts(n.seen) || ts(n.at) || Date.now(); ch = true; }
  if (ch) { Me.save(); refresh(true); }
}
function markAll() {
  let mx = Date.now();
  for (const n of S.news) mx = Math.max(mx, ts(n.seen));
  Me.d.mark = new Date(mx).toISOString();
  Me.d.opened = {};
  Me.d.seenT = {};
  Me.save();
  refresh();
  toast('All caught up');
}
let markT = 0;
function scheduleMark(id) {
  clearTimeout(markT);
  markT = setTimeout(() => {
    const c = cur();
    if (c.page !== 'trend' || c.arg !== id) return;
    Me.d.seenT[id] = new Date().toISOString();
    markNews((S.byT.get(id) || []).filter(n => n._new), true);
  }, 1400);
}
