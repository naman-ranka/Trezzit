import { mkdir, rm, writeFile, copyFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const site = 'https://trezzit.com';

const pages = [
  ['/', 'Trezzit - AI-native itemized expense ledger', 'Ask your AI where your money went.', 'Trezzit is an itemized expense ledger with an MCP server. Agents can search bills, read balances, inspect item shares, upload receipts, and create scoped bill records over OAuth 2.1.'],
  ['/features', 'Trezzit Features - receipts, splits, groups, import', 'The app under the MCP server.', 'Receipt review, itemized splitting, groups, settlements, Splitwise CSV import, PWA, web push, and group-locked currency.'],
  ['/pricing', 'Trezzit Pricing - free, with no paid tiers today', 'Free, forever (for now).', 'Trezzit has no paid tiers today. No Stripe integration, no paid Pro plan, and no per-tier scan quota.'],
  ['/ai', 'Trezzit MCP Server - AI tools for expenses', 'Connect your AI to itemized money records.', 'OAuth 2.1 MCP tools for Claude, Cursor, ChatGPT, Gemini-compatible clients, scoped reads, attributed writes, and receipt uploads.'],
  ['/changelog', 'Trezzit Changelog - product and MCP updates', 'Product updates, in files.', 'Release notes for the Astro redesign, MCP server, receipt flows, and product updates.'],
  ['/changelog/2026-05-21-landing-redesign', 'Landing page redesign - Trezzit Changelog', 'Landing page redesign', 'Multi-page Astro site, MCP/AI page as flagship, and honest pricing.'],
  ['/demos', 'Trezzit Demos - receipt scan and bill creation', 'See the data shape before wiring an AI client.', 'Try the polished receipt demo, the legacy bill calculator, and the V2 bill creation demo.'],
  ['/security', 'Trezzit Security - OAuth scopes and data boundaries', 'Finance tools need explicit boundaries.', 'OAuth scopes, audit rows, attribution, mutation windows, and data boundaries for Trezzit.'],
];

function layout(route, title, h1, description) {
  const nav = [
    ['AI', '/ai'],
    ['Demos', '/demos'],
    ['Features', '/features'],
    ['Pricing', '/pricing'],
    ['Changelog', '/changelog'],
    ['Security', '/security'],
  ].map(([label, href]) => `<a href="${href}">${label}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${site}${route === '/' ? '' : route}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${site}${route === '/' ? '' : route}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body{margin:0;background:#0f172a;color:#f8fafc;font-family:Inter,system-ui,sans-serif}
    a{color:inherit} header,footer{border-color:#1e293b;border-style:solid} header{position:sticky;top:0;background:rgba(15,23,42,.92);border-width:0 0 1px;backdrop-filter:blur(12px)} footer{border-width:1px 0 0;background:#020617}
    .container{max-width:72rem;margin:0 auto;padding:0 1.5rem}.nav{height:4rem;display:flex;align-items:center;justify-content:space-between;gap:1.5rem}.links{display:flex;gap:1rem;color:#cbd5e1;font-size:.9rem}.brand{font-weight:700}.btn{display:inline-flex;border-radius:999px;background:#4F46E5;padding:.75rem 1.25rem;text-decoration:none;font-weight:600}.btn.secondary{background:#1e293b;border:1px solid #334155}
    section{padding:5rem 0;border-bottom:1px solid #1e293b}.hero{padding:7rem 0}.eyebrow{color:#a5b4fc;text-transform:uppercase;letter-spacing:.2em;font-weight:700;font-size:.78rem}h1{font-size:clamp(3rem,8vw,5.5rem);line-height:1;margin:.8rem 0 1.2rem}h2{font-size:clamp(2rem,5vw,3.5rem);line-height:1.05}p{color:#cbd5e1;line-height:1.7;font-size:1.08rem;max-width:42rem}.grid{display:grid;gap:1rem}.cards{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.card,.code{border:1px solid #1e293b;border-radius:.6rem;background:#020617;padding:1.5rem}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;color:#e2e8f0}.cta{display:flex;gap:.75rem;flex-wrap:wrap;margin-top:2rem}
  </style>
</head>
<body>
  <header><div class="container nav"><a class="brand" href="/">Trezzit</a><nav class="links">${nav}</nav><a class="btn" href="/ai">Connect</a></div></header>
  <main>
    <section class="hero"><div class="container"><div class="eyebrow">AI-native money</div><h1>${h1}</h1><p>${description}</p><div class="cta"><a class="btn" href="/ai">Explore AI tools</a><a class="btn secondary" href="https://app.trezzit.com/try-receipt">Try receipt demo</a></div></div></section>
    <section><div class="container grid cards"><article class="card"><h2>Real MCP tools</h2><p>Trezzit exposes 13 tools over OAuth 2.1 with bills:read and bills:write scopes.</p></article><article class="card"><h2>Itemized ledger</h2><p>Bill items become one item-share row per participant, so agents can answer from what you consumed.</p></article><article class="card"><h2>Honest limits</h2><p>No bank sync, no payment processor, no native app-store apps, and no cross-currency totals.</p></article></div></section>
    <section><div class="container"><div class="code">tools/list
{
  "tools": ["get_context","list_groups","search_bills","get_expenses","create_bill","delete_bill","create_settlement","get_receipt_upload_presigned_url"],
  "scopes": ["bills:read","bills:write"]
}</div></div></section>
  </main>
  <footer><div class="container" style="padding:3rem 1.5rem;color:#94a3b8">Trezzit - itemized expense records for humans and MCP clients.</div></footer>
</body>
</html>`;
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const [route, title, h1, description] of pages) {
  const dir = route === '/' ? dist : path.join(dist, route);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), layout(route, title, h1, description));
}

if (existsSync(path.join(root, 'public', 'favicon.ico'))) {
  await copyFile(path.join(root, 'public', 'favicon.ico'), path.join(dist, 'favicon.ico'));
}
if (existsSync(path.join(root, 'public', '.well-known'))) {
  await cp(path.join(root, 'public', '.well-known'), path.join(dist, '.well-known'), { recursive: true });
}
await writeFile(path.join(dist, 'sitemap-index.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${site}/sitemap-0.xml</loc></sitemap>
</sitemapindex>`);
await writeFile(path.join(dist, 'sitemap-0.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([route]) => `  <url><loc>${site}${route === '/' ? '' : route}</loc></url>`).join('\n')}
</urlset>`);
console.log(`Built ${pages.length} routes to dist/`);
