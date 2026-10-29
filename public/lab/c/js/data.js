/* data.js: the one fictional world every lab C demo shares.
 * Apartment 3B: you, Maya, Jordan and Sam. Friday dinner: you, Alex, Priya.
 * Every amount is computed by the kit's split engine from the kit's recorded
 * scans, so the ledger, the split playground and the AI answers agree to the cent. */
import { PEOPLE as KIT_PEOPLE, CATEGORIES as KIT_CATS, SAMPLES, getSample, loadScan, splitSample } from '../../_kit/receipts.js';
import { normalizeScan } from '../../_kit/scan-client.js';
import { distributeEqually } from '../../_kit/split-engine.js';
import { itemName, storeName } from './util.js';

export const PEOPLE = KIT_PEOPLE;
export const CATEGORIES = {
  ...KIT_CATS,
  subscriptions: { label: 'Subscriptions', color: '#9333ea' },
};
export { SAMPLES, getSample };

/** Per-sample presentation used by the scan picker and split demo. */
export const SAMPLE_META = {
  'green-basket': { label: 'Green Basket Market', short: 'Green Basket', kind: 'Shared groceries', group: 'Apartment 3B', featured: [13, 9, 11] },
  'taqueria-sol': { label: 'Taqueria Sol', short: 'Taqueria Sol', kind: 'Dinner for three', group: 'Friday dinner', featured: null },
  'corner-pharmacy': { label: 'Corner Pharmacy', short: 'Pharmacy', kind: 'Just yours', group: 'Personal', featured: null },
  'monthly-rent': { label: 'Monthly rent', short: 'Rent', kind: 'Every month', group: 'Apartment 3B', featured: null, payer: 'maya' },
};

const scans = new Map();
/** Normalised scan for a sample (cached). */
export async function sampleBill(id) {
  if (!scans.has(id)) scans.set(id, loadScan(id).then((raw) => ({ raw, bill: normalizeScan(raw) })));
  return scans.get(id);
}

/* ---------- the October ledger (your share only) ---------- */

export const LAST_MONTH = {
  rent: 60000, utilities: 2540, internet: 1625, dining: 5275, groceries: 6140,
  health: 0, 'personal-care': 1210, household: 1425, gifts: 0, subscriptions: 625,
};

function manualEntry({ id, title, group, date, payer, kind, items, people }) {
  // items: [{ name, cents, cat }] split equally among people
  const lines = [];
  let total = 0;
  items.forEach((it) => {
    total += it.cents;
    const parts = distributeEqually(it.cents, people.length);
    const mine = parts[people.indexOf('you')];
    if (mine) lines.push({ name: it.name, cat: it.cat, cents: mine, itemCents: it.cents });
  });
  return { id, title, group, date, payer, kind, totalCents: total, lines, youCents: lines.reduce((a, l) => a + l.cents, 0) };
}

async function sampleEntry(sampleId, { title, group, date, payer, kind }) {
  const s = getSample(sampleId);
  const { bill } = await sampleBill(sampleId);
  const r = splitSample(s, bill);
  const you = r.people.you;
  const lines = you.lines.filter((l) => l.cents).map((l) => {
    const item = r.items.find((it) => it.index === l.itemIndex) || {};
    const cat = l.category || (item.itemType === 'Tip' ? 'dining' : 'other');
    return { name: item.itemType === 'Tip' ? 'Tip' : itemName(l.name), cat, cents: l.cents, itemCents: item.totalCents ?? l.cents };
  });
  return { id: sampleId, title, group, date, payer, kind, totalCents: r.totalCents, lines, youCents: you.cents };
}

let ledgerPromise = null;
/** All October entries, newest first. */
export function octoberLedger() {
  if (!ledgerPromise) {
    ledgerPromise = Promise.all([
      manualEntry({ id: 'pizza', title: 'Pizza night', group: 'Apartment 3B', date: 'Oct 26', payer: 'Jordan', kind: 'shared', people: ['you', 'maya', 'jordan', 'sam'],
        items: [{ name: 'Large margherita', cents: 1600, cat: 'dining' }, { name: 'Large mushroom', cents: 1600, cat: 'dining' }, { name: 'Garlic knots', cents: 600, cat: 'dining' }] }),
      sampleEntry('green-basket', { title: 'Green Basket Market', group: 'Apartment 3B', date: 'Oct 24', payer: 'you', kind: 'shared' }),
      sampleEntry('corner-pharmacy', { title: 'Corner Pharmacy', group: 'Personal', date: 'Oct 20', payer: 'you', kind: 'personal' }),
      sampleEntry('taqueria-sol', { title: 'Taqueria Sol', group: 'Friday dinner', date: 'Oct 18', payer: 'you', kind: 'shared' }),
      manualEntry({ id: 'netflix', title: 'Netflix', group: 'Apartment 3B', date: 'Oct 5', payer: 'you', kind: 'recurring', people: ['you', 'maya', 'jordan', 'sam'],
        items: [{ name: 'Netflix Premium', cents: 2499, cat: 'subscriptions' }] }),
      sampleEntry('monthly-rent', { title: 'Monthly rent', group: 'Apartment 3B', date: 'Oct 1', payer: 'Maya', kind: 'recurring' }),
    ]).then((entries) => {
      entries.forEach((e) => {
        e.lines.forEach((l) => { if (/^November rent/i.test(l.name)) l.name = 'October rent'; });
      });
      const byCat = {};
      entries.forEach((e) => e.lines.forEach((l) => { byCat[l.cat] = (byCat[l.cat] || 0) + l.cents; }));
      const spent = entries.reduce((a, e) => a + e.youCents, 0);
      const paid = entries.filter((e) => e.payer === 'you').reduce((a, e) => a + e.totalCents, 0);
      const last = Object.values(LAST_MONTH).reduce((a, b) => a + b, 0);
      return { entries, byCat, spent, paid, last };
    });
  }
  return ledgerPromise;
}

export const storeTitle = storeName;
