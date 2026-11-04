import type { Body, Encounter, Marks, Part } from './encounter';
import type { Person } from './person';
import { now } from './clock';

/**
 * People remember you. Everyone you fight and leave alive is kept: who they
 * are, what you did to them, whether they saw your face (or only what you
 * were wearing), and the state you left them in. Their injuries heal on the
 * real clock, as they would: a broken arm is in a cast for six weeks, a
 * broken nose taped for three, teeth knocked out stay out. You may lurk into
 * them again. If they know you, they react: some run, some watch you, and
 * the ones with a grudge come for you, or come looking.
 *
 * Reputation is what gets around about you: every victim who saw your face
 * talks, and a killing someone witnesses is talked about most. Heat is the
 * police's interest: victims who saw you report it. Both fade with time.
 * Saved under `state.world` (see legacy.ts).
 */
export interface Memory {
  /** Times you've been at them. */
  times: number;
  /** The worst you did, in words ("broke their arm", "knocked them out"). */
  worst: string;
  /** They know your face. */
  sawFace: boolean;
  /** What's remembered was done by an earlier you (this you doesn't know it). */
  otherLife?: boolean;
  /** What they'd describe ("someone in a ski mask, a coat"). */
  looked: string;
  /** The clothes they'd know you by. */
  clothes: string[];
  /** How badly they want you to pay, 0..100. */
  grudge: number;
  /** You won that fight (they lost to you), or they beat you. */
  beatYou?: boolean;
  /** How scared of you they were when you left them, 0..100 (fades with time). */
  fear?: number;
}

export interface Known {
  id: string;
  person: Person;
  /** Their body as you left it; healing on the real clock. */
  blood: number;
  maxBlood: number;
  broken: Part[];
  /** When each break will have healed (ms, real clock). */
  mends: Partial<Record<Part, number>>;
  marks: Marks;
  /** When each healing mark will be gone (ms). */
  markEnds: Partial<Record<'lip' | 'cheek' | 'eye' | 'brow' | 'jaw' | 'hand' | 'fingers', number>>;
  /** When you last left them. */
  at: number;
  /** When their healing was last brought up to date. */
  healedAt?: number;
  /** How bad the worst thing you did was (to keep the worst in `memory.worst`). */
  worstLevel?: number;
  memory: Memory;
}

const DAY = 86_400_000;
/** Real time for a break to heal, roughly as in life. */
const MEND_DAYS: Record<string, number> = { nose: 21, ribs: 42, 'left arm': 42, 'right arm': 42, 'left leg': 56, 'right leg': 56 };
const MARK_DAYS = { lip: 4, cheek: 5, eye: 10, brow: 12, jaw: 42, hand: 42, fingers: 28 };
const MAX_PEOPLE = 40;

/** Heals someone up to now: bones knit, cuts close, blood comes back. */
export function heal(k: Known, t = now()) {
  for (const p of [...k.broken]) {
    if ((k.mends[p] ?? 0) <= t) {
      k.broken.splice(k.broken.indexOf(p), 1);
      delete k.mends[p];
    }
  }
  for (const [m, end] of Object.entries(k.markEnds) as [keyof typeof MARK_DAYS, number][]) {
    if (end <= t) {
      delete k.markEnds[m];
      if (m === 'fingers') delete k.marks.fingers;
      else k.marks[m] = false;
      if (m === 'brow') (k.marks.scars ??= []).push('eyebrow');
    }
  }
  // Blood comes back over a few days (counted once; a clock set back heals nothing).
  const days = Math.max(0, t - (k.healedAt ?? k.at)) / DAY;
  k.blood = Math.min(k.maxBlood, Math.max(k.blood, 0) + days * k.maxBlood * 0.25);
  // Fear fades too, slowly; what was done to them doesn't.
  if (k.memory.fear) k.memory.fear = Math.max(0, k.memory.fear - days * 3);
  k.healedAt = Math.max(t, k.healedAt ?? 0);
}

/** How their injuries show ("Left arm in a cast", "Nose taped"...). */
export function injuriesText(k: Pick<Known, 'broken'>): string[] {
  return k.broken.map((p) =>
    p === 'nose' ? 'Nose taped' : p === 'ribs' ? 'Moves stiffly, ribs strapped' : p.endsWith('arm') ? `${cap(p)} in a cast` : `${cap(p)} in a cast, on crutches`,
  );
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The worst thing that happened to them in this encounter, in words. */
function worstOf(e: Encounter, robbed: boolean, stomped: boolean, mugged = false, tortured = 0): { worst: string; grudge: number } {
  const T = e.them;
  // Only what happened this time: old injuries they came in with don't count.
  const start = e.start ?? { blood: T.maxBlood, broken: [] };
  const newBreaks = T.broken.filter((p) => !start.broken.includes(p));
  let worst = 'came at them';
  let grudge = 15;
  if (e.result === 'lost' && !e.chaseOut) return { worst: 'fought you, and won', grudge: 5 };
  if (e.result === 'they-fled') {
    worst = 'came at them, and they got away';
    grudge = 20;
  }
  if (mugged) {
    worst = 'mugged them';
    grudge = 30;
  }
  if (T.blood < start.blood - T.maxBlood * 0.15) {
    worst = 'beat them';
    grudge = 35;
  }
  if (newBreaks.length) {
    worst = `broke their ${newBreaks[newBreaks.length - 1]}`;
    grudge = 50;
  }
  if (T.out) {
    worst = newBreaks.length ? `broke their ${newBreaks[newBreaks.length - 1]} and knocked them out` : 'knocked them out cold';
    grudge = Math.max(grudge, 55);
  }
  if (stomped) {
    worst += ', and stomped on them while they were down';
    grudge += 20;
  }
  if (robbed && !mugged) {
    worst += ', and went through their pockets';
    grudge += 15;
  }
  if (tortured) {
    worst += tortured > 2 ? ', and tortured them' : ', and hurt them while they begged';
    grudge += 15 + tortured * 6;
  }
  return { worst, grudge: Math.min(100, grudge) };
}

/**
 * After an encounter with someone who lived: remember them, and what they
 * remember of you. `look`: how anonymous you were and what you wore.
 * Returns the record (null if there's nothing to remember).
 */
export function remember(
  people: Known[],
  e: Encounter,
  look: { anon: number; looked: string; clothes: string[] },
  did: { robbed: boolean; stomped: boolean; mugged?: boolean; tortured?: number },
): Known | null {
  const T = e.them;
  const existing = e.person.known ? people.findIndex((x) => x.id === e.person.known) : -1;
  // The dead remember nothing.
  if (T.dead) {
    if (existing >= 0) people.splice(existing, 1);
    return null;
  }
  // Only violence is remembered: blows, or blood drawn. (Someone who saw you
  // and ran, or spotted you following, isn't your victim.)
  const start = e.start ?? { blood: T.maxBlood, broken: [] };
  const hurt = T.blood < start.blood - 1 || T.broken.some((p) => !start.broken.includes(p));
  if (!e.fought && !hurt && e.result !== 'lost' && !did.mugged) return null;
  let k = existing >= 0 ? people[existing] : undefined;
  if (!k) {
    k = {
      id: Math.random().toString(36).slice(2, 10),
      person: e.person,
      blood: T.blood,
      maxBlood: T.maxBlood,
      broken: [],
      mends: {},
      marks: {},
      markEnds: {},
      at: now(),
      memory: { times: 0, worst: '', sawFace: false, looked: look.looked, clothes: look.clothes, grudge: 0 },
    };
    people.push(k);
    k.person.known = k.id;
  }
  const t = now();
  // (This you has met them now.)
  delete k.memory.otherLife;
  k.at = t;
  k.healedAt = t;
  k.blood = T.blood;
  // Whatever's still on them (you may have taken some), as they are now.
  const id = k.id;
  k.person = JSON.parse(JSON.stringify(e.person)) as Person;
  k.person.known = id;
  // New breaks start healing now; teeth and scars stay.
  for (const p of T.broken) {
    if (!k.broken.includes(p)) {
      k.broken.push(p);
      k.mends[p] = t + (MEND_DAYS[p] ?? 42) * DAY;
    }
  }
  const was = k.marks;
  k.marks = JSON.parse(JSON.stringify(T.marks ?? {}));
  // New marks (or more broken fingers) start healing from now.
  for (const m of Object.keys(MARK_DAYS) as (keyof typeof MARK_DAYS)[]) if (k.marks[m] && (!was[m] || (typeof k.marks[m] === 'number' && (k.marks[m] as number) > ((was[m] as number) ?? 0)))) k.markEnds[m] = t + MARK_DAYS[m] * DAY;
  const mem = k.memory;
  mem.times++;
  // Did they get a look at you? Only if they were conscious to see it, and
  // whatever covered your face didn't hide it.
  const saw = !!e.facedYou && Math.random() > look.anon;
  if (saw) mem.sawFace = true;
  if (e.facedYou) {
    mem.looked = look.looked;
    mem.clothes = look.clothes;
  }
  const w = worstOf(e, did.robbed, did.stomped, did.mugged, did.tortured ?? 0);
  // How scared of you they are now (torture stays with them).
  mem.fear = Math.max(mem.fear ?? 0, Math.round((T.fear ?? 0) * (did.tortured ? 1 : 0.7)));
  mem.beatYou = e.result === 'lost' && !e.chaseOut;
  // Beating you takes the fear out of them.
  if (mem.beatYou) mem.fear = Math.round((mem.fear ?? 0) * 0.3);
  // Keep the worst thing you've done to them.
  if (w.grudge >= (k.worstLevel ?? 0) || mem.beatYou) {
    mem.worst = w.worst;
    k.worstLevel = w.grudge;
  }
  // A grudge grows when you hurt them again.
  mem.grudge = Math.min(100, Math.max(mem.grudge, w.grudge) + (mem.times > 1 && (hurt || did.robbed) ? 10 : 0));
  while (people.length > MAX_PEOPLE) people.shift();
  return k;
}

/** Chance a lurk turns up someone you've met (more likely the angrier they are). */
export function comeBack(people: Known[]): Known | null {
  if (!people.length) return null;
  const chance = Math.min(0.22, 0.05 + people.length * 0.015);
  if (Math.random() >= chance) return null;
  const weights = people.map((k) => 1 + k.memory.grudge / 25);
  let n = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < people.length; i++) if ((n -= weights[i]) < 0) return people[i];
  return people[people.length - 1];
}

/** A fresh copy of them to meet, healed up to today. */
export function meet(k: Known): Person {
  heal(k);
  const p = JSON.parse(JSON.stringify(k.person)) as Person;
  p.known = k.id;
  return p;
}

/** Their body as they are now, for a new encounter. */
export function applyTo(k: Known, b: Body) {
  // Back on their feet: whatever they lost, they're well enough to be out walking.
  b.blood = Math.min(b.maxBlood, Math.round(Math.max(k.blood, k.maxBlood * 0.7)));
  b.broken = [...k.broken];
  b.marks = JSON.parse(JSON.stringify(k.marks));
  // Broken ribs leave them short of breath.
  if (k.broken.includes('ribs')) b.stamina = Math.round(b.stamina * 0.5);
}

/**
 * Do they know you, now? By your face if they saw it (unless it's covered),
 * or by what you're wearing if it's what you wore then.
 */
export function recognises(k: Known, anon: number, clothes: string[]): boolean {
  const mem = k.memory;
  if (mem.sawFace && Math.random() < 0.9 * (1 - anon)) return true;
  const same = clothes.filter((c) => mem.clothes.includes(c)).length;
  return same > 0 && Math.random() < 0.25 * same * (1 - anon * 0.5);
}

/** What you remember of them ("You broke their arm. Six days ago."). */
export function historyText(k: Known): string {
  const days = Math.floor((now() - k.at) / DAY);
  const when = days < 1 ? 'Earlier today' : days === 1 ? 'Yesterday' : `${days} days ago`;
  const mem = k.memory;
  return mem.beatYou ? `They beat you. ${when}.` : `You ${mem.worst}. ${when}.`;
}

// ---------- Reputation and heat ----------

export interface Infamy {
  /** What's said about you on the street (0..). */
  rep: number;
  /** How much the police want you (0..100). */
  heat: number;
  /** When they were last brought up to date (they fade). */
  at: number;
}

export const newInfamy = (): Infamy => ({ rep: 0, heat: 0, at: now() });

/** Talk dies down; the police move on to other things. */
export function fade(f: Infamy, t = now()) {
  // A clock set ahead and then put right: start counting again from now.
  if (f.at > t + DAY) f.at = t;
  const days = (t - f.at) / DAY;
  if (days <= 0) return;
  f.rep = Math.max(0, f.rep - days * 2);
  f.heat = Math.max(0, f.heat - days * 15);
  f.at = t;
}

export const REP_LEVELS: [number, string][] = [
  [0, 'Nobody'],
  [10, 'Talked about'],
  [30, 'Known'],
  [60, 'Feared'],
  [100, 'Notorious'],
  [150, 'Dreaded'],
  [220, 'A legend of the street'],
];
export const repName = (r: number) => REP_LEVELS.filter(([at]) => r >= at).pop()![1];
export const HEAT_NAMES = ['None', 'Low', 'Watched', 'Wanted'];
export const heatLevel = (h: number) => (h >= 60 ? 3 : h >= 30 ? 2 : h >= 8 ? 1 : 0);
