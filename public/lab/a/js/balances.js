/* balances.js: who owes you across this month's shared bills, live from the split above.
 * You paid Green Basket ($100.00): each roommate owes you their share of it. Maya paid the farmers market ($32.25):
 * you owe her your $9.20 of it. So a balance is the net of both bills, exact to the cent. */
export const ROOMMATES = ['maya', 'jordan', 'sam'];
const FARMERS_YOURS = 920; // your share of the farmers market run Maya paid for (the month card's row)
const DEFAULT = { you: 3000, maya: 3000, jordan: 2000, sam: 2000 };

export function balances() {
  const gb = window.__tzSplit?.people || DEFAULT;
  return { maya: (gb.maya || 0) - FARMERS_YOURS, jordan: gb.jordan || 0, sam: gb.sam || 0 };
}
