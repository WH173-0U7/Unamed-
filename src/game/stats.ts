/**
 * Your stats. Each one starts at level 1 and only goes up by using it:
 *
 * - **Sneak:** anything stealthy. Raises the chance your ambush (bum rush,
 *   sucker punch, shove) lands instead of being blocked, dodged or countered,
 *   and makes you harder to notice while following someone. Trained by
 *   surveilling and ambushing.
 * - **Strength:** how much damage you do with your body (and, later, melee
 *   weapons, especially blunt ones). Trained by landing blows.
 * - **Agility:** how often your blows land, and how often you dodge theirs.
 *   Trained by landing blows and by dodging.
 * - **Stamina:** how long you can keep fighting before you're exhausted, and
 *   how fast you get your breath back. Trained by exhausting yourself.
 * - **Intimidation:** how scared people are of you: scared people give up
 *   without a fight, hand over what they've got, and tell you what you want
 *   to know. Trained by threatening, mugging and torturing.
 */

export type StatName = 'sneak' | 'strength' | 'agility' | 'stamina' | 'intimidation';

export interface Stat {
  level: number;
  /** Progress towards the next level. */
  xp: number;
}

export type Stats = Record<StatName, Stat>;

export const STAT_NAMES: Record<StatName, string> = {
  sneak: 'Sneak',
  strength: 'Strength',
  agility: 'Agility',
  stamina: 'Stamina',
  intimidation: 'Intimidation',
};
/** Shorter names for the stats along the top of a small screen. */
export const STAT_SHORT: Record<StatName, string> = { sneak: 'Snk', strength: 'Str', agility: 'Agi', stamina: 'Stm', intimidation: 'Int' };

export const MAX_LEVEL = 20;

export function newStats(): Stats {
  return {
    sneak: { level: 1, xp: 0 },
    strength: { level: 1, xp: 0 },
    agility: { level: 1, xp: 0 },
    stamina: { level: 1, xp: 0 },
    intimidation: { level: 1, xp: 0 },
  };
}

/** Experience needed to go from this level to the next. */
export const xpToNext = (level: number) => 15 + level * 15;

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

/** Sneak: extra chance for an ambush to land (+4% a level). */
export const ambushBonus = (s: Stats) => (s.sneak.level - 1) * 0.04;
/** Sneak: how fast you get noticed while following (lower is better). */
export const noticeRate = (s: Stats) => 1 / (1 + (s.sneak.level - 1) * 0.1);
/** Strength: damage multiplier for physical blows (+8% a level). */
export const damageMult = (s: Stats) => 1 + (s.strength.level - 1) * 0.08;
/** Agility: extra chance your blows land (+3% a level). */
export const accuracyBonus = (s: Stats) => (s.agility.level - 1) * 0.03;
/** Agility: less chance their blows land on you (−2.5% a level). */
export const dodgeBonus = (s: Stats) => (s.agility.level - 1) * 0.025;
/** Stamina: how much you have (+6 a level). */
export const maxStamina = (s: Stats) => 100 + (s.stamina.level - 1) * 6;
/** Stamina: how much comes back each turn (+0.6 a level). */
export const staminaRegen = (s: Stats) => 7 + (s.stamina.level - 1) * 0.6;
/** Intimidation: how much more scared of you people are (+3 fear a level). */
export const fearBonus = (s: Stats) => (s.intimidation.level - 1) * 3;
