/**
 * snap-split.js: "Split it by the item." One receipt (Taqueria Sol). One panel: the receipt is read line by
 * line into a list, then each line gets its faces and the list becomes the
 * split. Every row is in the DOM from the start (pending rows show as quiet
 * placeholders), so nothing below moves while it plays. All maths goes
 * through the kit's split engine via summarise(), in cents.
 *
 * The read starts as soon as the card edges on screen and always finishes in
 * about 1.2 s: it is driven by elapsed time, so a throttled timer or a quick
 * scroll can only make it jump ahead, never stall half-built. When it ends the
 * final numbers appear at once (no count-up), so every figure on screen
 * agrees with every other at every frame.
 */

import { loadScan, getSample, receiptHTML, ensureReceiptStyles } from '../../_kit/receipts.js';
import { PEOPLE, CATEGORIES, summarise } from './data.js';
import { shareText, splitPeople, isExtra, whoHTML, updateStack, openLine, toggleSplit } from './split-editor.js';
import { money, esc, avatar, ICON, listNames, reduced, whenVisible } from './util.js';

const SHOWN_LINES = 5;
const READ_MS = 1000; // all rows, whatever the receipt length
const CHECK_MS = 200; // "Checking the math" before the split shows

export function initSnapSplit(root, scenarioFor) {
  ensureReceiptStyles();
  const $ = (s) => root.querySelector(s);
  const card = $('[data-card]');
  const paper = $('[data-paper]');
  const paperTag = $('[data-paper-tag]');
  const list = $('[data-items]');
  const foot = $('[data-foot]');
  const more = $('[data-more]');
  const live = $('[data-live]');
  const peopleEl = $('[data-people]');
  const progress = $('[data-progress]');
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
        <small class="ss-split" data-each>${subHTML(it)}</small></span>
      ${faces}
      <span class="ss-price money"><span class="ss-read">${money(it.totalCents - (it.taxCents || 0))}</span><span class="ss-split">${money(it.totalCents)}</span></span>
    </li>`;
  }

  /* "$8.00 each · incl. $2.37 tax"; the tax part drops on narrow phones so the line never wraps. */
  function subHTML(it) {
    if (isExtra(it)) return order.length > 1 ? 'In proportion to each share' : 'All yours';
    const share = order.length > 1 ? shareText(it.shares, order) : (CATEGORIES[it.category] || CATEGORIES.other).label;
    return esc(share) + (it.taxCents ? `<span class="ss-tax"> · incl. ${money(it.taxCents)} tax</span>` : '');
  }

  function peopleHTML(res) {
    return others().map((id) => {
      const cents = res.people[id]?.cents || 0;
      return `<li data-id="${id}">${avatar(PEOPLE[id], { size: 'sm' })}<span class="sp-name">${esc(PEOPLE[id].name)}</span><b class="money" data-cents="${cents}">${money(cents)}</b></li>`;
    }).join('');
  }

  function oweText(sum) {
    // Only the people who still have a share owe anything.
    const names = others().filter((id) => sum.result.people[id]?.cents > 0).map((id) => PEOPLE[id].name);
    if (sc.payer === 'you' && !names.length) return 'All yours. Nobody owes anybody.';
    if (sc.payer === 'you' && sum.owedToYou) return `${esc(listNames(names))} owe${names.length === 1 ? 's' : ''} you <b class="money" data-owe>${money(sum.owedToYou)}</b>`;
    if (sc.payer !== 'you') return `You owe ${esc(PEOPLE[sc.payer].name)} <b class="money" data-owe>${money(sum.youOwe)}</b>`;
    return 'All yours. Nobody owes anybody.';
  }

  function render() {
    order = sc.people;
    const sum = summarise(sc, bill());
    const res = sum.result;
    // The lines that explain the shares lead (sc.lead); the rest follow in receipt order.
    const lead = sc.lead || [];
    const shown = [...lead.map((i) => res.items.find((it) => it.index === i && !isExtra(it))).filter(Boolean),
      ...res.items.filter((it) => isExtra(it) || !lead.includes(it.index))];
    const openAt = sc.open ?? shown.find((it) => !isExtra(it))?.index;
    list.innerHTML = shown.map((it) => rowHTML(it, !isExtra(it) && it.index === openAt)).join('');
    peopleEl.innerHTML = peopleHTML(res);
    root.classList.toggle('is-solo', order.length === 1);
    sumMine.dataset.cents = String(sum.mine);
    sumMine.textContent = money(sum.mine);
    foot.innerHTML = `
      <div class="ss-total"><span>Total</span><b class="money">${money(res.totalCents)}</b></div>
      <p class="ss-check">${ICON.check}<span class="ss-read" data-read-status>Reading the receipt</span><span class="ss-split">Adds up to the cent.</span></p>
      <div class="ss-end"><p class="ss-owe" data-owe-line>${oweText(sum)}</p><button type="button" class="btn btn-quiet btn-sm" data-reset>Reset</button></div>`;
    const hidden = res.items.length - SHOWN_LINES;
    list.classList.toggle('is-clipped', hidden > 0 && !expanded);
    more.hidden = !(hidden > 0 && !expanded);
    more.textContent = 'Show all';
  }

  function update() {
    const sum = summarise(sc, bill());
    const res = sum.result;
    res.items.forEach((it) => {
      const li = list.querySelector(`.ss-item[data-i="${it.index}"]`);
      if (!li) return;
      const each = li.querySelector('[data-each]');
      const html = subHTML(it);
      clearTimeout(Number(each.dataset.t || 0));
      each.classList.remove('is-warn');
      if (each.innerHTML !== html) { each.innerHTML = html; each.classList.remove('flash'); void each.offsetWidth; each.classList.add('flash'); }
      if (!isExtra(it)) {
        const who = splitPeople(items[it.index].split, order);
        li.querySelectorAll('.who-toggles .av').forEach((b) => b.setAttribute('aria-pressed', String(who.includes(b.dataset.id))));
        updateStack(li, order, who);
      }
    });
    others().forEach((id) => setMoney(peopleEl.querySelector(`[data-id="${id}"] b`), res.people[id]?.cents || 0));
    setMoney(sumMine, sum.mine);
    foot.querySelector('[data-owe-line]').innerHTML = oweText(sum);
    live.textContent = order.map((id) => `${PEOPLE[id].name} ${money(res.people[id]?.cents || 0)}`).join(', ');
  }

  /* A changed figure is set in the same frame as every other figure and flashes once. */
  function setMoney(node, cents) {
    if (!node) return;
    const changed = node.dataset.cents !== String(cents);
    node.dataset.cents = String(cents);
    node.textContent = money(cents);
    if (changed && !reduced()) { node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash'); }
  }

  /* ---------- the read ---------- */
  function follow(line) {
    const view = paper.parentElement;
    const max = Math.max(0, paper.scrollHeight - view.clientHeight);
    const y = Math.min(max, Math.max(0, line.offsetTop - view.clientHeight * 0.4));
    paper.style.transform = `translateY(${-y}px)`;
  }

  /* Pending: rows are placeholders, amounts are "…", nothing claims a result yet. */
  function pending() {
    setPhase('read');
    [...list.children].forEach((r) => r.classList.add('is-pending'));
    sumMine.textContent = '…';
    peopleEl.querySelectorAll('b').forEach((b) => { b.textContent = '…'; });
    progress.style.setProperty('--p', '0');
  }

  /* Finished: every figure lands in the same frame (the card fades them in together). */
  function finish({ animate = true } = {}) {
    paper.querySelectorAll('.tz-r-line.is-active').forEach((l) => l.classList.remove('is-active'));
    paper.style.transform = '';
    [...list.children].forEach((r) => r.classList.remove('is-pending'));
    const sum = summarise(sc, bill());
    sumMine.dataset.cents = String(sum.mine);
    sumMine.textContent = money(sum.mine);
    others().forEach((id) => {
      const b = peopleEl.querySelector(`[data-id="${id}"] b`);
      const c = sum.result.people[id]?.cents || 0;
      b.dataset.cents = String(c);
      b.textContent = money(c);
    });
    setPhase('split');
    progress.style.setProperty('--p', '0');
    if (animate && !reduced()) {
      card.classList.remove('is-landing'); void card.offsetWidth; card.classList.add('is-landing');
      hint();
    }
  }

  /* The read is a function of elapsed time: each tick shows every row that is due. */
  function read(id) {
    if (reduced()) { finish({ animate: false }); return; }
    pending();
    const rows = [...list.children];
    const lines = [...paper.querySelectorAll('.tz-r-line')];
    const status = foot.querySelector('[data-read-status]');
    const n = rows.length;
    const t0 = performance.now();
    let shown = 0;
    const tick = () => {
      if (id !== run) return;
      const t = performance.now() - t0;
      const due = Math.min(n, Math.ceil((t / READ_MS) * n));
      for (; shown < due; shown += 1) rows[shown].classList.remove('is-pending');
      if (shown > 0) {
        const r = rows[shown - 1];
        const line = lines.find((l) => Number(l.dataset.index) === Number(r.dataset.i));
        lines.forEach((l) => l.classList.toggle('is-active', l === line));
        if (line) follow(line);
      }
      progress.style.setProperty('--p', String(shown / n));
      if (status) status.textContent = shown < n ? `Reading line ${Math.max(1, shown)} of ${n}` : 'Checking the math';
      if (t >= READ_MS + CHECK_MS) { finish(); return; }
      setTimeout(tick, 40);
    };
    tick();
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
    const [raw, scenario] = await Promise.all([loadScan(id), scenarioFor(id)]);
    if (my !== run) return;
    sc = scenario;
    items = sc.bill.items.map((it) => ({ ...it, split: it.split ? JSON.parse(JSON.stringify(it.split)) : { type: 'equal', people: sc.people } }));
    paper.innerHTML = receiptHTML(raw, { sample: getSample(id) });
    paper.querySelector('.tz-r-foot p')?.remove(); // its unit count ("ITEMS 19") reads as a mismatch next to the line count
    paper.style.transform = '';
    paperTag.textContent = sc.day || '';
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
    each.dataset.t = String(setTimeout(() => { each.classList.remove('is-warn'); if (it) each.innerHTML = subHTML(it); }, 2400));
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

  // Until the list is well on screen it waits as placeholders; then the read plays once.
  const first = root.dataset.sample;
  let played = false;
  load(first, { play: false, wait: !reduced() }).then(() => {
    if (reduced()) return;
    whenVisible(card, () => {
      if (played || sampleId !== first) return;
      played = true;
      read(run);
    }, { threshold: 0.15 });
  });

  return {
    load(id) { played = true; return load(id); },
    get summary() { return sc ? summarise(sc, bill()) : null; },
  };
}
