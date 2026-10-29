/**
 * snap-split.js: "Snap it. Split it." One panel: the receipt is read line by
 * line into a list, then each line gets its faces and the list becomes the
 * split. Every row is in the DOM from the start (pending rows show as quiet
 * placeholders), so nothing below moves while it plays. All maths goes
 * through the kit's split engine via summarise(), in cents.
 *
 * The read is short (about a second), starts only once the list is well on
 * screen, and jumps straight to the finished split if the visitor scrolls on.
 */

import { loadScan, getSample, receiptHTML, ensureReceiptStyles } from '../../_kit/receipts.js';
import { PEOPLE, CATEGORIES, summarise } from './data.js';
import { shareText, splitPeople, isExtra, whoHTML, updateStack, openLine, toggleSplit } from './split-editor.js';
import { money, bankAmt, esc, avatar, tweenMoney, ICON, listNames, reduced, whenVisible, sleep } from './util.js';

const SHOWN_LINES = 5;
const READ_MS = 700; // all rows, whatever the receipt length

export function initSnapSplit(root, scenarioFor) {
  ensureReceiptStyles();
  const $ = (s) => root.querySelector(s);
  const picks = [...root.querySelectorAll('[data-sample]')];
  const card = $('[data-card]');
  const paper = $('[data-paper]');
  const paperTag = $('[data-paper-tag]');
  const list = $('[data-items]');
  const foot = $('[data-foot]');
  const more = $('[data-more]');
  const live = $('[data-live]');
  const peopleEl = $('[data-people]');
  const progress = $('[data-progress]');
  const sumBank = $('[data-sum-bank]');
  const sumBankAmt = $('[data-sum-bank-amt]');
  const sumMine = $('[data-sum-mine]');

  let sc = null;
  let items = [];
  let order = [];
  let run = 0;
  let sampleId = null;
  let expanded = false;

  const bill = () => ({ ...sc.bill, items: items.map((it) => ({ ...it })) });
  const setPhase = (p) => { root.dataset.phase = p; };
  // "You spent" is your share; the chips are everyone else, so no number shows twice.
  const others = () => order.filter((id) => id !== 'you');

  function rowHTML(it, open) {
    const extra = isExtra(it);
    const c = CATEGORIES[it.category] || CATEGORIES.other;
    const who = extra ? [] : splitPeople(items[it.index].split, order);
    const faces = order.length > 1 && !extra
      ? `<span class="ss-who">${whoHTML(order, who, it.name, open)}</span>`
      : '<span class="ss-who"></span>';
    return `<li class="ss-item${extra ? ' is-extra' : ''}${open && order.length > 1 ? ' is-open' : ''}" data-i="${it.index}" style="--c:${extra ? '#94a3b8' : c.color}">
      <span class="dot" aria-hidden="true"></span>
      <span class="ss-name"><span>${esc(it.name)}</span>
        <small class="ss-read">${extra ? 'On the receipt' : esc(c.label)}</small>
        <small class="ss-split" data-each>${esc(subText(it))}</small></span>
      ${faces}
      <span class="ss-price money"><span class="ss-read">${money(it.totalCents - (it.taxCents || 0))}</span><span class="ss-split">${money(it.totalCents)}</span></span>
    </li>`;
  }

  function subText(it) {
    if (isExtra(it)) return order.length > 1 ? 'In proportion to each share' : 'All yours';
    const share = order.length > 1 ? shareText(it.shares, order) : (CATEGORIES[it.category] || CATEGORIES.other).label;
    return it.taxCents ? `${share} · incl. ${money(it.taxCents)} tax` : share;
  }

  function peopleHTML(res) {
    return others().map((id) => {
      const cents = res.people[id]?.cents || 0;
      return `<li data-id="${id}">${avatar(PEOPLE[id], { size: 'sm' })}<span class="sp-name">${esc(PEOPLE[id].name)}</span><b class="money" data-cents="${cents}">${money(cents)}</b></li>`;
    }).join('');
  }

  function oweText(sum) {
    const names = others().map((id) => PEOPLE[id].name);
    if (sc.payer === 'you' && sum.owedToYou) return `${esc(listNames(names))} owe${names.length === 1 ? 's' : ''} you <b class="money" data-owe>${money(sum.owedToYou)}</b><small>They don&rsquo;t need an account.</small>`;
    if (sc.payer !== 'you') return `You owe ${esc(PEOPLE[sc.payer].name)} <b class="money" data-owe>${money(sum.youOwe)}</b>`;
    return 'All yours. Nobody owes anybody.';
  }

  function render() {
    order = sc.people;
    const sum = summarise(sc, bill());
    const res = sum.result;
    const firstOpen = res.items.findIndex((it) => !isExtra(it));
    list.innerHTML = res.items.map((it, k) => rowHTML(it, k === firstOpen)).join('');
    peopleEl.innerHTML = peopleHTML(res);
    root.classList.toggle('is-solo', order.length === 1);
    sumBank.textContent = sc.bank ? `${sc.bank.date} ${sc.bank.merchant}` : 'Not on your statement';
    sumBankAmt.textContent = sc.bank ? bankAmt(res.totalCents) : '';
    sumMine.dataset.cents = String(sum.mine);
    sumMine.textContent = money(sum.mine);
    foot.innerHTML = `
      <div class="ss-total"><span>Total</span><b class="money">${money(res.totalCents)}</b></div>
      <p class="ss-check">${ICON.check}<span class="ss-read" data-read-status>Reading the receipt</span><span class="ss-split">Adds up to the cent.</span></p>
      <div class="ss-end"><p class="ss-owe" data-owe-line>${oweText(sum)}</p><button type="button" class="btn btn-quiet btn-sm" data-reset>Reset</button></div>`;
    const hidden = res.items.length - SHOWN_LINES;
    list.classList.toggle('is-clipped', hidden > 0 && !expanded);
    more.hidden = !(hidden > 0 && !expanded);
    more.textContent = `Show all ${res.items.length} lines`;
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
      if (each.textContent !== txt) { each.textContent = txt; each.classList.remove('flash'); void each.offsetWidth; each.classList.add('flash'); }
      if (!isExtra(it)) {
        const who = splitPeople(items[it.index].split, order);
        li.querySelectorAll('.who-toggles .av').forEach((b) => b.setAttribute('aria-pressed', String(who.includes(b.dataset.id))));
        updateStack(li, order, who);
      }
    });
    others().forEach((id) => tweenMoney(peopleEl.querySelector(`[data-id="${id}"] b`), res.people[id]?.cents || 0));
    tweenMoney(sumMine, sum.mine);
    foot.querySelector('[data-owe-line]').innerHTML = oweText(sum);
    live.textContent = order.map((id) => `${PEOPLE[id].name} ${money(res.people[id]?.cents || 0)}`).join(', ');
  }

  /* ---------- the read ---------- */
  function follow(line) {
    const view = paper.parentElement;
    const max = Math.max(0, paper.scrollHeight - view.clientHeight);
    const y = Math.min(max, Math.max(0, line.offsetTop - view.clientHeight * 0.4));
    paper.style.transform = `translateY(${-y}px)`;
  }
  const onScreen = () => {
    const r = card.getBoundingClientRect();
    return r.bottom > 80 && r.top < innerHeight;
  };

  /* Pending: rows are placeholders, amounts are "…", nothing claims a result yet. */
  function pending() {
    setPhase('read');
    [...list.children].forEach((r) => r.classList.add('is-pending'));
    sumMine.textContent = '…';
    peopleEl.querySelectorAll('b').forEach((b) => { b.textContent = '…'; });
    progress.style.setProperty('--p', '0');
  }

  /* Finished: the split, with the money counting in from the bill total. */
  function finish({ animate = true } = {}) {
    paper.querySelectorAll('.tz-r-line.is-active').forEach((l) => l.classList.remove('is-active'));
    paper.style.transform = '';
    [...list.children].forEach((r) => r.classList.remove('is-pending'));
    setPhase('split');
    progress.style.setProperty('--p', '0');
    const sum = summarise(sc, bill());
    const dur = animate && !reduced() ? 600 : 0;
    tweenMoney(sumMine, sum.mine, { from: sum.total, dur });
    others().forEach((id) => tweenMoney(peopleEl.querySelector(`[data-id="${id}"] b`), sum.result.people[id]?.cents || 0, { from: 0, dur }));
    if (animate) hint();
  }

  async function read(id) {
    if (reduced()) { finish({ animate: false }); return; }
    pending();
    const rows = [...list.children];
    const lines = [...paper.querySelectorAll('.tz-r-line')];
    const status = foot.querySelector('[data-read-status]');
    const per = Math.max(40, Math.min(140, READ_MS / rows.length));
    await sleep(150);
    for (let k = 0; k < rows.length; k += 1) {
      if (id !== run) return;
      if (!onScreen()) { finish({ animate: false }); return; } // scrolled on: no half-built card
      const r = rows[k];
      const line = lines.find((l) => Number(l.dataset.index) === Number(r.dataset.i));
      lines.forEach((l) => l.classList.toggle('is-active', l === line));
      if (line) follow(line);
      r.classList.remove('is-pending');
      progress.style.setProperty('--p', String((k + 1) / rows.length));
      if (status) status.textContent = `Reading line ${k + 1} of ${rows.length}`;
      await sleep(per);
    }
    if (id !== run) return;
    if (status) status.textContent = 'Checking the math';
    await sleep(220);
    if (id !== run) return;
    finish();
  }

  /* one-time nudge on the open line's faces once the read is done */
  function hint() {
    const w = list.querySelector('.who.is-open .who-toggles');
    if (!w || reduced()) return;
    w.classList.remove('hint'); void w.offsetWidth; w.classList.add('hint');
  }

  async function load(id, { play = true, wait = false } = {}) {
    const my = ++run;
    sampleId = id;
    expanded = false;
    picks.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.sample === id)));
    const [raw, scenario] = await Promise.all([loadScan(id), scenarioFor(id)]);
    if (my !== run) return;
    sc = scenario;
    items = sc.bill.items.map((it) => ({ ...it, split: it.split ? JSON.parse(JSON.stringify(it.split)) : { type: 'equal', people: sc.people } }));
    paper.innerHTML = receiptHTML(raw, { sample: getSample(id) });
    paper.querySelector('.tz-r-foot p')?.remove(); // its unit count ("ITEMS 19") reads as a mismatch next to the line count
    paper.style.transform = '';
    paperTag.textContent = `${sc.itemCount} lines`;
    render();
    if (wait) { pending(); return; }
    setPhase('split');
    if (play) await read(my);
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
    if (e.target.closest('[data-reset]')) { load(sampleId, { play: false }); return; }
    if (root.dataset.phase !== 'split') return;
    const st = e.target.closest('.who-stack');
    if (st) {
      const li = st.closest('.ss-item');
      openLine(list, li);
      li.querySelector('.who-toggles .av')?.focus({ preventScroll: true });
      return;
    }
    const b = e.target.closest('.who-toggles .av');
    if (!b) return;
    const li = b.closest('.ss-item');
    const i = Number(li.dataset.i);
    const next = toggleSplit(sc.bill.items[i].split, items[i].split, b.dataset.id, order);
    if (!next) { refuse(li, b); return; }
    items[i].split = next;
    update();
  });
  more.addEventListener('click', () => {
    expanded = true;
    list.classList.remove('is-clipped');
    more.hidden = true;
    list.children[SHOWN_LINES]?.querySelector('button')?.focus?.({ preventScroll: true });
  });
  picks.forEach((p) => p.addEventListener('click', () => { played = true; load(p.dataset.sample); }));

  // Until the list is well on screen it waits as placeholders; then the read plays once.
  const first = picks.find((p) => p.getAttribute('aria-pressed') === 'true')?.dataset.sample || picks[0].dataset.sample;
  let played = false;
  load(first, { play: false, wait: !reduced() }).then(() => {
    if (reduced()) return;
    whenVisible(list, () => {
      if (played || sampleId !== first) return;
      played = true;
      read(run);
    }, { threshold: 0, rootMargin: '0px 0px -35% 0px' });
  });

  return {
    load(id) { played = true; return load(id); },
    get summary() { return sc ? summarise(sc, bill()) : null; },
  };
}
