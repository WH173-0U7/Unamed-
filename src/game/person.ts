import type { MedId } from './inventory';

/**
 * The people you can see when you lurk, and everything about them that you
 * can find out by watching (surveil) or learn the hard way (violence).
 */

export type Kind = 'homeless' | 'junkie' | 'drunk' | 'civilian';

/** Race categories: the U.S. federal standard (OMB, 2024). Descriptive only. */
export type Race =
  | 'American Indian or Alaska Native'
  | 'Asian'
  | 'Black or African American'
  | 'Hispanic or Latino'
  | 'Middle Eastern or North African'
  | 'Native Hawaiian or Pacific Islander'
  | 'White';

export type Sex = 'Male' | 'Female';

/** How alert they are, from not noticing anything to watching everything. */
export type Awareness = 'Oblivious' | 'Distracted' | 'Alert' | 'Paranoid';
export const AWARENESS: Awareness[] = ['Oblivious', 'Distracted', 'Alert', 'Paranoid'];

/** Body types, and what each means in a fight. */
export type Build = 'Frail' | 'Skinny' | 'Average' | 'Stocky' | 'Athletic' | 'Heavyset' | 'Muscular';
export type Difficulty = 'Easy' | 'Fair' | 'Hard' | 'Brutal';

export interface BuildStats {
  difficulty: Difficulty;
  /** Toughness: how much punishment it takes to put them down. */
  hp: number;
  /** How much blood they have (ml). */
  blood: number;
  /** How long they can keep fighting before they're exhausted. */
  stamina: number;
  /** How hard they hit. */
  power: number;
  /** Chance to avoid a hit (0..1). */
  guard: number;
  /** Heavy enough to stand their ground when rushed. */
  solid: boolean;
}

export const BUILDS: Record<Build, BuildStats> = {
  Frail: { difficulty: 'Easy', hp: 40, blood: 4200, stamina: 60, power: 4, guard: 0.0, solid: false },
  Skinny: { difficulty: 'Easy', hp: 50, blood: 4600, stamina: 80, power: 5, guard: 0.05, solid: false },
  Average: { difficulty: 'Fair', hp: 65, blood: 5000, stamina: 90, power: 7, guard: 0.1, solid: false },
  Stocky: { difficulty: 'Hard', hp: 80, blood: 5400, stamina: 90, power: 9, guard: 0.12, solid: true },
  Athletic: { difficulty: 'Hard', hp: 75, blood: 5200, stamina: 120, power: 9, guard: 0.25, solid: false },
  Heavyset: { difficulty: 'Hard', hp: 95, blood: 6000, stamina: 70, power: 10, guard: 0.05, solid: true },
  Muscular: { difficulty: 'Brutal', hp: 105, blood: 5800, stamina: 100, power: 13, guard: 0.18, solid: true },
};

/** Things people carry. Some can be used as weapons. */
export interface Item {
  name: string;
  /** Extra damage when used to hit you. */
  weapon?: number;
  /** A blade or a point: it cuts, so it causes bleeding. */
  cuts?: boolean;
  /** Pepper spray: blinds you instead of hurting. */
  spray?: boolean;
}

export interface Person {
  kind: Kind;
  race: Race;
  sex: Sex;
  build: Build;
  awareness: Awareness;
  carrying: Item[];
  /** What they're wearing (and any bags): each can be searched for loot. */
  clothes: Garment[];
  /** They went through a dead you's pockets (see legacy.ts). Never shown. */
  thief?: string;
}

/** Things you can take off someone. */
export type LootKind = 'cash' | 'phone' | 'car keys' | 'id' | 'credit card' | 'debit card' | 'misc';

export interface Loot {
  kind: LootKind | 'med';
  name: string;
  /** More about it: whose card, what the note says. */
  detail?: string;
  /** Dollars, for cash. */
  cash?: number;
  /** Where on them it was ("back pocket", "wallet"). */
  where: string;
  /** Medicine: which one (it was yours once). */
  med?: MedId;
  /** It belonged to one of your dead characters. */
  yours?: boolean;
}

/** Something they're wearing or carrying that can be gone through. */
export interface Garment {
  name: string;
  loot: Loot[];
  searched: boolean;
}

/** The chances of who turns up each time you lurk (out of 100). */
export const CHANCES: [Kind, number][] = [
  ['civilian', 42],
  ['drunk', 24],
  ['homeless', 20],
  ['junkie', 14],
];

/** The chances of each race for whoever turns up (equal for now). */
export const RACE_CHANCES: [Race, number][] = [
  ['American Indian or Alaska Native', 1],
  ['Asian', 1],
  ['Black or African American', 1],
  ['Hispanic or Latino', 1],
  ['Middle Eastern or North African', 1],
  ['Native Hawaiian or Pacific Islander', 1],
  ['White', 1],
];

export const NAMES: Record<Kind, string> = {
  civilian: 'Civilian',
  drunk: 'Drunk',
  homeless: 'Homeless',
  junkie: 'Junkie',
};

/** Which builds each kind of person tends to have. */
const BUILD_CHANCES: Record<Kind, [Build, number][]> = {
  civilian: [
    ['Skinny', 2],
    ['Average', 5],
    ['Stocky', 2],
    ['Athletic', 2],
    ['Heavyset', 2],
    ['Muscular', 1],
  ],
  drunk: [
    ['Skinny', 1],
    ['Average', 4],
    ['Stocky', 3],
    ['Heavyset', 3],
    ['Muscular', 1],
  ],
  homeless: [
    ['Frail', 3],
    ['Skinny', 4],
    ['Average', 3],
    ['Stocky', 1],
  ],
  junkie: [
    ['Frail', 4],
    ['Skinny', 5],
    ['Average', 2],
  ],
};

const AWARENESS_CHANCES: Record<Kind, [Awareness, number][]> = {
  civilian: [
    ['Oblivious', 1],
    ['Distracted', 4],
    ['Alert', 3],
    ['Paranoid', 1],
  ],
  drunk: [
    ['Oblivious', 5],
    ['Distracted', 3],
    ['Alert', 1],
  ],
  homeless: [
    ['Oblivious', 1],
    ['Distracted', 3],
    ['Alert', 3],
    ['Paranoid', 2],
  ],
  junkie: [
    ['Oblivious', 2],
    ['Distracted', 3],
    ['Alert', 1],
    ['Paranoid', 3],
  ],
};

/** What each kind of person might have on them, and how likely. */
const ITEMS: Record<Kind, [Item, number][]> = {
  civilian: [
    [{ name: 'Phone' }, 0.8],
    [{ name: 'Wallet' }, 0.7],
    [{ name: 'Keys' }, 0.7],
    [{ name: 'Cash' }, 0.35],
    [{ name: 'Backpack' }, 0.2],
    [{ name: 'Grocery bag' }, 0.15],
    [{ name: 'Pepper spray', spray: true }, 0.12],
  ],
  drunk: [
    [{ name: 'Bottle', weapon: 4, cuts: true }, 0.8],
    [{ name: 'Wallet' }, 0.5],
    [{ name: 'Keys' }, 0.4],
    [{ name: 'Phone' }, 0.4],
    [{ name: 'Cigarettes' }, 0.4],
    [{ name: 'Cash' }, 0.3],
  ],
  homeless: [
    [{ name: 'Shopping cart' }, 0.5],
    [{ name: 'Plastic bags' }, 0.6],
    [{ name: 'Blanket' }, 0.5],
    [{ name: 'Loose change' }, 0.5],
    [{ name: 'Cigarettes' }, 0.3],
    [{ name: 'Knife', weapon: 7, cuts: true }, 0.2],
  ],
  junkie: [
    [{ name: 'Syringe', weapon: 3, cuts: true }, 0.6],
    [{ name: 'Lighter' }, 0.6],
    [{ name: 'Small baggie' }, 0.5],
    [{ name: 'Loose change' }, 0.3],
    [{ name: 'Phone' }, 0.2],
    [{ name: 'Box cutter', weapon: 5, cuts: true }, 0.2],
  ],
};

/** A new random person (who you saw this lurk). */
export function makePerson(): Person {
  const kind = pick(CHANCES);
  const carrying = ITEMS[kind].filter(([, c]) => Math.random() < c).map(([item]) => ({ ...item }));
  return {
    kind,
    race: pick(RACE_CHANCES),
    sex: Math.random() < 0.5 ? 'Male' : 'Female',
    build: pick(BUILD_CHANCES[kind]),
    awareness: pick(AWARENESS_CHANCES[kind]),
    carrying,
    clothes: dress(kind, carrying),
  };
}

// ---------- Clothes and what's in them ----------

/** What each kind of person wears: a top, a bottom and shoes (one of each list). */
const OUTFITS: Record<Kind, [string[], string[], string[]]> = {
  civilian: [
    ['Jacket', 'Coat', 'Hoodie', 'Blazer', 'Windbreaker'],
    ['Jeans', 'Chinos', 'Slacks', 'Cargo pants'],
    ['Sneakers', 'Boots', 'Loafers'],
  ],
  drunk: [
    ['Coat', 'Flannel shirt', 'Leather jacket', 'Work jacket'],
    ['Jeans', 'Work pants'],
    ['Work boots', 'Sneakers'],
  ],
  homeless: [
    ['Layered coats', 'Army jacket', 'Torn parka'],
    ['Sweatpants', 'Dirty jeans'],
    ['Worn-out shoes', 'Mismatched boots'],
  ],
  junkie: [
    ['Hoodie', 'Puffer jacket', 'Windbreaker'],
    ['Track pants', 'Jeans'],
    ['Sneakers', 'Slides'],
  ],
};

/** Places to keep things in each kind of garment. */
function spotsOf(name: string): string[] {
  if (/grocery/i.test(name)) return ['in the bag'];
  if (/hoodie/i.test(name)) return ['front pocket'];
  if (/shirt/i.test(name)) return ['chest pocket'];
  if (/blazer|jacket|coat|parka|windbreaker/i.test(name)) return ['left pocket', 'right pocket', 'inside pocket'];
  if (/shoe|boot|sneaker|loafer|slide/i.test(name)) return ['left shoe'];
  if (/bag|backpack/i.test(name)) return ['main pocket', 'side pocket'];
  return ['front pocket', 'back pocket'];
}

const FIRST = ['Maria', 'James', 'Wei', 'Aisha', 'Diego', 'Tamika', 'Ryan', 'Priya', 'Omar', 'Hannah', 'Luis', 'Keisha', 'Daniel', 'Mei', 'Tyrone', 'Fatima', 'Kai', 'Grace', 'Marcus', 'Leilani', 'Nadia', 'Joseph', 'Ana', 'Dakota'];
const LAST = ['Lopez', 'Smith', 'Chen', 'Johnson', 'Haddad', 'Nguyen', 'Williams', 'Garcia', 'Patel', 'Brown', 'Kim', 'Davis', 'Begay', 'Rivera', 'Okafor', 'Kealoha', 'Miller', 'Mansour', 'Jackson', 'Silva', 'Murphy', 'Tran'];
const STORES = ['Corner Mart', 'Gas & Go', "Lucky's Liquor", 'Dollar Barn', 'Pho 88', 'QuickWash Laundromat', 'Night Owl Diner', 'Rite Way Pharmacy', 'Metro Transit'];
const NOTES = [
  'A note: "Call Dee back. Don\'t tell Mom."',
  'A folded note with a phone number and one word: "tonight".',
  'A shopping list: milk, bread, eggs, insulin.',
  'A pawn slip for a gold ring.',
  'A bus transfer, already expired.',
  'A photo of a kid, worn soft at the corners.',
  'A note: "Rent is late again. Last warning." It\'s signed by a landlord.',
  'An appointment card for a clinic, next Tuesday at 9:15.',
  'A note with an address on it, and "back door, after 2".',
  'A lottery ticket. Not a winner.',
];
const PHONES = ['Cracked screen', 'Locked with a passcode', 'An old flip phone', 'Battery nearly dead', 'In a glitter case', 'A wallpaper of a dog'];
const CARS = ['Toyota', 'Honda', 'Ford', 'Chevy', 'Nissan', 'Hyundai', 'Dodge'];

const r = Math.random;
const money = (a: number, b: number) => Math.round((a + r() * (b - a)) * 100) / 100;
const any = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];

function receipt(): Omit<Loot, 'where'> {
  return { kind: 'misc', name: 'Receipt', detail: `${any(STORES)}, $${money(2, 60).toFixed(2)}` };
}
function note(): Omit<Loot, 'where'> {
  return { kind: 'misc', name: 'Note', detail: any(NOTES) };
}

/** Their clothes, with what they carry put in the pockets. */
function dress(kind: Kind, carrying: Item[]): Garment[] {
  const [tops, bottoms, shoes] = OUTFITS[kind];
  const clothes: Garment[] = [tops, bottoms, shoes].map((list) => ({ name: any(list), loot: [], searched: false }));
  const has = (n: string) => carrying.some((i) => i.name === n);
  if (has('Backpack')) clothes.push({ name: 'Backpack', loot: [], searched: false });
  if (has('Grocery bag')) clothes.push({ name: 'Grocery bag', loot: [], searched: false });
  // Shoes only hide things on purpose; everything else goes in pockets and bags.
  const pockets = clothes.filter((g) => !/shoe|boot|sneaker|loafer|slide/i.test(g.name));
  const put = (l: Omit<Loot, 'where'>, g = any(pockets), where?: string) => g.loot.push({ ...l, where: where ?? any(spotsOf(g.name)) });

  const name = `${any(FIRST)} ${any(LAST)}`;
  const age = 19 + Math.floor(r() * 50);
  if (has('Wallet')) {
    // The wallet: back pocket of the trousers, or inside the jacket.
    const g = r() < 0.6 ? clothes[1] : clothes[0];
    const w = (l: Omit<Loot, 'where'>) => put(l, g, 'wallet');
    if (r() < 0.92) w({ kind: 'id', name: "Driver's license", detail: `${name}, ${age}` });
    if (r() < 0.85) w({ kind: 'debit card', name: 'Debit card', detail: name });
    if (r() < (kind === 'civilian' ? 0.6 : 0.3)) w({ kind: 'credit card', name: 'Credit card', detail: name });
    if (r() < 0.8) {
      const c = kind === 'civilian' ? money(5, 140) : money(2, 45);
      w({ kind: 'cash', name: 'Cash', cash: Math.round(c) });
    }
    for (let i = 0; i < Math.floor(r() * 3); i++) w(receipt());
  } else if (kind === 'homeless' && r() < 0.5) {
    put({ kind: 'id', name: 'State ID, expired', detail: `${name}, ${age}` });
  }
  if (has('Cash')) put({ kind: 'cash', name: 'Cash', cash: Math.round(money(5, 80)) });
  if (has('Loose change')) put({ kind: 'cash', name: 'Loose change', cash: money(0.25, 4.5) });
  if (kind === 'homeless' && r() < 0.3) put({ kind: 'cash', name: 'Cash, folded small', cash: Math.round(money(3, 30)) }, clothes[2], 'left shoe');
  if (has('Phone')) put({ kind: 'phone', name: 'Cell phone', detail: any(PHONES) });
  if (has('Keys')) {
    if (kind === 'civilian' ? r() < 0.75 : r() < 0.35) put({ kind: 'car keys', name: 'Car keys', detail: `${any(CARS)} key fob` });
    else put({ kind: 'misc', name: 'House keys', detail: 'A ring of keys' });
  }
  if (has('Cigarettes')) put({ kind: 'misc', name: 'Cigarettes', detail: `Half a pack` });
  if (has('Lighter')) put({ kind: 'misc', name: 'Lighter' });
  if (has('Small baggie')) put({ kind: 'misc', name: 'Small baggie', detail: 'Some kind of powder' });
  if (has('Backpack')) {
    const bag = clothes.find((g) => g.name === 'Backpack')!;
    put({ kind: 'misc', name: any(['Phone charger', 'Water bottle', 'Notebook', 'Headphones', 'Lunch in a plastic tub']) }, bag);
    if (r() < 0.4) put(note(), bag);
  }
  if (has('Grocery bag')) {
    const bag = clothes.find((g) => g.name === 'Grocery bag')!;
    put({ kind: 'misc', name: 'Groceries', detail: any(['Bread and a carton of eggs', 'Canned soup and crackers', 'Frozen dinners', 'A bottle of wine and limes']) }, bag);
    put(receipt(), bag, 'in the bag');
  }
  if (r() < 0.5) put(receipt());
  if (r() < 0.35) put(note());
  return clothes;
}

/** Picks one option, weighted by its chance. */
export function pick<T>(table: [T, number][]): T {
  let r = Math.random() * table.reduce((n, [, c]) => n + c, 0);
  for (const [v, c] of table) if ((r -= c) < 0) return v;
  return table[table.length - 1][0];
}
