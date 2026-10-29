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

/* ---------- statement row, opened: a short read-only summary ---------- */
export function summaryHTML(sc, { base = 'scenarios/' } = {}) {
  const s = sc.sum;
  const res = s.result;
  const payerName = PEOPLE[sc.payer]?.name || '';
  let chips;
  let paidLine = '';
  if (sc.people.length > 1) {
    chips = sc.people.map((id) => {
      const p = PEOPLE[id];
      const name = id === 'you' ? '' : `<span>${esc(p.name)}</span>`;
      return `<li class="${id === 'you' ? 'is-you' : ''}">${avatar(p, { size: 'sm', speak: id === 'you' })}${name}<b class="money">${money(res.people[id]?.cents || 0)}</b></li>`;
    }).join('');
    const others = sc.people.filter((id) => id !== 'you').map((id) => PEOPLE[id].name);
    paidLine = sc.payer === 'you'
      ? `You paid ${money(s.total)} · ${esc(listNames(others))} owe${others.length === 1 ? 's' : ''} you <b class="money money-in">${money(s.owedToYou)}</b>`
      : `${esc(payerName)} paid ${money(s.total)} · You owe ${esc(payerName)} <b class="money">${money(s.youOwe)}</b>`;
    paidLine = `<p class="sd-paid">${paidLine}</p>`;
  } else {
    chips = Object.entries(s.byCategory).sort((x, y) => y[1] - x[1]).map(([k, v]) => {
      const c = CATEGORIES[k] || CATEGORIES.other;
      return `<li><span class="dot" style="--c:${c.color}"></span><span>${esc(c.label)}</span><b class="money">${money(v)}</b></li>`;
    }).join('');
  }
  const next = sc.next ? `<p class="sd-next">${ICON.repeat}<span>Adds itself ${esc(sc.next.join(' · '))}</span></p>` : '';
  // One way on from here: split it yourself if it is a Snap tab, otherwise play with it on the scenarios page.
  const link = SPLITTABLE[sc.id]
    ? `<a class="sd-link" href="#snap" data-split-it="${SPLITTABLE[sc.id]}">Split it yourself<span aria-hidden="true">&darr;</span></a>`
    : `<a class="sd-link" href="${base}#${sc.id}">Change who had what<span aria-hidden="true">&rarr;</span></a>`;
  return `<div class="sd-tz">
      <p class="sd-lesson">${esc(sc.lesson || '')}</p>
      <ul class="sd-chips" role="list">${chips}</ul>
      ${paidLine}
      <p class="sd-check">${ICON.check}<span>Adds up to <b class="money">${money(res.totalCents)}</b>, to the cent.</span></p>
      ${next}
      <p class="sd-links">${link}</p>
    </div>`;
}
