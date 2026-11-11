#!/usr/bin/env node
/* app-banner.mjs: keeps the pages in step with public/assets/e/js/stores.js, the one switch.
 *
 *   iOS live with an appId → every page gets Safari's Smart App Banner:
 *                            <meta name="apple-itunes-app" content="app-id=…">
 *                            (Safari reads it from the HTML, so it cannot come from JS.)
 *   iOS not live           → the meta is removed.
 *   any store live         → /app is indexable; before that it is noindex ("Coming soon").
 *
 *   node scripts/app-banner.mjs          write the pages
 *   node scripts/app-banner.mjs --check  exit 1 if a page is out of step (writes nothing)
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORES } from '../public/assets/e/js/stores.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const check = process.argv.includes('--check');
const iosId = STORES.ios.live && /^\d+$/.test(STORES.ios.appId) ? STORES.ios.appId : null;
if (STORES.ios.live && !iosId) {
  console.error('stores.js: ios.live is true but ios.appId is not the numeric Apple ID.');
  process.exit(1);
}
const anyLive = Boolean(iosId || STORES.android.live);

const META_RE = /\n?<meta name="apple-itunes-app" content="[^"]*">/;
const VIEWPORT_RE = /(<meta name="viewport"[^>]*>)/;
let stale = 0;

for (const f of readdirSync(PUBLIC).filter((n) => n.endsWith('.html'))) {
  const path = join(PUBLIC, f);
  const before = readFileSync(path, 'utf8');
  let html = before.replace(META_RE, '');
  if (iosId && f !== '404.html') html = html.replace(VIEWPORT_RE, `$1\n<meta name="apple-itunes-app" content="app-id=${iosId}">`);
  if (f === 'app.html') {
    html = html.replace(/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${anyLive ? 'index, follow' : 'noindex, follow'}">`);
  }
  if (html !== before) {
    stale += 1;
    if (check) console.error(`out of step: public/${f}`);
    else writeFileSync(path, html);
  }
}
if (check && stale) { console.error('Run: node scripts/app-banner.mjs'); process.exit(1); }
console.log(check ? 'pages match stores.js' : `${stale} page(s) updated`);
