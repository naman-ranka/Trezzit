/* split-play.js: the /scan/ split, built from the same grid as the landing story, so the act of splitting looks the
 * same everywhere: people across the top with live totals, one dot per person on every line, the shared lines folded
 * into one row, and a footer that ends on what you spent. Tap a dot to add or remove someone from a line; the kit's
 * engine (integer cents, largest remainder) re-splits. Keyboard: the dots are one tab stop; arrows move between them. */
import { PEOPLE, CATEGORIES } from '/assets/_kit/receipts.js';
import { $, $$, esc, money, ICON, avatar } from './util.js';
import { loadModel, compute, lineMembers } from './data.js';
import { toCents } from '/assets/_kit/split-engine.js';

// who paid each sample: dinner is Maya's (the same roommates as the landing story); the rest you paid
const PAYER = { 'taqueria-sol': 'maya' };
const CHEV = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function mountSplit(root, { initial = 'green-basket' } = {}) {
  root.innerHTML = `<div class="story-stage grid-stage is-play" data-step="3" role="group" aria-label="Split this receipt"></div>
    <p class="visually-hidden" aria-live="polite" data-live></p>`;
  const stage = $('.grid-stage', root);
  const live = $('[data-live]', root);
  let model = null;
  let original = null;
  let people = [];
  let folded = [];
  let focusRow = null;
  let fc = 0;
  let announceT = 0;
  let whyT = 0;
  let el = {};

  const items = (r) => r.items;
  const itemAt = (r, i) => items(r).find((x) => x.index === i) || items(r)[i];
  const linesOf = (row) => (row.dataset.lines ? row.dataset.lines.split(',').map(Number) : [+row.dataset.i]);
  const allRows = () => $$('.st-row[data-i], .st-row[data-lines]', stage);
  const visRows = () => allRows().filter((r) => !(el.sub?.hidden && el.sub.contains(r)));
  const edited = () => JSON.stringify(model.lines.map((l) => l.split)) !== JSON.stringify(original.map((l) => l.split));

  async function load(idOrModel) {
    const m = typeof idOrModel === 'string' ? await loadModel(idOrModel) : idOrModel;
    model = { ...m, lines: JSON.parse(JSON.stringify(m.lines)), people: [...m.people] };
    original = JSON.parse(JSON.stringify(model.lines));
    build();
  }

  function build() {
    people = model.people;
    const res = compute(model);
    stage.style.setProperty('--n', people.length);
    // lines everyone shares equally (no tax, not a tip) fold into one row once there are three or more
    const plain = model.lines.filter((l) => !l.extra && !l.taxCents && l.split?.type === 'equal' && lineMembers(l).length === people.length).map((l) => l.index);
    folded = plain.length >= 3 ? plain : [];
    const cats = new Set(folded.map((i) => model.lines[i].category));
    const grpName = cats.size === 1 ? (CATEGORIES[[...cats][0]]?.label || 'Shared') : 'Shared';
    // the same grid semantics as the landing story: a row per line, its name the row header, a cell per person
    const dots = (label) => `<span class="who" role="none">${people.map((p) => `<span class="dc" role="gridcell"><button type="button" class="dot-b" data-p="${p}" aria-label="${esc(label)}: ${esc(PEOPLE[p].name)}" aria-pressed="false" tabindex="-1" style="--c:${PEOPLE[p].color}"><i></i></button></span>`).join('')}</span>`;
    const xcell = '<span class="who who-x" role="gridcell">Follows each share</span>';
    const row = (l, sub = false) => {
      const it = itemAt(res, l.index);
      if (l.extra) return `<div class="st-row st-x" role="row"><span class="nm" role="rowheader">${esc(l.pretty)}</span><span class="money" role="gridcell" data-n="by share">${money(it.totalCents)}</span>${xcell}</div>`;
      return `<div class="st-row${sub ? ' st-subrow' : ''}" role="row" data-i="${l.index}"><span class="nm" role="rowheader">${esc(l.pretty)}${l.taxCents ? ' <small class="tx">with tax</small>' : ''}</span><span class="money" role="gridcell"${l.taxCents ? ' data-n="with tax"' : ''}>${money(it.totalCents)}</span>${dots(l.pretty)}</div>`;
    };
    // a bill-level tip comes back from the engine as an extra line past the receipt's own lines
    const tip = items(res).find((x) => x.itemType === 'Tip' && x.index >= model.lines.length);
    stage.innerHTML = `
      <div class="st-people"><span class="st-sp" aria-hidden="true"><strong>${esc(model.merchant)}</strong><small>${model.lines.length} items · ${money(model.totalCents)}${PAYER[model.id] ? ` · ${esc(PEOPLE[PAYER[model.id]].name)} paid` : ''}</small></span><div class="st-pp">${people.map((id) => `
        <div class="st-p" data-p="${id}">${avatar(PEOPLE[id])}<span class="nm">${esc(PEOPLE[id].name)}</span><span class="amt money"></span></div>`).join('')}</div></div>
      <div class="st-items" role="grid" aria-label="Who had what" aria-describedby="gs-hint">${folded.length ? `
        <div class="st-row st-grp" role="row" data-lines="${folded.join(',')}">
          <span class="nm" role="rowheader"><button type="button" class="st-exp" aria-expanded="false" aria-controls="gs-sub" aria-label="${esc(grpName)}, ${folded.length} items"><span class="gl">${esc(grpName)}</span> <small>${folded.length} items</small>${CHEV}</button></span><span class="money" role="gridcell" data-n="${folded.length} items"></span>
          ${dots(`${folded.length} shared ${grpName.toLowerCase()}`)}
        </div>
        <div class="st-sub" id="gs-sub" role="rowgroup" hidden>${folded.map((i) => row(model.lines[i], true)).join('')}</div>` : ''}
        ${model.lines.filter((l) => !folded.includes(l.index)).map((l) => row(l)).join('')}
        ${tip ? `<div class="st-row st-x" role="row"><span class="nm" role="rowheader">Tip</span><span class="money" role="gridcell" data-n="by share">${money(tip.totalCents)}</span>${xcell}</div>` : ''}</div>
      <p class="visually-hidden" id="gs-hint">Arrow keys move between items and people. Space adds or removes someone.</p>
      <div class="st-foot"><p class="ss-owe">You spent <strong class="money ss-you"></strong> <span class="ss-them"></span></p><span class="ss-check"></span><button type="button" class="st-reset is-off" tabindex="-1" aria-label="Reset the split" title="Reset">${ICON.replay}</button></div>`;
    el = {
      sub: $('.st-sub', stage), exp: $('.st-exp', stage), grp: $('.st-grp', stage),
      you: $('.ss-you', stage), them: $('.ss-them', stage), check: $('.ss-check', stage), reset: $('.st-reset', stage),
      amts: Object.fromEntries(people.map((p) => [p, $(`.st-p[data-p="${p}"] .amt`, stage)])),
    };
    focusRow = visRows()[0]; fc = 0;
    paint();
  }

  function paint() {
    clearTimeout(whyT);
    const res = compute(model);
    const vis = visRows();
    if (!vis.includes(focusRow)) focusRow = el.grp || vis[0];
    allRows().forEach((row) => {
      const ix = linesOf(row);
      $$('.dot-b', row).forEach((b, c) => {
        const n = ix.filter((i) => (itemAt(res, i).shares[b.dataset.p] || 0) > 0).length;
        const all = n === ix.length;
        b.classList.toggle('on', all);
        b.classList.toggle('part', n > 0 && !all);
        b.setAttribute('aria-pressed', all ? 'true' : n ? 'mixed' : 'false');
        b.tabIndex = row === focusRow && c === fc ? 0 : -1;
      });
      if (!row.dataset.lines) $(':scope > .money', row).textContent = money(itemAt(res, ix[0]).totalCents);
    });
    if (el.grp) $(':scope > .money', el.grp).textContent = money(folded.reduce((a, i) => a + itemAt(res, i).totalCents, 0));
    people.forEach((p) => { el.amts[p].textContent = money(res.people[p]?.cents || 0); });
    // the footer ends on what you spent; then who owes whom (you paid, or the person who did)
    const mine = res.people.you?.cents || 0;
    el.you.textContent = money(mine);
    const payer = PAYER[model.id] || 'you';
    if (payer !== 'you') {
      el.them.innerHTML = mine ? `You owe ${esc(PEOPLE[payer].name)} <b class="money neg">${money(mine)}</b>` : `${esc(PEOPLE[payer].name)} paid it all`;
    } else {
      const others = people.filter((p) => p !== 'you' && (res.people[p]?.cents || 0) > 0);
      const owed = others.reduce((a, p) => a + res.people[p].cents, 0);
      el.them.innerHTML = !owed ? 'All yours' : `${others.length > 1 ? 'Roommates owe' : `${esc(PEOPLE[others[0]].name)} owes`} you <b class="money">${money(owed)}</b>`;
    }
    const ok = res.check.ok;
    el.check.className = `ss-check${ok ? '' : ' bad'}`;
    el.check.innerHTML = ok ? `${ICON.check}Adds up to ${money(res.check.sumCents)}` : `Shares add up to ${money(res.check.sumCents)}, not ${money(res.check.expectedCents)}`;
    // Reset shows only once the split differs from the receipt's own
    const ed = edited();
    el.reset.classList.toggle('is-off', !ed);
    el.reset.tabIndex = ed ? 0 : -1;
    clearTimeout(announceT);
    announceT = setTimeout(() => {
      live.textContent = people.map((p) => `${PEOPLE[p].name} ${money(res.people[p]?.cents || 0)}`).join(', ') + (ok ? '. Adds up exactly.' : '.');
    }, 400);
  }

  function toggleFold() {
    const open = el.sub.hidden;
    el.sub.hidden = !open;
    el.exp.setAttribute('aria-expanded', String(open));
    el.grp.classList.toggle('is-open', open);
    stage.classList.toggle('is-open', open);
    if (open) el.sub.scrollTop = 0;
    paint();
  }

  stage.addEventListener('click', (e) => {
    if (e.target.closest('.st-reset')) { model.lines = JSON.parse(JSON.stringify(original)); if (el.sub && !el.sub.hidden) toggleFold(); else paint(); return; }
    if (e.target.closest('.st-exp') || (e.target.closest('.st-grp') && !e.target.closest('.who'))) { toggleFold(); return; }
    const btn = e.target.closest('.dot-b');
    if (!btn) return;
    const row = btn.closest('.st-row');
    focusRow = row; fc = people.indexOf(btn.dataset.p);
    const p = btn.dataset.p;
    const ix = linesOf(row);
    const onAll = ix.every((i) => lineMembers(model.lines[i]).includes(p));
    if (onAll) {
      // someone has to have every line: refuse (with a nudge) rather than leave one with nobody on it
      if (ix.some((i) => lineMembers(model.lines[i]).length === 1)) {
        const who = $('.who', row);
        who.classList.remove('nope'); void who.offsetWidth; who.classList.add('nope');
        live.textContent = 'Someone has to have it. Add another person first.';
        // and where the eye is: the footer's check line, for two seconds
        clearTimeout(whyT);
        el.check.className = 'ss-check is-why'; el.check.textContent = 'Someone has to have it.';
        whyT = setTimeout(paint, 2000);
        return;
      }
      ix.forEach((i) => { const m = lineMembers(model.lines[i]).filter((x) => x !== p); model.lines[i].split = { type: 'equal', people: people.filter((x) => m.includes(x)) }; });
    } else {
      ix.forEach((i) => { const m = [...lineMembers(model.lines[i]), p]; model.lines[i].split = { type: 'equal', people: people.filter((x) => m.includes(x)) }; });
    }
    paint();
  });
  stage.addEventListener('keydown', (e) => {
    if (!e.target.closest?.('.dot-b')) return;
    const vis = visRows();
    let r = Math.max(0, vis.indexOf(focusRow)); let c = fc;
    const mv = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (mv) { r = Math.max(0, Math.min(vis.length - 1, r + mv[0])); c = Math.max(0, Math.min(people.length - 1, c + mv[1])); }
    else if (e.key === 'Home') c = 0;
    else if (e.key === 'End') c = people.length - 1;
    else return;
    e.preventDefault();
    focusRow = vis[r]; fc = c;
    paint();
    $$('.dot-b', focusRow)[fc]?.focus();
  });
  stage.addEventListener('focusin', (e) => {
    const btn = e.target.closest?.('.dot-b');
    if (btn) { focusRow = btn.closest('.st-row'); fc = people.indexOf(btn.dataset.p); }
  });

  const ready = load(initial);
  return { load, ready };
}

export { toCents };
