// "Split it with my roommates": a playable itemized split, exact to the cent (kit split engine).
import { $, $$, esc, money, icon, tweenMoney, announce } from './ui.js';
import { getWorld, getSample, PEOPLE, itemName, splitWith, cents } from './world.js';

const BILLS = {
  'green-basket': { payer: 'you', group: 'Flat 3B', order: [13, 9, 10, 11, 12, 0, 1, 2, 3, 4, 5, 6, 7, 8], visible: 4, moreLabel: (n) => `${n} more items` },
  'taqueria-sol': { payer: 'alex', group: 'Thursday dinners', order: [0, 1, 2, 3, 4, 5, 6], visible: 7, moreLabel: (n) => `${n} more items` },
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
    state = { id, s, cfg: BILLS[id], scan: w.scans[id].bill, sets: defaults(id), open: false, settled: 0 };
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
    const more = hidden ? `<button class="show-more" type="button" data-more>${esc(cfg.moreLabel(hidden))}</button>` : '<span></span>';

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
    host.innerHTML = `<div class="panel split-items">${bar}<div data-rows>${rows}${tipRow}</div>
        <div class="split-foot">${more}<button class="reset-link" type="button" data-split-reset>Reset</button></div></div>
      <div class="panel totals" aria-live="off"><h3>${esc(s.title)} · ${esc(cfg.group)}</h3>${people}
        <div class="check-line" data-check>${checkText(r)}</div>
        <div class="settle" data-settle>${settleHtml(r)}</div></div>`;
    $('[data-more]', host)?.addEventListener('click', () => { state.open = true; render(); $(`[data-row="${cfg.order[vis]}"] button`, host)?.focus(); });
  }

  /* The flat's running balance with Maya: this receipt plus the rest of Flat 3B (she paid Netflix).
     Settling up records that she paid you back; Trezzit never moves money. */
  const flatBase = () => (w.net.maya || 0) - (w.scans['green-basket'].split.people.maya?.cents || 0);
  function settleHtml(r) {
    if (state.id !== 'green-basket') return '';
    const owed = flatBase() + r.people.maya.cents;
    if (state.settled) return `<span class="done">${icon('check')}Maya paid you ${money(state.settled)} · recorded</span>`;
    if (owed <= 0) return `<span>Flat 3B: you owe Maya ${money(-owed)}</span>`;
    return `<span>Flat 3B balance: Maya owes you <b class="money">${money(owed)}</b></span><button type="button" class="settle-btn" data-settle-up data-owed="${owed}">Settle up</button>`;
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
    state.settled = 0;
    const st = $('[data-settle]', host); if (st) st.innerHTML = settleHtml(r);
    const ch = $('[data-check]', host);
    ch.innerHTML = checkText(r); ch.classList.toggle('bad', !r.check.ok);
    announce(state.s.people.map((p) => `${p === 'you' ? 'You' : PEOPLE[p].name} ${money(r.people[p].cents)}`).join(', ') + `. Adds up to ${money(r.check.sumCents)}.`);
  }

  host.addEventListener('click', (e) => {
    if (e.target.closest('[data-split-reset]')) { load(state.id); $('[data-split-reset]', host)?.focus(); return; }
    const su = e.target.closest('[data-settle-up]');
    if (su) {
      state.settled = Number(su.dataset.owed);
      $('[data-settle]', host).innerHTML = settleHtml(compute());
      announce(`Recorded: Maya paid you ${money(state.settled)}.`);
      return;
    }
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
