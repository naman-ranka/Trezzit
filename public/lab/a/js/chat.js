/* chat.js: a scripted assistant exchange. Neutral chat styling (not a copy of any AI app),
 * Trezzit's own cards for tool results. Plays when in view; pause, replay, and three prompts. */
import { PEOPLE } from '../../_kit/receipts.js';
import { $, $$, esc, money, ICON, avatar, reduced } from './util.js';
import { loadModel, compute, splitLabel } from './data.js';

const TZ = '<svg viewBox="0 0 120 120" aria-hidden="true" fill="currentColor"><polygon points="10.56,85.55 109.44,24.22 109.44,35.03 10.56,96.58" fill-opacity=".64"/><path d="M10 8.8h100v10.26H10zM45.42 8.8h9.07v81.23h-9.07zM64.69 30.01h9.08v81.17h-9.08zM10 100.92h100v10.26H10z"/></svg>';

async function scripts() {
  const gb = compute(await loadModel('green-basket'));
  const rm = await loadModel('monthly-rent');
  const rr = compute(rm);
  const row = (p, amt, note = '') => `<div class="r">${avatar(PEOPLE[p])}<span>${esc(PEOPLE[p].name)}${note ? ` <small>${note}</small>` : ''}</span><span class="money">${money(amt)}</span></div>`;
  const splitCard = () => `<div class="tz-card"><div class="hd"><strong>Green Basket Market</strong><span class="money">${money(gb.totalCents)}</span></div>
    <span class="tag">Preview · not saved yet</span>
    <div class="rows">${['you', 'maya', 'jordan', 'sam'].map((p) => row(p, gb.people[p].cents)).join('')}</div></div>`;
  return {
    split: {
      chip: 'Split this receipt',
      steps: [
        { t: 'user', att: true, text: 'Split this with Maya, Jordan and Sam. The avocados and cold brew are mine, the oat milk and kale chips are Maya’s.' },
        { t: 'tool', label: 'Reading the receipt', done: 'Read 14 items · $100.00' },
        { t: 'tool', label: 'Preparing the split', done: 'Preview ready' },
        { t: 'ai', text: 'Here’s the split. The hand towels are four ways, tax included.' },
        { t: 'card', html: splitCard() },
        { t: 'ai', text: 'Save it to Flatmates?' },
        { t: 'user', text: 'Yes' },
        { t: 'tool', label: 'Saving the bill', done: 'Saved' },
        { t: 'ai', text: `Saved to Flatmates. Maya owes you ${money(gb.people.maya.cents)}, Jordan ${money(gb.people.jordan.cents)}, Sam ${money(gb.people.sam.cents)}.` },
      ],
    },
    ask: {
      chip: 'What did I spend?',
      steps: [
        { t: 'user', text: 'What did I actually spend on groceries this month?' },
        { t: 'tool', label: 'Adding up your shares', done: 'Your shares, October' },
        { t: 'ai', text: '$58.13 on groceries so far in October, counting only your share of shared bills. That’s $6.77 less than September.' },
        { t: 'card', html: `<div class="tz-card"><div class="hd"><strong>Groceries · October</strong><span>your share</span></div>
          <p class="big money">$58.13</p>
          <div class="rows">
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Green Basket Market</span><span class="money">$22.00 <small>of $100.00</small></span></div>
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Green Grocer</span><span class="money">$17.80 <small>yours</small></span></div>
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Farmers market</span><span class="money">$9.20 <small>of $32.25</small></span></div>
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Sunday bagels</span><span class="money">$9.13 <small>of $42.00</small></span></div>
          </div></div>` },
      ],
    },
    rent: {
      chip: 'Add rent monthly',
      steps: [
        { t: 'user', text: 'Add our rent every month on the 1st. Rent by our usual percentages, bills split equally, parking is Jordan’s.' },
        { t: 'tool', label: 'Setting up a repeating expense', done: 'Preview ready' },
        { t: 'card', html: `<div class="tz-card"><div class="hd"><strong>Monthly rent · 1st of every month</strong><span class="money">${money(rr.totalCents)}</span></div>
          <span class="tag">Preview · not saved yet</span>
          <div class="rows">${rm.lines.map((l, i) => `<div class="r"><span class="dot" style="--c:var(--cat-${l.category})"></span><span>${esc(l.pretty.replace(/ november$/i, ''))} <small>${esc(splitLabel(l))}</small></span><span class="money">${money(rr.items[i].totalCents)}</span></div>`).join('')}</div>
          <div class="hd" style="margin-top:12px"><strong>Your share</strong><strong class="money">${money(rr.people.you.cents)}</strong></div></div>` },
        { t: 'ai', text: 'Start it on November 1?' },
        { t: 'user', text: 'Yes' },
        { t: 'tool', label: 'Saving the schedule', done: 'Repeats monthly from Nov 1' },
        { t: 'ai', text: 'Done. It adds itself on the 1st, and it shows in everyone’s activity.' },
      ],
    },
  };
}

export async function initChat() {
  const root = $('#chat-root');
  if (!root) return;
  const S = await scripts();
  const keys = Object.keys(S);
  root.innerHTML = `
    <div class="chat-chips" role="group" aria-label="Try a request">${keys.map((k) => `<button type="button" data-k="${k}" aria-pressed="false">${esc(S[k].chip)}</button>`).join('')}</div>
    <div class="chat" role="region" aria-label="Example conversation with an AI assistant connected to Trezzit">
      <div class="chat-top"><span class="ttl">Your AI assistant</span><span class="conn">Trezzit connected</span>
        <span class="ctl"><button type="button" class="pp" aria-label="Pause">${ICON.pause}</button><button type="button" class="rp" aria-label="Replay">${ICON.replay}</button></span></div>
      <div class="chat-log" aria-live="off"></div>
    </div>`;
  const log = $('.chat-log', root);
  const pp = $('.pp', root);
  let token = 0;
  let paused = false;
  let userPaused = false;
  let running = false;
  let active = null;

  const setPaused = (v) => {
    paused = v;
    pp.innerHTML = v ? ICON.play : ICON.pause;
    pp.setAttribute('aria-label', v ? 'Play' : 'Pause');
  };
  const wait = async (ms, tk) => {
    let left = ms;
    while (left > 0) {
      if (tk !== token) throw new Error('stop');
      await new Promise((r) => setTimeout(r, 50));
      if (!paused) left -= 50;
    }
    if (tk !== token) throw new Error('stop');
  };
  const scrollDown = () => { log.scrollTop = log.scrollHeight; };

  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  async function play(key, { instant = false } = {}) {
    token += 1;
    const tk = token;
    active = key;
    $$('.chat-chips button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === key)));
    log.innerHTML = '';
    running = true;
    const fast = instant || reduced();
    try {
      for (const st of S[key].steps) {
        if (st.t === 'user') {
          if (!fast && log.childElementCount) await wait(250, tk);
          log.appendChild(el(`<div class="msg msg-u">${st.att ? `<div class="att"><img src="./assets/receipt-thumb.webp" alt="" width="40" height="52">green-basket.jpg</div>` : ''}${esc(st.text)}</div>`));
          scrollDown();
          if (!fast) await wait(500, tk);
        } else if (st.t === 'tool') {
          const node = el(`<div class="tool"><span class="tz">${TZ}</span><span class="tl">Trezzit · ${esc(st.label)}</span><span class="s"></span></div>`);
          log.appendChild(node); scrollDown();
          if (!fast) await wait(900, tk);
          node.classList.add('done');
          $('.tl', node).textContent = `Trezzit · ${st.done}`;
          if (!fast) await wait(300, tk);
        } else if (st.t === 'ai') {
          const node = el('<div class="msg msg-a"><p></p></div>');
          log.appendChild(node);
          const p = $('p', node);
          if (fast) p.textContent = st.text;
          else {
            const words = st.text.split(' ');
            p.classList.add('typing');
            for (let i = 1; i <= words.length; i += 1) { p.textContent = words.slice(0, i).join(' '); scrollDown(); await wait(38, tk); }
            p.classList.remove('typing');
            await wait(350, tk);
          }
          scrollDown();
        } else if (st.t === 'card') {
          log.appendChild(el(st.html)); scrollDown();
          if (!fast) await wait(1100, tk);
        }
      }
    } catch { return; }
    if (instant) log.scrollTop = 0;
    running = false;
    log.setAttribute('aria-live', 'off');
  }

  $$('.chat-chips button', root).forEach((b) => b.addEventListener('click', () => { userPaused = false; setPaused(false); play(b.dataset.k); }));
  pp.addEventListener('click', () => {
    if (!running) { userPaused = false; setPaused(false); play(active || keys[0]); return; }
    userPaused = !paused; setPaused(!paused);
  });
  $('.rp', root).addEventListener('click', () => { userPaused = false; setPaused(false); play(active || keys[0]); });

  // Never an empty panel: the first exchange is there, finished. Tap a question to watch one play.
  await play(keys[0], { instant: true });
  setPaused(true);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting && running && !paused) setPaused(true);
      else if (e.isIntersecting && running && paused && !userPaused) setPaused(false);
    }), { threshold: 0.1 }).observe(root);
  }
}
