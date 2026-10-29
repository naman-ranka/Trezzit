/* chat-demo.js: scripted, realistic exchanges with an AI assistant that has
 * Trezzit connected. Neutral chat styling (not a copy of any AI app's UI).
 * Plays once when visible; pause / replay controls; reduced motion shows the
 * finished conversation. Every figure comes from the same data as the demos. */
import { PEOPLE, CATEGORIES, LAST_MONTH, getSample, sampleBill, octoberLedger } from './data.js';
import { splitSample } from '../../_kit/receipts.js';
import { esc, money, icon, sleep, reduced, onVisible, h } from './util.js';

const av = (p, sz = 'sm') => `<span class="av av-${sz}" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? 'You' : PEOPLE[p].name[0]}</span>`;
const thumb = (id) => new URL(`../assets/thumb-${id}.webp`, import.meta.url).href;

async function buildScripts() {
  const gb = getSample('green-basket');
  const { bill } = await sampleBill('green-basket');
  const r = splitSample(gb, bill);
  const L = await octoberLedger();
  const groc = L.byCat.groceries;
  const grocLines = L.entries.map((e) => ({ e, c: e.lines.filter((l) => l.cat === 'groceries').reduce((a, l) => a + l.cents, 0) })).filter((x) => x.c > 0);
  const grocDelta = LAST_MONTH.groceries - groc;
  const owed = gb.people.filter((p) => p !== 'you').reduce((a, p) => a + r.people[p].cents, 0);

  const splitCard = (saved) => `<div class="tc">
    <div class="tc-h"><span class="tc-k">${saved ? `${icon.check} Saved` : 'Draft, not saved yet'}</span><span>Apartment 3B</span></div>
    <p class="tc-t">Green Basket Market <b class="money">${money(r.totalCents)}</b></p>
    <p class="tc-s">14 items · you paid · hand towels split 4 ways</p>
    <ul class="tc-people" role="list">${gb.people.map((p) => `<li>${av(p)}<span>${PEOPLE[p].name}</span><b class="money">${money(r.people[p].cents)}</b></li>`).join('')}</ul>
    ${saved ? '<p class="tc-act">In your activity <span aria-hidden="true">·</span> added via your AI app</p>' : ''}
  </div>`;

  return {
    split: {
      chip: 'Split this receipt',
      steps: [
        { t: 'user', attach: { id: 'green-basket', label: 'receipt.jpg' }, text: 'Split this with my roommates. The oat milk and kale chips are Maya’s; the avocados and cold brew are mine.' },
        { t: 'tool', name: 'Read the receipt' },
        { t: 'tool', name: 'Draft the bill' },
        { t: 'card', html: splitCard(false) },
        { t: 'ai', text: 'Here’s the draft. Save it to Apartment 3B?' },
        { t: 'user', text: 'Save it.', wait: 900 },
        { t: 'tool', name: 'Save the bill' },
        { t: 'card', html: splitCard(true), replace: true },
        { t: 'ai', html: `Saved. Maya, Jordan and Sam owe you <b class="money">${money(owed)}</b>.` },
      ],
    },
    groceries: {
      chip: 'What did I spend on groceries?',
      steps: [
        { t: 'user', text: 'What did I actually spend on groceries in October?' },
        { t: 'tool', name: 'Read your expenses' },
        { t: 'tool', name: 'Add up your share' },
        { t: 'card', html: `<div class="tc">
          <div class="tc-h"><span class="tc-k"><i class="dot" style="--c:${CATEGORIES.groceries.color}"></i>Groceries · October</span><span>Your share only</span></div>
          <p class="tc-t big money">${money(groc)}</p>
          <ul class="tc-rows" role="list">${grocLines.map(({ e, c }) => `<li><span><b>${esc(e.title)}</b><small>${e.date} · ${e.kind === 'personal' ? 'just you' : esc(e.group)}</small></span><span class="r"><b class="money">${money(c)}</b>${e.totalCents !== c ? `<small class="money">of ${money(e.totalCents)}</small>` : ''}</span></li>`).join('')}</ul>
        </div>` },
        { t: 'ai', html: `<b class="money">${money(groc)}</b>, your share only. That’s ${money(grocDelta)} less than September.` },
      ],
    },
    rent: {
      chip: 'Add rent every month',
      steps: [
        { t: 'user', text: 'Add our rent every month, split the same way as November.' },
        { t: 'tool', name: 'Find November rent' },
        { t: 'tool', name: 'Draft the monthly expense' },
        { t: 'card', html: `<div class="tc">
          <div class="tc-h"><span class="tc-k rec">${icon.repeat} Every month on the 1st</span><span>Apartment 3B</span></div>
          <p class="tc-t">Monthly rent <b class="money">$2,632.40</b></p>
          <ul class="tc-rows tight" role="list">
            <li><span>Rent</span><span class="r">25 · 25 · 28 · 22 %</span></li>
            <li><span>Water, trash, internet</span><span class="r">Equally</span></li>
            <li><span>Parking space</span><span class="r">Jordan</span></li>
          </ul>
          <p class="tc-s">Next: Dec 1 · your share <b class="money">$639.35</b></p>
        </div>` },
        { t: 'ai', text: 'Add it automatically, or ask you first each month?' },
        { t: 'user', text: 'Add it automatically.', wait: 900 },
        { t: 'tool', name: 'Save the monthly expense' },
        { t: 'ai', text: 'Done. It lands on the 1st, and you can skip or change any month.' },
      ],
    },
    owe: {
      chip: 'Who owes me?',
      steps: [
        { t: 'user', text: 'Who owes me money right now?' },
        { t: 'tool', name: 'Check balances' },
        { t: 'card', html: `<div class="tc">
          <div class="tc-h"><span class="tc-k">Balances</span><span>All groups</span></div>
          <ul class="tc-people" role="list">
            <li>${av('alex')}<span>Alex owes you</span><b class="money pos">$29.88</b></li>
            <li>${av('priya')}<span>Priya owes you</span><b class="money pos">$27.96</b></li>
            <li>${av('sam')}<span>Sam owes you</span><b class="money pos">$26.24</b></li>
            <li>${av('jordan')}<span>Jordan owes you</span><b class="money pos">$16.75</b></li>
            <li>${av('maya')}<span>You owe Maya</span><b class="money neg">$603.10</b></li>
          </ul></div>` },
        { t: 'ai', html: 'Four people owe you <b class="money">$100.83</b>. You owe Maya <b class="money">$603.10</b>, your rent less the <b class="money">$36.25</b> she owes you.' },
      ],
    },
    statement: {
      chip: 'What’s missing from my statement?',
      steps: [
        { t: 'user', attach: { label: 'october-statement.pdf', doc: true }, text: 'Here’s my October card statement. What’s missing from Trezzit?' },
        { t: 'tool', name: 'Read your payments' },
        { t: 'tool', name: 'Match charges to bills' },
        { t: 'card', html: `<div class="tc">
          <div class="tc-h"><span class="tc-k">Statement vs Trezzit</span><span>6 charges</span></div>
          <ul class="tc-rows tight mono" role="list">
            ${[['GREEN BASKET MARKET', '100.00', 1], ['CORNER PHARMACY', '48.22', 1], ['TAQUERIA SOL', '84.87', 1], ['NETFLIX.COM', '24.99', 1], ['HARBOR HARDWARE', '37.15', 0], ['CITY PARKING', '12.00', 0]]
              .map(([n, a, ok]) => `<li class="${ok ? '' : 'miss'}"><span>${n}${ok ? '' : '<em class="no">Not in Trezzit</em>'}</span><span class="r">−$${a} <em class="${ok ? 'ok' : 'nx'}">${ok ? icon.check : ''}</em></span></li>`).join('')}
          </ul></div>` },
        { t: 'ai', text: 'Two charges aren’t in Trezzit yet. Got the hardware receipt?' },
      ],
    },
    settle: {
      chip: 'Record a payment',
      steps: [
        { t: 'user', text: 'I paid Maya back $603.10 for rent. Record it.' },
        { t: 'tool', name: 'Record the payment' },
        { t: 'card', html: `<div class="tc">
          <div class="tc-h"><span class="tc-k">${icon.check} Settlement recorded</span><span>Apartment 3B</span></div>
          <ul class="tc-people" role="list"><li>${av('you')}<span>You paid Maya</span><b class="money">$603.10</b></li></ul>
          <p class="tc-s">Paid outside Trezzit, by bank transfer.</p></div>` },
        { t: 'ai', text: 'Recorded. You and Maya are even now. Trezzit doesn’t move money.' },
      ],
    },
  };
}

export async function mountChat(root, opts = {}) {
  const S = await buildScripts();
  const keys = opts.scripts || ['statement', 'groceries', 'split', 'owe'];
  root.classList.add('chat');
  // One fixed-height panel: the conversation scrolls inside it, so the page never jumps
  // and the panel is never an empty box. Suggestions sit where the composer would be.
  root.innerHTML = `
    <div class="chat-win">
      <div class="chat-bar">
        <span class="chat-id"><span class="chat-glyph" aria-hidden="true">${icon.sparkle}</span><span><b>Your AI assistant</b><small>Claude or ChatGPT, with Trezzit</small></span></span>
        <button type="button" class="chat-ctl" aria-label="Pause">${icon.pause}</button>
      </div>
      <ol class="chat-log" aria-live="off" tabindex="0" aria-label="Conversation"></ol>
      <div class="chat-try">
        <div class="chat-prompts" role="group" aria-labelledby="chat-try-${uid}">
          <span class="chat-try-l" id="chat-try-${uid}">Try</span>
          ${keys.map((k, i) => `<button type="button" class="prompt" data-k="${k}" aria-pressed="${i === 0}">${esc(S[k].chip)}</button>`).join('')}
        </div>
      </div>
    </div>`;
  uid += 1;
  const log = root.querySelector('.chat-log');
  const ctl = root.querySelector('.chat-ctl');
  let run = 0;
  let paused = false;
  let gate = null;
  let state = 'idle'; // playing | paused | done
  let current = keys[0];

  const setCtl = () => {
    const mode = state === 'done' ? 'replay' : state === 'idle' || paused ? 'play' : 'pause';
    ctl.innerHTML = icon[mode];
    ctl.setAttribute('aria-label', mode === 'replay' ? 'Replay' : mode === 'play' ? 'Play' : 'Pause');
    ctl.dataset.mode = mode;
  };

  // Nothing is pinned or overlaid: the question starts at the top of the panel, and the panel
  // only scrolls when the answer outgrows it, keeping the top of the newest card in view.
  let ask = null;
  const follow = (el) => {
    const pad = 14;
    const anchor = el.classList.contains('card') || el.classList.contains('a') ? el : null;
    let top = Math.max(ask ? ask.offsetTop - pad : 0, el.offsetTop + el.offsetHeight - log.clientHeight + pad);
    const card = [...log.querySelectorAll('.msg.card')].filter((c) => !ask || c.offsetTop > ask.offsetTop).pop();
    if (card && anchor) top = Math.min(top, card.offsetTop - pad);
    // never leave a sliver of the question at the top edge: show all of it or none of it
    if (ask && top > ask.offsetTop - pad && top < ask.offsetTop + ask.offsetHeight) {
      const below = ask.offsetTop + ask.offsetHeight + 4;
      top = card && anchor ? Math.min(below, card.offsetTop - pad) : below;
    }
    top = Math.max(0, top);
    // room below the answer when needed, so the panel can rest exactly there (like a chat app)
    log.style.paddingBottom = '';
    const room = top + log.clientHeight - log.scrollHeight;
    if (room > 0) log.style.paddingBottom = `${parseFloat(getComputedStyle(log).paddingBottom) + room}px`;
    log.scrollTo({ top, behavior: reduced() ? 'auto' : 'smooth' });
  };

  async function wait(ms, my) {
    let left = ms;
    while (left > 0) {
      if (my !== run) throw new Error('stale');
      if (paused) { await new Promise((res) => { gate = res; }); continue; }
      const step = Math.min(left, 100);
      await sleep(step);
      left -= step;
    }
    if (my !== run) throw new Error('stale');
  }

  function add(step, instant) {
    let el;
    if (step.t === 'user') {
      const att = step.attach ? (step.attach.doc
        ? `<span class="att doc"><span class="doc-i" aria-hidden="true">PDF</span>${esc(step.attach.label)}</span>`
        : `<span class="att"><img src="${thumb(step.attach.id)}" alt="" width="28" height="40">${esc(step.attach.label)}</span>`) : '';
      el = h(`<li class="msg u"><div class="bub">${att}<p>${esc(step.text)}</p></div></li>`);
    } else if (step.t === 'tool') {
      el = h(`<li class="msg tool${instant ? ' done' : ''}"><span class="tl-i">${icon.tool}</span><span>Trezzit <span aria-hidden="true">·</span> ${esc(step.name)}</span><span class="tl-s" aria-hidden="true">${icon.check}</span></li>`);
    } else if (step.t === 'card') {
      if (step.replace) {
        const prev = [...log.querySelectorAll('.msg.card')].pop();
        if (prev) { prev.querySelector('.tc').outerHTML = step.html; prev.classList.add('swap'); return prev; }
      }
      el = h(`<li class="msg card">${step.html}</li>`);
    } else {
      el = h(`<li class="msg a"><p>${step.html || esc(step.text)}</p></li>`);
    }
    if (!instant) el.classList.add('enter');
    log.appendChild(el);
    return el;
  }

  async function play(k, { instant = reduced(), from = 0 } = {}) {
    run += 1;
    const my = run;
    current = k;
    paused = false;
    gate?.();
    root.querySelectorAll('.prompt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
    log.style.paddingBottom = '';
    if (!from) { log.innerHTML = ''; ask = null; }
    else ask = log.querySelector('.msg.u');
    log.setAttribute('aria-busy', 'true');
    const steps = S[k].steps;
    if (instant) {
      steps.forEach((s) => add(s, true));
      log.querySelectorAll('.msg.tool').forEach((t) => t.classList.add('done'));
      log.scrollTop = 0;
      state = 'done'; setCtl(); log.setAttribute('aria-busy', 'false');
      return;
    }
    log.scrollTop = 0;
    state = 'playing'; setCtl();
    try {
      for (const s of steps.slice(from)) {
        if (s.t === 'user') await wait(s.wait || 250, my);
        if (s.t === 'tool') await wait(220, my);
        if (s.t === 'card') await wait(160, my);
        if (s.t === 'ai') await wait(320, my);
        const el = add(s, false);
        // a new request scrolls to the top of the panel; answers grow below it
        if (s.t === 'user') ask = el;
        // once a result card lands, the question folds to one line so question, card and answer fit together
        if (s.t === 'card' && ask) ask.classList.add('brief');
        follow(el);
        if (s.t === 'tool') { await wait(280, my); el.classList.add('done'); }
      }
      state = 'done'; setCtl();
    } catch { /* superseded */ }
    if (my === run) log.setAttribute('aria-busy', 'false');
  }

  root.querySelectorAll('.prompt').forEach((b) => b.addEventListener('click', () => {
    // the autoplay stays quiet for screen readers; conversations the visitor starts are announced
    log.setAttribute('aria-live', 'polite');
    b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    play(b.dataset.k);
  }));
  ctl.addEventListener('click', () => {
    if (ctl.dataset.mode === 'replay' || state === 'idle') { play(current, { instant: false }); return; }
    paused = !paused;
    state = paused ? 'paused' : 'playing';
    if (!paused) gate?.();
    setCtl();
  });

  if (reduced() || opts.autoplay === false) play(keys[0], { instant: true });
  else {
    // the request is already on screen; the answer plays once the panel is in view
    add(S[keys[0]].steps[0], true);
    onVisible(root, () => { if (state === 'idle') play(keys[0], { instant: false, from: 1 }); }, { threshold: 0.5 });
  }
  setCtl();
  return { play };
}
let uid = 0;
