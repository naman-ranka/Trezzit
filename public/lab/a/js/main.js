/* main.js: wires prototype A together. */
import { $, $$, ICON, reveals } from './util.js';
import { initHero } from './hero.js';
import { mountScan } from './scan-demo.js';
import { initStory } from './story.js';
import { initScenarios } from './scenarios.js';
import { initChat } from './chat.js';

document.documentElement.classList.add('reveals-on');

const safe = (fn) => Promise.resolve().then(fn).catch((e) => console.error('[lab/a]', e));

safe(initHero);
reveals();
nav();
trustIcons();

// The scan's "Split it yourself" opens the full playground with the same receipt.
safe(() => mountScan($('#scan-demo'), {
  splitLabel: 'Split it yourself',
  onSplit(model) {
    let id = model.id;
    if (model.source === 'live') {
      try { sessionStorage.setItem('tz-a-live', JSON.stringify({ raw: model.raw, bill: model.bill })); } catch { id = 'green-basket'; }
    }
    location.href = `./scan/?r=${encodeURIComponent(id)}#split`;
  },
}));
safe(initStory);
safe(initScenarios);
safe(initChat);
copyMcp();

function copyMcp() {
  const btn = $('#mcp-copy');
  const url = $('#mcp-url');
  if (!btn || !url) return;
  btn.addEventListener('click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(url.textContent.trim()); ok = true; } catch {
      // fallback: select the text so a keyboard copy works
      const r = document.createRange(); r.selectNodeContents(url);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
    btn.textContent = ok ? 'Copied' : 'Selected';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  });
}

function nav() {
  const navEl = $('#nav');
  const darks = $$('[data-nav="dark"]');
  let t = false;
  const update = () => {
    t = false;
    navEl.classList.toggle('is-scrolled', scrollY > 8);
    const y = navEl.offsetHeight / 2;
    const onDark = darks.some((d) => { const r = d.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
    navEl.classList.toggle('on-dark', onDark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', onDark ? '#0a1020' : '#ffffff');
  };
  addEventListener('scroll', () => { if (!t) { t = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

function trustIcons() {
  $$('.ti[data-icon]').forEach((el) => { el.innerHTML = ICON[el.dataset.icon] || ''; });
}

