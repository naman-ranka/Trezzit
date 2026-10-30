/**
 * split-engine.js: Trezzit's split math for the landing-page labs.
 *
 * A plain-JS port of Trezzit_Frontend billCreationV2/utils/pennyDistribution.js
 * and calculations.js (main, b1a62b1f). Same model as the app:
 *   - an item's total is its price plus its own (already rounded) tax, and the
 *     item total is what gets split;
 *   - a receipt-level tax with no per-item amounts is spread over the taxable
 *     items by price (applyTaxToItems 'amount');
 *   - extra charges (Fee / Tip, a tip, a discount) are split in proportion to
 *     what each person already owes for the regular items (the app's
 *     PROPORTIONAL split type).
 * Every amount is integer cents internally. Each distribution is largest
 * remainder (ties go to the earlier person, which is the app's order for an
 * equal split), so per-person totals always sum exactly to the receipt.
 *
 * Note: for shares / percentage the app hands leftover pennies out in list
 * order after flooring; this kit hands them to the largest remainders. The two
 * agree for equal splits and differ by at most one cent per person otherwise.
 */

export const SPLIT = Object.freeze({
  EQUAL: 'equal',
  SHARES: 'shares',
  PERCENTAGE: 'percentage',
  EXACT: 'exact',
  PROPORTIONAL: 'proportional',
});

/* ---------- money ---------- */

/** "12.34" | 12.34 -> 1234. Rounds half away from zero at the cent. */
export function toCents(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-7);
}

/** 1234 -> 12.34 (a number). */
export const fromCents = (cents) => Math.round(cents) / 100;

/** 1234 -> "12.34". */
export const centsToString = (cents) => {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};

const formatters = new Map();
/** 1234 -> "$12.34" (Intl, en-US by default). */
export function formatMoney(cents, currency = 'USD', locale = 'en-US') {
  const key = `${locale}|${currency}`;
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(locale, { style: 'currency', currency }));
  }
  return formatters.get(key).format(fromCents(cents));
}

/* ---------- distributions (all integer cents) ---------- */

/**
 * Split `totalCents` into `count` parts that differ by at most one cent; the
 * extra cents go to the first parts. 1000 / 3 -> [334, 333, 333].
 * Same result as the app's distributeAmountEqually.
 */
export function distributeEqually(totalCents, count) {
  if (!(count > 0)) return [];
  return distributeByWeights(totalCents, Array(count).fill(1));
}

/**
 * Largest-remainder split of `totalCents` by non-negative weights (shares,
 * percentages, or cents). Always sums to `totalCents`. All-zero weights fall
 * back to an equal split. A negative total (a discount) is split by its size
 * and the parts negated.
 */
export function distributeByWeights(totalCents, weights) {
  const n = weights.length;
  if (n === 0) return [];
  const total = Math.round(totalCents);
  if (total < 0) return distributeByWeights(-total, weights).map((c) => (c === 0 ? 0 : -c));
  const w = weights.map((x) => (Number.isFinite(+x) && +x > 0 ? +x : 0));
  const sumW = w.reduce((a, b) => a + b, 0);
  const ws = sumW > 0 ? w : Array(n).fill(1);
  const sum = sumW > 0 ? sumW : n;

  const parts = ws.map((weight, index) => {
    const exact = (total * weight) / sum;
    const floor = Math.floor(exact + 1e-9);
    return { index, floor, rem: exact - floor };
  });
  let leftover = total - parts.reduce((a, p) => a + p.floor, 0);
  const order = [...parts].sort((a, b) => b.rem - a.rem || a.index - b.index);
  for (let i = 0; leftover > 0; i = (i + 1) % n) { order[i].floor += 1; leftover -= 1; }
  for (let i = n - 1; leftover < 0; i = (i - 1 + n) % n) {
    if (order[i].floor > 0) { order[i].floor -= 1; leftover += 1; }
  }
  return parts.map((p) => p.floor);
}

/** Percentages (summing to 100) -> cents. The app's distributeByPercentage. */
export const distributeByPercentage = (totalCents, percents) => distributeByWeights(totalCents, percents);

/** Shares (any positive numbers) -> cents. The app's distributeByShares. */
export const distributeByShares = (totalCents, shares) => distributeByWeights(totalCents, shares);

/* ---------- one item ---------- */

/**
 * Split one amount among people. `split` is one of
 *   { type: 'equal',      people: ['you', 'maya'] }
 *   { type: 'shares',     shares:   { you: 2, maya: 1 } }
 *   { type: 'percentage', percents: { you: 60, maya: 40 } }
 *   { type: 'exact',      amounts:  { you: '6.00', maya: '4.49' } }   (dollars)
 * `order` (person ids) fixes who gets a leftover cent first.
 * Exact amounts should add up to the total. When they add up to `priceCents`
 * instead (the line's price before its tax), they are used as weights so the
 * tax follows them; otherwise they are used as given, with a warning.
 * Returns { shares: { id: cents }, warning?: string }.
 */
export function splitAmount(totalCents, split, order = [], priceCents = null) {
  const type = split?.type || SPLIT.EQUAL;
  const sortIds = (ids) => {
    const pos = (id) => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
    return [...ids].sort((a, b) => pos(a) - pos(b));
  };
  const out = {};
  if (type === SPLIT.EQUAL) {
    const ids = sortIds(split.people || order);
    distributeEqually(totalCents, ids.length).forEach((c, i) => { out[ids[i]] = c; });
    return { shares: out };
  }
  if (type === SPLIT.SHARES || type === SPLIT.PERCENTAGE) {
    const map = (type === SPLIT.SHARES ? split.shares : split.percents) || {};
    const ids = sortIds(Object.keys(map));
    const values = ids.map((id) => Number(map[id]) || 0);
    distributeByWeights(totalCents, values).forEach((c, i) => { out[ids[i]] = c; });
    const pctSum = values.reduce((a, b) => a + b, 0);
    const warning = type === SPLIT.PERCENTAGE && Math.abs(pctSum - 100) > 1e-6
      ? `Percentages add up to ${pctSum}, not 100; used as weights.` : undefined;
    return { shares: out, warning };
  }
  if (type === SPLIT.EXACT) {
    const ids = sortIds(Object.keys(split.amounts || {}));
    const given = ids.map((id) => toCents(split.amounts[id]));
    const sum = given.reduce((a, b) => a + b, 0);
    if (sum !== totalCents && priceCents !== null && sum === priceCents) {
      distributeByWeights(totalCents, given).forEach((c, i) => { out[ids[i]] = c; });
      return { shares: out };
    }
    ids.forEach((id, i) => { out[id] = given[i]; });
    const warning = sum !== totalCents
      ? `Exact amounts add up to ${centsToString(sum)}, not ${centsToString(totalCents)}.` : undefined;
    return { shares: out, warning };
  }
  throw new Error(`Unknown split type: ${type}`);
}

/* ---------- a whole bill ---------- */

const isExtra = (item) => item.isExtraCharge || item.itemType === 'Fee' || item.itemType === 'Tip'
  || item.itemType === 'Discount';

/**
 * Split a whole bill.
 *
 * bill = {
 *   currency?: 'USD',
 *   people: [{ id, name? }] | ['you', 'maya'],    order = penny tie order
 *   items: [{ id?, name, amount: '29.63', taxAmount?: '2.37', taxable?: true,
 *             category?: 'household', isExtraCharge?, itemType?,
 *             split?: <splitAmount split> }],     default split: equal among everyone
 *   tax?: '2.37'        receipt-level tax, used only when no item has a taxAmount
 *   tip?: '9.00'        split proportionally, like a Tip line
 *   discount?: '5.00'   taken off proportionally
 *   total?: '100.00'    printed total, checked against the sum
 * }
 *
 * Returns {
 *   totalCents, currency,
 *   people: { [id]: { cents, itemsCents, extrasCents, byCategory: { [cat]: cents },
 *                     lines: [{ itemIndex, name, category, cents }] } },
 *   items:  [{ ...item, priceCents, taxCents, totalCents, shares: { [id]: cents } }],
 *   check:  { sumCents, expectedCents, ok }, warnings: []
 * }
 */
export function splitBill(bill) {
  const warnings = [];
  const order = (bill.people || []).map((p) => (typeof p === 'object' ? p.id : p));
  const items = (bill.items || []).filter(Boolean).map((item, index) => ({ ...item, index }));

  const regular = items.filter((it) => !isExtra(it));
  const extras = items.filter(isExtra);
  regular.forEach((it) => { it.priceCents = toCents(it.amount); it.taxCents = toCents(it.taxAmount); });
  extras.forEach((it) => {
    const c = toCents(it.amount);
    it.priceCents = it.itemType === 'Discount' ? -Math.abs(c) : c;
    it.taxCents = 0; // the app forces Fee/Tip tax to 0
  });

  // Receipt-level tax spread over taxable items by price (applyTaxToItems 'amount').
  const billTax = toCents(bill.tax);
  if (billTax && !regular.some((it) => it.taxAmount !== undefined && it.taxAmount !== null && it.taxAmount !== '')) {
    const taxable = regular.filter((it) => it.taxable !== false);
    distributeByWeights(billTax, taxable.map((it) => Math.max(0, it.priceCents)))
      .forEach((c, i) => { taxable[i].taxCents = c; });
  }

  // Bill-level tip / discount become proportional extra lines.
  if (toCents(bill.tip) && !extras.some((it) => it.itemType === 'Tip')) {
    extras.push({ name: 'Tip', itemType: 'Tip', isExtraCharge: true, priceCents: toCents(bill.tip), taxCents: 0, index: items.length + extras.length, category: bill.tipCategory });
  }
  if (toCents(bill.discount)) {
    extras.push({ name: 'Discount', itemType: 'Discount', isExtraCharge: true, priceCents: -Math.abs(toCents(bill.discount)), taxCents: 0, index: items.length + extras.length + 1 });
  }

  const people = {};
  order.forEach((id) => { people[id] = { cents: 0, itemsCents: 0, extrasCents: 0, byCategory: {}, lines: [] }; });
  const ensure = (id) => {
    if (!people[id]) { people[id] = { cents: 0, itemsCents: 0, extrasCents: 0, byCategory: {}, lines: [] }; order.push(id); }
    return people[id];
  };
  const credit = (id, it, cents, isExtraLine) => {
    const p = ensure(id);
    p.cents += cents;
    if (isExtraLine) p.extrasCents += cents; else p.itemsCents += cents;
    p.lines.push({ itemIndex: it.index, name: it.name, category: it.category || null, cents });
  };

  regular.forEach((it) => {
    it.totalCents = it.priceCents + it.taxCents;
    const { shares, warning } = splitAmount(it.totalCents, it.split || { type: SPLIT.EQUAL, people: order }, order, it.priceCents);
    if (warning) warnings.push(`${it.name}: ${warning}`);
    it.shares = shares;
    Object.entries(shares).forEach(([id, c]) => {
      credit(id, it, c, false);
      const cat = it.category || 'other';
      ensure(id).byCategory[cat] = (ensure(id).byCategory[cat] || 0) + c;
    });
  });

  // Extras: proportional to what each person owes for regular items.
  const base = order.map((id) => Math.max(0, people[id].itemsCents));
  extras.forEach((it) => {
    it.totalCents = it.priceCents;
    let shares;
    if (it.split && it.split.type !== SPLIT.PROPORTIONAL) {
      const r = splitAmount(it.totalCents, it.split, order);
      if (r.warning) warnings.push(`${it.name}: ${r.warning}`);
      shares = r.shares;
    } else {
      shares = {};
      distributeByWeights(it.totalCents, base).forEach((c, i) => { shares[order[i]] = c; });
    }
    it.shares = shares;
    Object.entries(shares).forEach(([id, c]) => {
      if (!c) return;
      credit(id, it, c, true);
      const p = people[id];
      if (it.category) {
        p.byCategory[it.category] = (p.byCategory[it.category] || 0) + c;
      } else {
        // Fold the extra into the person's own categories, by size, so byCategory still sums.
        const cats = Object.keys(p.byCategory);
        if (cats.length === 0) { p.byCategory.other = (p.byCategory.other || 0) + c; return; }
        distributeByWeights(c, cats.map((k) => Math.max(0, p.byCategory[k])))
          .forEach((part, i) => { p.byCategory[cats[i]] += part; });
      }
    });
  });

  const all = [...regular, ...extras].sort((a, b) => a.index - b.index);
  const totalCents = all.reduce((a, it) => a + it.totalCents, 0);
  const sumCents = order.reduce((a, id) => a + people[id].cents, 0);
  const expectedCents = bill.total !== undefined && bill.total !== null && bill.total !== '' ? toCents(bill.total) : totalCents;
  if (expectedCents !== totalCents) {
    warnings.push(`Lines add up to ${centsToString(totalCents)} but the receipt says ${centsToString(expectedCents)}.`);
  }
  return {
    currency: bill.currency || 'USD',
    totalCents,
    people,
    items: all,
    check: { sumCents, expectedCents, ok: sumCents === expectedCents && sumCents === totalCents },
    warnings,
  };
}

/**
 * Turn a normalised scan (scan-client's `bill`, the app's formatScanResult
 * shape) into a splitBill() input. `assign(item, index)` may return
 * { split, category } per line; `people` is the people list.
 */
export function billFromScan(scanBill, people, assign = () => ({})) {
  const items = (scanBill.items || []).map((item, index) => ({
    name: item.name,
    amount: item.amount,
    taxAmount: item.taxAmount,
    isExtraCharge: item.isExtraCharge,
    itemType: item.itemType,
    ...assign(item, index),
  }));
  const hasItemTax = items.some((it) => it.taxAmount !== undefined);
  return {
    currency: scanBill.currency || 'USD',
    people,
    items,
    tax: hasItemTax ? undefined : scanBill.tax,
    tip: scanBill.tip || undefined,
    discount: scanBill.discountAmount || undefined,
    total: scanBill.total,
  };
}
