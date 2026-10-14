#!/usr/bin/env python3
"""Merge scan deltas from data/inbox/ into the database export in data/export/.

The scheduled scan does not push a whole database export any more. It pushes one small JSON file per run,
data/inbox/<scan-id>.json, holding only what that run wrote:

  {
    "scan":    {"id": "2026-10-14T00-36Z", "at": "...", "news": 4, "note": "..."},
    "meta":    {"lastScan": "...", "months": ["2026-10"], "sweep": 114},          (fields to merge into meta/status)
    "news":    [{"id": "...", "month": "2026-10", "at": "...", "t": "...", ...}],  (new or updated feed items)
    "trends":  [{"id": "...", ...full trend document...}],                         (only trends that changed)
    "sources": [{"id": "...", ...}]                                                (only sources added or changed)
  }

This script validates every entry (ids are plain slugs, documents are objects, nothing outside the public
collections), writes it into data/export/ in the same layout ArtifactData uses, and deletes the inbox file.
A file that fails validation is renamed to .rejected (kept for inspection) and does not block the others.
It only reads and writes JSON; it never executes anything it reads.

Usage: python3 scripts/merge_inbox.py [data/inbox] [data/export]
"""
import json, os, re, sys, glob

SLUG = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.:@+~-]{0,199}$')
MONTH = re.compile(r'^\d{4}-\d{2}$')
MAX_BYTES = 2_000_000


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    os.replace(tmp, path)


def doc_body(d):
    body = {k: v for k, v in d.items() if k not in ('id', 'month')}
    return body


def merge_one(path, export):
    if os.path.getsize(path) > MAX_BYTES:
        raise ValueError('inbox file too large')
    with open(path, encoding='utf-8') as fh:
        box = json.load(fh)
    if not isinstance(box, dict):
        raise ValueError('inbox file is not an object')
    counts = {'news': 0, 'trends': 0, 'sources': 0}
    for item in box.get('news') or []:
        if not isinstance(item, dict) or not SLUG.match(str(item.get('id', ''))):
            raise ValueError('bad news item id: %r' % (item.get('id') if isinstance(item, dict) else item))
        month = str(item.get('month') or str(item.get('seen') or item.get('at') or '')[:7])
        if not MONTH.match(month):
            raise ValueError('bad month for %s' % item['id'])
        write(os.path.join(export, 'feed', month, 'items', item['id'] + '.json'), doc_body(item))
        counts['news'] += 1
    for coll in ('trends', 'sources'):
        for d in box.get(coll) or []:
            if not isinstance(d, dict) or not SLUG.match(str(d.get('id', ''))):
                raise ValueError('bad %s id' % coll)
            p = os.path.join(export, coll, d['id'] + '.json')
            if coll == 'trends' and not os.path.exists(p):
                raise ValueError('unknown trend %s (trends are never added by a scan)' % d['id'])
            write(p, doc_body(d))
            counts[coll] += 1
    meta = box.get('meta')
    if isinstance(meta, dict) and meta:
        p = os.path.join(export, 'meta', 'status.json')
        cur = {}
        if os.path.exists(p):
            with open(p, encoding='utf-8') as fh:
                cur = json.load(fh)
        cur.update({k: v for k, v in meta.items() if k != 'id'})
        months = set(cur.get('months') or [])
        months.update(os.path.basename(os.path.dirname(m)) for m in glob.glob(os.path.join(export, 'feed', '*', 'items')))
        cur['months'] = sorted((m for m in months if MONTH.match(str(m))), reverse=True)
        write(p, cur)
    scan = box.get('scan')
    if isinstance(scan, dict) and SLUG.match(str(scan.get('id', ''))):
        write(os.path.join(export, 'scans', scan['id'] + '.json'), doc_body(scan))
    return counts


def main():
    inbox = sys.argv[1] if len(sys.argv) > 1 else 'data/inbox'
    export = sys.argv[2] if len(sys.argv) > 2 else 'data/export'
    files = sorted(glob.glob(os.path.join(inbox, '*.json')))
    if not files:
        print('Inbox empty')
        return
    failed = 0
    for f in files:
        try:
            c = merge_one(f, export)
            os.remove(f)
            print('Merged %s: %d news, %d trends, %d sources' % (os.path.basename(f), c['news'], c['trends'], c['sources']))
        except (ValueError, json.JSONDecodeError, OSError) as e:
            failed += 1
            os.replace(f, f + '.rejected')
            print('::warning::Rejected %s: %s (kept as .rejected)' % (os.path.basename(f), e))
    print('%d merged, %d rejected' % (len(files) - failed, failed))


if __name__ == '__main__':
    main()
