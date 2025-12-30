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
 public/index.html       # Landing page
 assets/
    icons/              # Branding
    images/             # Screenshots
    .well-known/        # Deep links
 sitemap.xml
 vercel.json
`

## SEO

Includes meta tags, structured data, Open Graph, and Twitter Cards. See [SEO-CHECKLIST.md](SEO-CHECKLIST.md).

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
