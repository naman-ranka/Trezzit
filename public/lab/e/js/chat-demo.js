/* chat-demo.js: scripted, realistic exchanges with an AI assistant that has
 * Trezzit connected. Neutral chat styling (not a copy of any AI app's UI).
 *
 * The panel is as tall as the conversation it shows (never scrolls, no blank
 * band): messages stack from the top. It opens on the first question already
 * asked, and the answer plays once a quarter of the panel is on screen. A prompt
 * tap plays another one. Tool steps are only the Trezzit tools that exist;
 * anything else (matching, comparing) is the AI's own reply. Every figure comes
 * from the same data as the demos. */
import { PEOPLE, CATEGORIES, BANK, AI_ENTRY, getSample, sampleBill, octoberLedger } from './data.js';
import { splitSample } from '../../_kit/receipts.js';
import { esc, money, icon, sleep, reduced, h, YOU_GLYPH, css, countMoney, bus } from './util.js';

const av = (p, sz = 'sm') => `<span class="av av-${sz}" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? YOU_GLYPH : PEOPLE[p].name[0]}</span>`;
const thumb = (id) => new URL(`../assets/thumb-${id}.webp`, import.meta.url).href;

async function buildScripts() {
  const gb = getSample('green-basket');
  const { bill } = await sampleBill('green-basket');
  const r = splitSample(gb, bill);
  const L = await octoberLedger();
  const groc = L.byCat.groceries;
  const grocLines = L.entries.map((e) => { const ls = e.lines.filter((l) => l.cat === 'groceries'); return { e, n: ls.length, c: ls.reduce((a, l) => a + l.cents, 0) }; }).filter((x) => x.c > 0);
  const owed = gb.people.filter((p) => p !== 'you').reduce((a, p) => a + r.people[p].cents, 0);
  // October before and after your AI adds the missing lunch (the month above moves by the same amount)
  const before = L.added ? L.spent - AI_ENTRY.youCents : L.spent;
  const after = before + AI_ENTRY.youCents;

  const splitCard = (saved) => `<div class="tc">
    <div class="tc-h"><span class="tc-k">${saved ? `${icon.check} Saved` : 'Draft'}</span><span>Apartment 3B</span></div>
    <p class="tc-t">Green Basket Market <b class="money">${money(r.totalCents)}</b></p>
    <ul class="tc-people tc-grid" role="list">${gb.people.map((p) => `<li>${av(p)}<span class="tc-pn">${PEOPLE[p].name}</span><b class="money">${money(r.people[p].cents)}</b></li>`).join('')}</ul>
  </div>`;

  // the statement your AI is given (no bank linking): four card payments, one of them not in Trezzit yet
  const charges = BANK.slice().reverse().map((c) => [c.text, money(c.cents).slice(1), c.id !== AI_ENTRY.id]);

  return {
    statement: {
      chip: 'Check my statement', short: 'Statement',
      steps: [
        { t: 'user', attach: { label: 'october-statement.pdf', doc: true }, text: 'Here’s my October card statement. What’s missing from Trezzit?', narrow: { text: 'What’s missing from Trezzit?' } },
        { t: 'tool', name: 'Read your payments', wide: true },
        { t: 'card', html: `<div class="tc">
          <div class="tc-h"><span class="tc-k">Statement vs Trezzit</span></div>
          <ul class="tc-rows tight mono" role="list">
            ${charges.map(([n, a, ok]) => `<li class="${ok ? '' : 'miss'}"><span>${n}</span><span class="r">−$${a} ${ok ? `<em class="ok" role="img" aria-label="In Trezzit">${icon.check}</em>` : '<em class="no">Not in Trezzit</em>'}</span></li>`).join('')}
          </ul></div>` },
        { t: 'ai', html: `Juniper Deli, <b class="money">${money(AI_ENTRY.totalCents)}</b> on ${AI_ENTRY.date}, isn’t in Trezzit. Add it as lunch?` },
        { t: 'user', text: 'Yes, add it.', wait: 900 },
        { t: 'tool', name: 'Add the expense', wide: true },
        // the proof behind "everything your AI adds shows in your activity": the row it just added
        { t: 'act', added: true, html: `<b>Juniper Deli</b> <span class="money">${money(AI_ENTRY.totalCents)}</span> <span aria-hidden="true">·</span> <span class="act-ai">${icon.sparkle}Added by AI</span>` },
        // the write-back, where the eye already is: October's total moves, and a link to see it in the month
        { t: 'proof', from: before, to: after },
      ],
    },
    split: {
      chip: 'Split a receipt', short: 'Split receipt',
      steps: [
        // one prompt at every width: the draft's figures need all four of these assignments
        { t: 'user', attach: { id: 'green-basket', label: 'receipt.jpg' }, text: 'Split with my roommates. Oat milk and kale chips are Maya’s; avocados and cold brew are mine.' },
        { t: 'tool', name: 'Read and draft the bill' },
        { t: 'card', html: splitCard(false) },
        { t: 'ai', text: 'Save it to Apartment 3B?' },
        { t: 'user', text: 'Save it.', wait: 900 },
        { t: 'tool', name: 'Save the bill' },
        // every width shows the whole consent beat: the draft, the question, your yes, then the save
        { t: 'ai', html: `Saved. Maya, Jordan and Sam owe you <b class="money">${money(owed)}</b>.` },
        // the proof behind "you see everything it adds": the row the app's activity feed shows
        { t: 'act', html: '<b>Activity</b> <span aria-hidden="true">·</span> Added by your AI <span aria-hidden="true">·</span> just now' },
      ],
    },
    groceries: {
      chip: 'Grocery spending', short: 'Groceries',
      steps: [
        { t: 'user', text: 'What did I actually spend on groceries in October?' },
        { t: 'tool', name: 'Read your expenses', wide: true },
        { t: 'tool', name: 'Add up your share' },
        { t: 'card', html: `<div class="tc">
          <div class="tc-h"><span class="tc-k"><i class="dot" style="--c:${CATEGORIES.groceries.color}"></i>Groceries · October</span><span>${grocLines.length} receipts</span></div>
          <p class="tc-t big money">${money(groc)}</p>
          <ul class="tc-rows" role="list">${grocLines.map(({ e, c, n }) => `<li><span><b>${esc(e.title)}</b><small>${e.date} · ${e.kind === 'personal' ? 'just you' : esc(e.group)}</small></span><span class="r"><b class="money">${money(c)}</b>${e.kind === 'personal' ? `<small>${n} grocery item${n === 1 ? '' : 's'}</small>` : e.totalCents !== c ? `<small class="money">of ${money(e.totalCents)}</small>` : ''}</span></li>`).join('')}</ul>
        </div>` },
        { t: 'ai', html: `<b class="money">${money(groc)}</b>, just your share of each receipt.` },
      ],
    },
  };
}

export async function mountChat(root, opts = {}) {
  const S = await buildScripts();
  const L = await octoberLedger();
  // home opens on the statement check (where Trezzit is going: your bank, matched without linking it);
  // /ai passes its own order
  const keys = opts.scripts || ['statement', 'groceries', 'split'];
  // phones: the panel must fit one screen under the nav, so long exchanges drop their optional turns
  const narrowMQ = matchMedia('(max-width: 479px)');
  // home: no tool lines (the "Added by AI" row is the proof of the action); /ai keeps them
  const stepsOf = (k) => S[k].steps.filter((st) => !(st.t === 'tool' && opts.tools === false) && !(st.wide && narrowMQ.matches) && !(st.narrowOnly && !narrowMQ.matches)).map((st) => (narrowMQ.matches && st.narrow ? { ...st, ...st.narrow } : st));
  css('chat'); // its styles (linked by the page, or loaded by home.js before mounting)
  root.classList.add('chat');
  root.innerHTML = `
    <div class="chat-win">
      <div class="chat-bar">
        <span class="chat-id"><span class="chat-glyph" aria-hidden="true">${icon.sparkle}</span><span class="chat-name"><b>Your AI</b> <span>with Trezzit</span></span></span>
        <button type="button" class="chat-ctl" aria-label="Replay">${icon.replay}</button>
      </div>
      <div class="chat-log" role="log" aria-live="off" aria-label="Conversation"></div>
      <div class="chat-try"${keys.length < 2 ? ' hidden' : ''}>
        <div class="chat-prompts" role="group" aria-label="Try a question">
          ${keys.map((k, i) => `<button type="button" class="prompt" data-k="${k}" aria-pressed="${i === 0}"><span class="pl">${esc(S[k].chip)}</span>${S[k].short ? `<span class="ps">${esc(S[k].short)}</span>` : ''}</button>`).join('')}
        </div>
      </div>
    </div>`;
  const win = root.querySelector('.chat-win');
  const log = root.querySelector('.chat-log');
  const ctl = root.querySelector('.chat-ctl');
  let run = 0;
  let paused = false;
  let gate = null;
  let state = 'done'; // playing | paused | done
  let current = keys[0];
  let touched = false;

  const setCtl = () => {
    const mode = state === 'done' ? 'replay' : paused || state === 'idle' ? 'play' : 'pause';
    ctl.innerHTML = icon[mode];
    ctl.setAttribute('aria-label', mode === 'replay' ? 'Replay' : mode === 'play' ? 'Play' : 'Pause');
    ctl.dataset.mode = mode;
  };

  function add(step, instant, target = log) {
    let el;
    if (step.t === 'user') {
      const att = step.attach ? (step.attach.doc
        ? `<span class="att doc"><span class="doc-i" aria-hidden="true"><svg viewBox="0 0 20 20" width="14" height="14"><path d="M6 2.5h5.5L15 6v11.5H6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 2.5V6.5h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></span>${esc(step.attach.label)}</span>`
        : `<span class="att"><img src="${thumb(step.attach.id)}" alt="" width="20" height="28">${esc(step.attach.label)}</span>`) : '';
      el = h(`<div class="msg u"><div class="bub"><span class="visually-hidden">You:</span>${att}<p>${esc(step.text)}</p></div></div>`);
    } else if (step.t === 'tool') {
      el = h(`<div class="msg tool${instant ? ' done' : ''}"><span class="tl-i">${icon.tool}</span><span><span class="visually-hidden">Trezzit tool:</span><span aria-hidden="true">Trezzit · </span>${esc(step.name)}</span><span class="tl-s" aria-hidden="true">${icon.check}</span></div>`);
    } else if (step.t === 'card') {
      if (step.replace) {
        const prev = [...target.querySelectorAll('.msg.card')].pop();
        if (prev) { prev.querySelector('.tc').outerHTML = step.html; if (!instant) prev.classList.add('swap'); return prev; }
      }
      el = h(`<div class="msg card"><span class="visually-hidden">Your AI:</span>${step.html}</div>`);
    } else if (step.t === 'act') {
      el = h(`<div class="msg act"><span class="act-i">${icon.check}</span><span><span class="visually-hidden">Your activity: </span>${step.html}</span></div>`);
      // the conversation really adds it: the month above gets the row (once; never from the off-screen measure)
      if (step.added && target === log) L.addAI();
    } else if (step.t === 'proof') {
      const month = document.getElementById('understand');
      el = h(`<p class="msg proof"><span>October</span> <s class="money">${money(step.from)}</s> <span aria-hidden="true">→</span> <b class="money" data-to>${money(step.to)}</b>${month ? ' <a href="#understand">See it in October <span aria-hidden="true">↑</span></a>' : ''}</p>`);
      if (!instant && target === log) countMoney(el.querySelector('[data-to]'), step.from, step.to, 700);
      el.querySelector('a')?.addEventListener('click', (e) => {
        e.preventDefault();
        bus.emit('ai-show');
        month.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      });
    } else {
      el = h(`<div class="msg a"><p><span class="visually-hidden">Your AI: </span>${step.html || esc(step.text)}</p></div>`);
    }
    if (!instant) el.classList.add('enter');
    target.appendChild(el);
    return el;
  }

  // The panel is exactly as tall as the finished conversation it is showing, measured off-screen with
  // the real markup and styles (re-measured when the width changes), so there is never a blank band.
  const probe = log.cloneNode(false);
  probe.removeAttribute('aria-label');
  probe.removeAttribute('role');
  probe.setAttribute('aria-hidden', 'true');
  probe.className = 'chat-log chat-probe';
  win.appendChild(probe);
  let lastW = 0;
  const heights = {};
  const size = () => { if (heights[current]) log.style.height = `${heights[current]}px`; };
  function fit() {
    const w = log.clientWidth;
    if (!w || w === lastW) return;
    lastW = w;
    keys.forEach((k) => {
      probe.innerHTML = '';
      stepsOf(k).forEach((s) => add(s, true, probe));
      heights[k] = Math.ceil(probe.scrollHeight) + 2;
    });
    probe.innerHTML = '';
    size();
  }
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(() => fit()).observe(win);
  narrowMQ.addEventListener?.('change', () => { lastW = 0; fit(); if (state === 'done') play(current, { instant: true }); });
  document.fonts?.ready.then(() => { lastW = 0; fit(); });

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

  async function play(k, { instant = reduced(), from = 0 } = {}) {
    run += 1;
    const my = run;
    current = k;
    paused = false;
    gate?.();
    size();
    root.querySelectorAll('.prompt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
    const steps = stepsOf(k);
    log.setAttribute('aria-busy', 'true');
    if (instant) {
      log.innerHTML = '';
      steps.forEach((s) => add(s, true));
      state = 'done'; setCtl(); log.setAttribute('aria-busy', 'false');
      return;
    }
    state = 'playing'; setCtl();
    try {
      // the old exchange fades out first, then the new question starts at the top
      // (from > 0: the question is already on screen, the answer carries on under it)
      if (!from) {
        if (log.children.length) {
          log.classList.add('fading');
          await wait(220, my);
        }
        log.innerHTML = '';
        log.classList.remove('fading');
      }
      for (const s of steps.slice(from)) {
        if (s.t === 'user') await wait(s.wait || 200, my);
        if (s.t === 'tool') await wait(220, my);
        if (s.t === 'card') await wait(160, my);
        if (s.t === 'ai') await wait(320, my);
        if (s.t === 'act') await wait(500, my);
        if (s.t === 'proof') await wait(350, my);
        const el = add(s, false);
        if (s.t === 'tool') { await wait(280, my); el.classList.add('done'); }
      }
      state = 'done'; setCtl();
    } catch { /* superseded */ }
    if (my === run) { log.classList.remove('fading'); log.setAttribute('aria-busy', 'false'); }
  }

  root.querySelectorAll('.prompt').forEach((b) => b.addEventListener('click', () => {
    touched = true;
    // the autoplay stays quiet for screen readers; conversations the visitor starts are announced
    log.setAttribute('aria-live', 'polite');
    // the whole exchange must be on screen: if the panel is cut off, bring its top just under the nav first
    const rect = win.getBoundingClientRect();
    if (rect.top < 64 || rect.bottom > innerHeight) win.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
    play(b.dataset.k);
  }));
  ctl.addEventListener('click', () => {
    touched = true;
    if (ctl.dataset.mode === 'replay') { play(current, { instant: false }); return; }
    if (state === 'idle') { play(current, { instant: false, from: 1 }); return; }
    paused = !paused;
    state = paused ? 'paused' : 'playing';
    if (!paused) gate?.();
    setCtl();
  });

  // First state: the first question is already asked (never an empty box). Its answer plays once a
  // quarter of the panel is on screen; with reduced motion the whole exchange is simply shown.
  if (reduced() || opts.autoplay === false || !('IntersectionObserver' in window)) play(keys[0], { instant: true });
  else {
    add(stepsOf(keys[0])[0], true);
    state = 'idle';
    // home: the answer waits until most of the chat is on screen and the month above has mostly scrolled
    // away (or the chat has been in view a moment), so the month's search proof is read first
    const above = opts.after ? document.querySelector(opts.after) : null;
    let aboveRatio = 0;
    let chatRatio = 0;
    let dwell = 0;
    const go = () => { io.disconnect(); aio?.disconnect(); clearTimeout(dwell); if (!touched && state === 'idle') play(keys[0], { instant: false, from: 1 }); };
    const aio = above ? new IntersectionObserver(([e]) => { aboveRatio = e.intersectionRatio; if (aboveRatio < 0.3 && chatRatio >= 0.6) go(); }, { threshold: [0, 0.15, 0.3, 0.5, 0.75, 1] }) : null;
    aio?.observe(above);
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(dwell);
      chatRatio = e.intersectionRatio;
      if (e.intersectionRatio < (above ? 0.6 : 0.25)) return;
      if (!above || aboveRatio < 0.3) go();
      else dwell = setTimeout(go, 2200);
    }, { threshold: above ? [0, 0.6, 0.8, 1] : 0.25 });
    io.observe(win);
  }
  setCtl();
  return { play, fit };
}
