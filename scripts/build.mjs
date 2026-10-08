#!/usr/bin/env node
// Builds the single-file page from src/ (no dependencies, Node 18+).
//   node scripts/build.mjs          writes public/index.html (static site) and dist/artifact.html (Claude artifact)
//   node scripts/build.mjs --check  fails if public/index.html is out of date or the script has a syntax error
// The page must stay one self-contained file so it can run in a SharePoint/Teams iframe and as a Claude artifact.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const list = (dir, ext) => readdirSync(join(root, dir)).filter(f => f.endsWith(ext)).sort().map(f => join(dir, f));

const TITLE = 'Tech Trend Radar';
const DESCRIPTION = 'A radar of technology megatrends for technology leaders, with news from top-tier sources every 12 hours.';
const FAVICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0b0b0d"/><circle cx="16" cy="16" r="11" fill="none" stroke="#ffffff66" stroke-width="2"/><path d="M16 16V5a11 11 0 0 1 10.5 7.6z" fill="#ff9f0a"/><circle cx="16" cy="16" r="2.5" fill="#fff"/></svg>');

const css = list('src/styles', '.css').map(f => read(f).trim()).join('\n\n');
const js = list('src/app', '.js').map(f => '// ---- ' + f.split('/').pop() + '\n' + read(f).trim()).join('\n\n');
const script = "(() => {\n'use strict';\n\n" + js + '\n})();';

// Syntax check without running the app.
new vm.Script(script, { filename: 'app.js' });

const shell = read('src/index.html').replace(/^<!--[^\n]*-->\n/, '');
const body = shell.replace('<!-- @head -->\n', '').replace('<!-- @script -->', () => '<script>\n' + script + '\n</script>') .trim(); // a function, so $ in the code is not read as a replace pattern
const style = '<style>\n' + css + '\n</style>';

const artifact = '<title>' + TITLE + '</title>\n' + style + '\n' + body + '\n';
const site = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta name="color-scheme" content="dark">',
  '<meta name="referrer" content="no-referrer">',
  '<meta name="description" content="' + DESCRIPTION + '">',
  '<link rel="icon" href="' + FAVICON + '">',
  '<title>' + TITLE + '</title>',
  style,
  '</head>',
  '<body>',
  body,
  '</body>',
  '</html>',
  ''
].join('\n');

if (process.argv.includes('--check')) {
  const now = read('public/index.html');
  if (now !== site) { console.error('public/index.html is out of date. Run: node scripts/build.mjs'); process.exit(1); }
  console.log('ok: build is up to date');
} else {
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'public/index.html'), site);
  writeFileSync(join(root, 'dist/artifact.html'), artifact);
  console.log('public/index.html ' + (site.length / 1024).toFixed(1) + ' KB, dist/artifact.html ' + (artifact.length / 1024).toFixed(1) + ' KB');
}
