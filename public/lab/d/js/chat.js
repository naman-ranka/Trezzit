// Scripted AI conversations: a user message, Trezzit tool calls, a Trezzit card, the answer.
import { $, esc, money, icon, tmark, reducedMotion, Clock, announce, onVisible } from './ui.js';
import { getWorld, withSplit, catOf, summaryCats, PEOPLE, tone, OTHER_TONE } from './world.js';

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
const faces = (ids) => `<span class="faces" aria-hidden="true">${ids.map((k) => `<i style="--c:${PEOPLE[k].color}">${k === 'you' ? 'Y' : PEOPLE[k].initials}</i>`).join('')}</span>`;

function splitCard(w) {
  const b = gbOf(w);
  const you = b.split.people.you;
  const cats = Object.entries(you.byCategory).map(([id, cents]) => ({ cents, ...catOf(id) })).sort((a, b) => b.cents - a.cents);
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>Green Basket Market</b><span>Oct 24 · you paid</span></span>${faces(Object.keys(b.split.people))}</div>
    <div class="versus"><div class="bank"><span class="lbl">Your bank</span><span class="v money">${money(-b.totalCents)}</span></div><div class="mine"><span class="lbl">You spent</span><span class="v money">${money(you.cents)}</span></div></div>
    ${legend(cats)}</div>`;
}

function octoberCard(w) {
  // The same four rows as the October summary on the page, in the same order.
  const { top, rest } = summaryCats(w.cats);
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>October</b><span>${w.bills.length} expenses · your share only</span></span></div>
    <div class="versus"><div class="bank plain"><span class="lbl">You paid</span><span class="v money">${money(w.paidCents)}</span></div><div class="mine"><span class="lbl">You spent</span><span class="v money">${money(w.spentCents)}</span></div></div>
    ${legend([...top, { cents: rest, label: 'Everything else', other: true }])}</div>`;
}

function rentCard(w) {
  const r = w.scans['monthly-rent'].split;
  return `<div class="tcard"><div class="tcard-head"><span class="rec-icon" style="width:28px;height:28px;border-radius:8px">${icon('repeat')}</span><span class="t"><b>Rent &amp; bills</b><span>Flatmates · starts Nov 1</span></span></div>
    <div class="versus"><div class="bank plain"><span class="lbl">Total</span><span class="v money">${money(r.totalCents)}</span></div><div class="mine"><span class="lbl">Your share</span><span class="v money">${money(r.people.you.cents)}</span></div></div>
    <div class="legend"><span>Rent by room</span><span>Bills 4 ways</span><span>Parking: Jordan</span></div></div>`;
}

function towelsCard(w) {
  const t = w.lines.find((i) => /towel/i.test(i.name));
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
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>Taqueria Sol</b><span>${b.date} · ${esc(b.group)}</span></span></div>
    <div class="versus"><div class="bank"><span class="lbl">Your bank</span><span class="v money">$0.00</span><small class="vsub">${esc(PEOPLE[b.payer].name)} paid ${money(b.totalCents)}</small></div><div class="mine"><span class="lbl">You spent</span><span class="v money">${money(you.cents)}</span></div></div>
    ${legend(cats)}</div>`;
}

function activityCard(label, cents) {
  return `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>Activity</b><span>Just now</span></span></div>
    <div class="rows"><div class="row"><span class="n"><b style="color:var(--ink)">${esc(label)}</b> · Personal</span><span class="a money">${money(cents)}</span></div>
    <div class="row" style="padding-top:0"><span class="ai-pill">${icon('spark')}Added by AI</span></div></div></div>`;
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
  return `<div class="tcard bal"><div class="tcard-head">${tmark()}<span class="t"><b>Balances</b><span>October · rent settled</span></span></div>
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
      { t: 'tool', run: 'Looking it up', done: 'Read 14 items', ms: 900 },
      { t: 'card', html: splitCard },
      { t: 'ai', text: `Maya, Jordan and Sam owe you ${owed}.` },
    ],
    // The chip: a different receipt from the opening card (a dinner a friend paid), so no total is contradicted.
    split: [
      { t: 'user', thumb: 'assets/thumb-taqueria.webp', text: 'Split my dinner. Alex paid.' },
      { t: 'tool', run: 'Reading the receipt', done: dinnerCount(w), ms: 700 },
      { t: 'card', html: dinnerCard },
      { t: 'ai', text: `You owe Alex ${money(dinnerOf(w).youCents)}.` },
    ],
    // A typed "split my receipt" with nothing attached: the latest scanned receipt, said as such.
    splitTyped: [
      { t: 'user', text: '' },
      { t: 'tool', run: 'Finding your latest receipt', done: 'Green Basket · 14 items', ms: 700 },
      { t: 'card', html: splitCard },
      { t: 'ai', text: `Split by item. Maya, Jordan and Sam owe you ${owed}.` },
    ],
    dinner: [
      { t: 'user', text: 'Split my dinner receipt. Alex paid.' },
      { t: 'tool', run: 'Finding the dinner receipt', done: `Taqueria Sol · ${dinnerCount(w)}`, ms: 700 },
      { t: 'card', html: dinnerCard },
      { t: 'ai', text: `You owe Alex ${money(dinnerOf(w).youCents)}.` },
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
      { t: 'ai', text: 'Done. You confirm each month.' },
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
// The amount is taken whole: "$12.345" is never quietly cut to $12.34, and "$1,200" is 1200
// (thousands commas are dropped before matching).
const DOLLARS = /\$\s*(\d{1,6}(?:\.\d+)?)(?![\d.])/;
const NUMBER = /(?<![\d.])(\d{1,6}(?:\.\d+)?)(?![\d.])/;
// What Trezzit is, and what it costs: a first visitor's first questions, never an item search.
const ABOUT = /\bwhat(?:'|’)?s (?:trezzit|this)\b|\bwhat is (?:trezzit|this|it)\b|\bhow (?:does|do) (?:it|this|trezzit) work\b|\bhow does trezzit\b|\bwhat (?:can|does) (?:trezzit|it|this|you) do\b|\b(?:about|explain) trezzit\b|^\s*trezzit\s*\??\s*$/;
const PRICE = /\b(?:is|are) (?:it|this|trezzit|you) free\b|\bfree\b.*\b(?:trezzit|app)\b|\bpricing\b|\bpric(?:e|es)\b.*\btrezzit\b|\bcost of trezzit\b|\bhow much (?:is|does) (?:trezzit|it cost|this cost|trezzit cost)\b|^\s*free\s*\??\s*$/;
const TRY = ['Who owes me?', 'What did avocados cost me?'];
// Everyday words for lines on the example receipts.
const SYN = { coffee: 'brew', latte: 'brew', snack: 'chips', medicine: 'health', med: 'health' };
const SYNONYMS = /\b(coffees?|lattes?|snacks?|medicine|meds)\b/g;
const FILLER = /\b(add|record|log|a|an|the|for|at|on|to|my|of|expense|cash|card|just|mine|personal|please|dollars?|bucks|usd|spent|bought|paid)\b/g;

/** An even split of a typed amount, exact to the cent (the first shares take the odd cents, as the app does). */
function evenSplit(q, s, amt, n, named) {
  const cents = Math.round(parseFloat(amt[1]) * 100);
  const user = { t: 'user', text: q };
  if (/\.\d{3,}/.test(amt[1]) || !(cents > 0)) return [user, { t: 'ai', text: 'Amounts go to the cent. Try “split wifi $60 4 ways”.' }];
  // Never quietly change the number of people.
  if (n > 12) return [user, { t: 'ai', text: 'Up to 12 people in this example. Try “split wifi $60 4 ways”.' }];
  const flat = ['maya', 'jordan', 'sam'];
  let others = named.length ? named : flat;
  if (n >= 2 && !named.length) others = n - 1 <= 3 ? flat.slice(0, n - 1) : null;
  const count = others ? others.length + 1 : n;
  if (count < 2) return [user, { t: 'ai', text: 'Split it with who? Try “split wifi $60 4 ways”.' }];
  // A share of $0.00 is not a debt: never save one.
  if (cents < count) return [user, { t: 'ai', text: `Too small to split ${count} ways.` }];
  const base = Math.floor(cents / count); const odd = cents - base * count;
  const shares = Array.from({ length: count }, (_, i) => base + (i < odd ? 1 : 0));
  const owedC = cents - shares[0];
  const label = cap(s.replace(amt[0], ' ').replace(/\b\d+\s*(ways|people|of us)\b/g, ' ')
    .replace(/\b(split|evenly|equally|between|among|with|roommates?|flat(mates)?|me|us|and|it|this|ways?|maya|jordan|sam|alex|priya)\b/g, ' ')
    .replace(FILLER, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 28) || 'Shared expense';
  const inFlat = others && others.every((k) => flat.includes(k));
  const ids = others ? ['you', ...others] : null;
  const card = () => `<div class="tcard"><div class="tcard-head">${tmark()}<span class="t"><b>${esc(label)}</b><span>${inFlat ? 'Flatmates · ' : ''}you paid · split ${count} ways</span></span>${ids ? faces(ids) : ''}</div>
    <div class="versus" style="margin-bottom:0"><div class="bank"><span class="lbl">Your bank</span><span class="v money">${money(-cents)}</span></div><div class="mine"><span class="lbl">You spent</span><span class="v money">${money(shares[0])}</span></div></div></div>`;
  const whoOwes = others ? `${who(others)} ${others.length === 1 ? 'owes' : 'owe'} you` : `The other ${count - 1} owe you`;
  return [user, { t: 'tool', run: 'Saving', done: `${money(cents)} · ${count} ways`, ms: 500 }, { t: 'card', html: card }, { t: 'ai', text: `Saved. ${whoOwes} ${money(owedC)}.` }];
}

export function answer(q, w) {
  // "$1,200" is 1200: thousands commas go before any amount is read.
  const s = q.toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1');
  const say = (text, tool, card) => [{ t: 'user', text: q }, ...(tool ? [tool] : []), ...(card ? [{ t: 'card', html: card }] : []), { t: 'ai', text }];
  const named = NAMES.filter((n) => new RegExp(`\\b${n}\\b`).test(s));
  if (/^\s*(hi|hello|hey|yo|hiya|thanks|thank you|ok|okay|cool|test)\b[\s!.?]*$/.test(s)) return say('Ask me about anything you spent, like avocados or dining out.');
  if (PRICE.test(s)) {
    return [{ t: 'user', text: q }, { t: 'ai', text: 'Trezzit keeps every item you buy, alone or shared, so you see what you actually spent. See for yourself:', link: ['https://app.trezzit.com/signup', 'Sign up'] }];
  }
  if (ABOUT.test(s)) {
    return [{ t: 'user', text: q }, { t: 'ai', text: 'Trezzit keeps every item you buy, alone or shared, so you see what you actually spent. Use the app, or ask me.', link: ['connect/', 'Connect yours'] }];
  }
  // Trust and setup come first: they are what a new visitor asks, and none of them is an item search.
  // Linking a bank is the first trust test a wary visitor types: say the promise, then what works instead.
  if (!DOLLARS.test(s) && (/\b(plaid|chase|wells fargo|citi(bank)?|amex|capital one|bank of america|checking|savings)\b/.test(s)
    || /\b(link|connect|sync|hook up|add)\b.*\b(bank|card|credit card|debit card)\b/.test(s) || /\bbank\b.*\b(link|connect|sync|login|log in)\b/.test(s)
    || /\blink\b.*\baccount\b/.test(s))) {
    return [{ t: 'user', text: q }, { t: 'ai', text: 'Trezzit never connects to your bank. Drop in a statement and I’ll find what’s missing.', suggest: ['Is my statement all in?'] }];
  }
  if (/\bstatement\b/.test(s)) {
    const deli = w.bills.find((b) => b.byAI);
    return say(`All ${w.bank.length} payments are in Trezzit. ${deli.title}, ${money(deli.totalCents)} on ${deli.date}, was the one I added.`,
      { t: 'tool', run: 'Checking your statement', done: `Checked ${w.bank.length} payments`, ms: 700 });
  }
  if (/\b(connect|set ?up|install|add|use)\b.*\b(claude|chatgpt|ai)\b|\bhow do i (use|get|start|connect|set)\b/.test(s) && !DOLLARS.test(s)) {
    return [{ t: 'user', text: q }, { t: 'ai', text: 'Copy one URL into Claude or ChatGPT.', link: ['connect/', 'Connect'] }];
  }
  if (/\bmov(e|es|ing)\b.*\bmoney\b|\bmakes? payments?\b/.test(s)) return say('Never. Trezzit records expenses and settle-ups; it can’t move money.');
  if (/\bwhat can (you|it|trezzit) (see|access|read)\b|\b(see|access|read)\b.*\b(my|data)\b|\bprivate\b|\bprivacy\b|\bsafe\b|\bsecure\b/.test(s) && !/\b(receipt|spen[dt]|owe|bank)\b/.test(s)) {
    return say('Your Trezzit expenses, groups and balances. Not your bank, not other members’ emails, and Trezzit never sees this chat.');
  }
  if (/\b(send|transfer|venmo|zelle|paypal|wire)\b|\bpay\s+(back|him|her|them|maya|jordan|sam|alex|priya|my|a\s+friend)\b/.test(s)) {
    return say('Trezzit never moves money. When you pay someone back elsewhere, I can record it, so your balances stay right.');
  }
  if (/budget/.test(s)) return say('Trezzit doesn’t do budgets. It shows what you actually spent, item by item.');
  if (/\bbank\b.*\b(link|connect|sync|login)|\b(link|connect|sync)\b.*\bbank\b/.test(s)) return say('Trezzit never logs in to your bank. You add receipts and bills, or ask me to.');
  if (/\bbank\b/.test(s) && /\b(balance|account|statement|money)\b/.test(s)) return say('Trezzit doesn’t see your bank. It knows what you’ve recorded. Ask who owes you, or what you spent in October.');
  if (/\b(delete|remove|undo|erase)\b/.test(s)) return say('I can only delete a bill I added in the last 30 minutes. Everything else, delete in the app.');

  // Who owes whom, or what a friend paid: answered from the balances, never from item names.
  if (/\b(owe|owes|owed|owing|balance|balances|settle|even)\b/.test(s) || (named.length && /\b(pay|paid|pays)\b/.test(s))) {
    const tool = { t: 'tool', run: 'Checking balances', done: 'Balances · rent settled', ms: 500 };
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
  // A typed message never grows an attachment the visitor didn't add.
  const reuse = (id) => scripts(w)[id].map((st, i) => (i === 0 ? { ...st, text: q, thumb: undefined } : st));
  if (/\b(categor|breakdown|break\s+down|summar|overview)/.test(s)) return reuse('october');
  // The page's own opening question gets the opening card, never a different one.
  if (/\bgreen\s*basket\b/.test(s) && /\b(spen[dt]|cost|total|much)\b/.test(s) && !/\b(split|receipt)\b/.test(s)) return reuse('spent');
  if (/\brent\b/.test(s) && /\b(add|every|monthly|recurr|repeat|schedule)/.test(s)) return reuse('rent');
  // "split wifi 4 ways $60": an amount to share is an even split, saved as typed (no receipt involved).
  const splitWords = /\bsplit\b|\b\d+\s*ways\b|\broommates?\b|\bflat(mates)?\b|\bevenly\b/;
  if (splitWords.test(s) && !/\breceipt\b/.test(s)) {
    const ways = s.match(/\b(\d+)\s*(ways|people|of us)\b/);
    const amt = s.match(DOLLARS) || s.replace(/\b\d+\s*(ways|people|of us)\b/g, ' ').match(NUMBER);
    if (amt) return evenSplit(q, s, amt, ways ? Number(ways[1]) : 0, named);
    if (!/\b(dinner|tacos?|taqueria|restaurant|alex|priya|green\s*basket|groceries)\b/.test(s)) return say('How much, and how many ways? Try “split wifi $60 4 ways”.');
  }
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
  // Nothing found is never a dead end: two questions that work, one tap away.
  if (!words.length) return [{ t: 'user', text: q }, { t: 'ai', text: 'Ask me what you spent, who owes you, or to add something. Try one of these:', suggest: TRY }];
  return [{ t: 'user', text: q }, { t: 'ai', text: 'I can’t see that in this example. Try one of these:', suggest: TRY }];
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
const chipHtml = (text) => `<button class="chip" type="button" data-ask="${esc(text)}">${icon('send')}${esc(text)}</button>`;
const aiHtml = (st) => `<div class="msg ai">${esc(st.text)}${st.link ? ` <a class="link-arrow" href="${st.link[0]}">${esc(st.link[1])} ${icon('arrow')}</a>` : ''}${st.suggest ? `<span class="sugg">${st.suggest.map(chipHtml).join('')}</span>` : ''}</div>`;
const toolHtml = (text, done, none = false) => `<div class="tool">${done ? (none ? noneIcon : okIcon) : '<span class="st spin" aria-hidden="true"></span>'}<b>Trezzit</b><span class="res">${esc(text)}</span></div>`;

class Player {
  constructor(root, w, { script = 'split' } = {}) {
    this.root = root; this.w = w; this.s = scripts(w);
    this.log = $('[data-chat-log]', root);
    this.ctl = $('[data-chat-ctl]', root);
    this.chipBox = $('[data-chat-chips]', root);
    // A chip that has played makes way for the next question, so nothing on offer has already been answered.
    this.pool = ['Who owes me?', 'My share of towels?'];
    this.clock = new Clock();
    // A fixed-height chat (the hero) scrolls inside itself, so nothing outside it ever moves.
    this.fixed = root.classList.contains('is-fixed');
    this.state = 'static'; this.current = script;
    this.pending = null; this.first = null;
    this.anchor = this.fixed ? [...this.log.querySelectorAll('.msg.user')].pop() : null;
    // The split section below re-splits Green Basket: every later answer uses the new numbers
    // (messages already in the chat stay as they were said).
    document.addEventListener('d:split', (e) => { this.w = withSplit(this.w, e.detail.id, e.detail.split); this.s = scripts(this.w); });
    this.ctl?.addEventListener('click', () => this.onCtl());
    this.chipBox?.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) { this.touched = true; this.useChip(c); } });
    // Suggestions inside an answer ask their question when tapped.
    this.log.addEventListener('click', (e) => { const c = e.target.closest('.sugg .chip'); if (c) { this.touched = true; this.retire(c.dataset.ask); this.run(null, answer(c.dataset.ask, this.w)); } });
    const form = $('[data-chat-form]', root);
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('input', form); const q = input.value.trim().slice(0, 140);
      this.touched = true;
      if (!q) return;
      input.value = '';
      this.retire(q);
      this.run(null, answer(q, this.w));
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

  /** A question you typed is never offered back to you as a chip. */
  retire(q) {
    const key = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const k = key(q);
    this.pool = this.pool.filter((t) => key(t) !== k);
    this.chipBox?.querySelectorAll('.chip').forEach((c) => { if (key(c.textContent) === k) this.swap(c); });
  }

  /** A chip that has been asked makes way for the next one in the pool. */
  swap(c) {
    const had = document.activeElement === c;
    const next = this.pool.shift();
    if (next) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.ask = next; b.innerHTML = icon('send') + esc(next);
      c.replaceWith(b);
      if (had) b.focus({ preventScroll: true });
    } else {
      c.remove();
      if (!this.chipBox.querySelector('.chip')) this.chipBox.hidden = true;
    }
  }

  useChip(c) {
    const steps = c.dataset.script ? this.s[c.dataset.script] : answer(c.dataset.ask, this.w);
    const id = c.dataset.script || null;
    this.swap(c);
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
      announce(this.summary());
    } catch (e) { if (e.message !== 'cancelled') throw e; }
  }

  /** What a screen reader hears when an answer lands: the card's gist, then the closing line
      ("Taqueria Sol, 7 items + tip. You owe Alex $27.03."). */
  summary() {
    const q = [...this.log.querySelectorAll('.msg.user')].pop();
    const after = [];
    for (let el = q?.nextElementSibling; el; el = el.nextElementSibling) after.push(el);
    const card = after.find((el) => el.classList.contains('tcard'));
    const tool = after.find((el) => el.classList.contains('tool'));
    const ai = after.filter((el) => el.classList.contains('msg') && el.classList.contains('ai')).pop();
    const title = card?.querySelector('.tcard-head .t b')?.textContent; const res = tool?.querySelector('.res')?.textContent;
    const gist = (title && res && res.toLowerCase().includes(title.toLowerCase()) ? [res] : [title, res]).filter(Boolean).join(', ');
    const end = ai ? [...ai.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '';
    return [gist && `${gist}.`, end].filter(Boolean).join(' ');
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

  /** Fixed chats keep the latest question at the top of the log, with its answer under it,
      so no bubble is ever sliced by the header. Only an exchange taller than the log
      scrolls on to its newest line. */
  follow(now = false) {
    if (!this.fixed) return;
    requestAnimationFrame(() => {
      const log = this.log;
      const max = log.scrollHeight - log.clientHeight;
      const last = log.lastElementChild;
      let top = max;
      if (this.anchor?.parentNode === log && last) {
        const qTop = this.anchor.offsetTop - (this.anchor.offsetTop > 30 ? 32 : 10);
        const end = last.offsetTop + last.offsetHeight + 12;
        top = end - qTop <= log.clientHeight ? Math.min(max, qTop) : end - log.clientHeight;
      }
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

/* ---------- the AI section: the exchange is on the page from the start ----------
   The statement, Trezzit's check and the AI's question are there on arrival, so the navy
   never shows an empty frame. Only the payoff plays, once, as the thread comes into view:
   you say yes, then the Activity card (waiting faded in its place) lands. Leaving the screen first finishes it at once.
   Reduced motion: all static. */
function initThread() {
  const t = document.querySelector('[data-thread]');
  if (!t || reducedMotion()) return;
  const kids = [...t.children];
  const [yes, card] = kids.slice(-2);
  if (!card) return;
  t.classList.add('is-armed');
  kids.slice(0, -2).forEach((el) => el.classList.add('in', 'still'));
  const timers = []; let over = false;
  const finish = () => { if (over) return; over = true; timers.forEach(clearTimeout); [yes, card].forEach((el) => el.classList.add('in')); };
  onVisible(t, () => {
    if (over) return;
    timers.push(setTimeout(() => yes.classList.add('in'), 450));
    timers.push(setTimeout(() => { card.classList.add('in'); over = true; }, 1000));
    // Nothing plays unseen.
    new IntersectionObserver(([e], io) => { if (over) io.disconnect(); else if (!e.isIntersecting) { finish(); io.disconnect(); } }).observe(t);
  }, 0.5);
}

export async function initChats() {
  const w = await getWorld();
  const hero = document.getElementById('hero-chat');
  initThread();
  if (!hero) return [];
  const p = new Player(hero, w, { script: 'spent' });
  // The page opens on the finished exchange: nothing plays until someone asks. Once the card is
  // mostly in view, the first chip pulses once, to say the questions are live.
  if (!reducedMotion()) {
    onVisible(hero, () => setTimeout(() => {
      const c = p.chipBox?.querySelector('.chip');
      if (c && !p.touched && !hero.contains(document.activeElement)) c.classList.add('nudge');
    }, 1200), 0.6);
  }
  return [p];
}
