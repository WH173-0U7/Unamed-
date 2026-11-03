/**
 * Your stats. Each one starts at level 1 and only goes up by using it:
 *
 * - **Sneak:** anything stealthy. Raises the chance your ambush (bum rush,
 *   sucker punch, shove) lands instead of being blocked, dodged or countered,
 *   and makes you harder to notice while following someone. Trained by
 *   surveilling and ambushing.
 * - **Strength:** adds a little to the damage of your blows, and to how
 *   frightening you are. Trained (slowly) by landing blows.
 * - **Unarmed:** fighting with your hands, feet, knees and head: most of the
 *   damage your blows do, and the techniques you know: crude ones first (a
 *   gut punch, kneeing, a haymaker, a headbutt), skilled ones later (an
 *   uppercut, tripping, a headlock, a choke from behind). Trained by landing
 *   blows.
 * - **Agility:** how often your blows land, and how often you dodge theirs.
 *   Trained by landing blows and by dodging.
 * - **Stamina:** how long you can keep fighting before you're exhausted, and
 *   how fast you get your breath back. Trained by exhausting yourself.
 * - **Weapons:** fighting with something in your hand (a knife, a box
 *   cutter, a bottle): how hard and how often it lands. Trained by using them.
 * - **Intimidation:** how scared people are of you: scared people give up
 *   without a fight, hand over what they've got, and tell you what you want
 *   to know. Trained by threatening, mugging and torturing.
 */

export type StatName = 'sneak' | 'strength' | 'unarmed' | 'weapons' | 'agility' | 'stamina' | 'intimidation';

export interface Stat {
  level: number;
  /** Progress towards the next level. */
  xp: number;
}

export type Stats = Record<StatName, Stat>;

export const STAT_NAMES: Record<StatName, string> = {
  sneak: 'Sneak',
  strength: 'Strength',
  unarmed: 'Unarmed',
  weapons: 'Weapons',
  agility: 'Agility',
  stamina: 'Stamina',
  intimidation: 'Intimidation',
};
/** Shorter names for the stats along the top of a small screen. */
export const STAT_SHORT: Record<StatName, string> = { sneak: 'Snk', strength: 'Str', unarmed: 'Unr', weapons: 'Wpn', agility: 'Agi', stamina: 'Stm', intimidation: 'Itm' };

/** Levels go to 100, and each one takes longer than the last. */
export const MAX_LEVEL = 100;

export function newStats(): Stats {
  return {
    sneak: { level: 1, xp: 0 },
    strength: { level: 1, xp: 0 },
    unarmed: { level: 1, xp: 0 },
    weapons: { level: 1, xp: 0 },
    agility: { level: 1, xp: 0 },
    stamina: { level: 1, xp: 0 },
    intimidation: { level: 1, xp: 0 },
  };
}

/**
 * Experience needed to go from this level to the next: 15 for the first,
 * about 100 around level 10, 1,200 by 50, about 4,500 at the end. The first
 * levels come in a fight or two; the last take a very long time.
 */
export const xpToNext = (level: number) => Math.round(10 + level * 4 + level * level * 0.42);

/** Adds experience from using a stat. Returns the new level if it went up. */
export function train(stats: Stats, name: StatName, xp: number): number | null {
  const s = stats[name];
  if (s.level >= MAX_LEVEL) return null;
  s.xp += xp;
  let up: number | null = null;
  while (s.level < MAX_LEVEL && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    up = s.level;
  }
  if (s.level >= MAX_LEVEL) s.xp = 0;
  return up;
}

// Every effect is per level above 1, sized so that level 100 is a master.
/** Sneak: extra chance for an ambush to land (+0.8% a level, +79% at 100). */
export const ambushBonus = (s: Stats) => (s.sneak.level - 1) * 0.008;
/** Sneak: how fast you get noticed while following (lower is better). */
export const noticeRate = (s: Stats) => 1 / (1 + (s.sneak.level - 1) * 0.02);
/** Damage multiplier for your blows: Unarmed most (+1.2% a level), Strength a little (+0.4% a level). */
export const damageMult = (s: Stats) => 1 + unarmedDamage(s) + strengthDamage(s);
export const unarmedDamage = (s: Stats) => (s.unarmed.level - 1) * 0.012;
export const strengthDamage = (s: Stats) => (s.strength.level - 1) * 0.004;
/** Weapons: more damage (+1.2% a level) and more blows landing (+0.5% a level) with something in your hand. */
export const weaponDamage = (s: Stats) => (s.weapons.level - 1) * 0.012;
export const weaponAccuracy = (s: Stats) => (s.weapons.level - 1) * 0.005;
/** Strength: how much more scared of you people are (+0.4 fear a level). */
export const strengthFear = (s: Stats) => Math.round((s.strength.level - 1) * 0.4);
/** Strength: a better grip when you grab someone (+0.4% a level). */
export const gripBonus = (s: Stats) => (s.strength.level - 1) * 0.004;
/** Agility: extra chance your blows land (+0.6% a level). */
export const accuracyBonus = (s: Stats) => (s.agility.level - 1) * 0.006;
/** Agility: less chance their blows land on you (−0.5% a level). */
export const dodgeBonus = (s: Stats) => (s.agility.level - 1) * 0.005;
/** Stamina: how much you have (+1.2 a level). */
export const maxStamina = (s: Stats) => 100 + Math.round((s.stamina.level - 1) * 1.2);
/** Stamina: how much comes back each turn (+0.12 a level). */
export const staminaRegen = (s: Stats) => 7 + (s.stamina.level - 1) * 0.12;
/** Intimidation: how much more scared of you people are (+0.6 fear a level). */
export const fearBonus = (s: Stats) => Math.round((s.intimidation.level - 1) * 0.6);
