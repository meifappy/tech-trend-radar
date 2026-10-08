#!/usr/bin/env python3
"""Build the website data from an ArtifactData export folder.

Writes public/radar-data.json (trends, sources, scans and the two most recent months of news)
and public/archive/<YYYY-MM>.json (every month of news, the archive). Nothing is ever deleted:
each run rewrites the files from the full database, so new stories appear and old ones stay.

Usage: python3 scripts/build_data.py <export-dir> [public/radar-data.json]

<export-dir> is what ArtifactData writes with out_dir: trends/*.json, sources/*.json,
scans/*.json, meta/status.json and feed/<YYYY-MM>/items/*.json (file name = document id).
The script only reads JSON and writes one JSON file; it never executes anything it reads.
"""
import json, os, sys, glob

def load_dir(path):
    out = []
    for f in sorted(glob.glob(os.path.join(path, '*.json'))):
        with open(f, encoding='utf-8') as fh:
            doc = json.load(fh)
        if isinstance(doc, dict):
            doc['id'] = os.path.splitext(os.path.basename(f))[0]
            out.append(doc)
    return out

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'public', 'radar-data.json')
    trends = [t for t in load_dir(os.path.join(src, 'trends')) if t.get('status') != 'archived']
    for t in trends:
        for k in ('owners', 'lens'):
            t.pop(k, None)
    by_month = {}
    for m in sorted(glob.glob(os.path.join(src, 'feed', '*', 'items')), reverse=True):
        key = os.path.basename(os.path.dirname(m))
        items = load_dir(m)
        for n in items:
            n['month'] = key
        items.sort(key=lambda n: (str(n.get('seen') or n.get('at') or '')), reverse=True)
        by_month[key] = items
    months = sorted(by_month, reverse=True)
    recent = months[:2]
    news = [n for m in recent for n in by_month[m]]
    meta = {}
    p = os.path.join(src, 'meta', 'status.json')
    if os.path.exists(p):
        with open(p, encoding='utf-8') as fh:
            meta = json.load(fh)
    meta['months'] = months or meta.get('months', [])
    scans = sorted(load_dir(os.path.join(src, 'scans')), key=lambda s: str(s.get('at', '')), reverse=True)[:8]
    data = {'meta': meta, 'trends': trends, 'news': news, 'recentMonths': recent, 'sources': load_dir(os.path.join(src, 'sources')), 'scans': scans}
    if len(trends) < 10 or not news:
        sys.exit('Refusing to write: export looks incomplete (%d trends, %d news).' % (len(trends), len(news)))
    def write(path, obj):
        tmp = path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as fh:
            json.dump(obj, fh, ensure_ascii=False, separators=(',', ':'))
        os.replace(tmp, path)
    write(dst, data)
    arch = os.path.join(os.path.dirname(os.path.abspath(dst)), 'archive')
    os.makedirs(arch, exist_ok=True)
    for m, items in by_month.items():
        write(os.path.join(arch, m + '.json'), {'month': m, 'news': items})
    print('Wrote %s: %d trends, %d recent news, %d archive months, %d sources, last scan %s' % (dst, len(trends), len(news), len(by_month), len(data['sources']), meta.get('lastScan')))

if __name__ == '__main__':
    main()
