/**
 * scan-client.js: "scan a receipt" for the landing-page labs.
 *
 *   const result = await scan('green-basket', { onStage });   // a sample
 *   const result = await scan(file, { onStage });             // a visitor's photo
 *
 * Stages, in order: 'uploading' -> 'reading' -> 'checking' -> 'done'.
 * onStage(stage, detail) fires on entering each stage; 'reading' fires again
 * with detail.items (the lines read so far) so a page can fill items in, and
 * 'done' carries detail.result.
 *
 * Samples never touch the network beyond their own JSON (about 2.5 s of
 * staged timing; instant with prefers-reduced-motion or { instant: true }).
 *
 * A File is scanned for real ONLY when location.origin is https://trezzit.com, or on a Vercel preview of this
 * site (against staging): through the app's scan embed (EMBED_URL, loaded on first use), which shrinks the
 * photo, uploads it, streams the lines as they are read (onDraft, onStatus), falls back to the old
 * /api/demo/scan/ itself, and builds the /split hand-off link. A failed scan rejects with the embed's
 * ScanError; anywhere else, or when the embed cannot load, the closest sample plays and result.notice says so.
 * The page must show the AI disclosure before calling scan(file).
 *
 * Result: { source: 'sample' | 'live', sampleId, raw, bill, notice?, scan?, handoff? }
 *   raw  = the /api/demo/scan/ body; bill = normalizeScan(raw) (live: the app's own mapper);
 *   live only: scan = { scanId, readToken, path }, handoff = the APP/split?from=landing#scan=… link.
 */

import { SAMPLES, getSample, loadScan } from './receipts.js';

export const LIVE_ORIGIN = 'https://trezzit.com';
/* Vercel previews of this site (trezzit-<hash>-… and trezzit-git-<branch>-…) talk to the staging API, which
 * trusts them (TrezzitBackend settings: VERCEL_LANDING_PREVIEW_ORIGIN_REGEX); the app links go to staging too. */
const PREVIEW_HOST = /^trezzit-(?:git-[a-z0-9-]+|[a-z0-9]+)-namanrankas-projects\.vercel\.app$/;
export const isStagingPreview = () => typeof location !== 'undefined' && location.protocol === 'https:' && PREVIEW_HOST.test(location.hostname);
export const API = isStagingPreview() ? 'https://api.staging.trezzit.com' : 'https://api.trezzit.com';
/* Previews only: ?app=<a frontend preview origin> (remembered for the tab) loads the embed from, and hands off
 * to, that build of the app instead of app.staging, so a frontend branch can be tried before it reaches staging.
 * Only this team's frontend previews are accepted; trezzit.com ignores it. */
const FRONTEND_PREVIEW = /^https:\/\/trezzit-frontend-[a-z0-9-]+-namanrankas-projects\.vercel\.app$/;
function previewApp() {
  if (!isStagingPreview()) return null;
  try {
    const asked = new URLSearchParams(location.search).get('app');
    if (asked && FRONTEND_PREVIEW.test(asked)) sessionStorage.setItem('trezzit-preview-app', asked);
    const kept = sessionStorage.getItem('trezzit-preview-app');
    return kept && FRONTEND_PREVIEW.test(kept) ? kept : null;
  } catch { return null; }
}
export const APP = isStagingPreview() ? (previewApp() || 'https://app.staging.trezzit.com') : 'https://app.trezzit.com';
export const AI_CONSENT_VERSION = '2026-10';
export const STAGES = ['uploading', 'reading', 'checking', 'done'];

export const isLive = () => typeof location !== 'undefined' && (location.origin === LIVE_ORIGIN || isStagingPreview());
export const prefersReducedMotion = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (ms <= 0) return resolve();
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason || new DOMException('Aborted', 'AbortError')); }, { once: true });
});

/* ---------- normalise (port of billCreationV2/utils/scanResult.js formatScanResult) ---------- */

const has = (v) => v !== null && v !== undefined && v !== '';
const money = (v, fb = '0.00') => (!has(v) ? fb : (Number.isNaN(Number(v)) ? String(v) : Number(v).toFixed(2)));
const rate = (v, fb = '0') => (!has(v) ? fb : (Number.isFinite(Number(v)) ? String(Number(v)) : String(v)));
const quantity = (v) => { const n = Number(v); return has(v) && Number.isFinite(n) && n > 0 ? String(n) : '1'; };
export function titleCase(raw) {
  const text = String(raw ?? '').trim();
  if (!text || !/[A-Z]/.test(text) || /[a-z]/.test(text)) return text;
  return text.toLowerCase().replace(/(^|[\s\-(/])([a-z])/g, (m, b, l) => `${b}${l.toUpperCase()}`);
}
function pickReceipt(res) {
  if (!res || typeof res !== 'object') return null;
  if (res.receipt && Array.isArray(res.receipt.items)) return res.receipt;
  if (res.result && Array.isArray(res.result.items)) return res.result;
  if (Array.isArray(res.items)) return res;
  return null;
}

/** Scan body -> { items:[{name, amount, quantity, taxPercent, isExtraCharge, itemType, taxAmount?}],
 *  merchant, date, currency, subtotal, tax, total, tip, discounts, discountAmount, warnings, backendValidations }. */
export function normalizeScan(res) {
  const r = pickReceipt(res) || {};
  const env = res && typeof res === 'object' ? res : {};
  const store = r.storeInformation || {};
  const discounts = (Array.isArray(r.discounts) ? r.discounts : []).filter((d) => d && typeof d === 'object')
    .map((d) => ({ ...d, amount: money(d.amount) }));
  const tip = Number(r.tip?.amount || 0);
  const iso = typeof store.dateTimeOfPurchase === 'string' && /^(\d{4}-\d{2}-\d{2})/.exec(store.dateTimeOfPurchase.trim());
  const cur = typeof store.currency === 'string' && /^[A-Za-z]{3}$/.test(store.currency.trim()) ? store.currency.trim().toUpperCase() : null;
  return {
    items: (r.items || []).map((it = {}) => {
      const extra = it.itemType === 'Fee' || it.itemType === 'Tip';
      return {
        name: it.name || 'Unknown Item', amount: money(it.totalPrice), quantity: quantity(it.quantity),
        taxPercent: extra ? '0' : rate(it.tax), isExtraCharge: extra, itemType: it.itemType || 'Item',
        ...(has(it.taxAmount) ? { taxAmount: money(it.taxAmount) } : {}),
      };
    }),
    merchant: titleCase(store.title || ''),
    date: iso ? iso[1] : null,
    currency: cur,
    subtotal: money(r.subtotalBeforeChargesAndTaxes),
    tax: money(r.taxSummary?.totalTaxAmount),
    total: money(r.grandTotal),
    tip: tip > 0 ? money(tip) : null,
    discounts,
    discountAmount: Number(discounts.reduce((a, d) => a + (Number(d.amount) || 0), 0).toFixed(2)),
    warnings: [...new Set([env.warnings, r.warnings].flatMap((w) => (Array.isArray(w) ? w.filter((x) => typeof x === 'string') : [])))],
    backendValidations: [r.backend_validations, env.backend_validations].find(Array.isArray) || [],
  };
}

/* ---------- samples ---------- */

/** Best sample for a file the visitor dropped (by its name), else the canonical grocery run. */
export function closestSample(file) {
  const name = String(file?.name || '').toLowerCase();
  const own = SAMPLES.find((x) => name.includes(x.id)); // one of our own PNGs
  if (own) return own.id;
  if (/rent|lease|landlord|utilit|statement|invoice/.test(name)) return 'monthly-rent';
  if (/taco|taq|restaurant|dinner|lunch|bar|cafe|food/.test(name)) return 'taqueria-sol';
  if (/pharm|drug|cvs|walgreen|rx|health/.test(name)) return 'corner-pharmacy';
  return SAMPLES[0].id;
}

async function playSample(id, { onStage, instant, signal, notice }) {
  const raw = await loadScan(id);
  const bill = normalizeScan(raw);
  const fast = instant ?? prefersReducedMotion();
  const emit = (stage, detail = {}) => onStage?.(stage, { sampleId: id, ...detail });
  // ~2.5 s: upload 0.45 s, read 1.4 s (lines arrive progressively), check 0.65 s.
  emit('uploading', { progress: 1 });
  await sleep(fast ? 0 : 450, signal);
  emit('reading', { items: [] });
  if (!fast) {
    const step = 1400 / Math.max(1, bill.items.length);
    for (let i = 1; i <= bill.items.length; i += 1) {
      await sleep(step, signal);
      emit('reading', { items: bill.items.slice(0, i) });
    }
  } else {
    emit('reading', { items: bill.items });
  }
  emit('checking', { validations: bill.backendValidations });
  await sleep(fast ? 0 : 650, signal);
  const result = { source: 'sample', sampleId: id, raw, bill, ...(notice ? { notice } : {}) };
  emit('done', { result });
  return result;
}

/* ---------- live: the app's own scan, through its embed ---------- */

/* The scan embed (Trezzit_Frontend src/embed/scan.ts): the app's scan client, shrinker, mapper and /split
 * hand-off link in one ES module, served with CORS from the app. Loaded only when a visitor scans a photo. */
export const EMBED_URL = `${APP}/embed/scan.js`;

let scanner = null;
/** The embed's scanner for API, loaded once (a failed load is tried again next time). */
export function loadScanner() {
  if (!scanner) {
    scanner = import(EMBED_URL)
      .then((m) => m.createScanner({ apiBase: API, aiConsent: AI_CONSENT_VERSION }))
      .catch((err) => { scanner = null; throw err; });
  }
  return scanner;
}

/** A draft line (scanSse.ts: {n, name, price|null}) as a bill item, for onStage('reading'). */
const draftItem = (it) => ({ name: it.name, amount: it.price ?? '', quantity: '1', taxPercent: '0', isExtraCharge: false, itemType: 'Item', pending: it.price == null });

async function liveScan(file, embed, { onStage, onDraft, onStatus, onProgress, onConnection, signal }) {
  onStage?.('uploading', { progress: 0 });
  const outcome = await embed.scan([file], {
    signal,
    onStatus(status) {
      onStatus?.(status);
      if (status === 'validating') onStage?.('checking', { validations: [] });
      else if (status !== 'uploading') onStage?.('reading', {});
    },
    onDraft(draft) {
      onDraft?.(draft);
      onStage?.('reading', { items: draft.items.map(draftItem), store: draft.store, date: draft.date });
    },
    onProgress,
    onConnection,
  });
  const bill = embed.mapResult(outcome.response);
  onStage?.('checking', { validations: bill.backendValidations });
  const result = {
    source: 'live',
    sampleId: null,
    raw: outcome.response,
    bill,
    scan: { scanId: outcome.scanId, readToken: outcome.readToken, path: outcome.path },
    // the /split link with this scan in its fragment (#scan=&t=, or #demo= on the old path), built by the app's own code
    handoff: embed.handoffUrl(outcome, APP),
  };
  onStage?.('done', { result });
  return result;
}

/* ---------- entry point ---------- */

/**
 * scan(fileOrSampleId, { onStage?, onDraft?, onStatus?, onProgress?, onConnection?, instant?, signal?, live? }) -> Promise<result>
 * `live` defaults to isLive(); forcing it true off trezzit.com will fail CORS.
 * A live scan that fails rejects with the embed's ScanError ({ code, message, status, retryAfter }; `message` is
 * the sentence to show; code ABORTED when `signal` stopped it). Only an embed that cannot load falls back to a sample.
 */
export async function scan(input, opts = {}) {
  if (typeof input === 'string') {
    if (!getSample(input)) throw new Error(`Unknown sample: ${input}`);
    return playSample(input, opts);
  }
  const fallbackId = closestSample(input);
  const live = opts.live ?? isLive();
  if (!live) {
    return playSample(fallbackId, { ...opts, notice: 'Live scanning runs on trezzit.com, so here is a sample receipt instead.' });
  }
  let embed;
  try {
    embed = await loadScanner();
  } catch (err) {
    console.info('[scan-client] the scan embed did not load; playing a sample:', err?.message || err);
    return playSample(fallbackId, { ...opts, instant: true, notice: 'Scanning could not start just now, so this is a sample receipt.' });
  }
  return liveScan(input, embed, opts);
}
