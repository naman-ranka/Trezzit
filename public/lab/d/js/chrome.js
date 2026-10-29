// Header, copy buttons and tabs: shared by every D page.
import { $, $$ } from './ui.js';

export function initChrome() {
  clearTimeout(window.__dBoot);
  const top = $('#top');
  const night = document.querySelector('.night');
  const onScroll = () => {
    top?.classList.toggle('is-scrolled', scrollY > 8);
    if (night && top) {
      // Theme the header by what sits under its bottom edge, so it never stays navy over a white section.
      const r = night.getBoundingClientRect(); const y = top.offsetHeight - 1;
      top.classList.toggle('on-dark', r.top <= y && r.bottom > y);
    }
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const label = b.querySelector('span') || b;
    const was = label.textContent;
    try { await navigator.clipboard.writeText(b.dataset.copy); label.textContent = 'Copied'; }
    catch { label.textContent = 'Select and copy'; }
    setTimeout(() => { label.textContent = was; }, 1800);
  }));

  $$('[data-tabs]').forEach((list) => {
    const tabs = $$('[role="tab"]', list);
    const select = (t) => tabs.forEach((x) => {
      const on = x === t;
      x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
    });
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        const n = tabs[(i + d + tabs.length) % tabs.length]; select(n); n.focus();
      });
    });
  });
}
