#!/usr/bin/env node
// Feature test of the built site in standalone mode, at Windows-style fractional scaling (Edge at 125 % and 150 %):
// crisp radar placement, wheel zoom (mouse) versus pan (touchpad), drag without a stray click, Top ranking,
// Hot scarcity, My focus, and momentum on the trend page. Same setup as tests/smoke.mjs.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const types = { '.html': 'text/html', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { res.writeHead(200, { 'content-type': types[extname(path) || '.html'] || 'application/octet-stream' }).end(await readFile(join(root, path === '/' ? 'index.html' : path.replace(/\.\.+/g, '')))); }
  catch { res.writeHead(404).end(); }
}).listen(0);
const url = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const problems = [], check = (ok, msg) => { if (!ok) problems.push(msg); };

for (const dpr of [1.25, 1.5]) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const tag = 'dpr ' + dpr + ': ';
  page.on('pageerror', e => problems.push(tag + e.message));
  await page.goto(url);
  await page.waitForFunction(() => document.querySelectorAll('.blip').length > 0 && document.querySelector('.fc'));
  await page.waitForTimeout(900);

  // The radar box starts on a whole device pixel.
  const off = await page.evaluate(() => { const b = document.getElementById('rbox').getBoundingClientRect(), d = devicePixelRatio; return [b.left * d % 1, b.top * d % 1].map(v => Math.min(v, 1 - v)); });
  check(off.every(v => v < .02), tag + 'radar not on whole device pixels ' + off);

  const box = await page.locator('#rbox').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const k = () => page.evaluate(() => getComputedStyle(document.getElementById('rbox')).getPropertyValue('--k') || document.getElementById('rbox').className);
  // Touchpad scroll at full view must not zoom (Edge sends small fractional deltas).
  await page.mouse.move(cx, cy);
  const before = await page.evaluate(() => document.querySelector('#g-bands circle').getAttribute('r'));
  await page.mouse.wheel(0, 12.5);
  await page.waitForTimeout(400);
  check(await page.evaluate(() => document.querySelector('#g-bands circle').getAttribute('r')) === before, tag + 'touchpad scroll zoomed the radar');
  // A mouse wheel notch zooms in.
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(700);
  check(await page.locator('#rbox.zoomed').count() === 1, tag + 'mouse wheel did not zoom');
  // Drag to pan, then release over a dot: no trend may open.
  const page0 = await page.evaluate(() => document.getElementById('panel').dataset.page);
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(cx + i * 12, cy + i * 6);
  await page.mouse.up();
  await page.waitForTimeout(150);
  check(await page.evaluate(() => document.getElementById('panel').dataset.page) === page0, tag + 'drag ended in a click');
  await page.keyboard.press('0');
  await page.waitForTimeout(900);

  // Top: ranked by heat, Hot is scarce (at most 6, one per trend).
  await page.locator('.chip', { hasText: 'Top' }).click();
  await page.waitForTimeout(300);
  const hot = await page.evaluate(() => [...document.querySelectorAll('.fc')].map(c => ({ t: c.dataset.t, hot: !!c.querySelector('.pillhot') })));
  const hots = hot.filter(x => x.hot);
  check(hots.length <= 6, tag + 'hot count ' + hots.length); // zero is fine when the data is older than 14 days
  check(new Set(hots.map(x => x.t)).size === hots.length, tag + 'two hot stories on one trend');
  check(!hots.length || hot[0].hot, tag + 'Top does not start with a hot story');

  // My focus: type terms, stories match, non-matching trends dim on the radar.
  await page.locator('.chip', { hasText: 'My focus' }).click();
  await page.locator('.focus-in').fill('NIS2, bank, quantum');
  await page.locator('.focus button[type=submit]').click();
  await page.waitForTimeout(300);
  const f = await page.evaluate(() => ({ cards: document.querySelectorAll('.fc').length, terms: document.querySelectorAll('.term').length, dim: document.querySelectorAll('.blip.dim').length, all: document.querySelectorAll('.blip').length }));
  check(f.terms === 3 && f.cards > 0, tag + 'focus did not match ' + JSON.stringify(f));
  check(f.dim > 0 && f.dim < f.all, tag + 'focus did not highlight trends ' + JSON.stringify(f));
  // Pasted prose is reduced to terms.
  await page.locator('.focus .link', { hasText: 'Edit' }).click();
  await page.locator('.focus-in').fill('We are a mid-sized German insurer moving claims processing to sovereign cloud while meeting DORA and NIS2 duties and piloting AI agents.');
  await page.locator('.focus button[type=submit]').click();
  await page.waitForTimeout(300);
  const terms = await page.evaluate(() => [...document.querySelectorAll('.term')].map(t => t.textContent));
  check(terms.length >= 3 && terms.length <= 12 && terms.includes('dora'), tag + 'prose focus terms ' + terms);
  console.log(tag, 'top', hot.length, 'hot', hots.length, 'focus', JSON.stringify(f), 'prose', terms.join(', '));
  await page.locator('.chip', { hasText: 'All' }).click();

  // Momentum on the trend page.
  await page.locator('.blip').first().click();
  await page.waitForTimeout(500);
  check(await page.locator('.mom .spark rect').count() === 8, tag + 'no momentum bars on the trend page');
  // Area labels.
  check((await page.locator('.quad').allTextContents()).join('|') === 'Business & AI|Risk & regulation|Platforms & data|Emerging tech', tag + 'area labels');
  await page.screenshot({ path: process.env.SHOT_DIR ? join(process.env.SHOT_DIR, 'features-' + dpr + '.png') : '/dev/null' }).catch(() => {});
  await ctx.close();
}
await browser.close();
server.close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('ok: feature test passed');
