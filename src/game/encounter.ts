import { AMBUSH_TEXT, TECH_TEXT, kickText, missText, punchText, stompText, tierOf, tierUpLine, weaponText, type Tier } from './practice';
import { AWARENESS, BUILDS, NAMES, personalityOf, type Item, type Loot, type Person } from './person';
import { money } from './money';
import { isBrute, voice, type Moment } from './voices';
import { caffeineEdge } from './health';
import { partOfDay } from './clock';
import { lootLabel, take, type Inventory } from './inventory';
import {
  STAT_NAMES,
  accuracyBonus,
  ambushBonus,
  gripBonus,
  damageMult,
  dodgeBonus,
  noticeRate,
  staminaRegen,
  strengthDamage,
  weaponAccuracy,
  weaponDamage,
  train,
  type StatName,
  type Stats,
} from './stats';

/**
 * One encounter with a person you saw while lurking. Everything here is
 * plain data so it can be saved at a pause and picked up again exactly.
 *
 * - **Surveil:** follow them and find out about them (build, what they're
 *   carrying, how aware they are, male or female). Every move risks being
 *   noticed; get noticed and they run, or turn on you.
 * - **Violence:** bum rush, sucker punch or shove them: an ambush. Sneak
 *   decides whether it lands, or they block, dodge or counter it. Then the
 *   fight starts.
 * - **Combat:** turn by turn. Health is blood: blows and bleeding drain it,
 *   and at 55% or below you pass out. Every move costs stamina. Blows land on
 *   a part of the body and can daze, concuss, start bleeding, break bones, or
 *   knock someone to the floor, and each of those has its penalties.
 */

export const ENCOUNTER_VERSION = 3;

export type Stage = 'seen' | 'menu' | 'surveil' | 'violence' | 'combat' | 'over';
export type Result = 'won' | 'lost' | 'they-fled' | 'you-fled' | 'lost-them' | 'left' | 'walked' | 'killed' | 'mugged';
export type Side = 'you' | 'them';
export type Part = 'nose' | 'ribs' | 'left arm' | 'right arm' | 'left leg' | 'right leg';
export type Loc = 'head' | 'body' | 'stomach' | 'arm' | 'leg';

/** Something that happened to a body this move, for the screen and the phone to react to. */
export interface Impact {
  /** Who was hurt. */
  target: Side;
  /** Blood lost (ml). */
  ml: number;
  /** A big moment: a break, a knockout, or a very heavy blow. */
  severe: boolean;
  loc: Loc;
  /** What blood, if any, it throws: a punch to the gut throws none. */
  spill: Spill;
}

/**
 * Blood thrown by a blow, from none to worst:
 * - drip: a few drops (an open break, a split lip)
 * - spatter: a fine spray of droplets (a blow to a face that's already bleeding)
 * - cough: blood coughed up from a punctured lung (a fine, frothy mist)
 * - spray: a cut, flinging a line of drops off the blade
 * - splash: a burst (a nose breaking, a stamp on a bleeding head)
 */
export type Spill = 'none' | 'drip' | 'spatter' | 'cough' | 'spray' | 'splash';
const SPILL_RANK: Spill[] = ['none', 'drip', 'spatter', 'cough', 'spray', 'splash'];

export interface LogLine {
  by: Side | 'info';
  text: string;
  /** A blow landed in this line, on this side (shown highlighted). */
  hit?: Side;
}

/** Someone's body in a fight. */
export interface Body {
  /**
   * How awake you are, 100 to 0: blunt blows (to the head above all) knock it
   * down, and at 0 you're knocked out. Below 0 is how deep under you are; a
   * beating that drives it to -100 kills (a brain can only take so much).
   */
  awake: number;
  /** Blood (ml): only cuts and bleeding lose it. Passes out at or below 55% of `maxBlood`. */
  blood: number;
  maxBlood: number;
  /** How much punishment it takes to lose that much blood. */
  toughness: number;
  stamina: number;
  maxStamina: number;
  /** 0 none, 1 light, 2 moderate, 3 heavy, 4 severe. */
  bleeding: number;
  /** Turns left dazed. */
  dazed: number;
  concussed: boolean;
  broken: Part[];
  /** On the floor (rather than standing). */
  down: boolean;
  /** Next blow against them is easier to land. */
  offBalance: boolean;
  /** Turns left half blind (pepper spray: it lasts the rest of the fight). */
  blinded: number;
  /** Something injected that hasn't hit yet (a needle takes a minute to work). */
  dosing?: { drug: Exclude<import('./person').Drug, 'empty'>; in: number };
  /** Knocked unconscious. */
  out?: boolean;
  /** Winded (stamped on the stomach): loses their next move. */
  winded?: boolean;
  /** Told you they're unconscious already. */
  outNoted?: boolean;
  /** Their breathing has gone shallow: close to bleeding out. */
  dyingNoted?: boolean;
  dead?: boolean;
  /** A broken rib has gone into a lung: every breath is a fight. */
  lung?: boolean;
  /** Yours only: how stressed you are (0..100), and how used to violence (0..100). */
  stress?: number;
  nerve?: number;
  /** What's been done to them that shows, and stays (see Marks). */
  marks?: Marks;
  /** Yours: a cigarette in your mouth (cooler under pressure), until a blow knocks it out. */
  smoking?: boolean;
  /** Yours: on something from a syringe (see `dose`), for this fight. */
  high?: 'heroin' | 'fentanyl' | 'meth' | 'tranq';
  /** Yours: how drunk (0..100), and how much caffeine is in you (mg). */
  drunk?: number;
  caffeine?: number;
  /** Theirs: how scared of you they are, 0..100 (see `scare`). */
  fear?: number;
  /** Theirs: they've given up. They won't fight; they'll hand it over. */
  yielded?: boolean;
}

/**
 * Marks on a body that last beyond a fight: teeth knocked out and scars stay
 * for good; a split lip, a cut brow, a black eye, a swollen cheek heal in a
 * few days; a broken jaw takes weeks. (Broken bones are kept in `broken`.)
 */
export interface Marks {
  teeth?: number;
  lip?: boolean;
  brow?: boolean;
  eye?: boolean;
  cheek?: boolean;
  jaw?: boolean;
  /** Fingers broken (torture), a crushed hand. */
  fingers?: number;
  hand?: boolean;
  scars?: string[];
}

/** How someone's marks look, for their card ("Missing 3 teeth", "Black eye"). */
export function marksText(m: Marks | undefined): string[] {
  if (!m) return [];
  const out: string[] = [];
  if (m.jaw) out.push('Jaw wired shut');
  if (m.hand) out.push('A hand in a cast');
  else if (m.fingers) out.push(m.fingers === 1 ? 'A finger in a splint' : `${m.fingers} fingers in splints`);
  if (m.teeth) out.push(m.teeth === 1 ? 'A tooth missing' : `${m.teeth} teeth missing`);
  if (m.eye) out.push('Black eye');
  if (m.brow) out.push('Stitches over one eye');
  if (m.lip) out.push('Split lip');
  if (m.cheek) out.push('Swollen face');
  const scars = [...new Set(m.scars ?? [])];
  if (scars.length) out.push(`Scar${scars.length > 1 ? 's' : ''}: ${scars.join(', ')}`);
  return out;
}

/**
 * Stress (yours): it builds while you fight, when you're hit, when you land
 * a blow, and most of all when you kill. Nerve, built up fight by fight,
 * takes the edge off; at full nerve, violence doesn't stress you any more.
 */
export function addStress(f: Body, n: number) {
  // A cigarette in your mouth keeps you cool: it gets to you less.
  const k = (1 - Math.min(100, f.nerve ?? 0) / 100) * (f.smoking ? 0.6 : 1) * ((f.caffeine ?? 0) >= 400 ? 1.25 : 1);
  f.stress = Math.min(100, Math.max(0, (f.stress ?? 0) + n * k));
}
/** Stressed hands shake and eyes narrow: less accurate, slower to dodge. */
export const stressPenalty = (f: Body) => ((f.stress ?? 0) / 100) * 0.25;
export const STRESS_NAMES = ['', 'On edge', 'Stressed', 'Panicking'];
export const stressLevel = (s: number) => (s >= 75 ? 3 : s >= 45 ? 2 : s >= 20 ? 1 : 0);

export interface Encounter {
  version: number;
  person: Person;
  stage: Stage;
  /** How close you are: 0 across the street, 1 behind them, 2 right on them. */
  distance: number;
  /** How close they are to noticing you (0..100). */
  suspicion: number;
  /** What you've made out about them (race and sex take a proper look; face to face, you see). */
  known: { build: boolean; carrying: boolean; awareness: boolean; sex: boolean; race?: boolean; personality?: boolean };
  you: Body;
  them: Body & { weaponOut: string | null; sprayed: boolean };
  log: LogLine[];
  result: Result | null;
  /** They got a look at you (conscious, face to face) at some point. */
  facedYou?: boolean;
  /** They know you from before (see people.ts), and how much they hate you. */
  recognised?: boolean;
  grudge?: number;
  /** What you know of them: what you did, how they look now. */
  history?: string;
  looks?: string[];
  /** A mask over your face: people get wary of you faster. */
  conspicuous?: boolean;
  /** How they were when this began (blood, broken bones), to tell what's new. */
  start?: { blood: number; broken: Part[] };
  /** It came to blows (a round of a fight was fought). */
  fought?: boolean;
  /** You went through their pockets / stamped on them while they were down. */
  robbed?: boolean;
  stomped?: boolean;
  /** You took things off them while they'd given up; how many times you tortured them. */
  mugged?: boolean;
  tortured?: number;
  /** How much they dreaded you from before (people.ts Memory.fear). */
  dread?: number;
  /** Whose cards these are (the name on them), to ask for the PIN. */
  holder?: string;
  /** They turned their pockets out for you. */
  emptied?: boolean;
  /** Questions already asked. */
  asked?: string[];
  /** Set by the game each time it draws: a flame to hand, cards of theirs in
   *  your pockets without a PIN (index in your items), someone has your old things. */
  flame?: boolean;
  cardsHeld?: { i: number; name: string }[];
  canAsk?: boolean;
  /** Your weapons (index in your items), set by the game as it draws. */
  weapons?: { i: number; name: string; weapon?: number; cuts?: boolean; spray?: boolean; doses?: number; loaded?: string; known?: boolean }[];
  /** Out in the rain (a lighter burns more fuel). */
  wet?: boolean;
  /** Lines said lately in this fight (so they aren't said again straight away). */
  recent?: string[];
  /** Your Unarmed level (which techniques you know), set as you act. */
  unarmedLevel?: number;
  /** What they told you: someone has your old things ('thief'), or nothing. */
  tip?: 'thief' | 'none';
}

export interface Option {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  /** Which tab it's under. Options without one are always shown, below the tabs. */
  cat?: Category;
  /** A section within the tab (Strikes, Weapons, On the ground, Torture...). */
  group?: string;
}

/** The tabs the options are sorted into. */
export type Category = 'surveil' | 'violence' | 'attack' | 'stomp' | 'search' | 'threaten' | 'torture' | 'move';
export const CATEGORY_NAMES: Record<Category, string> = {
  surveil: 'Surveil',
  violence: 'Violence',
  attack: 'Attack',
  stomp: 'Violence',
  search: 'Search',
  threaten: 'Threaten',
  torture: 'Torture',
  move: 'Move',
};
const SURVEIL_IDS = ['follow', 'build', 'carrying', 'awareness', 'sex', 'read'];
const VIOLENCE_IDS = ['bumrush', 'sucker', 'shove', 'mug', 'kneecap', 'slam', 'rear-choke', 'spray-ambush'];

// ---------- Fear ----------

export const FEAR_NAMES = ['Calm', 'Wary', 'Scared', 'Terrified'];
export const fearLevel = (f: number) => (f >= 70 ? 3 : f >= 45 ? 2 : f >= 20 ? 1 : 0);
/** Chance they give up when you tell them to (fear, and a bonus for surprise). */
export const yieldChance = (e: Encounter, bonus = 0) => clamp(((e.them.fear ?? 0) - 20) / 60 + bonus + personalityOf(e.person).yield, 0.04, personalityOf(e.person).maxYield);
/** How it looks, on the button. */
const oddsHint = (p: number) => (p >= 0.7 ? 'They look ready to break' : p >= 0.4 ? 'They might give it up' : p >= 0.15 ? 'They look unsure of you' : "They aren't scared of you");
/** They get more (or less) scared of you. */
function scare(n: number) {
  const T = enc.them;
  T.fear = clamp((T.fear ?? 0) + n, 0, 100);
}

/** Can you go through their clothes? Once they can't stop you, or they've given up. */
export const searchable = (e: Encounter) => (!!(e.them.out || e.them.dead) && (!e.you.down || e.stage === 'over')) || (!!e.them.yielded && e.stage === 'combat');

/** Searching: each garment, then whatever you found in it to take (not what they're hiding). */
function searchOptions(e: Encounter): Option[] {
  const found: Option[] = [];
  const todo: Option[] = [];
  e.person.clothes.forEach((g, gi) => {
    if (!g.searched) {
      if (!e.them.yielded) todo.push({ id: `search:${gi}`, label: `Search their ${g.name.toLowerCase()}`, cat: 'search' });
    } else
      g.loot.forEach((l, li) => {
        if (!l.hidden || !e.them.yielded) found.push({ id: `take:${gi}:${li}`, label: lootLabel(l), hint: l.where === 'wallet' ? 'In their wallet' : `${g.name}, ${l.where}`, cat: 'search' });
      });
  });
  // What they were carrying to hurt you with: in their hand, or on the ground by them.
  e.person.carrying.forEach((it, ci) => {
    if ((it.weapon || it.spray) && (!e.them.yielded || e.emptied))
      found.push({ id: `takec:${ci}`, label: it.name, hint: e.them.weaponOut === it.name ? 'On the ground by them' : 'They were carrying it', cat: 'search' });
  });
  const all: Option[] = found.length > 1 ? [{ id: 'take-all', label: 'Take everything', hint: `${found.length} things`, cat: 'search' }] : [];
  const out = [...all, ...found, ...todo];
  return out.length ? out : [{ id: 'nothing', label: 'Nothing left on them', disabled: true, cat: 'search' }];
}

/** Your weapons, as attacks (pepper spray, while it lasts). */
function weaponOptions(e: Encounter, cat: Category, tired: (n: number) => boolean): Option[] {
  const seen = new Set<string>();
  return (e.weapons ?? [])
    .filter((w) => { const key = `${w.name}|${w.loaded ?? ''}`; return !seen.has(key) && !!seen.add(key); })
    .map((w) =>
      w.spray
        ? { id: `wpn:${w.i}`, label: 'Pepper spray them', hint: `${w.doses ?? 0} left · blinds them`, cat }
        : { id: `wpn:${w.i}`, label: /bottle/i.test(w.name) ? 'Swing the bottle' : /syringe/i.test(w.name) ? (w.loaded ? `Stab with the syringe (${w.known ? w.loaded : 'loaded'})` : 'Stab with the empty syringe') : `${w.cuts ? 'Slash' : 'Hit'} with the ${lc(w.name)}`, hint: tired(COST.weapon) ? 'Too tired' : `+${w.weapon ?? 0} damage${w.cuts && !/bottle/i.test(w.name) ? ', cuts' : ''}${w.loaded ? ', may inject them' : ''}`, disabled: tired(COST.weapon), cat },
    );
}

/**
 * The techniques you've learned (by Unarmed level), and the next one you
 * haven't, shown greyed out so you know what's coming.
 */
function learned(e: Encounter, list: (Omit<Option, 'cat'> & { level: number })[], cat: Category): Option[] {
  const lvl = e.unarmedLevel ?? 1;
  const known = list.filter((t) => t.level <= lvl).map(({ level: _l, ...o }) => ({ ...o, cat }));
  const next = list.filter((t) => t.level > lvl).sort((a, b) => a.level - b.level)[0];
  return next ? [...known, { id: `locked:${next.id}`, label: next.label, hint: `Learn at Unarmed ${next.level}`, disabled: true, cat }] : known;
}

/** They've given up: rob them, question them, hurt them, or let them go. */
function yieldedOptions(e: Encounter): Option[] {
  const T = e.them;
  const asked = e.asked ?? [];
  const out: Option[] = [];
  if (!e.emptied) out.push({ id: 'empty', label: '"Empty your pockets"', hint: 'They hand it over', cat: 'search' });
  out.push(...(e.emptied || e.person.clothes.some((g) => g.searched) ? searchOptions(e).filter((o) => o.id !== 'nothing') : []));
  out.push({ id: 'patdown', label: 'Pat them down', hint: 'Slower, but nothing gets past you', cat: 'search' });
  // Questions.
  out.push({ id: 'menace', label: '"Don\'t even think about it"', hint: 'Scare them more', cat: 'threaten' });
  if (e.emptied) out.push({ id: 'ask-rest', label: '"Is that everything?"', hint: 'Are they holding out on you?', cat: 'threaten' });
  e.person.clothes.forEach((g, gi) =>
    g.loot.forEach((l, li) => {
      if (g.searched && !l.hidden && /card/.test(l.kind) && !l.pin) out.push({ id: `pin:${gi}:${li}`, label: '"What\'s the PIN?"', hint: `Their ${l.name.toLowerCase()}`, cat: 'threaten' });
    }),
  );
  for (const c of e.cardsHeld ?? []) out.push({ id: `pin-mine:${c.i}`, label: '"What\'s the PIN?"', hint: `The ${c.name.toLowerCase()} you took`, cat: 'threaten' });
  if (e.canAsk && !asked.includes('thief')) out.push({ id: 'ask-thief', label: '"Seen anyone with my things?"', hint: 'What you had, before', cat: 'threaten' });
  // Hurting them, for the truth or for the fun of it.
  const fingers = T.marks?.fingers ?? 0;
  out.push({ id: 't-finger', label: 'Bend a finger back', hint: fingers >= 10 ? 'None left to break' : 'Until it snaps', disabled: fingers >= 10, cat: 'torture' });
  out.push({ id: 't-stamp', label: 'Stamp on their hand', hint: T.down ? undefined : 'Knocks them down first', cat: 'torture' });
  if (arms(T)) out.push({ id: 't-twist', label: 'Twist the broken arm', cat: 'torture' });
  out.push({ id: 'punch', label: 'Hit them anyway', hint: 'It turns back into a fight', cat: 'attack' });
  out.push({ id: 'let-go', label: 'Let them go', hint: e.robbed ? 'With what you took' : undefined });
  return out;
}

/** At or below this share of their blood, people pass out. */
export const PASS_OUT = 0.55;
/** Someone unconscious dies when their blood falls this low (a fraction of all of it). */
export const DEATH = 0.4;
export const BLEEDING = ['None', 'Light', 'Moderate', 'Heavy', 'Severe'];
/** Blood lost per turn at each level of bleeding, per 5 litres of blood. */
const BLEED_ML = [0, 35, 80, 150, 260];
/** How much a blunt blow there takes out of staying awake (the head, the most). */
const AWAKE_HIT: Record<Loc, number> = { head: 2.2, body: 0.8, stomach: 0.7, arm: 0.4, leg: 0.5 };
const COST = { punch: 8, kick: 14, grapple: 12, weapon: 10, run: 15, getUp: 10, ambush: 10 };

function body(blood: number, toughness: number, stamina: number): Body {
  return {
    awake: 100,
    blood,
    maxBlood: blood,
    toughness,
    stamina,
    maxStamina: stamina,
    bleeding: 0,
    dazed: 0,
    concussed: false,
    broken: [],
    down: false,
    offBalance: false,
    blinded: 0,
  };
}

/** A new encounter. `yours` is your body as it is now (injuries carry over). */
export function newEncounter(person: Person, yours: Body): Encounter {
  // Whatever they kept back from you last time, they've had time to put back.
  for (const g of person.clothes) {
    g.searched = false;
    for (const l of g.loot) delete l.hidden;
  }
  const b = BUILDS[person.build];
  const tired = person.kind === 'junkie' || person.kind === 'drunk' ? 0.8 : 1;
  return {
    version: ENCOUNTER_VERSION,
    person,
    stage: 'seen',
    distance: 0,
    suspicion: 0,
    known: { build: false, carrying: false, awareness: false, sex: false, race: false, personality: false },
    you: yours,
    them: { ...body(b.blood, b.hp, Math.round(b.stamina * tired)), weaponOut: null, sprayed: false },
    log: [],
    result: null,
    // The name on their cards (to ask for a PIN).
    holder: person.clothes.flatMap((g) => g.loot).find((l) => l.kind === 'id' || /card/.test(l.kind))?.detail?.split(',')[0],
  };
}

const DISTANCE = ['Across the street', 'Behind them', 'Right on them'];
export const distanceLabel = (e: Encounter) => DISTANCE[e.distance];

/** The states someone is in, for showing (e.g. "On the floor", "Bleeding: Heavy"). */
export function conditions(f: Body): string[] {
  const c: string[] = [];
  c.push(f.dead ? 'Dead' : f.out ? 'Unconscious' : f.down ? 'On the floor' : 'Standing');
  if (f.winded) c.push('Winded');
  if (f.dazed > 0) c.push('Dazed');
  if (f.concussed) c.push('Concussed');
  if (f.bleeding) c.push(`Bleeding: ${BLEEDING[f.bleeding]}`);
  if (f.lung) c.push('Punctured lung');
  for (const p of f.broken) c.push(`Broken ${p}`);
  if (f.blinded > 0) c.push('Blinded');
  if (f.stamina <= 0) c.push('Exhausted');
  if (f.high) c.push(`High: ${f.high}`);
  if ((f.caffeine ?? 0) >= 40) c.push((f.caffeine ?? 0) >= 600 ? 'Heart racing' : (f.caffeine ?? 0) >= 400 ? 'Jittery' : 'Alert');
  if (f.drunk && f.drunk >= 10) c.push(f.drunk >= 80 ? 'Blackout drunk' : f.drunk >= 55 ? 'Wasted' : f.drunk >= 30 ? 'Drunk' : 'Tipsy');
  const sl = stressLevel(f.stress ?? 0);
  if (sl) c.push(STRESS_NAMES[sl]);
  return c;
}

const legs = (f: Body) => f.broken.filter((p) => p.endsWith('leg')).length;
const arms = (f: Body) => f.broken.filter((p) => p.endsWith('arm')).length;
/** Broken ribs make every breath hurt, and a punctured lung is worse. */
const ribs = (f: Body) => (f.lung ? 2.4 : f.broken.includes('ribs') ? 1.8 : 1);
const cost = (f: Body, n: number) => Math.round(n * ribs(f));
/** How much of your stamina you can get back with broken ribs (you can't fill your lungs). */
export const staminaCap = (f: Body) => f.maxStamina * (f.lung ? 0.3 : f.broken.includes('ribs') ? 0.5 : 1);

/** Chance to run away (or for them, to get away). Legs matter most. */
function fleeChance(f: Body, other: Body, bonus = 0) {
  if (f.down) return 0;
  let c = 0.6 + bonus + (other.down ? 0.25 : 0) + (other.dazed ? 0.15 : 0);
  c *= [1, 0.35, 0.08][legs(f)];
  if (f.dazed) c -= 0.15;
  if (f.stamina < cost(f, COST.run)) c -= 0.25;
  return Math.max(0.02, Math.min(0.95, c));
}

/** Chance to get back up off the floor. */
const getUpChance = (f: Body) => Math.max(0.1, 0.8 - legs(f) * 0.3 - (f.dazed ? 0.2 : 0) - (f.stamina < COST.getUp ? 0.3 : 0));

/** What you can do right now, sorted into tabs (see `Category`). */
/**
 * What you can do right now. All the violence (strikes, weapons, what you do
 * to someone on the ground, torture, ambushes) is one tab, in sections;
 * moving (run, get up, catch your breath, walk away) isn't a tab at all, just
 * a row of buttons under the tabs.
 */
export function options(e: Encounter): Option[] {
  const GROUP_ORDER = ['Ambush', 'Strikes', 'Weapons', 'On the ground', 'Torture'];
  const out = rawOptions(e).map((o): Option => {
    if (o.cat === 'move') return { ...o, cat: undefined };
    if (o.cat === 'attack' || o.cat === 'stomp' || o.cat === 'torture' || o.cat === 'violence') {
      const group = o.cat === 'torture' ? 'Torture' : o.cat === 'violence' ? 'Ambush' : o.id.startsWith('wpn:') ? 'Weapons' : o.cat === 'stomp' || o.id === 'choke' || o.id === 'locked:choke' ? 'On the ground' : 'Strikes';
      return { ...o, cat: 'violence', group };
    }
    return o;
  });
  // Sections in a steady order (everything else keeps its place).
  const harm = out
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => o.cat === 'violence')
    .sort((a, b) => GROUP_ORDER.indexOf(a.o.group ?? '') - GROUP_ORDER.indexOf(b.o.group ?? '') || a.i - b.i)
    .map(({ o }) => o);
  let k = 0;
  return out.map((o) => (o.cat === 'violence' ? harm[k++] : o));
}

function rawOptions(e: Encounter): Option[] {
  switch (e.stage) {
    case 'menu':
    case 'surveil':
    case 'violence':
      // Before anything has happened: watch them, or go for them. Switching
      // between the two is free; it's only a tab.
      return [
        { id: 'follow', label: e.distance < 2 ? 'Follow' : 'Keep following', hint: e.distance < 2 ? 'Get closer' : undefined, cat: 'surveil' },
        { id: 'build', label: 'Size up their build', disabled: e.known.build, cat: 'surveil' },
        { id: 'carrying', label: 'What are they carrying?', disabled: e.known.carrying, hint: e.distance < 1 ? 'Need to be closer' : undefined, cat: 'surveil' },
        { id: 'awareness', label: 'How aware are they?', disabled: e.known.awareness, cat: 'surveil' },
        { id: 'sex', label: 'Get a look at them', hint: e.known.sex && e.known.race ? undefined : e.distance < 1 ? 'Hard to tell from here' : 'Their face, their build', disabled: e.known.sex && !!e.known.race, cat: 'surveil' },
        { id: 'read', label: 'Read them', hint: e.known.personality ? undefined : e.distance < 1 ? 'Need to be closer' : 'What kind of person?', disabled: !!e.known.personality, cat: 'surveil' },
        { id: 'bumrush', label: 'Bum rush', hint: 'Knock them down', cat: 'violence' },
        { id: 'sucker', label: 'Sucker punch', hint: 'Hit them in the head', cat: 'violence' },
        { id: 'shove', label: 'Shove', hint: 'Easiest to land', cat: 'violence' },
        ...learned(e, [
          { id: 'kneecap', label: 'Kick their knee', hint: 'From behind: down they go', level: KNEE_AMBUSH_LEVEL },
          { id: 'slam', label: 'Slam them into the wall', hint: 'Head first', level: SLAM_AMBUSH_LEVEL },
          { id: 'rear-choke', label: 'Choke from behind', hint: e.distance < 2 ? 'Get right behind them first' : 'Out cold, no blood', level: CHOKE_AMBUSH_LEVEL, disabled: e.distance < 2 },
        ], 'violence'),
        ...((e.weapons ?? []).some((w) => w.spray) ? [{ id: 'spray-ambush', label: 'Pepper spray them', hint: 'Blind them first', cat: 'violence' as Category }] : []),
        { id: 'mug', label: 'Mug them', hint: oddsHint(yieldChance(e, mugSurprise(e))), cat: 'violence' },
        { id: 'leave', label: 'Leave them' },
      ];
    case 'combat': {
      const y = e.you;
      const tired = (n: number) => y.stamina < cost(y, n);
      const armHint = arms(y) ? `Your arm${arms(y) > 1 ? 's are' : ' is'} broken` : undefined;
      const legHint = legs(y) ? `Your leg${legs(y) > 1 ? 's are' : ' is'} broken` : undefined;
      const out = !!e.them.out;
      const run: Option = { id: 'run', label: 'Run', hint: legHint ?? (tired(COST.run) ? 'Too tired' : undefined), cat: 'move' };
      const breathe: Option = { id: 'breathe', label: 'Catch your breath', cat: 'move' };
      const stomps = (why?: string, t = tired(COST.kick)): Option[] => [
        { id: 'stomp-head', label: 'Stomp: head', hint: t ? 'Too tired' : (why ?? 'Can knock them out'), disabled: t, cat: 'stomp' },
        { id: 'stomp-stomach', label: 'Stomp: stomach', hint: t ? 'Too tired' : (why ?? 'Winds them'), disabled: t, cat: 'stomp' },
        { id: 'stomp-ribs', label: 'Stomp: ribs', hint: t ? 'Too tired' : (why ?? 'Can break them'), disabled: t, cat: 'stomp' },
      ];
      // On them while they're down: knee drop, ground and pound, wrenching an arm.
      const ground = (): Option[] => learned(e, GROUND.map((t) => ({ id: t.id, label: t.name, hint: tired(t.cost) ? 'Too tired' : t.kind === 'punch' ? (armHint ?? t.hint) : t.hint, level: t.level, disabled: tired(t.cost) })), 'stomp');
      if (y.down) {
        return [
          { id: 'punch', label: 'Punch', hint: armHint ?? 'From the floor', cat: 'attack' },
          { id: 'kick', label: 'Kick', hint: tired(COST.kick) ? 'Too tired' : 'From the floor', disabled: tired(COST.kick), cat: 'attack' },
          ...weaponOptions(e, 'attack', tired),
          ...(e.them.down ? [] : learned(e, FLOOR.map((t) => ({ id: t.id, label: t.name, hint: tired(t.cost) ? 'Too tired' : t.hint, level: t.level, disabled: tired(t.cost) })), 'attack')),
          { id: 'getup', label: 'Get up', hint: legHint ?? (y.dazed ? 'Dazed' : undefined), cat: 'move' },
          out ? { id: 'walk', label: 'Crawl away', hint: "They're unconscious", cat: 'move' } : breathe,
        ];
      }
      if (out) {
        // They're unconscious: it isn't a fight any more. Keep going, go
        // through their pockets, wake them up to talk, or walk away.
        const wake: Option[] = e.them.dead ? [] : [{ id: 'wake', label: 'Slap them awake', hint: canWake(e) ? 'Have a word with them' : "They're too far gone", disabled: !canWake(e), cat: 'threaten' }];
        return [...stomps(), ...ground(), ...weaponOptions(e, 'stomp', tired).filter((o) => !/spray/i.test(o.label)), ...searchOptions(e), ...wake, breathe, { id: 'walk', label: 'Walk away', cat: 'move' }];
      }
      if (e.them.yielded) return yieldedOptions(e);
      const demand: Option = { id: 'demand', label: '"Give it up"', hint: oddsHint(yieldChance(e)), cat: 'threaten' };
      if (e.them.down) return [...stomps(legHint), ...ground(), ...weaponOptions(e, 'stomp', tired).filter((o) => !/spray/i.test(o.label)), ...learned(e, [{ id: 'choke', label: 'Headlock', hint: tired(14) ? 'Too tired' : armHint ?? 'Squeeze till they go out', level: CHOKE_LEVEL, disabled: tired(14) }], 'attack'), demand, run, breathe];
      return [
        { id: 'punch', label: 'Punch', hint: armHint, cat: 'attack' },
        { id: 'kick', label: 'Kick', hint: tired(COST.kick) ? 'Too tired' : legHint, disabled: tired(COST.kick), cat: 'attack' },
        { id: 'grapple', label: 'Grapple', hint: tired(COST.grapple) ? 'Too tired' : (armHint ?? 'Take them down'), disabled: tired(COST.grapple), cat: 'attack' },
        ...learned(
          e,
          TECHNIQUES.map((t) => ({ id: t.id, label: t.name, hint: tired(t.cost) ? 'Too tired' : t.kind === 'kick' ? (legHint ?? t.hint) : (armHint ?? t.hint), level: t.level, disabled: tired(t.cost) })),
          'attack',
        ),
        ...weaponOptions(e, 'attack', tired),
        demand,
        run,
        breathe,
      ];
    }
    case 'over':
      return [
        ...(e.them.dead ? searchOptions(e) : []),
        ...(e.them.dead ? [{ id: 'leave-body', label: 'Walk away', hint: 'Leave the body where it lies' }] : []),
        { id: 'lurk', label: 'Lurk again' },
        { id: 'rest', label: 'Rest', hint: 'Let time pass and heal' },
      ];
    default:
      return [];
  }
}

/** Your stats, and a way to train them, for the move being played out. */
let you: { stats: Stats; gain: (name: StatName, xp: number) => void };
/** How many times you've tried each move (yours, kept between fights). */
let practice: Record<string, number> = {};
/**
 * Trying a move: one more use of it, and how practiced it now reads (see
 * practice.ts). Says so when it moves up a tier.
 */
function practise(key: string, skill: 'unarmed' | 'weapons' = 'unarmed'): Tier {
  const lvl = you.stats[skill]?.level ?? 1;
  const before = tierOf(practice[key] ?? 0, lvl);
  practice[key] = (practice[key] ?? 0) + 1;
  const now = tierOf(practice[key], lvl);
  if (now > before) pendingTier = tierUpLine(key, now);
  return before;
}
/** A move got better this turn: said at the end of it. */
let pendingTier: string | null = null;
let enc: Encounter;
let impacts: Impact[] = [];
/** Were they already unconscious when this move began? */
let outBefore = false;
/** Who the last blow landed on, for the next line said (see LogLine.hit). */
let landed: Side | null = null;
const say = (by: LogLine['by'], text: string) => {
  enc.log.push(landed ? { by, text, hit: landed } : { by, text });
  landed = null;
};

/** Does one thing (an option id, or 'open' to start from the person button). */
export function act(e: Encounter, id: string, stats: Stats, inv?: Inventory, moves?: Record<string, number>): Impact[] {
  practice = moves ?? {};
  e.you.awake ??= 100;
  e.them.awake ??= e.them.out ? -25 : 100;
  pendingTier = null;
  const out = actInner(e, id, stats, inv);
  // Face to face (a fight, a mugging, a word), you can see who they are.
  if (e.stage !== 'seen' && e.stage !== 'menu' && e.stage !== 'surveil') e.known.sex = e.known.race = true;
  if (pendingTier) e.log.push({ by: 'info', text: pendingTier });
  pendingTier = null;
  return out;
}

function actInner(e: Encounter, id: string, stats: Stats, inv?: Inventory): Impact[] {
  impacts = [];
  landed = null;
  enc = e;
  e.unarmedLevel = stats.unarmed?.level ?? 1;
  outBefore = !!e.them.out;
  you = {
    stats,
    gain(name, xp) {
      const up = train(stats, name, xp);
      if (up) say('info', `${STAT_NAMES[name]} went up to ${up}.`);
    },
  };
  // Going through their clothes (unconscious, or dead).
  if (id.startsWith('search:') || id.startsWith('take')) {
    if (!searchable(e)) return impacts;
    const robbedBefore = !!e.robbed;
    const taken = e.person.clothes.reduce((n, g) => n + g.loot.length, 0);
    search(id, inv);
    if (e.them.yielded && e.robbed && (!robbedBefore || e.person.clothes.reduce((n, g) => n + g.loot.length, 0) < taken)) e.mugged = true;
    // Searching takes a moment, and they go on bleeding.
    if (e.stage === 'combat' && id.startsWith('search:')) endOfRound();
    return impacts;
  }
  if (e.stage === 'over') return impacts;
  const p = e.person;
  const aw = AWARENESS.indexOf(p.awareness);
  const who = p.kind === 'homeless' ? 'homeless one' : NAMES[p.kind].toLowerCase();

  // Someone you hurt, and they've been looking for you: they find you first.
  if (id === 'ambushed' && e.stage === 'seen') {
    e.stage = 'combat';
    e.facedYou = true;
    say('them', oneOf([`A hand grabs your shoulder and spins you round. It's the ${who} from before. "Remember me?"`, `Someone steps out of a doorway right in front of you: the ${who}. They've been waiting for you.`]));
    say('info', 'The fight is on.');
    theirTurn();
    endOfRound();
    return impacts;
  }
  if (id === 'open') {
    if (e.stage === 'seen') {
      e.stage = 'menu';
      if (e.recognised) {
        // They know you.
        e.facedYou = true;
        const lame = legs(e.them) > 0;
        if ((e.dread ?? 0) >= 60 && (e.them.fear ?? 0) >= 60) {
          // What you did to them last time: they won't go through it again.
          say('them', oneOf([`The ${who} sees you and goes white. They know you. "Please. Not again. Take it, take whatever you want."`, `The ${who} sees you coming and their legs nearly go. They're already holding out their wallet.`]));
          e.stage = 'combat';
          e.them.yielded = true;
          e.distance = 2;
          you.gain('intimidation', 6);
        } else if ((e.grudge ?? 0) >= 50 && !lame && arms(e.them) < 2) {
          say('them', oneOf([`The ${who} looks up and sees you, and their face changes. They know you. They come straight at you.`, `"You." The ${who} knows you. They're already coming.`]));
          e.stage = 'combat';
          say('info', 'The fight is on.');
          theirTurn();
          endOfRound();
        } else if (lame) {
          say('them', `The ${who} sees you and goes rigid. They know you. On crutches, they can't run; they back up against the wall.`);
          e.suspicion = 100;
          e.distance = 1;
        } else {
          say('them', oneOf([`The ${who} sees you, and knows you. They hurry away, looking back over their shoulder.`, `The ${who} catches sight of you and freezes, then runs.`]));
          end('lost-them');
        }
      } else say('info', `${p.kind === 'homeless' ? 'Someone homeless' : `A ${who}`}, ${DISTANCE[0].toLowerCase()}. They haven't seen you.`);
    }
    return impacts;
  }

  // Surveil and violence are tabs: picking an option from either one is
  // what decides which you're doing.
  if (e.stage === 'menu' || e.stage === 'surveil' || e.stage === 'violence') {
    if (SURVEIL_IDS.includes(id)) e.stage = 'surveil';
    else if (VIOLENCE_IDS.includes(id)) e.stage = 'violence';
  }
  if (id === 'leave' && (e.stage === 'menu' || e.stage === 'surveil' || e.stage === 'violence')) {
    say('info', 'You let them go.');
    end('left');
    return impacts;
  }
  if (e.stage === 'menu') return impacts;

  // ---------- Surveil ----------
  if (e.stage === 'surveil') {
    // How much each move raises their suspicion: more if they're aware, less
    // the sneakier you are.
    const watch = (base: number) => {
      e.suspicion += base * [0.4, 0.8, 1.4, 2.0][aw] * (1 + e.distance * 0.4) * (0.7 + Math.random() * 0.6) * noticeRate(stats) * (e.conspicuous ? 1.6 : 1);
    };
    switch (id) {
      case 'follow':
        if (e.distance < 2) {
          e.distance++;
          say('you', e.distance === 1 ? 'You cross over and fall in behind them.' : "You close the gap. You're right behind them now.");
        } else {
          say('you', oneOf(['They turn a corner. You follow.', 'You match their pace, a few steps back.', 'They stop at a crossing. So do you.']));
        }
        watch(12);
        you.gain('sneak', 4);
        break;
      case 'build': {
        const b = BUILDS[p.build];
        e.known.build = true;
        say('info', `${p.build} build. ${difficultyLine(b.difficulty)} (${b.difficulty})`);
        watch(5);
        you.gain('sneak', 2);
        break;
      }
      case 'carrying':
        if (e.distance < 1) {
          say('info', "Too far away to tell. You'd need to follow them.");
          return impacts;
        }
        e.known.carrying = true;
        say('info', p.carrying.length ? `They're carrying: ${p.carrying.map((i) => i.name.toLowerCase()).join(', ')}.` : "They aren't carrying anything.");
        const armed = p.carrying.find((i) => i.weapon || i.spray);
        if (armed) say('info', `The ${armed.name.toLowerCase()} could be trouble.`);
        watch(8);
        you.gain('sneak', 3);
        break;
      case 'awareness':
        e.known.awareness = true;
        say('info', `${p.awareness}. ${awarenessLine(p.awareness)}`);
        watch(3);
        you.gain('sneak', 2);
        break;
      case 'read': {
        if (e.distance < 1) {
          say('info', "Too far away to read them. You'd need to follow them.");
          return impacts;
        }
        e.known.personality = true;
        const P = personalityOf(p);
        say('info', `${P.name}. ${P.desc}`);
        watch(6);
        you.gain('sneak', 2);
        break;
      }
      case 'sex': {
        // Easier up close, in daylight, in the dry. A man or a woman shows
        // from further off (the walk, the build) than a face does.
        const dark = partOfDay() === 'night' ? 0.25 : partOfDay() === 'day' ? 0 : 0.1;
        const seeing = 1 - dark - (e.wet ? 0.1 : 0);
        const gotSex = e.known.sex || Math.random() < [0.7, 0.92, 1][e.distance] * seeing + 0.05;
        const gotRace = e.known.race || Math.random() < [0.3, 0.7, 0.95][e.distance] * seeing;
        const newSex = gotSex && !e.known.sex;
        const newRace = gotRace && !e.known.race;
        e.known.sex = gotSex;
        e.known.race = gotRace;
        const man = p.sex === 'Male' ? 'A man' : 'A woman';
        const why = dark >= 0.25 ? 'in the dark' : e.wet ? 'through the rain' : e.distance === 0 ? 'from across the street' : 'from behind';
        if (newSex && newRace) say('info', `${man}. ${p.race}.`);
        else if (newSex) say('info', `${man}, by the walk and the build. You can't make out their face ${why}.`);
        else if (newRace) say('info', `You catch their face as they turn: ${p.race}.`);
        else say('info', `You try to get a look, but ${why} you can't make out ${e.known.sex ? 'their face' : 'much'}.${e.distance < 2 ? ' Closer would help.' : ''}`);
        watch(3);
        you.gain('sneak', 2);
        break;
      }
    }
    // Getting noticed.
    if (e.suspicion >= 100) {
      spotted();
    } else if (e.suspicion >= 60 && Math.random() < 0.6) {
      say('them', oneOf(['They glance back over their shoulder.', 'They slow down. Listening.', 'They look around, then keep walking.']));
    }
    return impacts;
  }

  // ---------- Violence: pepper spray in the face, then the fight ----------
  if (e.stage === 'violence' && id === 'spray-ambush') {
    const can = inv?.items.findIndex((x) => x.spray);
    if (can == null || can < 0) return impacts;
    if (e.distance === 0) say('you', 'You cross the street toward them.');
    e.stage = 'combat';
    e.facedYou = true;
    spray(can, inv!);
    say('info', 'The fight is on.');
    theirTurn();
    endOfRound();
    return impacts;
  }

  // ---------- Violence: a mugging ----------
  if (e.stage === 'violence' && id === 'mug') {
    mug();
    return impacts;
  }

  // ---------- Violence: the ambush ----------
  if (e.stage === 'violence') {
    const b = BUILDS[p.build];
    const lvl = stats.unarmed?.level ?? 1;
    if ((id === 'kneecap' && lvl < KNEE_AMBUSH_LEVEL) || (id === 'slam' && lvl < SLAM_AMBUSH_LEVEL) || (id === 'rear-choke' && (lvl < CHOKE_AMBUSH_LEVEL || e.distance < 2))) return impacts;
    // Lands more often the sneakier you are, the less aware they are, and the
    // closer you got first. Bum rush and shove are easier to land than a punch.
    const extra = id === 'shove' ? 0.12 : id === 'bumrush' ? 0.06 : id === 'kneecap' ? 0.04 : id === 'slam' ? -0.02 : id === 'rear-choke' ? -0.08 : 0;
    const chance = clamp([0.8, 0.65, 0.45, 0.3][aw] + e.distance * 0.06 + ambushBonus(stats) + extra - b.guard * 0.5, 0.05, 0.97);
    if (e.distance === 0) say('you', 'You cross the street toward them.');
    e.stage = 'combat';
    spend('you', COST.ambush);
    you.gain('sneak', 4);
    let theyGoFirst = false;
    const at = AMBUSH_TEXT[id] ? practise(id) : 1;
    const amb = (k: string) => vary(AMBUSH_TEXT[k][at]);

    if (Math.random() < chance) {
      // It lands.
      you.gain('sneak', 4);
      you.gain('unarmed', 3);
      you.gain('strength', 1);
      const str = damageMult(stats);
      if (id === 'kneecap') {
        const dmg = Math.round(roll(8, 13) * str);
        say('you', `${amb('kneecap')} ${wound('them', 'leg', dmg, 'kick')}`);
        if (!e.them.down && Math.random() < (b.solid ? 0.5 : 0.8)) {
          e.them.down = true;
          say('them', "Their leg folds. They're on the floor.");
        }
      } else if (id === 'slam') {
        const dmg = Math.round(roll(15, 23) * str);
        say('you', `${amb('slam')} ${wound('them', 'head', dmg, 'punch')}`);
        if (!e.them.out && !e.them.dazed) {
          e.them.dazed = 2;
          say('them', "They're dazed.");
        }
        if (!e.them.down && !e.them.out && Math.random() < 0.5) {
          e.them.down = true;
          say('them', "They slide down the wall. They're on the floor.");
        }
      } else if (id === 'rear-choke') {
        e.them.stamina = Math.max(0, e.them.stamina - 60);
        if (Math.random() < 0.5 + (lvl - CHOKE_AMBUSH_LEVEL) * 0.01) {
          e.them.out = true;
          e.them.down = true;
          e.them.awake = -8; // choked out: back in seconds
          say('you', `${amb('rear-choke')} They kick, and claw at you, and then they sag. Out cold, and not a drop of blood.`);
        } else {
          e.them.down = true;
          say('you', 'You lock an arm round their throat from behind and drag them down. They tear free, choking, on the floor.');
        }
        scare(15);
      } else if (id === 'sucker') {
        const dmg = Math.round(roll(16, 24) * (aw === 0 ? 1.3 : 1) * str);
        say('you', `${amb('sucker')} ${wound('them', 'head', dmg, 'punch')}`);
      } else if (id === 'bumrush') {
        const dmg = Math.round(roll(10, 15) * str);
        if (!b.solid) {
          e.them.down = true;
          say('you', `${amb('bumrush').replace(/\.$/, '')}, and slam them into the pavement. ${wound('them', 'body', dmg, 'fall')} They're on the floor.`);
        } else {
          say('you', `${amb('bumrush')} They're heavy and hold their ground. ${wound('them', 'body', dmg, 'fall')}`);
          if (Math.random() < 0.35) {
            e.you.down = true;
            say('them', "You bounce off them and land on your back. You're on the floor.");
          } else say('them', 'You bounce off them.');
        }
      } else {
        const dmg = Math.round(roll(4, 8) * str);
        say('you', `${amb('shove').replace(/\.$/, '')}, into the wall. ${wound('them', 'body', dmg, 'fall')}`);
        if (Math.random() < 0.7) {
          e.them.down = true;
          say('them', "They lose their footing and go down. They're on the floor.");
        } else e.them.offBalance = true;
      }
    } else {
      // They react in time: block, dodge, or counter. Heavy builds tend to
      // block, quick ones to dodge, alert ones to counter.
      const how = pick<'block' | 'dodge' | 'counter'>([
        ['block', b.solid ? 3 : 1],
        ['dodge', 1 + b.guard * 10],
        ['counter', aw >= 2 ? 2 : 0.6],
      ]);
      const move = ({ sucker: 'punch', bumrush: 'rush', shove: 'shove', kneecap: 'kick', slam: 'grab', 'rear-choke': 'grab' } as Record<string, string>)[id] ?? 'move';
      if (how === 'block') {
        const dmg = Math.round(roll(2, 5) * damageMult(stats));
        say('them', `They turn just in time and block your ${move} with their arm. ${wound('them', 'arm', dmg, 'punch')}`);
      } else if (how === 'dodge') {
        say('them', `They hear you coming and dodge your ${move}. You stumble past.`);
        e.you.offBalance = true;
        theyGoFirst = true;
      } else {
        const dmg = Math.max(1, Math.round(b.power * 1.3) + roll(-2, 2));
        say('them', `They see it coming and counter: a hard hit straight back at you. ${wound('you', 'head', dmg, 'punch')}`);
      }
    }
    if (!checkEnd() && !e.them.out) {
      say('info', 'The fight is on.');
      if (theyGoFirst) theirTurn();
      endOfRound();
    }
    return impacts;
  }

  // ---------- Combat: your move, then theirs ----------
  if (e.stage === 'combat') {
    const y = e.you;
    if (y.blinded > 0) y.blinded--;
    // Talking, robbing and hurting someone who can't (or won't) fight back.
    if (threatAct(id, inv)) {
      if (checkEnd()) return impacts;
      theirTurn();
      endOfRound();
      return impacts;
    }
    if (e.stage !== 'combat') return impacts;
    if (e.them.yielded && (id === 'punch' || id === 'kick' || id.startsWith('stomp') || id.startsWith('wpn:') || id.startsWith('tech:'))) {
      // Hitting them anyway: it's a fight again (they didn't see it coming).
      e.them.yielded = false;
      e.them.offBalance = true;
      scare(8);
    }
    const tech = ALL_MOVES().find((t) => t.id === id);
    if (tech && tech.level > (stats.unarmed?.level ?? 1)) return impacts;
    // Each kind of move only where it makes sense.
    if (tech && GROUND.includes(tech) && (!e.them.down || y.down)) return impacts;
    if (tech && FLOOR.includes(tech) && (!y.down || e.them.down)) return impacts;
    if (tech && TECHNIQUES.includes(tech) && (y.down || e.them.down)) return impacts;
    switch (id) {
      case 'punch':
        strike('you', 'punch');
        break;
      case 'choke':
        if (!e.them.down || e.them.out || y.down || (stats.unarmed?.level ?? 1) < CHOKE_LEVEL) return impacts;
        choke();
        break;
      case 'kick':
        strike('you', 'kick');
        break;
      default:
        if (tech) {
          if (e.them.down && tech.effect === 'sweep') return impacts;
          strike('you', tech.kind, undefined, tech);
        } else if (id.startsWith('wpn:') && inv) {
          // Something from your pockets: a blade, a bottle, pepper spray.
          const it = inv.items[Number(id.slice(4))];
          if (!it || it.kind !== 'weapon') return impacts;
          if (it.spray) spray(Number(id.slice(4)), inv);
          else if (strike('you', 'weapon', undefined, undefined, it) && it.secret && it.secret !== 'cocaine' && it.secret !== 'empty' && Math.random() < 0.5) {
            doseThem(it.secret);
            it.secret = 'empty';
            it.known = true;
            it.name = 'Syringe';
            it.detail = 'Empty. Used.';
          }
        } else return impacts;
        break;
      case 'stomp-head':
        strike('you', 'stomp', 'head');
        break;
      case 'stomp-stomach':
        strike('you', 'stomp', 'stomach');
        break;
      case 'stomp-ribs':
        strike('you', 'stomp', 'body');
        break;
      case 'grapple': {
        spend('you', COST.grapple);
        const b = BUILDS[p.build];
        const odds = clamp(
          0.6 + accuracyBonus(stats) + gripBonus(stats) + (b.solid ? -0.15 : 0.1) - arms(y) * 0.2 - (y.dazed ? 0.2 : 0) + (e.them.dazed ? 0.15 : 0),
          0.05,
          0.95,
        );
        if (Math.random() < odds) {
          const dmg = Math.round(roll(3, 6) * damageMult(stats));
          e.them.down = true;
          say('you', `${novice() ? 'You grab hold of them and drag them down, falling half on top of them.' : 'You get hold of them and throw them down.'} ${wound('them', 'body', dmg, 'fall')} They're on the floor.`);
          you.gain('strength', 3);
          you.gain('agility', 2);
        } else say('you', b.solid ? "You grab them, but they're too strong. They shake you off." : 'They twist out of your grip.');
        break;
      }
      case 'run':
        spend('you', COST.run);
        if (Math.random() < fleeChance(y, e.them, accuracyBonus(stats))) {
          say('you', legs(y) ? 'You limp away as fast as you can, and somehow lose them.' : 'You break away and run. You lose them in the dark.');
          you.gain('agility', 2);
          end('you-fled');
          return impacts;
        }
        say('you', legs(y) ? "You try to run, but your leg won't take it. They're on you." : "You try to run, but they're on you.");
        break;
      case 'getup':
        spend('you', COST.getUp);
        if (Math.random() < getUpChance(y)) {
          y.down = false;
          say('you', 'You get back on your feet.');
        } else say('you', legs(y) ? 'You try to stand, but your leg gives way.' : 'You try to get up, and fall back down.');
        break;
      case 'walk':
        if (!e.them.out) break;
        say('you', y.down ? 'You drag yourself up and stagger away, leaving them where they lie.' : 'You leave them lying there and walk off into the dark.');
        end('walked');
        return impacts;
      case 'breathe':
        // (Broken ribs: you can't fill your lungs, whatever you do.)
        y.stamina = Math.min(staminaCap(y), y.stamina + 22);
        say('you', y.down ? 'You stay down and catch your breath.' : 'You back off a step and catch your breath.');
        break;
    }
    if (checkEnd()) return impacts;
    theirTurn();
    endOfRound();
  }
  return impacts;
}

/** Spends stamina. Exhausting yourself trains your Stamina. */
function spend(side: Side, n: number) {
  const f = enc[side];
  const c = cost(f, n);
  const was = f.stamina;
  f.stamina = Math.max(0, f.stamina - c);
  if (side === 'you') {
    if (f.stamina < f.maxStamina * 0.3) you.gain('stamina', Math.ceil(c * 0.6));
    if (f.stamina === 0 && was > 0) {
      say('info', "You're exhausted.");
      you.gain('stamina', 6);
    }
  }
}

/**
 * One blow: does it land, where, and what it does. `kind` is the attacker's
 * move (a weapon blow uses the weapon they've drawn).
 */
function strike(a: Side, kind: 'punch' | 'kick' | 'weapon' | 'stomp', aim?: Loc, tech?: Technique, mine?: { name: string; weapon?: number; cuts?: boolean }): boolean {
  const d: Side = a === 'you' ? 'them' : 'you';
  const A = enc[a];
  const D = enc[d];
  const N = names(a);
  const b = BUILDS[enc.person.build];
  // Theirs (the one they pulled), or yours (from your pockets).
  const weapon = kind !== 'weapon' ? undefined : a === 'you' ? mine : enc.person.carrying.find((i) => i.name === enc.them.weaponOut);
  const tired = A.stamina < A.maxStamina * 0.25;
  const downBefore = D.down;
  // How practiced you are at this one (it reads that way).
  const wkind = weapon ? (/bottle/i.test(weapon.name) ? 'bottle' : /syringe/i.test(weapon.name) ? 'needle' : weapon.cuts ? 'blade' : 'blunt') : null;
  const t: Tier = a !== 'you' ? 1 : tech ? practise(tech.id) : wkind ? practise(`wpn:${wkind}`, 'weapons') : practise(kind);
  spend(a, tech ? tech.cost : kind === 'kick' || kind === 'stomp' ? COST.kick : kind === 'weapon' ? COST.weapon : COST.punch);

  // Will it land?
  let hit = (kind === 'punch' ? 0.8 : kind === 'kick' ? 0.66 : kind === 'stomp' ? 0.72 : 0.75) + (tech?.hit ?? 0) + (a === 'you' && weapon ? weaponAccuracy(you.stats) : 0);
  hit += a === 'you' ? accuracyBonus(you.stats) - stressPenalty(A) : 0;
  hit -= d === 'you' ? dodgeBonus(you.stats) - stressPenalty(D) : b.guard;
  if (kind === 'kick' || kind === 'stomp') hit -= legs(A) * 0.2;
  else hit -= arms(A) * 0.2; // punches and weapons need your arms
  if (A.dazed) hit -= 0.2;
  if (A.concussed) hit -= 0.1;
  if (A.blinded > 0) hit -= 0.35;
  // Shaking with fear, they swing wild.
  if (a === 'them') hit -= (A.fear ?? 0) / 400;
  // On heroin or fentanyl: slow to hit, slow to get out of the way.
  if (A.high === 'heroin' || A.high === 'fentanyl') hit -= 0.12;
  if (D.high === 'heroin' || D.high === 'fentanyl') hit += 0.1;
  if (A.high === 'meth') hit -= 0.04;
  if (A.high === 'tranq') hit -= 0.08;
  // Caffeine: sharper, until it's too much and your hands shake.
  if (A.caffeine) hit += caffeineEdge(A.caffeine);
  if (D.caffeine) hit -= caffeineEdge(D.caffeine);
  // Drunk: wild swings, slow feet.
  if (A.drunk) hit -= A.drunk / 400;
  if (D.drunk) hit += D.drunk / 500;
  if (D.high === 'tranq') hit += 0.06;
  if (tired) hit -= 0.15;
  if (A.down) hit -= kind === 'kick' ? 0.1 : 0.2;
  if (D.down) hit += 0.2;
  if (D.out) hit = 2; // can't defend themselves
  if (D.dazed) hit += 0.15;
  if (D.offBalance) hit += 0.15;
  D.offBalance = false;
  if (A.offBalance) hit -= 0.15;
  A.offBalance = false;

  // Someone out cold (or dead) can't roll away, duck or block: it lands.
  const helpless = D.out || D.dead;
  if (!helpless && Math.random() >= clamp(hit, 0.05, 0.95)) {
    if (a === 'you' && t !== 1 && kind !== 'kick') {
      say(a, vary(missText(t, tech ? 'tech' : kind)));
    } else if (tech) {
      say(a, oneOf(['They see it coming and twist away.', 'They jerk back, and it misses.', 'You miss.']));
    } else if (kind === 'stomp') {
      say(a, `${N.S} stomp down, but ${N.oSub} roll away from it.`);
    } else if (kind === 'kick') {
      say(a, a === 'you' && t !== 1 ? `${vary(missText(t, 'kick'))} ${t === 0 ? 'You lose your balance.' : "You're left a step off balance."}` : `${N.S} miss the kick and lose ${N.p} balance.`);
      A.offBalance = true;
      if (!A.down && Math.random() < 0.15) {
        A.down = true;
        say(a, `${N.S} slip and fall. ${N.re} on the floor.`);
      }
    } else if (d === 'you') {
      say(a, oneOf(['They swing and miss.', 'You duck their swing.', 'They lunge. You step aside.']));
    } else {
      say(a, oneOf(['Your punch glances off.', 'They slip the punch.', 'You miss.']));
    }
    if (d === 'you') you.gain('agility', 3);
    // The hard cases let you know you missed.
    if (a === 'you' && !enc.them.yielded) maybeSay('youMiss', 0.3);
    return false;
  }

  // Where it lands.
  const stomp = kind === 'stomp';
  const loc: Loc = aim ?? tech?.aim ?? pick<Loc>(
    stomp
      ? [
          ['head', 4],
          ['stomach', 3],
          ['body', 3],
        ]
      : kind === 'punch'
      ? [
          ['head', D.down ? 3 : 5],
          ['body', 4],
          ['arm', 1],
        ]
      : kind === 'kick'
        ? stomp
          ? [
              ['head', 4],
              ['body', 4],
              ['arm', 1],
              ['leg', 1],
            ]
          : [
              ['head', A.down ? 0 : 1],
              ['body', 3.5],
              ['arm', 1],
              ['leg', 4.5],
            ]
        : [
            ['head', 2],
            ['body', 4],
            ['arm', 3],
            ['leg', 1],
          ],
  );

  // How hard.
  let dmg =
    a === 'you'
      ? weapon
        ? (roll(6, 11) + (weapon.weapon ?? 0)) * (1 + weaponDamage(you.stats) + strengthDamage(you.stats))
        : (stomp ? (loc === 'head' ? roll(11, 17) : loc === 'stomach' ? roll(9, 14) : roll(10, 15)) : kind === 'kick' ? roll(9, 15) : roll(6, 11)) * damageMult(you.stats)
      : b.power + roll(-3, 3) + (kind === 'kick' ? 3 : stomp ? 4 : 0) + (weapon?.weapon ?? 0);
  if (tech) dmg *= tech.dmg;
  if (A.high === 'meth') dmg *= 1.12;
  if (A.drunk) dmg *= 1 + A.drunk / 1000;
  if (tired) dmg *= 0.75;
  if (A.stamina <= 0) dmg *= 0.7;
  if (A.down) dmg *= 0.6;
  dmg = Math.max(1, Math.round(dmg));

  // Where it lands, said a few different ways.
  const where = vary(
    {
      head: ['in the face', 'in the mouth', 'on the jaw', 'on the side of the head', 'on the cheekbone'],
      body: ['in the ribs', 'in the side', 'in the chest'],
      stomach: ['in the stomach', 'in the gut', 'just under the ribs'],
      arm: ['on the arm', 'on the forearm', 'on the shoulder'],
      leg: ['in the leg', 'in the thigh', 'on the knee'],
    }[loc],
  );
  const into = { head: `into ${N.oP} face`, body: `into ${N.oP} ribs`, stomach: `into ${N.oP} gut`, arm: `into ${N.oP} arm`, leg: `into ${N.oP} leg` }[loc];
  let text: string;
  if (a === 'you' && tech) {
    text = t === 1 || !TECH_TEXT[tech.id] ? tech.text : vary(TECH_TEXT[tech.id][t === 0 ? 0 : 1]);
  } else if (a === 'you' && wkind) {
    text = vary(weaponText(t, wkind, lc(weapon!.name), where, into));
  } else if (a === 'you' && stomp) {
    text = vary(stompText(t, loc === 'head' ? 'head' : loc === 'stomach' ? 'stomach' : 'body'));
  } else if (a === 'you' && kind === 'kick') {
    text = vary(kickText(t, where, into));
  } else if (a === 'you' && loc !== 'arm') {
    text = vary(punchText(t, where, into));
  } else if (tech) {
    text = tech.text;
  } else if (kind === 'weapon' && weapon) {
    const w = lc(weapon.name);
    text = /bottle/i.test(weapon.name)
      ? vary([`${N.S} swing the bottle at ${N.o} and it thumps ${N.o} ${where}.`, `${N.S} club ${N.o} with the bottle, ${where}.`, `${N.S} swing the bottle hard; it catches ${N.o} ${where}.`])
      : weapon.cuts
      ? /syringe/i.test(weapon.name)
          ? vary([`${N.S} jab the syringe at ${N.o} and stick ${N.o} ${where}.`, `${N.S} stab the needle ${into}.`])
          : vary([`${N.S} slash at ${N.o} with the ${w} and catch ${N.o} ${where}.`, `The ${w} flashes, and catches ${N.o} ${where}.`, `${N.S} cut at ${N.o} with the ${w}, ${where}.`, `${N.S} lunge with the ${w} and open ${N.o} up ${where}.`])
      : vary([`${N.S} hit ${N.o} with the ${w} ${where}.`, `${N.S} swing the ${w} ${into}.`]);
  } else if (stomp) {
    text =
      loc === 'head'
        ? vary([`${N.S} stomp on ${N.oP} head.`, `${N.S} bring ${N.p} heel down on ${N.oP} head.`, `${N.S} stamp down on ${N.oP} face.`])
        : loc === 'stomach'
          ? vary([`${N.S} stomp down on ${N.oP} stomach.`, `${N.S} drive ${N.p} heel into ${N.oP} gut.`])
          : vary([`${N.S} stomp down on ${N.oP} ribs.`, `${N.S} drop ${N.p} heel into ${N.oP} side.`, `${N.S} stamp on ${N.oP} chest.`]);
  } else if (kind === 'kick') {
    text = vary([`${N.S} kick ${N.o} ${where}.`, `${N.S} drive a boot ${into}.`, `${N.S} plant a kick ${where}.`, `${N.S} catch ${N.o} with a kick ${where}.`]);
  } else {
    text =
      loc === 'arm'
        ? vary([`${N.S} hit ${N.o} on the arm as ${N.oSub} cover up.`, `${N.S} catch ${N.o} on the forearm as ${N.oSub} block.`, `${N.oSubCap} get an arm up; ${N.S.toLowerCase()} hit it anyway.`])
        : vary([`${N.S} punch ${N.o} ${where}.`, `${N.S} catch ${N.o} ${where} with a right.`, `${N.S} land a fist ${where}.`, `${N.S} hit ${N.o} ${where}.`, `${N.S} drive a punch ${into}.`, `A left from ${a === 'you' ? 'you' : 'them'} lands ${where}.`]);
  }
  // (A needle punctures; it doesn't slice.)
  say(a, `${text} ${wound(d, loc, dmg, weapon && /syringe/i.test(weapon.name) ? 'jab' : weapon?.cuts && !/bottle/i.test(weapon.name) ? 'cut' : stomp ? 'stomp' : kind === 'kick' ? 'kick' : 'punch')}`);
  if (a === 'you') {
    // Landing blows: it's fighting that teaches you to fight (and builds a little muscle).
    if (weapon) you.gain('weapons', 4);
    else you.gain('unarmed', tech ? 4 : 3);
    you.gain('strength', 1);
    you.gain('agility', 2);
    if (tech) techEffect(tech);
  }
  // How they take it: the scared plead, the hard cases taunt.
  if (a === 'you' && !D.out && !D.dead && !D.yielded) maybeSay('hitByYou', isBrute(enc.person.personality) ? 0.2 : (D.fear ?? 0) >= 40 ? 0.3 : 0.12);
  if (a === 'them') {
    if (D.down && !downBefore) maybeSay('youDown', 0.6);
    else maybeSay('hitYou', 0.28);
  }
  // Stuck with a loaded needle: whatever's in it goes into you.
  if (a === 'them' && weapon && /syringe/i.test(weapon.name)) {
    const w = weapon as Item;
    if (w.drug && w.drug !== 'empty' && Math.random() < 0.35) {
      dose(w.drug);
      w.drug = 'empty';
    }
  }
  return true;
}

/** Your loaded syringe, pushed into them. */
function doseThem(drug: Exclude<import('./person').Drug, 'empty'>) {
  say('you', 'The needle goes in, and you press the plunger. Nothing happens, yet: in a muscle it takes a minute or two.');
  enc.them.dosing = { drug, in: 3 };
}
/** What you put in them, hitting. */
function doseThemNow(drug: Exclude<import('./person').Drug, 'empty'>) {
  const T = enc.them;
  if (drug === 'meth') {
    T.stamina = Math.min(T.maxStamina, T.stamina + 30);
    scare(-15);
    say('them', 'Their eyes go wide and wild. They come at you harder.');
    return;
  }
  if (Math.random() < (drug === 'heroin' ? 0.25 : drug === 'fentanyl' ? 0.55 : 0.6)) {
    T.out = true;
    T.down = true;
    T.awake = -70; // drugged under: they won't come round soon
    say('them', drug === 'tranq' ? 'Their legs fold and they slump to the pavement, out.' : "Their eyes roll up. They sag to the pavement, breathing slow and shallow. They're out.");
  } else {
    T.dazed = 3;
    T.stamina = Math.max(0, T.stamina - 30);
    say('them', 'They sway, heavy-lidded, slow. They can barely lift their hands.');
  }
}

/** Something from a syringe, in the middle of a fight. */
function dose(drug: Exclude<import('./person').Drug, 'empty'>) {
  landed = null;
  say('them', 'The needle goes in deep, and they press the plunger. You feel the cold of it going in.');
  enc.you.dosing = { drug, in: 3 };
}
/** What they put in you, hitting. */
function doseNow(drug: Exclude<import('./person').Drug, 'empty'>) {
  const y = enc.you;
  if (drug === 'heroin') {
    y.dazed = 2;
    y.stamina = Math.max(0, y.stamina - 25);
    y.stress = Math.max(0, (y.stress ?? 0) - 15);
    y.high = 'heroin';
    say('info', 'Warmth floods up your arm and through you. Your arms go heavy. Nothing hurts any more, and nothing matters.');
  } else if (drug === 'fentanyl') {
    y.dazed = 3;
    y.stamina = Math.max(0, y.stamina - 40);
    y.high = 'fentanyl';
    if (Math.random() < 0.2) {
      y.out = true;
      say('info', 'Your breathing slows. Slower. The street tips sideways and goes dark.');
    } else say('info', 'It hits like a wall. Your eyelids drag down and every breath is an effort.');
  } else if (drug === 'meth') {
    y.stamina = Math.min(y.maxStamina, y.stamina + 30);
    addStress(y, 15);
    y.high = 'meth';
    say('info', 'Your heart slams. Your jaw locks. Everything is fast and loud and you want to hurt them.');
  } else {
    if (Math.random() < 0.45) {
      y.out = true;
      say('info', "Your legs go first. You're on the pavement before you know it, and then you're nowhere.");
    } else {
      y.dazed = 3;
      y.stamina = Math.max(0, y.stamina - 30);
      y.high = 'tranq';
      say('info', "A heavy, sick drowsiness drags at you. You fight it, barely.");
    }
  }
}

/**
 * Damage to a part of someone's body: blood lost, plus whatever else it does
 * (dazed, concussed, bleeding, broken bones, knocked down). Returns the text
 * describing it.
 */
function wound(d: Side, loc: Loc, dmg: number, how: 'punch' | 'kick' | 'cut' | 'fall' | 'stomp' | 'jab'): string {
  const D = enc[d];
  const brokenBefore = [...D.broken];
  const wasDown = D.down;
  const outAtStart = !!D.out;
  landed = d;
  // Hit in the face: the cigarette goes flying.
  if (d === 'you' && loc === 'head' && enc.you.smoking) {
    enc.you.smoking = false;
    landed = null;
    say('info', 'The blow knocks the cigarette out of your mouth in a burst of sparks.');
    landed = d; // (the highlight stays with the blow)
  }
  // Being hurt is frightening; hurting someone shakes you too.
  if (d === 'you') addStress(enc.you, 3 + dmg * 0.35);
  else addStress(enc.you, 1 + dmg * 0.08);
  // Every blow you land scares them more; every one they land makes them braver.
  scare(d === 'them' ? dmg * 0.9 : -2);
  const N = names(d === 'you' ? 'them' : 'you'); // the attacker's view: N.o is the one hurt
  // How hard it was (in the blood it would cost if it were all blood).
  const ml = Math.round((dmg * (D.maxBlood * (1 - PASS_OUT))) / D.toughness);
  // A blade or a needle costs blood; a blunt blow doesn't, it rattles you
  // (the head most of all) and puts you closer to going out.
  const sharp = how === 'cut' || how === 'jab';
  if (sharp) D.blood = Math.max(0, D.blood - ml);
  D.awake = Math.max(-120, (D.awake ?? 100) - Math.round((dmg * AWAKE_HIT[loc] * (sharp ? 0.3 : how === 'fall' ? 0.6 : 1) * (d === 'you' ? 0.75 : 1) * 100) / D.toughness));
  const out: string[] = [sharp ? `(−${ml}\u00a0ml)` : ''];
  const re = N.oRe;
  let severe = ml >= 450;
  const bledBefore = D.bleeding;
  let spill: Spill = 'none';
  const spills = (s: Spill) => {
    if (SPILL_RANK.indexOf(s) > SPILL_RANK.indexOf(spill)) spill = s;
  };
  /** Blood already lost makes passing out more likely. */
  const lost = 1 - D.blood / D.maxBlood;
  const knockOut = (chance: number) => {
    // At the end of it, or a lucky one before that.
    if (!D.out && (D.awake <= 0 || Math.random() < chance * 0.5)) {
      D.out = true;
      D.down = true;
      D.awake = Math.min(D.awake, -20);
      severe = true;
      out.push(`${re} out cold.`);
    }
  };
  const breaks = (part: Part, chance: number) => {
    if (D.broken.includes(part) || Math.random() >= chance) return false;
    severe = true;
    D.broken.push(part);
    if (d === 'them') scare(12);
    const open = part !== 'nose' && part !== 'ribs' && Math.random() < 0.3;
    if (part === 'nose') spills('splash');
    if (open) spills('drip');
    // Bone through the skin bleeds.
    if (open) openBreak = true;
    out.push(
      part === 'nose'
        ? `${N.oP[0].toUpperCase() + N.oP.slice(1)} nose flattens with a crunch: it's broken, and blood pours from it.`
        : part === 'ribs'
          ? `A crack like a snapped branch: ${N.oP} ribs are broken.`
          : `A crack: ${N.oP} ${part} is broken.${open ? ' Bone shows through the skin.' : ''}`,
    );
    return true;
  };
  let openBreak = false;
  const bleed = (n: number) => {
    const before = D.bleeding;
    D.bleeding = Math.min(4, D.bleeding + n);
    if (D.bleeding > before) out.push(`${re} bleeding${before ? ' worse' : ''} (${BLEEDING[D.bleeding].toLowerCase()}).`);
  };
  const fall = (chance: number) => {
    if (!D.down && Math.random() < chance) {
      D.down = true;
      out.push(`${N.oSubCap} go down. ${re} on the floor.`);
    }
  };

  if (loc === 'head') {
    if (!D.out && Math.random() < Math.min(0.8, dmg * 0.035 * (D.concussed ? 1.5 : 1))) {
      D.dazed = 2;
      out.push(`${re} dazed.`);
    }
    if (!D.concussed && dmg >= 12 && Math.random() < 0.3) {
      D.concussed = true;
      out.push(`${re} concussed.`);
    }
    if (how === 'punch' || how === 'kick' || how === 'stomp') {
      if (breaks('nose', dmg >= 10 ? 0.2 : 0)) bleed(1);
      else if (dmg >= 8 && Math.random() < (how === 'stomp' ? 0.45 : 0.25)) bleed(1);
    }
    // Head blows can knock someone out; far more likely when they're on the
    // floor, already concussed or dazed, or have lost a lot of blood.
    knockOut(
      D.down
        ? dmg * 0.017 + (D.concussed ? 0.12 : 0) + (D.dazed ? 0.08 : 0) + lost * 0.45
        : Math.max(0, dmg * 0.006 + (D.concussed ? 0.05 : 0) + lost * 0.2 - 0.03),
    );
    fall(dmg >= 14 ? 0.3 : 0);
  } else if (loc === 'stomach') {
    D.stamina = Math.max(0, D.stamina - 30);
    if (D.out) out.push('Their body jerks. They make a low sound.');
    else {
      D.winded = true;
      out.push(d === 'you' ? "The wind's knocked out of you." : 'It knocks the wind out of them. They curl up, gasping.');
    }
    knockOut(D.down ? 0.02 + lost * 0.2 : 0);
  } else if (loc === 'body') {
    if (D.broken.includes('ribs') && (how === 'stomp' || dmg >= 10)) {
      D.stamina = Math.max(0, D.stamina - 15);
      out.push(`Something gives in ${N.oP} chest.`);
      // A broken rib driven into the lung.
      if (!D.lung && Math.random() < (how === 'stomp' ? 0.45 : 0.2)) {
        D.lung = true;
        severe = true;
        D.stamina = Math.min(D.stamina, staminaCap(D));
        out.push(`The broken rib punctures ${N.oP} lung. ${d === 'you' ? 'You' : 'They'} gasp, and blood bubbles at ${N.oP} lips.`);
        spills('cough');
        bleed(1);
      }
      knockOut(0.06 + lost * 0.35);
    } else if (breaks('ribs', (dmg - (how === 'stomp' ? 6 : 9)) * (how === 'stomp' ? 0.06 : 0.04))) {
      D.stamina = Math.min(D.stamina, staminaCap(D));
      out.push(`${d === 'you' ? 'Your' : 'Their'} breath goes short and ragged.`);
    }
  } else if (loc === 'arm') {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    breaks(`${side} arm` as Part, (dmg - 9) * 0.05);
  } else {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    if (breaks(`${side} leg` as Part, (dmg - 9) * 0.045)) fall(1);
    else fall(dmg >= 10 ? 0.25 : 0.08);
  }
  if (openBreak) bleed(1);
  if (how === 'cut') bleed(Math.random() < 0.4 ? 2 : 1);
  // Blood only where it makes sense: blunt blows to the body throw none.
  if (how === 'cut') spills('spray');
  if (loc === 'head' && how !== 'fall') {
    // A split brow or lip opening up throws droplets; so does hitting a face
    // that's already bleeding; a stamp on one bursts.
    if (D.bleeding > bledBefore) spills('spatter');
    else if (bledBefore && dmg >= 6) spills(how === 'stomp' && ml >= 300 ? 'splash' : 'spatter');
    else if (ml >= 420) spills('drip');
  }
  if (D.lung && loc !== 'head' && dmg >= 8 && Math.random() < 0.35) spills('cough');
  if (D.dazed && how !== 'fall') fall(0.15);
  // What it looks like, sounds like.
  const g = how === 'jab' ? '' : gore(d, loc, how, ml, { newBreaks: D.broken.filter((p) => !brokenBefore.includes(p)), bleed, wasDown, outAtStart });
  if (g) out.splice(1, 0, g);
  // Rattled past the point of staying awake, wherever it landed (and then
  // "dazed" isn't worth saying).
  knockOut(0);
  if (!outAtStart && D.out) {
    const i = out.indexOf(`${re} dazed.`);
    if (i >= 0) out.splice(i, 1);
  }
  // The blood on the screen matches what's described.
  if (g && /blood|red\b|pink/.test(g)) {
    if (loc === 'head') spills(/flies|rush|mouthful/.test(g) ? 'splash' : 'spatter');
    else if (loc === 'body' || loc === 'stomach') spills(/pink/.test(g) ? 'cough' : 'none');
    else spills('drip');
  }
  impacts.push({ target: d, ml, severe, loc, spill });
  return out.filter(Boolean).join(' ');
}

/**
 * What a blow looks and sounds like, beyond the bare facts. The rule: a line
 * only says what really happened. Bone (a crunch, a crack, grinding, a limb
 * bending wrong) only when something broke; blood only when someone's
 * bleeding; a line that describes an injury makes it so (a split brow
 * bleeds, a hanging jaw is a broken jaw). Light blows get only the impact.
 * Worse the more blood it costs; lines said recently in this fight aren't
 * said again. `newBreaks`: what broke with this blow.
 */
function gore(d: Side, loc: Loc, how: string, ml: number, fx: { newBreaks: Part[]; bleed: (n: number) => void; wasDown: boolean; outAtStart?: boolean }): string {
  const you = d === 'you';
  const P = you ? 'your' : 'their';
  const Pc = you ? 'Your' : 'Their';
  const S = you ? 'You' : 'They';
  const s = you ? 'you' : 'they';
  const tier = ml >= 420 ? 2 : ml >= 220 ? 1 : 0;
  const D = enc[d];
  if (how === 'fall') return tier ? vary([`${S} hit the pavement hard.`, `The fall knocks the breath out of ${you ? 'you' : 'them'}.`]) : '';
  const m = (D.marks ??= {});
  const teeth = m.teeth ?? 0;
  type Line = [string, (() => void)?];
  const scar = (where: string) => () => {
    (m.scars ??= []).push(where);
  };
  const daze = () => {
    if (!D.out && !D.dazed) D.dazed = 1;
  };
  const wind = (n: number) => () => {
    D.stamina = Math.max(0, D.stamina - n);
  };
  const bleeding = D.bleeding > 0;
  const brokeArm = fx.newBreaks.some((p) => p.endsWith('arm'));
  const brokeLeg = fx.newBreaks.some((p) => p.endsWith('leg'));
  const ribsBroken = D.broken.includes('ribs');
  if (how === 'cut') {
    // A blade always opens skin (the bleeding is applied with it).
    const where = { head: 'cheek', body: 'ribs', stomach: 'belly', arm: 'forearm', leg: 'thigh' }[loc];
    const cuts: Line[][] = [
      [
        [`The blade opens a shallow gash across ${P} ${where}. Blood beads along it.`, scar(where)],
        [`A thin red line opens on ${P} ${where}, then starts to run.`, scar(where)],
        [`It nicks ${P} ${where}, and the blood comes slowly.`, scar(where)],
      ],
      [
        [`The cut is deep. Blood sheets down ${P} ${where}.`, scar(where)],
        [`It opens ${P} ${where} like a zip.`, scar(where)],
        [`The edge drags through ${P} ${where}, and the blood comes fast.`, scar(where)],
      ],
      [
        [`It goes deep into ${P} ${where}. The blood comes in a rush.`, scar(where)],
        [`Blood pumps from ${P} ${where} in thick spurts.`, scar(where)],
        [`The wound in ${P} ${where} gapes, and won't stop.`, scar(where)],
      ],
    ];
    return pickLine(cuts[tier]);
  }
  const pools: Record<Loc, Line[][]> = {
    head: [
      [
        [`${Pc} head rocks to the side.`],
        [`It catches ${you ? 'you' : 'them'} on the cheekbone.`],
        [`${Pc} eyes water.`],
        [`${S} blink hard, shaking it off.`],
        ...(m.lip ? ([] as Line[]) : ([[`${Pc} lip splits against ${P} teeth.`, () => (m.lip = true)]] as Line[])),
        ...(m.cheek ? ([] as Line[]) : ([[`${Pc} cheek swells, purple already.`, () => (m.cheek = true)]] as Line[])),
        ...(bleeding ? ([[`${S} taste copper.`]] as Line[]) : []),
      ],
      [
        [`${Pc} head snaps back.`],
        [`${S} stagger, and ${P} eyes lose focus for a second.`, daze],
        ...(bleeding ? ([[`${Pc} head snaps back, and blood flies from ${P} mouth.`]] as Line[]) : []),
        ...(m.lip && !bleeding ? ([[`The split in ${P} lip tears open again.`, () => fx.bleed(1)]] as Line[]) : []),
        ...(m.brow ? ([] as Line[]) : ([[`${Pc} eyebrow splits open and blood runs into ${P} eye.`, () => ((m.brow = true), fx.bleed(1))]] as Line[])),
        ...(teeth < 10 ? ([[`A tooth comes loose; ${s} spit it out.`, () => (m.teeth = teeth + 1)]] as Line[]) : []),
        ...(m.eye ? ([] as Line[]) : ([[`${Pc} eye swells shut.`, () => (m.eye = true)]] as Line[])),
      ],
      [
        [`It lands flush, and ${P} eyes go blank for a moment.`, daze],
        ...(m.jaw ? ([] as Line[]) : ([[`There's a crack, and ${P} jaw hangs wrong: it's broken.`, () => ((m.jaw = true), fx.bleed(1))]] as Line[])),
        ...(fx.wasDown ? ([[`${Pc} head bounces off the pavement.`, daze]] as Line[]) : []),
        ...(teeth < 8 ? ([[`Teeth go. ${S} spit them out with a mouthful of blood.`, () => ((m.teeth = Math.min(12, teeth + 2 + Math.floor(Math.random() * 2))), fx.bleed(1))]] as Line[]) : []),
        ...(bleeding ? ([[`Blood runs freely down ${P} face now.`]] as Line[]) : []),
      ],
    ],
    body: [
      [[`${S} fold around it with a grunt.`], [`It knocks ${you ? 'you' : 'them'} back a step.`], [`The air goes out of ${P} chest in a rush.`, wind(6)]],
      [[`It lands with a deep, heavy thud.`], [`${S} stagger, clutching ${P} side.`], [`${S} wheeze, bent over.`, wind(10)]],
      [
        [`${S} fold over it and can't straighten up.`, wind(15)],
        [`${Pc} knees dip; ${s} barely stay standing.`],
        ...(ribsBroken ? ([[`Broken bone grinds in ${P} chest.`]] as Line[]) : []),
        ...(D.lung ? ([[`${S} cough, and it comes up pink.`]] as Line[]) : []),
      ],
    ],
    stomach: [
      [[`${S} double over, retching.`], [`${S} gasp and clutch ${P} stomach.`]],
      [[`${S} retch up bile and spit.`], [`${S} vomit onto the pavement.`], [`${S} sag, arms wrapped round ${P} middle.`]],
      [
        [`${S} vomit, and there's blood in it: something inside is torn.`, () => fx.bleed(1)],
        [`${S} curl up around it, grey in the face, and can't get a breath.`, wind(15)],
      ],
    ],
    arm: [
      [[`${Pc} forearm goes numb.`], [`It hammers into ${P} forearm.`], [`${S} shake out ${P} arm, wincing.`]],
      [[`A bruise is already rising on ${P} arm.`], [`${Pc} arm drops for a moment, dead.`]],
      [
        ...(brokeArm ? ([[`The arm bends where an arm doesn't bend.`]] as Line[]) : ([[`${Pc} arm goes dead and drops to ${P} side for a moment.`]] as Line[])),
        [`The skin over ${P} elbow splits.`, () => fx.bleed(1)],
      ],
    ],
    leg: [
      [[`${Pc} knee buckles.`], [`${S} hop back, favouring the leg.`], [`It stings ${P} thigh.`]],
      [[`${Pc} leg nearly gives out.`], [`${S} limp a step.`]],
      [...(brokeLeg ? ([[`The knee twists sideways with a sickening pop.`]] as Line[]) : ([[`${Pc} leg folds for a moment, and ${s} stumble.`]] as Line[]))],
    ],
  };
  let pool = pools[loc]?.[tier];
  // On the floor (or out cold), nobody staggers, limps or steps back.
  // (Knocked out by this very blow: it still landed on someone awake.)
  if (fx.outAtStart || fx.wasDown) {
    const standing = /stagger|step back|back a step|limp|hop back|knees dip|blink hard|shake out|stumble|gives out|barely stay standing|knee buckles|leg folds|head snaps back|head rocks|double over|sag,|fold over it|fold around it|bent over|knocks .* back/i;
    pool = pool?.filter(([t]) => !standing.test(t));
    const lying: Line[] = fx.outAtStart
      ? [[`${Pc} body jerks with it.`], [`${S} don't react. ${S === 'You' ? "You're" : "They're"} out.`], [`${Pc} limp body rocks with the blow.`]]
      : [...(loc === 'stomach' ? [] : ([[`${S} curl up on the pavement around it.`]] as Line[])), [`${S} writhe on the ground.`], [`${S} try to cover up, and can't.`]];
    pool = [...(pool ?? []), ...lying];
  }
  // A light blow often needs no more said; a break already says plenty.
  if (!pool?.length || (tier === 0 && Math.random() < 0.4) || (fx.newBreaks.length && Math.random() < 0.5)) return '';
  return pickLine(pool);
}

/** A line not said lately in this fight (from `xs`), and remembered. */
function vary(xs: string[]): string {
  const recent = (enc.recent ??= []);
  const fresh = xs.filter((x) => !recent.includes(x));
  const x = oneOf(fresh.length ? fresh : xs);
  recent.push(x);
  if (recent.length > 14) recent.shift();
  return x;
}

/** Picks a line not said lately, and makes what it says true. */
function pickLine(pool: [string, (() => void)?][]): string {
  const recent = (enc.recent ??= []);
  const fresh = pool.filter(([t]) => !recent.includes(t));
  const [text, does] = oneOf(fresh.length ? fresh : pool);
  does?.();
  recent.push(text);
  if (recent.length > 14) recent.shift();
  return text;
}

/** Their move in a fight. */
function theirTurn() {
  const e = enc;
  const p = e.person;
  const b = BUILDS[p.build];
  const T = e.them;
  if (T.out) return; // unconscious
  if (T.yielded) return yieldTurn();
  // Scared enough, they give up: hands up, or curled up on the floor.
  const fear = T.fear ?? 0;
  const P = personalityOf(p);
  const breaking = fear + P.yield * 100;
  if (breaking >= 75 && Math.random() < 0.25 + (breaking - 75) / 60) {
    T.yielded = true;
    say('them', speak(T.down ? 'giveUpDown' : 'giveUp'));
    you.gain('intimidation', 5);
    return;
  }
  if (T.winded) {
    T.winded = false;
    say('them', 'They lie there, fighting for breath.');
    return;
  }
  if (T.dazed > 0 && Math.random() < 0.5) {
    say('them', oneOf(["They're still reeling.", 'They shake their head, trying to clear it.']));
    return;
  }
  if (T.down) {
    spend('them', COST.getUp);
    if (Math.random() < getUpChance(T)) {
      T.down = false;
      say('them', legs(T) ? 'They drag themselves up on one good leg.' : 'They get back on their feet.');
    } else say('them', legs(T) ? 'They try to stand, but their leg gives way.' : 'They try to get up, and fall back down.');
    return;
  }
  // Losing badly: some try to run for it (much harder on a broken leg).
  const tough = ['Easy', 'Fair', 'Hard', 'Brutal'].indexOf(b.difficulty);
  const wants = (p.kind === 'civilian' || p.kind === 'junkie' ? 0.2 : 0.12) * (1 - tough * 0.25) * (1 + fear / 60) * P.flee;
  if (T.blood < T.maxBlood * 0.72 && Math.random() < wants) {
    spend('them', COST.run);
    if (Math.random() < fleeChance(T, e.you)) {
      say('them', legs(T) ? "They limp off into the dark. They're gone." : "They scramble away and run. They're gone.");
      end('they-fled');
    } else say('them', legs(T) ? "They try to run, but their leg won't carry them." : 'They try to run. You cut them off.');
    return;
  }
  // Pepper spray, once.
  const spray = p.carrying.find((i) => i.spray);
  if (spray && !T.sprayed && !e.emptied && Math.random() < 0.6) {
    T.sprayed = true;
    (spray as { doses?: number }).doses = Math.max(0, ((spray as { doses?: number }).doses ?? 3) - 1);
    e.you.blinded = 99;
    say('them', 'They pepper spray you in the face. Your eyes clamp shut and burn like they\'re on fire. You can barely see.');
    return;
  }
  // Pulling a weapon.
  // (Not what they dropped at your feet.)
  const weapon: Item | undefined = e.emptied ? undefined : p.carrying.find((i) => i.weapon);
  if (weapon && !T.weaponOut && arms(T) < 2 && Math.random() < 0.5) {
    T.weaponOut = weapon.name;
    say('them', `They pull out a ${weapon.name.toLowerCase()}.`);
    return;
  }
  // Out of breath.
  if (T.stamina < COST.punch) {
    T.stamina = Math.min(T.maxStamina, T.stamina + 22);
    say('them', 'They stop, gasping for breath.');
    return;
  }
  if (T.weaponOut && Math.random() < 0.7) strike('them', 'weapon');
  else if (e.you.down && T.stamina >= cost(T, COST.kick) && Math.random() < 0.75) strike('them', 'stomp');
  else if (!e.you.down && T.stamina >= cost(T, COST.kick) && Math.random() < 0.3) strike('them', 'kick');
  else strike('them', 'punch');
}

/** End of a round: bleeding, getting your breath back, the daze wearing off. */
function endOfRound() {
  if (enc.stage !== 'combat') return;
  // Awake through a round of it: they've seen you.
  if (!enc.them.out) enc.facedYou = true;
  enc.fought = true;
  // Every round of a fight: adrenaline, fear. And you get a little more used to it.
  addStress(enc.you, 1);
  enc.you.nerve = Math.min(100, (enc.you.nerve ?? 0) + 0.35);
  // Knocked out by a blow, people come round on their own, usually in under a
  // minute (not if they've lost too much blood).
  const T0 = enc.them;
  for (const f of [enc.you, T0]) if (!f.dead) f.awake = f.out ? Math.min(-1, f.awake + 2) : Math.min(100, f.awake + 3);
  if (T0.out && !T0.dead && canWake(enc) && Math.random() < (T0.awake > -15 ? 0.35 : T0.awake > -50 ? 0.12 : 0)) {
    T0.out = false;
    T0.outNoted = false;
    T0.down = true;
    T0.dazed = 3;
    T0.awake = 25;
    say('them', 'They groan, and their eyes open. They come round on the pavement, dazed, trying to work out where they are.');
  }
  // A needle's dose, a few rounds after it went in.
  for (const side of ['you', 'them'] as Side[]) {
    const f = enc[side];
    if (f.dosing && !f.dead && --f.dosing.in <= 0) {
      const d = f.dosing.drug;
      delete f.dosing;
      if (side === 'you') doseNow(d);
      else doseThemNow(d);
    }
  }
  const regen = { you: staminaRegen(you.stats), them: 7 };
  for (const side of ['you', 'them'] as Side[]) {
    const f = enc[side];
    if (f.bleeding) f.blood = Math.max(0, f.blood - Math.round((BLEED_ML[f.bleeding] * f.maxBlood) / 5000));
    const cap = staminaCap(f);
    f.stamina = Math.round(Math.min(Math.max(cap, 0), f.stamina + regen[side] * (f.lung ? 0.1 : f.broken.includes('ribs') ? 0.2 : 1)));
    // Broken ribs: shallow, stabbing breaths, and sometimes a coughing fit.
    if (!f.out && f.broken.includes('ribs') && Math.random() < (f.lung ? 0.45 : 0.2)) {
      f.stamina = Math.max(0, f.stamina - (f.lung ? 14 : 7));
      if (f.lung) impacts.push({ target: side, ml: 0, severe: false, loc: 'body', spill: 'cough' });
      say(side, f.lung ? oneOf(side === 'you' ? ['You cough, and it comes up pink and frothy. You can\'t get any air.', 'Every breath bubbles in your chest.'] : ['They cough up pink froth, wheezing.', 'Their breathing bubbles wetly in their chest.']) : side === 'you' ? oneOf(['Every breath is a knife in your side.', 'You try to breathe deep and your ribs scream.']) : oneOf(['They clutch their side, breathing in short, painful gasps.', 'They wince with every breath.']));
    }
    if (f.dazed > 0) f.dazed--;
    if (side === 'you') f.winded = false;
  }
  // Pepper spray wears off after a couple of their turns.
  if (enc.them.blinded > 0) enc.them.blinded--;
  checkEnd();
}

/** Has someone passed out? */
function checkEnd(): boolean {
  if (enc.stage !== 'combat') return true;
  const out = (f: Body) => f.out || f.blood <= f.maxBlood * PASS_OUT;
  // You passing out ends it (you can't do anything). Them passing out
  // doesn't: they're helpless, and it's up to you what happens next.
  if (out(enc.you)) {
    enc.you.down = true;
    say('info', enc.you.out ? 'Everything goes black.' : enc.you.bleeding >= 3 ? 'Too much blood. Your legs give out, and everything goes dark.' : 'You hit the pavement. Everything goes dark.');
    end('lost');
    return true;
  }
  const T = enc.them;
  // Someone only bleeds out once they're already unconscious: a single blow
  // knocks them out, it doesn't kill them on the spot.
  // (Out before this move: knocked out by this very blow doesn't count.)
  const wasOut = outBefore;
  if (!T.out && T.blood <= T.maxBlood * PASS_OUT) {
    T.out = true;
    T.down = true;
    T.awake = Math.min(T.awake, -40);
    say('you', T.bleeding >= 3 ? "They've lost too much blood. They slump to the floor, unconscious." : "They go down and don't get up. They're unconscious.");
  }
  // However they went out, they're under now.
  for (const f of [enc.you, T]) if (f.out && f.awake > 0) f.awake = -25;
  // Out cold, they haven't given up any more: they're just a body to go through.
  if (T.out || T.dead) T.yielded = false;
  if (T.out && !T.outNoted) {
    T.outNoted = true;
    say('info', "They're unconscious. They can't fight back.");
  }
  // Unconscious and still losing blood: they can bleed out.
  if (wasOut && (T.blood <= T.maxBlood * DEATH || T.awake <= -100)) {
    T.dead = true;
    const bled = T.bleeding > 0 && T.blood <= T.maxBlood * DEATH;
    T.bleeding = 0;
    // Bleeding, they bleed out; beaten with nothing open, the beating kills them.
    say('you', bled ? oneOf(["Their chest stops moving. The blood around them stops spreading. They're dead.", "One last rattling breath, then nothing. They've bled out."]) : oneOf(["Their breathing turns to snoring, then stops. They're dead.", "One last rattling breath, then nothing. They're dead."]));
    end('killed');
    return true;
  }
  if (T.out && !T.dyingNoted && T.bleeding > 0 && T.blood <= T.maxBlood * (DEATH + 0.07)) {
    T.dyingNoted = true;
    say('info', "Their breathing is shallow and fast, their skin grey. They're bleeding out.");
  }
  return false;
}

/** They noticed you following them: they run, or come at you. */
function spotted() {
  const p = enc.person;
  const b = BUILDS[p.build];
  const tough = ['Easy', 'Fair', 'Hard', 'Brutal'].indexOf(b.difficulty);
  const fight = tough * 0.2 + (p.kind === 'drunk' ? 0.3 : 0) + (p.awareness === 'Paranoid' ? 0.15 : 0) + personalityOf(p).fight;
  if (Math.random() < fight) {
    say('them', oneOf(['They spin around. "The hell do you want?" They come at you.', "They spot you, and they don't run. They come straight for you."]));
    enc.stage = 'combat';
    enc.facedYou = true;
    say('info', 'The fight is on.');
    theirTurn();
    endOfRound();
  } else if (legs(enc.them) > 0) {
    // On crutches, they can't outrun anyone.
    enc.facedYou = true;
    say('them', 'They see you and try to hobble away on their crutches. They get nowhere. They turn, cornered, and swing a crutch at you.');
    enc.stage = 'combat';
    say('info', 'The fight is on.');
    theirTurn();
    endOfRound();
  } else {
    enc.facedYou = true;
    say('them', oneOf(['They spot you and bolt. Gone.', 'They see you. They run, and you lose them.']));
    end('lost-them');
  }
}

// ---------- Techniques (Unarmed) ----------

/** Something you've learned to do with your hands, feet, knees and head. */
interface Technique {
  id: string;
  name: string;
  hint: string;
  /** Unarmed level it comes at. */
  level: number;
  kind: 'punch' | 'kick' | 'stomp';
  aim: Loc;
  /** Added to the chance it lands; damage multiplier; stamina. */
  hit: number;
  dmg: number;
  cost: number;
  /** What else it does, when it lands. */
  effect?: 'cut' | 'sweep' | 'ko' | 'headbutt' | 'pound' | 'break-arm';
  text: string;
}

/** In a fight, standing: learned one by one as Unarmed goes up. */
export const TECHNIQUES: Technique[] = [
  // Street fighting, from the crude to the skilled, spread across Unarmed 1–100
  // (room to add more, and for upgraded versions to replace these later).
  { id: 'tech:body', name: 'Gut punch', hint: 'Winds them', level: 5, kind: 'punch', aim: 'stomach', hit: -0.04, dmg: 0.9, cost: 9, text: 'You bury a fist in their gut.' },
  { id: 'tech:knee', name: 'Knee them', hint: 'Grab them and knee', level: 10, kind: 'kick', aim: 'body', hit: -0.04, dmg: 1.2, cost: 13, text: 'You grab a fistful of their jacket and drive your knee into their ribs.' },
  { id: 'tech:hook', name: 'Haymaker', hint: 'Big swing: hard to land', level: 15, kind: 'punch', aim: 'head', hit: -0.15, dmg: 1.4, cost: 12, text: 'You wind up and throw everything you have at their head.' },
  { id: 'tech:headbutt', name: 'Headbutt', hint: 'Hurts you too', level: 25, kind: 'punch', aim: 'head', hit: 0, dmg: 1.45, cost: 10, effect: 'headbutt', text: 'You grab them by the collar and smash your forehead into their face.' },
  { id: 'tech:elbow', name: 'Elbow', hint: 'Up close: splits skin', level: 32, kind: 'punch', aim: 'head', hit: -0.05, dmg: 1.15, cost: 10, effect: 'cut', text: 'You step in close and swing an elbow across their face.' },
  { id: 'tech:uppercut', name: 'Uppercut', hint: 'Can knock them out', level: 40, kind: 'punch', aim: 'head', hit: -0.1, dmg: 1.45, cost: 12, effect: 'ko', text: 'You come up under their chin with an uppercut.' },
  { id: 'tech:sweep', name: 'Trip them', hint: 'Puts them on the floor', level: 50, kind: 'kick', aim: 'leg', hit: 0, dmg: 0.4, cost: 12, effect: 'sweep', text: 'You hook a foot behind their ankle and shove.' },
];
/** On someone who's on the floor (you standing over them), besides stamping. */
export const GROUND: Technique[] = [
  { id: 'ground:kneedrop', name: 'Knee drop', hint: 'Your weight on their chest', level: 12, kind: 'stomp', aim: 'body', hit: 0, dmg: 1.2, cost: 14, text: 'You drop your full weight onto their chest, knee first.' },
  { id: 'ground:pound', name: 'Ground and pound', hint: 'Sit on them and punch', level: 30, kind: 'punch', aim: 'head', hit: 0.1, dmg: 1.3, cost: 14, effect: 'pound', text: 'You kneel on their chest and rain punches down into their face.' },
  { id: 'ground:arm', name: 'Wrench an arm', hint: 'Can break it', level: 45, kind: 'punch', aim: 'arm', hit: 0.05, dmg: 0.7, cost: 12, effect: 'break-arm', text: 'You pin their wrist and wrench their arm back against the elbow.' },
];
/** When you're the one on the floor (and they're standing). */
export const FLOOR: Technique[] = [
  { id: 'floor:legs', name: 'Kick their legs', hint: 'Bring them down too', level: 18, kind: 'kick', aim: 'leg', hit: 0, dmg: 0.5, cost: 12, effect: 'sweep', text: 'From the floor, you kick hard at their ankles.' },
  { id: 'floor:pull', name: 'Drag them down', hint: 'Down here with you', level: 36, kind: 'punch', aim: 'body', hit: 0.05, dmg: 0.3, cost: 12, effect: 'sweep', text: 'You grab their legs and haul them down onto the pavement with you.' },
];
/** Every learned move, wherever it's used. */
const ALL_MOVES = () => [...TECHNIQUES, ...GROUND, ...FLOOR];
/** A new ambush: slam them into the wall. */
export const SLAM_AMBUSH_LEVEL = 35;

/** On someone who's on the floor: a choke (out cold, no blood). */
export const CHOKE_LEVEL = 58;
/** New ambushes: kick out their knee, and a choke from behind. */
export const KNEE_AMBUSH_LEVEL = 20;
export const CHOKE_AMBUSH_LEVEL = 66;
/** Every technique and when it comes, for the stats sheet. */
export const ALL_TECHNIQUES: { name: string; level: number; where: string }[] = [
  ...TECHNIQUES.map((t) => ({ name: t.name, level: t.level, where: 'in a fight' })),
  ...GROUND.map((t) => ({ name: t.name, level: t.level, where: 'on someone on the floor' })),
  ...FLOOR.map((t) => ({ name: t.name, level: t.level, where: 'from the floor' })),
  { name: 'Kick their knee', level: KNEE_AMBUSH_LEVEL, where: 'ambush' },
  { name: 'Slam them into the wall', level: SLAM_AMBUSH_LEVEL, where: 'ambush' },
  { name: 'Headlock', level: CHOKE_LEVEL, where: 'on someone on the floor' },
  { name: 'Choke from behind', level: CHOKE_AMBUSH_LEVEL, where: 'ambush' },
].sort((a, b) => a.level - b.level);

/** Barely knows how to throw a punch yet (Unarmed 1–10): it shows. */
const novice = () => (enc.unarmedLevel ?? 1) <= 10;

/** What a technique does when it lands, beyond the blow itself. */
function techEffect(t: Technique) {
  const T = enc.them;
  switch (t.effect) {
    case 'cut':
      if (Math.random() < 0.45) {
        T.bleeding = Math.min(4, T.bleeding + 1);
        (T.marks ??= {}).brow = true;
        say('you', 'The elbow opens a cut over their eye. Blood runs into it.');
        impacts.push({ target: 'them', ml: 0, severe: false, loc: 'head', spill: 'spatter' });
      }
      break;
    case 'sweep':
      if (!T.down && Math.random() < (BUILDS[enc.person.build].solid ? 0.55 : 0.85)) {
        T.down = true;
        say('them', "They go down hard. They're on the floor.");
        scare(5);
      }
      break;
    case 'ko':
      if (!T.out && Math.random() < 0.16 + (1 - T.blood / T.maxBlood) * 0.4) {
        T.out = true;
        T.down = true;
        T.awake = Math.min(T.awake, -25);
        say('them', "Their head snaps back and their legs go. They're out cold.");
      }
      break;
    case 'pound':
      if (!T.out && !T.dazed && Math.random() < 0.5) {
        T.dazed = 2;
        say('them', "Their eyes won't focus. They're dazed.");
      }
      break;
    case 'break-arm': {
      const arm = (['left arm', 'right arm'] as Part[]).find((x) => !T.broken.includes(x));
      if (arm && Math.random() < 0.35 + ((enc.unarmedLevel ?? 1) - 45) * 0.005) {
        T.broken.push(arm);
        say('you', `There's a crack, and their ${arm} bends the wrong way. They scream.`);
        impacts.push({ target: 'them', ml: 0, severe: true, loc: 'arm', spill: 'none' });
        scare(15);
      }
      break;
    }
    case 'headbutt': {
      const ml = roll(40, 90);
      enc.you.blood = Math.max(0, enc.you.blood - ml);
      if (Math.random() < 0.2) enc.you.dazed = 1;
      say('you', `Your own head rings with it. (−${ml}\u00a0ml)`);
      if (!T.dazed && Math.random() < 0.6) {
        T.dazed = 2;
        say('them', "They're dazed.");
      }
      break;
    }
  }
}

/** A choke on someone on the floor: no blood, and out cold if you hold it. */
function choke() {
  const T = enc.them;
  spend('you', 14);
  const odds = clamp(0.55 + accuracyBonus(you.stats) + (you.stats.unarmed.level - CHOKE_LEVEL) * 0.005 - arms(enc.you) * 0.25 + (T.dazed ? 0.15 : 0), 0.05, 0.95);
  if (Math.random() >= odds) {
    say('you', 'You try to get them in a headlock, but they twist away and fight you off.');
    return;
  }
  T.stamina = Math.max(0, T.stamina - 40);
  you.gain('unarmed', 3);
  if (T.stamina === 0 || Math.random() < 0.3) {
    T.out = true;
    T.awake = -8;
    say('you', 'You get them in a headlock and squeeze. They claw at you, slower, slower, then go limp. Out cold.');
  } else say('you', 'You get them in a headlock and squeeze. They claw at your arm, choking, and tear free.');
  scare(15);
}

/** Pepper spray in their face: they can barely see to hit you for the rest of the fight. */
function spray(i: number, inv: Inventory) {
  const it = inv.items[i];
  if (!it?.spray) return;
  it.doses = Math.max(0, (it.doses ?? 3) - 1);
  spend('you', 4);
  enc.them.blinded = 99;
  say('you', 'You pepper spray them full in the face. They stagger back, eyes streaming and screwed shut, swinging blind.');
  if (it.doses === 0) {
    inv.items.splice(i, 1);
    say('info', 'The can sputters out. You drop it.');
  }
  scare(8);
  you.gain('weapons', 2);
}

/** Getting the drop on them makes a mugging easier: close, and them not looking. */
function mugSurprise(e: Encounter) {
  const aw = AWARENESS.indexOf(e.person.awareness);
  return [0.15, 0.08, 0, -0.08][aw] + e.distance * 0.05;
}

/** Knocked out, but not bled out: a slap can bring them round. */
const canWake = (e: Encounter) => !!e.them.out && !e.them.dead && e.them.blood > e.them.maxBlood * (PASS_OUT + 0.03) && e.them.awake > -60;

/** "Wallet. Now." Before any blows: they give it up, run, or fight. */
function mug() {
  const e = enc;
  const T = e.them;
  e.stage = 'combat';
  e.facedYou = true;
  spend('you', COST.ambush);
  const blade = (e.weapons ?? []).find((w) => w.cuts && !/bottle|syringe/i.test(w.name));
  if (blade) {
    say('you', `You let them see the ${lc(blade.name)}.`);
    scare(10);
  }
  say(
    'you',
    [
      `You cross the street and get right in their face. "Wallet. Phone. Now."`,
      `You close in fast and grab their arm. "Don't make a sound. Give me what you've got."`,
      `You step out in front of them, close enough to smell. "You know what this is. Hand it over."`,
    ][e.distance],
  );
  if (Math.random() < yieldChance(e, mugSurprise(e))) {
    T.yielded = true;
    scare(8);
    say('them', speak('giveUp'));
    you.gain('intimidation', 8);
    endOfRound();
    return;
  }
  you.gain('intimidation', 3);
  const fear = T.fear ?? 0;
  const P = personalityOf(e.person);
  if (fear >= 30 && legs(T) === 0 && Math.random() < clamp(0.55 * P.flee - P.fight, 0.05, 0.95)) {
    if (Math.random() < fleeChance(T, e.you, 0.1)) {
      say('them', oneOf(['They shove past you and run. Gone.', 'They bolt into the traffic. You lose them.']));
      end('lost-them');
      return;
    }
    say('them', 'They try to run. You grab them by the collar and drag them back.');
    scare(6);
    say('info', 'The fight is on.');
    endOfRound();
    return;
  }
  say('them', speak('refuseMug'));
  say('info', 'The fight is on.');
  theirTurn();
  endOfRound();
}

/** Their move once they've given up: begging, or trying their luck. */
function yieldTurn() {
  const e = enc;
  const T = e.them;
  T.fear = Math.max(0, (T.fear ?? 0) - 2);
  const fear = T.fear;
  const P = personalityOf(e.person);
  const nerve = 40 - P.yield * 100;
  if (fear < nerve && Math.random() < (nerve - fear) / 70) {
    if (!T.down && legs(T) === 0 && Math.random() < clamp(0.55 * P.flee - P.fight, 0.05, 0.95)) {
      if (Math.random() < fleeChance(T, e.you, 0.1)) {
        say('them', "They see their chance and bolt. They're gone.");
        end('they-fled');
      } else {
        say('them', 'They try to bolt. You catch them by the collar and slam them into the wall.');
        scare(10);
      }
      return;
    }
    T.yielded = false;
    say('them', oneOf(['Something changes in their face. They come at you.', '"Screw this." They swing at you.']));
    strike('them', 'punch');
    return;
  }
  if (Math.random() < 0.45) {
    const l = speak('beg');
    if (l) say('them', l);
  }
}

/** Something they'd say right now (their voice: see voices.ts), not said lately. '' if nothing. */
function speak(m: Moment): string {
  const xs = voice(enc, m);
  return xs.length ? vary(xs) : '';
}
/** Now and then, they say something (if they've anything to say). */
function maybeSay(m: Moment, chance: number) {
  if (Math.random() >= chance) return;
  const l = speak(m);
  if (l) {
    landed = null;
    say('them', l);
  }
}

/** What someone values most, to hold back (cash counts by the dollar). */
const valueOf = (l: Loot) => (l.kind === 'cash' ? (l.cash ?? 0) : l.kind === 'phone' ? 80 : l.secret ? 60 : /card/.test(l.kind) ? 40 : l.kind === 'car keys' ? 30 : 5);

/** A PIN: the real one, or the first four numbers that come into their head. */
const fourDigits = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0');

/**
 * Talking to someone who's given up, robbing them, hurting them; and waking
 * someone who's out cold. Returns true if it was one of those (then they
 * get their turn).
 */
function threatAct(id: string, inv?: Inventory): boolean {
  const e = enc;
  const T = e.them;
  const asked = (e.asked ??= []);
  if (id === 'demand' && !T.yielded && !T.out) {
    if (Math.random() < yieldChance(e)) {
      T.yielded = true;
      say('you', oneOf(['"Give it up," you tell them. "Or this gets worse."', '"Stop. Look at you. Just give me what you\'ve got."']));
      say('them', speak(T.down ? 'giveUpDown' : 'giveUp'));
      you.gain('intimidation', 8);
    } else {
      say('you', '"Give it up," you tell them.');
      say('them', speak('refuse'));
      you.gain('intimidation', 3);
    }
    return true;
  }
  if (id === 'wake' && canWake(e)) {
    if (Math.random() < 0.65) {
      T.out = false;
      T.outNoted = false;
      T.down = true;
      T.dazed = 2;
      T.awake = 20;
      T.yielded = true;
      scare(30);
      say('you', 'You slap them until their eyes open.');
      say('them', speak('woken') || 'They see you standing over them and start to beg.');
      you.gain('intimidation', 4);
    } else say('you', "You slap them. Their head lolls. They're still out.");
    return true;
  }
  if (!T.yielded || T.out) return false;
  const fear = T.fear ?? 0;
  if (id === 'menace') {
    say('you', oneOf(['You lean in close. "Try anything, and I\'ll know where to find you."', 'You grab their face and make them look at you. "Don\'t even think about it."', '"Run, and I\'ll catch you. And then it gets worse."']));
    // It only goes so far: past terrified, more threats do nothing.
    if (fear >= 80) {
      say('them', "They're as scared as they're going to get.");
      return true;
    }
    const before = fearLevel(fear);
    scare(12 * (1 - fear / 150));
    maybeSay('menaced', 0.7);
    if (fearLevel(T.fear ?? 0) > before) you.gain('intimidation', 2);
    return true;
  }
  if (id === 'empty' && !e.emptied) {
    e.emptied = true;
    for (const g of e.person.clothes) g.searched = true;
    // Not scared enough, and they keep something back.
    const all = e.person.clothes.flatMap((g) => g.loot);
    for (const l of all) delete l.hidden;
    if (all.length >= 2 && fear < 85 && Math.random() < ((85 - fear) / 70) * personalityOf(e.person).holdBack) {
      const best = [...all].sort((x, y) => valueOf(y) - valueOf(x))[0];
      best.hidden = true;
    }
    const shown = all.filter((l) => !l.hidden).map((l) => a(lc(lootLabel(l))));
    say('them', shown.length ? `They turn out their pockets${isBrute(e.person.personality) ? '' : ' with shaking hands'}: ${list(shown)}.` : "They turn out their pockets. There's nothing in them.");
    if (shown.length) maybeSay('emptied', 0.85);
    const arms_ = e.person.carrying.filter((it) => it.weapon || it.spray);
    if (arms_.length) say('them', `They drop ${list(arms_.map((it) => `the ${lc(it.name)}`))} at your feet.`);
    you.gain('intimidation', 3);
    return true;
  }
  if (id === 'patdown') {
    e.emptied = true;
    const hid: string[] = [];
    for (const g of e.person.clothes) {
      g.searched = true;
      for (const l of g.loot)
        if (l.hidden) {
          l.hidden = false;
          hid.push(`${a(lc(lootLabel(l)))} (${g.name.toLowerCase()}, ${l.where})`);
        }
    }
    const all = e.person.clothes.flatMap((g) => g.loot);
    say(
      'you',
      hid.length
        ? `You pat them down and find ${list(hid)} they were keeping from you.`
        : all.length
          ? `You pat them down: ${list(all.map((l) => a(lc(lootLabel(l)))))}. Nothing else.`
          : 'You pat them down. Nothing on them at all.',
    );
    if (hid.length) {
      scare(8);
      maybeSay('caught', 1);
    }
    return true;
  }
  if (id === 'ask-rest') {
    const hidden = e.person.clothes.flatMap((g) => g.loot.map((l) => ({ g, l }))).filter(({ l }) => l.hidden);
    say('you', '"Is that everything?"');
    if (hidden.length && Math.random() < fear / 100 + 0.1) {
      const { g, l } = hidden[0];
      l.hidden = false;
      say('them', `"Okay! Okay, there's this too." They pull ${a(lc(lootLabel(l)))} out of their ${g.name.toLowerCase()}.`);
      you.gain('intimidation', 4);
    } else say('them', speak(hidden.length ? 'holdingOut' : 'allThere') || (fear >= 50 ? '"That\'s all of it, I swear. I swear!"' : '"That\'s everything." They hold your eye a little too long.'));
    return true;
  }
  if (id.startsWith('pin:') || id.startsWith('pin-mine:')) {
    let card: { name: string; pin?: string; pinOk?: boolean } | undefined;
    if (id.startsWith('pin:')) {
      const [, gi, li] = id.split(':').map(Number);
      card = e.person.clothes[gi]?.loot[li];
    } else {
      const it = inv?.items[Number(id.slice(9))];
      card = it && /card/.test(it.kind) && it.detail === e.holder ? it : undefined;
    }
    if (!card || card.pin) return false;
    say('you', `"The ${card.name.toLowerCase()}. What's the PIN?"`);
    if (fear < 25) {
      say('them', (isBrute(e.person.personality) ? speak('refuse') : speak('pinRefuse')) || 'They press their lips together and say nothing.');
      return true;
    }
    card.pin = fourDigits();
    // Scared enough, it's the truth. Otherwise, maybe.
    const truth = personalityOf(e.person).truth;
    const terrified = fear >= (truth < 1 ? 85 : 65);
    card.pinOk = terrified || Math.random() < (fear / 80) * truth;
    say('them', `"${card.pin.split('').join('-')}. It's ${card.pin}." ${terrified ? speak('pinTruth') || "They're too scared to lie." : speak('pinLie') || 'They say it fast.'}`);
    you.gain('intimidation', 4);
    return true;
  }
  if (id === 'ask-thief' && e.canAsk && !asked.includes('thief')) {
    asked.push('thief');
    say('you', '"I lost some things. Someone round here has them. Who?"');
    if (fear >= 40 && Math.random() < 0.5) {
      e.tip = 'thief';
      say('them', '"There\'s someone... they\'ve been showing stuff around, selling it cheap. They hang around here, nights." You\'ll keep an eye out.');
      you.gain('intimidation', 4);
    } else {
      e.tip = 'none';
      say('them', '"I don\'t know anything about that! I swear!"');
    }
    return true;
  }
  if (id.startsWith('t-')) {
    torture(id.slice(2));
    return true;
  }
  if (id === 'let-go') {
    say('you', e.robbed ? 'You shove them away from you.' : 'You let them go.');
    say('them', speak('letGo') || 'They walk away fast, then run.');
    end(e.robbed ? 'mugged' : 'left');
    return true;
  }
  return false;
}

/** Hurting someone who's given up. It works; it costs you. */
function torture(how: string) {
  const e = enc;
  const T = e.them;
  let text: string;
  let ml = 0;
  switch (how) {
    case 'finger':
      // A finger really breaks (they'll have it splinted when you see them again).
      if ((T.marks?.fingers ?? 0) >= 10) return;
      text = oneOf(['You take one of their fingers and bend it back until it snaps. They scream into your hand.', "You grab their hand and bend a finger back, slowly. There's a wet crack. They howl."]);
      (T.marks ??= {}).fingers = (T.marks.fingers ?? 0) + 1;
      ml = 40;
      break;
    case 'stamp':
      if (!T.down) {
        T.down = true;
        say('you', 'You kick their legs out from under them. They hit the pavement.');
      }
      text = T.marks?.hand ? 'You grind your heel into their broken hand. They scream.' : 'You put your heel on their hand and lean on it until the small bones crunch. Their hand is broken.';
      (T.marks ??= {}).hand = true;
      ml = 90;
      break;
    case 'twist':
      if (!arms(T)) return;
      text = "You take their broken arm and twist. The bone ends grind. They make a sound you'll hear later, trying to sleep.";
      ml = 60;
      break;
    default:
      return;
  }
  e.tortured = (e.tortured ?? 0) + 1;
  ml = Math.round((ml * T.maxBlood) / 5000);
  if (ml) T.blood = Math.max(0, T.blood - ml);
  landed = 'them';
  say('you', ml ? `${text} (−${ml}\u00a0ml)` : text);
  impacts.push({ target: 'them', ml, severe: false, loc: 'arm', spill: ml >= 60 ? 'drip' : 'none' });
  // Fear like nothing else; and some of it gets into you.
  scare(28 * (1 - (T.fear ?? 0) / 200));
  addStress(e.you, 4);
  you.gain('intimidation', 5);
  // The pain can be too much.
  const lost = 1 - T.blood / T.maxBlood;
  if (Math.random() < 0.06 + lost * 0.4) {
    T.out = true;
    T.down = true;
    T.awake = -10;
    T.yielded = false;
    say('them', 'Their eyes roll back. They pass out from the pain.');
  } else say('them', speak('torture') || "They're sobbing now.");
}

/** Takes a weapon they were carrying (it's yours now: they can't use it on you). */
function takeCarried(ci: number, inv: Inventory, quiet = false): boolean {
  const it = enc.person.carrying[ci];
  if (!it || !(it.weapon || it.spray)) return false;
  const empty = !it.drug || it.drug === 'empty';
  const r = take(inv, { kind: 'weapon', name: it.name, weapon: it.weapon, cuts: it.cuts && it.name !== 'Bottle', spray: it.spray, doses: it.spray ? (it as { doses?: number }).doses ?? 3 : undefined, where: 'in their hand', ...(it.name === 'Syringe' ? { secret: it.drug ?? 'empty', known: empty, detail: empty ? 'Empty. Used.' : 'Something in it' } : {}), ...(it.name === 'Bottle' ? { drink: 'liquor' as const, doses: it.swigs ?? 0 } : {}) });
  if (!quiet) say('you', r.text);
  if (!r.ok) return false;
  enc.person.carrying.splice(ci, 1);
  if (enc.them.weaponOut === it.name) enc.them.weaponOut = null;
  enc.robbed = true;
  return true;
}

/** Searching a garment, or taking what you found. */
function search(id: string, inv?: Inventory) {
  const clothes = enc.person.clothes;
  if (id.startsWith('search:')) {
    const g = clothes[Number(id.slice(7))];
    if (!g || g.searched) return;
    g.searched = true;
    if (!g.loot.length) {
      say('you', `You go through their ${g.name.toLowerCase()}. Nothing.`);
      return;
    }
    const wallet = g.loot.filter((l) => l.where === 'wallet');
    const loose = g.loot.filter((l) => l.where !== 'wallet');
    const parts = loose.map((l) => `${a(lc(lootLabel(l)))} (${l.where})`);
    if (wallet.length) parts.unshift(`a wallet with ${list(wallet.map((l) => a(lc(lootLabel(l)))))}`);
    say('you', `You go through their ${g.name.toLowerCase()} and find ${list(parts)}.`);
    return;
  }
  if (!inv) return;
  const grab = (g: (typeof clothes)[number], l: Loot) => {
    const r = take(inv, l);
    say('you', r.text);
    if (r.ok) {
      g.loot.splice(g.loot.indexOf(l), 1);
      enc.robbed = true;
    }
  };
  if (id === 'take-all') {
    const lines: string[] = [];
    const left: string[] = [];
    let cash = 0;
    for (const g of clothes) {
      if (!g.searched) continue;
      for (const l of [...g.loot]) {
        if (l.hidden && enc.them.yielded) continue;
        if (!take(inv, l).ok) {
          left.push(a(lc(l.name)));
          continue;
        }
        if (l.kind === 'cash') cash += l.cash ?? 0;
        else lines.push(a(lc(l.name)));
        g.loot.splice(g.loot.indexOf(l), 1);
        enc.robbed = true;
      }
    }
    for (let ci = enc.person.carrying.length - 1; ci >= 0; ci--) {
      const it = enc.person.carrying[ci];
      if (!(it.weapon || it.spray) || (enc.them.yielded && !enc.emptied)) continue;
      if (takeCarried(ci, inv, true)) lines.push(a(lc(it.name)));
      else left.push(a(lc(it.name)));
    }
    if (cash) lines.unshift(`${money(Math.round(cash * 100))} in cash`);
    if (lines.length) say('you', `You take ${left.length ? 'what you can carry' : 'everything'}: ${list(lines)}.`);
    if (left.length) say('you', `There's no room for ${list(left)}. You leave ${left.length > 1 ? 'them' : 'it'}.`);
    return;
  }
  if (id.startsWith('takec:')) {
    takeCarried(Number(id.slice(6)), inv);
    return;
  }
  const [, gi, li] = id.split(':').map(Number);
  const g = clothes[gi];
  const l = g?.loot[li];
  if (g && l) grab(g, l);
}

/** Plural things take no article ("plastic bags", "bills, folded small"). */
const plural = (s: string) => {
  const last = s.split(',')[0].trim().split(' ').pop() ?? '';
  return /^[a-z]+s$/.test(last) && !/(ss|us|is|gas|lens)$/.test(last);
};
/** Lower-case the first letter only ("state ID", not "state id"). */
const lc = (s: string) => s.replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase());
const a = (s: string) => (/^(pepper spray|cash|loose|folded|groceries|house keys|car keys|cigarettes|headphones|matches|some |your |bills|bandages|gauze|iron tablets|painkillers)/.test(s) || plural(s) ? s : /^[aeiou]/.test(s) ? `an ${s}` : `a ${s}`);
const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function end(result: Result) {
  enc.stage = 'over';
  enc.result = result;
}

/** Words for one side doing something to the other ("they" and "you" take the same verbs). */
function names(a: Side) {
  return a === 'you'
    ? { S: 'You', p: 'your', re: "You're", o: 'them', oP: 'their', oRe: "They're", oSub: 'they', oSubCap: 'They' }
    : { S: 'They', p: 'their', re: "They're", o: 'you', oP: 'your', oRe: "You're", oSub: 'you', oSubCap: 'You' };
}

function difficultyLine(d: string) {
  return {
    Easy: "Wouldn't put up much of a fight.",
    Fair: 'Could go either way.',
    Hard: 'This one could hurt.',
    Brutal: 'You would be taking a real risk.',
  }[d];
}

function awarenessLine(a: string) {
  return {
    Oblivious: "Lost in their own head. They wouldn't notice a thing.",
    Distracted: 'Half paying attention.',
    Alert: 'Watching the street around them.',
    Paranoid: 'Jumping at every sound.',
  }[a];
}

const roll = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const oneOf = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function pick<T>(table: [T, number][]): T {
  let r = Math.random() * table.reduce((n, [, c]) => n + c, 0);
  for (const [v, c] of table) if ((r -= c) < 0) return v;
  return table[table.length - 1][0];
}
