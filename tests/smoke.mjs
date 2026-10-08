#!/usr/bin/env node
// Smoke test of the built site in standalone mode: serves ./public, opens it at desktop and phone size,
// and fails on any script error, a missing radar, missing news, or horizontal overflow.
//   npm i --no-save playwright && npx playwright install chromium   (once)
//   node tests/smoke.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const types = { '.html': 'text/html', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const body = await readFile(join(root, path === '/' ? 'index.html' : path.replace(/\.\.+/g, '')));
    res.writeHead(200, { 'content-type': types[extname(path) || '.html'] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0);
const url = 'http://127.0.0.1:' + server.address().port + '/';

const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const problems = [];
for (const [name, viewport, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(name + ': ' + e.message));
  await page.goto(url);
  await page.waitForFunction(() => document.querySelectorAll('.blip').length > 0, null, { timeout: 10000 }).catch(() => problems.push(name + ': radar did not render'));
  const r = await page.evaluate(() => ({
    dots: document.querySelectorAll('.blip').length,
    labels: document.querySelectorAll('.lbl:not(.off)').length,
    overflow: document.documentElement.scrollWidth - innerWidth,
    news: document.querySelectorAll('.ni, .dk-body').length
  }));
  if (r.overflow > 0) problems.push(name + ': horizontal overflow ' + r.overflow + 'px');
  if (!r.news) problems.push(name + ': no news shown');
  await page.locator('.blip').first().click();
  await page.waitForTimeout(600);
  if (!(await page.locator('#p-title').count())) problems.push(name + ': trend page did not open');
  console.log(name, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
server.close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('ok: smoke test passed');
