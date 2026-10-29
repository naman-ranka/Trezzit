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
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((el) => io.observe(el));
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
