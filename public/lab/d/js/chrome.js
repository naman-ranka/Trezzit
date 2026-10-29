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
    const label = b.querySelector('.does') || b.querySelector('span') || b;
    const was = label.textContent;
    try { await navigator.clipboard.writeText(b.dataset.copy); label.textContent = 'Copied'; b.classList.add('copied'); }
    catch {
      // No clipboard access: select the URL instead and say how to copy it, without changing the button's width.
      const code = b.parentElement.querySelector('code');
      if (code) { const r = document.createRange(); r.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      b.title = 'Selected. Press Ctrl+C or ⌘C to copy.';
      return;
    }
    setTimeout(() => { label.textContent = was; b.classList.remove('copied'); }, 1800);
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
        const n = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : d ? tabs[(i + d + tabs.length) % tabs.length] : null;
        if (!n) return;
        e.preventDefault(); select(n); n.focus();
      });
    });
  });
}
