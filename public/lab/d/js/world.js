// One made-up October for "you": every number on the page is computed here
// with the kit's split engine from the kit's recorded scans.
import { SAMPLES, PEOPLE as KIT_PEOPLE, CATEGORIES, getSample, loadScan, splitSample } from '../../_kit/receipts.js';
import { normalizeScan } from '../../_kit/scan-client.js';
import { splitBill, toCents } from '../../_kit/split-engine.js';
import { sentence } from './ui.js';

export { SAMPLES, getSample };
// Maya's kit teal fails AA behind white initials (3.7:1); teal-700 passes (5.5:1).
export const PEOPLE = { ...KIT_PEOPLE, maya: { ...KIT_PEOPLE.maya, color: '#0f766e' } };
export const CATS = {
  ...CATEGORIES,
  subscriptions: { label: 'Subscriptions', color: '#9333ea' },
};
export const catOf = (id) => CATS[id] || CATS.other;

const NAME_FIX = { 'RENT NOVEMBER': 'Rent', 'INTERNET 1 GIG': 'Internet', 'PARKING SPACE 12': 'Parking space' };
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

  // Your October, newest first. payer: who paid the bill.
  const bills = [
    { id: 'green-basket', title: 'Green Basket Market', date: 'Oct 24', group: 'Flat 3B', payer: 'you', split: scans['green-basket'].split },
    { id: 'corner-pharmacy', title: 'Corner Pharmacy', date: 'Oct 20', group: null, payer: 'you', split: scans['corner-pharmacy'].split },
    { id: 'taqueria-sol', title: 'Taqueria Sol', date: 'Oct 18', group: 'Thursday dinners', payer: 'alex', split: scans['taqueria-sol'].split },
    { id: 'netflix', title: 'Netflix', date: 'Oct 12', group: 'Flat 3B', payer: 'maya', recurring: true, split: netflix },
    { id: 'monthly-rent', title: 'Rent & bills', date: 'Oct 1', group: 'Flat 3B', payer: 'you', recurring: true, split: scans['monthly-rent'].split },
  ].map((b) => ({ ...b, totalCents: b.split.totalCents, youCents: b.split.people.you?.cents || 0 }));

  const bank = [
    { date: 'Oct 24', text: 'GREEN BASKET MKT 0412', cents: -10000 },
    { date: 'Oct 20', text: 'CORNER PHARMACY 118', cents: -4822 },
    { date: 'Oct 1', text: 'ONLINE TRANSFER RENT', cents: -263240 },
  ];
  const paidCents = -bank.reduce((a, b) => a + b.cents, 0);
  const spentCents = bills.reduce((a, b) => a + b.youCents, 0);

  const byCat = {};
  bills.forEach((b) => Object.entries(b.split.people.you?.byCategory || {}).forEach(([k, v]) => { byCat[k] = (byCat[k] || 0) + v; }));
  const cats = Object.entries(byCat).map(([id, cents]) => ({ id, cents, ...catOf(id) })).sort((a, b) => b.cents - a.cents);

  // Every item you have a share of, for item search.
  const items = [];
  bills.forEach((b) => b.split.items.forEach((it) => {
    const mine = it.shares?.you || 0;
    if (!mine) return;
    const n = Object.values(it.shares).filter((c) => c).length;
    items.push({
      name: it.itemType === 'Tip' ? 'Tip' : itemName(it.name), bill: b.title, date: b.date,
      cents: mine, totalCents: it.totalCents, n, category: it.category || 'other',
    });
  }));

  return { scans, bills, bank, paidCents, spentCents, cats, items };
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
