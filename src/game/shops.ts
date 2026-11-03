import type { Hours } from './clock';
import type { InvItem } from './inventory';

/**
 * Places you can go besides the street, and what they deal in. Opening hours
 * follow the device's clock.
 *
 * - **Pharmacy:** open all night. Medicine.
 * - **Pawn shop:** daytime. Buys phones, headphones and the like for a fraction
 *   of what they're worth, but only if you show photo ID (a stolen license will
 *   do, if the clerk doesn't look too closely). Won't touch IDs or cards.
 *   Sells second-hand bags and clothes, and lighters.
 * - **The fence**, in the alley behind the laundromat: night only. Takes
 *   anything worth anything, IDs and cards and car keys included, no
 *   questions, for even less. Pays in crumpled small bills.
 * - **Bank:** office hours. Changes small bills and coins up into big ones,
 *   and breaks big ones down. After hours, the coin machine in the lobby
 *   still turns coins into bills, for a cut.
 */
export type Place = 'street' | 'pharmacy' | 'pawn' | 'fence' | 'bank';

export interface PlaceInfo {
  id: Place;
  name: string;
  desc: string;
  /** Null: always open. */
  hours: Hours | null;
  /** What it's like inside, for the top of the screen. */
  blurb: string;
  /** Under a roof (no rain on you). */
  indoors: boolean;
}

const WEEKDAYS = (a: number, b: number, sat: [number, number] | null = null): Hours => [null, [a, b], [a, b], [a, b], [a, b], [a, b], sat];
const EVERY = (a: number, b: number): Hours => [[a, b], [a, b], [a, b], [a, b], [a, b], [a, b], [a, b]];

export const PLACES: PlaceInfo[] = [
  { id: 'street', name: 'The street', desc: 'Lurk in the dark and watch who comes by.', hours: null, blurb: '', indoors: false },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    desc: 'Open all night. Bandages, painkillers, splints.',
    hours: null,
    blurb: 'Open all night. A fluorescent hum, and a bored clerk behind the plexiglass.',
    indoors: true,
  },
  {
    id: 'pawn',
    name: 'Lucky Star Pawn',
    desc: 'Sells second-hand bags and coats. Buys cheap, and wants to see ID.',
    hours: [null, [10, 19], [10, 19], [10, 19], [10, 19], [10, 19], [10, 17]],
    blurb: 'Guitars on the wall, rings under glass, a man behind a cage who looks at everything like it owes him money.',
    indoors: true,
  },
  {
    id: 'fence',
    name: 'The alley',
    desc: 'Someone back there buys anything. Night only.',
    hours: EVERY(20, 4),
    blurb: 'Behind the laundromat, in the steam from the vents. He keeps his hands in his pockets and his eyes on the street.',
    indoors: false,
  },
  {
    id: 'bank',
    name: 'First Civic Bank',
    desc: 'Changes bills and coins. Office hours; a coin machine in the lobby.',
    hours: WEEKDAYS(9, 17, [9, 13]),
    blurb: 'Marble and quiet. A guard by the door watches you come in.',
    indoors: true,
  },
];
export const placeInfo = (p: Place) => PLACES.find((x) => x.id === p)!;

/** The bank lobby (coin machine) is open all hours. */
export const COIN_MACHINE_FEE = 0.1;

// ---------- What things are worth (to someone who'd buy them new) ----------

export function worth(x: Pick<InvItem, 'kind' | 'name' | 'med' | 'secret' | 'known' | 'doses'>): number {
  const n = x.name.toLowerCase();
  if (x.secret === 'cocaine') return 60 * (x.doses ?? 1);
  if (x.med) return { bandages: 8, gauze: 15, painkillers: 6, splint: 22, iron: 12, testkit: 10 }[x.med];
  if (x.kind === 'phone') return 180;
  if (x.kind === 'car keys') return 80;
  if (x.kind === 'id') return /expired/.test(n) ? 10 : 60;
  if (x.kind === 'credit card') return 80;
  if (x.kind === 'debit card') return 40;
  if (/headphones/.test(n)) return 50;
  if (/charger/.test(n)) return 12;
  if (/groceries/.test(n)) return 15;
  if (/notebook|water bottle|lunch/.test(n)) return 3;
  if (/cigarettes/.test(n)) return 0.5 * (x.doses ?? 10);
  if (/lighter/.test(n)) return 2;
  return 0;
}

/** Cents a buyer offers, or a reason they won't. */
export function offer(place: 'pawn' | 'fence', x: InvItem): { cents: number } | { why: string } {
  const v = worth(x);
  const kind = x.kind;
  if (place === 'pawn') {
    if (kind === 'id' || kind === 'credit card' || kind === 'debit card') return { why: '"I don\'t touch that."' };
    if (kind === 'car keys' || x.secret) return { why: '"Get that out of my shop."' };
    if (x.med || /cigarettes|lighter|matches|groceries|lunch|receipt|note|keys|baggie/i.test(x.name)) return { why: "Not worth his time" };
    if (v <= 0) return { why: "He won't take it" };
    // Pawn shops pay a fraction, rounded down to the quarter.
    return { cents: Math.max(25, Math.floor((v * 0.2 * 100) / 25) * 25) };
  }
  if (v <= 0 || /receipt|note|house keys|transfer|slip|photo/i.test(x.name)) return { why: '"What am I gonna do with that?"' };
  // The fence pays less, but takes anything; whole dollars, small bills.
  const rate = x.secret ? 0.25 : x.kind === 'phone' ? 0.08 : 0.12;
  return { cents: Math.max(100, Math.floor(v * rate) * 100) };
}

// ---------- What the pawn shop sells ----------

export interface Stock {
  id: string;
  name: string;
  price: number;
  desc: string;
  /** Something to wear: which slot it goes in. */
  slot?: 'top' | 'bottom' | 'bag';
}

export const PAWN_STOCK: Stock[] = [
  { id: 'backpack', name: 'Backpack', price: 25, desc: 'Large things, 12 kg. Faded, one strap fixed with tape.', slot: 'bag' },
  { id: 'shoulder', name: 'Shoulder bag', price: 14, desc: 'Medium things, 5 kg.', slot: 'bag' },
  { id: 'fanny', name: 'Fanny pack', price: 6, desc: 'A zip pouch for small things, 1.2 kg.', slot: 'bag' },
  { id: 'coat', name: 'Coat', price: 28, desc: 'Warm in the rain. Three pockets.', slot: 'top' },
  { id: 'puffer', name: 'Puffer jacket', price: 32, desc: 'Warmest there is. Three pockets.', slot: 'top' },
  { id: 'hoodie', name: 'Hoodie', price: 14, desc: 'One big front pocket.', slot: 'top' },
  { id: 'cargo', name: 'Cargo pants', price: 18, desc: 'Two cargo pockets for medium things.', slot: 'bottom' },
  { id: 'lighter', name: 'Lighter', price: 2, desc: 'A cheap plastic one.' },
];
