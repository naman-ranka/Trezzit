/**
 * snap-split.js: "Split it by the item." One receipt (Taqueria Sol, Alex paid).
 *
 * The finished split is the first thing in the DOM: every line has its faces and every
 * figure is final from the first paint, so a visitor scrolling at any speed only ever
 * sees a finished frame. Tap a face to take someone off a line (or put them back); all
 * maths goes through the kit's split engine via summarise(), in cents, and every figure
 * is set in the same frame.
 *
 * The only motion on arrival is a 600 ms highlight sweeping down the paper receipt, with
 * the matching line of the split lighting as it passes. Hovering a line lights its line
 * on the receipt.
 */

import { loadScan, getSample, receiptHTML, ensureReceiptStyles } from '/assets/_kit/receipts.js';
import { PEOPLE, summarise } from './data.js';
import { shareText, splitPeople, isExtra, facesHTML, toggleSplit, wireFaceKeys } from './split-editor.js';
import { money, esc, avatar, ICON, reduced, whenVisible } from './util.js';
import { splitAmount } from '/assets/_kit/split-engine.js';

const SWEEP_MS = 600;

export function initSnapSplit(root, scenarioFor) {
  ensureReceiptStyles();
  const $ = (s) => root.querySelector(s);
  const card = $('[data-card]');
  const paper = $('[data-paper]');
  const tags = root.querySelectorAll('[data-paper-tag]');
  const list = $('[data-items]');
  const foot = $('[data-foot]');
  const live = $('[data-live]');
  const peopleEl = $('[data-people]');
  const thumb = $('[data-thumb]');
  const thumbImg = $('[data-thumb-img]');

  let sc = null;
  let items = [];
  let order = [];
  let sampleId = null;

  const bill = () => ({ ...sc.bill, items: items.map((it) => ({ ...it })) });

  /* Lines show the receipt's own prices (before tax), so 8.95 on the paper is $8.95 here; the tax
     is its own row, like the tip. The pills stay exact: each line's tax goes to whoever had it. */
  function subText(it) {
    if (isExtra(it)) return '';
    return shareText(splitAmount(it.priceCents, items[it.index].split, order).shares, order);
  }

  function rowHTML(it) {
    const extra = isExtra(it);
    const who = extra ? [] : splitPeople(items[it.index].split, order);
    return `<li class="ss-item${extra ? ' is-extra' : ''}" data-i="${it.index}">
      <span class="ss-name"><span>${esc(it.name)}</span><small data-each>${esc(subText(it))}</small></span>
      <span class="ss-who">${extra ? '' : facesHTML(order, who, it.name)}</span>
      <span class="ss-price money">${money(extra ? it.totalCents : it.priceCents)}</span>
    </li>`;
  }
  const taxHTML = (res) => {
    const tax = res.items.filter((it) => !isExtra(it)).reduce((a, it) => a + it.taxCents, 0);
    return tax ? `<li class="ss-item is-extra is-tax"><span class="ss-name"><span>Tax</span></span><span class="ss-who"></span><span class="ss-price money">${money(tax)}</span></li>` : '';
  };

  /* You first (your number is the one a tap is about), then everyone else */
  const peopleHTML = (res) => order.map((id) => {
    const cents = res.people[id]?.cents || 0;
    const you = id === 'you';
    return `<li data-id="${id}"${you ? ' class="is-you"' : ''}>${avatar(PEOPLE[id], { size: 'sm' })}<span class="sp-name">${you ? 'You' : esc(PEOPLE[id].name)}</span><b class="money" data-cents="${cents}"${you ? ' data-mine' : ''}>${money(cents)}</b></li>`;
  }).join('');

  /* The lines that explain the shares lead (sc.lead); the rest follow in receipt order. */
  function ordered(res) {
    const lead = sc.lead || [];
    return [...lead.map((i) => res.items.find((it) => it.index === i && !isExtra(it))).filter(Boolean),
      ...res.items.filter((it) => isExtra(it) || !lead.includes(it.index))];
  }

  function render() {
    order = sc.people;
    const sum = summarise(sc, bill());
    const res = sum.result;
    const rows = ordered(res);
    const firstExtra = rows.findIndex(isExtra);
    const html = rows.map(rowHTML);
    html.splice(firstExtra < 0 ? html.length : firstExtra, 0, taxHTML(res));
    list.innerHTML = html.join('');
    peopleEl.innerHTML = peopleHTML(res);
    foot.innerHTML = `
      <p class="ss-total"><span>Total</span><b class="money">${money(res.totalCents)}</b></p>
      <p class="ss-check">${ICON.check}<span>Adds up</span></p>
      <a class="snap-own" href="https://app.trezzit.com/split">Scan your own receipt</a>
      <button type="button" class="btn btn-quiet btn-sm" data-reset>Reset</button>`;
  }

  function update() {
    const sum = summarise(sc, bill());
    const res = sum.result;
    res.items.forEach((it) => {
      const li = list.querySelector(`.ss-item[data-i="${it.index}"]`);
      if (!li) return;
      const each = li.querySelector('[data-each]');
      const txt = subText(it);
      clearTimeout(Number(each.dataset.t || 0));
      each.classList.remove('is-warn');
      if (each.textContent !== txt) each.textContent = txt;
      if (!isExtra(it)) {
        const who = splitPeople(items[it.index].split, order);
        li.querySelectorAll('.faces .av').forEach((b) => b.setAttribute('aria-pressed', String(who.includes(b.dataset.id))));
      }
    });
    order.forEach((id) => setMoney(peopleEl.querySelector(`[data-id="${id}"] b`), res.people[id]?.cents || 0));
    live.textContent = order.map((id) => `${PEOPLE[id].name} ${money(res.people[id]?.cents || 0)}`).join(', ');
  }

  function flash(node) {
    if (reduced()) return;
    node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash');
  }
  /* A changed figure is set in the same frame as every other figure and flashes once. */
  function setMoney(node, cents) {
    if (!node) return;
    const changed = node.dataset.cents !== String(cents);
    node.dataset.cents = String(cents);
    node.textContent = money(cents);
    if (changed) flash(node.closest('li')); // only the pill whose total changed takes the cue
  }

  /* ---------- receipt <-> split ---------- */
  const lineFor = (li) => paper.querySelector(`.tz-r-line[data-index="${li?.dataset.i}"]`);
  function light(li) {
    paper.querySelectorAll('.tz-r-line.is-active').forEach((l) => l.classList.remove('is-active'));
    lineFor(li)?.classList.add('is-active');
  }
  function follow(line) {
    const view = paper.parentElement;
    const max = Math.max(0, paper.scrollHeight - view.clientHeight);
    const y = line ? Math.min(max, Math.max(0, line.offsetTop - view.clientHeight * 0.4)) : 0;
    paper.style.transform = y ? `translateY(${-y}px)` : '';
  }

  /* Arrival: a highlight sweeps down the receipt; the split is already final under it. */
  let timers = [];
  function sweep() {
    if (reduced()) return;
    const rows = [...list.children];
    const n = rows.length;
    timers = rows.map((li, k) => setTimeout(() => {
      li.classList.remove('is-lit'); void li.offsetWidth; li.classList.add('is-lit');
      light(li);
      follow(lineFor(li));
    }, (k * SWEEP_MS) / n));
    timers.push(setTimeout(() => { light(null); follow(null); hint(); }, SWEEP_MS + 120));
  }
  /* the first touch ends the arrival at once: no band is left running over the lines */
  function endSweep() {
    if (!timers.length) return;
    timers.forEach(clearTimeout); timers = [];
    list.querySelectorAll('.is-lit').forEach((li) => li.classList.remove('is-lit'));
    light(null); follow(null);
  }
  card.addEventListener('pointerdown', endSweep);
  card.addEventListener('keydown', endSweep);

  /* one-time nudge on the first line's faces */
  function hint() {
    const w = list.querySelector('.faces');
    if (!w || reduced()) return;
    w.classList.remove('hint'); void w.offsetWidth; w.classList.add('hint');
  }

  async function load(id) {
    sampleId = id;
    const [raw, scenario] = await Promise.all([loadScan(id), scenarioFor(id)]);
    sc = scenario;
    items = sc.bill.items.map((it) => ({ ...it, split: it.split ? JSON.parse(JSON.stringify(it.split)) : { type: 'equal', people: sc.people } }));
    // Alex paid with Alex's card: the receipt must not show your ··4242 from the hero
    const sample = getSample(id);
    const print = sample.print && sc.payer !== 'you' ? { ...sample.print, card: sample.print.card.replace('4242', '8817') } : sample.print;
    paper.innerHTML = receiptHTML(raw, { sample: { ...sample, print } });
    paper.querySelector('.tz-r-foot p')?.remove(); // its unit count ("ITEMS 19") reads as a mismatch next to the line count
    if (thumbImg) thumbImg.innerHTML = paper.innerHTML;
    paper.style.transform = '';
    const tag = [sc.day, sc.payer === 'you' ? '' : `${PEOPLE[sc.payer].name} paid`].filter(Boolean).join(' · ');
    tags.forEach((t) => { t.textContent = tag; });
    render();
  }

  /* An empty line is refused right where it was tapped. */
  function refuse(li, b) {
    const msg = 'Someone has to have it.';
    live.textContent = `${msg} Add another person first.`;
    const each = li.querySelector('[data-each]');
    const it = summarise(sc, bill()).result.items.find((x) => x.index === Number(li.dataset.i));
    each.textContent = msg;
    each.classList.add('is-warn');
    clearTimeout(Number(each.dataset.t || 0));
    each.dataset.t = String(setTimeout(() => { each.classList.remove('is-warn'); if (it) each.textContent = subText(it); }, 2400));
    b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) { load(sampleId).then(() => root.querySelector('[data-reset]')?.focus()); return; }
    const b = e.target.closest('.faces .av');
    if (!b || !sc) return;
    const li = b.closest('.ss-item');
    const i = Number(li.dataset.i);
    const next = toggleSplit(sc.bill.items[i].split, items[i].split, b.dataset.id, order);
    if (!next) { refuse(li, b); return; }
    items[i].split = next;
    update();
  });
  wireFaceKeys(list);
  list.addEventListener('pointerover', (e) => { const li = e.target.closest('.ss-item'); if (li) light(li); });
  list.addEventListener('pointerleave', () => light(null));
  list.addEventListener('focusin', (e) => light(e.target.closest('.ss-item')));

  // Phones: the receipt is a thumbnail row; tapping it opens the paper under it.
  thumb?.addEventListener('click', () => {
    const open = thumb.getAttribute('aria-expanded') !== 'true';
    thumb.setAttribute('aria-expanded', String(open));
    root.querySelector('[data-paper-box]').classList.toggle('is-open', open);
  });

  load(root.dataset.sample).then(() => {
    whenVisible(card, sweep, { threshold: 0.35 });
  });

  return {
    get summary() { return sc ? summarise(sc, bill()) : null; },
  };
}
