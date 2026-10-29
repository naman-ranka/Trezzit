/* shared.js: pieces used by both pages (index and scenarios). */

import { PEOPLE, CATEGORIES } from './data.js';
import { money, bankAmt, esc, ICON, avatar, listNames, reduced } from './util.js';

export { money, bankAmt };

/* Rows whose receipt is one of the "Snap it. Split it." tabs. */
export const SPLITTABLE = { groceries: 'green-basket', dinner: 'taqueria-sol' };

/* ---------- Bank | Trezzit (scoped to one element, e.g. the hero figure) ---------- */
export function initViewToggle(scope, { onChange } = {}) {
  const group = scope.querySelector('[data-vt]');
  const buttons = [...group.querySelectorAll('[data-set-view]')];
  // In Bank view the Trezzit pane is covered by "That's all your bank knows.": take it out of the
  // accessibility tree and expose the message instead, so screen readers hear the same switch.
  const pane = scope.querySelector('.pane-tz');
  const knows = scope.querySelector('.bank-knows');
  const covered = pane ? [...pane.children].filter((c) => c !== knows && !c.classList.contains('seam')) : [];
  const set = (view) => {
    if (scope.dataset.view === view) return;
    scope.dataset.view = view;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setView === view)));
    const bank = view === 'bank';
    covered.forEach((c) => { c.inert = bank; if (bank) c.setAttribute('aria-hidden', 'true'); else c.removeAttribute('aria-hidden'); });
    if (knows) { if (bank) knows.removeAttribute('aria-hidden'); else knows.setAttribute('aria-hidden', 'true'); }
    onChange?.(view);
  };
  buttons.forEach((b) => b.addEventListener('click', () => set(b.dataset.setView)));
  group.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const v = e.key === 'ArrowLeft' ? 'bank' : 'trezzit';
    set(v);
    group.querySelector(`[data-set-view="${v}"]`).focus();
    e.preventDefault();
  });
  return set;
}

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

/* ---------- copy ---------- */
export function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; } catch { b.textContent = 'Select and copy'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 1800);
  }));
}

/* ---------- statement row, opened: one line, then who or what ----------
   Shared rows: the people chips carry every number (no sentence repeats them).
   A personal row lists its items with their categories, plus item search. */
const SEARCH_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.75" cy="8.75" r="5.25" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.75 12.75L16.5 16.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
export const SEARCH_DEFAULT = 'milk';

export function summaryHTML(sc, { base = 'scenarios/', search = false } = {}) {
  const res = sc.sum.result;
  let body;
  if (sc.people.length > 1) {
    body = `<ul class="sd-chips" role="list">${sc.people.map((id) => {
      const p = PEOPLE[id];
      return `<li class="${id === 'you' ? 'is-you' : ''}">${avatar(p, { size: 'sm' })}<span>${esc(p.name)}</span><b class="money">${money(res.people[id]?.cents || 0)}</b></li>`;
    }).join('')}</ul>`;
  } else {
    body = `<ul class="sd-items" role="list">${res.items.map((it) => {
      const c = CATEGORIES[it.category] || CATEGORIES.other;
      return `<li><span class="dot" style="--c:${c.color}" aria-hidden="true"></span><span>${esc(it.name)}</span><small>${esc(c.label)}</small><b class="money">${money(it.totalCents)}</b></li>`;
    }).join('')}</ul>`;
    if (search) {
      body += `<div class="sd-search">
        <label class="sd-q">${SEARCH_ICON}<span class="visually-hidden">Search your October items</span><input type="search" value="${SEARCH_DEFAULT}" placeholder="Search items, stores, categories" autocomplete="off" spellcheck="false" data-search></label>
        <ul class="sd-results" role="list" aria-live="polite" data-results></ul>
      </div>`;
    }
  }
  const next = sc.next ? `<p class="sd-next">${ICON.repeat}<span>Adds itself ${esc(sc.next.join(' · '))}</span></p>` : '';
  // One way on from here: split it yourself if it is a Snap tab, otherwise open it on the examples page.
  const link = SPLITTABLE[sc.id]
    ? `<a class="sd-link" href="#snap" data-split-it="${SPLITTABLE[sc.id]}">Split it yourself<span aria-hidden="true">&darr;</span></a>`
    : `<a class="sd-link" href="${base}#${sc.id}">${sc.people.length > 1 ? 'Change who had what' : 'Open the example'}<span aria-hidden="true">&rarr;</span></a>`;
  return `<div class="sd-tz">
      <p class="sd-lesson">${esc(sc.lesson || '')}</p>
      ${body}
      ${next}
      <p class="sd-links">${link}</p>
    </div>`;
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
    rows.push({ name: it.name, store, cat: c.label, color: c.color, day: sc.day || '', mine, owner, hay: `${it.name} ${store} ${c.label}`.toLowerCase() });
  }));
  return rows;
}

export function wireSearch(scope, index) {
  const input = scope.querySelector('[data-search]');
  const out = scope.querySelector('[data-results]');
  if (!input || !out) return;
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { out.innerHTML = ''; return; }
    const hits = index.filter((r) => q.split(/\s+/).every((w) => r.hay.includes(w)));
    out.innerHTML = hits.slice(0, 3).map((r) => {
      const amt = r.mine ? `<b class="money">${money(r.mine)}</b>` : `<small>${esc(listNames(r.owner.map((id) => PEOPLE[id].name)))}&rsquo;s</small>`;
      return `<li><span class="dot" style="--c:${r.color}" aria-hidden="true"></span><span>${esc(r.name)}<small>${esc(r.store)} · ${esc(r.day)}</small></span>${amt}</li>`;
    }).join('') + (hits.length > 3 ? `<li class="sd-more-hits">${hits.length - 3} more</li>` : '')
      + (hits.length ? '' : '<li class="sd-none">Nothing in October</li>');
  };
  input.addEventListener('input', draw);
  draw();
}
