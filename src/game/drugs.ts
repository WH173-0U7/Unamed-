/**
 * The street drug business: what's sold, what it goes for, who buys it, and
 * the city's market (demand and supply, drifting on the real clock). The
 * game models money, people and risk; how anything is made is never in here.
 */
import { now } from './clock';

/** What you can sell. Pills come in kinds (see PILLS). */
export type Product = 'weed' | 'pills' | 'powder' | 'crack' | 'crystal' | 'heroin';
export type PillKind = 'xanax' | 'perc' | 'oxy' | 'adderall' | 'vicodin' | 'valium' | 'klonopin';
/** One thing on the market: a product, or one kind of pill. */
export type MarketKey = Exclude<Product, 'pills'> | PillKind;
export type District = 'downtown' | 'flats' | 'oldtown' | 'southside';

export const DISTRICT_NAMES: Record<District, string> = { downtown: 'Downtown', flats: 'The Flats', oldtown: 'Old Town', southside: 'Southside' };
/** Your corner (Grand Ave and Ninth St) is in the Flats. */
export const HOME_DISTRICT: District = 'flats';

/**
 * Amounts: everything but pills is held and sold by weight, kept as tenths of a
 * gram (an item's `doses`): 35 is an eight-ball, 3.5 g. Pills are counted.
 * (Old saves: a bagged point of powder was always 0.1 g, so its 1 stays 1.)
 */
export const DG = 10;
export interface Size {
  /** Tenths of a gram (pills: how many). */
  amt: number;
  word: string;
  /** Normal street price for it, dollars. */
  price: number;
}
export interface ProductInfo {
  name: string;
  /** The smallest street sale, in words ("a point"). */
  unit: string;
  units: string;
  /** Normal street price per gram (pills: per pill), dollars. */
  price: number;
  /** Hours before a regular wants more (more hooked, sooner). */
  returnH: number;
  /** The bagged single (not pills: they sell from the bottle). */
  bag?: { name: string; detail: string };
  /** Cutting stretches it (not weed, not pills). */
  cuts: boolean;
}

export const PRODUCTS: Record<Product, ProductInfo> = {
  weed: { name: 'Weed', unit: 'a gram', units: 'grams', price: 12, returnH: 30, bag: { name: 'Dime bag', detail: 'A gram of weed in a zip bag' }, cuts: false },
  pills: { name: 'Pills', unit: 'a pill', units: 'pills', price: 15, returnH: 14, cuts: false },
  powder: { name: 'Powder', unit: 'a point', units: 'points', price: 90, returnH: 14, bag: { name: 'Small baggie', detail: 'A point, bagged to sell' }, cuts: true },
  crack: { name: 'Crack', unit: 'a rock', units: 'rocks', price: 100, returnH: 5, bag: { name: 'Rock', detail: 'A rock of crack in a twist of plastic' }, cuts: false },
  crystal: { name: 'Crystal', unit: 'a point', units: 'points', price: 70, returnH: 10, bag: { name: 'Point of crystal', detail: 'A point of shards in a zip bag' }, cuts: true },
  heroin: { name: 'Heroin', unit: 'a bag', units: 'bags', price: 85, returnH: 7, bag: { name: 'Stamp bag', detail: 'A dose of heroin in a stamped wax bag' }, cuts: true },
};
/** What people ask for, by weight, and what it normally goes for (smaller is dearer by the gram). */
export const SIZES: Record<Exclude<Product, 'pills'>, Size[]> = {
  weed: [
    { amt: 10, word: 'a gram', price: 12 },
    { amt: 35, word: 'an eighth', price: 35 },
    { amt: 70, word: 'a quarter', price: 60 },
  ],
  powder: [
    { amt: 1, word: 'a point', price: 15 },
    { amt: 5, word: 'half a gram', price: 50 },
    { amt: 10, word: 'a gram', price: 90 },
    { amt: 35, word: 'an eighth', price: 250 },
  ],
  crack: [
    { amt: 2, word: 'a rock', price: 20 },
    { amt: 4, word: 'two rocks', price: 40 },
  ],
  crystal: [
    { amt: 1, word: 'a point', price: 12 },
    { amt: 5, word: 'half a gram', price: 40 },
    { amt: 10, word: 'a gram', price: 70 },
  ],
  heroin: [
    { amt: 1, word: 'a bag', price: 12 },
    { amt: 5, word: 'half a gram', price: 45 },
    { amt: 10, word: 'a gram', price: 85 },
  ],
};
/** The bag size you sell in, per product: [default, min, max, step] (tenths of a gram; pills counted). */
export const SELL_SIZE: Record<Product, [number, number, number, number]> = {
  weed: [35, 10, 280, 5],
  powder: [5, 1, 70, 1],
  crystal: [5, 1, 70, 1],
  heroin: [1, 1, 70, 1],
  crack: [2, 1, 20, 1],
  pills: [1, 1, 20, 1],
};
/** How many bags they take: mostly one; bigger buyers and regulars sometimes two or three. */
export function bagsFor(kind: 'civilian' | 'drunk' | 'homeless' | 'junkie', regular: boolean, r = Math.random): number {
  const x = r();
  const big = kind === 'civilian' || kind === 'drunk' ? 0.25 : 0.12;
  return 1 + (x < big ? 1 : 0) + (regular && r() < 0.3 ? 1 : 0);
}
/**
 * What a package of product takes up: by the size it came in (a knotted bag,
 * a taped brick, a vacuum bag), and weighs what's left in it plus the wrapping.
 * Up to an ounce fits a pocket; a half-pound needs a bag; more, a big one.
 */
export function packageMeasure(p: Product, amt: number, full = amt): { size: 'small' | 'medium' | 'large'; kg: number } {
  if (p === 'pills') return { size: 'small', kg: Math.round((0.02 + amt * 0.0005) * 1000) / 1000 };
  const size = full <= 280 ? 'small' : full <= 2270 ? 'medium' : 'large';
  const wrap = full <= 35 ? 0.005 : full <= 280 ? 0.02 : full <= 2270 ? 0.06 : 0.15;
  return { size, kg: Math.round((amt / 10000 + wrap) * 1000) / 1000 };
}
/** An amount in words: "3.2 g", "12 pills". */
export const amountText = (p: Product, amt: number) => (p === 'pills' ? `${amt} pill${amt === 1 ? '' : 's'}` : `${(amt / DG).toFixed(amt % DG ? 1 : 0)} g`);
/** A request in words: "half a gram", "an eighth", "3 pills". */
export function sizeWord(p: Product, amt: number): string {
  if (p === 'pills') return amt === 1 ? 'a pill' : `${amt} pills`;
  return SIZES[p].find((x) => x.amt === amt)?.word ?? amountText(p, amt);
}
/** Normal street price for that amount (dollars): by the size breaks; pills a little off for five or more. */
export function sizePrice(k: MarketKey, amt: number): number {
  const p = keyProduct(k);
  if (p === 'pills') return basePrice(k) * amt * (amt >= 5 ? 0.9 : 1);
  const sizes = SIZES[p];
  const exact = sizes.find((x) => x.amt === amt);
  if (exact) return exact.price;
  // (Between sizes: by the gram, at the rate of the biggest size it's past.)
  const at = [...sizes].reverse().find((x) => x.amt <= amt) ?? sizes[0];
  return (at.price / at.amt) * amt;
}
/** How much they ask for: junkies small and often, the party crowd grams, the rest in between. */
export function requestFor(k: MarketKey, kind: 'civilian' | 'drunk' | 'homeless' | 'junkie', age: number | undefined, r = Math.random): number {
  const p = keyProduct(k);
  if (p === 'pills') {
    const party = k === 'adderall' || k === 'xanax';
    if (kind === 'junkie' || kind === 'homeless') return 1 + Math.floor(r() * 3);
    return party || (age != null && age < 27) ? 3 + Math.floor(r() * 8) : 1 + Math.floor(r() * 5);
  }
  const sizes = SIZES[p];
  const x = r();
  const i = kind === 'junkie' || kind === 'homeless' ? (x < 0.75 ? 0 : 1) : kind === 'drunk' ? (x < 0.4 ? 0 : x < 0.85 ? 1 : 2) : x < 0.25 ? 0 : x < 0.75 ? 1 : 2;
  return sizes[Math.min(i, sizes.length - 1)].amt;
}

export interface PillInfo {
  /** What people call it on the street. */
  street: string;
  /** What's on a real bottle. */
  generic: string;
  price: number;
  returnH: number;
}
export const PILLS: Record<PillKind, PillInfo> = {
  xanax: { street: 'Xanax bars', generic: 'Alprazolam, 2 mg', price: 8, returnH: 20 },
  perc: { street: 'Percs', generic: 'Oxycodone/APAP, 10/325', price: 15, returnH: 14 },
  oxy: { street: '30s (blues)', generic: 'Oxycodone, 30 mg', price: 30, returnH: 9 },
  adderall: { street: 'Adderall', generic: 'Amphetamine salts, 20 mg', price: 8, returnH: 30 },
  vicodin: { street: 'Vikes', generic: 'Hydrocodone/APAP, 10/325', price: 7, returnH: 18 },
  valium: { street: 'Valium', generic: 'Diazepam, 10 mg', price: 4, returnH: 30 },
  klonopin: { street: 'K-pins', generic: 'Clonazepam, 1 mg', price: 5, returnH: 24 },
};

/** Every market key, in the order they're listed. */
export const MARKET_KEYS: MarketKey[] = ['weed', 'powder', 'crack', 'crystal', 'heroin', 'oxy', 'perc', 'vicodin', 'xanax', 'klonopin', 'valium', 'adderall'];

export const keyName = (k: MarketKey) => (k in PILLS ? PILLS[k as PillKind].street : PRODUCTS[k as Product].name);
export const keyProduct = (k: MarketKey): Product => (k in PILLS ? 'pills' : (k as Product));
export const basePrice = (k: MarketKey) => (k in PILLS ? PILLS[k as PillKind].price : PRODUCTS[k as Product].price);
export const baseReturnH = (k: MarketKey) => (k in PILLS ? PILLS[k as PillKind].returnH : PRODUCTS[k as Product].returnH);

/** What an item is, on the market (old saves: any street product is powder). */
export function keyOf(x: { product?: Product; pill?: PillKind; secret?: string }): MarketKey | null {
  if (x.product === 'pills') return x.pill ?? 'perc';
  if (x.product) return x.product;
  return x.secret === 'cocaine' ? 'powder' : null;
}
export const productOf = (x: { product?: Product; secret?: string }): Product | null => x.product ?? (x.secret === 'cocaine' ? 'powder' : null);
/** Quality, 0..100 (old saves: middling). */
export const qualityOf = (x: { quality?: number }) => x.quality ?? 60;
export const qualityWord = (q: number) => (q >= 85 ? 'Strong' : q >= 70 ? 'Good' : q >= 50 ? 'Decent' : q >= 35 ? 'Weak' : 'Garbage');

// ---------- Who buys what ----------

type Kind = 'civilian' | 'drunk' | 'homeless' | 'junkie';
/** How much each kind of person wants each thing (before the hour, the district, the market). */
const WANTS: Record<Kind, Partial<Record<MarketKey, number>>> = {
  civilian: { weed: 6, powder: 2, adderall: 1.5, xanax: 1.5, perc: 1, vicodin: 1, valium: 0.4, klonopin: 0.5 },
  drunk: { powder: 4, weed: 3, xanax: 2, perc: 0.5 },
  homeless: { weed: 3, crack: 3, crystal: 3, heroin: 2, oxy: 1, klonopin: 1 },
  junkie: { heroin: 4, crack: 3.5, oxy: 3, crystal: 2, perc: 1, xanax: 1, powder: 1 },
};
/** Night (9 PM–5 AM) and day pulls on each. */
const NIGHT: Partial<Record<MarketKey, number>> = { powder: 1.6, crack: 1.3, xanax: 1.3, crystal: 1.2, adderall: 0.5 };
const DAY: Partial<Record<MarketKey, number>> = { adderall: 1.5, weed: 1.1, powder: 0.6 };
/** How much each part of town goes for each thing (1 = like anywhere). */
export const DISTRICT_TASTE: Record<District, Partial<Record<MarketKey, number>>> = {
  downtown: { powder: 1.7, adderall: 1.5, xanax: 1.4, perc: 1.2, oxy: 1.1, weed: 1, heroin: 0.35, crack: 0.15, crystal: 0.5 },
  flats: { weed: 1.2, crack: 1.5, crystal: 1.2, heroin: 1.5, perc: 0.9, powder: 0.8, adderall: 0.7 },
  oldtown: { weed: 1.3, powder: 1.3, xanax: 1.3, perc: 1.3, vicodin: 1.2, heroin: 0.9, crack: 0.6 },
  southside: { heroin: 1.6, crack: 1.9, crystal: 1.4, oxy: 1.3, powder: 0.6, adderall: 0.5, xanax: 0.8 },
};

/** What this person is after, if they'd buy at all: by who they are, their age, the hour, where, and the market. */
export function wantFor(kind: Kind, age: number | undefined, hour: number, m: Market, d: District = HOME_DISTRICT, r = Math.random()): MarketKey {
  const night = hour >= 21 || hour < 5;
  const w = { ...WANTS[kind] };
  // The party crowd and students; older people with bad backs.
  if (kind === 'civilian' && age != null && age < 27) for (const k of ['adderall', 'xanax'] as MarketKey[]) w[k] = (w[k] ?? 0) * 3;
  if (kind === 'civilian' && age != null && age > 45) for (const k of ['perc', 'vicodin', 'valium'] as MarketKey[]) w[k] = (w[k] ?? 0) * 3;
  const keys = Object.keys(w) as MarketKey[];
  const weights = keys.map((k) => (w[k] ?? 0) * ((night ? NIGHT : DAY)[k] ?? 1) * (DISTRICT_TASTE[d][k] ?? 1) * demandOf(m, k));
  let n = r * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < keys.length; i++) if ((n -= weights[i]) < 0) return keys[i];
  return keys[0];
}

/** Will they take something else, when you don't have what they came for? */
const SUBS: MarketKey[][] = [
  ['heroin', 'oxy', 'perc', 'vicodin'],
  ['xanax', 'klonopin', 'valium'],
  ['powder', 'crystal', 'adderall'],
  ['crack', 'powder'],
];
export function substitutes(want: MarketKey, kind: Kind): MarketKey[] {
  const group = SUBS.find((g) => g.includes(want)) ?? [];
  // (Hooked, they'll take most things.)
  const extra: MarketKey[] = kind === 'junkie' ? ['heroin', 'crack', 'oxy', 'crystal', 'perc', 'powder'] : [];
  return [...new Set([...group, ...extra])].filter((k) => k !== want);
}

// ---------- The city's market ----------

export interface MarketEvent {
  key: MarketKey;
  kind: 'drought' | 'glut';
  until: number;
}
export interface Market {
  /** When it was last moved on (an hour at a time). */
  at: number;
  /** How much of each is out there, 1 = normal (rivals, shipments, busts). */
  supply: Partial<Record<MarketKey, number>>;
  /** How many want it, 1 = normal. */
  demand: Partial<Record<MarketKey, number>>;
  /** Your own selling, by district: flood a corner and the price there drops. Fades. */
  local: Partial<Record<District, Partial<Record<MarketKey, number>>>>;
  /** The price a while back, for the trend arrow. */
  was: Partial<Record<MarketKey, number>>;
  events: MarketEvent[];
}
export const newMarket = (): Market => ({ at: now(), supply: {}, demand: {}, local: {}, was: {}, events: [] });
const supplyOf = (m: Market, k: MarketKey) => (m.supply[k] ?? 1) * m.events.filter((e) => e.key === k && e.until > now()).reduce((n, e) => n * (e.kind === 'drought' ? 0.5 : 1.6), 1);
export const demandOf = (m: Market, k: MarketKey) => m.demand[k] ?? 1;
/** How much it's wanted in that part of town: the city's demand, by the district's taste. */
export const districtDemand = (m: Market, k: MarketKey, d: District) => demandOf(m, k) * (DISTRICT_TASTE[d][k] ?? 1);
export const DISTRICTS: District[] = ['downtown', 'flats', 'oldtown', 'southside'];

/** The street price for one, in dollars: city-wide, or in a district (its taste, and your own selling there pushing it down). */
export function streetPrice(m: Market, k: MarketKey, d?: District): number {
  const ratio = Math.sqrt((d ? districtDemand(m, k, d) : demandOf(m, k)) / Math.max(0.2, supplyOf(m, k)));
  const local = d ? 1 - Math.min(0.35, (m.local[d]?.[k] ?? 0) * 0.5) : 1;
  return Math.max(1, Math.round(basePrice(k) * Math.min(1.8, Math.max(0.55, ratio)) * local * 2) / 2);
}
/** How it's moving: in demand, steady, or flooded (and which way the price went). */
export function marketWord(m: Market, k: MarketKey): { word: string; arrow: '↑' | '↓' | '→' } {
  const p = streetPrice(m, k);
  const was = m.was[k] ?? p;
  const arrow = p > was * 1.04 ? '↑' : p < was * 0.96 ? '↓' : '→';
  const r = p / basePrice(k);
  const drought = m.events.some((e) => e.key === k && e.kind === 'drought' && e.until > now());
  const glut = m.events.some((e) => e.key === k && e.kind === 'glut' && e.until > now());
  const word = drought ? 'dried up' : glut ? 'flooded' : r >= 1.15 ? 'in demand' : r <= 0.85 ? 'cheap right now' : 'steady';
  return { word, arrow };
}

/** What happened out there (for a line on the street, when you're there to hear it). */
export const EVENT_LINES: Record<MarketEvent['kind'], (k: MarketKey) => string> = {
  drought: (k) => `Word on the street: a bust upstate. ${keyName(k)} is hard to find, and the price is going up.`,
  glut: (k) => `Word on the street: somebody got a big load in. ${keyName(k)} is everywhere, and cheap.`,
};

/**
 * The market moved on to now, an hour at a time: supply and demand wander
 * back toward normal, your own selling fades, and now and then a bust (a
 * drought) or a big shipment (a glut). Returns what happened, to tell.
 */
export function tickMarket(m: Market, t = now(), r = Math.random): MarketEvent[] {
  const hours = Math.min(24 * 14, Math.floor((t - m.at) / 3_600_000));
  if (hours < 1) return [];
  m.at += hours * 3_600_000;
  const happened: MarketEvent[] = [];
  for (let h = 0; h < hours; h++) {
    for (const k of MARKET_KEYS) {
      if (h % 6 === 0) m.was[k] = streetPrice(m, k);
      const s = m.supply[k] ?? 1;
      const dm = m.demand[k] ?? 1;
      m.supply[k] = Math.max(0.4, Math.min(2, s + (1 - s) * 0.08 + (r() - 0.5) * 0.06));
      m.demand[k] = Math.max(0.5, Math.min(1.8, dm + (1 - dm) * 0.06 + (r() - 0.5) * 0.05));
    }
    for (const d of Object.keys(m.local) as District[]) for (const k of Object.keys(m.local[d] ?? {}) as MarketKey[]) {
      const v = (m.local[d]![k] ?? 0) * 0.85;
      if (v < 0.01) delete m.local[d]![k];
      else m.local[d]![k] = v;
    }
    // A bust somewhere up the line, or a shipment: about once every day or two.
    if (r() < 0.03) {
      const key = MARKET_KEYS[Math.floor(r() * MARKET_KEYS.length)];
      if (!m.events.some((e) => e.key === key && e.until > m.at)) {
        const ev: MarketEvent = { key, kind: r() < 0.55 ? 'drought' : 'glut', until: m.at + (24 + r() * 48) * 3_600_000 };
        m.events.push(ev);
        happened.push(ev);
      }
    }
  }
  m.events = m.events.filter((e) => e.until > t);
  return happened.slice(-2);
}
/** How much call there is for it in a district, in a word. */
export function districtWord(m: Market, k: MarketKey, d: District): string {
  const v = districtDemand(m, k, d);
  return v >= 1.45 ? 'big' : v >= 1.05 ? 'good' : v >= 0.75 ? 'some' : v >= 0.4 ? 'little' : 'none';
}
/** You sold some: more of it on the street round here. */
export function addLocalSupply(m: Market, k: MarketKey, units = 1, d: District = HOME_DISTRICT) {
  const at = (m.local[d] ??= {});
  at[k] = Math.min(1.2, (at[k] ?? 0) + 0.04 * units);
}

// ---------- Your standing as a dealer ----------

/** The ladder (the last two are for when you've people working for you). */
export const STANDING_NAMES = ['Nobody', 'Corner hustler', 'Known dealer', 'Supplier', 'Crew boss', 'Organization'];
/** Score needed for each rung. */
const STANDING_AT = [0, 10, 60, 250, Infinity, Infinity];
/** Where you are: from what you've sold, your regulars, and your name on the street. */
export function standingScore(sales: number, regulars: number, rep: number) {
  return Math.round(sales + regulars * 5 + Math.max(0, rep) / 2);
}
export const standingOf = (score: number) => STANDING_AT.reduce((lvl, at, i) => (score >= at ? i : lvl), 0);
export const nextStandingAt = (lvl: number) => STANDING_AT[lvl + 1] ?? Infinity;

/** How the market has that right now, against normal (round here): 1 is a normal price. */
export const priceFactor = (m: Market, k: MarketKey, d: District = HOME_DISTRICT) => streetPrice(m, k, d) / basePrice(k);
/**
 * What you get for that amount, in dollars: the size's street price, by the
 * market, who they are, how good it is, your tongue, and your name.
 */
export function quote(factor: number, k: MarketKey, amt: number, q: number, kind: Kind, speech: number, standing: number): number {
  const kf = { junkie: 0.85, drunk: 1, homeless: 0.7, civilian: 1.15 }[kind];
  const qf = 0.7 + 0.6 * (q / 100);
  return Math.max(1, Math.round(sizePrice(k, amt) * factor * kf * qf * (1 + (speech - 1) * 0.004) * (1 + Math.min(3, standing) * 0.03)));
}
/** Hours till a happy regular comes back for more. */
export const returnHours = (k: MarketKey, q: number) => baseReturnH(k) * (q >= 70 ? 0.7 : q < 45 ? 1.5 : 1);
