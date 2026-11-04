import { makePerson, type Loot, type Person } from './person';
import type { Inventory } from './inventory';
import { cents } from './money';
import type { Encounter } from './encounter';

/**
 * What outlives you. When you die, whoever finds your body goes through your
 * pockets: the person who beat you, or a stranger who came across you lying
 * there. They walk the same streets afterwards with your things on them.
 * Nothing tells you who has them; you only find out if you happen to lurk
 * into them again and go through their pockets. Saved under `state.world`.
 */
export interface Thief {
  id: string;
  person: Person;
}

export interface World {
  thieves: Thief[];
  /** How many of you there have been (1 for the first). */
  lives: number;
  /** Your lurk count when this life began (for the death screen). */
  lifeStart: number;
  /** Everyone you've hurt and left alive (see people.ts). */
  people?: import('./people').Known[];
  /** Your reputation and the police's interest (see people.ts). */
  infamy?: import('./people').Infamy;
  /** Someone told you who has your old things: they're more likely to turn up. */
  lead?: string;
}

export const newWorld = (): World => ({ thieves: [], lives: 1, lifeStart: 0 });

/** Most people carrying your old things at once; the oldest get lost. */
const MAX_THIEVES = 8;
/** Chance a lurk turns up one of them. */
export const THIEF_CHANCE = 0.14;

const yoursLeft = (p: Person) => p.clothes.some((g) => g.loot.some((l) => l.yours));

/**
 * Someone takes everything you had. `e` is the encounter you died in, if
 * any: if they were still standing, it's them. Returns true if there was
 * anything to take.
 */
export function robBody(w: World, inv: Inventory, e: Encounter | null): boolean {
  const loot: Loot[] = [];
  const c = cents(inv.purse);
  if (c > 0) loot.push({ kind: 'cash', name: 'Your cash', cash: c / 100, purse: { ...inv.purse }, where: 'stuffed in a pocket', yours: true });
  for (const it of inv.items) loot.push({ kind: it.kind, name: it.name, detail: it.detail, med: it.med, secret: it.secret, known: it.known, doses: it.doses, pin: it.pin, pinOk: it.pinOk, drained: it.drained, weapon: it.weapon, cuts: it.cuts, spray: it.spray, drink: it.drink, car: it.car, carSearched: it.carSearched, takenAt: it.takenAt, where: 'stuffed in a pocket', yours: true });
  if (!loot.length) return false;

  let thief: Thief | undefined;
  if (e && !e.them.out && !e.them.dead && e.stage !== 'seen') {
    // The one who put you down.
    thief = e.person.thief ? w.thieves.find((t) => t.id === e.person.thief) : undefined;
    if (!thief) {
      thief = { id: newId(), person: e.person };
      w.thieves.push(thief);
    }
  } else {
    thief = { id: newId(), person: makePerson() };
    w.thieves.push(thief);
  }
  const p = thief.person;
  p.thief = thief.id;
  // Into the pockets of whatever they're wearing up top (or the first thing).
  const g = p.clothes[0];
  g.loot.push(...loot);
  for (const c of p.clothes) c.searched = false;
  while (w.thieves.length > MAX_THIEVES) w.thieves.shift();
  return true;
}

/** Maybe one of them comes by this time (a copy to meet; the record stays). */
export function maybeThief(w: World): Person | null {
  if (!w.thieves.length) return null;
  // A tip-off: you know where to look.
  const lead = w.lead ? w.thieves.find((t) => t.id === w.lead) : undefined;
  if (w.lead && !lead) delete w.lead;
  if (lead && Math.random() < 0.4) {
    delete w.lead;
    return JSON.parse(JSON.stringify(lead.person)) as Person;
  }
  if (Math.random() >= THIEF_CHANCE) return null;
  const t = w.thieves[Math.floor(Math.random() * w.thieves.length)];
  return JSON.parse(JSON.stringify(t.person)) as Person;
}

/**
 * When you're done with someone: if they were carrying your things, remember
 * what's still on them. Once it's all been taken back, or they're dead,
 * they're out of the story.
 */
export function settle(w: World, e: Encounter) {
  const id = e.person.thief;
  if (!id) return;
  const i = w.thieves.findIndex((t) => t.id === id);
  if (i < 0) return;
  if (e.them.dead || !yoursLeft(e.person)) {
    w.thieves.splice(i, 1);
    return;
  }
  const p = JSON.parse(JSON.stringify(e.person)) as Person;
  for (const c of p.clothes) c.searched = false;
  w.thieves[i].person = p;
}

const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * Knocked out and left lying there: whoever put you down may go through
 * your pockets before they go. Who they are decides it (a junkie nearly
 * always does; most people who were only defending themselves don't), and
 * what they take is on them now, if you ever meet them again. Takes cash
 * and the things worth taking; leaves your clothes and the junk. Returns
 * what to tell you when you come to, or null.
 */
export function robKnockedOut(w: World, inv: Inventory, e: Encounter, brute: boolean): string | null {
  const p = e.person;
  const chance = ({ junkie: 0.85, homeless: 0.6, drunk: 0.4, civilian: 0.12 } as Record<string, number>)[p.kind] ?? 0.3;
  if (Math.random() >= Math.min(0.95, chance + (brute ? 0.25 : 0))) return null;
  const worth = (it: Inventory['items'][number]) =>
    it.kind === 'phone' || it.kind === 'weapon' || it.kind === 'credit card' || it.kind === 'debit card' || it.kind === 'car keys' || (it.kind === 'id' && !it.own) || (!!it.secret && it.secret !== 'empty');
  const took = inv.items.filter(worth);
  const c = cents(inv.purse);
  if (!took.length && c <= 0) return 'When you come to, your pockets have been turned out. There was nothing worth taking.';
  const loot: Loot[] = [];
  if (c > 0) loot.push({ kind: 'cash', name: 'Your cash', cash: c / 100, purse: { ...inv.purse }, where: 'stuffed in a pocket', yours: true });
  for (const it of took) loot.push({ kind: it.kind, name: it.name, detail: it.detail, med: it.med, secret: it.secret, known: it.known, doses: it.doses, pin: it.pin, pinOk: it.pinOk, drained: it.drained, weapon: it.weapon, cuts: it.cuts, spray: it.spray, drink: it.drink, car: it.car, carSearched: it.carSearched, takenAt: it.takenAt, where: 'stuffed in a pocket', yours: true });
  inv.purse = {};
  inv.items = inv.items.filter((x) => !took.includes(x));
  let thief = p.thief ? w.thieves.find((t) => t.id === p.thief) : undefined;
  if (!thief) {
    thief = { id: newId(), person: p };
    w.thieves.push(thief);
  }
  p.thief = thief.id;
  thief.person.clothes[0].loot.push(...loot);
  for (const g of thief.person.clothes) g.searched = false;
  while (w.thieves.length > MAX_THIEVES) w.thieves.shift();
  const names = [...(c > 0 ? ['your cash'] : []), ...took.map((x) => x.name.toLowerCase())];
  return `When you come to, your pockets have been turned out. Gone: ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]}.`;
}
