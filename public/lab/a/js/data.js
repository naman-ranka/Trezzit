/* data.js: one receipt model shared by the scan, story and split demos. */
import { SAMPLES, getSample, loadScan, PEOPLE, CATEGORIES } from '../../_kit/receipts.js';
import { normalizeScan } from '../../_kit/scan-client.js';
import { billFromScan, splitBill, toCents } from '../../_kit/split-engine.js';
import { prettyName } from './util.js';

export { SAMPLES, PEOPLE, CATEGORIES, getSample };

/* Categories are ink/slate shades (labels carry the meaning). People get the kit's distinct hues, a step darker for
 * white initials (all 4.5:1 or better), with You in navy, so each column of the split grid reads at a glance.
 * The kit's objects are shared, so this restyles every module on the page without editing the kit. */
const PEOPLE_TONE = { you: '#0f1f3d', maya: '#0f766e', jordan: '#b45309', sam: '#7c3aed', alex: '#be185d', priya: '#2461bd' };
const CAT_TONE = {
  groceries: '#0f1f3d', household: '#8590a6', health: '#0f1f3d', 'personal-care': '#4a5a75', gifts: '#8590a6',
  dining: '#0f1f3d', rent: '#0f1f3d', utilities: '#4a5a75', internet: '#8590a6', parking: '#b8c0cd', other: '#b8c0cd',
};
Object.entries(PEOPLE_TONE).forEach(([id, c]) => { if (PEOPLE[id]) PEOPLE[id].color = c; });
Object.entries(CAT_TONE).forEach(([id, c]) => { if (CATEGORIES[id]) CATEGORIES[id].color = c; });
/** Bar segments: an ink-to-slate ramp by rank, so neighbours always differ. */
export const RAMP = ['#0f1f3d', '#4a5a75', '#8590a6', '#b8c0cd'];

export const SHORT = {
  'green-basket': { label: 'Groceries', icon: 'basket' },
  'corner-pharmacy': { label: 'Pharmacy', icon: 'cross' },
  'taqueria-sol': { label: 'Dinner', icon: 'fork' },
  'monthly-rent': { label: 'Rent', icon: 'home' },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

/* One household on every page: the kit's dinner sample is Alex and Priya's; here it is the same roommates as the
 * story (Maya and Jordan), renamed in this copy only (same penny order, so the engine's cents are unchanged). */
const CAST = { alex: 'maya', priya: 'jordan' };
const recast = (id) => CAST[id] || id;
function recastSplit(sp) {
  if (!sp) return sp;
  const out = clone(sp);
  if (out.people) out.people = out.people.map(recast);
  ['shares', 'percents', 'amounts'].forEach((k) => {
    if (out[k]) out[k] = Object.fromEntries(Object.entries(out[k]).map(([id, v]) => [recast(id), v]));
  });
  return out;
}

/* The pharmacy run is all yours, but a split needs someone to share with: Maya is there with no items, so on /scan/
 * a tap can hand her the sunscreen (the default split, and so the month card's "Just you · $48.22", is unchanged). */
const HOUSE = { 'corner-pharmacy': ['you', 'maya'] };

/** Build a model from a scan result ({sampleId, raw, bill}) or a sample id. */
export async function loadModel(id) {
  const raw = await loadScan(id);
  return modelFrom({ source: 'sample', sampleId: id, raw, bill: normalizeScan(raw) });
}

export function modelFrom(result) {
  const sample = result.sampleId ? getSample(result.sampleId) : null;
  const bill = result.bill;
  const people = sample ? (HOUSE[sample.id] || sample.people.map(recast)) : ['you', 'maya', 'jordan', 'sam'];
  const lines = bill.items.map((it, i) => {
    const def = sample?.lines?.[i] || {};
    const extra = it.isExtraCharge;
    return {
      index: i,
      name: it.name,
      pretty: prettyName(it.name),
      qty: it.quantity,
      priceCents: toCents(it.amount),
      taxCents: toCents(it.taxAmount),
      totalCents: toCents(it.amount) + (extra ? 0 : toCents(it.taxAmount)),
      category: def.category || (sample?.tipCategory) || 'other',
      split: def.split ? recastSplit(def.split) : (extra ? null : { type: 'equal', people: [...people] }),
      extra,
    };
  });
  return {
    id: result.sampleId || 'live',
    source: result.source,
    sample,
    raw: result.raw,
    bill,
    merchant: bill.merchant || 'Receipt',
    date: bill.date,
    currency: bill.currency || 'USD',
    people,
    lines,
    tip: bill.tip,
    totalCents: toCents(bill.total),
    taxCents: toCents(bill.tax),
    subtotalCents: toCents(bill.subtotal),
    notice: result.notice,
  };
}

/** Run the kit's engine over the model's current splits. */
export function compute(model) {
  const scanBill = { ...model.bill };
  const b = billFromScan(scanBill, model.people, (_, i) => {
    const l = model.lines[i];
    return { split: l.split || undefined, category: l.category };
  });
  if (model.sample?.tipCategory) b.tipCategory = model.sample.tipCategory;
  return splitBill(b);
}

/** People who share a line ([] for proportional extras). */
export function lineMembers(line) {
  const s = line.split;
  if (!s) return [];
  if (s.type === 'equal') return s.people || [];
  if (s.type === 'shares') return Object.keys(s.shares || {});
  if (s.type === 'percentage') return Object.keys(s.percents || {});
  if (s.type === 'exact') return Object.keys(s.amounts || {});
  return [];
}

/** Human label for how a line is split. */
export function splitLabel(line, people = PEOPLE) {
  const s = line.split;
  if (!s) return 'Follows what each person ordered';
  const names = lineMembers(line).map((id) => people[id]?.name || id);
  if (s.type === 'percentage') return Object.entries(s.percents).map(([id, p]) => `${people[id]?.name || id} ${p}%`).join(' · ');
  if (s.type === 'exact') return Object.entries(s.amounts).map(([id, a]) => `${people[id]?.name || id} $${a}`).join(' · ');
  if (s.type === 'shares') return `${names.join(' & ')}, by shares`;
  if (names.length === 1) return names[0] === 'You' ? 'Just you' : `Just ${names[0]}`;
  return `${names.length} ways`;
}

export const dateLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
