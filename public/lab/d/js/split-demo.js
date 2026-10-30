// "Split it with my roommates": a playable itemized split, exact to the cent (kit split engine).
import { $, $$, esc, money, icon, tweenMoney, announce } from './ui.js';
import { getWorld, getSample, PEOPLE, itemName, splitWith } from './world.js';

// Four curated rows are the demo; the rest of the receipt is one quiet line, never a wall of avatars.
const BILLS = {
  'green-basket': { payer: 'you', group: 'Flat 3B', thumb: 'assets/thumb-green-basket.webp', photo: 'assets/receipt-green-basket.webp', order: [13, 9, 10, 11, 12, 0, 1, 2, 3, 4, 5, 6, 7, 8], visible: 4 },
  'taqueria-sol': { payer: 'alex', group: 'Dinner crew', thumb: 'assets/thumb-taqueria.webp', order: [0, 1, 2, 3, 4, 5, 6], visible: 7 },
};
// The same rows up front at every width (so "10 more items" never changes with the screen).
const visibleRows = (cfg) => cfg.visible;

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

  /** A sub-line only when an item is shared: "4 ways · $8.00 each", "You, Maya · $1.88 · $1.87".
      One owner needs no line: the filled avatar and the price already say it. */
  function metaFor(it) {
    const ids = Object.keys(it.shares).filter((k) => it.shares[k]);
    if (ids.length < 2) return '';
    const all = state.s.people.length;
    const nm = (k) => (k === 'you' ? 'You' : PEOPLE[k].name);
    const vals = ids.map((k) => it.shares[k]);
    const same = vals.every((v) => v === vals[0]);
    if (ids.length === all && same) return `${all} ways · ${money(vals[0])} each`;
    return same ? `${ids.map(nm).join(', ')} · ${money(vals[0])} each` : `${ids.map(nm).join(', ')} · ${vals.map((v) => money(v)).join(' · ')}`;
  }

  function render() {
    const r = compute();
    const { cfg, s } = state;
    const vis = visibleRows(cfg);
    const shown = cfg.order.slice(0, vis);
    const rows = shown.map((i) => {
      const it = r.items.find((x) => x.index === i);
      // One tab stop per row; arrow keys move between people (toolbar pattern).
      const chips = s.people.map((p, k) => {
        const P = PEOPLE[p]; const on = state.sets[i].has(p);
        return `<button type="button" tabindex="${k ? -1 : 0}" aria-pressed="${on}" data-i="${i}" data-p="${p}" aria-label="${esc(P.name)}"><span style="--c:${P.color}">${p === 'you' ? 'You' : P.initials}</span></button>`;
      }).join('');
      return `<div class="sitem" data-row="${i}"><span class="nm">${esc(itemName(it.name))}</span><span class="pr money">${money(it.totalCents)}</span><span class="meta" data-meta="${i}">${esc(metaFor(it))}</span><span class="who" role="toolbar" aria-label="Who shares ${esc(itemName(it.name))}">${chips}</span></div>`;
    }).join('');
    const tip = r.items.find((x) => x.itemType === 'Tip');
    const tipRow = tip ? `<div class="sitem extra"><span class="nm">Tip</span><span class="pr money">${money(tip.totalCents)}</span><span class="meta" data-meta="tip">${esc(tipMeta(tip))}</span></div>` : '';
    // The scan is where the rows came from: the receipt heads the list, and its photo opens.
    const nItems = r.items.filter((x) => x.itemType !== 'Tip').length;
    const head = `<div class="split-head"><img src="${cfg.thumb}" alt="" width="40" height="58"><span class="t"><b>${esc(s.title)}</b><span>Scanned · ${nItems} items</span></span>${cfg.photo ? `<button class="rcpt-btn" type="button" data-photo aria-haspopup="dialog">Receipt</button>` : ''}</div>`;

    const payer = cfg.payer;
    // "Owes you" is said once, as a label over the people who owe the payer.
    const row = (p) => {
      const P = PEOPLE[p]; const c = r.people[p].cents;
      let sub = '';
      if (p === 'you') sub = payer === 'you' ? `Paid ${money(r.totalCents)}` : `You owe ${PEOPLE[payer].name}`;
      else if (p === payer) sub = `Paid ${money(r.totalCents)}`;
      return `<div class="prow${p === 'you' ? ' you' : ''}"><span class="av" style="--c:${P.color}">${p === 'you' ? 'You' : P.initials}</span><span class="nm">${p === 'you' ? 'Your share' : esc(P.name)}${sub ? `<small>${sub}</small>` : ''}</span><span class="amt money" data-amt="${p}" data-cents="${c}">${money(c)}</span></div>`;
    };
    const owers = s.people.filter((p) => p !== payer);
    const people = `<div class="prows">${row(payer === 'you' ? 'you' : payer)}${payer === 'you' ? '' : row('you')}
      <div class="plabel">${payer === 'you' ? 'Owes you' : `Owes ${esc(PEOPLE[payer].name)}`}</div>${owers.filter((p) => p !== 'you').map(row).join('')}</div>`;

    // Phones: one slim line of shares heads the list, so every cent moves right above where you tap.
    const bar = `<div class="sbar" aria-hidden="true"><span class="sbar-row">${s.people.map((p) => `<span class="sp" data-sp="${p}"><span class="av" style="--c:${PEOPLE[p].color}">${p === 'you' ? 'You' : PEOPLE[p].initials}</span><b class="money" data-samt="${p}" data-cents="${r.people[p].cents}">${money(r.people[p].cents)}</b></span>`).join('')}</span></div>`;
    host.innerHTML = `<div class="panel split-items">${head}${bar}<div data-rows>${rows}${tipRow}</div>
        <div class="split-foot"><span class="check-line sm" data-check aria-hidden="true">${checkText(r)}</span><button class="reset-link" type="button" data-split-reset>Reset</button></div></div>
      <div class="panel totals" aria-live="off"><h3>${esc(cfg.group)}</h3>${people}
        <div class="check-line" data-check>${checkText(r)}</div></div>`;
  }

  /* The October list below is the same list: tell it when this receipt's split changes. */
  function publish(r) {
    if (state.id === 'green-basket') document.dispatchEvent(new CustomEvent('d:split', { detail: { id: state.id, split: r } }));
  }

  function tipMeta(tip) {
    const parts = Object.entries(tip.shares).filter(([, c]) => c).map(([k, c]) => `${k === 'you' ? 'You' : PEOPLE[k].name} ${money(c)}`);
    return `By what each person ordered · ${parts.join(' · ')}`;
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
    publish(r);
    $$('[data-check]', host).forEach((ch) => { ch.innerHTML = checkText(r); ch.classList.toggle('bad', !r.check.ok); });
    announce(state.s.people.map((p) => `${p === 'you' ? 'You' : PEOPLE[p].name} ${money(r.people[p].cents)}`).join(', ') + `. Adds up to ${money(r.check.sumCents)}.`);
  }

  /* The receipt photo the rows were read from, in a dialog (built once, on first open). */
  let dlg;
  function showPhoto(from) {
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.className = 'rcpt-dlg';
      dlg.setAttribute('aria-label', 'Receipt photo');
      dlg.innerHTML = `<img src="${state.cfg.photo}" alt="Green Basket Market receipt: 14 items, total $100.00" width="600" height="1409"><form method="dialog"><button class="btn btn-primary" type="submit">Close</button></form>`;
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', () => dlg._from?.focus({ preventScroll: true }));
      document.body.appendChild(dlg);
    }
    dlg._from = from;
    dlg.showModal();
  }

  host.addEventListener('click', (e) => {
    const ph = e.target.closest('[data-photo]');
    if (ph) { showPhoto(ph); return; }
    if (e.target.closest('[data-split-reset]')) { load(state.id); publish(compute()); $('[data-split-reset]', host)?.focus(); return; }
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

  load('green-basket');
  // "Scan it.": the first time the card comes into view, its rows come off the receipt one by one
  // (nothing is hidden before that, so the card is never empty in a capture or without script).
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const card = $('.split-items', host);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      card.classList.add('scan-in');
      setTimeout(() => card.classList.remove('scan-in'), 1400);
    }, { rootMargin: '0px 0px -12% 0px' });
    if (card) io.observe(card);
  }
  // From the scan's "Split it": load that bill and put keyboard focus on its first row, where the tapping starts.
  return {
    show: (id) => {
      if (!BILLS[id]) return;
      load(id);
      // After the link's own jump to #split, which would otherwise reset focus.
      setTimeout(() => $('.who button[tabindex="0"]', host)?.focus({ preventScroll: true }), 0);
    },
  };
}
