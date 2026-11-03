/**
 * Cash as it really is: dollar bills and coins. A purse maps each
 * denomination (in cents) to how many you have. Paying hands over notes and
 * coins and gets change back the way a cashier would give it; the bank
 * changes small bills and coins up into big ones, or breaks big ones down.
 */
export type Purse = Record<number, number>;

/** Every denomination, largest first (cents). */
export const BILLS = [10000, 5000, 2000, 1000, 500, 100];
export const COINS = [25, 10, 5, 1];
export const DENOMS = [...BILLS, ...COINS];

/** Grams: bills about a gram each; coins by type. */
const GRAMS: Record<number, number> = { 25: 5.67, 10: 2.27, 5: 5, 1: 2.5 };

export const isBill = (d: number) => d >= 100;

export function denomName(d: number, n = 1): string {
  if (isBill(d)) return `$${d / 100} bill${n === 1 ? '' : 's'}`;
  return { 25: n === 1 ? 'quarter' : 'quarters', 10: n === 1 ? 'dime' : 'dimes', 5: n === 1 ? 'nickel' : 'nickels', 1: n === 1 ? 'penny' : 'pennies' }[d]!;
}

export const emptyPurse = (): Purse => ({});
export const cents = (p: Purse) => DENOMS.reduce((s, d) => s + d * (p[d] ?? 0), 0);
export const dollarsOf = (p: Purse) => cents(p) / 100;
export const kgOf = (p: Purse) => DENOMS.reduce((s, d) => s + (p[d] ?? 0) * (GRAMS[d] ?? 1), 0) / 1000;
export const count = (p: Purse, ds = DENOMS) => ds.reduce((s, d) => s + (p[d] ?? 0), 0);

export function addTo(p: Purse, q: Purse) {
  for (const d of DENOMS) if (q[d]) p[d] = (p[d] ?? 0) + q[d];
}

function take(p: Purse, d: number, n = 1) {
  p[d] = (p[d] ?? 0) - n;
  if (p[d] <= 0) delete p[d];
}

/** The fewest notes and coins that make `c` cents (a cashier's change). */
export function fewest(c: number, top = 10000): Purse {
  const p: Purse = {};
  let left = Math.round(c);
  for (const d of DENOMS) {
    if (d > top) continue;
    const n = Math.floor(left / d);
    if (n) p[d] = n;
    left -= n * d;
  }
  return p;
}

/**
 * Money the way someone carries it. `style`: 'wallet' (mostly twenties,
 * some smaller), 'small' (singles and fives, folded), 'change' (coins).
 */
export function cashLike(c: number, style: 'wallet' | 'small' | 'change'): Purse {
  let left = Math.round(c);
  const p: Purse = {};
  const put = (d: number, n: number) => {
    if (n > 0) {
      p[d] = (p[d] ?? 0) + n;
      left -= d * n;
    }
  };
  if (style === 'change') {
    // A few of everything, mostly quarters.
    put(25, Math.floor((left * (0.5 + Math.random() * 0.4)) / 25));
    put(10, Math.floor((left * 0.6) / 10));
    put(5, Math.floor((left * 0.5) / 5));
    put(1, left);
    return p;
  }
  if (style === 'wallet') {
    // ATMs give twenties; the rest gets broken into smaller bills.
    if (left >= 2000) put(2000, Math.floor((left * (0.55 + Math.random() * 0.35)) / 2000));
    if (left >= 1000 && Math.random() < 0.5) put(1000, 1);
  }
  for (const d of [500, 100]) if (left >= d) put(d, Math.floor((left * (d === 500 ? 0.5 : 1)) / d));
  // Whatever's left in coins.
  addTo(p, fewest(left, 25));
  return p;
}

/**
 * Pay `price` cents: hands over what's needed (exact if you can, otherwise
 * the smallest overpay) and takes the change. Returns what you handed over
 * and got back, or null if you don't have enough.
 */
export function pay(p: Purse, price: number): { gave: Purse; change: Purse } | null {
  if (cents(p) < price) return null;
  const gave: Purse = {};
  let left = price;
  // Largest first while it doesn't overshoot.
  for (const d of DENOMS) {
    while (left >= d && (p[d] ?? 0) - (gave[d] ?? 0) > 0) {
      gave[d] = (gave[d] ?? 0) + 1;
      left -= d;
    }
  }
  if (left > 0) {
    // Not exact: one more of the smallest denomination that covers the rest.
    const up = [...DENOMS].reverse().find((d) => d >= left && (p[d] ?? 0) - (gave[d] ?? 0) > 0);
    if (up) {
      gave[up] = (gave[up] ?? 0) + 1;
      left -= up;
    } else {
      // Only small things left that don't cover it alone: keep adding.
      for (const d of [...DENOMS].reverse()) {
        while (left > 0 && (p[d] ?? 0) - (gave[d] ?? 0) > 0) {
          gave[d] = (gave[d] ?? 0) + 1;
          left -= d;
        }
      }
    }
  }
  for (const d of DENOMS) if (gave[d]) take(p, d, gave[d]);
  const change = fewest(-left);
  addTo(p, change);
  return { gave, change };
}

/** Changes everything up: the fewest bills, with coins only for the cents. */
export function changeUp(p: Purse) {
  const c = cents(p);
  for (const d of DENOMS) delete p[d];
  addTo(p, fewest(c));
}

/** Coins only into bills (what a coin machine does), minus `fee` (0..1). Returns the fee in cents. */
export function coinsToBills(p: Purse, fee: number): number {
  const c = COINS.reduce((s, d) => s + d * (p[d] ?? 0), 0);
  for (const d of COINS) delete p[d];
  const kept = Math.floor(c * (1 - fee));
  addTo(p, fewest(kept));
  return c - kept;
}

/** What a bill breaks into at the bank. */
const BREAKS: Record<number, Purse> = {
  10000: { 2000: 5 },
  5000: { 2000: 2, 1000: 1 },
  2000: { 1000: 1, 500: 2 },
  1000: { 500: 1, 100: 5 },
  500: { 100: 5 },
  100: { 25: 4 },
};

export function breakBill(p: Purse, d: number): boolean {
  if (!BREAKS[d] || !(p[d] ?? 0)) return false;
  take(p, d);
  addTo(p, BREAKS[d]);
  return true;
}
export const breaksInto = (d: number) => BREAKS[d];

/** "2 × $20, 1 × $5, 3 quarters" */
export function purseText(p: Purse): string {
  const parts = DENOMS.filter((d) => p[d]).map((d) => (isBill(d) ? `${p[d]} × $${d / 100}` : `${p[d]} ${denomName(d, p[d])}`));
  return parts.length ? parts.join(', ') : 'nothing';
}

export const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
