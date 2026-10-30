/* chat.js: a scripted assistant exchange. Neutral chat styling (not a copy of any AI app),
 * Trezzit's own cards for tool results. Two prompts: the read first (what you spent on groceries this month: your share
 * only, item by item, across every receipt in the month card above, so it finds the sparkling water on the pharmacy
 * receipt), then the write (this page's receipt, split from a sentence, shown as a preview and saved after a yes).
 * The log keeps one height (the opening exchange's, measured at this width), so a chip never moves the trust line or the
 * Connect buttons below; the longer write scrolls inside, kept at its newest message. The panel opens on the read, finished; a chip or Replay plays one (Replay rests while it
 * plays). A one-line result is announced when a run ends. */
import { $, $$, esc, money, ICON, reduced, avatar } from './util.js';
import { loadModel, compute, PEOPLE } from './data.js';

const TZ = '<svg viewBox="0 0 120 120" aria-hidden="true" fill="currentColor"><polygon points="10.56,85.55 109.44,24.22 109.44,35.03 10.56,96.58" fill-opacity=".64"/><path d="M10 8.8h100v10.26H10zM45.42 8.8h9.07v81.23h-9.07zM64.69 30.01h9.08v81.17h-9.08zM10 100.92h100v10.26H10z"/></svg>';

// groceries in October, exactly the month card's receipts: your groceries-only share of Green Basket (live from the
// story) plus the one grocery line on the pharmacy receipt (sparkling water, all yours; the kit's engine gives $1.29)
const PHARMACY_WATER = 129;
const gbGroceries = () => window.__tzSplit?.groceriesCents ?? 2200;
const groceries = () => gbGroceries() + PHARMACY_WATER;

async function scripts() {
  const gb = compute(await loadModel('green-basket'));
  // a person's total, and (for the two named in the request) the items that made it, so the preview can be checked
  const row = (p, items) => `<div class="r">${avatar(PEOPLE[p])}<span>${esc(PEOPLE[p].name)}${items ? `<small class="why">${esc(items)} + ¼ shared</small>` : ''}</span><span class="money">${money(gb.people[p].cents)}</span></div>`;
  return {
    // the read first: the item-level ledger, across every receipt this month, that only an AI connected to it can answer
    ask: {
      chip: 'Groceries this month?',
      say: () => `Groceries, October: ${money(groceries())}.`,
      steps: [
        { t: 'user', text: 'What did I spend on groceries this month?' },
        { t: 'tool', label: 'Adding up your shares', done: 'Your shares, October' },
        // Green Basket is the receipt split above: its groceries-only slice follows whatever share you gave yourself there
        { t: 'card', html: () => `<div class="tz-card"><div class="hd"><strong>Groceries · October</strong><span>your share</span></div>
          <p class="big money" data-gt>${money(groceries())}</p>
          <div class="rows">
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Green Basket Market<small class="why">Shared · groceries only</small></span><span class="money" data-gb>${money(gbGroceries())}</span></div>
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Corner Pharmacy<small class="why">Just you · sparkling water</small></span><span class="money">${money(PHARMACY_WATER)}</span></div>
          </div></div>` },
        { t: 'ai', text: 'That includes the sparkling water on your pharmacy receipt.' },
      ],
    },
    // the write: the page's own receipt, handed to the AI; a preview, then saved after a yes
    split: {
      chip: 'Split this receipt',
      say: 'Saved to Roommates.',
      steps: [
        { t: 'user', att: true, text: 'Split with my roommates. Avocados and cold brew are mine; oat milk and kale chips, Maya’s.' },
        { t: 'tool', label: 'Reading the receipt', done: '14 items read' },
        { t: 'card', html: `<div class="tz-card"><div class="hd"><strong>Green Basket Market · Oct 24</strong><span class="money">${money(gb.totalCents)}</span></div>
          <span class="tag">Preview · not saved yet</span>
          <div class="rows rows-p">${row('you', 'Avocados, cold brew')}${row('maya', 'Oat milk, kale chips')}${row('jordan')}${row('sam')}</div></div>` },
        // a sentence, not a button: the visitor's own reply
        { t: 'user', text: 'Looks right. Save it.' },
        { t: 'tool', label: 'Saving', done: 'Saved to Roommates', ok: true },
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
      <div class="chat-top"><span class="ttl">Your AI</span><span class="conn">Trezzit connected</span>
        <span class="ctl"><button type="button" class="rp" aria-label="Replay">${ICON.replay}</button></span></div>
      <div class="chat-log" aria-live="off"></div>
    </div>
    <p class="visually-hidden" aria-live="polite" data-live></p>`;
  const log = $('.chat-log', root);
  const chat = $('.chat', root);
  const rp = $('.rp', root);
  const live = $('[data-live]', root);
  // one control, one size: Replay, resting while an exchange plays (every run is under six seconds)
  const setBtn = (playing) => { rp.setAttribute('aria-disabled', String(playing)); };
  let token = 0;
  let paused = false;
  let running = false;
  let active = null;
  const setPaused = (v) => { paused = v; root.classList.toggle('is-paused', v); };
  const wait = async (ms, tk) => {
    let left = ms;
    while (left > 0) {
      if (tk !== token) throw new Error('stop');
      await new Promise((r) => setTimeout(r, 50));
      if (!paused) left -= 50;
    }
    if (tk !== token) throw new Error('stop');
  };
  // a longer exchange scrolls inside the log, kept at its newest message, like a real chat
  const scrollDown = () => { log.scrollTop = log.scrollHeight; };

  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  // the photo rides inside the request, as a thumbnail, so the question and its receipt are one bubble
  const userNode = (st) => el(st.att
    ? `<div class="msg msg-u has-att"><img src="./assets/receipt-thumb.webp" alt="Photo of the Green Basket receipt" width="40" height="52"><span>${esc(st.text)}</span></div>`
    : `<div class="msg msg-u">${esc(st.text)}</div>`);

  // keep: the first message is already on screen (the primed panel), so the run continues from it without a flash
  // each finished exchange's height, measured by fit(): the log takes it before a run starts, so the final frame shows
  // the whole exchange (the request included) with no empty band above a short answer
  const H = {};
  // the log is as tall as the default exchange (the split), so it ends right under "Saved to Roommates"; a taller
  // exchange scrolls inside, kept at its newest message
  // the log is as tall as the exchange on screen (measured at this width), easing between them, so a short answer
  // never sits over an empty band; a tap changes it, so only the visitor's own action ever moves the page below
  // one height for every exchange: the opening one's, measured at this width, so the first frame has no empty band
  // under the answer, and a chip changes the conversation, never the page below. The longer write exchange scrolls
  // inside the log, kept at its newest message, like a real chat.
  const size = () => { const h = H[keys[0]]; if (h) log.style.height = `${h}px`; };
  async function play(key, { instant = false, keep = false } = {}) {
    token += 1;
    const tk = token;
    active = key;
    size();
    $$('.chat-chips button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === key)));
    const kept = keep && log.childElementCount === 1;
    if (!kept) log.innerHTML = '';
    running = true;
    const fast = instant || reduced();
    if (!instant) setBtn(!fast);
    try {
      for (const st of S[key].steps.slice(kept ? 1 : 0)) {
        if (st.t === 'user') {
          if (!fast && log.childElementCount) await wait(kept ? 500 : 250, tk);
          log.appendChild(userNode(st));
          scrollDown();
          if (!fast) await wait(500, tk);
        } else if (st.t === 'tool') {
          const node = el(`<div class="tool${st.ok ? ' tool-ok' : ''}"><span class="tz">${TZ}</span><span class="tl">Trezzit · ${esc(st.label)}</span><span class="s"></span></div>`);
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
          log.appendChild(el(typeof st.html === 'function' ? st.html() : st.html)); scrollDown();
          if (!fast) await wait(1100, tk);
        }
      }
    } catch { return; } finally { $$('.typing', log).forEach((n) => n.classList.remove('typing')); }
    running = false;
    setPaused(false);
    setBtn(false);
    if (!instant) live.textContent = typeof S[key].say === 'function' ? S[key].say() : S[key].say;
  }

  // bring the panel into view first, so a tap near the fold never plays off screen
  // nothing is ever parked under the sticky nav: the chips and panel together when they fit, else the panel's top
  // the chips never end up under the translucent bar: they come out from under it if they are there, and the page only
  // scrolls far enough to show the answer's end, never past the chips
  const start = (k) => {
    setPaused(false);
    const navH = document.getElementById('nav')?.offsetHeight || 56;
    const top = navH + 12;
    const rr = root.getBoundingClientRect();
    const end = chat.getBoundingClientRect().bottom;
    let dy = 0;
    if (rr.top < top) dy = rr.top - top;
    else if (end > innerHeight - 12) dy = Math.min(end - (innerHeight - 12), rr.top - top);
    if (Math.abs(dy) > 2) scrollBy({ top: dy, behavior: reduced() ? 'auto' : 'smooth' });
    play(k);
  };
  $$('.chat-chips button', root).forEach((b) => b.addEventListener('click', () => start(b.dataset.k)));
  rp.addEventListener('click', () => { if (!running) start(active || keys[0]); });

  // Each exchange's finished height is measured here, at this width; the log keeps the opening one's (see size()).
  async function fit() {
    const keep = active || keys[0];
    log.classList.add('is-measuring');
    for (const k of keys) { delete H[k]; }
    log.style.height = '';
    for (const k of keys) { await play(k, { instant: true }); H[k] = log.scrollHeight; }
    log.classList.remove('is-measuring');
    await play(keep, { instant: true });
    scrollDown();
  }
  // Never an empty or half-played panel: it opens on the first exchange, finished, at every width (nothing plays on
  // its own, so a fast scroll never passes a spinner in a tall empty box). A chip or Replay plays one, animated.
  await fit();
  // the split above changed your groceries share: a read card already on screen follows it
  document.addEventListener('tz:share', () => {
    const gt = $('[data-gt]', log); const gbv = $('[data-gb]', log);
    if (gt) gt.textContent = money(groceries());
    if (gbv) gbv.textContent = money(gbGroceries());
  });
  let w = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== w && !running) { w = innerWidth; fit(); } }, { passive: true });
  if ('IntersectionObserver' in window) {
    // a running exchange waits while it is off screen
    new IntersectionObserver((es) => es.forEach((e) => { if (running) setPaused(!e.isIntersecting); }), { threshold: 0.1 }).observe(chat);
  }
}
