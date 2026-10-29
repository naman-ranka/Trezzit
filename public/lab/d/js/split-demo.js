// "Split it with my roommates": a playable itemized split, exact to the cent (kit split engine).
import { $, $$, esc, money, icon, tweenMoney, announce } from './ui.js';
import { getWorld, getSample, PEOPLE, catOf, itemName, splitWith, cents, tone } from './world.js';

const BILLS = {
  'green-basket': { payer: 'you', group: 'Flat 3B', order: [13, 9, 10, 11, 12, 0, 1, 2, 3, 4, 5, 6, 7, 8], visible: 5, moreLabel: (n) => `${n} more items` },
  'taqueria-sol': { payer: 'alex', group: 'Thursday dinners', order: [0, 1, 2, 3, 4, 5, 6], visible: 7, moreLabel: (n) => `${n} more items` },
};
// Phones show fewer rows up front; the rest is one tap away.
const visibleRows = (cfg) => (matchMedia('(max-width: 520px)').matches ? Math.min(4, cfg.visible) : cfg.visible);

export async function initSplit() {
  const host = document.querySelector('[data-split]');
  if (!host) return null;
  const w = await getWorld();
  const tabs = $$('[data-bill]');
  let state;

  function defaults(id) {
    const s = getSample(id);
    return s.lines.map((l) => new Set(l.split.type === 'equal' ? l.split.people : Object.keys(l.split.shares || l.split.percents || l.split.amounts || {})));
  }

  function load(id) {
    const s = getSample(id);
    state = { id, s, cfg: BILLS[id], scan: w.scans[id].bill, sets: defaults(id), open: false };
    tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.bill === id)));
    render();
  }

  const compute = () => splitWith(state.id, state.scan, state.s.people, state.sets);

  function metaFor(it) {
    const ids = Object.keys(it.shares).filter((k) => it.shares[k]);
    const all = state.s.people.length;
    // One person: the filled avatar already says it.
    if (ids.length === 1) return '';
    const vals = ids.map((k) => it.shares[k]);
    const same = vals.every((v) => v === vals[0]);
    if (ids.length === all && same) return `${money(vals[0])} each`;
    const who = ids.map((k) => (k === 'you' ? 'You' : PEOPLE[k].name)).join(', ');
    return same ? `${who} · ${money(vals[0])} each` : `${who} · ${vals.map((v) => money(v)).join(' · ')}`;
  }

  function render() {
    const r = compute();
    const { cfg, s } = state;
    const vis = visibleRows(cfg);
    const shown = state.open ? cfg.order : cfg.order.slice(0, vis);
    const hidden = cfg.order.length - shown.length;
    const rows = shown.map((i) => {
      const it = r.items.find((x) => x.index === i);
      // One tab stop per row; arrow keys move between people (toolbar pattern).
      const chips = s.people.map((p, k) => {
        const P = PEOPLE[p]; const on = state.sets[i].has(p);
        return `<button type="button" tabindex="${k ? -1 : 0}" aria-pressed="${on}" data-i="${i}" data-p="${p}" aria-label="${esc(P.name)}"><span style="--c:${P.color}">${p === 'you' ? 'You' : P.initials}</span></button>`;
      }).join('');
      // A taxed line shows where its price came from, so it matches the paper receipt.
      const line = state.scan.items[i]; const tax = cents(line.taxAmount || 0);
      const note = tax ? `<small class="tx">${money(cents(line.amount))} + ${money(tax)} tax</small>` : '';
      return `<div class="sitem" data-row="${i}"><span class="nm">${esc(itemName(it.name))}${note}</span><span class="pr money">${money(it.totalCents)}</span><span class="meta" data-meta="${i}">${esc(metaFor(it))}</span><span class="who" role="toolbar" aria-label="Who shares ${esc(itemName(it.name))}">${chips}</span></div>`;
    }).join('');
    const tip = r.items.find((x) => x.itemType === 'Tip');
    const tipRow = tip ? `<div class="sitem extra"><span class="nm">Tip</span><span class="pr money">${money(tip.totalCents)}</span><span class="meta" data-meta="tip">${esc(tipMeta(tip))}</span></div>` : '';
    const more = hidden ? `<button class="show-more" type="button" data-more>${esc(cfg.moreLabel(hidden))}</button>` : '';

    const payer = cfg.payer;
    const people = s.people.map((p) => {
      const P = PEOPLE[p]; const c = r.people[p].cents;
      let sub = '';
      if (p === 'you') sub = payer === 'you' ? `Paid ${money(r.totalCents)}` : `You owe ${PEOPLE[payer].name}`;
      else if (p === payer) sub = `Paid ${money(r.totalCents)}`;
      else sub = payer === 'you' ? 'Owes you' : `Owes ${PEOPLE[payer].name}`;
      const cls = p === 'you' ? (payer === 'you' ? '' : 'out') : (payer === 'you' ? 'in' : '');
      return `<div class="prow${p === 'you' ? ' you' : ''}"><span class="av" style="--c:${P.color}">${p === 'you' ? 'You' : P.initials}</span><span class="nm">${p === 'you' ? 'Your share' : esc(P.name)}<small class="${cls}">${sub}</small></span><span class="amt money" data-amt="${p}" data-cents="${c}">${money(c)}</span></div>`;
    }).join('');

    // Phones: one slim line of shares sticks to the bottom while you tap, so every cent moves where you look.
    const bar = `<div class="sbar" aria-hidden="true"><span class="sbar-row">${s.people.map((p) => `<span class="sp" data-sp="${p}"><span class="av" style="--c:${PEOPLE[p].color}">${p === 'you' ? 'You' : PEOPLE[p].initials}</span><b class="money" data-samt="${p}" data-cents="${r.people[p].cents}">${money(r.people[p].cents)}</b></span>`).join('')}</span></div>`;
    host.innerHTML = `<div class="panel split-items"><div data-rows>${rows}${tipRow}</div>${more}${bar}</div>
      <div class="panel totals" aria-live="off"><h3>${esc(s.title)} · ${esc(cfg.group)}</h3>${people}
        <div class="youcats" data-youcats>${youCats(r)}</div>
        <div class="check-line" data-check>${checkText(r)}</div></div>`;
    watchBar();
    $('[data-more]', host)?.addEventListener('click', () => { state.open = true; render(); $(`[data-row="${cfg.order[vis]}"] button`, host)?.focus(); });
  }

  // Phones: the totals bar fades in only once the item list is well into view.
  let io;
  function watchBar() {
    io?.disconnect();
    const list = $('.split-items', host);
    if (!list || !('IntersectionObserver' in window)) { list?.classList.add('bar-on'); return; }
    io = new IntersectionObserver(([e]) => {
      const vis = e.intersectionRect.height / Math.min(e.boundingClientRect.height, innerHeight);
      list.classList.toggle('bar-on', e.isIntersecting && vis >= 0.3);
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1] });
    io.observe(list);
  }

  function tipMeta(tip) {
    const parts = Object.entries(tip.shares).filter(([, c]) => c).map(([k, c]) => `${k === 'you' ? 'You' : PEOPLE[k].name} ${money(c)}`);
    return `By what each person ordered · ${parts.join(' · ')}`;
  }
  function youCats(r) {
    const cats = Object.entries(r.people.you.byCategory).filter(([, c]) => c > 0).map(([id, cents]) => ({ cents, ...catOf(id) }))
      .sort((a, b) => b.cents - a.cents).map((c, i) => ({ ...c, color: tone(i) }));
    if (!cats.length) return '';
    return `<div class="catbar" aria-hidden="true">${cats.map((c) => `<i style="flex-grow:${c.cents};background:${c.color}"></i>`).join('')}</div>
      <div class="legend">${cats.map((c) => `<span><i style="background:${c.color}"></i>${esc(c.label)} <b class="money">${money(c.cents)}</b></span>`).join('')}</div>`;
  }
  function checkText(r) {
    return r.check.ok ? `${icon('check')}Adds up to ${money(r.totalCents)}` : `Adds up to ${money(r.check.sumCents)}, not ${money(r.totalCents)}`;
  }

  function update() {
    const r = compute();
    r.items.forEach((it) => {
      const m = $(`[data-meta="${it.itemType === 'Tip' ? 'tip' : it.index}"]`, host);
      if (m) m.textContent = it.itemType === 'Tip' ? tipMeta(it) : metaFor(it);
    });
    state.s.people.forEach((p) => {
      tweenMoney($(`[data-amt="${p}"]`, host), r.people[p].cents);
      const b = $(`[data-samt="${p}"]`, host);
      if (b && Number(b.dataset.cents) !== r.people[p].cents) {
        const sp = b.parentElement; sp.classList.remove('pulse'); void sp.offsetWidth; sp.classList.add('pulse');
      }
      tweenMoney(b, r.people[p].cents);
    });
    $('[data-youcats]', host).innerHTML = youCats(r);
    const ch = $('[data-check]', host);
    ch.innerHTML = checkText(r); ch.classList.toggle('bad', !r.check.ok);
    announce(state.s.people.map((p) => `${p === 'you' ? 'You' : PEOPLE[p].name} ${money(r.people[p].cents)}`).join(', ') + `. Adds up to ${money(r.check.sumCents)}.`);
  }

  host.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-p]');
    if (!b) return;
    $$('button', b.parentElement).forEach((x) => { x.tabIndex = x === b ? 0 : -1; });
    const i = Number(b.dataset.i); const p = b.dataset.p; const set = state.sets[i];
    const meta = $(`[data-meta="${i}"]`, host);
    if (set.has(p) && set.size === 1) {
      // Said in the row you tapped, not in a panel that may be off screen.
      const grp = b.parentElement; grp.classList.remove('shake'); void grp.offsetWidth; grp.classList.add('shake');
      meta.textContent = 'Someone has to have it. Tap another person first.'; meta.classList.add('warn');
      announce(meta.textContent);
      clearTimeout(meta._t);
      meta._t = setTimeout(() => { meta.classList.remove('warn'); const it = compute().items.find((x) => x.index === i); if (it) meta.textContent = metaFor(it); }, 2200);
      return;
    }
    clearTimeout(meta._t); meta.classList.remove('warn');
    if (set.has(p)) set.delete(p); else set.add(p);
    b.setAttribute('aria-pressed', String(set.has(p)));
    update();
  });
  host.addEventListener('keydown', (e) => {
    const b = e.target.closest('.who button');
    if (!b) return;
    const all = $$('button', b.parentElement); const k = all.indexOf(b);
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const n = e.key === 'Home' ? all[0] : e.key === 'End' ? all[all.length - 1] : d ? all[(k + d + all.length) % all.length] : null;
    if (!n) return;
    e.preventDefault();
    all.forEach((x) => { x.tabIndex = x === n ? 0 : -1; });
    n.focus();
  });
  tabs.forEach((t) => t.addEventListener('click', () => load(t.dataset.bill)));
  $('[data-split-reset]')?.addEventListener('click', () => load(state.id));

  load('green-basket');
  return { show: (id) => { if (BILLS[id]) load(id); } };
}
