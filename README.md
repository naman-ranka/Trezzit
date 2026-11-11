# Trezzit Landing Page

Marketing website for [Trezzit](https://trezzit.com)  a bill-splitting platform with item-level expense tracking.

## About

Trezzit makes splitting bills transparent and fair by tracking expenses at the item level. Instead of just dividing totals, split individual items with multiple split types (equal, percentage, shares, exact amounts).

**Key Features:**
- Receipt OCR with AI categorization
- Item-wise bill splitting
- Multiple split types per item
- Share bills without requiring accounts
- Expense tracking dashboard

## Tech

Static HTML with Tailwind CSS and GSAP. Deployed on Vercel.

## Structure

`
 public/index.html       # Home (split.html, splitwise-alternative.html, mcp.html, 404.html beside it)
 assets/
    icons/              # Branding
    images/             # Screenshots
    .well-known/        # Deep links
 sitemap.xml
 vercel.json
`

## SEO

Pages are flat files with clean URLs and no trailing slash (`cleanUrls` and `"trailingSlash": false` in `vercel.json`): `public/index.html` (home), `split.html` (the no-account splitter), `splitwise-alternative.html`, `mcp.html`, the use-case pages `roommates.html`, `trips.html`, `recurring.html` and `track-spending-without-bank.html`, the legal pages and `404.html`. The legal pages (privacy, terms, your-data, delete-account, support) wear the same nav, footer and dark theme; their text comes from the policy Markdown in trezzit-ops (`docs/account-deletion/policy/`), whose `build_legal.py` still writes the old page chrome, so copy a regenerated `<article class="doc">` into the current page rather than replacing the file. They share one design system under `public/assets/e/` (CSS, JS, media) and the kit in `public/assets/_kit/` (tokens, fonts, split engine, scan client, sample receipts), referenced by root-absolute paths.

Every indexable page carries a title, description, canonical, Open Graph and Twitter tags (images in `public/assets/og/`, 1200x630) and JSON-LD: one `@graph` of WebSite, Organization and SoftwareApplication on the home page; BreadcrumbList on the others, plus FAQPage on `/split`, `/splitwise-alternative`, `/roommates`, `/trips`, `/recurring` and `/track-spending-without-bank` that matches their visible questions. `public/sitemap.xml` lists the indexable pages. `public/robots.txt` keeps `/s/` and `/demo` out; `/lab` (the old landing prototypes, now removed) redirects home, `/lab/e/ai` to `/mcp`, and `/lab/e/trips` and `/lab/e/recurring` to their pages.

## Get the app (store badges)

Every "get the app" prompt reads one file, `public/assets/e/js/stores.js`, and stays hidden until a store is live: a matched badge in the home hero on phones, badges under each page's last call to action, both badges and "iPhone app" / "Android app" links in the footer, and `/app`, the one link to share or print (a phone goes straight to its store, a computer sees both badges and a QR code). The badges are Apple's and Google's official artwork in `public/assets/stores/`, unaltered.

At launch: set `live: true` for the store (and the App Store `appId`, digits only) in `stores.js`, then run `node scripts/app-banner.mjs`, which writes iOS Safari's Smart App Banner meta into every page and makes `/app` indexable. `node scripts/app-banner.mjs --check` fails if the pages are out of step. Before launch, add `?get-app=preview` to any page to see the prompts (that tab only; `?get-app=off` clears it).

---

## Development

### Prerequisites
- Node.js & npm
- Python (optional, for image optimization)

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```

### Building CSS
The project uses Tailwind CSS (v3). To build the styles:
```bash
# Watch mode for development
npx tailwindcss -i ./input.css -o ./public/assets/css/styles.css --watch

# Build for production (minified)
npx tailwindcss -i ./input.css -o ./public/assets/css/styles.css --minify
```

### Optimize Images
To resize and convert images to WebP:
```bash
python scripts/optimize_images.py
```

## Deployment

The site is a static HTML project. Ensure the full `public` directory is served.
- Vercel: Point the root directory to `.` and the output directory to `public` (or just serve `public`).

### Live Links
**Live:** [trezzit.com](https://trezzit.com)  
**App:** [app.trezzit.com](https://app.trezzit.com)
