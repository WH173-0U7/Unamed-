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
export type Slot = 'head' | 'face' | 'eyes' | 'hands';

export interface Cover {
  name: string;
  slot: Slot;
  /** How much of your face it hides (0..1) when it's on. */
  hides: number;
  /** How much it hides from a camera up on a wall (a cap's brim does more against a camera than a face). */
  cam?: number;
  /** Draws attention: people notice you faster while it's on. */
  loud?: boolean;
  /** Draws a lot of it: patrols stop you more, and nobody believes it's for the cold. */
  veryLoud?: boolean;
}

export const COVERS: Cover[] = [
  { name: 'Ski mask', slot: 'face', hides: 0.9, cam: 0.9, loud: true },
  { name: 'Balaclava', slot: 'face', hides: 0.95, cam: 0.95, loud: true, veryLoud: true },
  { name: 'Bandana', slot: 'face', hides: 0.55, cam: 0.5, loud: true },
  { name: 'Neck gaiter', slot: 'face', hides: 0.45, cam: 0.45 },
  { name: 'Surgical mask', slot: 'face', hides: 0.4, cam: 0.4 },
  { name: 'Baseball cap', slot: 'head', hides: 0.12, cam: 0.3 },
  { name: 'Low cap', slot: 'head', hides: 0.15, cam: 0.42 },
  { name: 'Wide-brim hat', slot: 'head', hides: 0.18, cam: 0.45 },
  { name: 'Beanie', slot: 'head', hides: 0.1, cam: 0.15 },
  { name: 'Sunglasses', slot: 'eyes', hides: 0.25, cam: 0.2 },
  { name: 'Clear glasses', slot: 'eyes', hides: 0.08, cam: 0.06 },
  { name: 'Gloves', slot: 'hands', hides: 0, cam: 0 },
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
  /** Gloves on (no prints left behind). */
  hands?: string;
  /** A reversible jacket worn inside out (the other colour showing). */
  flipped?: boolean;
}

export const hasHood = (inv: Inventory) => /hoodie|parka|windbreaker|puffer|rain jacket/i.test(inv.clothes[0] ?? '');

/** How much a top keeps the rain and cold out: lower is better (it scales the chance of getting colder). */
export function topColdFactor(top: string): number {
  const t = top.toLowerCase();
  if (/rain jacket/.test(t)) return 0.25;
  if (/puffer|parka/.test(t)) return 0.4;
  if (/coat|leather|layered/.test(t)) return 0.5;
  if (/windbreaker/.test(t)) return 0.7;
  if (/hoodie|flannel/.test(t)) return 0.85;
  if (/jacket|blazer/.test(t)) return 0.8;
  if (/t-shirt|shirt/.test(t)) return 1.4;
  return 1;
}
/** What's on your head, against the cold: a beanie, a hood up, a cap (no better than ×0.7 together). */
export function headColdFactor(inv: Inventory): number {
  const w = wearing(inv);
  let k = 1;
  if (/beanie/i.test(w.head ?? '')) k *= 0.8;
  else if (/cap/i.test(w.head ?? '')) k *= 0.95;
  if (w.hood && hasHood(inv)) k *= 0.8;
  return Math.max(0.7, k);
}
/** How quickly the rain and snow get to you, as you're dressed (1 is ordinary). */
export const coldFactor = (inv: Inventory) => topColdFactor(inv.clothes[0] ?? '') * headColdFactor(inv);
/** A word for a top's warmth, for a shop's shelf. */
export const warmthWord = (k: number) => (k <= 0.45 ? 'high' : k <= 0.6 ? 'good' : k <= 0.9 ? 'some' : 'little');

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
/** How hard you are to make out on a camera up on the wall, 0..1 (brims and hoods count for more). */
export function camAnonymity(inv: Inventory): number {
  const w = wearing(inv);
  const parts: number[] = [];
  const c = (n?: string) => (n ? (coverByName(n)?.cam ?? coverByName(n)?.hides ?? 0) : 0);
  if (w.head) parts.push(c(w.head));
  if (w.face && w.masked) parts.push(c(w.face));
  if (w.eyes) parts.push(c(w.eyes));
  if (w.hood && hasHood(inv)) parts.push(0.3);
  return Math.min(0.97, 1 - parts.reduce((k, a) => k * (1 - a), 1));
}
/** How much of your face shows, in a word (for Pockets). */
export const faceWord = (a: number) => (a >= 0.75 ? 'hidden' : a >= 0.5 ? 'mostly hidden' : a >= 0.2 ? 'partly hidden' : 'visible');
/** Gloves on: no prints. */
export const gloved = (inv: Inventory) => !!wearing(inv).hands;
/** Something over your face that nobody takes for anything but what it is. */
export const veryConspicuous = (inv: Inventory) => {
  const w = wearing(inv);
  return !!(w.face && w.masked && coverByName(w.face)?.veryLoud);
};
/** Your top, as people see it (a reversible jacket shows one side or the other). */
export const topSeen = (inv: Inventory) => {
  const top = inv.clothes[0];
  return top && /reversible/i.test(top) ? `${top} (${wearing(inv).flipped ? 'grey side out' : 'black side out'})` : top;
};

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
  if (w.eyes) bits.push(/clear/i.test(w.eyes) ? 'glasses' : 'sunglasses');
  const top = inv.clothes[0];
  if (top) bits.push(/reversible/i.test(top) ? `a ${w.flipped ? 'grey' : 'black'} jacket` : `a ${top.toLowerCase()}`);
  return bits.length ? `someone in ${bits.slice(0, 3).join(', ')}` : 'someone';
}

/** The clothes someone might know you by again. */
export const lookClothes = (inv: Inventory) => {
  const w = wearing(inv);
  return [topSeen(inv), inv.clothes[3], w.head, w.face && w.masked ? w.face : undefined].filter(Boolean) as string[];
};
