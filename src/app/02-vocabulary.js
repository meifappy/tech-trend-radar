/* The fixed vocabulary of the radar: areas (quadrants), rings, weights and expert statements. */
const AREAS = {
  ai: { label: 'AI & agents', a0: 180, cx: -.5, cy: -.5 },
  sec: { label: 'Security & trust', a0: 270, cx: .5, cy: -.5 },
  cloud: { label: 'Data & platforms', a0: 90, cx: -.5, cy: .5 },
  sci: { label: 'Frontier tech', a0: 0, cx: .5, cy: .5 }
};
const AO = ['ai', 'sec', 'cloud', 'sci'];
const RINGS = {
  act: { label: 'Act now', hint: 'Decide or move this quarter', r0: 0, r1: .44 },
  prepare: { label: 'Prepare', hint: 'Plan and pilot within 12 months', r0: .44, r1: .67 },
  watch: { label: 'Watch', hint: 'Track it, likely 1 to 3 years out', r0: .67, r1: .85 },
  horizon: { label: 'Horizon', hint: 'Research stage, 3 or more years out', r0: .85, r1: 1 }
};
const RO = ['act', 'prepare', 'watch', 'horizon'];
const STYPES = [['consultancy', 'Analysts and consultancies'], ['journal', 'Journals and management research'], ['lab', 'Research labs'], ['platform', 'Platforms and vendors'], ['public', 'Regulators, standards and associations'], ['media', 'Tech press and newsletters'], ['podcast', 'Podcasts'], ['video', 'Video']];
const weightOf = t => (t && [1, 2, 3].includes(+t.weight) ? +t.weight : 2);
const WEIGHT_R = { 1: 3.6, 2: 5.2, 3: 7.2 };
// "What experts say": sourced statements only (verbatim quotes are marked and short), never generated advice.
const expertOf = t => (Array.isArray(t && t.expert) ? t.expert.filter(x => x && x.by && x.text && safeUrl(x.url)).slice(0, 3) : []);
// "Hot": a must-read or must-listen item, flagged by the scan (about one in eight stories). Older data used "big".
const isHot = n => !!(n && (n.hot || n.big));
const hotLabel = n => (n.kind === 'podcast' ? 'Hot listen' : n.kind === 'video' ? 'Hot watch' : 'Hot read');
const hotPill = n => (isHot(n) ? h('span', { class: 'pillhot', text: hotLabel(n) }) : null);
const validTo = t => (ts(t && t.validUntil) ? fmtDay(ts(t.validUntil)) : '');
const byReading = (a, b) => RO.indexOf(a.ring) - RO.indexOf(b.ring) || AO.indexOf(a.area) - AO.indexOf(b.area) || str(a.title).localeCompare(str(b.title));
const tkeys = n => (n.t2 && n.t2 !== n.t ? [n.t, n.t2] : [n.t]);
