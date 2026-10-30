/* shared.js: pieces used by both pages (index and scenarios). */

import { PEOPLE, CATEGORIES } from './data.js';
import { money, bankAmt, esc, reduced } from './util.js';

export { money, bankAmt };

/* ---------- nav: hairline when stuck ---------- */
export function initNav() {
  const nav = document.querySelector('[data-nav]');
  const onScroll = () => nav.classList.toggle('is-stuck', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- reveal on scroll ---------- */
export function initReveal() {
  const els = document.querySelectorAll('.reveal:not(.in)');
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach((e) => io.observe(e));
}

/* ---------- item search over the month (every line of every expense) ---------- */
export function itemIndex(list) {
  const rows = [];
  list.forEach((sc) => sc.sum.result.items.forEach((it) => {
    if (it.isExtraCharge || it.itemType === 'Tip' || it.itemType === 'Fee') return;
    const c = CATEGORIES[it.category] || CATEGORIES.other;
    const store = sc.store || sc.merchant || sc.title;
    const mine = it.shares?.you || 0;
    const owner = Object.keys(it.shares || {}).filter((id) => it.shares[id]);
    rows.push({ name: it.name, store, cat: c.label, color: c.color, day: sc.day || '', mine, owner, hay: `${it.name} ${store} ${c.label} ${owner.filter((id) => id !== 'you').map((id) => PEOPLE[id].name).join(' ')}`.toLowerCase() });
  }));
  return rows;
}

/* Bank statement lines: what a bank can search (store name and its own category). */
export function bankIndex(list) {
  return list.filter((sc) => sc.bank).map((sc) => ({ ...sc.bank, cents: sc.sum.total, hay: `${sc.bank.merchant} ${sc.bank.cat}`.toLowerCase() }));
}

/**
 * One query, two searches: the bank's (store names) mirrors what you type into Trezzit's
 * (every line of every receipt, its store, category and the people on it).
 */
export function wireSearch(scope, index, bank = [], month = null) {
  const input = scope.querySelector('[data-search]');
  const out = scope.querySelector('[data-results]');
  const bankQ = scope.querySelector('[data-bank-q]');
  const bankOut = scope.querySelector('[data-bank-res]');
  const spent = scope.querySelector('[data-spent]');
  const spentLabel = scope.querySelector('[data-spent-label]');
  const setSpent = (label, cents, n = '') => {
    if (!spent) return;
    spentLabel.textContent = label;
    if (n) spentLabel.insertAdjacentHTML('beforeend', `<span class="ft-n"><span class="ft-sep"> · </span>${esc(n)}</span>`);
    const changed = spent.dataset.cents !== String(cents);
    spent.dataset.cents = String(cents);
    spent.textContent = money(cents);
    if (changed && !reduced()) { spent.classList.remove('flash'); void spent.offsetWidth; spent.classList.add('flash'); }
  };
  if (!input || !out) return;
  const names = Object.keys(PEOPLE).filter((id) => id !== 'you').map((id) => PEOPLE[id].name.toLowerCase());
  const draw = () => {
    const raw = input.value.trim();
    const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
    if (bankQ) { bankQ.textContent = raw || 'Search'; bankQ.classList.toggle('is-empty', !raw); }
    if (!words.length) { out.innerHTML = ''; if (bankOut) bankOut.innerHTML = ''; if (month !== null) setSpent('You spent in October', month); spent?.parentElement.classList.remove('is-none'); return; }
    // your record is your share (the two biggest show; the count and total under them cover the rest): only lines you had a share in, biggest share first
    let hits = index.filter((r) => r.mine > 0 && words.every((w) => r.hay.includes(w))).sort((x, y) => y.mine - x.mine);
    // a person's name: the things you shared with fewer people come first
    if (words.some((w) => names.includes(w))) hits = [...hits].sort((x, y) => x.owner.length - y.owner.length);
    out.innerHTML = hits.slice(0, 2).map((r) => `<li><span class="dot" style="--c:${r.color}" aria-hidden="true"></span><span><span>${esc(r.name)}</span><small>${esc(r.store)} · ${esc(r.day)}</small></span><b class="money">${money(r.mine)}</b></li>`).join('')
      + (hits.length ? '' : '<li class="sd-none">Nothing in October.</li>');
    // "You spent on towels", or "You spent with Maya" for a person
    const person = Object.values(PEOPLE).find((p) => p.id !== 'you' && words.includes(p.name.toLowerCase()));
    const what = person && words.length === 1 ? `with ${person.name}` : `on ${raw}`;
    if (month !== null) setSpent(`You spent ${what}`, hits.reduce((a, r) => a + r.mine, 0), `${hits.length} item${hits.length === 1 ? '' : 's'}`);
    // nothing matched: "Nothing in October." is the whole answer (no "You spent on zzz $0.00")
    if (spent) spent.parentElement.classList.toggle('is-none', !hits.length);
    if (bankOut) {
      const b = bank.filter((l) => words.every((w) => l.hay.includes(w)));
      bankOut.innerHTML = b.length
        ? `<ul role="list">${b.map((l) => `<li><span>${esc(l.date)}</span><span>${esc(l.merchant)}</span><span>${bankAmt(l.cents)}</span></li>`).join('')}</ul>`
        : '<p class="fb-none">No results</p>';
    }
  };
  input.addEventListener('input', draw);
  // an emptied field never sits there blank: leaving it brings the example back
  input.addEventListener('blur', () => { if (!input.value.trim()) { input.value = input.defaultValue; draw(); } });
  scope.addEventListener('click', (e) => {
    const t = e.target.closest('[data-try]');
    if (!t) return;
    input.value = t.textContent;
    draw();
  });
  draw();
}
