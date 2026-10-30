// One made-up October for "you": every number on the page is computed here
// with the kit's split engine from the kit's recorded scans.
import { SAMPLES, PEOPLE as KIT_PEOPLE, CATEGORIES, getSample, loadScan as kitLoadScan, splitSample } from '../../_kit/receipts.js';
import { splitBill, toCents } from '../../_kit/split-engine.js';
import { sentence } from './ui.js';

export { SAMPLES, getSample };

/* The kit's scan normaliser (scan-client.js formatScanResult port), copied here so the page
   doesn't load the whole scan client for one function. */
const has = (v) => v !== null && v !== undefined && v !== '';
const fix2 = (v, fb = '0.00') => (!has(v) ? fb : (Number.isNaN(Number(v)) ? String(v) : Number(v).toFixed(2)));
const rate = (v, fb = '0') => (!has(v) ? fb : (Number.isFinite(Number(v)) ? String(Number(v)) : String(v)));
const qty = (v) => { const n = Number(v); return has(v) && Number.isFinite(n) && n > 0 ? String(n) : '1'; };
function normalizeScan(res) {
  const r = (res?.receipt && Array.isArray(res.receipt.items) ? res.receipt : Array.isArray(res?.items) ? res : null) || {};
  const tip = Number(r.tip?.amount || 0);
  const cur = r.storeInformation?.currency;
  const discountAmount = Number((Array.isArray(r.discounts) ? r.discounts : []).reduce((a, d) => a + (Number(d?.amount) || 0), 0).toFixed(2));
  return {
    currency: typeof cur === 'string' && /^[A-Za-z]{3}$/.test(cur.trim()) ? cur.trim().toUpperCase() : null,
    discountAmount,
    items: (r.items || []).map((it = {}) => {
      const extra = it.itemType === 'Fee' || it.itemType === 'Tip';
      return {
        name: it.name || 'Unknown Item', amount: fix2(it.totalPrice), quantity: qty(it.quantity),
        taxPercent: extra ? '0' : rate(it.tax), isExtraCharge: extra, itemType: it.itemType || 'Item',
        ...(has(it.taxAmount) ? { taxAmount: fix2(it.taxAmount) } : {}),
      };
    }),
    subtotal: fix2(r.subtotalBeforeChargesAndTaxes),
    tax: fix2(r.taxSummary?.totalTaxAmount),
    total: fix2(r.grandTotal),
    tip: tip > 0 ? fix2(tip) : null,
  };
}

/* The kit's rent statement is dated November; this page's example is October, so
   the rent sample is re-dated here (a local patch, the kit file is untouched). */
const rent = getSample('monthly-rent');
if (rent) rent.print = { ...rent.print, register: 'STATEMENT  OCT 2026', footer: ['PAID IN FULL — THANK YOU', 'NEXT STATEMENT NOV 1'] };
const patched = new WeakSet();
export async function loadScan(id) {
  const raw = await kitLoadScan(id);
  if (id === 'monthly-rent' && !patched.has(raw)) {
    patched.add(raw);
    const r = raw.receipt || raw;
    if (r.storeInformation) r.storeInformation.dateTimeOfPurchase = '2026-10-01';
    (r.items || []).forEach((it) => { if (it.name === 'RENT NOVEMBER') it.name = 'RENT OCTOBER'; });
  }
  return raw;
}
// Maya's kit teal fails AA behind white initials (3.7:1); teal-700 passes (5.5:1).
export const PEOPLE = { ...KIT_PEOPLE, maya: { ...KIT_PEOPLE.maya, color: '#0f766e' } };
export const CATS = {
  ...CATEGORIES,
  subscriptions: { label: 'Subscriptions', color: '#9333ea' },
};
export const catOf = (id) => CATS[id] || CATS.other;
/* The October summary always shows the same rows in the same order, so a tap moves amounts, never rows. */
const SUMMARY = ['rent', 'dining', 'groceries'];
export function summaryCats(cats) {
  const top = SUMMARY.map((id) => cats.find((c) => c.id === id) || { id, cents: 0, ...catOf(id) });
  const rest = cats.filter((c) => !SUMMARY.includes(c.id)).reduce((a, c) => a + c.cents, 0);
  return { top, rest };
}
/* Charts use one hue: navy for the largest share, then lighter steps; grey is "everything else". */
const TONES = ['#0f1f3d', '#3f5b8c', '#7f95bb', '#b3c1d9', '#d3dcea'];
export const tone = (i) => TONES[Math.min(i, TONES.length - 1)];
export const OTHER_TONE = '#cbd2dc';

const NAME_FIX = { 'RENT OCTOBER': 'Rent', 'RENT NOVEMBER': 'Rent', 'INTERNET 1 GIG': 'Internet', 'PARKING SPACE 12': 'Parking space' };
export const itemName = (raw) => NAME_FIX[raw] || sentence(raw);

let worldP;
export function getWorld() {
  if (!worldP) worldP = build();
  return worldP;
}

async function build() {
  const scans = {};
  await Promise.all(SAMPLES.map(async (s) => {
    const raw = await loadScan(s.id);
    const bill = normalizeScan(raw);
    scans[s.id] = { raw, bill, split: splitSample(s, bill) };
  }));
  const netflix = splitBill({ people: ['you', 'maya', 'jordan', 'sam'], items: [{ name: 'NETFLIX STANDARD', amount: '17.99', category: 'subscriptions' }] });
  // The card charge that was missing from Trezzit until your AI checked the statement (the #ai demo).
  const deli = splitBill({ people: ['you'], items: [{ name: 'LUNCH', amount: '11.40', category: 'dining' }] });

  // Your October, newest first. payer: who paid the bill.
  const bills = [
    { id: 'juniper-deli', title: 'Juniper Deli', date: 'Oct 27', group: null, payer: 'you', byAI: true, split: deli },
    { id: 'green-basket', title: 'Green Basket Market', date: 'Oct 24', group: 'Flat 3B', payer: 'you', split: scans['green-basket'].split },
    { id: 'corner-pharmacy', title: 'Corner Pharmacy', date: 'Oct 20', group: null, payer: 'you', split: scans['corner-pharmacy'].split },
    { id: 'taqueria-sol', title: 'Taqueria Sol', date: 'Oct 18', group: 'Dinner crew', payer: 'alex', split: scans['taqueria-sol'].split },
    { id: 'netflix', title: 'Netflix', date: 'Oct 12', group: 'Flat 3B', payer: 'maya', recurring: true, split: netflix },
    // Rent is settled: Maya, Jordan and Sam paid you back their rooms on Oct 1, so it's in no balance.
    { id: 'monthly-rent', title: 'Rent & bills', date: 'Oct 1', group: 'Flat 3B', payer: 'you', recurring: true, settled: true, split: scans['monthly-rent'].split },
  ].map((b) => ({ ...b, totalCents: b.split.totalCents, youCents: b.split.people.you?.cents || 0 }));

  const bank = [
    { date: 'Oct 27', text: 'JUNIPER DELI 0331', cents: -1140 },
    { date: 'Oct 24', text: 'GREEN BASKET MKT 0412', cents: -10000 },
    { date: 'Oct 20', text: 'CORNER PHARMACY 118', cents: -4822 },
    { date: 'Oct 1', text: 'ONLINE TRANSFER RENT', cents: -263240 },
  ];
  const paidCents = -bank.reduce((a, b) => a + b.cents, 0);
  return { scans, bank, paidCents, ...derive(bills) };
}

/** The world after the visitor re-split one receipt: the chat, the list and the balances all read this. */
export function withSplit(w, id, split) {
  const bills = w.bills.map((b) => (b.id === id ? { ...b, split, youCents: split.people.you?.cents || 0 } : b));
  return { ...w, ...derive(bills) };
}

/** Everything that follows from the bills: your total, categories, and every receipt line.
    Re-run when a split changes, so the October list always agrees with the split above it. */
export function derive(bills) {
  // Who owes whom across October: positive means they owe you. Settled bills (rent) are in no balance.
  const net = {};
  bills.filter((b) => !b.settled).forEach((b) => Object.entries(b.split.people).forEach(([p, v]) => {
    if (p === b.payer || !v.cents) return;
    if (b.payer === 'you') net[p] = (net[p] || 0) + v.cents;
    else if (p === 'you') net[b.payer] = (net[b.payer] || 0) - v.cents;
  }));
  const spentCents = bills.reduce((a, b) => a + b.youCents, 0);

  const byCat = {};
  bills.forEach((b) => Object.entries(b.split.people.you?.byCategory || {}).forEach(([k, v]) => { byCat[k] = (byCat[k] || 0) + v; }));
  const cats = Object.entries(byCat).map(([id, cents]) => ({ id, cents, ...catOf(id) })).sort((a, b) => b.cents - a.cents);

  // Every line on every receipt (lines), and the ones you have a share of (items).
  const lines = [];
  bills.forEach((b) => b.split.items.forEach((it) => {
    const mine = it.shares?.you || 0;
    const owners = Object.keys(it.shares || {}).filter((k) => it.shares[k]);
    // Rent is split by room (percentages), so it never reads as an even "4 ways".
    const how = getSample(b.id)?.lines?.[it.index]?.split?.type === 'percentage' ? 'by room' : `${owners.length} ways`;
    lines.push({
      name: it.itemType === 'Tip' ? 'Tip' : itemName(it.name), bill: b.title, date: b.date,
      cents: mine, totalCents: it.totalCents, n: owners.length, how, owners, category: it.category || 'other',
      payer: b.payer, group: b.group || '', billId: b.id,
    });
  }));
  const items = lines.filter((l) => l.cents > 0);

  return { bills, net, spentCents, cats, lines, items };
}

/** A split of one sample with custom per-line people (Sets), for the playground. */
export function splitWith(sampleId, scanBill, peopleOrder, lineSets, extra = {}) {
  const s = getSample(sampleId);
  const items = scanBill.items.map((it, i) => ({
    name: it.name, amount: it.amount, taxAmount: it.taxAmount, isExtraCharge: it.isExtraCharge, itemType: it.itemType,
    category: s.lines[i]?.category,
    split: lineSets[i] ? { type: 'equal', people: [...lineSets[i]] } : s.lines[i]?.split,
  }));
  return splitBill({
    people: peopleOrder, items, tip: scanBill.tip || undefined, total: scanBill.total,
    tipCategory: s.tipCategory, ...extra,
  });
}

export const cents = toCents;
