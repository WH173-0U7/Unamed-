import type { Loot, LootKind } from './person';
import type { Health } from './health';

/**
 * Your pockets: the cash you have, what you've taken off people, and what
 * you've bought. Saved under `state.inventory`.
 */
export interface InvItem {
  kind: LootKind | 'med';
  name: string;
  detail?: string;
  /** For medicine: which one (see MEDS). */
  med?: MedId;
}

export interface Inventory {
  cash: number;
  items: InvItem[];
}

export const newInventory = (): Inventory => ({ cash: 0, items: [] });

/** Puts something you took into your pockets. Returns how to say it. */
export function take(inv: Inventory, l: Loot): string {
  if (l.yours && l.kind === 'cash') {
    inv.cash = Math.round((inv.cash + (l.cash ?? 0)) * 100) / 100;
    return `You pocket the ${l.name.toLowerCase()}: ${dollars(l.cash ?? 0)}. It was yours once.`;
  }
  if (l.kind === 'cash') {
    inv.cash = Math.round((inv.cash + (l.cash ?? 0)) * 100) / 100;
    return `You pocket the ${l.name.toLowerCase()}: ${dollars(l.cash ?? 0)}.`;
  }
  inv.items.push({ kind: l.kind, name: l.name, detail: l.detail, med: l.med });
  return l.yours ? `You take the ${l.name.toLowerCase()}. It was yours once.` : `You take the ${l.name.toLowerCase()}.`;
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
