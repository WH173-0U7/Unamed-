/**
 * Cars. Car keys off someone (or off the hook in their kitchen) are only worth
 * anything with the car, and finding it is legwork: walk the blocks pressing
 * the fob until something chirps. Once you've found it, it's somewhere you
 * know: go through it part by part, sleep in it, keep things in the trunk,
 * until it's reported, ticketed, and towed.
 */
import type { InvItem } from './inventory';
import type { Loot } from './person';
import type { Home } from './homes';

export type CarPart = 'glovebox' | 'console' | 'seats' | 'back' | 'trunk';
export const CAR_PARTS: CarPart[] = ['glovebox', 'console', 'seats', 'back', 'trunk'];
export const PART_NAME: Record<CarPart, string> = {
  glovebox: 'The glovebox',
  console: 'The console and cup holders',
  seats: 'Under the seats',
  back: 'The back seat',
  trunk: 'Their trunk',
};
export const PART_DESC: Record<CarPart, string> = {
  glovebox: 'Papers, and whatever people stuff in with them.',
  console: 'Change, chargers, the things people need to hand.',
  seats: 'Feel around in the dark under there.',
  back: 'Whatever got thrown in the back.',
  trunk: 'Round the back, the lid up: you’re in plain sight.',
};
const PART_SEARCH: Record<CarPart, string> = {
  glovebox: 'You pop the glovebox and go through it: the manual, the registration, napkins.',
  console: 'You go through the console and the cup holders.',
  seats: 'You run your hand under the seats, front and back.',
  back: 'You lean over into the back and go through what’s there.',
  trunk: 'You go round the back and lift the trunk lid. The little light comes on.',
};

/** Whose car it is, going by what's in it. */
export type CarOwner = 'family' | 'trade' | 'commuter' | 'mess' | 'dealer';

export interface Car {
  id: string;
  make: string;
  color: string;
  /** Where it's parked ("on Fulton Ave", "out front of 12 Ivy St"). */
  street: string;
  /** Parked outside an address you know. */
  home?: string;
  owner: CarOwner;
  /** When the keys went (the owner reports it about 3 hours on). */
  takenAt: number;
  foundAt: number;
  /** Reported, ticketed, and then one day it's gone. */
  towAt: number;
  /** The parts you've been through, and what you left in them. */
  looked?: Partial<Record<CarPart, number>>;
  left?: Partial<Record<CarPart, Loot[]>>;
  /** Your things in the trunk. */
  items: InvItem[];
  cents: number;
  /** Someone's called it in: this many more things you do there before the police come. */
  watch?: number;
  /** The police are by it (after a call): stay away till then. */
  copsUntil?: number;
  /** When you last slept in it. */
  slept?: number;
}

/** A hunt with the fob: how far the car is (in blocks), and whether it's still anywhere. Kept on the keys. */
export interface Hunt {
  dist: number;
  gone: boolean;
}
/** The search in progress (saved): which keys, what you've heard. */
export interface HuntState {
  car: string;
  heard: boolean;
  presses: number;
  blocks: number;
  /** Someone saw you trying cars. */
  watched?: boolean;
}

export const REPORTED_HOURS = 3;
export const reported = (c: { takenAt: number }, t: number) => t - c.takenAt > REPORTED_HOURS * 3_600_000;

const COLORS = ['grey', 'white', 'black', 'silver', 'dark blue', 'maroon', 'green', 'beige'];
const STREETS = ['Alder St', 'Kestrel Ave', 'Larkin St', 'Halsey Ave', 'Pruitt St', 'Ninth St', 'Cobb Ave', 'Delmar St', 'Wexford Rd', 'Bellamy St', 'Fulton Ave', 'Grand Ave', 'Ivy St', 'Tanner Rd'];
const any = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** Where the car is, the first time you go looking (rolled once, and kept with the keys). */
export function rollHunt(takenAt: number | undefined, t: number): Hunt {
  const hours = (t - (takenAt ?? t)) / 3_600_000;
  // Long enough, and it's been reported, moved on the spare, or towed.
  if (hours > REPORTED_HOURS) return { dist: 1 + Math.floor(Math.random() * 4), gone: Math.random() < 0.7 };
  // Near where you took them, at first; you've walked on since.
  return { dist: hours < 1 ? Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 4), gone: Math.random() < 0.12 };
}

/** The make, off the fob ("Honda key fob" → "Honda"). */
export const makeOf = (x: { detail?: string }) => (x.detail ?? 'Car').replace(/ key fob$/i, '');

/** A car, found: who it belongs to goes by the house, if you know it. */
export function makeCar(o: { id: string; make: string; takenAt: number; t: number; at?: Home; of?: Home }): Car {
  // (Whose it is: the house says who they are. Where it is: out front, if that's where it was.)
  const h = o.of ?? o.at;
  const r = Math.random();
  const owner: CarOwner = h
    ? h.household === 'family'
      ? r < 0.7 ? 'family' : 'mess'
      : h.wealth > 1.15
        ? r < 0.6 ? 'commuter' : r < 0.85 ? 'trade' : 'mess'
        : r < 0.35 ? 'trade' : r < 0.7 ? 'mess' : 'commuter'
    : r < 0.3 ? 'commuter' : r < 0.58 ? 'mess' : r < 0.78 ? 'family' : r < 0.95 ? 'trade' : 'dealer';
  const tow = o.takenAt + (REPORTED_HOURS + 12 + Math.random() * 60) * 3_600_000;
  return {
    id: o.id,
    make: o.make,
    color: any(COLORS),
    street: o.at ? `out front of ${o.at.addr}` : `on ${any(STREETS)}`,
    ...(o.at ? { home: o.at.id } : {}),
    owner,
    takenAt: o.takenAt,
    foundAt: o.t,
    towAt: Math.max(tow, o.t + 2 * 3_600_000),
    items: [],
    cents: 0,
  };
}

const HOT = /^(laptop|tablet)$/i;
/** What's in a part of the car, going through it the first time. */
export function partLoot(c: Car, part: CarPart): { loot: Loot[]; empty: string } {
  const r = Math.random;
  const o = c.owner;
  const out: Loot[] = [];
  const add = (l: Omit<Loot, 'where'>, where: string) => out.push({ ...l, where, ...(HOT.test(l.name) ? { hot: true } : {}) });
  const cash = (lo: number, hi: number) => Math.round(lo + r() * (hi - lo));
  let empty = 'Nothing worth taking.';
  if (part === 'glovebox') {
    if (r() < (o === 'dealer' ? 0.75 : 0.3)) add({ kind: 'cash', name: o === 'dealer' ? 'Folded bills' : 'Cash in the glovebox', cash: o === 'dealer' ? cash(80, 260) : cash(5, 60) }, 'glovebox');
    if (r() < 0.2) add({ kind: 'misc', name: 'Painkillers', med: 'painkillers' }, 'glovebox');
    if (r() < (o === 'trade' ? 0.25 : 0.08)) add({ kind: 'weapon', name: 'Pocket knife', weapon: 4, cuts: true }, 'glovebox');
    if (r() < (o === 'mess' ? 0.6 : 0.15)) add({ kind: 'misc', name: 'Parking tickets', detail: 'A wad of them, unpaid' }, 'sun visor');
    empty = 'A pen that doesn’t work, a tire gauge. Nothing worth taking.';
  } else if (part === 'console') {
    if (r() < 0.7) add({ kind: 'cash', name: 'Change from the cup holder', cash: Math.round((1 + r() * 6) * 4) / 4 }, 'cup holder');
    if (r() < 0.45) add({ kind: 'misc', name: 'Phone charger' }, 'console');
    if (r() < (o === 'trade' || o === 'mess' ? 0.4 : 0.15)) add({ kind: 'misc', name: 'Pack of cigarettes', doses: 4 + Math.floor(r() * 12) }, 'door pocket');
    if (r() < 0.05) add({ kind: 'phone', name: 'Old phone', detail: 'A spare, in the console' }, 'console');
    empty = o === 'mess' ? 'Receipts, a dried-up coffee cup, gum wrappers. Nothing worth taking.' : 'Gum, a pen, a tire gauge. Nothing worth taking.';
  } else if (part === 'seats') {
    if (r() < 0.45) add({ kind: 'cash', name: 'Loose change', cash: Math.round((0.5 + r() * 3) * 4) / 4 }, 'under the seat');
    if (r() < (o === 'dealer' ? 0.5 : 0.05)) add({ kind: 'weapon', name: o === 'dealer' ? 'Butterfly knife' : 'Pocket knife', weapon: o === 'dealer' ? 6 : 4, cuts: true }, 'under the seat');
    empty = o === 'family' ? 'Cracker crumbs, a sippy cup, one small shoe. Nothing worth taking.' : o === 'mess' ? 'Fast food bags, a lot of them. Nothing worth taking.' : 'Grit, a pen, a lost earring back. Nothing worth taking.';
  } else if (part === 'back') {
    if (o === 'commuter' && r() < 0.45) add({ kind: 'misc', name: 'Laptop', detail: 'In a bag on the back seat' }, 'back seat');
    if (o === 'family' && r() < 0.3) add({ kind: 'misc', name: 'Tablet', detail: 'A kid’s, in a rubber case' }, 'back seat');
    if (r() < 0.12) add({ kind: 'misc', name: 'Groceries', detail: 'A bag of them, going warm' }, 'back seat');
    empty = o === 'family' ? 'A car seat, juice boxes, a coloring book. Nothing worth taking.' : o === 'trade' ? 'Hi-vis vests, a hard hat, coffee cups. Nothing worth taking.' : 'An umbrella and a gym towel. Nothing worth taking.';
  } else {
    if (o === 'trade') {
      if (r() < 0.7) add({ kind: 'misc', name: 'Cordless drill', detail: 'In its case, with a spare battery' }, 'trunk');
      if (r() < 0.35) add({ kind: 'misc', name: 'Toolbox', detail: 'Heavy, and full' }, 'trunk');
    }
    // Under the spare-tire cover: what a dealer doesn't keep at home.
    if (o === 'dealer' && r() < 0.6) add({ kind: 'cash', name: 'Cash in a sock', cash: cash(200, 650) }, 'under the spare tire');
    if (o === 'commuter' && r() < 0.2) add({ kind: 'misc', name: 'Laptop', detail: 'In a bag in the trunk' }, 'trunk');
    empty = o === 'family' ? 'A folded stroller, grocery bags, the spare. Nothing worth taking.' : 'The spare, jumper cables, a blanket. Nothing worth taking.';
  }
  return { loot: out, empty };
}

export const searchLine = (part: CarPart) => PART_SEARCH[part];
