/* data.js: the one fictional world every lab E demo shares.
 * Apartment 3B: you, Maya, Jordan and Sam. Weekend at the lake: you, Alex, Priya (Alex paid the dinner).
 * Every amount is computed by the kit's split engine from the kit's recorded
 * scans, so the ledger, the split playground and the AI answers agree to the cent. */
import { PEOPLE as KIT_PEOPLE, CATEGORIES as KIT_CATS, SAMPLES, getSample, loadScan, splitSample } from '../../_kit/receipts.js';
import { normalizeScan } from '../../_kit/scan-client.js';
import { distributeEqually } from '../../_kit/split-engine.js';
import { itemName, storeName, bus } from './util.js';

// Maya's teal darkened (#0d9488 -> #0f766e) so white initials pass WCAG AA (5.5:1); the others already pass.
// E r2: no person shares a colour with the accent or a category (Priya was the link blue), and people are
// round while categories are square. These match the --p-* and --cat-* tokens in c.css.
// Dark theme: every person colour is a token (--av-you, --p-*: c.css), so it follows the theme.
export const PEOPLE = Object.fromEntries(Object.entries(KIT_PEOPLE).map(([k, v]) => [k, { ...v, color: k === 'you' ? 'var(--av-you)' : `var(--p-${k})` }]));
// E r3: saturated hues belong to people only. Categories are one ink ramp (--cat-1..4 in c.css: ink at
// 100/70/45/25%), assigned so no two categories on one receipt share a step; their marks stay square.
const RAMP = { groceries: 1, rent: 1, health: 2, dining: 2, utilities: 2, 'personal-care': 3, household: 3, internet: 3, subscriptions: 3, gifts: 4, parking: 4, other: 4 };
const CAT_COLOR = Object.fromEntries(Object.entries(RAMP).map(([k, n]) => [k, `var(--cat-${n})`]));
export const CATEGORIES = {
  ...Object.fromEntries(Object.entries(KIT_CATS).map(([k, v]) => [k, CAT_COLOR[k] ? { ...v, color: CAT_COLOR[k] } : v])),
  subscriptions: { label: 'Subscriptions', color: 'var(--cat-3)' },
};
export { SAMPLES, getSample };

/** Per-sample presentation used by the scan picker and split demo. */
export const SAMPLE_META = {
  'green-basket': { label: 'Green Basket Market', short: 'Groceries', kind: 'Shared groceries', group: 'Apartment 3B', featured: [13, 9, 11] },
  'taqueria-sol': { label: 'Taqueria Sol', short: 'Taqueria Sol', kind: 'Dinner for three', group: 'Weekend at the lake', featured: [0, 1, 3] },
  'corner-pharmacy': { label: 'Corner Pharmacy', short: 'Pharmacy', kind: 'Just yours', group: 'Personal', featured: null },
  'monthly-rent': { label: 'Monthly rent', short: 'Rent', kind: 'Every month', group: 'Apartment 3B', featured: null, payer: 'maya' },
};

const scans = new Map();
/** Normalised scan for a sample (cached). */
export async function sampleBill(id) {
  if (!scans.has(id)) scans.set(id, loadScan(id).then((raw) => ({ raw, bill: normalizeScan(raw) })));
  return scans.get(id);
}

/* ---------- the October ledger (your share only) ----------
 * E's one October (D's month, C's breakdown): you paid the groceries, the pharmacy and the rent;
 * Alex paid the dinner at the lake; Maya pays Netflix. Your bank saw four payments (−$2,792.02);
 * you spent $760.50 once your AI adds the one charge Trezzit was missing (Juniper Deli, $11.40). */

export const LAST_MONTH = {
  rent: 60000, utilities: 2540, internet: 1625, dining: 5275, groceries: 6140,
  health: 0, 'personal-care': 1210, household: 1425, gifts: 0, subscriptions: 625,
};

/** What your bank shows for October: store names and amounts, nothing else. */
export const BANK = [
  { id: 'juniper-deli', date: 'Oct 27', text: 'JUNIPER DELI', cents: 1140 },
  { id: 'green-basket', date: 'Oct 24', text: 'GREEN BASKET MARKET', cents: 10000 },
  { id: 'corner-pharmacy', date: 'Oct 20', text: 'CORNER PHARMACY', cents: 4822 },
  { id: 'monthly-rent', date: 'Oct 1', text: 'RENT TRANSFER', cents: 263240 },
];
export const BANK_PAID = BANK.reduce((a, b) => a + b.cents, 0);

function manualEntry({ id, title, group, date, payer, kind, items, people, byAI }) {
  // items: [{ name, cents, cat }] split equally among people
  const lines = [];
  let total = 0;
  items.forEach((it) => {
    total += it.cents;
    const parts = distributeEqually(it.cents, people.length);
    const mine = parts[people.indexOf('you')];
    if (mine) lines.push({ name: it.name, cat: it.cat, cents: mine, itemCents: it.cents });
  });
  return { id, title, group, date, payer, kind, byAI, totalCents: total, lines, youCents: lines.reduce((a, l) => a + l.cents, 0) };
}

async function sampleEntry(sampleId, { title, group, date, payer, kind }) {
  const s = getSample(sampleId);
  const { bill } = await sampleBill(sampleId);
  const r = splitSample(s, bill);
  const you = r.people.you;
  const lines = you.lines.filter((l) => l.cents).map((l) => {
    const item = r.items.find((it) => it.index === l.itemIndex) || {};
    const cat = l.category || (item.itemType === 'Tip' ? 'dining' : 'other');
    return { name: item.itemType === 'Tip' ? 'Tip' : itemName(l.name), cat, cents: l.cents, itemCents: item.totalCents ?? l.cents, priceCents: item.priceCents, taxCents: item.taxCents || 0 };
  });
  // lines that were someone else's (so a search for them can say whose they were)
  const others = r.items.filter((it) => it.itemType !== 'Tip' && !(it.shares?.you > 0))
    .map((it) => ({ name: itemName(it.name), people: Object.keys(it.shares || {}).filter((k) => it.shares[k] > 0) }));
  return { id: sampleId, title, group, date, payer, kind, totalCents: r.totalCents, lines, youCents: you.cents, others };
}

/** The charge your AI finds on the statement and adds (lunch, just yours). */
export const AI_ENTRY = manualEntry({ id: 'juniper-deli', title: 'Juniper Deli', group: 'Personal', date: 'Oct 27', payer: 'you', kind: 'personal', byAI: true,
  people: ['you'], items: [{ name: 'Lunch', cents: 1140, cat: 'dining' }] });

let ledgerPromise = null;
/** All October entries, newest first. `added` turns true once your AI adds Juniper Deli (bus 'ai-added'). */
export function octoberLedger() {
  if (!ledgerPromise) {
    ledgerPromise = Promise.all([
      sampleEntry('green-basket', { title: 'Green Basket Market', group: 'Apartment 3B', date: 'Oct 24', payer: 'you', kind: 'shared' }),
      sampleEntry('corner-pharmacy', { title: 'Corner Pharmacy', group: 'Personal', date: 'Oct 20', payer: 'you', kind: 'personal' }),
      sampleEntry('taqueria-sol', { title: 'Taqueria Sol', group: 'Weekend at the lake', date: 'Oct 18', payer: 'Alex', kind: 'shared' }),
      manualEntry({ id: 'netflix', title: 'Netflix', group: 'Apartment 3B', date: 'Oct 12', payer: 'Maya', kind: 'recurring', people: ['you', 'maya', 'jordan', 'sam'],
        items: [{ name: 'Netflix Standard', cents: 1799, cat: 'subscriptions' }] }),
      sampleEntry('monthly-rent', { title: 'Monthly rent', group: 'Apartment 3B', date: 'Oct 1', payer: 'you', kind: 'recurring' }),
    ]).then((entries) => {
      entries.forEach((e) => {
        e.lines.forEach((l) => { if (/^November rent/i.test(l.name)) l.name = 'October rent'; });
      });
      const L = { entries, added: false, bank: BANK, paid: BANK_PAID, last: Object.values(LAST_MONTH).reduce((a, b) => a + b, 0) };
      L.recount = () => {
        L.byCat = {};
        L.entries.forEach((e) => e.lines.forEach((l) => { L.byCat[l.cat] = (L.byCat[l.cat] || 0) + l.cents; }));
        L.spent = L.entries.reduce((a, e) => a + e.youCents, 0);
      };
      L.addAI = () => {
        if (L.added) return false;
        L.added = true;
        L.entries.unshift(AI_ENTRY);
        L.recount();
        bus.emit('ai-added', AI_ENTRY);
        return true;
      };
      L.recount();
      return L;
    });
  }
  return ledgerPromise;
}

export const storeTitle = storeName;
