/**
 * chat-demo.js: a scripted exchange with an AI app that has Trezzit
 * connected. It opens on a finished conversation; a prompt (or Replay) plays
 * one, which can be paused. Reduced motion shows the finished conversation.
 */

import { PEOPLE, CATEGORIES } from './data.js';
import { money, esc, ICON, avatar, reduced, watchVisible, bankAmt } from './util.js';

const C = (k) => CATEGORIES[k] || CATEGORIES.other;

function card(title, sub, rows, foot = '') {
  return `<div class="tzcard">
    <div class="tzcard-h"><span class="tzcard-mark" aria-hidden="true"></span><span><b>${title}</b><small>${sub}</small></span></div>
    <ul role="list">${rows}</ul>${foot}
  </div>`;
}
const row = (left, right, extra = '') => `<li><span>${left}</span><span class="money">${right}</span>${extra}</li>`;

export function scripts(sc) {
  const byId = Object.fromEntries(sc.map((s) => [s.id, s]));
  const paid = sc.filter((s) => s.bank).reduce((a, s) => a + s.sum.total, 0);
  const spent = sc.reduce((a, s) => a + s.sum.mine, 0);
  const cats = {};
  sc.forEach((s) => Object.entries(s.sum.byCategory).forEach(([k, v]) => { cats[k] = (cats[k] || 0) + v; }));
  const top = Object.entries(cats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const rest = top.slice(4);
  // The rows must add up to the header: "everything else" is the exact remainder.
  const restCents = spent - top.slice(0, 4).reduce((a, [, v]) => a + v, 0);
  const g = byId.groceries.sum;
  const r = byId.rent.sum;
  // Two charges from the same statement that are not in Trezzit yet (the table above shows only what is).
  const parking = { total: 600, mine: 600 };
  const cafe = { total: 970, mine: 485 };

  return {
    match: {
      chip: "What's on my statement but not in Trezzit?",
      steps: [
        { user: "Here's my October statement. What's on it but not in Trezzit yet?", attach: { icon: 'doc', name: 'october-statement.pdf' } },
        { tools: ['Checked your payments'] },
        { ai: 'Everything else is already in Trezzit. These 2 aren\'t. Just you, or shared?' },
        { html: `<div class="stmt-mini">
            <div><span>OCT 23</span><span>CITY PARKING</span><span>${bankAmt(parking.total)}</span></div>
            <div><span>OCT 17</span><span>CORNER CAFE</span><span>${bankAmt(cafe.total)}</span></div></div>` },
        { user: 'Parking was mine. The coffee was with Maya.' },
        { tools: ['Drafted 2 expenses'] },
        { html: card('Ready to save', '2 expenses · nothing saved yet',
          row(`City Parking <small>Just you</small>`, money(parking.mine))
          + row(`Corner Cafe <small>You and Maya · you paid ${money(cafe.total)}</small>`, money(cafe.mine)),
          `<p class="tzcard-f">You spent <b class="money">${money(parking.mine + cafe.mine)}</b> of the <span class="money">${money(parking.total + cafe.total)}</span> you paid.</p>`) },
        { user: 'Save both.' },
        { ai: `Saved. Both show in your activity log as added by your AI. Maya owes you ${money(cafe.total - cafe.mine)}.` },
      ],
    },
    spent: {
      chip: 'What did I actually spend in October?',
      steps: [
        { user: 'What did I actually spend in October?' },
        { tools: ['Listed your October expenses', 'Added up your shares'] },
        { ai: `Your bank says ${money(paid)} went out. Your share of everything was ${money(spent)}.` },
        { html: card('October, your share', `${money(spent)} across ${sc.length} expenses`,
          top.slice(0, 4).map(([k, v]) => row(`<span class="dot" style="--c:${C(k).color}"></span>${esc(C(k).label)}`, money(v))).join('')
          + (rest.length ? row(`<span class="dot" style="--c:#94a3b8"></span>Everything else <small>${esc(rest.map(([k]) => C(k).label).join(', '))}</small>`, money(restCents)) : ''),
          `<p class="tzcard-f">Total <b class="money">${money(spent)}</b></p>`) },
        { ai: `Rent was most of it. Dinner at Taqueria Sol counts too, even though Alex paid.` },
      ],
    },
    split: {
      chip: 'Split this receipt with my roommates',
      steps: [
        { user: 'Split this with Maya, Jordan and Sam. The avocados and cold brew are mine, oat milk and kale chips are Maya\'s.', attach: { icon: 'image', name: 'green-basket.jpg' } },
        { tools: ['Read the receipt', 'Found Maya, Jordan and Sam', 'Drafted the split'] },
        { html: card('Green Basket Market', `14 items · ${money(g.total)} · Flatmates`,
          ['you', 'maya', 'jordan', 'sam'].map((id) => row(id === 'you' ? avatar(PEOPLE[id], { size: 'sm', speak: true }) : `${avatar(PEOPLE[id], { size: 'sm' })}${PEOPLE[id].name}`, money(g.result.people[id].cents))).join('')) },
        { ai: 'Save it to Flatmates?' },
        { user: 'Yes.' },
        { tools: ['Saved to Flatmates'] },
        { ai: `Saved. You spent ${money(g.mine)}: ${money(g.byCategory.groceries)} on groceries and ${money(g.byCategory.household)} on household.` },
      ],
    },
    rent: {
      chip: 'Add our rent every month',
      steps: [
        { user: 'Add our rent every month on the 1st. Rent is $2,400: Maya and I pay 25% each, Jordan 28%, Sam 22%. Utilities and internet split four ways, parking is Jordan\'s.' },
        { tools: ['Found Maya, Jordan and Sam', 'Drafted a monthly expense'] },
        { html: card('Rent and bills', `Every month on the 1st · ${money(r.total)}`,
          row('Rent <small>Your 25%</small>', money(r.byCategory.rent || 0))
          + row('Utilities and internet <small>Split 4 ways · parking is Jordan\'s</small>', money((r.byCategory.utilities || 0) + (r.byCategory.internet || 0))),
          `<p class="tzcard-f"><span class="rec">${ICON.repeat}Next: Nov 1</span> · Your share <b class="money">${money(r.mine)}</b></p>`) },
        { ai: 'Save it? It adds itself on the 1st.' },
        { user: 'Yes.' },
        { tools: ['Saved the monthly expense'] },
        { ai: `Done. Your share is ${money(r.mine)} a month.` },
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
  // Follow the newest message unless the visitor has scrolled up to read.
  let stick = true;
  log.addEventListener('scroll', () => { stick = log.scrollHeight - log.scrollTop - log.clientHeight < 40; }, { passive: true });
  const toEnd = () => { if (stick) log.scrollTop = log.scrollHeight; };
  let run = 0;
  let paused = false;
  let wake = null;
  let playing = false;
  let current = 'spent';
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
  /* The log is as tall as the finished conversation (capped on desktop), so there is
     no empty slab under the first message and the question stays in view. */
  const cap = () => (innerWidth >= 1024 ? 680 : Infinity);
  function fit(key) {
    renderAll(key);
    log.style.height = 'auto';
    log.style.height = `${Math.min(log.scrollHeight, cap())}px`;
    log.scrollTop = 0;
  }

  async function play(key) {
    const id = ++run;
    current = key;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.script === key)));
    fit(key);
    if (reduced()) { setCtl('replay'); ctl.hidden = true; return; }
    paused = false; wake?.();
    playing = true; setCtl('pause');
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
    } catch (e) { if (e.message !== 'stale') throw e; }
  }

  chips.forEach((c) => c.addEventListener('click', () => {
    // On a phone the conversation sits below the prompts: bring it into view so the answer is seen.
    const r = root.getBoundingClientRect();
    if (r.top > innerHeight * 0.55 || r.bottom < 80) root.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
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
  fit('spent');
  setCtl('replay');
  if (reduced()) ctl.hidden = true;
  let lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastW && !playing) { lastW = innerWidth; fit(current); } }, { passive: true });
  watchVisible(root, (v) => { inView = v; if (v) wake?.(); }, { threshold: 0 });
}
