/**
 * chat-demo.js: a scripted exchange with an AI app that has Trezzit
 * connected. It opens on a finished conversation; a prompt (or Replay) plays
 * one, which can be paused. Reduced motion shows the finished conversation.
 */

import { PEOPLE } from './data.js';
import { money, esc, ICON, avatar, reduced, watchVisible, bankAmt } from './util.js';

function card(title, sub, rows, foot = '', note = '') {
  return `<div class="tzcard">
    <div class="tzcard-h"><span class="tzcard-mark" aria-hidden="true"></span><span><b>${title}</b><small>${sub}</small></span></div>${note ? `<p class="tzcard-note">${note}</p>` : ''}
    <ul role="list">${rows}</ul>${foot}
  </div>`;
}
const row = (left, right, extra = '') => `<li><span>${left}</span><span class="money">${right}</span>${extra}</li>`;

export function scripts(sc) {
  const byId = Object.fromEntries(sc.map((s) => [s.id, s]));
  const g = byId.groceries.sum;
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
      chip: "What's missing from Trezzit?",
      steps: [
        { user: "Here's my latest statement. Add what's not in Trezzit yet. The café was with Maya.", attach: { icon: 'doc', name: 'nov-statement.pdf' } },
        { tools: ['Added 2 expenses'] },
        { html: card('Added from your statement', '2 charges that weren’t in Trezzit',
          row(`${line('NOV 03', 'CITY PARKING', parking.total)}<small>Just you</small>`, money(parking.mine))
          + row(`${line('NOV 06', 'CORNER CAFE', cafe.total)}<small>You and Maya</small>`, money(cafe.mine)),
          `<p class="tzcard-f">You spent <b class="money">${money(parking.mine + cafe.mine)}</b> of the <span class="money">${money(parking.total + cafe.total)}</span> you paid.</p>`) },
        { ai: `Saved. Maya owes you ${money(cafe.total - cafe.mine)}. Both show in your activity log.` },
      ],
    },
    split: {
      chip: 'Split this receipt with my roommates',
      steps: [
        { user: 'Split this with Maya, Jordan and Sam. Avocados and cold brew are mine, oat milk and kale chips are Maya\'s.', attach: { icon: 'image', name: 'green-basket.jpg' } },
        { tools: ['Read the receipt', 'Saved to Roommates'] },
        { html: card('Green Basket Market', `${byId.groceries.itemCount} items · ${money(g.total)} · Roommates`,
          ['you', 'maya', 'jordan', 'sam'].map((id) => row(who(id), money(g.result.people[id].cents))).join(''),
          '', 'Avocados, cold brew &rarr; you · Oat milk, kale chips &rarr; Maya · the rest split 4 ways') },
        { ai: `Saved. You spent ${money(g.mine)}: ${money(g.byCategory.groceries)} on groceries, ${money(g.byCategory.household)} on household.` },
      ],
    },
    house: {
      chip: 'Who owes who in the house?',
      steps: [
        { user: 'Who owes who in the house? Sam just paid me back for October.' },
        { tools: ['Checked Roommates balances', 'Recorded Sam’s payment'] },
        { html: card('Roommates', 'Who owes you · October',
          row(who('maya'), money(maya))
          + row(who('jordan'), money(jordan))
          + row(`${who('sam')}<small class="paid">Paid you ${money(sam)} · settled</small>`, money(0)),
          `<p class="tzcard-f">Owed to you <b class="money">${money(maya + jordan)}</b></p>`) },
        { ai: `Recorded Sam's ${money(sam)}. Sam is settled. Trezzit only records it; the money moved outside Trezzit.` },
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

  async function play(key) {
    const id = ++run;
    current = key;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.script === key)));
    fit(key);
    if (reduced()) { setCtl('replay'); ctl.hidden = true; return; }
    paused = false; wake?.();
    playing = true; setCtl('pause');
    log.classList.add('is-playing');
    log.innerHTML = '';
    log.scrollTop = 0;
    stick = true;
    try {
      for (const step of S[key].steps) {
        await gate(id);
        const node = document.createElement('div');
        node.innerHTML = bubble(step);
        const m = node.firstElementChild;
        log.appendChild(m);
        toEnd();
        requestAnimationFrame(() => m.classList.add('in'));
        if (step.user !== undefined || step.ai !== undefined) {
          const p = m.querySelector('p');
          const text = step.user ?? step.ai;
          const words = text.split(' ');
          const per = step.user !== undefined ? 34 : 46;
          for (let w = 0; w < words.length; w += 1) {
            p.textContent = words.slice(0, w + 1).join(' ');
            toEnd();
            await wait(per, id);
          }
          await wait(step.user !== undefined ? 380 : 520, id);
        } else if (step.tools) {
          const chips = [...m.querySelectorAll('.tool')];
          chips.forEach((c) => { c.hidden = true; });
          for (const c of chips) {
            c.hidden = false;
            toEnd();
            await wait(520, id);
            c.classList.add('is-done');
            await wait(120, id);
          }
        } else {
          toEnd();
          await wait(900, id);
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

  // Opens finished: the first question and its answer. A prompt (or Replay) plays a conversation.
  fit('match');
  setCtl('replay');
  if (reduced()) ctl.hidden = true;
  let lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastW && !playing) { lastW = innerWidth; tallest = 0; fit(current); } }, { passive: true });
  document.fonts?.ready.then(() => { if (!playing) { tallest = 0; fit(current); } });
  watchVisible(root, (v) => { inView = v; if (v) wake?.(); }, { threshold: 0 });
}
