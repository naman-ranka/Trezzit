/* util.js: small shared helpers for prototype B. */

import { formatMoney, centsToString } from '../../_kit/split-engine.js';

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const money = (c) => formatMoney(c, 'USD');
/** Bank statements print "-100.00" without a symbol; we use a real minus. */
export const bankAmt = (c) => `−${Number(centsToString(Math.abs(c))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run cb once when el is at least `threshold` visible. */
export function whenVisible(node, cb, { threshold = 0.35, rootMargin = '0px' } = {}) {
  if (!('IntersectionObserver' in window)) { cb(); return () => {}; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { io.disconnect(); cb(); } });
  }, { threshold, rootMargin });
  io.observe(node);
  return () => io.disconnect();
}

/** Calls onChange(true|false) as el enters / leaves the viewport. */
export function watchVisible(node, onChange, { threshold = 0.2 } = {}) {
  if (!('IntersectionObserver' in window)) { onChange(true); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => onChange(e.isIntersecting)), { threshold });
  io.observe(node);
  (window.__tzIO ||= []).push(io); // keep observers alive
}

const easeOut = (t) => 1 - (1 - t) ** 3;
const tweens = new WeakMap();
/** Animate a money figure between cents values. Keeps tabular width steady. */
export function tweenMoney(node, to, { from, dur = 420, format = money } = {}) {
  const start = from ?? Number(node.dataset.cents ?? to);
  node.dataset.cents = String(to);
  cancelAnimationFrame(tweens.get(node));
  if (reduced() || start === to || dur <= 0) { node.textContent = format(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    node.textContent = format(Math.round(start + (to - start) * easeOut(p)));
    if (p < 1) tweens.set(node, requestAnimationFrame(step));
  };
  tweens.set(node, requestAnimationFrame(step));
}

export const ICON = {
  check: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  repeat: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 9V8a3 3 0 013-3h9m0 0l-2.5-2.5M16 5l-2.5 2.5M16 11v1a3 3 0 01-3 3H4m0 0l2.5 2.5M4 15l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  people: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7.5" cy="7" r="2.75" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M2.5 16c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M13 4.6a2.75 2.75 0 010 5M14.6 12.3c1.4.5 2.5 1.7 2.9 3.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  person: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 16.5c.7-2.8 2.9-4.3 5.5-4.3s4.8 1.5 5.5 4.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  arrow: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m0 0l-4.5-4.5M15 10l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevron: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5.2v9.6a.6.6 0 00.9.5l7.4-4.8a.6.6 0 000-1L7.9 4.7a.6.6 0 00-.9.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5.5" y="4.5" width="3" height="11" rx="1" fill="currentColor"/><rect x="11.5" y="4.5" width="3" height="11" rx="1" fill="currentColor"/></svg>',
  replay: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10a5.5 5.5 0 105.5-5.5H7m0 0l2.2-2.2M7 4.5l2.2 2.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  camera: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 014.5 6h1.8l1.2-1.8h5l1.2 1.8h1.8A1.5 1.5 0 0117 7.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 14.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="10.8" r="2.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  spark: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l1.6 4.6 4.6 1.6-4.6 1.6L10 15l-1.6-4.7L3.8 8.7l4.6-1.6z" fill="currentColor"/></svg>',
  copy: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 7V5.5A1.5 1.5 0 0011.5 4h-6A1.5 1.5 0 004 5.5v6A1.5 1.5 0 005.5 13H7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  doc: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 2.8h5.5L15 6.3v10a1 1 0 01-1 1H6a1 1 0 01-1-1V3.8a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M11.3 3v3.4H15M7.5 10h5M7.5 13h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  image: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="7.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M3.5 14l4-4 3 3 2-2 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
};

/** A face. `speak` keeps a static avatar in the accessibility tree (used for "You", where the avatar is the name). */
export function avatar(p, { size = '', pressed = null, label = '', speak = false } = {}) {
  const attrs = pressed === null ? (speak ? '' : 'aria-hidden="true"') : `aria-pressed="${pressed}" aria-label="${esc(label || p.name)}"`;
  const tag = pressed === null ? 'span' : 'button type="button"';
  const close = pressed === null ? 'span' : 'button';
  // every circle carries one letter, "Y" for you; the word "You" is a label beside it
  const mark = p.id === 'you' ? 'Y' : esc(p.initials);
  return `<${tag} class="av ${size}" data-id="${p.id}" style="--c:${p.color}" ${attrs}>${mark}</${close}>`;
}

export function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
