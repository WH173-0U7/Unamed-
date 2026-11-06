import { idCard, makeHome, nameFor, yourName, type Home, type IdCard } from './homes';
import { pickKnife } from './knives';
import type { MedId } from './inventory';
import { cashLike, cents, type Purse } from './money';

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
  /** A syringe: what's in it. */
  drug?: Drug;
  /** A bottle: swigs of whatever's left in it. */
  swigs?: number;
}

/**
 * How someone is, inside: it decides how easily they scare and give up,
 * whether they run or fight, whether they lie to you, how they talk, and a
 * little of what they carry. You can read it by watching them (Surveil).
 */
export type Personality = 'timid' | 'jumpy' | 'calm' | 'sly' | 'proud' | 'hothead' | 'hard';

export interface PersonalityInfo {
  name: string;
  /** What watching them tells you. */
  desc: string;
  /** Added to how scared of you they start. */
  fear: number;
  /** How much of how frightening you are gets to them (1 all of it). */
  cowed: number;
  /** The most likely they ever are to give up when told to. */
  maxYield: number;
  /** Added to the chance they give up when told to (and to how soon they give up on their own). */
  yield: number;
  /** How much more (or less) they run for it. */
  flee: number;
  /** Added to the chance they come at you instead of running. */
  fight: number;
  /** How likely they are to tell the truth, scared (1 normal). */
  truth: number;
  /** How likely they are to keep something back when they empty their pockets (1 normal). */
  holdBack: number;
  /** More likely to carry these (name: extra chance). */
  carry?: Record<string, number>;
}

export const PERSONALITIES: Record<Personality, PersonalityInfo> = {
  timid: { name: 'Timid', desc: 'Shoulders hunched, eyes down. Scares easily.', fear: 20, cowed: 1.2, maxYield: 0.95, yield: 0.12, flee: 1.4, fight: -0.15, truth: 1.2, holdBack: 0.5, carry: { 'Pepper spray': 0.15 } },
  jumpy: { name: 'Jumpy', desc: 'Twitchy, always looking around. More likely to run than fight.', fear: 10, cowed: 1.1, maxYield: 0.9, yield: 0.05, flee: 1.8, fight: -0.05, truth: 0.9, holdBack: 0.9, carry: { 'Pepper spray': 0.1 } },
  calm: { name: 'Calm', desc: 'Unhurried. Hard to read.', fear: 0, cowed: 1, maxYield: 0.9, yield: 0, flee: 1, fight: 0, truth: 1, holdBack: 1 },
  sly: { name: 'Sly', desc: 'Watchful, a little smile. Will say whatever gets them out of it.', fear: 0, cowed: 0.9, maxYield: 0.9, yield: 0.05, flee: 1.2, fight: -0.05, truth: 0.4, holdBack: 1.8 },
  proud: { name: 'Proud', desc: 'Chin up, takes up the sidewalk. Hates to lose face.', fear: -10, cowed: 0.75, maxYield: 0.8, yield: -0.1, flee: 0.6, fight: 0.1, truth: 1, holdBack: 1.3 },
  hothead: { name: 'Hothead', desc: 'Already angry about something. Quick to swing.', fear: -15, cowed: 0.7, maxYield: 0.75, yield: -0.08, flee: 0.5, fight: 0.3, truth: 0.8, holdBack: 1, carry: { Knife: 0.12, 'Box cutter': 0.1, Bottle: 0.1 } },
  hard: { name: 'Hard', desc: "Seen worse than you. Won't scare, won't run.", fear: -22, cowed: 0.5, maxYield: 0.6, yield: -0.15, flee: 0.3, fight: 0.2, truth: 1, holdBack: 1.4, carry: { Knife: 0.1 } },
};
const PERSONALITY_CHANCES: Record<Kind, [Personality, number][]> = {
  civilian: [['timid', 3], ['jumpy', 2], ['calm', 3], ['sly', 1], ['proud', 2], ['hothead', 1], ['hard', 0.5]],
  drunk: [['timid', 0.5], ['jumpy', 1], ['calm', 1], ['sly', 1], ['proud', 2], ['hothead', 4], ['hard', 1.5]],
  homeless: [['timid', 2], ['jumpy', 2], ['calm', 2], ['sly', 2], ['proud', 1], ['hothead', 1], ['hard', 2]],
  junkie: [['timid', 1], ['jumpy', 4], ['calm', 0.5], ['sly', 3], ['proud', 0.5], ['hothead', 1.5], ['hard', 1]],
};
/** Their personality (people from before personalities were counted are calm). */
export const personalityOf = (p: Person): PersonalityInfo => PERSONALITIES[p.personality ?? 'calm'];

/** What can be in a junkie's syringe (or nothing: a used, empty one). */
export type Drug = 'heroin' | 'fentanyl' | 'meth' | 'tranq' | 'empty';
export type Secret = 'cocaine' | Drug;
const DRUG_CHANCES: [Drug, number][] = [
  // Hardly anyone walks around with a loaded rig: almost always it's used.
  ['heroin', 4],
  ['fentanyl', 3],
  ['meth', 2],
  ['tranq', 1],
  ['empty', 90],
];

export interface Person {
  kind: Kind;
  /** Who they are on paper (what's on their ID), and where they live. */
  name?: string;
  age?: number;
  home?: Home | null;
  /** What the card calls them, when it isn't their kind (Dez's man). */
  title?: string;
  /** How they are, inside (see PERSONALITIES). */
  personality?: Personality;
  race: Race;
  sex: Sex;
  build: Build;
  awareness: Awareness;
  carrying: Item[];
  /** What they're wearing (and any bags): each can be searched for loot. */
  clothes: Garment[];
  /** They went through a dead you's pockets (see legacy.ts). Never shown. */
  thief?: string;
  /** Someone you've met before (see people.ts). */
  known?: string;
}

/** Things you can take off someone. */
export type LootKind = 'cash' | 'phone' | 'car keys' | 'id' | 'credit card' | 'debit card' | 'weapon' | 'misc';

export interface Loot {
  kind: LootKind | 'med';
  name: string;
  /** More about it: whose card, what the note says. */
  detail?: string;
  /** Dollars, for cash (the total of `purse`). */
  cash?: number;
  /** For cash: the actual bills and coins. */
  purse?: Purse;
  /** Where on them it was ("back pocket", "wallet"). */
  where: string;
  /** Medicine: which one (it was yours once). */
  med?: MedId;
  /** It belonged to one of your dead characters. */
  yours?: boolean;
  /** What it really is, if that's not obvious (a baggie of powder: 'cocaine'; what's in a syringe). */
  secret?: Secret;
  /** Found out what it is. */
  known?: boolean;
  /** How many uses are left (a baggie). */
  doses?: number;
  /** Kept back when they turned out their pockets for you (a pat-down finds it). */
  hidden?: boolean;
  /** A card's PIN, as they told it you, and whether it was the truth (never shown). */
  pin?: string;
  pinOk?: boolean;
  /** A card already used at the cash machine (it's been stopped). */
  drained?: boolean;
  /** Something to drink (uses in `doses`). */
  drink?: 'beer' | 'liquor' | 'energy';
  /** Car keys: the car's state, carried over if they're taken off you and found again. */
  car?: 'found' | 'gone';
  carSearched?: boolean;
  takenAt?: number;
  /** Something to hurt people with (see Item): extra damage, a blade, pepper spray. */
  weapon?: number;
  cuts?: boolean;
  spray?: boolean;
  /** An ID: everything printed on it, and the home at that address. */
  card?: IdCard;
  homeInfo?: Home;
  /** House keys: which home they open. */
  opens?: string;
  /** Taken in a break-in: stolen goods, if anyone looks. */
  hot?: boolean;
  /** Car keys: the car out front of this home. */
  carOf?: string;
  /** Car keys: the car you found with them, and where it is before you have (see cars.ts). */
  carId?: string;
  hunt?: import('./cars').Hunt;
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
  civilian: 'Passerby',
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
    // Plenty of people carry a little folding knife, and never think of it as a weapon.
    [{ name: 'Knife', weapon: 5, cuts: true }, 0.06],
    [{ name: 'Wallet' }, 0.7],
    [{ name: 'Keys' }, 0.7],
    [{ name: 'Cash' }, 0.35],
    [{ name: 'Cigarettes' }, 0.25],
    [{ name: 'Backpack' }, 0.2],
    [{ name: 'Grocery bag' }, 0.15],
    [{ name: 'Pepper spray', spray: true }, 0.12],
  ],
  drunk: [
    // A whole bottle is a club, not a blade (it often doesn't even break).
    [{ name: 'Bottle', weapon: 4 }, 0.5],
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
    [{ name: 'Syringe', weapon: 3, cuts: true }, 0.3],
    [{ name: 'Lighter' }, 0.6],
    [{ name: 'Cigarettes' }, 0.55],
    [{ name: 'Small baggie' }, 0.5],
    [{ name: 'Loose change' }, 0.3],
    [{ name: 'Phone' }, 0.2],
    [{ name: 'Box cutter', weapon: 5, cuts: true }, 0.2],
  ],
};

/** A new random person (who you saw this lurk). */
export function makePerson(): Person {
  const kind = pick(CHANCES);
  const personality = pick(PERSONALITY_CHANCES[kind]);
  const extra = PERSONALITIES[personality].carry ?? {};
  const carrying = ITEMS[kind].filter(([item, c]) => Math.random() < c + (extra[item.name] ?? 0)).map(([item]) => ({ ...item }));
  // Some carry things their kind usually doesn't (a timid civilian, pepper spray; a hothead, a blade).
  for (const [name, c] of Object.entries(extra)) {
    if (carrying.some((i) => i.name === name) || ITEMS[kind].some(([i]) => i.name === name) || Math.random() >= c) continue;
    const item = Object.values(ITEMS).flat().find(([i]) => i.name === name)?.[0];
    if (item) carrying.push({ ...item });
  }
  // A junkie's syringe has something in it (or it's spent); a drunk's bottle, the last of the whiskey.
  for (const it of carrying) if (it.name === 'Syringe') it.drug = pick(DRUG_CHANCES);
  for (const it of carrying) if (it.name === 'Bottle') it.swigs = Math.floor(Math.random() * 5);
  // "A knife": which one.
  for (const it of carrying)
    if (it.name === 'Knife') {
      const k = pickKnife(kind, personality);
      it.name = k.name;
      it.weapon = k.dmg;
    }
  const race = pick(RACE_CHANCES);
  const sex: Sex = Math.random() < 0.5 ? 'Male' : 'Female';
  const build = pick(BUILD_CHANCES[kind]);
  const name = nameFor(sex, race);
  const age = 19 + Math.floor(Math.random() * 50);
  const home = makeHome({ name, sex, kind, age });
  return {
    kind,
    personality,
    name,
    age,
    home,
    race,
    sex,
    build,
    awareness: pick(AWARENESS_CHANCES[kind]),
    carrying,
    clothes: dress(kind, carrying, { name, age, sex, race, build, home }),
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

/** A name for someone (or for you, when you start as someone new). */
export const randomName = yourName;
const STORES = ['Corner Mart', 'Gas & Go', "Lucky's Liquor", 'Dollar Barn', 'Pho 88', 'QuickWash Laundromat', 'Night Owl Diner', 'Rite Way Pharmacy', 'Metro Transit'];
const NOTES = [
  'A note: "Call Dee back. Don\'t tell Mom."',
  'A folded note with a phone number and one word: "tonight."',
  'A shopping list: milk, bread, eggs, insulin.',
  'A pawn slip for a gold ring.',
  'A bus transfer, already expired.',
  'A photo of a kid, worn soft at the corners.',
  'A note: "Rent is late again. Last warning." It\'s signed by the landlord.',
  'An appointment card for a clinic, next Tuesday at 9:15.',
  'A note with an address on it, and "back door, after 2."',
  'A lottery ticket. Not a winner.',
];
const PHONES = ['Cracked screen', 'Locked with a passcode', 'An old flip phone', 'Battery nearly dead', 'In a glitter case', 'A dog on the lock screen'];
const CARS = ['Toyota', 'Honda', 'Ford', 'Chevy', 'Nissan', 'Hyundai', 'Dodge'];

const r = Math.random;
const money = (a: number, b: number) => Math.round((a + r() * (b - a)) * 100) / 100;
const any = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];

/** Cash, as bills and coins (whole dollars unless it's change). */
export function cash(dollars: number, style: 'wallet' | 'small' | 'change', name = 'Cash'): Omit<Loot, 'where'> {
  const purse = cashLike(style === 'change' ? dollars * 100 : Math.max(1, Math.round(dollars)) * 100, style);
  return { kind: 'cash', name, cash: cents(purse) / 100, purse };
}

/** Made-up brands. */
const SMOKES = ['Red Crest', 'Mayfair Lights', 'Dakota Menthols', 'Ridgeway Reds', 'Union Blues', 'Harbor 100s'];

function receipt(): Omit<Loot, 'where'> {
  return { kind: 'misc', name: 'Receipt', detail: `${any(STORES)}, $${money(2, 60).toFixed(2)}` };
}
function note(): Omit<Loot, 'where'> {
  return { kind: 'misc', name: 'Note', detail: any(NOTES) };
}

/** Their clothes, with what they carry put in the pockets. */
function dress(kind: Kind, carrying: Item[], who: { name: string; age: number; sex: Sex; race: Race; build: Build; home: Home | null }): Garment[] {
  const [tops, bottoms, shoes] = OUTFITS[kind];
  const clothes: Garment[] = [tops, bottoms, shoes].map((list) => ({ name: any(list), loot: [], searched: false }));
  const has = (n: string) => carrying.some((i) => i.name === n);
  if (has('Backpack')) clothes.push({ name: 'Backpack', loot: [], searched: false });
  if (has('Grocery bag')) clothes.push({ name: 'Grocery bag', loot: [], searched: false });
  // Shoes only hide things on purpose; everything else goes in pockets and bags.
  const pockets = clothes.filter((g) => !/shoe|boot|sneaker|loafer|slide/i.test(g.name));
  const put = (l: Omit<Loot, 'where'>, g = any(pockets), where?: string) => g.loot.push({ ...l, where: where ?? any(spotsOf(g.name)) });

  const { name, age, home } = who;
  // The address on their ID: home, or (for someone on the street) the last place that was.
  const addr = home?.addr ?? `${100 + Math.floor(r() * 900)} Pier St (Harbor Light Mission)`;
  const card = (dl: boolean, expired = false) => ({ card: idCard({ ...who, addr, dl, expired }), ...(home ? { homeInfo: home } : {}) });
  if (has('Wallet')) {
    // The wallet: back pocket of the trousers, or inside the jacket.
    const g = r() < 0.6 ? clothes[1] : clothes[0];
    const w = (l: Omit<Loot, 'where'>) => put(l, g, 'wallet');
    const dl = kind === 'civilian' || r() < 0.5;
    if (r() < 0.92) w({ kind: 'id', name: dl ? "Driver's license" : 'State ID', detail: `${name}, ${age}`, ...card(dl) });
    if (r() < 0.85) w({ kind: 'debit card', name: 'Debit card', detail: name });
    if (r() < (kind === 'civilian' ? 0.6 : 0.3)) w({ kind: 'credit card', name: 'Credit card', detail: name });
    if (r() < 0.8) w(cash(kind === 'civilian' ? money(5, 140) : money(2, 45), 'wallet'));
    for (let i = 0; i < Math.floor(r() * 3); i++) w(receipt());
  } else if (kind === 'homeless' && r() < 0.5) {
    put({ kind: 'id', name: 'State ID, expired', detail: `${name}, ${age}`, ...card(false, true) });
  }
  if (has('Cash')) put(cash(money(5, 80), 'wallet', 'Folded bills'));
  if (has('Loose change')) put(cash(money(0.25, 4.5), 'change', 'Loose change'));
  if (kind === 'homeless' && r() < 0.3) put(cash(money(3, 30), 'small', 'Folded bills'), clothes[2], 'left shoe');
  // A junkie out at night has usually hustled up something: enough for a bag, maybe.
  if (kind === 'junkie' && r() < 0.55) put(cash(money(4, 28), 'small', 'Crumpled bills'));
  if (has('Phone')) put({ kind: 'phone', name: 'Cell phone', detail: any(PHONES) });
  if (has('Keys')) {
    // Car keys (theirs, parked somewhere), and the keys to home: usually on the same ring.
    if (kind === 'civilian' ? r() < 0.75 : r() < 0.35) put({ kind: 'car keys', name: 'Car keys', detail: `${home?.car ?? any(CARS)} key fob`, ...(home?.car ? { carOf: home.id } : {}) });
    if (home && r() < 0.85) put({ kind: 'misc', name: 'House keys', detail: home.type === 'apartment' ? 'A front-door key, a deadbolt key and a little mailbox key' : home.type === 'room' ? 'A room key on a plastic tag' : 'A front-door key and a deadbolt key', opens: home.id });
    else if (!home) put({ kind: 'misc', name: 'Keys', detail: "A ring of keys. Whose locks, who knows" });
  }
  if (has('Cigarettes')) {
    // A pack (with however many left in it), or a few loose ones in a pocket.
    if (r() < (kind === 'homeless' ? 0.35 : kind === 'junkie' ? 0.55 : 0.8)) {
      const n = kind === 'homeless' ? 1 + Math.floor(r() * 4) : 3 + Math.floor(r() * 17);
      put({ kind: 'misc', name: 'Pack of cigarettes', detail: `${any(SMOKES)}`, doses: n });
    } else put({ kind: 'misc', name: 'Loose cigarettes', doses: 1 + Math.floor(r() * 3) });
    // Smokers usually have something to light them with.
    if (!has('Lighter') && r() < 0.65) {
      if (r() < 0.25) put({ kind: 'misc', name: 'Matches', doses: 3 + Math.floor(r() * 18) });
      else put({ kind: 'misc', name: 'Lighter', doses: lighterFuel(r) });
    }
  }
  if (has('Lighter')) put({ kind: 'misc', name: 'Lighter', doses: lighterFuel(r) });
  // What's in it, nobody says. You'd have to test it, or taste it.
  if (has('Small baggie')) put({ kind: 'misc', name: 'Small baggie', detail: 'Some kind of white powder', secret: 'cocaine', doses: 2 + Math.floor(r() * 4) });
  if (has('Backpack')) {
    const bag = clothes.find((g) => g.name === 'Backpack')!;
    put({ kind: 'misc', name: any(['Phone charger', 'Water bottle', 'Notebook', 'Headphones', 'Lunch in a plastic tub']) }, bag);
    if (r() < 0.4) put(note(), bag);
  }
  if (has('Grocery bag')) {
    const bag = clothes.find((g) => g.name === 'Grocery bag')!;
    put({ kind: 'misc', name: 'Groceries', detail: any(['Bread and a carton of eggs', 'Canned soup and crackers', 'Frozen dinners', 'A bottle of wine and some limes']) }, bag);
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

/** Fuel left in someone's lighter, in percent: most are part used, some nearly dry. */
function lighterFuel(r: () => number) {
  return Math.max(4, Math.round(100 * (r() < 0.2 ? r() * 0.2 : 0.2 + r() * 0.8)));
}
