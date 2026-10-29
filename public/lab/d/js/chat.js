// Scripted AI conversations: a user message, Trezzit tool calls, a Trezzit card, the answer.
import { $, $$, esc, money, icon, tmark, reducedMotion, Clock, announce, tweenMoney, onVisible } from './ui.js';
import { getWorld, catOf, PEOPLE, tone, OTHER_TONE } from './world.js';

const okIcon = `<span class="st ok">${icon('check')}</span>`;
// Nothing found is not a success: a neutral dot, not a green check.
const noneIcon = '<span class="st none" aria-hidden="true"></span>';
const gbOf = (w) => w.bills.find((b) => b.id === 'green-basket');

function legend(list) {
  const entries = list.map((c, i) => ({ ...c, color: c.other ? OTHER_TONE : tone(i) }));
  return `<div class="catbar" aria-hidden="true">${entries.map((c) => `<i style="flex-grow:${c.cents};background:${c.color}"></i>`).join('')}</div>
  <div class="legend">${entries.map((c) => `<span><i style="background:${c.color}"></i>${esc(c.label)} <b class="money">${money(c.cents)}</b></span>`).join('')}</div>`;
}

/* ---------- the cards ---------- */
/** Who shared the receipt, as the split's own avatars. */
const faces = (ids) => `<span class="faces" aria-hidden="true">${ids.map((k) => `<i style="--c:${PEOPLE[k].color}">${k === 'you' ? 'You' : PEOPLE[k].initials}</i>`).join('')}</span>`;

function splitCard(w) {
  const b = gbOf(w);
  const you = b.split.people.you;
  const cats = Object.entries(you.byCategory).map(([id, cents]) => ({ cents, ...catOf(id) })).sort((a, b) => b.cents - a.cents);
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>Green Basket Market</b><span>Oct 24 · Flat 3B · you paid</span></span>${faces(Object.keys(b.split.people))}</div>
    <div class="versus"><div class="bank"><span class="lbl">Your bank</span><span class="v money">${money(-b.totalCents)}</span></div><div class="mine"><span class="lbl">You spent</span><span class="v money">${money(you.cents)}</span></div></div>
    ${legend(cats)}</div>`;
}

function octoberCard(w) {
  const top = w.cats.slice(0, 3);
  const rest = w.cats.slice(3).reduce((a, c) => a + c.cents, 0);
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>October</b><span>${w.bills.length} expenses · your share only</span></span></div>
    <div class="versus"><div class="bank plain"><span class="lbl">You paid</span><span class="v money">${money(w.paidCents)}</span></div><div class="mine"><span class="lbl">You spent</span><span class="v money">${money(w.spentCents)}</span></div></div>
    ${legend([...top, { cents: rest, label: 'Other', other: true }])}</div>`;
}

function rentCard(w) {
  const r = w.scans['monthly-rent'].split;
  return `<div class="tcard"><div class="tcard-head"><span class="rec-icon" style="width:28px;height:28px;border-radius:8px">${icon('repeat')}</span><span class="t"><b>Rent &amp; bills</b><span>Monthly on the 1st</span></span></div>
    <div class="versus" style="margin-bottom:0"><div class="bank plain"><span class="lbl">Each month</span><span class="v money">${money(r.totalCents)}</span></div><div class="mine"><span class="lbl">Your share</span><span class="v money">${money(r.people.you.cents)}</span></div></div></div>`;
}

function towelsCard(w) {
  const t = w.items.find((i) => /towel/i.test(i.name));
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>${esc(t.name)}</b><span>${esc(t.bill)} · ${t.date} · receipt attached</span></span></div>
    <div class="versus"><div class="bank plain"><span class="lbl">Item total</span><span class="v money">${money(t.totalCents)}</span></div><div class="mine"><span class="lbl">Your share</span><span class="v money">${money(t.cents)}</span></div></div>
    <div class="legend"><span><i style="background:${tone(0)}"></i>${catOf(t.category).label}</span><span>Split ${t.n} ways</span></div></div>`;
}

const dinnerOf = (w) => w.bills.find((x) => x.id === 'taqueria-sol');
/** "4 items + tip", the same count the typed answers use. */
const dinnerCount = (w) => countOf(dinnerOf(w).split.items.map((it) => ({ name: it.itemType === 'Tip' ? 'Tip' : it.name })));
function dinnerCard(w) {
  const b = dinnerOf(w);
  const you = b.split.people.you;
  const cats = Object.entries(you.byCategory).map(([id, cents]) => ({ cents, ...catOf(id) })).sort((a, b) => b.cents - a.cents);
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>Taqueria Sol</b><span>${b.date} · ${esc(b.group)} · ${esc(PEOPLE[b.payer].name)} paid ${money(b.totalCents)}</span></span></div>
    <div class="versus"><div class="bank"><span class="lbl">Your bank</span><span class="v money">${money(0)}</span></div><div class="mine"><span class="lbl">You spent</span><span class="v money">${money(you.cents)}</span></div></div>
    ${legend(cats)}</div>`;
}

function activityCard(label, cents) {
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>Activity</b><span>Just now</span></span></div>
    <div class="rows"><div class="row"><span class="n"><b style="color:var(--ink)">${esc(label)}</b> · Personal</span><span class="a money">${money(cents)}</span></div>
    <div class="row" style="padding-top:0"><span class="n m">Added by your AI app</span></div></div></div>`;
}

/** Where a balance comes from, when it nets more than one bill: "Green Basket $30.00 − Netflix $4.50". */
function partsOf(w, k) {
  const parts = [];
  w.bills.filter((b) => !b.settled).forEach((b) => {
    if (b.payer === 'you' && b.split.people[k]?.cents) parts.push({ t: b.title.split(' ').slice(0, 2).join(' '), c: b.split.people[k].cents });
    else if (b.payer === k && b.split.people.you?.cents) parts.push({ t: b.title.split(' ').slice(0, 2).join(' '), c: -b.split.people.you.cents });
  });
  return parts.length < 2 ? '' : parts.map((x, i) => `${i ? (x.c < 0 ? ' − ' : ' + ') : ''}${esc(x.t)} ${money(Math.abs(x.c))}`).join('');
}

function balanceCard(w, names) {
  const ids = Object.keys(w.net).filter((k) => w.net[k]);
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>Balances</b><span>October · rent settled</span></span></div>
    <div class="rows">${ids.map((k) => {
      const c = w.net[k]; const hi = names.includes(k); const why = partsOf(w, k);
      return `<div class="row"><span class="n">${hi ? `<b style="color:var(--ink)">${esc(PEOPLE[k].name)}</b>` : esc(PEOPLE[k].name)} <span class="m">· ${c > 0 ? 'owes you' : 'you owe'}</span>${why ? `<small class="why">${why}</small>` : ''}</span><span class="a money">${money(Math.abs(c))}</span></div>`;
    }).join('')}</div></div>`;
}

/** "4 items + tip": receipt lines only; the tip is named, never counted as an item. */
const countOf = (hits) => {
  const n = hits.filter((h) => h.name !== 'Tip').length;
  return `${n} item${n === 1 ? '' : 's'}${n < hits.length ? ' + tip' : ''}`;
};

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
    <div class="row tot"><span class="n">${countOf(hits)}</span><span class="a money">${money(sum)}</span></div></div></div>`;
}

const who = (ids) => {
  const n = ids.map((k) => (k === 'you' ? 'you' : PEOPLE[k].name));
  return n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
};

/* ---------- scripts ---------- */
export function scripts(w) {
  const gb = gbOf(w);
  const owed = money(gb.totalCents - gb.youCents);
  return {
    // The page opens on this one (static HTML in index.html): a read question that always works.
    spent: [
      { t: 'user', text: 'What did I spend at Green Basket?' },
      { t: 'tool', run: 'Looking it up', done: '14 items, split 4 ways', ms: 900 },
      { t: 'card', html: splitCard },
      { t: 'ai', text: `Maya, Jordan and Sam owe you ${owed}.` },
    ],
    // The chip: a different receipt from the opening card (a dinner a friend paid), so no total is contradicted.
    split: [
      { t: 'user', thumb: 'assets/thumb-taqueria.webp', text: 'Split my dinner with Alex and Priya. Alex paid.' },
      { t: 'tool', run: 'Reading the receipt', done: `Read ${dinnerCount(w)}, ${money(dinnerOf(w).totalCents)} · saved`, ms: 700 },
      { t: 'card', html: dinnerCard },
      { t: 'ai', text: `Saved. You owe Alex ${money(dinnerOf(w).youCents)}.` },
    ],
    // A typed "split my receipt": the receipt's own split (the opening card).
    splitTyped: [
      { t: 'user', thumb: 'assets/thumb-green-basket.webp', text: '' },
      { t: 'tool', run: 'Reading the receipt', done: 'Read 14 items, $100.00 · saved', ms: 700 },
      { t: 'card', html: splitCard },
      { t: 'ai', text: `Saved. Maya, Jordan and Sam owe you ${owed}.` },
    ],
    dinner: [
      { t: 'user', thumb: 'assets/thumb-taqueria.webp', text: 'Split my dinner receipt. Alex paid.' },
      { t: 'tool', run: 'Reading the receipt', done: `Read ${dinnerCount(w)}, ${money(dinnerOf(w).totalCents)} · saved`, ms: 700 },
      { t: 'card', html: dinnerCard },
      { t: 'ai', text: `Saved. You owe Alex ${money(w.bills.find((x) => x.id === 'taqueria-sol').youCents)}.` },
    ],
    october: [
      { t: 'user', text: 'What did I spend in October?' },
      { t: 'tool', run: 'Totting up your share', done: `${w.bills.length} expenses, personal and shared`, ms: 600 },
      { t: 'card', html: octoberCard },
      { t: 'ai', text: `${money(w.spentCents)}, counting only your share.` },
    ],
    rent: [
      { t: 'user', text: 'Add our rent every month, split by room.' },
      { t: 'tool', run: 'Setting up the schedule', done: 'Monthly on the 1st', ms: 700 },
      { t: 'card', html: rentCard },
      { t: 'ai', text: 'Done. It asks you each month first.' },
    ],
    towels: [
      { t: 'user', text: 'What did the hand towels cost me?' },
      { t: 'tool', run: 'Searching your items', done: 'Found 1 item', ms: 500 },
      { t: 'card', html: towelsCard },
      { t: 'ai', text: '$8.00, split four ways with Maya, Jordan and Sam.' },
    ],
  };
}

/* ---------- typed questions ----------
   Never swap the visitor's words for a canned question. The bubble always shows
   exactly what they typed; the answer comes from the same example October.
   Words match whole words only ("owe" never matches "towels"), and every line on
   every receipt is searched, including ones that are someone else's. */
const NAMES = ['maya', 'jordan', 'sam', 'alex', 'priya'];
const STOP = new Set(('why help work works know tell the and for did does how much what whats was were are this that cost costs spend spent spending buy bought pay paid get got with about all any some have had from many show tell find search item items total everything overall altogether october month week year last also just mine our your you can please other personal expense expenses share shared money bill bills store stores thing things stuff where when who my me its it is of on in at to a an do i ' + NAMES.join(' ')).split(' '));
const stem = (x) => x.replace(/(ies|es|s)$/, '');
const wordRe = (k) => new RegExp(`\\b${k.replace(/[^a-z]/g, '')}`, 'i');
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// Everyday words for the "Dining out" category.
const DINING = /\b(eating|food|going)\s+out\b|\brestaurants?\b|\btake-?out\b|\bdinners?\b|\blunch(es)?\b/g;
// "add $12 coffee", "log 8.50 for lunch": an amount and something to call it.
const ADD = /\b(add|record|log)\b/;
// The amount is taken whole: "$12.345" is never quietly cut to $12.34.
const DOLLARS = /\$\s*(\d{1,5}(?:\.\d+)?)(?![\d.])/;
const NUMBER = /(?<![\d.])(\d{1,5}(?:\.\d+)?)(?![\d.])/;
// Everyday words for lines on the example receipts.
const SYN = { coffee: 'brew', latte: 'brew', snack: 'chips', medicine: 'health', med: 'health' };
const SYNONYMS = /\b(coffees?|lattes?|snacks?|medicine|meds)\b/g;
const FILLER = /\b(add|record|log|a|an|the|for|at|on|to|my|of|expense|cash|card|just|mine|personal|please|dollars?|bucks|usd|spent|bought|paid)\b/g;

export function answer(q, w) {
  const s = q.toLowerCase();
  const say = (text, tool, card) => [{ t: 'user', text: q }, ...(tool ? [tool] : []), ...(card ? [{ t: 'card', html: card }] : []), { t: 'ai', text }];
  const named = NAMES.filter((n) => new RegExp(`\\b${n}\\b`).test(s));
  if (/^\s*(hi|hello|hey|yo|hiya|thanks|thank you|ok|okay|cool|test)\b[\s!.?]*$/.test(s)) return say('Ask me about anything you spent, like avocados or dining out.');
  // Trust and setup come first: they are what a new visitor asks, and none of them is an item search.
  if (/\b(connect|set ?up|install|add|use)\b.*\b(claude|chatgpt|ai)\b|\bhow do i (use|get|start|connect|set)\b/.test(s) && !DOLLARS.test(s)) {
    return [{ t: 'user', text: q }, { t: 'ai', text: 'Copy one URL into Claude or ChatGPT. Takes a minute.', link: ['connect/', 'Connect'] }];
  }
  if (/\bmov(e|es|ing)\b.*\bmoney\b|\bmakes? payments?\b/.test(s)) return say('Never. Trezzit records expenses and settle-ups; it can’t move money.');
  if (/\bwhat can (you|it|trezzit) (see|access|read)\b|\b(see|access|read)\b.*\b(my|data)\b|\bprivate\b|\bprivacy\b|\bsafe\b|\bsecure\b/.test(s) && !/\b(receipt|spen[dt]|owe|bank)\b/.test(s)) {
    return say('Your Trezzit expenses, groups and balances. Not your bank, not other members’ emails, and Trezzit never sees this chat.');
  }
  if (/\b(send|transfer|venmo|zelle|paypal|wire)\b|\bpay\s+(back|him|her|them|maya|jordan|sam|alex|priya|my|a\s+friend)\b/.test(s)) {
    return say('Trezzit never moves money. When you pay someone back elsewhere, I can record it, so your balances stay right.');
  }
  if (/budget/.test(s)) return say('Trezzit doesn’t set budgets. It shows what you actually spent, item by item, alone or shared.');
  if (/\bbank\b.*\b(link|connect|sync|login)|\b(link|connect|sync)\b.*\bbank\b/.test(s)) return say('Trezzit never logs in to your bank. You add receipts and bills, or ask me to.');
  if (/\bbank\b/.test(s) && /\b(balance|account|statement|money)\b/.test(s)) return say('Trezzit doesn’t see your bank. It knows what you’ve recorded. Ask who owes you, or what you spent in October.');
  if (/\b(delete|remove|undo|erase)\b/.test(s)) return say('I can only delete a bill I added in the last 30 minutes. Everything else, delete in the app.');

  // Who owes whom, or what a friend paid: answered from the balances, never from item names.
  if (/\b(owe|owes|owed|owing|balance|balances|settle|even)\b/.test(s) || (named.length && /\b(pay|paid|pays)\b/.test(s))) {
    const tool = { t: 'tool', run: 'Checking balances', done: 'Balances across your groups', ms: 500 };
    // Say the direction the way it was asked: "do I owe Maya?" gets "You don't owe Maya." first.
    const asksIOwe = /\b(i|do i|did i|should i|we)\s+owe\b|\bowe\s+(maya|jordan|sam|alex|priya)\b/.test(s);
    const asksOweMe = /\bowes?\s+(me|us)\b/.test(s);
    const line = (k) => {
      const c = w.net[k] || 0; const n = PEOPLE[k].name;
      if (!c) return `You and ${n} are even.`;
      if (c > 0) return `${asksIOwe ? `You don’t owe ${n}. ` : ''}${n} owes you ${money(c)}.`;
      return `${asksOweMe ? `${n} doesn’t owe you. ` : ''}You owe ${n} ${money(-c)}.`;
    };
    const rentNote = /\brent\b/.test(s) ? 'Rent is settled. ' : '';
    const paidBy = (k) => {
      const bs = w.bills.filter((b) => b.payer === k);
      return bs.length ? `${PEOPLE[k].name} paid for ${bs.map((b) => `${b.title} (${money(b.totalCents)})`).join(' and ')}.` : `${PEOPLE[k].name} didn’t pay any of your October bills.`;
    };
    const asksPaid = /\b(pay|paid|pays)\b/.test(s) && !/\b(owe|owes|owed|owing|balance|balances|settle|even)\b/.test(s);
    const text = rentNote + (named.length ? named.map((k) => (asksPaid ? `${paidBy(k)} ${line(k)}` : line(k))).join(' ')
      : (() => {
        const in_ = Object.keys(w.net).filter((k) => w.net[k] > 0);
        const out = Object.keys(w.net).filter((k) => w.net[k] < 0);
        return [in_.length ? `Across October, ${who(in_)} owe${in_.length === 1 ? 's' : ''} you ${money(in_.reduce((a, k) => a + w.net[k], 0))}.` : '',
          out.map((k) => `You owe ${PEOPLE[k].name} ${money(-w.net[k])}.`).join(' ')].filter(Boolean).join(' ');
      })());
    return say(text, tool, () => balanceCard(w, named));
  }

  // Only clear intents play a scripted answer; questions about things are searched instead.
  const reuse = (id) => scripts(w)[id].map((st, i) => (i === 0 ? { ...st, text: q, thumb: id === 'splitTyped' || id === 'dinner' ? st.thumb : undefined } : st));
  if (/\b(categor|breakdown|break\s+down|summar|overview)/.test(s)) return reuse('october');
  if (/\brent\b/.test(s) && /\b(add|every|monthly|recurr|repeat|schedule)/.test(s)) return reuse('rent');
  if (/\bsplit\b|\breceipt\b|\broommates?\b/.test(s)) {
    return reuse(/\b(dinner|tacos?|taqueria|restaurant|alex|priya)\b/.test(s) ? 'dinner' : 'splitTyped');
  }
  // Adding is the point of an assistant: "add $12 coffee" records a personal expense.
  const amt = ADD.test(s) && (s.match(DOLLARS) || s.match(NUMBER));
  if (amt && /\.\d{3,}/.test(amt[1])) return say('Amounts go to the cent. Try “add $12.35 coffee”.');
  if (amt) {
    const cents = Math.round(parseFloat(amt[1]) * 100);
    const label = cap(s.replace(amt[0], ' ').replace(FILLER, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()) || 'Expense';
    if (cents > 0) {
      return say(`Added. Personal expense, ${money(cents)}.`, { t: 'tool', run: 'Saving', done: `Personal expense, ${money(cents)}`, ms: 500 }, () => activityCard(label.slice(0, 32), cents));
    }
  }
  if (ADD.test(s)) return say('How much was it? Try “add $12 coffee”.');

  const words = (s.replace(DINING, ' dining ').replace(SYNONYMS, (m) => SYN[m.replace(/s$/, '')] || m).match(/[a-z]+/g) || []).filter((x) => x.length >= 3 && !STOP.has(x));
  const tool = (hits) => ({ t: 'tool', run: 'Searching your items', done: hits.length ? `Found ${countOf(hits)}` : 'No matching items', none: !hits.length, ms: 500 });
  // A category you named: answer with its exact October total.
  const cat = words.map(stem).filter((x) => x.length >= 4).map((x) => w.cats.find((c) => c.label.toLowerCase().split(/\s+/).some((p) => p.startsWith(x)))).find(Boolean);
  if (cat) {
    const hits = w.items.filter((it) => it.category === cat.id);
    return [{ t: 'user', text: q }, tool(hits), { t: 'card', html: () => hitsCard(cat.label, hits) },
      { t: 'ai', text: `${money(cat.cents)} on ${cat.label.toLowerCase()} in October, counting only your share.` }];
  }
  // Items or stores you named, on any receipt. Lines that match more of your words win ("oat milk" beats "whole milk").
  const scored = w.lines.map((it) => {
    const m = words.map(stem).filter((k) => k.length >= 3);
    return { it, byName: m.filter((k) => wordRe(k).test(it.name)).length, byStore: m.filter((k) => wordRe(k).test(it.bill)).length };
  }).map((x) => ({ ...x, n: Math.max(x.byName, x.byStore) }));
  const top = Math.max(0, ...scored.map((x) => x.n));
  let best = top ? scored.filter((x) => x.n === top) : [];
  // A store you named lists your lines on that receipt; an item you named shows even when it wasn't yours.
  if (best.length && best.every((x) => x.byName < top)) best = best.filter((x) => x.it.cents > 0);
  const hits = best.map((x) => x.it);
  if (hits.length) {
    const sum = hits.reduce((a, h) => a + h.cents, 0);
    const one = hits[0];
    const others = one.owners.filter((k) => k !== 'you');
    const plain = one.name.replace(/\s*\(\d+\)$/, '').toLowerCase();
    const text = hits.length === 1
      ? (!one.cents ? `Nothing. ${cap(who(one.owners))} had the ${plain}.`
        : one.n > 1 ? `${money(one.cents)}: your share of ${money(one.totalCents)}, split with ${who(others)}.` : `${money(one.cents)}, all yours.`)
      : `${money(sum)} across ${countOf(hits)}, counting only your share.`;
    return [{ t: 'user', text: q }, tool(hits), { t: 'card', html: () => hitsCard(hits.length === 1 ? one.name : (best[0].byName ? 'Matching items' : one.bill), hits) }, { t: 'ai', text }];
  }
  if (!words.length && /\b(october|this month|last month|spen[dt]|total|everything|overall|altogether|pa(y|id))\b/.test(s)) return reuse('october');
  // Nothing to look for: say what works instead of running an empty search.
  if (!words.length) return say('Ask me what you spent, who owes you, or to add something.');
  return say('Not in this example. Try avocados or dining out.', tool([]));
}

/* ---------- player ----------
   Each chat opens on its finished conversation (static HTML), so there is never an
   empty frame, and nothing moves until someone taps a chip, asks, or presses Replay.
   An answer that is cut short (a new tap, or the chat leaving the screen) is shown
   finished at once: no question is ever left without its answer, no spinner survives. */
const userHtml = (st) => {
  const att = st.attachLabel
    ? `<div class="attach">${st.attach ? `<img src="${st.attach}" alt="" width="38" height="56">` : ''}<span>${esc(st.attachLabel)}</span></div>` : '';
  return st.thumb
    ? `<div class="msg user has-thumb"><img class="thumb" src="${st.thumb}" alt="Receipt photo" width="40" height="58"><span>${esc(st.text)}</span></div>`
    : `<div class="msg user">${att}${esc(st.text)}</div>`;
};
const aiHtml = (st) => `<div class="msg ai">${esc(st.text)}${st.link ? ` <a class="link-arrow" href="${st.link[0]}">${esc(st.link[1])} ${icon('arrow')}</a>` : ''}</div>`;
const toolHtml = (text, done, none = false) => `<div class="tool">${done ? (none ? noneIcon : okIcon) : '<span class="st spin" aria-hidden="true"></span>'}<b>Trezzit</b><span class="res">${esc(text)}</span></div>`;

class Player {
  constructor(root, w, { script = 'split' } = {}) {
    this.root = root; this.w = w; this.s = scripts(w);
    this.log = $('[data-chat-log]', root);
    this.ctl = $('[data-chat-ctl]', root);
    this.chipBox = $('[data-chat-chips]', root);
    // A chip that has played makes way for the next question, so nothing on offer has already been answered.
    this.pool = ['Who owes me?', 'What did towels cost me?'];
    this.clock = new Clock();
    // A fixed-height chat (the hero) scrolls inside itself, so nothing outside it ever moves.
    this.fixed = root.classList.contains('is-fixed');
    this.state = 'static'; this.current = script;
    this.pending = null; this.first = null;
    this.anchor = this.fixed ? [...this.log.querySelectorAll('.msg.user')].pop() : null;
    this.ctl?.addEventListener('click', () => this.onCtl());
    this.chipBox?.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) this.useChip(c); });
    const form = $('[data-chat-form]', root);
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('input', form); const q = input.value.trim().slice(0, 140);
      if (!q) return;
      input.value = '';
      this.run(null, answer(q, w));
    });
    this.setCtl('replay');
    // The top fade only appears once something has scrolled under it, so a first line is never dimmed.
    if (this.fixed) {
      const mark = () => this.log.classList.toggle('is-scrolled', this.log.scrollTop > 2);
      this.log.addEventListener('scroll', mark, { passive: true }); mark();
    }
    this.follow(true);
    // Nothing plays unseen: leaving the screen mid-answer shows the finished answer.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { if (!e.isIntersecting && this.state === 'playing') this.complete(); }).observe(root);
    }
  }

  useChip(c) {
    const steps = c.dataset.script ? this.s[c.dataset.script] : answer(c.dataset.ask, this.w);
    const id = c.dataset.script || null;
    const had = document.activeElement === c;
    const next = this.pool.shift();
    if (next) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.ask = next; b.textContent = next;
      c.replaceWith(b);
      if (had) b.focus({ preventScroll: true });
    } else {
      c.remove();
      if (!this.chipBox.querySelector('.chip')) this.chipBox.hidden = true;
    }
    this.run(id, steps);
  }

  setCtl(kind) {
    if (!this.ctl) return;
    const map = { skip: ['skip', 'Skip'], replay: ['replay', 'Replay'] };
    const [ic, label] = map[kind];
    this.ctl.innerHTML = `${icon(ic)}<span>${label}</span>`;
  }
  onCtl() {
    if (this.state === 'playing') this.complete();
    else this.run(this.current, this.s[this.current]);
  }

  /** Stop now and show the exchange as it ends. */
  complete() {
    if (this.state !== 'playing') return;
    this.clock.cancel();
    this.settle();
    this.state = 'done'; this.setCtl('replay');
    this.follow(true);
  }

  /** Swap a half-played exchange for its finished form. */
  settle() {
    if (!this.pending) return;
    if (this.fixed) {
      if (this.first?.parentNode === this.log) {
        while (this.first.nextSibling) this.first.nextSibling.remove();
        this.first.remove();
      }
      this.insertFinished(this.pending);
    } else {
      this.log.innerHTML = this.finished(this.pending);
    }
    this.log.style.minHeight = '';
    this.pending = null; this.first = null;
  }

  insertFinished(steps) {
    const n = this.log.children.length;
    this.log.insertAdjacentHTML('beforeend', this.finished(steps));
    [...this.log.children].slice(n).forEach((el) => { el.style.animation = 'none'; });
    if (this.fixed) this.anchor = this.log.children[n];
  }

  /** The exchange as it looks when finished (used to reserve its height). */
  finished(steps) {
    return steps.map((st) => {
      if (st.t === 'user') return userHtml(st);
      if (st.t === 'tool') return toolHtml(st.then ? st.then.done : st.done, true, st.none);
      if (st.t === 'card') return st.html(this.w);
      return aiHtml(st);
    }).join('');
  }

  async run(id, steps) {
    // A new question while one is still answering: finish that one first.
    if (this.state === 'playing') { this.clock.cancel(); this.settle(); }
    if (id) this.current = id;
    this.clock.cancel();
    const token = this.clock.token;
    this.state = 'playing'; this.setCtl('skip');
    this.pending = steps; this.first = null;
    const instant = reducedMotion();
    if (this.fixed) {
      // Like a real chat: the new exchange goes under the last one, which scrolls up out of the way.
      // Keep only the previous exchange above the new one.
      const prev = [...this.log.querySelectorAll('.msg.user')].pop();
      while (prev && this.log.firstElementChild !== prev) this.log.firstElementChild.remove();
      this.log.querySelectorAll('.msg, .tool, .tcard').forEach((el) => { el.style.animation = 'none'; });
      if (instant) this.insertFinished(steps);
    } else {
      this.log.style.minHeight = '';
      this.log.innerHTML = this.finished(steps);
      this.log.style.minHeight = this.log.offsetHeight + 'px';
      if (!instant) this.log.innerHTML = '';
    }
    // Keep the question in view: if the top of the chat sits under the header, bring it back.
    const top = this.log.getBoundingClientRect().top;
    if (top < 72) this.root.scrollIntoView({ block: 'start', behavior: instant ? 'auto' : 'smooth' });
    try {
      if (!instant) {
        for (const st of steps) {
          if (st.pause) await this.clock.wait(st.pause, token);
          await this.step(st, token);
        }
      }
      this.state = 'done'; this.setCtl('replay');
      this.pending = null; this.first = null; this.log.style.minHeight = '';
      this.follow();
      announce(this.log.lastElementChild?.textContent || '');
    } catch (e) { if (e.message !== 'cancelled') throw e; }
  }

  add(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    const el = t.content.firstElementChild;
    this.log.appendChild(el);
    // The first line of an exchange is its question: the chat never scrolls it out of view.
    if (!this.first) { this.first = el; if (this.fixed) this.anchor = el; }
    this.follow();
    return el;
  }

  /** Fixed chats follow the newest line. The question stays in view while there is room,
      but the newest line always wins: an answer is never left below the fold of the chat. */
  follow(now = false) {
    if (!this.fixed) return;
    requestAnimationFrame(() => {
      const log = this.log;
      let top = log.scrollHeight - log.clientHeight;
      if (this.anchor?.parentNode === log) top = Math.min(top, this.anchor.offsetTop - 18);
      const last = log.lastElementChild;
      if (last) top = Math.max(top, last.offsetTop + last.offsetHeight + 12 - log.clientHeight);
      log.scrollTo({ top: Math.max(0, top), behavior: now || reducedMotion() ? 'auto' : 'smooth' });
    });
  }

  async step(st, token) {
    const wait = (ms) => this.clock.wait(ms, token);
    if (st.t === 'user') {
      this.add(userHtml(st));
      await wait(420);
    } else if (st.t === 'tool') {
      const el = this.add(toolHtml(st.run + '…', false));
      await wait(st.ms);
      el.querySelector('.st').outerHTML = st.none && !st.then ? noneIcon : okIcon;
      el.querySelector('.res').textContent = st.done;
      this.follow();
      await wait(200);
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
      await wait(480);
    } else if (st.t === 'ai') {
      const typing = this.add('<div class="typing" aria-hidden="true"><i></i><i></i><i></i></div>');
      await wait(450);
      typing.remove();
      this.add(aiHtml(st));
      await wait(200);
    }
  }
}

/* ---------- the hero's first second ----------
   The page opens on the finished exchange (static HTML, so nothing is ever empty without
   script). On a first visit with motion allowed, it plays once, in about 2.5 s: the question
   types itself into the composer, the Trezzit lookup runs, your bank's −$100.00 shows, then
   what you spent counts up to $30.00. A blinking caret then says: your turn.
   Any tap, focus or scroll away finishes it at once. */
Player.prototype.intro = async function intro() {
  const form = $('[data-chat-form]', this.root);
  const input = $('input', form);
  const ghost = $('[data-ghost]', form);
  const steps = this.s.spent;
  const q = steps[0].text;
  this.clock.cancel();
  const token = this.clock.token;
  const wait = (ms) => this.clock.wait(ms, token);
  this.state = 'playing'; this.pending = steps; this.first = null;
  this.log.innerHTML = '';
  this.root.classList.remove('intro-pending');
  const stopGhost = () => { form.classList.remove('is-typing'); ghost.textContent = ''; };
  const invite = () => form.classList.add('invite');
  input.addEventListener('focus', () => { form.classList.remove('invite'); if (this.state === 'playing') this.complete(); stopGhost(); }, { once: true });
  this.chipBox?.addEventListener('click', () => { stopGhost(); form.classList.remove('invite'); }, { once: true });
  try {
    form.classList.add('is-typing');
    for (let i = 1; i <= q.length; i += 1) { ghost.textContent = q.slice(0, i); await wait(30); }
    await wait(140);
    stopGhost();
    this.add(userHtml(steps[0]));
    await wait(220);
    const tool = this.add(toolHtml(steps[1].run + '…', false));
    await wait(360);
    tool.querySelector('.st').outerHTML = okIcon;
    tool.querySelector('.res').textContent = steps[1].done;
    await wait(120);
    const card = this.add(steps[2].html(this.w));
    const mine = $('.mine .v', card);
    const to = gbOf(this.w).youCents;
    mine.textContent = money(0);
    await wait(200);
    tweenMoney(mine, to, { from: 0, dur: 600 });
    await wait(650);
    this.add(`<div class="msg ai">${esc(steps[3].text)}</div>`);
    this.state = 'done'; this.pending = null; this.first = null;
    this.follow();
    invite();
  } catch (e) {
    if (e.message !== 'cancelled') throw e;
    stopGhost();
  }
};

/* ---------- the AI section: one exchange, no second chat window ----------
   The exchange is on the page from the start, so the navy never shows an empty column
   (on a phone it scrolls past at reading speed). Only its result, the Activity card,
   arrives: once, when 40% of it is in view. */
function initThread() {
  const t = document.querySelector('[data-thread]');
  const card = t?.querySelector('.tcard');
  if (!card || reducedMotion()) return;
  card.classList.add('is-waiting');
  onVisible(card, () => card.classList.replace('is-waiting', 'is-in'), 0.4);
}

export async function initChats() {
  const w = await getWorld();
  const hero = document.getElementById('hero-chat');
  initThread();
  if (!hero) return [];
  const p = new Player(hero, w, { script: 'spent' });
  const r = hero.getBoundingClientRect();
  const fresh = scrollY < 120 && r.top < innerHeight && r.bottom > 0 && document.visibilityState === 'visible';
  if (!reducedMotion() && fresh && !(document.activeElement && hero.contains(document.activeElement))) p.intro();
  else hero.classList.remove('intro-pending');
  return [p];
}
