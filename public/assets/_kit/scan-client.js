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
 * A File is scanned for real ONLY when location.origin is https://trezzit.com
 * (the API's CORS allows that origin alone), or on a Vercel preview of this site against the staging API: shrink to <= 2048 px / 4.5 MB,
 * POST multipart files[] + ai_consent=2026-10 + follow=1 to
 * https://api.trezzit.com/api/demo/scan/, follow a 202 by polling its
 * status_url with X-Scan-Token. Anywhere else, or on any error or timeout,
 * it falls back to the closest sample and sets result.notice.
 * The page must show the AI disclosure before calling scan(file).
 *
 * Result: { source: 'sample' | 'live', sampleId, raw, bill, notice? }
 *   raw  = the /api/demo/scan/ body; bill = normalizeScan(raw).
 */

import { SAMPLES, getSample, loadScan } from './receipts.js';

export const LIVE_ORIGIN = 'https://trezzit.com';
/* Vercel previews of this site (trezzit-<hash>-… and trezzit-git-<branch>-…) talk to the staging API, which
 * trusts them (TrezzitBackend settings: VERCEL_LANDING_PREVIEW_ORIGIN_REGEX); the app links go to staging too. */
const PREVIEW_HOST = /^trezzit-(?:git-[a-z0-9-]+|[a-z0-9]+)-namanrankas-projects\.vercel\.app$/;
export const isStagingPreview = () => typeof location !== 'undefined' && location.protocol === 'https:' && PREVIEW_HOST.test(location.hostname);
export const API = isStagingPreview() ? 'https://api.staging.trezzit.com' : 'https://api.trezzit.com';
export const APP = isStagingPreview() ? 'https://app.staging.trezzit.com' : 'https://app.trezzit.com';
export const AI_CONSENT_VERSION = '2026-10';
export const STAGES = ['uploading', 'reading', 'checking', 'done'];
const MAX_EDGE = 2048;
const BUDGET_BYTES = 4.5 * 1024 * 1024;
const TIMEOUT_MS = 60000;
const POLL_MS = 1500;

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

/* ---------- live ---------- */

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

/** Shrink an image to <= 2048 px longest edge, JPEG q0.85 (second pass 1600 px q0.7), under 4.5 MB. */
export async function prepareImage(file) {
  if (file.type === 'application/pdf') {
    if (file.size > BUDGET_BYTES) throw new Error('PDF too large');
    return file;
  }
  const src = await decode(file);
  const w = src.width; const h = src.height;
  for (const [edge, q] of [[MAX_EDGE, 0.85], [1600, 0.7]]) {
    const scale = Math.min(1, edge / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));
    if (blob && blob.size <= BUDGET_BYTES) {
      return new File([blob], (file.name || 'receipt').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    }
  }
  throw new Error('Image too large after resizing');
}

async function liveScan(file, { onStage, signal }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('Timed out', 'TimeoutError')), TIMEOUT_MS);
  signal?.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
  const s = ctrl.signal;
  try {
    onStage?.('uploading', { progress: 0 });
    const body = new FormData();
    body.append('files[]', await prepareImage(file));
    body.append('ai_consent', AI_CONSENT_VERSION);
    body.append('follow', '1');
    let res = await fetch(`${API}/api/demo/scan/`, { method: 'POST', body, signal: s, credentials: 'omit' });
    onStage?.('reading', { items: [] });
    if (res.status === 202) {
      const pending = await res.json();
      const statusUrl = new URL(pending.status_url, API).href;
      const headers = { 'X-Scan-Token': pending.read_token };
      for (;;) {
        await sleep(POLL_MS, s);
        res = await fetch(statusUrl, { headers, signal: s, credentials: 'omit' });
        if (res.status !== 202) break;
      }
    }
    if (!res.ok) throw new Error(`Scan failed: HTTP ${res.status}`);
    const raw = await res.json();
    if (!pickReceipt(raw) || ['failed', 'error'].includes(raw.status)) throw new Error('No receipt in scan result');
    const bill = normalizeScan(raw);
    if (bill.items.length === 0) throw new Error('No items read');
    onStage?.('reading', { items: bill.items });
    onStage?.('checking', { validations: bill.backendValidations });
    const result = { source: 'live', sampleId: null, raw, bill };
    onStage?.('done', { result });
    return result;
  } finally { clearTimeout(timer); }
}

/* ---------- entry point ---------- */

/**
 * scan(fileOrSampleId, { onStage?, instant?, signal?, live? }) -> Promise<result>
 * `live` defaults to isLive(); forcing it true off trezzit.com will fail CORS and fall back.
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
  try {
    return await liveScan(input, opts);
  } catch (err) {
    if (err?.name === 'AbortError' && opts.signal?.aborted) throw err;
    console.info('[scan-client] live scan fell back to a sample:', err?.message || err);
    return playSample(fallbackId, { ...opts, instant: true, notice: "We couldn't read that one just now, so here's a sample receipt instead." });
  }
}
