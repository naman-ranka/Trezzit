/**
 * data.js: the October story for prototype B.
 *
 * One statement, six charges (one of them never reaches the statement).
 * Receipt-based scenarios read the kit's recorded scans, so the scan demo,
 * the split demo and the statement all show the same numbers. The others are
 * written out here. Every figure is computed by the kit's split engine.
 */

import { PEOPLE as KIT_PEOPLE, CATEGORIES as KIT_CATEGORIES, SAMPLES, loadScan, getSample } from '../../_kit/receipts.js';
import { splitBill, billFromScan, toCents } from '../../_kit/split-engine.js';

/* Maya's teal is darkened to #0f766e so a white initial on it passes AA (5.5:1). */
export const PEOPLE = { ...KIT_PEOPLE, maya: { ...KIT_PEOPLE.maya, color: '#0f766e' } };

export const CATEGORIES = {
  ...KIT_CATEGORIES,
  subscriptions: { label: 'Subscriptions', color: '#e11d48' },
  travel: { label: 'Travel', color: '#4f46e5' },
  electronics: { label: 'Electronics', color: '#0891b2' },
  books: { label: 'Books', color: '#a16207' },
  clothing: { label: 'Clothing', color: '#9333ea' },
};

/* normalizeScan: copied from ../../_kit/scan-client.js so the landing page doesn't download the
   whole scan client (nothing on it scans; "Scan your own receipt" links to /split). */
const has = (v) => v !== null && v !== undefined && v !== '';
const fix2 = (v, fb = '0.00') => (!has(v) ? fb : (Number.isNaN(Number(v)) ? String(v) : Number(v).toFixed(2)));
const rate = (v, fb = '0') => (!has(v) ? fb : (Number.isFinite(Number(v)) ? String(Number(v)) : String(v)));
const quantity = (v) => { const n = Number(v); return has(v) && Number.isFinite(n) && n > 0 ? String(n) : '1'; };
function titleCase(raw) {
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
function normalizeScan(res) {
  const r = pickReceipt(res) || {};
  const env = res && typeof res === 'object' ? res : {};
  const store = r.storeInformation || {};
  const discounts = (Array.isArray(r.discounts) ? r.discounts : []).filter((d) => d && typeof d === 'object')
    .map((d) => ({ ...d, amount: fix2(d.amount) }));
  const tip = Number(r.tip?.amount || 0);
  const iso = typeof store.dateTimeOfPurchase === 'string' && /^(\d{4}-\d{2}-\d{2})/.exec(store.dateTimeOfPurchase.trim());
  const cur = typeof store.currency === 'string' && /^[A-Za-z]{3}$/.test(store.currency.trim()) ? store.currency.trim().toUpperCase() : null;
  return {
    items: (r.items || []).map((it = {}) => {
      const extra = it.itemType === 'Fee' || it.itemType === 'Tip';
      return {
        name: it.name || 'Unknown Item', amount: fix2(it.totalPrice), quantity: quantity(it.quantity),
        taxPercent: extra ? '0' : rate(it.tax), isExtraCharge: extra, itemType: it.itemType || 'Item',
        ...(has(it.taxAmount) ? { taxAmount: fix2(it.taxAmount) } : {}),
      };
    }),
    merchant: titleCase(store.title || ''),
    date: iso ? iso[1] : null,
    currency: cur,
    subtotal: fix2(r.subtotalBeforeChargesAndTaxes),
    tax: fix2(r.taxSummary?.totalTaxAmount),
    total: fix2(r.grandTotal),
    tip: tip > 0 ? fix2(tip) : null,
    discounts,
    discountAmount: Number(discounts.reduce((a, d) => a + (Number(d.amount) || 0), 0).toFixed(2)),
    warnings: [...new Set([env.warnings, r.warnings].flatMap((w) => (Array.isArray(w) ? w.filter((x) => typeof x === 'string') : [])))],
    backendValidations: [r.backend_validations, env.backend_validations].find(Array.isArray) || [],
  };
}

export const ROOMIES = ['you', 'maya', 'jordan', 'sam'];
const eq = (people) => ({ type: 'equal', people });

export const KINDS = {
  shared: { label: 'Shared' },
  personal: { label: 'Personal' },
  recurring: { label: 'Recurring' },
};

/** Sentence-ish names for scanned lines: "EGGS LARGE 18CT" -> "Eggs large 18ct". */
export function itemName(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Item';
  if (/[a-z]/.test(s)) return s; // already mixed case
  const words = s.split(/\s+/).map((w) => {
    if (/^[A-Z]+\d+$/.test(w)) return w; // D3, SPF50
    const m = /^(\d+)([A-Z]+)$/.exec(w);
    if (m) return m[1] + ({ L: 'L', IU: 'IU' }[m[2]] || m[2].toLowerCase());
    return w.toLowerCase();
  });
  const out = words.join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/* ---------- the six (plus one) scenarios ---------- */

const DEFS = [
  {
    id: 'groceries', kind: 'shared', title: 'Groceries with roommates', short: 'Groceries',
    sample: 'green-basket', payer: 'you', group: 'Roommates',
    // Examples page: a shared line opens first (towels, 4 ways), so the first tap takes someone
    // off and the shares visibly change; then the lines that make the shares differ.
    lead: [13, 0, 11, 12, 9, 10], open: 13, inside: true,
    bank: { date: 'OCT 24', merchant: 'GREEN BASKET MKT', cat: 'Shopping' }, day: 'Oct 24',
    lesson: 'One charge, four people.',
  },
  {
    id: 'dinner', kind: 'shared', title: 'Dinner a friend paid', short: 'Dinner',
    sample: 'taqueria-sol', payer: 'alex', group: 'Taco Thursday',
    // Home split demo: the shared line opens, so the first tap removes someone (never the
    // "someone has to have it" guard); the lines that make the shares differ follow.
    lead: [3, 5, 0, 1, 2], open: 3,
    bank: null, day: 'Oct 18',
    lesson: 'Not on your statement. Still your dinner.',
  },
  {
    id: 'pharmacy', kind: 'personal', title: 'A pharmacy run, just yours', short: 'Pharmacy',
    sample: 'corner-pharmacy', payer: 'you', group: null,
    bank: { date: 'OCT 20', merchant: 'CORNER PHARMACY', cat: 'Health' }, day: 'Oct 20',
    lesson: 'All yours. Four kinds of spending.',
  },
  {
    id: 'rent', kind: 'recurring', title: 'Rent and bills', short: 'Rent',
    payer: 'you', group: 'Roommates', repeat: 'Every month on the 1st',
    bank: { date: 'OCT 01', merchant: 'TRANSFER OAK ST PROPERTY', cat: 'Transfer' }, day: 'Oct 1', store: 'Oak St Property',
    people: ROOMIES,
    items: [
      { name: 'Rent', amount: '2400.00', category: 'rent', split: { type: 'percentage', percents: { you: 25, maya: 25, jordan: 28, sam: 22 } } },
      { name: 'Water and sewer', amount: '68.40', category: 'utilities', split: eq(ROOMIES) },
      { name: 'Trash and recycling', amount: '24.00', category: 'utilities', split: eq(ROOMIES) },
      { name: 'Internet 1 Gig', amount: '65.00', category: 'internet', split: eq(ROOMIES) },
      { name: 'Parking space 12', amount: '75.00', category: 'parking', split: { type: 'exact', amounts: { jordan: '75.00' } } },
    ],
    total: '2632.40',
    lesson: 'Jordan has the big room and the parking spot.',
    next: ['Nov 1', 'Dec 1', 'Jan 1'],
  },
  {
    id: 'streaming', kind: 'recurring', title: 'Streaming, split four ways', short: 'Streaming',
    payer: 'you', group: 'Roommates', repeat: 'Every month on the 3rd',
    bank: { date: 'OCT 03', merchant: 'STREAMBOX.TV', cat: 'Entertainment' }, day: 'Oct 3', store: 'StreamBox',
    people: ROOMIES,
    items: [{ name: 'Premium plan', amount: '22.99', category: 'subscriptions', split: eq(ROOMIES) }],
    total: '22.99',
    lesson: 'A quarter of it is yours.',
    next: ['Nov 3', 'Dec 3', 'Jan 3'],
  },
  {
    id: 'trip', kind: 'shared', title: 'A weekend away', short: 'Trip',
    payer: 'you', group: 'Cabin trip',
    bank: { date: 'OCT 11', merchant: 'PINES CABIN', cat: 'Travel' }, day: 'Oct 11', store: 'Pines Cabin',
    people: ROOMIES,
    items: [
      { name: 'Cabin, 2 nights', amount: '480.00', category: 'travel', split: eq(ROOMIES) },
      { name: 'Cleaning fee', amount: '60.00', category: 'travel', split: eq(ROOMIES) },
    ],
    total: '540.00',
    lesson: 'You booked it for four.',
  },
];

/** Extra scenario for the gallery page only. */
const EXTRA = [
  {
    id: 'order', kind: 'personal', title: 'One online order', short: 'Online order',
    payer: 'you', group: null,
    bank: { date: 'OCT 15', merchant: 'MKTPLACE ORDER *3B7Q1', cat: 'Shopping' }, day: 'Oct 15', store: 'Online order',
    people: ['you'],
    items: [
      { name: 'USB-C charger, 2-pack', amount: '18.99', category: 'electronics' },
      { name: 'Paperback novel', amount: '14.99', category: 'books' },
      { name: 'Running socks, 3 pairs', amount: '12.00', category: 'clothing' },
      { name: 'Dish soap, 3-pack', amount: '9.47', category: 'household' },
      { name: 'Birthday card and wrap', amount: '7.48', category: 'gifts' },
    ],
    tax: '5.03',
    total: '67.96',
    lesson: 'One order, five different things.',
  },
];

/* ---------- build ---------- */

async function fromSample(def) {
  const sample = getSample(def.sample);
  const raw = await loadScan(def.sample);
  const scanBill = normalizeScan(raw);
  const people = sample.people;
  const bill = billFromScan(scanBill, people, (_, i) => sample.lines[i] || {});
  if (sample.tipCategory) bill.tipCategory = sample.tipCategory;
  bill.items = bill.items.map((it) => ({ ...it, name: itemName(it.name) }));
  return {
    ...def, people, bill, raw, scanBill,
    merchant: scanBill.merchant, date: scanBill.date,
    itemCount: scanBill.items.length,
  };
}

function fromItems(def) {
  const bill = {
    currency: 'USD', people: def.people, total: def.total, tax: def.tax,
    items: def.items.map((it) => ({ ...it, split: it.split || eq(def.people) })),
  };
  return { ...def, bill, merchant: def.title, itemCount: def.items.length };
}

/** Engine result plus the numbers every view needs. */
export function summarise(sc, bill = sc.bill) {
  const result = splitBill(bill);
  const total = result.totalCents;
  const mine = result.people.you?.cents || 0;
  const payer = sc.payer;
  const others = Object.keys(result.people).filter((id) => id !== 'you');
  return {
    result, total, mine,
    paidByYou: payer === 'you' ? total : 0,
    owedToYou: payer === 'you' ? total - mine : 0,
    youOwe: payer !== 'you' ? mine : 0,
    others,
    byCategory: result.people.you?.byCategory || {},
  };
}

let cache = null;
/** All scenarios (main six, then extras), each with .sum (summarise()). */
export function loadScenarios({ extras = false } = {}) {
  if (!cache) {
    cache = Promise.all([...DEFS, ...EXTRA].map((d) => (d.sample ? fromSample(d) : Promise.resolve(fromItems(d)))))
      .then((list) => list.map((sc) => ({ ...sc, sum: summarise(sc), extra: EXTRA.some((e) => e.id === sc.id) })));
  }
  return cache.then((list) => (extras ? list : list.filter((s) => !s.extra)));
}

/** Build a scenario-like object from a scan result (sample or live). */
export function scenarioFromScan(scanResult) {
  if (scanResult.sampleId) {
    const def = [...DEFS].find((d) => d.sample === scanResult.sampleId);
    if (def) return loadScenarios().then((l) => l.find((s) => s.id === def.id));
    const sample = getSample(scanResult.sampleId);
    return fromSample({ id: sample.id, kind: sample.kind, title: sample.title, sample: sample.id, payer: 'you', bank: null })
      .then((sc) => ({ ...sc, sum: summarise(sc) }));
  }
  const b = scanResult.bill;
  const bill = billFromScan(b, ROOMIES, () => ({ split: eq(ROOMIES) }));
  bill.items = bill.items.map((it) => ({ ...it, name: itemName(it.name) }));
  const sc = {
    id: 'live', kind: 'shared', title: b.merchant || 'Your receipt', payer: 'you', people: ROOMIES,
    bill, merchant: b.merchant || 'Your receipt', itemCount: b.items.length,
    bank: { date: '', merchant: (b.merchant || 'CARD PURCHASE').toUpperCase(), cat: 'Shopping' },
  };
  return Promise.resolve({ ...sc, sum: summarise(sc) });
}

export { SAMPLES, toCents };
