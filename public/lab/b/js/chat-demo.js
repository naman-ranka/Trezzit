/**
 * chat-demo.js: a scripted exchange with an AI app that has Trezzit
 * connected. It opens on a finished conversation; a prompt (or Replay) plays
 * one, which can be paused. Reduced motion shows the finished conversation.
 */

import { PEOPLE } from './data.js';
import { money, esc, ICON, avatar, reduced, watchVisible, whenVisible, bankAmt } from './util.js';

function card(title, sub, rows, foot = '', note = '') {
  return `<div class="tzcard">
    <div class="tzcard-h"><span class="tzcard-mark" aria-hidden="true"></span><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span></div>${note ? `<p class="tzcard-note">${note}</p>` : ''}
    <ul role="list">${rows}</ul>${foot}
  </div>`;
}
const row = (left, right, extra = '') => `<li><span>${left}</span><span class="money">${right}</span>${extra}</li>`;

export function scripts(sc) {
  const byId = Object.fromEntries(sc.map((s) => [s.id, s]));
  // Two November charges that are not in Trezzit yet. October stays exactly as the statement table shows it.
  const parking = { total: 600, mine: 600 };
  const cafe = { total: 970, mine: 485 };
  const line = (d, m, c) => `<span class="bk">${d} ${m} ${bankAmt(c)}</span>`;
  // The house balance: every Roommates expense you paid in October (groceries, rent and bills, streaming).
  const house = ['groceries', 'rent', 'streaming'].map((id) => byId[id].sum.result.people);
  const owes = (id) => house.reduce((a, p) => a + (p[id]?.cents || 0), 0);
  const [maya, jordan, sam] = ['maya', 'jordan', 'sam'].map(owes);
  const who = (id) => `${avatar(PEOPLE[id], { size: 'sm' })}${PEOPLE[id].name}`;

  return {
    match: {
      steps: [
        { user: "Add what's missing from my statement. The café was with Maya.", attach: { icon: 'doc', name: 'nov-statement.pdf' } },
        { tools: ['Added 2 expenses'] },
        { html: card('Added from your statement', '',
          row(`${line('NOV 03', 'CITY PARKING', parking.total)}<small>Just you</small>`, money(parking.mine))
          + row(`${line('NOV 06', 'CORNER CAFE', cafe.total)}<small>You and Maya</small>`, money(cafe.mine)),
          '<p class="tzcard-by">Added by Claude · in your activity log</p>') },
        { ai: `Saved. Maya owes you ${money(cafe.total - cafe.mine)}.` },
      ],
    },
    house: {
      steps: [
        { user: 'Who owes who? Sam paid me back for October.' },
        { tools: ['Noted that Sam paid you'] },
        { html: card('Roommates', 'Rent, bills and groceries · October',
          row(who('maya'), money(maya))
          + row(who('jordan'), money(jordan))
          + row(`${who('sam')}<small class="paid">Paid ${money(sam)}</small>`, money(0)),
          `<p class="tzcard-f">Still owed to you <b class="money">${money(maya + jordan)}</b></p>`) },
        { ai: 'Noted. Sam paid you back outside Trezzit, so Sam is settled.' },
      ],
    },
  };
}

export function initChatDemo(section, scenarios) {
  const S = scripts(scenarios);
  const root = section.querySelector('[data-chat]');
  const log = root.querySelector('[data-log]');
  const chips = section.querySelectorAll('[data-script]');
  const ctl = root.querySelector('[data-ctl]');
  const live = root.querySelector('[data-chat-live]');
  // Follow the newest message unless the visitor has scrolled up to read.
  let stick = true;
  log.addEventListener('scroll', () => { stick = log.scrollHeight - log.scrollTop - log.clientHeight < 40; }, { passive: true });
  const toEnd = () => { if (stick) log.scrollTop = log.scrollHeight; };
  let run = 0;
  let paused = false;
  let wake = null;
  let playing = false;
  let current = 'match';
  let inView = true;

  const gate = async (id) => {
    while (paused || !inView) {
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

  function setCtl(state) {
    ctl.dataset.state = state;
    const label = { pause: 'Pause', play: 'Play', replay: 'Replay' }[state];
    ctl.innerHTML = `${ICON[state === 'replay' ? 'replay' : state]}<span>${label}</span>`;
    ctl.setAttribute('aria-label', `${label} the conversation`);
  }

  const bubble = (step) => {
    if (step.user !== undefined) {
      const att = step.attach ? `<span class="att">${ICON[step.attach.icon]}${esc(step.attach.name)}</span>` : '';
      return `<div class="msg msg-user">${att}<p></p></div>`;
    }
    if (step.tools) return `<div class="msg msg-tool">${step.tools.map((t) => `<span class="tool"><span class="spin" aria-hidden="true"></span>${ICON.check}<span>${esc(t)}</span></span>`).join('')}</div>`;
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
    if (reduced()) { setCtl('replay'); ctl.hidden = true; return; }
    paused = false; wake?.();
    playing = true; setCtl('pause');
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
          for (const t of tools) { await wait(260, id); t.classList.add('is-done'); }
          await wait(120, id);
        } else {
          await wait(m.classList.contains('msg-user') ? 200 : 320, id);
        }
      }
      playing = false; setCtl('replay');
      log.classList.remove('is-playing');
      const last = S[key].steps[S[key].steps.length - 1];
      if (live) live.textContent = last.ai || '';
    } catch (e) { if (e.message !== 'stale') throw e; }
  }

  chips.forEach((c) => c.addEventListener('click', () => {
    // On a phone the conversation sits below the prompts: bring its top into view so the answer is seen.
    const r = root.getBoundingClientRect();
    if (r.top < 64 || r.top > innerHeight * 0.55) root.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    play(c.dataset.script);
  }));
  ctl.addEventListener('click', () => {
    const st = ctl.dataset.state;
    if (st === 'replay') { play(current); return; }
    paused = st === 'pause';
    setCtl(paused ? 'play' : 'pause');
    if (!paused) wake?.();
  });

  // Opens finished (so nothing is ever half-drawn); the first time it comes into view it
  // plays once. A prompt (or Replay) plays a conversation.
  fit('match');
  setCtl('replay');
  if (reduced()) ctl.hidden = true;
  else whenVisible(log, () => { if (!playing && run === 0) play('match'); }, { threshold: 0.5 });
  let lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastW && !playing) { lastW = innerWidth; tallest = 0; fit(current); } }, { passive: true });
  document.fonts?.ready.then(() => { if (!playing) { tallest = 0; fit(current); } });
  watchVisible(root, (v) => { inView = v; if (v) wake?.(); }, { threshold: 0 });
}
