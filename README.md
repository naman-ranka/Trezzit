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

Pages are flat files with clean URLs and no trailing slash (`cleanUrls` and `"trailingSlash": false` in `vercel.json`): `public/index.html` (home), `split.html` (the no-account splitter), `splitwise-alternative.html`, `mcp.html`, the legal pages and `404.html`. They share one design system under `public/assets/e/` (CSS, JS, media) and the kit in `public/assets/_kit/` (tokens, fonts, split engine, scan client, sample receipts), referenced by root-absolute paths.

Every indexable page carries a title, description, canonical, Open Graph and Twitter tags (images in `public/assets/og/`, 1200x630) and JSON-LD: one `@graph` of WebSite, Organization and SoftwareApplication on the home page; BreadcrumbList on the others, plus FAQPage on `/split` and `/splitwise-alternative` that matches their visible questions. `public/sitemap.xml` lists the indexable pages. `public/robots.txt` keeps `/s/` and `/demo` out; `/lab/` (the old landing prototypes) is crawlable so its `noindex` is read, and `/lab/e/*` redirects to the pages it became.

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
