/**
 * chat-demo.js: a scripted exchange with an AI app that has Trezzit
 * connected. It opens on a finished conversation and plays once when first in
 * view; a suggestion (the active one again replays it) plays one. Reduced motion
 * shows the finished conversation.
 */

import { money, esc, ICON, reduced, watchVisible, whenVisible, bankAmt } from './util.js';

function card(title, sub, rows, foot = '', note = '') {
  return `<div class="tzcard">
    <div class="tzcard-h"><span class="tzcard-mark" aria-hidden="true"></span><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span></div>${note ? `<p class="tzcard-note">${note}</p>` : ''}
    <ul role="list">${rows}</ul>${foot}
  </div>`;
}
const row = (left, right, extra = '') => `<li><span>${left}</span><span class="money">${right}</span>${extra}</li>`;

export function scripts(sc) {
  // Two November charges that are not in Trezzit yet. October stays exactly as the search section shows it.
  const parking = { total: 600, mine: 600 };
  const cafe = { total: 970, mine: 485 };
  const line = (d, m, c) => `<span class="bk">${d} ${m} ${bankAmt(c)}</span>`;
  // Groceries in October: your share of every grocery item, per expense (the same numbers as
  // the hero's Green Basket legend and the search section's "groceries" total).
  const groc = sc.map((s) => {
    const items = s.sum.result.items.filter((it) => it.category === 'groceries' && (it.shares?.you || 0) > 0);
    return { s, n: items.length, one: items.length === 1 ? items[0].name : '', cents: items.reduce((a, it) => a + it.shares.you, 0) };
  }).filter((g) => g.cents > 0).sort((a, b) => b.cents - a.cents);
  const grocTotal = groc.reduce((a, g) => a + g.cents, 0);
  const store = (s) => s.store || s.merchant || s.title;

  return {
    match: {
      steps: [
        { user: "Add what's missing from my statement. The café was with Maya.", attach: { icon: 'doc', name: 'nov-statement.pdf' } },
        { tools: [['Reading nov-statement.pdf…', 'Added 2 expenses']] },
        { html: card('November', 'Your share',
          row(`${line('NOV 03', 'CITY PARKING', parking.total)}`, money(parking.mine))
          + row(`${line('NOV 06', 'CORNER CAFE', cafe.total)}<small>You and Maya</small>`, money(cafe.mine))) },
        { ai: `Maya owes you ${money(cafe.total - cafe.mine)}.` },
      ],
    },
    groceries: {
      steps: [
        { user: 'What did I spend on groceries in October?' },
        { tools: [['Searching October…', `Found ${groc.length} expenses`]] },
        { html: card('Groceries · October', 'Your share',
          groc.map((g) => row(`${esc(store(g.s))}<small>${esc(g.s.day)} · ${g.one ? esc(g.one) : `${g.n} items`}</small>`, money(g.cents))).join('')) },
        { ai: `${money(grocTotal)}, mostly at ${store(groc[0].s).replace(/ Market$/, '')}.` },
      ],
    },
  };
}

export function initChatDemo(section, scenarios) {
  const S = scripts(scenarios);
  const root = section.querySelector('[data-chat]');
  const log = root.querySelector('[data-log]');
  const chips = section.querySelectorAll('[data-script]');
  const live = root.querySelector('[data-chat-live]');
  // Follow the newest message unless the visitor has scrolled up to read.
  let stick = true;
  log.addEventListener('scroll', () => { stick = log.scrollHeight - log.scrollTop - log.clientHeight < 40; }, { passive: true });
  const toEnd = () => { if (stick) log.scrollTop = log.scrollHeight; };
  let run = 0;
  let wake = null;
  let playing = false;
  let current = 'match';
  let inView = true;

  const gate = async (id) => {
    while (!inView) {
      await new Promise((r) => { wake = r; });
      if (id !== run) throw new Error('stale');
    }
    if (id !== run) throw new Error('stale');
  };
  const wait = async (ms, id) => {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      await new Promise((r) => setTimeout(r, Math.min(60, end - performance.now())));
      await gate(id);
    }
  };

  const bubble = (step) => {
    if (step.user !== undefined) {
      const att = step.attach ? `<span class="att">${ICON[step.attach.icon]}${esc(step.attach.name)}</span>` : '';
      return `<div class="msg msg-user">${att}<p></p></div>`;
    }
    if (step.tools) return `<div class="msg msg-tool">${step.tools.map(([run, done]) => `<span class="tool"><span class="spin" aria-hidden="true"></span>${ICON.check}<span class="t-run">${esc(run)}</span><span class="t-done">${esc(done)}</span></span>`).join('')}</div>`;
    if (step.ai !== undefined) return '<div class="msg msg-ai"><p></p></div>';
    return `<div class="msg msg-card">${step.html}</div>`;
  };

  function renderAll(key) {
    log.innerHTML = S[key].steps.map((s) => {
      const h = bubble(s);
      return h.replace('<p></p>', `<p>${esc(s.user ?? s.ai ?? '')}</p>`).replaceAll('class="tool"', 'class="tool is-done"');
    }).join('');
  }
  /* The log is as tall as the longest finished conversation at this width, so switching
     prompts never moves anything below it and nothing hides in an inner scroller (messages
     fill it from the top). Only on a short desktop window is it capped. */
  const cap = () => (innerWidth < 640 ? Infinity : Math.max(360, Math.min(660, innerHeight - 200)));
  let tallest = 0;
  function measure() {
    log.style.height = 'auto';
    tallest = Math.max(...Object.keys(S).map((k) => { renderAll(k); return log.scrollHeight; }));
  }
  function fit(key) {
    if (!tallest) measure();
    renderAll(key);
    const h = Math.min(tallest, cap());
    log.style.height = `${h}px`;
    const over = log.scrollHeight > h + 1;
    log.classList.toggle('is-capped', over);
    if (over) log.tabIndex = 0; else log.removeAttribute('tabindex');
    log.scrollTop = log.scrollHeight;
  }

  /* Playing reveals the finished conversation in place: every message already has its final
     size and position, so nothing reflows, and the box is full within about 1.2 s
     (question at once, then each step, then the card, then the answer). */
  async function play(key) {
    const id = ++run;
    current = key;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.script === key)));
    fit(key);
    if (reduced()) return;
    wake?.();
    playing = true;
    const msgs = [...log.children];
    log.classList.add('is-playing');
    log.scrollTop = 0;
    stick = true;
    try {
      for (const m of msgs) {
        await gate(id);
        m.classList.add('in');
        toEnd();
        if (m.classList.contains('msg-tool')) {
          const tools = [...m.querySelectorAll('.tool')];
          tools.forEach((t) => t.classList.remove('is-done'));
          for (const t of tools) { await wait(700, id); t.classList.add('is-done'); }
          await wait(120, id);
        } else {
          await wait(m.classList.contains('msg-user') ? 200 : 320, id);
        }
      }
      playing = false;
      log.classList.remove('is-playing');
      const last = S[key].steps[S[key].steps.length - 1];
      if (live) {
        live.textContent = last.ai || '';
        setTimeout(() => { if (live.textContent === last.ai) live.textContent = ''; }, 3000);
      }
    } catch (e) { if (e.message !== 'stale') throw e; }
  }

  chips.forEach((c) => c.addEventListener('click', () => {
    // On a phone the conversation sits below the prompts: bring its top into view so the answer is seen.
    const r = root.getBoundingClientRect();
    if (r.top < 64 || r.top > innerHeight * 0.55) root.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    play(c.dataset.script);
  }));

  // Opens finished (so nothing is ever half-drawn); the first time it comes into view it
  // plays once. A suggestion plays its conversation (tapping the active one replays it).
  fit('match');
  if (!reduced()) whenVisible(log, () => { if (!playing && run === 0) play('match'); }, { threshold: 0.5 });
  let lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastW && !playing) { lastW = innerWidth; tallest = 0; fit(current); } }, { passive: true });
  document.fonts?.ready.then(() => { if (!playing) { tallest = 0; fit(current); } });
  watchVisible(root, (v) => { inView = v; if (v) wake?.(); }, { threshold: 0 });
}
