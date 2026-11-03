import { addCaffeine, caffeineNow } from './health';
import type { Loot, LootKind } from './person';
import type { Health } from './health';
import { addTo, cents, emptyPurse, fewest, kgOf, money, purseText, type Purse } from './money';

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
  /** What it really is (see Loot.secret), whether you know, and uses left. */
  secret?: import('./person').Secret;
  known?: boolean;
  doses?: number;
  /** A card: the PIN they gave you, whether it's real, and whether it's been used at the cash machine. */
  pin?: string;
  pinOk?: boolean;
  drained?: boolean;
  /** Your own ID (which life it's for: see World.lives). Never evidence. */
  own?: number;
  /** Something to drink (beer, liquor, an energy drink), swigs in `doses`. */
  drink?: 'beer' | 'liquor' | 'energy';
  /** A weapon: extra damage, whether it cuts, pepper spray (uses in `doses`). */
  weapon?: number;
  cuts?: boolean;
  spray?: boolean;
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
  /** Your money: bills and coins (see money.ts). */
  purse: Purse;
  /** Old saves: a plain dollar amount (turned into a purse on load). */
  cash?: number;
  items: InvItem[];
  /** What you're wearing, and any bag. */
  clothes: string[];
  /** Caps, masks, sunglasses, and whether the mask and hood are up (see look.ts). */
  wearing?: import('./look').Wearing;
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

export const spotsFor = (clothes: string[]): Spot[] =>
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
  return { purse: emptyPurse(), items: [], clothes, spots: spotsFor(clothes) };
}

/** Saves from before clothes: dress them, and put what they had somewhere. */
export function upgradeInventory(inv: Inventory) {
  // Old saves: a dollar amount becomes bills and coins.
  if (!inv.purse) {
    inv.purse = fewest(Math.round((inv.cash ?? 0) * 100));
    delete inv.cash;
  }
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
  if (x.med) return { size: x.med === 'splint' ? 'medium' : 'small', kg: { bandages: 0.05, gauze: 0.1, painkillers: 0.03, splint: 0.35, iron: 0.08, testkit: 0.03, caffeine: 0.02 }[x.med] };
  const n = x.name.toLowerCase();
  if (x.kind === 'weapon') {
    if (/bottle/.test(n)) return { size: 'medium', kg: 0.45 };
    // An eight-inch kitchen or combat knife won't go in a small pocket.
    if (/kitchen|combat|hunting/.test(n)) return { size: 'medium', kg: 0.22 };
    if (/knife|folder|karambit|razor|dagger|switchblade|shiv/.test(n)) return { size: 'small', kg: 0.12 };
    if (/spray/.test(n)) return { size: 'small', kg: 0.06 };
    return { size: 'small', kg: 0.05 }; // box cutter, syringe
  }
  if (/^beer$/i.test(n)) return { size: 'medium', kg: 0.37 };
  if (/vodka|whiskey|wine/i.test(n)) return { size: 'medium', kg: /wine/i.test(n) ? 1.2 : 0.55 };
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
  if (/matches/.test(n)) return { size: 'small', kg: 0.01 };
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
  // A weapon goes where it's best hidden; anything else, the snuggest fit.
  const spot = it.kind === 'weapon' ? hidingSpot(inv, size, kg) : findRoom(inv, size, kg);
  if (!spot) return null;
  const item: InvItem = { ...it, size, kg, spot: spot.id };
  inv.items.push(item);
  return item;
}

/**
 * Put on something new in place of what you're wearing in that slot (top,
 * trousers, or a bag). Everything you carry is put away again; if it won't
 * all fit, nothing changes and you get back the reason. Returns what you
 * took off (or null if you had no bag) on success.
 */
export function wear(inv: Inventory, slot: 'top' | 'bottom' | 'bag', name: string): { ok: true; old: string | null } | { ok: false; why: string } {
  const clothes = [...inv.clothes];
  const at = slot === 'top' ? 0 : slot === 'bottom' ? 1 : 3;
  const old = clothes[at] ?? null;
  clothes[at] = name;
  const spots = spotsFor(clothes);
  // Pack it all again, biggest things first.
  const trial: Inventory = { purse: inv.purse, items: [], clothes, spots };
  const order = [...inv.items].sort((a, b) => SIZE_RANK[b.size] - SIZE_RANK[a.size] || b.kg - a.kg);
  for (const it of order) {
    const spot = findRoom(trial, it.size, it.kg);
    if (!spot) return { ok: false, why: `You'd have nowhere to put the ${it.name.toLowerCase()}.` };
    trial.items.push({ ...it, spot: spot.id });
  }
  inv.clothes = clothes;
  inv.spots = spots;
  inv.items = trial.items;
  return { ok: true, old };
}

export const spotLabel = (s: Spot) => `${s.on}, ${s.name.toLowerCase()}`;
export const kgLabel = (kg: number) => (kg <= 0 ? '0\u00a0kg' : kg < 0.01 ? '<0.01\u00a0kg' : `${kg < 1 ? kg.toFixed(2) : kg.toFixed(1)}\u00a0kg`);

/**
 * Puts something you took into your pockets. `ok` is false (and it stays
 * where it was) if there's nowhere for it.
 */
export function take(inv: Inventory, l: Loot): { ok: boolean; text: string } {
  const once = l.yours ? ' It was yours once.' : '';
  if (l.kind === 'cash') {
    const p = l.purse ?? fewest(Math.round((l.cash ?? 0) * 100));
    addTo(inv.purse, p);
    return { ok: true, text: `You pocket ${/^your /i.test(l.name) ? 'your cash' : `the ${l.name.toLowerCase()}`}: ${money(cents(p))} (${purseText(p)}).${once}` };
  }
  // Loose cigarettes go in with the loose ones you already have.
  if (/^loose cigarettes$/i.test(l.name)) {
    const have = inv.items.find((x) => /^loose cigarettes$/i.test(x.name));
    if (have) {
      have.doses = (have.doses ?? 0) + (l.doses ?? 1);
      return { ok: true, text: `You pocket ${l.doses === 1 ? 'the loose cigarette' : `the ${l.doses} loose cigarettes`} with the others.${once}` };
    }
  }
  const it = stow(inv, { kind: l.kind, name: l.name, detail: l.detail, med: l.med, secret: l.secret, known: l.known, doses: l.doses, pin: l.pin, pinOk: l.pinOk, drained: l.drained, weapon: l.weapon, cuts: l.cuts, spray: l.spray, drink: l.drink });
  if (!it) return { ok: false, text: `No room for the ${l.name.toLowerCase()}. ${noRoomWhy(inv, measure(l).size)}` };
  const spot = inv.spots.find((s) => s.id === it.spot)!;
  return { ok: true, text: `You put the ${l.name.toLowerCase()} in your ${spot.on.toLowerCase()} (${spot.name.toLowerCase()}).${once}` };
}

export const dollars = (n: number) => `$${n % 1 ? n.toFixed(2) : n}`;

/** All your cash, in dollars. */
export const cashOf = (inv: Inventory) => cents(inv.purse) / 100;
/** What your money weighs (coins add up). */
export const purseKg = (inv: Inventory) => kgOf(inv.purse);

/** How a piece of loot reads on a button or in a list. */
export const lootLabel = (l: { kind: string; name: string; cash?: number; doses?: number }) =>
  l.kind === 'cash'
    ? `${l.name}, ${dollars(l.cash ?? 0)}`
    : l.doses != null && /^lighter$/i.test(l.name)
      ? `${l.name} (${l.doses}% fuel)`
      : l.doses != null && /^matches$/i.test(l.name)
        ? `${l.name} (${l.doses} left)`
        : l.name;

// ---------- Medicine (sold at the pharmacy) ----------

export type MedId = 'bandages' | 'gauze' | 'painkillers' | 'splint' | 'iron' | 'testkit' | 'caffeine';

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
    desc: 'Takes the edge off the pain, and so the stress. They don’t heal anything.',
    blocked: (h) => (h.concussion > 0 || h.broken.length || h.bleeding || h.blood < h.maxBlood * 0.9 ? null : 'Nothing hurts enough'),
    use(h) {
      h.stress = Math.max(0, (h.stress ?? 0) - 12);
      return 'You dry-swallow a couple of pills. After a while the pain dulls to an ache.';
    },
  },
  {
    id: 'splint',
    name: 'Splint',
    price: 22,
    desc: 'Set a broken arm or leg so it can knit straight. Left unset, a break takes twice as long.',
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
    desc: 'Iron takes weeks to do anything. No longer sold.',
    blocked: () => null,
    use() {
      return 'You take the iron tablets. It’ll be weeks before they make any difference.';
    },
  },
];

/**
 * Not medicine: a reagent kit (a vial and a dropper) that tells you what a
 * powder is. Used from the thing you want to test, in your pockets.
 */
MEDS.push({
  id: 'caffeine',
  name: 'Caffeine pills',
  price: 5,
  desc: '200 mg. Sharper in a fight for hours; too many and your hands shake.',
  blocked: (h) => (caffeineNow(h) >= 600 ? "Your heart's already pounding" : null),
  use(h) {
    addCaffeine(h, 200);
    return 'You dry-swallow two of the pills. Nothing yet; in half an hour or so you’ll feel it.';
  },
});

MEDS.push({
  id: 'testkit',
  name: 'Drug test kit',
  price: 10,
  desc: 'A reagent vial: tells you what a powder is. One use.',
  blocked: () => 'Test something with it',
  use: () => '',
});

export const medById = (id: MedId) => MEDS.find((m) => m.id === id)!;

// ---------- Hiding weapons ----------
/**
 * How well a pocket or bag hides what's in it, 0 (anyone can see it) to 1
 * (nobody would know). A bag hides anything; a heavy coat hides a lot; a
 * hoodie's pouch sags and swings; thin trackie pockets show every outline;
 * a clip on a jeans pocket shows.
 */
export function concealOf(sp: Pick<Spot, 'on' | 'name'>): number {
  const g = sp.on.toLowerCase();
  const p = sp.name.toLowerCase();
  if (/backpack/.test(g)) return p.startsWith('main') ? 1 : 0.92;
  if (/shoulder bag|tote/.test(g)) return 0.95;
  if (/fanny/.test(g)) return 0.85;
  if (/coat|puffer|parka/.test(g)) return p.startsWith('inside') ? 0.97 : 0.85;
  if (/leather jacket|jacket/.test(g) && !/puffer/.test(g)) return p.startsWith('inside') ? 0.92 : 0.72;
  if (/windbreaker/.test(g)) return p.startsWith('inside') ? 0.8 : 0.55;
  if (/hoodie/.test(g)) return 0.45;
  if (/flannel|shirt/.test(g)) return 0.25;
  if (/cargo/.test(g)) return /cargo/.test(p) ? 0.6 : 0.5;
  if (/track|sweat/.test(g)) return 0.25;
  if (/work pants/.test(g)) return 0.6;
  if (/jeans|chinos|pants/.test(g)) return p.startsWith('back') ? 0.35 : 0.5;
  return 0.4;
}

/** How hard a weapon is to keep out of sight, 0..1 (a long kitchen knife; a shiv). */
export function bulkOf(x: { kind: string; name: string }): number {
  if (x.kind !== 'weapon') return 0;
  const n = x.name.toLowerCase();
  if (/broken bottle/.test(n)) return 0.95;
  if (/kitchen|combat/.test(n)) return 0.85;
  if (/^bottle$/.test(n)) return 0.7;
  if (/hunting/.test(n)) return 0.6;
  if (/steak/.test(n)) return 0.45;
  if (/shiv|box cutter|syringe|razor/.test(n)) return 0.12;
  if (/spray/.test(n)) return 0.15;
  return 0.25; // folders, switchblades, butterfly, karambit, push dagger
}

/** How much of this weapon shows, where it is (0 hidden .. 1 out in the open). */
export function showing(inv: Inventory, x: InvItem): number {
  const sp = inv.spots.find((s) => s.id === x.spot);
  return bulkOf(x) * (1 - (sp ? concealOf(sp) : 0));
}

/** How obviously you're carrying (0 nothing shows .. 1 bristling): more weapons, more to see. */
export function exposure(inv: Inventory): number {
  return 1 - inv.items.reduce((k, x) => k * (1 - showing(inv, x)), 1);
}

/** A word for how much shows. */
export const showWord = (v: number) => (v < 0.06 ? 'Hidden' : v < 0.16 ? 'A slight bulge' : v < 0.35 ? 'You can see the shape of it' : 'Plain to see');

/** How well a garment or bag hides a weapon, in a word (its best pocket). */
export function hidesWord(garment: string): string {
  const ps = pocketsOf(garment);
  if (!ps.length) return 'Nowhere to hide one';
  const best = Math.max(...ps.map(([name]) => concealOf({ on: garment, name })));
  return best >= 0.9 ? 'Hides a weapon well' : best >= 0.7 ? 'Hides a small one' : best >= 0.45 ? 'Hides a weapon poorly' : 'Shows the outline of anything';
}

/**
 * Where a weapon is best hidden, out of the places it fits (a bag's main
 * compartment, a coat's inside pocket...).
 */
export function hidingSpot(inv: Inventory, size: Size, kg: number): Spot | null {
  const ok = inv.spots.filter((s) => SIZE_RANK[s.fits] >= SIZE_RANK[size] && usedKg(inv, s.id) + kg <= s.maxKg + 1e-9);
  return ok.sort((a, b) => concealOf(b) - concealOf(a))[0] ?? null;
}

/** The next place it fits (for moving it about), after where it is now; null if nowhere else. */
export function nextSpot(inv: Inventory, x: InvItem): Spot | null {
  const ok = inv.spots.filter((s) => s.id === x.spot || (SIZE_RANK[s.fits] >= SIZE_RANK[x.size] && usedKg(inv, s.id) + x.kg <= s.maxKg + 1e-9));
  if (ok.length < 2) return null;
  const i = ok.findIndex((s) => s.id === x.spot);
  return ok[(i + 1) % ok.length];
}

/** Is this spot in a bag (it takes a moment to get something out)? */
export const inBag = (inv: Inventory, spotId: string) => /backpack|shoulder bag|tote|fanny/i.test(inv.spots.find((s) => s.id === spotId)?.on ?? '');
