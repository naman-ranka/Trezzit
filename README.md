# Trezzit landing site

The marketing website at [trezzit.com](https://trezzit.com) for Trezzit, an itemized ledger: it records what you actually spent, down to each item and your share of it, whether you paid alone, split the bill, or someone else paid.

The product itself is not in this repository. People use Trezzit in the web app at [app.trezzit.com](https://app.trezzit.com), in the phone apps, and from Claude or ChatGPT through the Trezzit connector (see [trezzit.com/mcp](https://trezzit.com/mcp)).

Working on the site with an AI agent, or want the reasons behind how it is built? Read `AGENTS.md`.

## Tech

Static, hand-written HTML with plain CSS and JavaScript modules; no framework and no bundler. Hosted on Vercel.

## Structure

```
public/
  index.html, split.html, mcp.html, ...   one file per page (see SEO below)
  sitemap.xml, robots.txt
  assets/
    e/      the site's CSS, JS and media
    _kit/   design tokens, fonts, brand marks, split engine, scan client, sample receipts
    og/     share images, one per page
vercel.json   clean URLs, redirects, headers
```

## SEO

Pages are flat files with clean URLs and no trailing slash (`cleanUrls` and `"trailingSlash": false` in `vercel.json`): `public/index.html` (home), `split.html` (the no-account splitter), `splitwise-alternative.html`, `mcp.html`, the use-case pages `roommates.html`, `trips.html`, `recurring.html` and `track-spending-without-bank.html`, the legal pages and `404.html`. The legal pages (privacy, terms, your-data, delete-account, support) wear the same nav, footer and dark theme; their text is edited by hand inside each page's `<article class="doc">` and changes only with the owner (`AGENTS.md` has why). They share one design system under `public/assets/e/` (CSS, JS, media) and the kit in `public/assets/_kit/` (tokens, fonts, split engine, scan client, sample receipts), referenced by root-absolute paths.

Every indexable page carries a title, description, canonical, Open Graph and Twitter tags (images in `public/assets/og/`, 1200x630) and JSON-LD: one `@graph` of WebSite, Organization and SoftwareApplication on the home page; BreadcrumbList on the others, plus FAQPage on `/split`, `/splitwise-alternative`, `/roommates`, `/trips`, `/recurring` and `/track-spending-without-bank` that matches their visible questions. `public/sitemap.xml` lists the indexable pages. `public/robots.txt` keeps `/s/` and `/demo` out; `/lab` (the old landing prototypes, now removed) redirects home, `/lab/e/ai` to `/mcp`, and `/lab/e/trips` and `/lab/e/recurring` to their pages.

---

## Development

You need Node.js and npm.

```bash
npx serve public -l 4173     # preview at http://localhost:4173
```

Edit the files under `public/` and reload; there is nothing to compile. Scanning your own receipt photo works only on trezzit.com and on Vercel previews, so a local preview plays a sample receipt instead.

`npm run build` compiles a Tailwind stylesheet (`public/assets/css/styles.css`) that the current pages no longer load. Vercel runs it on each deploy, so it must succeed, but you don't need it to work on the site.

## Deployment

Vercel serves the `public` directory. Merging to `main` deploys to [trezzit.com](https://trezzit.com); every other branch gets a preview URL.
