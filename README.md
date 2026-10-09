# Tech Trend Radar

A daily start page for technology leaders: 23 stable technology megatrends on one radar, with factual news
from top-tier sources added every 12 hours. Static site, plain HTML5, no framework, no runtime dependencies.

## Layout

```
src/index.html            page shell (markup and icons)
src/styles/*.css          styles, in cascade order: tokens, base, layout, radar, panel, dock and briefing, responsive, preferences
src/app/*.js              app code, in load order (helpers → data → radar → panel → start); one closure, no globals
scripts/build.mjs         joins src/ into public/index.html (static site) and dist/artifact.html (Claude artifact)
scripts/build_data.py     turns data/export/ into public/radar-data.json and public/archive/<YYYY-MM>.json
data/export/              raw database export pushed by the scheduled scan (JSON only)
tests/smoke.mjs           opens the built site at desktop and phone size and fails on errors
docs/UX-REQUIREMENTS.md   user-flow audit, functional and non-functional requirements
docs/SOURCING.md          how each scan discovers, verifies, scores and selects stories
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
```

Conventions: CSS values come from the tokens in `src/styles/01-tokens.css` (colours, the seven type sizes,
motion curves). Grey means information, white semibold with › or ↗ means clickable, orange means new for you,
a white "Hot read" or "Hot listen" label marks must-read items. Each JS file starts with a one-line summary of
what it owns.

## How updates flow

1. A scheduled Claude task runs every 12 hours (00:29 and 12:29 UTC). It adds only new stories to the
   database (a delta), flags must-reads as `hot`, and marks repeats as `dup` so they stay in the archive
   but out of the feed.
2. It exports the database as plain JSON into `data/export/` and pushes that folder to `main`. It runs no
   code from this repository.
3. The `publish-data` GitHub Action runs `scripts/build_data.py` on `data/export/` and commits
   `public/radar-data.json` and `public/archive/`. Nothing is ever deleted: older months live in the archive.
4. Cloudflare redeploys on every push to `main` within a minute or two. No build command is needed.

Trend ratings hold for a quarter (`validUntil` on each trend); news changes every run.

## Cloudflare

Workers & Pages → the project connected to this repository. Build command: empty. Deploy command:
`npx wrangler deploy` (reads `wrangler.jsonc`). For a Pages project: framework None, build command empty,
output directory `public`.

## Embedding in SharePoint

Allow the site's domain under Site settings → HTML Field Security, then add an Embed web part:
`<iframe src="https://YOUR-SITE/" width="100%" height="820" style="border:0"></iframe>`.
`public/_headers` already allows framing from SharePoint and Teams.
