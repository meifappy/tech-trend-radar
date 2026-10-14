# Tech Trend Radar

A daily start page for technology leaders: 23 stable technology megatrends on one radar, with factual news
from top-tier sources added every 12 hours. Static site, plain HTML5, no framework, no runtime dependencies.

## Layout

```
src/index.html            page shell (markup and icons)
src/styles/*.css          styles, in cascade order: tokens, base, layout, radar, panel, dock and briefing, responsive, preferences
src/app/*.js              app code, in load order (helpers → data → radar → panel → start); one closure, no globals
scripts/build.mjs         joins src/ into public/index.html (static site) and dist/artifact.html (Claude artifact)
scripts/merge_inbox.py    merges the scan deltas in data/inbox/ into data/export/ (validated JSON only)
scripts/sync_export.py    copies a fresh full database export into data/export/ (fallback when a scan cannot push)
scripts/build_data.py     turns data/export/ into public/radar-data.json and public/archive/<YYYY-MM>.json
data/inbox/               one small delta file per scan run, pushed by the scheduled scan
data/export/              the full database as JSON (merged deltas, or a full export)
tests/smoke.mjs           opens the built site at desktop and phone size and fails on errors
tests/features.mjs        Edge-style 125/150 % scaling, wheel and touchpad, drag, Top, Hot, My focus, momentum
docs/UX-REQUIREMENTS.md   user-flow audit, functional and non-functional requirements
docs/SOURCING.md          how each scan discovers, verifies, scores and selects stories
docs/RANKING.md           heat, Hot, Top, momentum and My focus
public/                   what Cloudflare serves: index.html, radar-data.json, archive/, _headers
wrangler.jsonc            Cloudflare config (serves ./public)
```

The page stays a single self-contained file because it must run inside a SharePoint or Teams iframe and as a
Claude artifact. The source is split into small files only for editing; the build puts them back together.

## Working on it

```
node scripts/build.mjs           # after any change in src/
node scripts/build.mjs --check   # CI: fails if public/index.html is out of date
python3 -m http.server -d public 8000   # preview at http://localhost:8000
node tests/smoke.mjs             # needs: npm i --no-save playwright && npx playwright install chromium
node tests/features.mjs
```

Conventions: CSS values come from the tokens in `src/styles/01-tokens.css` (colours, the seven type sizes,
motion curves). Grey means information, white semibold with › or ↗ means clickable, a small orange dot means unread (it stays until you open the story),
a white "Hot read" or "Hot listen" label marks the few must-read items (docs/RANKING.md). Each JS file starts with a one-line summary of
what it owns.

## How updates flow

1. A scheduled Claude task runs every 12 hours (00:29 and 12:29 UTC). It adds only new stories to the
   database (a delta), scores each one, flags rare must-reads as `hot`, and marks repeats as `dup` so they stay
   in the archive but out of the feed. The live Claude artifact shows the new stories at once.
2. It pushes one small file, `data/inbox/<scan-id>.json`, with exactly what it wrote. It runs no code from this
   repository.
3. The `publish-data` GitHub Action merges the inbox into `data/export/` (`scripts/merge_inbox.py`), runs
   `scripts/build_data.py` and commits `data/export/`, `public/radar-data.json` and `public/archive/`. Nothing is
   ever deleted: older months live in the archive.
4. Cloudflare redeploys on every push to `main` within a minute or two. No build command is needed.

The scan tries, in order: a GitHub file tool, plain `git push`, and `add_repo` (attaching this repository to its
session) followed by `git push`. If all are refused (the scan note then says `push: failed`), the database still has
everything: a follow-up job about 25 minutes after each scan exports it with ArtifactData, runs
`scripts/sync_export.py` and pushes, and the same Action publishes it.

## Motion

Camera flights, the radar beam and pop-ins follow the system's reduced-motion setting (on Windows, "Animation
effects"). With reduced motion the beam and pop-ins stay still but the camera still glides between views (shorter), so
nothing jumps; the play button at the top turns full motion on for that browser. Scrolling zooms around the pointer as on web maps (a mouse notch glides one step,
touchpad scrolling and pinching zoom in proportion), a sideways swipe or a drag pans.

Trend ratings hold for a quarter (`validUntil` on each trend); news changes every run. How stories and trends
are ranked is in `docs/RANKING.md`.

## Cloudflare

Workers & Pages → the project connected to this repository. Build command: empty. Deploy command:
`npx wrangler deploy` (reads `wrangler.jsonc`). For a Pages project: framework None, build command empty,
output directory `public`.

## Embedding in SharePoint

Allow the site's domain under Site settings → HTML Field Security, then add an Embed web part:
`<iframe src="https://YOUR-SITE/" width="100%" height="820" style="border:0"></iframe>`.
`public/_headers` already allows framing from SharePoint and Teams.
