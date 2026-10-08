#!/usr/bin/env python3
"""Build public/radar-data.json from an ArtifactData export folder.

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
    news, months = [], []
    for m in sorted(glob.glob(os.path.join(src, 'feed', '*', 'items')), reverse=True):
        months.append(os.path.basename(os.path.dirname(m)))
        news += load_dir(m)
    news.sort(key=lambda n: (str(n.get('seen') or n.get('at') or '')), reverse=True)
    meta = {}
    p = os.path.join(src, 'meta', 'status.json')
    if os.path.exists(p):
        with open(p, encoding='utf-8') as fh:
            meta = json.load(fh)
    meta['months'] = months or meta.get('months', [])
    scans = sorted(load_dir(os.path.join(src, 'scans')), key=lambda s: str(s.get('at', '')), reverse=True)[:8]
    data = {'meta': meta, 'trends': trends, 'news': news, 'sources': load_dir(os.path.join(src, 'sources')), 'scans': scans}
    if len(trends) < 10 or not news:
        sys.exit('Refusing to write: export looks incomplete (%d trends, %d news).' % (len(trends), len(news)))
    tmp = dst + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, dst)
    print('Wrote %s: %d trends, %d news, %d sources, last scan %s' % (dst, len(trends), len(news), len(data['sources']), meta.get('lastScan')))

if __name__ == '__main__':
    main()
