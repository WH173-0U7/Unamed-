/**
 * Knives: what kind it is changes how it handles. Each has a short
 * description (shown in your pockets), its damage, how it opens (a folder
 * has to be opened before it's any use), whether it's made to stab or to
 * slash, and how badly its wounds bleed.
 */
import type { Kind, Personality } from './person';

export interface Knife {
  name: string;
  desc: string;
  /** Extra damage. */
  dmg: number;
  /** Easier (or harder) to land than an ordinary blade. */
  hit: number;
  /** How badly it bleeds them, 0..1 (serrated teeth and razors tear). */
  bleed: number;
  /**
   * How it opens: fixed (ready), auto (a button), flip (spring assisted),
   * thumb (one-handed, if you're practised), nail (two hands and a
   * thumbnail), balisong (the handles swing round it).
   */
  open: 'fixed' | 'auto' | 'flip' | 'thumb' | 'nail' | 'balisong';
  style: 'stab' | 'slash' | 'both';
  /** No guard: a hard stab can slide your hand onto the blade. */
  noGuard?: boolean;
  /** How alarming it is if someone sees it on you, 0..1 (a little folder is a tool; a shiv says why you're out). */
  alarm: number;
}

export const KNIVES: Knife[] = [
  { name: 'Kitchen knife', desc: 'An eight-inch chef’s knife out of somebody’s kitchen. Long and wicked, but no guard: stab hard and your hand can slide onto the blade.', dmg: 8, hit: -0.02, bleed: 0.45, open: 'fixed', style: 'both', noGuard: true , alarm: 0.9 },
  { name: 'Steak knife', desc: 'A cheap serrated steak knife. Thin and flimsy, but the teeth tear rather than cut.', dmg: 5, hit: 0, bleed: 0.55, open: 'fixed', style: 'both', noGuard: true , alarm: 0.65 },
  { name: 'Pocket knife', desc: 'A little two-and-a-half-inch slip joint, the kind somebody’s grandpa carried. Opening it takes two hands and a thumbnail.', dmg: 4, hit: 0, bleed: 0.25, open: 'nail', style: 'both' , alarm: 0.25 },
  { name: 'Lockback folder', desc: 'A three-and-a-half-inch folding knife that locks open. One thumb on the stud opens it, if you’ve practiced.', dmg: 6, hit: 0, bleed: 0.35, open: 'thumb', style: 'both' , alarm: 0.35 },
  { name: 'Assisted-opening knife', desc: 'Push the flipper and a spring snaps it the rest of the way open: ready in a blink.', dmg: 6, hit: 0, bleed: 0.35, open: 'flip', style: 'both' , alarm: 0.4 },
  { name: 'Switchblade', desc: 'Press the button and the blade jumps out. Illegal to carry in a lot of places.', dmg: 6, hit: 0, bleed: 0.35, open: 'auto', style: 'stab' , alarm: 0.8 },
  { name: 'Butterfly knife', desc: 'A balisong: two handles that swing around the blade. Fast and flashy in practiced hands; in clumsy ones it bites the fingers.', dmg: 6, hit: 0, bleed: 0.35, open: 'balisong', style: 'both' , alarm: 0.8 },
  { name: 'Karambit', desc: 'A curved claw of a blade with a ring for your finger. It hooks and rips, and it’s hard to lose your grip on.', dmg: 6, hit: 0.03, bleed: 0.55, open: 'fixed', style: 'slash' , alarm: 0.85 },
  { name: 'Hunting knife', desc: 'A five-inch fixed blade in a leather sheath, with a proper guard. Heavy, plain and very sharp.', dmg: 8, hit: 0, bleed: 0.45, open: 'fixed', style: 'both' , alarm: 0.6 },
  { name: 'Serrated combat knife', desc: 'A black, half-serrated “tactical” knife bought off the internet. It saws as much as it cuts.', dmg: 8, hit: -0.02, bleed: 0.65, open: 'fixed', style: 'both' , alarm: 0.85 },
  { name: 'Straight razor', desc: 'An old barber’s razor that folds into its handle. Useless for stabbing; one slash opens skin like paper.', dmg: 5, hit: 0, bleed: 0.85, open: 'nail', style: 'slash' , alarm: 0.7 },
  { name: 'Push dagger', desc: 'A short blade on a T-shaped handle that sticks out between your fingers. You punch with it.', dmg: 6, hit: 0.05, bleed: 0.3, open: 'fixed', style: 'stab' , alarm: 0.9 },
  { name: 'Shiv', desc: 'A toothbrush handle ground to a point and wrapped in tape. It punctures; it doesn’t cut much.', dmg: 4, hit: 0, bleed: 0.15, open: 'fixed', style: 'stab' , alarm: 0.95 },
];

/** A knife by its name (null for anything that isn't one of these). */
export const knifeOf = (name: string | undefined): Knife | undefined => (name ? KNIVES.find((k) => k.name === name) : undefined);

/** Who carries what (weights). */
const BY_KIND: Record<Kind, Partial<Record<string, number>>> = {
  civilian: { 'Pocket knife': 3, 'Lockback folder': 2, 'Assisted-opening knife': 3, 'Hunting knife': 0.5, Karambit: 0.3 },
  drunk: { 'Kitchen knife': 1, 'Pocket knife': 2, 'Assisted-opening knife': 2, Switchblade: 1, 'Butterfly knife': 1 },
  homeless: { 'Kitchen knife': 3, 'Steak knife': 2, 'Pocket knife': 2, Shiv: 2, 'Hunting knife': 1, 'Lockback folder': 1 },
  junkie: { 'Steak knife': 2, 'Kitchen knife': 2, Shiv: 1.5, Switchblade: 1, 'Pocket knife': 1 },
};
const BY_PERSONALITY: Partial<Record<Personality, Partial<Record<string, number>>>> = {
  hothead: { 'Butterfly knife': 2, Switchblade: 2, 'Assisted-opening knife': 1.5, 'Kitchen knife': 1, 'Serrated combat knife': 1 },
  hard: { Karambit: 2, 'Push dagger': 1, 'Hunting knife': 2, 'Serrated combat knife': 2, Switchblade: 1, 'Straight razor': 1 },
};

/** Which knife this person has. */
export function pickKnife(kind: Kind, personality: Personality): Knife {
  const w: Record<string, number> = {};
  for (const src of [BY_KIND[kind], BY_PERSONALITY[personality] ?? {}]) for (const [k, v] of Object.entries(src)) w[k] = (w[k] ?? 0) + (v ?? 0);
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) if ((r -= v) <= 0) return knifeOf(k)!;
  return knifeOf('Pocket knife')!;
}
