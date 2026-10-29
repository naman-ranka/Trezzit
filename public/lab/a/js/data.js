/* data.js: one receipt model shared by the scan, story and split demos. */
import { SAMPLES, getSample, loadScan, PEOPLE, CATEGORIES } from '../../_kit/receipts.js';
import { normalizeScan } from '../../_kit/scan-client.js';
import { billFromScan, splitBill, toCents } from '../../_kit/split-engine.js';
import { prettyName } from './util.js';

export { SAMPLES, PEOPLE, CATEGORIES, getSample };

export const SHORT = {
  'green-basket': { label: 'Groceries', icon: 'basket' },
  'corner-pharmacy': { label: 'Pharmacy', icon: 'cross' },
  'taqueria-sol': { label: 'Dinner', icon: 'fork' },
  'monthly-rent': { label: 'Rent', icon: 'home' },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Build a model from a scan result ({sampleId, raw, bill}) or a sample id. */
export async function loadModel(id) {
  const raw = await loadScan(id);
  return modelFrom({ source: 'sample', sampleId: id, raw, bill: normalizeScan(raw) });
}

export function modelFrom(result) {
  const sample = result.sampleId ? getSample(result.sampleId) : null;
  const bill = result.bill;
  const people = sample ? [...sample.people] : ['you', 'maya', 'jordan', 'sam'];
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
      split: def.split ? clone(def.split) : (extra ? null : { type: 'equal', people: [...people] }),
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
