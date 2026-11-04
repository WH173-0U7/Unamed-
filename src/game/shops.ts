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
 * - **Gas station:** open 24/7. Cigarettes, lighters, matches, a little first
 *   aid at a markup, caps, beanies and sunglasses off the spinner, and hot
 *   coffee (warms you, and steadies you a little).
 * - **Bank:** office hours. Changes small bills and coins up into big ones,
 *   and breaks big ones down. After hours, the coin machine in the lobby
 *   still turns coins into bills, for a cut.
 */
export type Place = 'street' | 'pharmacy' | 'gas' | 'liquor' | 'pawn' | 'fence' | 'bank' | 'records' | 'hospital' | 'guns';

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
    desc: 'Bandages, painkillers, splints.',
    hours: null,
    blurb: 'Open all night. A fluorescent hum, and a bored clerk behind the plexiglass.',
    indoors: true,
  },
  {
    id: 'gas',
    name: 'Nite Owl Gas',
    desc: 'Smokes, lighters, first aid, hot coffee, masks and shades.',
    hours: null,
    blurb: 'Two pumps, one working. Hot dogs turning under a lamp, and a clerk behind scratched glass who has seen it all.',
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
    desc: 'Someone back there buys anything stolen.',
    hours: EVERY(20, 4),
    blurb: 'Behind the laundromat, in the steam from the vents. He keeps his hands in his pockets and his eyes on the street.',
    indoors: false,
  },
  {
    id: 'liquor',
    name: 'Corner Liquors',
    desc: 'Beer, wine and spirits. They check ID.',
    hours: EVERY(10, 2),
    blurb: 'Bars on the windows, bottles floor to ceiling, and a sign by the till: WE ID EVERYONE.',
    indoors: true,
  },
  {
    id: 'hospital',
    name: 'County General ER',
    desc: 'Stitches, casts, blood. Self-pay, and a long wait.',
    hours: null,
    blurb: 'Bright lights, a smell of bleach, rows of bolted chairs. A man holding a towel to his head; a woman asleep sitting up. Triage looks at you without much interest.',
    indoors: true,
  },
  {
    id: 'guns',
    name: 'Ironside Firearms',
    desc: 'Handguns, a shotgun, ammunition. Your own ID and a background check.',
    hours: [[12, 17], [10, 19], [10, 19], [10, 19], [10, 19], [10, 19], [10, 19]],
    blurb: 'Rifles racked behind the counter, glass cases of handguns, a camera over the door and a man with a holstered pistol who watches your hands.',
    indoors: true,
  },
  {
    id: 'records',
    name: 'City Records Office',
    desc: 'Get your State ID made.',
    hours: WEEKDAYS(9, 16),
    blurb: 'A long room of plastic chairs and a ticket machine. Everyone looks like they have been waiting forever.',
    indoors: true,
  },
  {
    id: 'bank',
    name: 'First Civic Bank',
    desc: 'Change money, and keep it in an account (with ID). A coin machine in the lobby, any hour.',
    hours: WEEKDAYS(9, 17, [9, 13]),
    blurb: 'Marble and quiet. A guard by the door watches you come in.',
    indoors: true,
  },
];
export const placeInfo = (p: Place) => PLACES.find((x) => x.id === p)!;
/** Places that exist but aren't open to the player yet (the gun store: not yet). Remove one to bring it back. */
export const HIDDEN_PLACES: ReadonlySet<Place> = new Set<Place>(['guns']);

/** The bank lobby (coin machine) is open all hours. */
export const COIN_MACHINE_FEE = 0.1;

// ---------- What things are worth (to someone who'd buy them new) ----------

export function worth(x: Pick<InvItem, 'kind' | 'name' | 'med' | 'secret' | 'known' | 'doses'>): number {
  const n = x.name.toLowerCase();
  // Not knowing what it is, nobody can tell you what it's worth (or give it away).
  if (x.secret && !x.known) return x.secret === 'cocaine' ? 40 : 20;
  if (x.secret === 'cocaine') return 60 * (x.doses ?? 1);
  if (x.secret && x.secret !== 'empty') return { heroin: 40, fentanyl: 50, meth: 35, tranq: 15 }[x.secret];
  if (x.med) return { bandages: 8, gauze: 15, painkillers: 6, splint: 22, iron: 12, testkit: 10, caffeine: 5 }[x.med];
  if (x.kind === 'phone') return 180;
  if (/^laptop$/i.test(n)) return 300;
  if (/phone charger/i.test(n)) return 5;
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
  if (/^beer$/.test(n)) return 3;
  if (/energy drink/.test(n)) return 3;
  if (/vodka|whiskey|wine/.test(n)) return 2 * (x.doses ?? 0);
  if (x.kind === 'weapon') return /knife/.test(n) ? 18 : /box cutter/.test(n) ? 6 : /pepper spray/.test(n) ? 12 : 0;
  return 0;
}

/** Cents a buyer offers, or a reason they won't. */
export function offer(place: 'pawn' | 'fence', x: InvItem): { cents: number } | { why: string } {
  const v = worth(x);
  const kind = x.kind;
  if (place === 'pawn') {
    if (kind === 'id' || kind === 'credit card' || kind === 'debit card') return { why: '"I don\'t touch that."' };
    if (kind === 'car keys' || x.secret) return { why: '"Get that out of my shop."' };
    if (kind === 'weapon') return { why: '"I don\'t buy weapons off the street."' };
    if (x.med || /cigarettes|lighter|matches|groceries|lunch|receipt|note|keys|baggie/i.test(x.name)) return { why: "Not worth his time" };
    if (v <= 0) return { why: "He won't take it" };
    // Pawn shops pay a fraction, rounded down to the quarter.
    return { cents: Math.max(25, Math.floor((v * 0.2 * 100) / 25) * 25) };
  }
  // Car keys: worth something only with the car, and only while it isn't hot yet.
  if (kind === 'car keys') {
    const fresh = (x as InvItem).car === 'found' && Date.now() - ((x as InvItem).takenAt ?? 0) < 3 * 3_600_000;
    if (!fresh) return { why: (x as InvItem).car === 'found' ? '"That car\'s been reported by now. Every cop in the city has the plate."' : '"Where\'s the car? Keys on their own are nothing to me."' };
    // A chop shop pays a few hundred for a car, whatever it's worth.
    const seed = [...(x.detail ?? '')].reduce((n, ch) => n + ch.charCodeAt(0), 0);
    return { cents: (300 + (seed % 7) * 50) * 100 };
  }
  if (v <= 0 || /receipt|note|house keys|transfer|slip|photo/i.test(x.name)) return { why: '"What am I gonna do with that?"' };
  // Drugs, or a needle: that's a dealer's business, not his.
  if (x.secret || /syringe/i.test(x.name)) return { why: '"I don\'t touch that. Find a dealer."' };
  // The fence pays less, but takes anything stolen; whole dollars, small bills.
  const rate = x.kind === 'phone' ? 0.08 : 0.12;
  return { cents: Math.max(100, Math.floor(v * rate) * 100) };
}

// ---------- What the pawn shop sells ----------

export interface Stock {
  id: string;
  name: string;
  price: number;
  desc: string;
  /** Something to wear: which slot it goes in. */
  slot?: 'top' | 'bottom' | 'bag' | 'head' | 'face' | 'eyes' | 'gear';
  /** Medicine (goes in your pockets as that). */
  med?: import('./inventory').MedId;
  /** Uses (a pack of 20, a book of matches, a full lighter). */
  doses?: number;
  /** Had there and then (a hot coffee), not carried. */
  drink?: boolean;
  /** Something to drink later: beer or liquor. */
  drinkType?: 'beer' | 'liquor' | 'energy';
  /** A knife (by name, see knives.ts). */
  knife?: string;
  /** A gun (by name, see guns.ts), or a box of ammunition (how many rounds). */
  gun?: string;
  ammo?: number;
}

/** The liquor store (they check ID): every drink's swigs in `doses`. */
export const LIQUOR_STOCK: Stock[] = [
  { id: 'beer', name: 'Beer', price: 3, desc: 'One cold can. Eases the nerves and the cold.', doses: 1, drinkType: 'beer' },
  { id: 'wine', name: 'Bottle of wine', price: 9, desc: 'Cheap red. Five swigs.', doses: 5, drinkType: 'liquor' },
  { id: 'whiskey', name: 'Pint of whiskey', price: 14, desc: 'Six swigs. Burns all the way down.', doses: 6, drinkType: 'liquor' },
  { id: 'vodka', name: 'Pint of vodka', price: 12, desc: 'Six swigs, in a paper bag.', doses: 6, drinkType: 'liquor' },
];
/** Getting your own State ID made, at the Records Office. */
export const ID_FEE = 30;

/** The gas station: what's behind the counter and on the spinner. */
export const GAS_STOCK: Stock[] = [
  { id: 'coffee', name: 'Hot coffee', price: 2, desc: 'Burnt, and scalding. Warms you through; about 95 mg of caffeine.', drink: true },
  { id: 'energy', name: 'Energy drink', price: 4, desc: '160 mg of caffeine in a can. Kicks in after half an hour; lasts for hours.', doses: 1, drinkType: 'energy' },
  { id: 'cigs', name: 'Cigarettes', price: 9, desc: 'A pack of 20. Takes the edge off stress.', doses: 20 },
  { id: 'lighter', name: 'Lighter', price: 3, desc: 'Full of fuel.', doses: 100 },
  { id: 'matches', name: 'Matches', price: 1, desc: 'A book of 20.', doses: 20 },
  { id: 'bandages', name: 'Bandages', price: 11, desc: 'Slows bleeding a level. Pricier than the pharmacy.', med: 'bandages' },
  { id: 'painkillers', name: 'Painkillers', price: 8, desc: 'Takes the edge off the pain. Pricier than the pharmacy.', med: 'painkillers' },
  { id: 'bandana', name: 'Bandana', price: 8, desc: 'Over your nose and mouth. Hides about half.', slot: 'face' },
  { id: 'skimask', name: 'Ski mask', price: 18, desc: 'Off the winter rack. Hides almost all of your face. People stare.', slot: 'face' },
  { id: 'surgical', name: 'Surgical mask', price: 2, desc: 'Hides a little. Nobody looks twice.', slot: 'face' },
  { id: 'cap', name: 'Baseball cap', price: 22, desc: 'Off the spinner. Shades your eyes from cameras.', slot: 'head' },
  { id: 'beanie', name: 'Beanie', price: 16, desc: 'Covers your hair.', slot: 'head' },
  { id: 'shades', name: 'Sunglasses', price: 20, desc: 'Gas station shades. Hides your eyes.', slot: 'eyes' },
];

export const PAWN_STOCK: Stock[] = [
  { id: 'backpack', name: 'Backpack', price: 35, desc: 'Large things, 12 kg. Faded, one strap fixed with tape.', slot: 'bag' },
  { id: 'shoulder', name: 'Shoulder bag', price: 25, desc: 'Medium things, 5 kg.', slot: 'bag' },
  { id: 'fanny', name: 'Fanny pack', price: 12, desc: 'A zip pouch for small things, 1.2 kg.', slot: 'bag' },
  { id: 'coat', name: 'Coat', price: 55, desc: 'Second-hand wool, warm in the rain. Three pockets.', slot: 'top' },
  { id: 'puffer', name: 'Puffer jacket', price: 75, desc: 'Second-hand, a little flat in places, but the warmest there is. Three pockets.', slot: 'top' },
  { id: 'hoodie', name: 'Hoodie', price: 25, desc: 'Second-hand. One big front pocket.', slot: 'top' },
  { id: 'cargo', name: 'Cargo pants', price: 30, desc: 'Two cargo pockets for medium things.', slot: 'bottom' },
  { id: 'lighter', name: 'Lighter', price: 2, desc: 'A cheap plastic one.' },
  // Legal knives, in the case by the till (he still wants your ID).
  { id: 'k-pocket', name: 'Pocket knife', price: 10, desc: 'A little slip joint. Two hands to open.', knife: 'Pocket knife' },
  { id: 'k-lockback', name: 'Lockback folder', price: 22, desc: 'Locks open; one thumb, with practice.', knife: 'Lockback folder' },
  { id: 'k-assisted', name: 'Assisted-opening knife', price: 30, desc: 'Flips open on a spring.', knife: 'Assisted-opening knife' },
  { id: 'k-hunting', name: 'Hunting knife', price: 35, desc: 'A fixed blade in a leather sheath.', knife: 'Hunting knife' },
  // For carrying a blade out of sight.
  { id: 'beltsheath', name: 'Belt sheath', price: 18, desc: 'Holds a knife (up to a hunting knife) on your belt, ready to hand. Hidden under a jacket, coat or hoodie; on show under a T-shirt.', slot: 'gear' },
  { id: 'anklesheath', name: 'Ankle sheath', price: 28, desc: 'A small knife strapped above your ankle, under your trouser leg. Nobody sees it; getting it out in a fight takes a turn.', slot: 'gear' },
  { id: 'cap', name: 'Baseball cap', price: 12, desc: 'Second-hand. Shades your eyes from cameras.', slot: 'head' },
  { id: 'beanie', name: 'Beanie', price: 10, desc: 'Second-hand. Covers your hair.', slot: 'head' },
  { id: 'shades', name: 'Sunglasses', price: 25, desc: 'A decent used pair from the case. Hides your eyes. At night, a bit odd.', slot: 'eyes' },
];

// ---------- The ER (self-pay) ----------
/** What the ER does, and what it costs you with no insurance (dollars). */
export const ER_PRICES = { stitches: 80, nose: 60, cast: 150, lung: 250, blood: 200 } as const;
export type ErCare = keyof typeof ER_PRICES;

// ---------- The gun store (your own ID, and a background check) ----------
export const GUN_STOCK: Stock[] = [
  { id: 'g-9mm', name: 'Compact 9mm pistol', price: 480, desc: 'Fifteen rounds. Light enough for a holster or a cargo pocket.', gun: 'Compact 9mm pistol' },
  { id: 'g-38', name: '.38 revolver', price: 420, desc: 'Five rounds. Never jams; kicks hard.', gun: '.38 revolver' },
  { id: 'g-shotgun', name: 'Pump shotgun', price: 350, desc: 'Five shells. Devastating up close; impossible to hide.', gun: 'Pump shotgun' },
  { id: 'a-9mm', name: '9mm rounds', price: 28, desc: 'A box of 50.', ammo: 50 },
  { id: 'a-38', name: '.38 rounds', price: 32, desc: 'A box of 50.', ammo: 50 },
  { id: 'a-12', name: '12-gauge shells', price: 25, desc: 'A box of 25.', ammo: 25 },
  { id: 'holster', name: 'Holster', price: 35, desc: 'Inside the waistband, for a handgun: ready to draw. Hidden under a jacket, coat or hoodie; on show under a T-shirt.', slot: 'gear' },
];
