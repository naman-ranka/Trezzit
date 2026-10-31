/* page.js: chrome shared by every lab C page: nav state, scroll reveals, copy buttons. */
import { reduced, icon } from './util.js';

/* Dark theme: the OS decides until the visitor presses the nav toggle; the choice is stored and the inline
 * script in <head> applies it before first paint on the next page. */
const THEME_KEY = 'trezzit-theme';
const GROUND = { light: '#ffffff', dark: '#151517' };
function initTheme() {
  const root = document.documentElement;
  const os = matchMedia('(prefers-color-scheme: dark)');
  const tg = document.querySelector('[data-theme-toggle]');
  const now = () => root.dataset.theme || (os.matches ? 'dark' : 'light');
  const sync = () => tg?.setAttribute('aria-pressed', String(now() === 'dark'));
  tg?.addEventListener('click', () => {
    const next = now() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', GROUND[next]));
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode: the choice lasts this page only */ }
    sync();
  });
  os.addEventListener?.('change', sync);
  sync();
}

export function initPage() {
  initTheme();
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
