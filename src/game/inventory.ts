import type { Loot, LootKind } from './person';
import type { Health } from './health';

/**
 * What you carry, and where. You wear clothes like everyone else, and things
 * go in their pockets, or in a bag if you have one. Small things fit in a
 * pocket; medium things need a bag (or a big pocket); large things need a
 * backpack. Each place holds only so much weight (kg). Cash weighs nothing
 * worth counting. Saved under `state.inventory`.
 */
export type Size = 'small' | 'medium' | 'large';
const SIZE_RANK: Record<Size, number> = { small: 0, medium: 1, large: 2 };

export interface InvItem {
  kind: LootKind | 'med';
  name: string;
  detail?: string;
  /** For medicine: which one (see MEDS). */
  med?: MedId;
  size: Size;
  kg: number;
  /** Which spot it's in (Spot.id). */
  spot: string;
}

/** Somewhere to keep things: a pocket, a bag. */
export interface Spot {
  id: string;
  /** "Left pocket", "Main compartment". */
  name: string;
  /** The garment or bag it's on. */
  on: string;
  /** The biggest size that fits. */
  fits: Size;
  maxKg: number;
}

export interface Inventory {
  cash: number;
  items: InvItem[];
  /** What you're wearing, and any bag. */
  clothes: string[];
  spots: Spot[];
}

// ---------- Clothes and their pockets ----------

const TOPS = ['Jacket', 'Hoodie', 'Coat', 'Flannel shirt', 'Windbreaker', 'Leather jacket', 'Puffer jacket', 'T-shirt'];
const BOTTOMS = ['Jeans', 'Cargo pants', 'Track pants', 'Chinos', 'Work pants', 'Sweatpants'];
const SHOES = ['Sneakers', 'Boots', 'Work boots', 'Running shoes'];
const BAGS: [string | null, number][] = [
  [null, 40],
  ['Backpack', 30],
  ['Shoulder bag', 18],
  ['Fanny pack', 12],
];

/** The pockets on a garment: [name, biggest size, kg]. */
function pocketsOf(g: string): [string, Size, number][] {
  if (/backpack/i.test(g)) return [['Main compartment', 'large', 12], ['Front pocket', 'small', 1]];
  if (/shoulder bag|tote/i.test(g)) return [['Inside', 'medium', 5]];
  if (/fanny/i.test(g)) return [['Zip pouch', 'small', 1.2]];
  if (/hoodie/i.test(g)) return [['Front pocket', 'small', 0.9]];
  if (/flannel|shirt$/i.test(g) && !/t-shirt/i.test(g)) return [['Chest pocket', 'small', 0.2]];
  if (/t-shirt/i.test(g)) return [];
  if (/jacket|coat|parka|windbreaker|blazer/i.test(g)) return [['Left pocket', 'small', 0.5], ['Right pocket', 'small', 0.5], ['Inside pocket', 'small', 0.4]];
  if (/cargo/i.test(g)) return [['Front left pocket', 'small', 0.4], ['Front right pocket', 'small', 0.4], ['Left cargo pocket', 'medium', 1.5], ['Right cargo pocket', 'medium', 1.5]];
  if (/track|sweat/i.test(g)) return [['Left pocket', 'small', 0.4], ['Right pocket', 'small', 0.4]];
  if (/jeans|chinos|slacks|pants/i.test(g)) return [['Front left pocket', 'small', 0.4], ['Front right pocket', 'small', 0.4], ['Back pocket', 'small', 0.3]];
  return [];
}

const spotsFor = (clothes: string[]): Spot[] =>
  clothes.flatMap((g, gi) => pocketsOf(g).map(([name, fits, maxKg], pi) => ({ id: `${gi}.${pi}`, name, on: g, fits, maxKg })));

const pickW = <T>(xs: [T, number][]) => {
  let n = Math.random() * xs.reduce((s, [, w]) => s + w, 0);
  for (const [x, w] of xs) if ((n -= w) < 0) return x;
  return xs[0][0];
};
const any = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** A new you: random clothes, maybe a bag, empty pockets. */
export function newInventory(): Inventory {
  const clothes = [any(TOPS), any(BOTTOMS), any(SHOES)];
  const bag = pickW(BAGS);
  if (bag) clothes.push(bag);
  return { cash: 0, items: [], clothes, spots: spotsFor(clothes) };
}

/** Saves from before clothes: dress them, and put what they had somewhere. */
export function upgradeInventory(inv: Inventory) {
  if (inv.spots) return;
  const fresh = newInventory();
  inv.clothes = fresh.clothes;
  inv.spots = fresh.spots;
  for (const it of inv.items) {
    const m = measure(it);
    it.size ??= m.size;
    it.kg ??= m.kg;
    // Anywhere it fits by size (ignoring weight), or a pocket regardless.
    it.spot = (inv.spots.find((s) => SIZE_RANK[s.fits] >= SIZE_RANK[it.size]) ?? inv.spots[0])?.id ?? '0.0';
  }
}

// ---------- Sizes and weights ----------

/** How big and heavy something is. */
export function measure(x: { kind: string; name: string; med?: MedId }): { size: Size; kg: number } {
  if (x.med) return { size: x.med === 'splint' ? 'medium' : 'small', kg: { bandages: 0.05, gauze: 0.1, painkillers: 0.03, splint: 0.35, iron: 0.08 }[x.med] };
  const n = x.name.toLowerCase();
  if (x.kind === 'phone') return { size: 'small', kg: 0.2 };
  if (x.kind === 'car keys') return { size: 'small', kg: 0.08 };
  if (x.kind === 'id' || x.kind === 'credit card' || x.kind === 'debit card') return { size: 'small', kg: 0.005 };
  if (/groceries/.test(n)) return { size: 'large', kg: 3.5 };
  if (/water bottle/.test(n)) return { size: 'medium', kg: 0.6 };
  if (/lunch/.test(n)) return { size: 'medium', kg: 0.5 };
  if (/notebook/.test(n)) return { size: 'medium', kg: 0.3 };
  if (/headphones/.test(n)) return { size: 'medium', kg: 0.25 };
  if (/charger/.test(n)) return { size: 'small', kg: 0.1 };
  if (/keys/.test(n)) return { size: 'small', kg: 0.1 };
  if (/cigarettes/.test(n)) return { size: 'small', kg: 0.03 };
  if (/lighter/.test(n)) return { size: 'small', kg: 0.02 };
  // Paper: receipts, notes, slips, photos; a baggie.
  return { size: 'small', kg: 0.005 };
}

export const usedKg = (inv: Inventory, spot: string) => inv.items.filter((i) => i.spot === spot).reduce((s, i) => s + i.kg, 0);

/** Where something would go: the smallest place it fits that has room. */
export function findRoom(inv: Inventory, size: Size, kg: number): Spot | null {
  const ok = inv.spots
    .filter((s) => SIZE_RANK[s.fits] >= SIZE_RANK[size] && usedKg(inv, s.id) + kg <= s.maxKg + 1e-9)
    .sort((a, b) => SIZE_RANK[a.fits] - SIZE_RANK[b.fits] || a.maxKg - b.maxKg);
  return ok[0] ?? null;
}

/** Why it won't go anywhere. */
export function noRoomWhy(inv: Inventory, size: Size): string {
  if (!inv.spots.some((s) => SIZE_RANK[s.fits] >= SIZE_RANK[size])) {
    return size === 'large' ? "It's too big to carry without a backpack." : size === 'medium' ? "It won't fit in a pocket. You'd need a bag." : 'You have no pockets.';
  }
  return 'There is no room left for it.';
}

/** Puts something into the first place it fits. Returns null if there's no room. */
export function stow(inv: Inventory, it: Omit<InvItem, 'spot' | 'size' | 'kg'> & Partial<Pick<InvItem, 'size' | 'kg'>>): InvItem | null {
  const m = measure(it);
  const size = it.size ?? m.size;
  const kg = it.kg ?? m.kg;
  const spot = findRoom(inv, size, kg);
  if (!spot) return null;
  const item: InvItem = { ...it, size, kg, spot: spot.id };
  inv.items.push(item);
  return item;
}

export const spotLabel = (s: Spot) => `${s.on}, ${s.name.toLowerCase()}`;
export const kgLabel = (kg: number) => (kg <= 0 ? '0 kg' : kg < 0.01 ? '<0.01 kg' : `${kg < 1 ? kg.toFixed(2) : kg.toFixed(1)} kg`);

/**
 * Puts something you took into your pockets. `ok` is false (and it stays
 * where it was) if there's nowhere for it.
 */
export function take(inv: Inventory, l: Loot): { ok: boolean; text: string } {
  const once = l.yours ? ' It was yours once.' : '';
  if (l.kind === 'cash') {
    inv.cash = Math.round((inv.cash + (l.cash ?? 0)) * 100) / 100;
    return { ok: true, text: `You pocket the ${l.name.toLowerCase()}: ${dollars(l.cash ?? 0)}.${once}` };
  }
  const it = stow(inv, { kind: l.kind, name: l.name, detail: l.detail, med: l.med });
  if (!it) return { ok: false, text: `No room for the ${l.name.toLowerCase()}. ${noRoomWhy(inv, measure(l).size)}` };
  const spot = inv.spots.find((s) => s.id === it.spot)!;
  return { ok: true, text: `You put the ${l.name.toLowerCase()} in your ${spot.on.toLowerCase()} (${spot.name.toLowerCase()}).${once}` };
}

export const dollars = (n: number) => `$${n % 1 ? n.toFixed(2) : n}`;

/** How a piece of loot reads on a button or in a list. */
export const lootLabel = (l: { kind: string; name: string; cash?: number }) => (l.kind === 'cash' ? `${l.name}, ${dollars(l.cash ?? 0)}` : l.name);

// ---------- Medicine (sold at the pharmacy) ----------

export type MedId = 'bandages' | 'gauze' | 'painkillers' | 'splint' | 'iron';

export interface Med {
  id: MedId;
  name: string;
  price: number;
  desc: string;
  /** Why it can't be used right now, or null if it can. */
  blocked(h: Health): string | null;
  /** Uses it. Returns what happened. */
  use(h: Health): string;
}

/** Broken arms and legs that haven't been splinted yet. */
const limbs = (h: Health) => h.broken.filter((p) => p !== 'nose' && p !== 'ribs' && !h.splinted?.includes(p));

export const MEDS: Med[] = [
  {
    id: 'bandages',
    name: 'Bandages',
    price: 8,
    desc: 'Wrap a wound: slows bleeding a level.',
    blocked: (h) => (h.bleeding ? null : "You aren't bleeding"),
    use(h) {
      h.bleeding = Math.max(0, h.bleeding - 1);
      return h.bleeding ? 'You wrap the wound tight. The bleeding slows.' : 'You wrap the wound. The bleeding stops.';
    },
  },
  {
    id: 'gauze',
    name: 'Gauze and tape',
    price: 15,
    desc: 'Pack a deep wound: slows bleeding two levels.',
    blocked: (h) => (h.bleeding ? null : "You aren't bleeding"),
    use(h) {
      h.bleeding = Math.max(0, h.bleeding - 2);
      return h.bleeding ? 'You pack the wound with gauze and tape it down. It still seeps.' : 'You pack the wound with gauze and tape it down. The bleeding stops.';
    },
  },
  {
    id: 'painkillers',
    name: 'Painkillers',
    price: 6,
    desc: 'Takes the edge off a concussion (clears 3 hours sooner).',
    blocked: (h) => (h.concussion > 0 ? null : "You aren't concussed"),
    use(h) {
      h.concussion = Math.max(0, h.concussion - 3);
      return h.concussion ? 'You dry-swallow a couple of pills. The pounding in your head eases.' : 'You dry-swallow a couple of pills. Your head clears.';
    },
  },
  {
    id: 'splint',
    name: 'Splint',
    price: 22,
    desc: 'Set a broken arm or leg: it heals twice as fast.',
    blocked: (h) => (limbs(h).length ? null : h.splinted?.length ? 'Already splinted' : 'No broken arm or leg'),
    use(h) {
      // The limb that will take longest to heal.
      const p = limbs(h).sort((a, b) => (h.mending[b] ?? 0) - (h.mending[a] ?? 0))[0];
      h.mending[p] = Math.ceil((h.mending[p] ?? 24) / 2);
      (h.splinted ??= []).push(p);
      return `You splint your ${p}, biting down through the pain.`;
    },
  },
  {
    id: 'iron',
    name: 'Iron tablets',
    price: 12,
    desc: 'Helps your body make blood back (+0.4 L).',
    blocked: (h) => (h.blood < h.maxBlood ? null : 'Your blood is full'),
    use(h) {
      h.blood = Math.min(h.maxBlood, h.blood + 400);
      return 'You take the iron tablets with a mouthful of water. Some colour comes back to your face.';
    },
  },
];

export const medById = (id: MedId) => MEDS.find((m) => m.id === id)!;
