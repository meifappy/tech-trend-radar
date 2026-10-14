#!/usr/bin/env python3
"""Copy a fresh ArtifactData export into data/export/ (the fallback when a scan could not push its delta).

Usage: python3 scripts/sync_export.py <fresh-export-dir> [data/export]

<fresh-export-dir> is what ArtifactData writes with out_dir: trends/, sources/, scans/, meta/status.json and
feed/<YYYY-MM>/items/. Only those public collections are copied (never users/ or diag/), files are rewritten in
one stable format so unchanged documents produce no diff, and nothing already in data/export/ is deleted.
Then run scripts/build_data.py (the publish-data Action does that too). Only reads and writes JSON.
"""
import json, os, re, sys, glob

SLUG = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.:@+~-]{0,199}\.json$')
MONTH = re.compile(r'^\d{4}-\d{2}$')


def norm_write(src, dst):
    with open(src, encoding='utf-8') as fh:
        doc = json.load(fh)
    if not isinstance(doc, dict):
        raise ValueError('not an object: %s' % src)
    doc.pop('id', None)
    text = json.dumps(doc, ensure_ascii=False, indent=2) + '\n'
    if os.path.exists(dst):
        with open(dst, encoding='utf-8') as fh:
            if fh.read() == text:
                return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst + '.tmp', 'w', encoding='utf-8') as fh:
        fh.write(text)
    os.replace(dst + '.tmp', dst)
    return True


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else 'data/export'
    pairs = []
    for coll in ('trends', 'sources', 'scans'):
        for f in glob.glob(os.path.join(src, coll, '*.json')):
            pairs.append((f, os.path.join(dst, coll, os.path.basename(f))))
    for d in glob.glob(os.path.join(src, 'feed', '*', 'items')):
        month = os.path.basename(os.path.dirname(d))
        if MONTH.match(month):
            for f in glob.glob(os.path.join(d, '*.json')):
                pairs.append((f, os.path.join(dst, 'feed', month, 'items', os.path.basename(f))))
    meta = os.path.join(src, 'meta', 'status.json')
    if os.path.exists(meta):
        pairs.append((meta, os.path.join(dst, 'meta', 'status.json')))
    pairs = [(a, b) for a, b in pairs if SLUG.match(os.path.basename(a))]
    trends = sum(1 for a, _ in pairs if os.sep + 'trends' + os.sep in a)
    news = sum(1 for a, _ in pairs if os.sep + 'items' + os.sep in a)
    if trends < 10 or not news:
        sys.exit('Refusing: the export looks incomplete (%d trends, %d news).' % (trends, news))
    changed = sum(norm_write(a, b) for a, b in pairs)
    print('Synced %d documents (%d trends, %d news), %d changed' % (len(pairs), trends, news, changed))


if __name__ == '__main__':
    main()
