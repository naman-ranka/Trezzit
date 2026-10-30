/**
 * receipts.js: synthetic sample receipts for the landing-page labs.
 *
 * Every sample is made up (generic store names, "Anytown" addresses). Its
 * scan result lives in receipts/<id>.json in the exact shape of a 200 from
 * POST /api/demo/scan/; the PNG beside it is the same receipt rendered by
 * renderReceipt(), for use as an "upload" image. SAMPLES adds what a scan
 * cannot know: who shares each line and its category.
 *
 * The canonical story is 'green-basket': a $100.00 grocery run shared by four
 * roommates. Hand towels ($29.63 + $2.37 tax = $32.00) split 4 ways is $8.00
 * each; your groceries come to $22.00 ($12.00 of the shared food plus your
 * own $10.00), so your share is exactly $30.00.
 */

import { splitBill, billFromScan, formatMoney, toCents } from './split-engine.js';

const BASE = new URL('./receipts/', import.meta.url);
export const sampleUrl = (id, ext = 'json') => new URL(`${id}.${ext}`, BASE).href;

export const PEOPLE = {
  you: { id: 'you', name: 'You', initials: 'You', color: '#162d59' },
  maya: { id: 'maya', name: 'Maya', initials: 'M', color: '#0d9488' },
  jordan: { id: 'jordan', name: 'Jordan', initials: 'J', color: '#b45309' },
  sam: { id: 'sam', name: 'Sam', initials: 'S', color: '#7c3aed' },
  alex: { id: 'alex', name: 'Alex', initials: 'A', color: '#be185d' },
  priya: { id: 'priya', name: 'Priya', initials: 'P', color: '#2461bd' },
};

export const CATEGORIES = {
  groceries: { label: 'Groceries', color: '#059669' },
  household: { label: 'Household', color: '#2461bd' },
  health: { label: 'Health', color: '#dc2626' },
  'personal-care': { label: 'Personal care', color: '#7c3aed' },
  gifts: { label: 'Gifts', color: '#db2777' },
  dining: { label: 'Dining out', color: '#ea580c' },
  rent: { label: 'Rent', color: '#0f1f3d' },
  utilities: { label: 'Utilities', color: '#0d9488' },
  internet: { label: 'Internet', color: '#0891b2' },
  parking: { label: 'Parking', color: '#64748b' },
  other: { label: 'Other', color: '#94a3b8' },
};

const ROOMIES = ['you', 'maya', 'jordan', 'sam'];
const eq = (people) => ({ type: 'equal', people });

/**
 * Per sample: people (penny order), and per scanned line (by index) its split
 * and category. `print` is decoration for the paper rendering only.
 */
export const SAMPLES = [
  {
    id: 'green-basket', title: 'Green Basket Market', kind: 'shared', total: '100.00',
    blurb: 'Groceries with roommates', people: ROOMIES,
    lines: [
      ...Array.from({ length: 9 }, () => ({ split: eq(ROOMIES), category: 'groceries' })),
      { split: eq(['you']), category: 'groceries' },
      { split: eq(['you']), category: 'groceries' },
      { split: eq(['maya']), category: 'groceries' },
      { split: eq(['maya']), category: 'groceries' },
      { split: eq(ROOMIES), category: 'household' },
    ],
    expected: { you: '30.00', maya: '30.00', jordan: '20.00', sam: '20.00' },
    print: { time: '6:42 PM', register: 'REG 03  TRN 4471', card: 'VISA **** 4242', footer: ['THANK YOU FOR SHOPPING', 'GREEN BASKET MARKET'] },
  },
  {
    id: 'corner-pharmacy', title: 'Corner Pharmacy', kind: 'personal', total: '48.22',
    blurb: 'Just yours, still itemized', people: ['you'],
    lines: [
      { category: 'health' }, { category: 'health' }, { category: 'personal-care' },
      { category: 'personal-care' }, { category: 'gifts' }, { category: 'groceries' },
    ].map((l) => ({ ...l, split: eq(['you']) })),
    expected: { you: '48.22' },
    print: { time: '11:08 AM', register: 'REG 01  TRN 0932', card: 'DEBIT **** 4242', footer: ['FEEL BETTER SOON', 'KEEP THIS RECEIPT FOR RETURNS'] },
  },
  {
    id: 'taqueria-sol', title: 'Taqueria Sol', kind: 'shared', total: '84.87',
    blurb: 'Dinner with friends, tax and tip shared fairly', people: ['you', 'alex', 'priya'],
    lines: [
      { split: eq(['you']) }, { split: eq(['alex']) }, { split: eq(['priya']) },
      { split: eq(['you', 'alex', 'priya']) }, { split: eq(['you', 'alex', 'priya']) },
      { split: { type: 'shares', shares: { you: 1, alex: 1 } } }, { split: eq(['priya']) },
    ].map((l) => ({ ...l, category: 'dining' })),
    tipCategory: 'dining',
    print: { time: '8:15 PM', register: 'TABLE 7  CHECK 2208', card: 'MASTERCARD **** 4242', footer: ['GRACIAS!', '100% VEGETARIAN KITCHEN'] },
  },
  {
    id: 'monthly-rent', title: 'Monthly rent', kind: 'recurring', total: '2632.40',
    blurb: 'Rent and bills, itemized every month', people: ROOMIES, recurring: 'monthly',
    lines: [
      { split: { type: 'percentage', percents: { you: 25, maya: 25, jordan: 28, sam: 22 } }, category: 'rent' },
      { split: eq(ROOMIES), category: 'utilities' },
      { split: eq(ROOMIES), category: 'utilities' },
      { split: eq(ROOMIES), category: 'internet' },
      { split: { type: 'exact', amounts: { jordan: '75.00' } }, category: 'parking' },
    ],
    print: { time: 'DUE 1ST OF MONTH', register: 'STATEMENT  NOV 2026', card: 'BANK TRANSFER', footer: ['PAID IN FULL — THANK YOU', 'NEXT STATEMENT DEC 1'] },
  },
];

export const getSample = (id) => SAMPLES.find((s) => s.id === id) || null;

const cache = new Map();
/** Fetch a sample's raw /api/demo/scan/ body (cached). */
export function loadScan(id) {
  if (!getSample(id)) return Promise.reject(new Error(`Unknown sample: ${id}`));
  if (!cache.has(id)) {
    cache.set(id, fetch(sampleUrl(id)).then((r) => {
      if (!r.ok) throw new Error(`Sample ${id}: HTTP ${r.status}`);
      return r.json();
    }).catch((e) => { cache.delete(id); throw e; }));
  }
  return cache.get(id);
}

/**
 * The sample's split: splitBill() over a normalised scan (scan-client's
 * `bill`, or normalizeScan(raw)) with the sample's people and line assignments.
 */
export function splitSample(sample, scanBill) {
  const bill = billFromScan(scanBill, sample.people, (_, i) => sample.lines[i] || {});
  if (sample.tipCategory) bill.tipCategory = sample.tipCategory;
  return splitBill(bill);
}

/* ---------- paper rendering ---------- */

let stylesAdded = false;
/** Adds receipts/receipt.css once (skip it if the page links the file itself). */
export function ensureReceiptStyles(doc = document) {
  if (stylesAdded || doc.querySelector('link[data-tz-receipt]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = sampleUrl('receipt', 'css');
  link.dataset.tzReceipt = '';
  doc.head.appendChild(link);
  stylesAdded = true;
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const amt = (v) => (toCents(v) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyNum = (q) => Number(q) || 1;

function prettyDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}

/**
 * HTML string for a paper receipt from a raw scan body (or its `receipt`).
 * opts: { sample?: SAMPLES entry (for the print decoration), id?: string,
 *         shadow?: true (wraps the article in div.tz-receipt-shadow; the torn
 *         edge mask clips box-shadow, so the shadow lives on the wrapper) }.
 * Each line is <li class="tz-r-line" data-index="i"> so pages can animate it.
 */
export function receiptHTML(scanBody, opts = {}) {
  const r = scanBody?.receipt || scanBody || {};
  const store = r.storeInformation || {};
  const p = opts.sample?.print || {};
  const items = r.items || [];
  const tax = r.taxSummary || {};
  const tip = toCents(r.tip?.amount);
  const count = items.reduce((a, it) => { const q = qtyNum(it.quantity); return a + (Number.isInteger(q) ? q : 1); }, 0);
  const lines = items.map((it, i) => {
    const q = qtyNum(it.quantity);
    const detail = it.unitPrice
      ? `<span class="tz-r-detail">${Number.isInteger(q) ? q : q.toFixed(2) + ' LB'} @ ${amt(it.unitPrice)}${Number.isInteger(q) ? '' : '/LB'}</span>` : '';
    return `<li class="tz-r-line" data-index="${i}"><span class="tz-r-name">${esc(it.name)}</span>`
      + `<span class="tz-r-amt">${amt(it.totalPrice)}<span class="tz-r-flag">${it.applyTax ? 'T' : '&nbsp;'}</span></span>${detail}</li>`;
  }).join('');
  const label = `Receipt from ${titleCase(store.title)}, total ${formatMoney(toCents(r.grandTotal), store.currency || 'USD')}`;
  const html = `<article class="tz-receipt"${opts.id ? ` id="${esc(opts.id)}"` : ''} aria-label="${esc(label)}">
  <header class="tz-r-head">
    <p class="tz-r-store">${esc(store.title)}</p>
    <p>${esc(store.storeAddress)}</p>
    <p class="tz-r-meta"><span>${prettyDate(store.dateTimeOfPurchase)}</span><span>${esc(p.time || '')}</span></p>
    ${p.register ? `<p>${esc(p.register)}</p>` : ''}
  </header>
  <hr class="tz-r-rule">
  <ul class="tz-r-lines">${lines}</ul>
  <hr class="tz-r-rule">
  <dl class="tz-r-sums">
    <div><dt>SUBTOTAL</dt><dd>${amt(r.subtotalBeforeChargesAndTaxes)}</dd></div>
    ${toCents(tax.totalTaxAmount) ? `<div><dt>TAX ${Number(tax.taxRate).toFixed(3)}%</dt><dd>${amt(tax.totalTaxAmount)}</dd></div>` : ''}
    ${tip ? `<div><dt>TIP</dt><dd>${amt(r.tip.amount)}</dd></div>` : ''}
    <div class="tz-r-total"><dt>TOTAL</dt><dd>${amt(r.grandTotal)}</dd></div>
    <div><dt>${esc(p.card || r.paymentDetails?.paymentMethod || 'PAID')}</dt><dd>${amt(r.grandTotal)}</dd></div>
  </dl>
  <hr class="tz-r-rule">
  <footer class="tz-r-foot">
    <p>ITEMS ${count}</p>
    ${(p.footer || ['THANK YOU']).map((f) => `<p>${esc(f)}</p>`).join('')}
    <div class="tz-r-barcode" aria-hidden="true"></div>
  </footer>
</article>`;
  return opts.shadow === false ? html : `<div class="tz-receipt-shadow">${html}</div>`;
}

/** Same as receiptHTML but returns an element (the wrapper, or the article with shadow:false) and adds the CSS. */
export function renderReceipt(scanBody, opts = {}) {
  if (typeof document === 'undefined') throw new Error('renderReceipt needs a DOM; use receiptHTML');
  ensureReceiptStyles();
  const t = document.createElement('template');
  t.innerHTML = receiptHTML(scanBody, opts).trim();
  return t.content.firstElementChild;
}

function titleCase(raw) {
  const text = String(raw ?? '').trim();
  if (!/[A-Z]/.test(text) || /[a-z]/.test(text)) return text;
  return text.toLowerCase().replace(/(^|[\s\-(/])([a-z])/g, (m, b, l) => `${b}${l.toUpperCase()}`);
}
