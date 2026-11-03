import type { Inventory } from './inventory';

/**
 * What covers your face, and how hard it makes you to recognise. You can
 * wear one thing on your head (a cap, a beanie), one over your face (a ski
 * mask, a bandana, a surgical mask) and sunglasses, and pull a hood up if
 * your top has one. Face coverings can be pulled up or down (Pockets).
 *
 * Anonymity (0..1) is how unlikely someone is to know your face again. A
 * mask over your face does the most, but it draws eyes: people get wary of
 * you faster while you follow them, and you take it off before you go
 * inside anywhere.
 */
export type Slot = 'head' | 'face' | 'eyes';

export interface Cover {
  name: string;
  slot: Slot;
  /** How much of your face it hides (0..1) when it's on. */
  hides: number;
  /** Draws attention: people notice you faster while it's on. */
  loud?: boolean;
}

export const COVERS: Cover[] = [
  { name: 'Ski mask', slot: 'face', hides: 0.9, loud: true },
  { name: 'Bandana', slot: 'face', hides: 0.55, loud: true },
  { name: 'Surgical mask', slot: 'face', hides: 0.4 },
  { name: 'Baseball cap', slot: 'head', hides: 0.12 },
  { name: 'Beanie', slot: 'head', hides: 0.1 },
  { name: 'Sunglasses', slot: 'eyes', hides: 0.25 },
];
export const coverByName = (n: string) => COVERS.find((c) => c.name === n);

/** What you've got on (worn, and whether the face covering and hood are up). */
export interface Wearing {
  head?: string;
  face?: string;
  eyes?: string;
  /** The face covering is pulled up (on). */
  masked?: boolean;
  /** Your hood is up (needs a top with a hood). */
  hood?: boolean;
}

export const hasHood = (inv: Inventory) => /hoodie|parka|windbreaker|puffer/i.test(inv.clothes[0] ?? '');

export function wearing(inv: Inventory): Wearing {
  return (inv.wearing ??= {});
}

/** How hard you are to recognise right now, 0..1. */
export function anonymity(inv: Inventory): number {
  const w = wearing(inv);
  const parts: number[] = [];
  if (w.head) parts.push(coverByName(w.head)?.hides ?? 0);
  if (w.face && w.masked) parts.push(coverByName(w.face)?.hides ?? 0);
  if (w.eyes) parts.push(coverByName(w.eyes)?.hides ?? 0);
  if (w.hood && hasHood(inv)) parts.push(0.2);
  return Math.min(0.97, 1 - parts.reduce((k, a) => k * (1 - a), 1));
}

/** A masked face makes people uneasy. */
export const conspicuous = (inv: Inventory) => {
  const w = wearing(inv);
  return !!(w.face && w.masked && coverByName(w.face)?.loud);
};

/** What you looked like, as someone would describe you. */
export function describe(inv: Inventory): string {
  const w = wearing(inv);
  const bits: string[] = [];
  if (w.face && w.masked) bits.push(`a ${w.face.toLowerCase()}`);
  if (w.hood && hasHood(inv)) bits.push('a hood up');
  if (w.head) bits.push(`a ${w.head.toLowerCase()}`);
  if (w.eyes) bits.push('sunglasses');
  const top = inv.clothes[0];
  if (top) bits.push(`a ${top.toLowerCase()}`);
  return bits.length ? `someone in ${bits.slice(0, 3).join(', ')}` : 'someone';
}

/** The clothes someone might know you by again. */
export const lookClothes = (inv: Inventory) => {
  const w = wearing(inv);
  return [inv.clothes[0], inv.clothes[3], w.head, w.face && w.masked ? w.face : undefined].filter(Boolean) as string[];
};
