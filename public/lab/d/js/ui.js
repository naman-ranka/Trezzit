// Small helpers shared by the D demos.
import { formatMoney } from '../../_kit/split-engine.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** 3000 -> "$30.00"; negatives use a true minus sign. */
export const money = (cents, cur = 'USD') => (cents < 0 ? '−' + formatMoney(-cents, cur) : formatMoney(cents, cur));

/** "HAND TOWELS 4PK" -> "Hand towels 4pk" */
export function sentence(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const icon = (id, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
export const tmark = () => '<span class="tmark" aria-hidden="true"><img src="../_kit/brand/mark-white-128.png" alt=""></span>';

/** Run cb once when el is at least `ratio` visible. */
export function onVisible(el, cb, ratio = 0.35) {
  if (!('IntersectionObserver' in window)) { cb(); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && e.intersectionRatio >= ratio) { io.disconnect(); cb(); }
    });
  }, { threshold: [0, ratio, 1] });
  io.observe(el);
}

/** Tween a money figure in el.textContent from -> to cents. */
const tweens = new WeakMap();
export function tweenMoney(el, to, { dur = 420, from } = {}) {
  if (!el) return;
  const start = from ?? Number(el.dataset.cents ?? to);
  el.dataset.cents = String(to);
  cancelAnimationFrame(tweens.get(el));
  if (reducedMotion() || start === to) { el.textContent = money(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = money(Math.round(start + (to - start) * e));
    if (k < 1) tweens.set(el, requestAnimationFrame(step));
  };
  tweens.set(el, requestAnimationFrame(step));
}

/** A pausable clock for scripted timelines. */
export class Clock {
  constructor() { this.paused = false; this.token = 0; this.waiters = []; }
  cancel() { this.token += 1; this.resume(); }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.waiters.splice(0).forEach((r) => r()); }
  async wait(ms, token) {
    let left = ms;
    while (left > 0) {
      if (token !== this.token) throw new Error('cancelled');
      if (this.paused) { await new Promise((r) => this.waiters.push(r)); continue; }
      const slice = Math.min(left, 50);
      await new Promise((r) => setTimeout(r, slice));
      if (!this.paused) left -= slice;
    }
    if (token !== this.token) throw new Error('cancelled');
  }
}

/** Polite announcer for screen readers (debounced). */
let liveEl; let liveT;
export function announce(text) {
  if (!liveEl) {
    liveEl = document.createElement('div');
    liveEl.className = 'visually-hidden';
    liveEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(liveEl);
  }
  clearTimeout(liveT);
  liveT = setTimeout(() => { liveEl.textContent = text; }, 350);
}
