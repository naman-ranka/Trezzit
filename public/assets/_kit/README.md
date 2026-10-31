# Landing lab kit (`/assets/_kit/`)

Vanilla ES modules, no build. Import by relative path (`../_kit/split-engine.js`); works on any static server and on Vercel `cleanUrls`. Open `test.html` for in-browser tests plus all samples rendered.

## tokens.css
Trezzit tokens (app `src/theme/colors.js`, `shape.js`), DM Sans (self-hosted, variable), reset, `:focus-visible` ring, reduced-motion defaults.
- Colour: `--brand-navy` `--action-blue` `--link` `--text` `--text-secondary` `--positive` (`--positive-text` for small text, AA) `--negative` `--recurring` `--line` `--divider` `--line-strong`, surfaces.
- Radii: `--radius-sm` 8, `--radius-control` 12, `--radius-card` 16, `--radius-xl` 24. Shadows `--shadow-sm|md|lg` (blue-tinted). Motion `--ease-out`, `--dur-micro`, `--dur-reveal`.
- Utilities: `.money` (tabular-nums), `.money-in` `.money-out` `.money-total`, `.card`, `.btn .btn-primary .btn-ghost`, `.chip[aria-pressed]`, `.visually-hidden`, `.muted`.

## split-engine.js (port of the app's pennyDistribution + calculations)
All maths in integer cents; largest remainder (ties to the earlier person, which matches the app's equal split).
- `toCents(v)`, `fromCents(c)`, `centsToString(c)` → `"12.34"`, `formatMoney(c, 'USD')` → `"$12.34"`.
- `distributeEqually(c, n)`, `distributeByShares(c, shares)`, `distributeByPercentage(c, pcts)`, `distributeByWeights(c, w)` → `int[]` summing to `c`.
- `splitAmount(c, split, order)`: split = `{type:'equal',people}` | `{type:'shares',shares:{id:n}}` | `{type:'percentage',percents:{id:p}}` | `{type:'exact',amounts:{id:'6.00'}}`.
- `splitBill({people, items:[{name, amount, taxAmount?, category?, split?, itemType?}], tax?, tip?, discount?, total?})` → `{people:{id:{cents, itemsCents, extrasCents, byCategory, lines}}, items:[…shares], totalCents, check:{sumCents, expectedCents, ok}, warnings}`. The item total (price + its tax) is split; receipt-level tax goes over items by price; Fee/Tip lines, `tip` and `discount` go proportionally to each person's item shares.
- `billFromScan(scanBill, people, assign(item,i) → {split, category})` builds a `splitBill` input from a scan.

## receipts.js + receipts/
Synthetic samples: `green-basket` (canonical $100.00; hand towels $29.63 + $2.37 tax = $32.00 split 4 ways; You $30.00 = groceries $22.00 + household $8.00), `corner-pharmacy` (personal, $48.22), `taqueria-sol` (vegetarian dinner for 3, tax + $12 tip, $84.87), `monthly-rent` (recurring, % / equal / exact lines, $2,632.40).
- `receipts/<id>.json`: exact `/api/demo/scan/` 200 body. `receipts/<id>.png`: rendered paper photo for "upload" demos.
- `SAMPLES` (`{id, title, kind, total, blurb, people, lines[i]:{split, category}, expected?, print}`), `getSample(id)`, `PEOPLE`, `CATEGORIES` (label + colour), `sampleUrl(id, 'json'|'png')`.
- `loadScan(id)` → Promise of the raw body (cached). `splitSample(sample, bill)` → `splitBill` result.
- `receiptHTML(raw, {sample, id, shadow})` → string; `renderReceipt(raw, opts)` → element (adds `receipts/receipt.css`). Each line is `li.tz-r-line[data-index]`; add `.is-active` to highlight.

## scan-client.js
`scan(sampleIdOrFile, {onStage(stage, detail), instant, signal, live})` → `{source:'sample'|'live', sampleId, raw, bill, notice?}`.
- Stages `uploading → reading → checking → done` (`STAGES`). `reading` repeats with `detail.items` (lines so far); `done` carries `detail.result`.
- Samples: ≈2.5 s; instant with `prefers-reduced-motion` or `instant:true`. No API call.
- Files: live only on `https://trezzit.com` (and on Vercel previews of this site, against staging). The scan runs through the app's embed, `APP/embed/scan.js` (`loadScanner()`, imported on first use): the app's own shrink, upload, streaming read and old-path fallback. Extra callbacks: `onDraft(draft)` (`{store, date, items:[{n, name, price|null}]}` as lines are read), `onStatus(status)` (`uploading`, then the server's stages), `onProgress`, `onConnection`. The live result adds `scan` (`{scanId, readToken, path}`) and `handoff` (the `APP/split?from=landing#scan=…&t=…` link, built by the embed). A failed live scan rejects with the embed's `ScanError` (`code`, `message` to show, `status`, `retryAfter`; `ABORTED` when stopped). Elsewhere, or when the embed cannot load, it plays `closestSample(file)` and sets `notice`. Show the AI disclosure (Google Gemini, and the Claude sample review) before a live scan; it shares /split's 10 scans/hour/IP.
- `normalizeScan(raw)`: port of the app's `formatScanResult` (`{items, merchant, date, currency, subtotal, tax, total, tip, …}`). Also `isLive()`, `loadScanner()`, `closestSample(file)`.

## brand/ and fonts/
`trezzit-mark.svg` (app source mark), `trezzit-mark-currentcolor.svg`, `favicon.svg|ico`, `apple-touch-icon.png`, `icon-192|512.png`, `mark-white-128.png`. Fonts: DM Sans (UI), IBM Plex Mono (receipts); both OFL, licences beside them.
