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
/**
 * How much room it takes, in millilitres. A bill is 156 × 66 × 0.11 mm
 * (about 1.1 mL); folded and stuffed in a pocket, call it 1.4. Coins by
 * their size, with the gaps between them.
 */
const ML: Record<number, number> = { 25: 1.1, 10: 0.5, 5: 1, 1: 0.5 };
export const mlOf = (p: Purse) => DENOMS.reduce((s, d) => s + (p[d] ?? 0) * (isBill(d) ? 1.4 : ML[d]), 0);
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
 * Pay `price` cents: hands over exact money if you can make it, otherwise
 * the smallest overpay you can (with the fewest notes and coins), and takes
 * the change. Returns what you handed over and got back, or null if you
 * don't have enough.
 */
export function pay(p: Purse, price: number): { gave: Purse; change: Purse } | null {
  if (cents(p) < price) return null;
  // (Nothing to pay: nothing changes hands.)
  if (price <= 0) return { gave: {}, change: {} };
  const gave = bestHandover(p, price);
  for (const d of DENOMS) if (gave[d]) take(p, d, gave[d]);
  const change = fewest(cents(gave) - price);
  addTo(p, change);
  return { gave, change };
}

/**
 * The notes and coins to hand over: of every amount you could make from
 * your purse that covers the price, the smallest; and of the ways to make
 * it, the one with the fewest pieces. (A small table over the amounts from
 * the price up to the price plus your biggest note.)
 */
function bestHandover(p: Purse, price: number): Purse {
  // (A big amount: the table would be far too slow with a wad of small bills. Biggest first,
  // then the smallest piece that covers what's left; the change comes back after.)
  if (price > 20000) return quickHandover(p, price);
  const have = DENOMS.filter((d) => p[d]);
  const top = Math.min(cents(p), price + Math.max(...have));
  const INF = 1e9;
  // best[i][s]: fewest pieces to make s from the first i denominations.
  let best = new Array<number>(top + 1).fill(INF);
  best[0] = 0;
  const used: Int32Array[] = [];
  for (const d of have) {
    const next = new Array<number>(top + 1).fill(INF);
    const k = new Int32Array(top + 1);
    const n = p[d];
    for (let s = 0; s <= top; s++) {
      for (let c = 0; c <= n && c * d <= s; c++) {
        const v = best[s - c * d] + c;
        if (v < next[s]) {
          next[s] = v;
          k[s] = c;
        }
      }
    }
    best = next;
    used.push(k);
  }
  let s = price;
  while (s <= top && best[s] >= INF) s++;
  // (Can't happen if you have enough, but just in case: hand over it all.)
  if (s > top) return { ...p };
  const gave: Purse = {};
  for (let i = have.length - 1; i >= 0; i--) {
    const c = used[i][s];
    if (c) gave[have[i]] = c;
    s -= c * have[i];
  }
  return gave;
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

export const money = (c: number) => {
  const d = c % 100 ? 2 : 0;
  return `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
};

/** Handing over a big amount without the table: largest pieces first, then the smallest that cover the rest. */
function quickHandover(p: Purse, price: number): Purse {
  const gave: Purse = {};
  let left = price;
  for (const d of DENOMS) {
    const c = Math.min(p[d] ?? 0, Math.floor(left / d));
    if (c) {
      gave[d] = c;
      left -= c * d;
    }
  }
  // Short: one more of the smallest piece that covers it; failing that, the biggest there is, and again.
  while (left > 0) {
    const spare = DENOMS.filter((d) => (p[d] ?? 0) > (gave[d] ?? 0));
    if (!spare.length) return { ...p };
    const d = [...spare].reverse().find((x) => x >= left) ?? spare[0];
    gave[d] = (gave[d] ?? 0) + 1;
    left -= d;
  }
  return gave;
}

