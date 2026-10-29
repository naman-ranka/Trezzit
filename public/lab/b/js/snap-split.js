/**
 * snap-split.js: "Snap it. Split it." One panel: the receipt is read line by
 * line into a list, then each line gets its faces and the list becomes the
 * split. Every row is in the DOM from the start (the read only fades rows in),
 * so nothing below moves while it plays. All maths goes through the kit's
 * split engine via summarise(), in cents.
 */

import { loadScan, getSample, receiptHTML, ensureReceiptStyles } from '../../_kit/receipts.js';
import { PEOPLE, CATEGORIES, summarise } from './data.js';
import { shareText, splitPeople, isExtra } from './split-editor.js';
import { money, bankAmt, esc, avatar, tweenMoney, ICON, listNames, reduced, whenVisible, sleep } from './util.js';

const MOBILE_LINES = 5;

/* The kit's rent sample is dated November; the page's story is October. Patch the paper copy only. */
function paperFor(id, raw) {
  const sample = getSample(id);
  if (id !== 'monthly-rent') return { raw, sample };
  const r = JSON.parse(JSON.stringify(raw));
  r.receipt.storeInformation.dateTimeOfPurchase = '2026-10-01';
  if (r.receipt.items?.[0]) r.receipt.items[0].name = 'RENT OCTOBER';
  return {
    raw: r,
    sample: { ...sample, print: { ...sample.print, register: 'STATEMENT  OCT 2026', footer: ['PAID IN FULL, THANK YOU', 'NEXT STATEMENT NOV 1'] } },
  };
}

export function initSnapSplit(root, scenarioFor) {
  ensureReceiptStyles();
  const $ = (s) => root.querySelector(s);
  const picks = [...root.querySelectorAll('[data-sample]')];
  const paper = $('[data-paper]');
  const paperTag = $('[data-paper-tag]');
  const list = $('[data-items]');
  const status = $('[data-status]');
  const foot = $('[data-foot]');
  const more = $('[data-more]');
  const live = $('[data-live]');
  const peopleEl = $('[data-people]');
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

  function rowHTML(it, res) {
    const extra = isExtra(it);
    const c = CATEGORIES[it.category] || CATEGORIES.other;
    const who = extra ? [] : splitPeople(items[it.index].split, order);
    const faces = order.length > 1 && !extra
      ? `<span class="ss-who" role="group" aria-label="Who had ${esc(it.name)}">${order.map((id) => avatar(PEOPLE[id], { pressed: who.includes(id), label: `${PEOPLE[id].name} on ${it.name}` })).join('')}</span>`
      : '<span class="ss-who"></span>';
    return `<li class="ss-item${extra ? ' is-extra' : ''}" data-i="${it.index}" style="--c:${extra ? '#94a3b8' : c.color}">
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
    return order.map((id) => {
      const cents = res.people[id]?.cents || 0;
      return `<li class="${id === 'you' ? 'is-you' : ''}" data-id="${id}">${avatar(PEOPLE[id], { size: 'sm' })}<span class="sp-name">${id === 'you' ? 'You' : esc(PEOPLE[id].name)}</span><b class="money" data-cents="${cents}">${money(cents)}</b></li>`;
    }).join('');
  }

  function oweText(sum) {
    const others = order.filter((id) => id !== 'you').map((id) => PEOPLE[id].name);
    if (sc.payer === 'you' && sum.owedToYou) return `${esc(listNames(others))} owe${others.length === 1 ? 's' : ''} you <b class="money" data-owe>${money(sum.owedToYou)}</b>`;
    if (sc.payer !== 'you') return `You owe ${esc(PEOPLE[sc.payer].name)} <b class="money" data-owe>${money(sum.youOwe)}</b>`;
    return 'All yours. Nobody owes anybody.';
  }

  function render() {
    order = sc.people;
    const sum = summarise(sc, bill());
    const res = sum.result;
    const taxCents = res.items.reduce((a, it) => a + (it.taxCents || 0), 0);
    const nLines = res.items.filter((it) => !isExtra(it)).length;
    list.innerHTML = res.items.map((it) => rowHTML(it, res)).join('');
    peopleEl.innerHTML = peopleHTML(res);
    root.classList.toggle('is-solo', order.length === 1);
    sumBank.textContent = sc.bank ? `${sc.bank.date} ${sc.bank.merchant}` : `NOT ON YOUR STATEMENT · ${PEOPLE[sc.payer].name.toUpperCase()} PAID`;
    sumBankAmt.textContent = sc.bank ? bankAmt(res.totalCents) : '';
    sumMine.dataset.cents = String(sum.mine);
    sumMine.textContent = money(sum.mine);
    const extras = res.items.filter(isExtra).map((it) => it.name.toLowerCase());
    const plus = [taxCents ? 'tax' : '', ...extras].filter(Boolean);
    foot.innerHTML = `
      <dl class="ss-sums">
        ${taxCents ? `<div class="ss-tax"><dt>Tax</dt><dd class="money"><span class="ss-read">${money(taxCents)}</span><span class="ss-split">In the line prices above</span></dd></div>` : ''}
        <div class="ss-total"><dt>Total</dt><dd class="money">${money(res.totalCents)}</dd></div>
      </dl>
      <p class="ss-check">${ICON.check}<span class="ss-read">${nLines} lines${plus.length ? ` plus ${plus.join(' and ')}` : ''} add up to ${money(res.totalCents)}.</span><span class="ss-split">${order.length > 1 ? 'Everyone&rsquo;s shares add' : 'Your lines add'} up to <b class="money" data-check>${money(res.totalCents)}</b>, to the cent.</span></p>
      <div class="ss-end"><p class="ss-owe" data-owe-line>${oweText(sum)}</p><button type="button" class="btn btn-quiet btn-sm" data-reset>Reset</button></div>`;
    const hidden = res.items.length - MOBILE_LINES;
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
      if (each.textContent !== txt) { each.textContent = txt; each.classList.remove('flash'); void each.offsetWidth; each.classList.add('flash'); }
      if (!isExtra(it)) {
        const who = splitPeople(items[it.index].split, order);
        li.querySelectorAll('.av').forEach((b) => b.setAttribute('aria-pressed', String(who.includes(b.dataset.id))));
      }
    });
    order.forEach((id) => tweenMoney(peopleEl.querySelector(`[data-id="${id}"] b`), res.people[id]?.cents || 0));
    tweenMoney(sumMine, sum.mine);
    foot.querySelector('[data-check]').textContent = money(res.totalCents);
    foot.querySelector('[data-owe-line]').innerHTML = oweText(sum);
    live.textContent = order.map((id) => `${PEOPLE[id].name} ${money(res.people[id]?.cents || 0)}`).join(', ');
  }

  /* the read: rows fade in as their paper line lights up; the paper scrolls to follow */
  function follow(line) {
    const view = paper.parentElement;
    const max = Math.max(0, paper.scrollHeight - view.clientHeight);
    const y = Math.min(max, Math.max(0, line.offsetTop - view.clientHeight * 0.4));
    paper.style.transform = `translateY(${-y}px)`;
  }

  async function read(id) {
    const rows = [...list.children];
    const lines = [...paper.querySelectorAll('.tz-r-line')];
    if (reduced()) { setPhase('split'); return; }
    setPhase('read');
    rows.forEach((r) => r.classList.add('is-pending'));
    sumMine.textContent = '…';
    status.textContent = 'Reading every line';
    await sleep(350);
    for (let k = 0; k < rows.length; k += 1) {
      if (id !== run) return;
      const r = rows[k];
      const line = lines.find((l) => Number(l.dataset.index) === Number(r.dataset.i));
      lines.forEach((l) => l.classList.toggle('is-active', l === line));
      if (line) follow(line);
      r.classList.remove('is-pending');
      await sleep(r.classList.contains('is-extra') ? 260 : 170);
    }
    if (id !== run) return;
    lines.forEach((l) => l.classList.remove('is-active'));
    status.textContent = 'Checking the math';
    await sleep(600);
    if (id !== run) return;
    paper.style.transform = '';
    setPhase('split');
    const sum = summarise(sc, bill());
    tweenMoney(sumMine, sum.mine, { from: sum.total, dur: 900 });
    status.textContent = order.length > 1 ? 'Tap a face to take someone off a line.' : 'All yours, sorted by what it was.';
  }

  async function load(id, { play = true } = {}) {
    const my = ++run;
    sampleId = id;
    expanded = false;
    picks.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.sample === id)));
    const [raw, scenario] = await Promise.all([loadScan(id), scenarioFor(id)]);
    if (my !== run) return;
    sc = scenario;
    items = sc.bill.items.map((it) => ({ ...it, split: it.split ? JSON.parse(JSON.stringify(it.split)) : { type: 'equal', people: sc.people } }));
    const p = paperFor(id, raw);
    paper.innerHTML = receiptHTML(p.raw, { sample: p.sample });
    paper.querySelector('.tz-r-foot p')?.remove(); // its unit count ("ITEMS 19") reads as a mismatch next to the line count
    paper.style.transform = '';
    paperTag.textContent = `${sc.itemCount} lines`;
    render();
    status.textContent = order.length > 1 ? 'Tap a face to take someone off a line.' : 'All yours, sorted by what it was.';
    setPhase('split');
    if (play) await read(my);
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) { load(sampleId, { play: false }); return; }
    const b = e.target.closest('.ss-who .av');
    if (!b || root.dataset.phase !== 'split') return;
    const li = b.closest('.ss-item');
    const it = items[Number(li.dataset.i)];
    const id = b.dataset.id;
    const who = splitPeople(it.split, order);
    const next = who.includes(id) ? who.filter((x) => x !== id) : order.filter((x) => x === id || who.includes(x));
    if (next.length === 0) {
      live.textContent = 'Someone has to have it. Add another person first.';
      status.textContent = 'Someone has to have it. Add another person first.';
      b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
      return;
    }
    it.split = { type: 'equal', people: next };
    update();
  });
  more.addEventListener('click', () => {
    expanded = true;
    list.classList.remove('is-clipped');
    more.hidden = true;
    list.children[MOBILE_LINES]?.querySelector('button, .ss-name')?.focus?.();
  });
  picks.forEach((p) => p.addEventListener('click', () => load(p.dataset.sample)));

  // Static, finished state first; the read plays once when the section is on screen.
  const first = picks.find((p) => p.getAttribute('aria-pressed') === 'true')?.dataset.sample || picks[0].dataset.sample;
  let played = false;
  load(first, { play: false }).then(() => {
    whenVisible(root.querySelector('.snap-grid'), () => { if (!played && sampleId === first) { played = true; read(run); } }, { threshold: 0.3 });
  });

  return {
    load(id) { played = true; return load(id); },
    get summary() { return sc ? summarise(sc, bill()) : null; },
  };
}
