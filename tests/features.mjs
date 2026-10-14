#!/usr/bin/env node
// Feature test of the built site in standalone mode, at Windows-style fractional scaling (Edge at 125 % and 150 %):
// crisp radar placement, map-style wheel zoom (eased mouse notches, proportional touchpad), sideways pan, drag
// without a stray click, calm mode (reduced motion) cutting instead of flying, Top ranking,
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
  // Wheel as on web maps. The outer ring's radius tells the zoom level.
  const ring = () => page.evaluate(() => +document.querySelector('#g-bands circle').getAttribute('r'));
  await page.mouse.move(cx, cy);
  const r0 = await ring();
  // A touchpad scroll (small pixel deltas) zooms a little, in proportion.
  await page.mouse.wheel(0, -12.5);
  await page.waitForTimeout(250);
  const r1 = await ring();
  check(r1 > r0 * 1.02 && r1 < r0 * 1.15, tag + 'touchpad zoom not proportional ' + (r1 / r0).toFixed(3));
  await page.keyboard.press('0'); await page.waitForTimeout(900);
  // A mouse notch zooms one eased step (x1.3 at 100 %), also when deltaY is fractional (66.7 px at 150 % scaling).
  const want = Math.exp(100 / dpr * .0026);
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(40);
  const rMid = await ring();
  await page.waitForTimeout(600);
  const r2 = await ring();
  check(Math.abs(r2 / r0 - want) < .03, tag + 'mouse notch zoom ' + (r2 / r0).toFixed(3) + ' want ' + want.toFixed(3));
  check(rMid > r0 && rMid < r2, tag + 'mouse zoom is not eased');
  check(await page.locator('#rbox.zoomed').count() === 1, tag + 'mouse wheel did not zoom');
  // A sideways swipe pans the zoomed radar.
  const cx0 = await page.evaluate(() => +document.querySelector('#g-bands circle').getAttribute('cx'));
  await page.mouse.wheel(40, 0);
  await page.waitForTimeout(250);
  check(await page.evaluate(() => +document.querySelector('#g-bands circle').getAttribute('cx')) < cx0, tag + 'sideways swipe did not pan');
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
  await page.locator('.chip-focus').click();
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
  // The focus is a lens over every filter: All and Top stay filtered, and it can be switched off.
  await page.locator('.chip', { hasText: 'All' }).first().click();
  await page.waitForTimeout(300);
  check(await page.locator('.focus-s').count() === 1, tag + 'focus lens not shown on All');
  await page.locator('.chip-focus').click();
  await page.waitForTimeout(300);
  check(await page.locator('.focus-s').count() === 0 && (await page.locator('.blip.dim').count()) === 0, tag + 'focus did not switch off');
  await page.locator('.chip-focus').click();
  await page.waitForTimeout(300);
  console.log(tag, 'top', hot.length, 'hot', hots.length, 'focus', JSON.stringify(f), 'prose', terms.join(', '));
  await page.locator('.chip', { hasText: 'All' }).click();

  // Momentum on the trend page.
  await page.locator('.blip').first().click();
  await page.waitForTimeout(500);
  check(await page.locator('.mom .spark rect').count() === 8, tag + 'no momentum bars on the trend page');
  // No categories: no area buttons or area chips.
  check(await page.locator('.quad').count() === 0 && !(await page.locator('.chip', { hasText: 'Risk' }).count()), tag + 'area categories still shown');
  await page.screenshot({ path: process.env.SHOT_DIR ? join(process.env.SHOT_DIR, 'features-' + dpr + '.png') : '/dev/null' }).catch(() => {});
  await ctx.close();
}
// Calm mode (Windows "Animation effects" off reports reduced motion): the camera still glides, shorter, and
// the play button brings motion back.
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push('calm: ' + e.message));
  await page.goto(url);
  await page.waitForFunction(() => document.querySelectorAll('.blip').length > 0);
  check(await page.evaluate(() => document.documentElement.classList.contains('calm')), 'calm: class not set');
  // Reduced motion still glides (no hard cut): mid-flight the outer ring is between its start and end size.
  const rr = () => page.evaluate(() => +document.querySelector('#g-bands circle').getAttribute('r'));
  await page.locator('#z-in').click(); await page.locator('#z-in').click();
  await page.waitForTimeout(400);
  const a0 = await rr();
  await page.keyboard.press('0');
  await page.waitForTimeout(150);
  const aMid = await rr();
  await page.waitForTimeout(700);
  const a1 = await rr();
  check(aMid < a0 * .98 && aMid > a1 * 1.02, 'calm: zoom out jumped instead of gliding ' + [a0, aMid, a1].map(Math.round));
  check(await page.locator('#rbox.zoomed').count() === 0, 'calm: zoom out did not finish');
  await page.locator('#t-motion').click();
  check(!(await page.evaluate(() => document.documentElement.classList.contains('calm'))), 'calm: play button did not turn motion on');
  await ctx.close();
}
// The rings draw in at once on load, before the data arrives (no flash of empty rings).
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.route('**/radar-data.json', async r => { await new Promise(res => setTimeout(res, 800)); await r.continue(); });
  await page.goto(url);
  await page.waitForTimeout(150);
  check(await page.evaluate(() => document.getElementById('g-bands').getAnimations().length === 1), 'boot: rings do not draw in on load');
  await page.waitForFunction(() => document.querySelectorAll('.blip').length > 0);
  await page.waitForTimeout(100);
  check(await page.evaluate(() => document.getElementById('g-bands').getAnimations().length === 0), 'boot: rings animate again when the data arrives');
  await ctx.close();
}
// First visit: the optional tour is offered, walks through its steps by itself in about 15 s and can be skipped.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push('tour: ' + e.message));
  await page.goto(url);
  await page.waitForSelector('.tour-offer', { timeout: 8000 }).catch(() => problems.push('tour: not offered on the first visit'));
  await page.locator('.tour-go').click();
  await page.waitForTimeout(500);
  const first = await page.locator('.tour-tip').textContent();
  await page.waitForTimeout(2400);
  check(first && (await page.locator('.tour-tip').textContent()) !== first, 'tour: did not move on by itself');
  await page.locator('.tour-x').click();
  check(await page.locator('.tour').count() === 0, 'tour: Skip did not end it');
  await page.reload(); await page.waitForTimeout(3500);
  check(await page.locator('.tour-offer').count() === 0, 'tour: offered again on the second visit');
  await ctx.close();
}
await browser.close();
server.close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('ok: feature test passed');
