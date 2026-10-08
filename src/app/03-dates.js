/* Date parsing and formatting. All dates are UTC days unless a full timestamp is given. */
const DAY = 864e5;
function ts(at) {
  at = str(at);
  if (/^\d{4}$/.test(at)) return Date.UTC(+at, 0, 1);
  if (/^\d{4}-\d{2}$/.test(at)) { const p = at.split('-'); return Date.UTC(+p[0], +p[1] - 1, 1); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return Date.parse(at + 'T00:00:00Z') || 0;
  return Date.parse(at) || 0;
}
const F = {
  day: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  dayY: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
  wday: new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }),
  month: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  visit: new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  scan: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  rel: typeof Intl.RelativeTimeFormat === 'function' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null
};
function dayDiff(t) { const n = new Date(); return Math.round((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - t) / DAY); }
function fmtDay(t) { return (new Date(t).getUTCFullYear() === new Date().getFullYear() ? F.day : F.dayY).format(new Date(t)); }
function when(at) {
  at = str(at);
  if (!at) return '';
  if (/^\d{4}$/.test(at)) return at;
  if (/^\d{4}-\d{2}$/.test(at)) return F.month.format(new Date(ts(at)));
  const t = ts(at.slice(0, 10)), d = dayDiff(t);
  if (!t) return '';
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return fmtDay(t);
}
function bucket(at) {
  at = str(at);
  if (/^\d{4}(-\d{2})?$/.test(at)) return at.length === 4 ? at : F.month.format(new Date(ts(at)));
  const t = ts(at.slice(0, 10)), d = dayDiff(t);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return F.wday.format(new Date(t));
  return fmtDay(t);
}
function ago(iso) {
  const t = ts(iso);
  if (!t || !F.rel) return '';
  const m = Math.round((Date.now() - t) / 6e4);
  if (m < 1) return 'just now';
  if (m < 60) return F.rel.format(-m, 'minute');
  if (m < 60 * 36) return F.rel.format(-Math.round(m / 60), 'hour');
  return F.rel.format(-Math.round(m / 1440), 'day');
}
