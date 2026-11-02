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
  };
}

/** Picks one option, weighted by its chance. */
export function pick<T>(table: [T, number][]): T {
  let r = Math.random() * table.reduce((n, [, c]) => n + c, 0);
  for (const [v, c] of table) if ((r -= c) < 0) return v;
  return table[table.length - 1][0];
}
