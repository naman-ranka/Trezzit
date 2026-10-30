/* page.js: chrome shared by every lab C page: nav state, scroll reveals, copy buttons. */
import { reduced, icon } from './util.js';

export function initPage() {
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
  }

  // Reveal on scroll (content is visible without JS; html.js opts in).
  const els = [...document.querySelectorAll('.rv')];
  if (!reduced() && 'IntersectionObserver' in window) {
    // threshold 0: a block reveals as soon as its top edge enters, however tall it is;
    // a block taller than the screen never fades at all (no blank band while scrolling)
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
    els.forEach((el) => {
      if (el.getBoundingClientRect().height > innerHeight * 0.9) el.classList.add('in');
      else io.observe(el);
    });
  } else els.forEach((el) => el.classList.add('in'));

  document.querySelectorAll('[data-copy]').forEach((b) => {
    const label = b.innerHTML;
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); b.innerHTML = `${icon.check} Copied`; }
      catch { b.textContent = 'Select and copy'; }
      setTimeout(() => { b.innerHTML = label; }, 1800);
    });
  });
}
