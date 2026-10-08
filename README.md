# Tech Trend Radar

A one-page radar of 20 technology megatrends for technology leaders, with news from top-tier sources
added every 12 hours. Static site: plain HTML5, no framework, no build step, no external libraries.

```
public/index.html        the whole app (HTML, CSS and JS in one file)
public/radar-data.json   trends, news, sources (updated automatically every 12 hours)
public/_headers          security and caching headers
scripts/build_data.py    turns a database export into public/radar-data.json
wrangler.jsonc           Cloudflare config (serves ./public)
```

## How updates flow

1. A scheduled Claude task scans top-tier sources every 12 hours (00:29 and 12:29 UTC).
2. It writes the results to the radar's database, rebuilds `public/radar-data.json` and commits it here.
3. Cloudflare sees the commit and republishes the site within a minute or two.

## Cloudflare settings

Use **either** of these; both serve the `public` folder.

**Workers (default for new projects)** — Workers & Pages → Create → Import a repository → this repo.
Leave the build command empty; the deploy command `npx wrangler deploy` reads `wrangler.jsonc`.

**Pages** — Workers & Pages → Create → Pages → Connect to Git → this repo.
Framework preset: None. Build command: empty. Build output directory: `public`.

## Embedding in SharePoint

Allow the site's domain under Site settings → HTML Field Security, then add an Embed web part:
`<iframe src="https://YOUR-SITE/" width="100%" height="820" style="border:0"></iframe>`
`_headers` already allows framing from SharePoint and Teams.

## Local preview

`python3 -m http.server -d public 8000` and open http://localhost:8000
