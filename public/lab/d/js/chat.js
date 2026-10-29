// Scripted AI conversations: a user message, Trezzit tool calls, a Trezzit card, the answer.
import { $, $$, esc, money, icon, tmark, reducedMotion, onVisible, Clock, announce } from './ui.js';
import { getWorld, catOf, PEOPLE } from './world.js';

const okIcon = `<span class="st ok">${icon('check')}</span>`;

function legend(entries) {
  return `<div class="catbar" aria-hidden="true">${entries.map((c) => `<i style="flex-grow:${c.cents};background:${c.color}"></i>`).join('')}</div>
  <div class="legend">${entries.map((c) => `<span><i style="background:${c.color}"></i>${esc(c.label)} <b class="money">${money(c.cents)}</b></span>`).join('')}</div>`;
}

/* ---------- the cards ---------- */
function splitCard(w) {
  const b = w.bills[0];
  const you = b.split.people.you;
  const cats = Object.entries(you.byCategory).map(([id, cents]) => ({ cents, ...catOf(id) }));
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>Green Basket Market</b><span>Oct 24 · Flat 3B · you paid</span></span></div>
    <div class="versus"><div class="bank"><span class="lbl">Your bank</span><span class="v money">${money(-b.totalCents)}</span></div><div class="mine"><span class="lbl">You spent</span><span class="v money">${money(you.cents)}</span></div></div>
    ${legend(cats)}</div>`;
}

function octoberCard(w) {
  const top = w.cats.slice(0, 3);
  const rest = w.cats.slice(3).reduce((a, c) => a + c.cents, 0);
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>October</b><span>${w.bills.length} expenses · your share only</span></span></div>
    <div class="versus"><div class="bank plain"><span class="lbl">You paid</span><span class="v money">${money(w.paidCents)}</span></div><div class="mine"><span class="lbl">You spent</span><span class="v money">${money(w.spentCents)}</span></div></div>
    ${legend([...top, { cents: rest, label: 'Other', color: '#94a3b8' }])}</div>`;
}

function rentCard(w) {
  const r = w.scans['monthly-rent'].split;
  return `<div class="tcard"><div class="tcard-head"><span class="rec-icon" style="width:28px;height:28px;border-radius:8px">${icon('repeat')}</span><span class="t"><b>Rent &amp; bills</b><span>Monthly on the 1st · parking is Jordan\u2019s</span></span></div>
    <div class="rows">
      <div class="row"><span class="n">Rent</span><span class="m">25 · 25 · 28 · 22%</span></div>
      <div class="row"><span class="n">Water, trash, internet</span><span class="m">4 ways</span></div>
    </div>
    <div class="versus"><div class="bank plain"><span class="lbl">Each month</span><span class="v money">${money(r.totalCents)}</span></div><div class="mine"><span class="lbl">Your share</span><span class="v money">${money(r.people.you.cents)}</span></div></div></div>`;
}

function towelsCard(w) {
  const t = w.items.find((i) => /towel/i.test(i.name));
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>${esc(t.name)}</b><span>${esc(t.bill)} · ${t.date} · receipt attached</span></span></div>
    <div class="versus"><div class="bank plain"><span class="lbl">Item total</span><span class="v money">${money(t.totalCents)}</span></div><div class="mine"><span class="lbl">Your share</span><span class="v money">${money(t.cents)}</span></div></div>
    <div class="legend"><span><i style="background:${catOf(t.category).color}"></i>${catOf(t.category).label}</span><span>Split ${t.n} ways</span></div></div>`;
}

function activityCard() {
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>Activity</b><span>Just now</span></span></div>
    <div class="rows"><div class="row"><span class="n"><b style="color:var(--ink)">Farmers market</b> · Personal</span><span class="a money">$12.50</span></div>
    <div class="row" style="padding-top:0"><span class="n m">Added by your AI app</span></div></div></div>`;
}

/** Items you typed about, found in the example October. */
function hitsCard(title, hits) {
  if (hits.length === 1) {
    const t = hits[0];
    return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>${esc(t.name)}</b><span>${esc(t.bill)} · ${t.date}</span></span></div>
    <div class="versus" style="margin-bottom:0"><div class="bank plain"><span class="lbl">Item total</span><span class="v money">${money(t.totalCents)}</span></div><div class="mine"><span class="lbl">Your share</span><span class="v money">${money(t.cents)}</span></div></div></div>`;
  }
  const shown = hits.slice(0, 4);
  const sum = hits.reduce((a, h) => a + h.cents, 0);
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>${esc(title)}</b><span>October · your share only</span></span></div>
    <div class="rows">${shown.map((h) => `<div class="row"><span class="n">${esc(h.name)} <span class="m">· ${esc(h.bill)}</span></span><span class="a money">${money(h.cents)}</span></div>`).join('')}
    ${hits.length > shown.length ? `<div class="row"><span class="n m">+ ${hits.length - shown.length} more</span></div>` : ''}
    <div class="row tot"><span class="n">${hits.length} items</span><span class="a money">${money(sum)}</span></div></div></div>`;
}

/* ---------- scripts ---------- */
export function scripts(w) {
  const gb = w.bills[0];
  return {
    split: [
      { t: 'user', thumb: 'assets/thumb-green-basket.webp', text: "Split this with Maya, Jordan and Sam. Avocados and cold brew are mine, oat milk and kale chips are Maya's." },
      { t: 'tool', run: 'Reading the receipt', done: 'Read 14 items, $100.00', ms: 1100,
        then: { run: 'Saving the split', done: 'Read 14 items and saved the split', ms: 800 } },
      { t: 'card', html: splitCard },
      { t: 'ai', text: `Saved. You paid ${money(gb.totalCents)} and spent ${money(gb.youCents)}. Maya, Jordan and Sam owe you ${money(gb.totalCents - gb.youCents)}.` },
    ],
    october: [
      { t: 'user', text: 'What did I actually spend in October?' },
      { t: 'tool', run: 'Totting up your share', done: `${w.bills.length} expenses, personal and shared`, ms: 1000 },
      { t: 'card', html: octoberCard },
      { t: 'ai', text: `${money(w.spentCents)}, counting only your share. Your bank shows ${money(w.paidCents)}: you fronted rent and groceries, and Alex paid for dinner.` },
    ],
    rent: [
      { t: 'user', text: 'Add our rent every month: by room, bills four ways, parking is Jordan’s.' },
      { t: 'tool', run: 'Setting up the schedule', done: 'Monthly on the 1st, 5 lines', ms: 1000 },
      { t: 'card', html: rentCard },
      { t: 'ai', text: 'Done. Each month it asks you first, so you can change the water bill when it moves.' },
    ],
    towels: [
      { t: 'user', text: 'What did the hand towels cost me?' },
      { t: 'tool', run: 'Searching your items', done: 'Found 1 item', ms: 900 },
      { t: 'card', html: towelsCard },
      { t: 'ai', text: '$8.00. They were $32.00 with tax, split four ways with Maya, Jordan and Sam.' },
    ],
    recon: [
      { t: 'user', attachLabel: 'october-statement.pdf', text: "Here's my October statement. Is it all in Trezzit?" },
      { t: 'tool', run: 'Listing what you paid', done: '3 payments in October, all matched', ms: 1000 },
      { t: 'ai', text: `All three are in Trezzit. You paid ${money(w.paidCents)} but spent ${money(w.spentCents)}: most of the rest is your roommates’ rent.` },
      { t: 'user', text: 'Add $12.50 at the farmers market too. Cash, just mine.', pause: 900 },
      { t: 'tool', run: 'Saving', done: 'Personal expense, $12.50', ms: 800 },
      { t: 'card', html: activityCard },
      { t: 'ai', text: 'Added. It’s in your Activity, marked as added by your AI app.' },
    ],
  };
}

/* ---------- typed questions ----------
   Never swap the visitor's words for a canned question. The bubble always shows
   exactly what they typed; the answer comes from the same example October. */
const STOP = new Set('the and for did does how much what whats was were are this that cost costs spend spent spending buy bought paid get got with about all any some have had from much many show tell find search item items total october month week year last also just mine our your you can please other personal expense expenses share shared money bill bills store stores thing things stuff where when who'.split(' '));

export function answer(q, w) {
  const s = q.toLowerCase();
  const say = (text, tool) => [{ t: 'user', text: q }, ...(tool ? [tool] : []), { t: 'ai', text }];
  if (/\b(send|transfer|venmo|zelle|paypal|wire)\b|\bpay\s+(back|him|her|them|maya|jordan|sam|alex|priya|my|a\s+friend)\b/.test(s)) {
    return say('Trezzit never moves money. When you pay someone back elsewhere, I can record it, so your balances stay right.');
  }
  if (/budget/.test(s)) return say('Trezzit doesn’t set budgets. It shows what you actually spent, item by item, alone or shared.');
  if (/\bbank\b.*\b(link|connect|sync|login)|\b(link|connect|sync)\b.*\bbank\b/.test(s)) return say('Trezzit never logs in to your bank. You add receipts and bills, or ask me to.');
  // Only clear intents play a scripted answer; questions about things are searched instead.
  const script = /\brent\b/.test(s) && /\b(add|every|monthly|recurr|repeat|schedule)/.test(s) ? 'rent'
    : /\bsplit\b|\breceipt\b|\broommates?\b/.test(s) ? 'split' : null;
  if (script) return scripts(w)[script].map((st, i) => (i === 0 ? { ...st, text: q } : st));

  const words = (s.match(/[a-z]+/g) || []).filter((x) => x.length >= 3 && !STOP.has(x));
  const stem = (x) => x.replace(/(ies|y|es|s)$/, '');
  // A category you named: answer with its exact October total.
  const cat = words.map(stem).filter((x) => x.length >= 4).map((x) => w.cats.find((c) => c.label.toLowerCase().startsWith(x))).find(Boolean);
  const tool = (n) => ({ t: 'tool', run: 'Searching your items', done: n ? `Found ${n} item${n === 1 ? '' : 's'}` : 'No matching items', ms: 800 });
  if (cat) {
    const hits = w.items.filter((it) => it.category === cat.id);
    return [{ t: 'user', text: q }, tool(hits.length), { t: 'card', html: () => hitsCard(cat.label, hits) },
      { t: 'ai', text: `${money(cat.cents)} on ${cat.label.toLowerCase()} in October, counting only your share.` }];
  }
  // Items or stores you named.
  const hits = w.items.filter((it) => words.some((x) => { const k = stem(x); return k.length >= 3 && (it.name.toLowerCase().includes(k) || it.bill.toLowerCase().includes(k)); }));
  if (hits.length) {
    const sum = hits.reduce((a, h) => a + h.cents, 0);
    const one = hits[0];
    const text = hits.length === 1
      ? (one.n > 1 ? `${money(one.cents)}: your share of ${money(one.totalCents)}, split ${one.n} ways.` : `${money(one.cents)}, all yours.`)
      : `${money(sum)} across ${hits.length} items, counting only your share.`;
    return [{ t: 'user', text: q }, tool(hits.length), { t: 'card', html: () => hitsCard(hits.length === 1 ? one.name : 'Matching items', hits) }, { t: 'ai', text }];
  }
  if (!words.length && /\b(october|this month|last month|spen[dt])\b/.test(s)) return scripts(w).october.map((st, i) => (i === 0 ? { ...st, text: q } : st));
  return say(`I couldn’t find that in this example October. Connected to your own Trezzit, I’d answer from your real items. Try avocados, groceries or a question below.`, tool(0));
}

/* ---------- player ----------
   Each chat opens on its finished conversation (static HTML), so there is never an
   empty frame. It only animates when someone taps Play, a chip, or asks. */
class Player {
  constructor(root, w, { script = 'split', ask } = {}) {
    this.root = root; this.w = w; this.s = scripts(w);
    this.log = $('[data-chat-log]', root);
    this.ctl = $('[data-chat-ctl]', root);
    this.chips = $$('[data-script]', root);
    this.clock = new Clock();
    this.state = 'static'; this.current = script;
    this.ctl.addEventListener('click', () => this.onCtl());
    this.chips.forEach((c) => c.addEventListener('click', () => this.run(c.dataset.script, this.s[c.dataset.script])));
    const form = $('[data-chat-form]', root);
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('input', form); const q = input.value.trim().slice(0, 140);
      if (!q) return;
      input.value = '';
      this.run(null, answer(q, w));
    });
    this.setCtl('play');
    // Pause when off screen: nothing moves unseen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (!e.isIntersecting && this.state === 'playing') this.pause(true);
        else if (e.isIntersecting && this.autoPaused) this.resume();
      }).observe(root);
    }
  }

  setCtl(kind) {
    const map = { pause: ['pause', 'Pause'], resume: ['play', 'Resume'], play: ['play', 'Play'], replay: ['replay', 'Replay'] };
    const [ic, label] = map[kind];
    this.ctl.innerHTML = `${icon(ic)}<span>${label}</span>`;
  }
  onCtl() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
    else this.run(this.current, this.s[this.current]);
  }
  pause(auto = false) { this.clock.pause(); this.state = 'paused'; this.autoPaused = auto; this.root.classList.add('is-paused'); this.setCtl('resume'); }
  resume() { this.clock.resume(); this.state = 'playing'; this.autoPaused = false; this.root.classList.remove('is-paused'); this.setCtl('pause'); }

  async run(id, steps) {
    if (id) this.current = id;
    this.chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.script === id)));
    this.clock.cancel();
    this.root.classList.remove('is-paused');
    if (!this.root.style.height) { this.root.style.height = this.root.offsetHeight + 'px'; this.root.classList.add('is-live'); }
    const token = this.clock.token;
    this.state = 'playing'; this.autoPaused = false; this.setCtl('pause');
    const instant = reducedMotion();
    this.log.innerHTML = ''; this.log.classList.remove('overflowing');
    try {
      for (const st of steps) {
        if (!instant && st.pause) await this.clock.wait(st.pause, token);
        await this.step(st, token, instant);
      }
      this.state = 'done'; this.setCtl('replay');
      announce(this.log.lastElementChild?.textContent || '');
    } catch (e) { if (e.message !== 'cancelled') throw e; }
  }

  add(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    const el = t.content.firstElementChild;
    this.log.appendChild(el);
    // A replay fills from the top like a new chat; once it overflows, the newest line stays in view.
    this.log.classList.toggle('overflowing', this.log.scrollHeight > this.log.clientHeight + 1);
    return el;
  }

  async step(st, token, instant) {
    const wait = (ms) => (instant ? Promise.resolve() : this.clock.wait(ms, token));
    if (st.t === 'user') {
      const att = st.attachLabel
        ? `<div class="attach">${st.attach ? `<img src="${st.attach}" alt="" width="38" height="56">` : ''}<span>${esc(st.attachLabel)}</span></div>` : '';
      this.add(st.thumb
        ? `<div class="msg user has-thumb"><img class="thumb" src="${st.thumb}" alt="Receipt photo" width="40" height="58"><span>${esc(st.text)}</span></div>`
        : `<div class="msg user">${att}${esc(st.text)}</div>`);
      await wait(650);
    } else if (st.t === 'tool') {
      const el = this.add(`<div class="tool"><span class="st spin" aria-hidden="true"></span><b>Trezzit</b><span class="res">${esc(st.run)}…</span></div>`);
      await wait(st.ms);
      el.querySelector('.st').outerHTML = okIcon;
      el.querySelector('.res').textContent = st.done;
      await wait(260);
      if (st.then) {
        await wait(240);
        el.querySelector('.st').outerHTML = '<span class="st spin" aria-hidden="true"></span>';
        el.querySelector('.res').textContent = st.then.run + '…';
        await wait(st.then.ms);
        el.querySelector('.st').outerHTML = okIcon;
        el.querySelector('.res').textContent = st.then.done;
        await wait(260);
      }
    } else if (st.t === 'card') {
      this.add(st.html(this.w));
      await wait(700);
    } else if (st.t === 'ai') {
      if (!instant) {
        const typing = this.add('<div class="typing" aria-hidden="true"><i></i><i></i><i></i></div>');
        await wait(650);
        typing.remove();
      }
      this.add(`<div class="msg ai">${esc(st.text)}</div>`);
      await wait(200);
    }
  }
}

export async function initChats() {
  const w = await getWorld();
  const players = [];
  const hero = document.getElementById('hero-chat');
  const ai = document.getElementById('ai-chat');
  if (hero) players.push(new Player(hero, w, { script: 'split' }));
  if (ai) players.push(new Player(ai, w, { script: 'recon' }));
  return players;
}
