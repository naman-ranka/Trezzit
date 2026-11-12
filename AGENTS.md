# trezzit.com: the marketing site

Read this before changing anything here. `README.md` is the human overview
(pages, SEO setup); this file is what an agent would otherwise get wrong.

This repository is **public**. Nothing private goes into it: no logins, no
internal notes, nothing copied from the private Trezzit repos.

## What this is

The static site at trezzit.com. It explains Trezzit and sends people into the
product, which lives elsewhere: the web app at app.trezzit.com, the phone
apps, and the connector for Claude and ChatGPT. Trezzit is an itemized
ledger: it records every expense a person has, down to the item and their
share of it, whether they paid alone, split it, or someone else paid.

## How to say what Trezzit is

Any wording a visitor reads is the owner's decision; propose it, don't ship
it. The principle behind what is on the site now:

- Never introduce Trezzit as a bill-splitting app. Splitting is one way
  expenses enter the ledger. Pages that exist for a splitting search
  (`/split`, `/trips`, `/roommates`) may lead with the split, and each still
  shows the reader their own share landing in their own spending.
- Don't say "itemized ledger" to visitors; show it. The home hero is the
  model: a $100.00 charge on a bank statement beside the same purchase in
  Trezzit, "You spent $30.00", groceries $22.00 and household $8.00.
- Lines already in use: "See what you actually spent." / "Your bank shows
  what you paid. Trezzit shows what you spent."
- Keep it short. The use-case pages were cut to 220–320 words each, with
  one-sentence FAQ answers, on the owner's call (#13).
- Made-up data is vegetarian: no meat, fish, seafood or egg in sample
  receipts, demos or screenshots.
- Every product claim has to be true of the app today. Earlier releases
  checked each claim against the app's code before merging (#10, #13), and
  `/mcp` was checked tool by tool (#8). If you can't verify a claim, leave it
  out.

## Build, preview, deploy

There is no build step for the pages: they are hand-written HTML that loads
plain CSS and ES modules from `public/assets/`.

- `npm ci && npm run build` only writes `public/assets/css/styles.css`, a
  Tailwind file left from the 2025 site that no page loads. Vercel still runs
  it on every deploy, so it has to keep passing, but it tells you nothing
  about the site. Running it locally can rewrite that committed file; don't
  commit the result.
- Preview: `npx serve public -l 4173`, then open http://localhost:4173. It
  serves `/split` from `split.html` as Vercel does; a plain file server
  (`python3 -m http.server`) returns 404 for every nav link. The redirects
  and headers in `vercel.json` don't apply locally.
- The split maths has in-browser tests at `/assets/_kit/test` on the preview.
- Deploy: a merge to `main` is the production deploy to trezzit.com (Vercel).
  Every pushed branch gets a Vercel preview. Work on a branch, open a PR as a
  draft, the owner merges.
- There is no CI and no automated test. Checking is by looking: each changed
  page at 320, 390 and 1280 px and wider, light and dark theme, with
  JavaScript off, and with the console open.

## Structure

- `public/*.html`: one flat file per URL (`cleanUrls`, no trailing slash).
  Home, `/split`, `/splitwise-alternative`, `/mcp`, four use-case pages, five
  legal pages, `404`. The nav and footer are repeated in every file; a change
  to either is a change to all fourteen.
- `public/assets/e/`: the site's CSS and JS (`site.css`, `c.css`, `e.css`,
  one `demo-*.css` and `*-demo.js` per interactive demo, one small entry
  module per page). Colours are tokens, so dark theme follows if you use them.
- `public/assets/_kit/`: tokens, fonts, brand marks, the split engine, the
  scan client and the sample receipts. Its `README.md` documents the APIs.
- `public/assets/og/`: one 1200×630 share image per page. They are
  committed pictures of page content, so they go stale when the page's
  numbers change.
- `vercel.json`: redirects (`/s/:token` to the app, `/demo`, the retired
  `/lab`) and headers.
- Leftovers that do nothing: `public/assets/css/`, `input.css`, the Tailwind
  and PostCSS configs, `scripts/optimize_images.py` (hard-coded to one
  machine), `public/assets/.well-known/` (not served at `/.well-known/`) and
  the `manifest.json` header rule (there is no such file). Don't build on
  them; removing them is a separate change for the owner to approve.

## What the site shares with the app

- **The numbers are computed, and also written out.** The demos compute
  every figure from the sample receipts with `_kit/split-engine.js`, a port
  of the app's penny distribution. The same figures are typed by hand into
  the static tables, the no-JavaScript fallbacks, `aria-label`s, the JSON-LD
  and the share images. Change a sample and all of those must change with it.
- **Scanning your own photo** runs the app's scanner, loaded at run time from
  the app (`/embed/scan.js`), and "Split this receipt" opens the app's
  `/split` with that scan (#12). It is live only on https://trezzit.com and
  on this site's Vercel previews, which use the staging API and staging app.
  Anywhere else, localhost included, a sample plays instead. The preview
  host pattern in `_kit/scan-client.js` is matched by a pattern in the
  backend's CORS settings; renaming the Vercel project breaks preview scans
  until both change. On a preview, `?app=<frontend preview origin>` tries a
  frontend branch.
- **Order of merges**: this site goes last. #12 needed the backend live, then
  the app's embed live, before it could merge.
- **Links in**: the app links to `/privacy`, `/terms`, `/your-data` and
  `/privacy#who-helps-us-run-trezzit`; the connector's metadata points to
  `/mcp`; shared bill links may use `trezzit.com/s/<token>`.

## What only the owner changes

- **The text of the legal pages** (`privacy`, `terms`, `your-data`,
  `delete-account`, `support`). The store listings and the AI directory
  listings point reviewers at these URLs, and each sentence is a promise
  about what the service does with data. A privacy change waits until the
  behaviour it describes is live (#16 was held for the backend), and whether
  to move the effective date is the owner's call (#14 and #16 left it alone).
  Restyling is fine if the text, ids and links are diffed against `main` and
  come out identical (#11).
- **The URLs and anchors themselves.** `/delete-account` exists because
  Google Play requires a web address for deletion; `/support` and `/privacy`
  are in the listings; `/mcp` is the connector's documentation page, which
  the Claude directory requires to carry working example prompts (#6). When
  `/mcp` was redesigned every old anchor (`#connect-claude`, `#privacy`,
  `#tools`, …) was kept, and `mcp-page.js` opens the folded section a link
  points to (#19). Never rename or remove any of these.
- **Tool names and what `/mcp` says the connector can do**: reviewed with the
  directory submissions.
- Anything about the phone apps in the stores. Badges and `/app` are built
  and waiting behind one switch in #15; don't add store wording another way.

## Traps recent work hit

- **A rejected deploy is silent.** A key Vercel no longer accepts in
  `vercel.json` made it refuse every deploy before creating one: no failed
  check, nothing in the dashboard, and trezzit.com served a nine-month-old
  commit while two PRs "shipped" (#3). After a merge, look for the new
  production deployment; after touching `vercel.json`, look twice.
- **Don't regenerate the legal pages.** They began as Markdown in the private
  docs repo, run through a generator (#4, #5, #9). Since the redesign the
  generator's page chrome is out of date (#11), and later changes were made
  by hand in the HTML (#14, #16), so the HTML here is the newest text. A
  regenerated file would drop the Google Cloud rows and the reports and
  blocks section. Edit inside `<article class="doc">` by hand, and tell the
  owner the Markdown source needs the same change.
- **Legal PRs go stale quickly.** #7 could not merge after #11 restyled the
  page and was redone as #16. Keep them to the few lines that change.
- **FAQ markup must equal the page.** Each FAQ's JSON-LD repeats the visible
  questions and answers word for word (#10, #11, #13). Edit both or neither.
- **Layout shift is checked.** Heroes are sized in em and demo containers
  reserve their height, because a late font or a loading demo moved the page
  (#11, #12, #13). A new demo needs the same.
- **Leaving mid-scan.** Back, Forward or a reload during a real scan used to
  replay a sample as if it were the visitor's receipt (#12). A sample must
  always be labelled as a sample.
- **Everyone appends to `site.css`.** #19 added its rules at the end of the
  file and #15, opened earlier, did too; #15 now conflicts with `main`.
  Expect that conflict when two branches add page styles.
- **Stacked PRs.** #19 was built on #18 and merged alone; #18 was then
  closed. Say in the PR body which one to merge.
- **`sitemap.xml` dates are kept by hand** and have already fallen behind
  (`/mcp` and `/privacy` changed in November and still say October). Update
  `lastmod` when a page's content changes.
