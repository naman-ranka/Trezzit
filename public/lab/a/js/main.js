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

// "Split it": the story right below already splits this receipt, so the button goes there; any other
// sample, or your own photo, opens the full playground with that receipt.
safe(() => mountScan($('#scan-demo'), {
  splitLabel: 'Split it',
  onSplit(model) {
    if (model.id === 'green-basket') {
      $('#story').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
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

