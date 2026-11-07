import { AMBUSH_TEXT, TECH_ALT, TECH_TEXT, kickText, missText, punchText, stompText, tierOf, tierUpLine, weaponText, type Tier } from './practice';
import { AWARENESS, BUILDS, NAMES, personalityOf, type Item, type Loot, type Person } from './person';
import { money } from './money';
import { indoors, isBrute, voice, type Moment } from './voices';
import { lootMark, type LootGlyph, type LootTone } from './lootIcon';
import { STYLE_NAMES, styleLevel, trainStyle, type Style } from './styles';
import { caffeineEdge } from './health';
import { partOfDay } from './clock';
import { knifeOf, type Knife } from './knives';
import { gunOf } from './guns';
import { freeHand, lootLabel, take, type Inventory } from './inventory';
import {
  STAT_NAMES,
  toughnessResist,
  accuracyBonus,
  ambushBonus,
  gripBonus,
  damageMult,
  dodgeBonus,
  noticeRate,
  staminaRegen,
  strengthDamage,
  weaponAccuracy,
  lieBonus,
  persuadeBonus,
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
export type Result = 'won' | 'lost' | 'they-fled' | 'you-fled' | 'lost-them' | 'left' | 'walked' | 'killed' | 'mugged' | 'sold';
export type Side = 'you' | 'them';
export type Part = 'nose' | 'ribs' | 'left arm' | 'right arm' | 'left leg' | 'right leg' | 'left hand' | 'right hand' | 'left wrist' | 'right wrist' | 'left ankle' | 'right ankle' | 'collarbone' | 'spine';
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
  /** How it ended (shown as the last word on it). */
  end?: boolean;
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
  /** Put out by a drug, not a blow (no concussion). */
  drugOut?: boolean;
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
  /** Bleeding from the head (a split brow, the nose, the scalp): it runs down into the eyes. */
  headBleed?: boolean;
  /** Turns left half blind (pepper spray: it lasts the rest of the fight). */
  blinded: number;
  /** Withdrawal: hands that won't keep still (off your chance to land a blow). */
  shakes?: number;
  /** On painkillers: broken bones hamper you less. */
  numb?: boolean;
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
  /** (A needle went into you this fight: the high starts now, not when you walked up.) */
  dosedHigh?: boolean;
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
  /** Which fingers ("left thumb", "right ring finger"...). */
  fingerList?: string[];
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
  /** It's over and you've seen how: everything greyed out but the way out. */
  finished?: boolean;
  /** What you could do just before it ended (shown greyed out). */
  endOpts?: Option[];
  version: number;
  person: Person;
  stage: Stage;
  /** How close you are: 0 across the street, 1 behind them, 2 right on them. */
  distance: number;
  /** How close they are to noticing you (0..100). */
  suspicion: number;
  /** How far they've been warned off already (signs they've noticed you: 1, then 2). */
  warned?: number;
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
  /** They've run for it and you can go after them: how far ahead they are (0 caught, 5 gone), and how it ends if they get away. */
  chase?: { gap: number; result: 'lost-them' | 'they-fled'; why?: string };
  /** You ran after them (blood, a dose, the stress of it carry over, fight or not). */
  chased?: boolean;
  /** They've given up once already (said in full the first time; short after that). */
  yieldedOnce?: boolean;
  /** In a wheelchair, and you've kicked it over: they're on the sidewalk now. */
  tipped?: boolean;
  /** Why they ran (said in the closing note if they get away). */
  whyRan?: string;
  /** You collapsed while chasing them: nobody beat you, nobody was there to rob you. */
  chaseOut?: boolean;
  /** How you looked while they could see you (the least covered you were): what they'll remember. */
  seenAs?: { anon: number; looked: string; clothes: string[] };
  /** How you looked when you saw them (whether they know you is decided then, again only if it changes). */
  lookAt?: { anon: number; clothes: string };
  /** They know your face from what people say, not from meeting you. */
  byRep?: boolean;
  /** How a chase ended on your side (out of breath, you stopped), for the closing note. */
  chaseEnd?: string;
  /** Bags you could sell them: one-point bags of coke (see game.prime), and loose powder not bagged yet. */
  product?: number;
  bulk?: number;
  /** How hot the police are on you (game.prime), for who might be a cop. */
  heat?: number;
  /** They've bought from you before. */
  regular?: boolean;
  /** You've walked up to them (or they came over): face to face, no more watching from a distance. */
  talking?: boolean;
  /** You don't know a supplier yet: you can ask them if they know one. */
  askConnect?: boolean;
  /** You can ask them for change. */
  canBeg?: boolean;
  /** Sent by Dez, for the money you owe him. */
  enforcer?: boolean;
  /** You were arrested for what happened, there and then. */
  charged?: boolean;
  /** What a fight in a house means for the rest of it has been worked out. */
  afterDone?: boolean;
  /** Someone in their own home, and you broke in: theirs (or someone who lives there), how they found you, and whether they'd called it in. */
  resident?: {
    owner: boolean;
    how: 'awake' | 'woke' | 'home';
    phoned: boolean;
    /** What they'd put down in the house (wallet, keys, shoes, coat): back on them once it's over. */
    away?: { garments: import('./person').Garment[]; loot: import('./person').Loot[]; top?: import('./person').Garment; carrying: import('./person').Item[] };
  };
  /** You've sold before (word of it is what brings people over). */
  dealer?: boolean;
  /** They came over to you to buy: face to face, and they want it. */
  cameOver?: boolean;
  /** You sold to them (they remember you as their dealer). */
  customer?: boolean;
  /** How a deal went, for the game to settle (the bag, the money, a cop): see game.settleDeal. */
  deal?: { kind: 'sold' | 'snatched' | 'sting' | 'no'; price: number; reported?: boolean; done?: boolean };
  grudge?: number;
  /** What you know of them: what you did, how they look now. */
  history?: string;
  looks?: string[];
  /** A mask over your face: people get wary of you faster. */
  conspicuous?: boolean;
  /** How much of what you're carrying shows, 0..1 (see inventory.exposure). */
  exposed?: number;
  /** Your weapons that are in a bag (inventory indexes): a turn to get out. */
  bagged?: number[];
  /** ...and the ones you've got out this fight. */
  drawn?: number[];
  /** (Of the slow ones, the ones strapped at your ankle.) */
  ankle?: number[];
  /** How they were when this began (blood, broken bones), to tell what's new. */
  start?: { blood: number; broken: Part[] };
  /** It came to blows (a round of a fight was fought). */
  fought?: boolean;
  /** How many on the street saw the violence (set once, when it starts). */
  witnessed?: number;
  /** How many others are on the street right now (for the screen). */
  watchers?: number;
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
  /** How many hands are full with something that isn't a weapon (a bag by the strap). */
  carrying?: number;
  weapons?: { i: number; name: string; weapon?: number; cuts?: boolean; spray?: boolean; doses?: number; loaded?: string; known?: boolean; gun?: boolean; ammo?: number; hand?: 'left' | 'right' }[];
  /** Shots you've fired this fight (each one gets called in). */
  shots?: number;
  /** Out in the rain (a lighter burns more fuel). */
  wet?: boolean;
  /** Your folding knives opened in this fight. */
  opened?: string[];
  /** Lines said lately in this fight (so they aren't said again straight away). */
  recent?: string[];
  /** Your Unarmed level (which techniques you know), set as you act. */
  unarmedLevel?: number;
  /** Your level in each fighting style (see styles.ts), for what you know. */
  styleLevels?: Partial<Record<Style, number>>;
  /** Your Speech level, set as you act (for talking them into things). */
  speechLevel?: number;
  /** Your Sneak (how low-key you keep things). */
  sneakLevel?: number;
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
  /** Something to take: its symbol, and what kind of thing it is (see lootIcon.ts). */
  icon?: LootGlyph;
  tone?: LootTone;
}

/** The tabs the options are sorted into. */
export type Category = 'surveil' | 'talk' | 'violence' | 'attack' | 'stomp' | 'search' | 'threaten' | 'torture' | 'move';
export const CATEGORY_NAMES: Record<Category, string> = {
  surveil: 'Surveil',
  talk: 'Talk',
  violence: 'Violence',
  attack: 'Attack',
  stomp: 'Violence',
  search: 'Search',
  threaten: 'Threaten',
  torture: 'Torture',
  move: 'Move',
};
const SURVEIL_IDS = ['follow', 'build', 'carrying', 'awareness', 'sex', 'read', 'bluff', 'sell', 'approach', 'beg', 'connect'];
const VIOLENCE_IDS = ['bumrush', 'sucker', 'shove', 'mug', 'kneecap', 'slam', 'rear-choke', 'spray-ambush', 'go-at'];

// ---------- Fear ----------

export const FEAR_NAMES = ['Calm', 'Wary', 'Scared', 'Terrified'];
export const fearLevel = (f: number) => (f >= 70 ? 3 : f >= 45 ? 2 : f >= 20 ? 1 : 0);
/** Chance they give up when you tell them to (fear, and a bonus for surprise). */
export const yieldChance = (e: Encounter, bonus = 0) => clamp(((e.them.fear ?? 0) - 20) / 60 + bonus + persuadeBonus(e.speechLevel ?? 1) + personalityOf(e.person).yield, 0.04, personalityOf(e.person).maxYield);
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
        if (!l.hidden || !e.them.yielded) found.push({ id: `take:${gi}:${li}`, label: lootLabel(l), hint: l.where === 'wallet' ? 'In their wallet' : `${g.name}, ${l.where}`, cat: 'search', ...lootMark(l) });
      });
  });
  // What they were carrying to hurt you with: in their hand, or on the ground by them.
  e.person.carrying.forEach((it, ci) => {
    if ((it.weapon || it.spray) && (!e.them.yielded || e.emptied))
      found.push({ id: `takec:${ci}`, label: it.name, hint: e.them.weaponOut === it.name || it.dropped ? 'On the ground by them' : 'They were carrying it', cat: 'search', ...lootMark({ kind: 'weapon', ...it }) });
  });
  const all: Option[] = found.length > 1 ? [{ id: 'take-all', label: 'Take everything', hint: `${found.length} things`, cat: 'search' }] : [];
  const out = [...all, ...found, ...todo];
  return out.length ? out : [{ id: 'nothing', label: 'Nothing left on them', disabled: true, cat: 'search' }];
}

/** Something in each hand already. */
const handsFull = (e: Encounter) => (e.weapons ?? []).filter((w) => w.hand).length + (e.carrying ?? 0) >= 2;
/** Your weapons, as attacks (pepper spray, while it lasts). */
/** A weapon by what it is, short ("knife", "bat"), for the buttons. */
function shortName(n: string): string {
  if (/broken bottle/i.test(n)) return 'broken bottle';
  if (knifeOf(n) && !/bottle|syringe/i.test(n)) return 'knife';
  return lc(n).split(' ').pop() ?? lc(n);
}
function weaponOptions(e: Encounter, cat: Category, tired: (n: number) => boolean): Option[] {
  const seen = new Set<string>();
  return (e.weapons ?? [])
    .filter((w) => { const key = `${w.name}|${w.loaded ?? ''}|${w.hand ?? ''}`; return !seen.has(key) && !!seen.add(key); })
    .flatMap((w) => [
      // In your pocket, all you can do is take it out (a turn); in your hand, use it, or put it away (a turn).
      ...(w.hand ? [{ id: `stow:${w.i}`, label: `Put the ${shortName(w.name)} away`, hint: 'Hands free, nothing showing · a turn', cat }] : [{ id: `draw:${w.i}`, label: `Take out the ${shortName(w.name)}`, hint: handsFull(e) ? 'Your hands are full' : w.spray ? 'Ready to spray · a turn' : 'They see it, and scare easier · a turn', disabled: handsFull(e), cat }]),
      ...(!w.hand ? [] : ((full: boolean) => w.gun
      ? [
          { id: `wpn:${w.i}`, label: 'Shoot them', hint: full ? 'Your hands are full' : w.doses ? `${w.doses} in the gun · loud: it gets called in` : 'Empty', disabled: full || !w.doses, cat },
          ...(w.ammo && (w.doses ?? 0) < (gunOf(w.name)?.holds ?? 0) ? [{ id: `reload:${w.i}`, label: 'Reload', hint: `${w.ammo} rounds left · takes a turn`, cat }] : []),
          { id: `whip:${w.i}`, label: `Hit (${shortName(w.name)})`, hint: full ? 'Your hands are full' : tired(COST.weapon) ? 'Too tired' : `+${w.weapon ?? 0} damage`, disabled: full || tired(COST.weapon), cat },
        ]
      : [
      w.spray
        ? { id: `wpn:${w.i}`, label: 'Pepper spray them', hint: full ? 'Your hands are full' : (w.doses ?? 3) <= 0 ? 'Empty' : e.them.blinded > 0 ? 'They\'re already blind' : `${w.doses ?? 3} left · blinds them`, disabled: full || (w.doses ?? 3) <= 0 || e.them.blinded > 0, cat }
        : { id: `wpn:${w.i}`, label: /^bottle$/i.test(w.name) ? 'Swing the bottle' : /syringe/i.test(w.name) ? (w.loaded ? `Stab with the syringe (${w.known ? w.loaded : 'loaded'})` : 'Stab with the empty syringe') : `${w.cuts ? (knifeOf(w.name)?.style === 'stab' ? 'Stab' : 'Slash') : 'Hit'} (${lc(w.name)})`, hint: full ? 'Your hands are full' : tired(COST.weapon) ? 'Too tired' : `+${w.weapon ?? 0} damage${w.cuts && !/^bottle$|syringe/i.test(w.name) ? ', cuts' : ''}${w.loaded ? ', may inject them' : ''}`, disabled: full || tired(COST.weapon), cat },
      // A whole bottle can be broken for an edge (it doesn't always break).
      ...(/^bottle$/i.test(w.name) ? [{ id: `smash:${w.i}`, label: 'Smash the bottle', hint: full ? 'Your hands are full' : tired(COST.punch) ? 'Too tired' : 'For a jagged edge: it cuts', disabled: full || tired(COST.punch), cat }] : []),
        ])(false)),
    ]);
}

/**
 * The techniques you've learned (by Unarmed level), and the next one you
 * haven't, shown greyed out so you know what's coming.
 */
/** A move that a better one takes over from, once you know the better one: [the old one, the one that replaces it]. */
const REPLACED_BY: [string, string][] = [
  ['tech:hook', 'tech:uppercut'],
  ['tech:lowkick', 'tech:kneekick'],
  ['tech:sweep', 'tech:double'],
  ['ground:pound', 'ground:elbows'],
  ['floor:legs', 'floor:pull'],
];
/**
 * The moves you know (the ones you don't aren't shown: the You tab says what
 * each style teaches next). An old move goes once the one that replaces it is
 * learned, unless that one can't be used right now.
 */
function learned(e: Encounter, list: (Omit<Option, 'cat'> & { level: number; style?: Style })[], cat: Category): Option[] {
  const lvl = (t: { style?: Style }) => e.styleLevels?.[t.style ?? styleOfId(t as { id: string })] ?? e.unarmedLevel ?? 1;
  const known = list.filter((t) => t.level <= lvl(t)).map(({ level: _l, style: _s, ...o }) => ({ ...o, cat }));
  // (With your arms broken, a takedown with your hands is no better than the kick it replaced.)
  const handsGone = arms(e.you) >= 1;
  const usable = new Set(known.filter((o) => !o.disabled && !(handsGone && (o.id === 'tech:double' || o.id === 'floor:pull'))).map((o) => o.id));
  // (The old one comes back only when it can be used itself: no second dead button.)
  // (Only once the replacement is learned at all: before that, the old move is just a move, greyed when you're too tired.)
  const has = new Set(known.map((o) => o.id));
  return known.filter((o) => !REPLACED_BY.some(([old, by]) => old === o.id && has.has(by) && (usable.has(by) || !usable.has(old))));
}
/** What style a move is (by its id: the basic moves, the ambushes, the learned ones). */
export function styleOfId(o: { id: string }): Style {
  const id = o.id.replace(/^locked:/, '');
  const t = ALL_MOVES().find((x) => x.id === id);
  if (t) return t.style;
  if (/^(kick|kneecap)$/.test(id)) return 'kicks';
  if (/^(grapple|bumrush|shove|slam)$/.test(id)) return 'clinch';
  if (/^stomp-/.test(id)) return 'ground';
  if (/^(choke|rear-choke)$/.test(id)) return 'locks';
  return 'strikes';
}

/** They've given up: rob them, question them, hurt them, or let them go. */
function yieldedOptions(e: Encounter): Option[] {
  const T = e.them;
  const asked = e.asked ?? [];
  const out: Option[] = [];
  if (!e.emptied) out.push({ id: 'empty', label: '"Empty your pockets"', hint: 'They hand it over', cat: 'search' });
  out.push(...(e.emptied || e.person.clothes.some((g) => g.searched) ? searchOptions(e).filter((o) => o.id !== 'nothing') : []));
  // (Each of these once: done, it's done.)
  const patted = asked.includes('patdown');
  if (!patted) out.push({ id: 'patdown', label: 'Pat them down', hint: 'Slower, but nothing gets past you', cat: 'search' });
  // Questions.
  if (!asked.includes('menace')) out.push({ id: 'menace', label: '"Don\'t even think about it"', hint: (e.them.fear ?? 0) >= 80 ? "They can't get any more scared" : 'Scare them more', cat: 'threaten' });
  if (e.emptied && !patted && !asked.includes('rest')) out.push({ id: 'ask-rest', label: '"Is that everything?"', hint: 'Are they holding out on you?', cat: 'threaten' });
  e.person.clothes.forEach((g, gi) =>
    g.loot.forEach((l, li) => {
      if (g.searched && !l.hidden && /card/.test(l.kind) && !l.pin && !l.pinAsked && !l.yours) out.push({ id: `pin:${gi}:${li}`, label: '"What\'s the PIN?"', hint: `Their ${l.name.toLowerCase()}`, cat: 'threaten' });
    }),
  );
  for (const c of e.cardsHeld ?? []) out.push({ id: `pin-mine:${c.i}`, label: '"What\'s the PIN?"', hint: `The ${c.name.toLowerCase()} you took`, cat: 'threaten' });
  if (e.canAsk && !asked.includes('thief')) out.push({ id: 'ask-thief', label: '"Seen anyone with my things?"', hint: 'What you had, before', cat: 'threaten' });
  // Hurting them, for the truth or for the fun of it.
  const fingers = T.marks?.fingers ?? 0;
  const handsDone = (['left', 'right'] as const).filter((sd) => T.broken.includes(`${sd} hand` as Part));
  const canBend = fingersLeft(T).length > 0;
  out.push({ id: 't-finger', label: 'Bend a finger back', hint: !canBend ? (handsDone.length >= 2 ? 'Both hands are broken' : 'Every finger’s broken') : (fingers ? `${fingers} broken so far` : 'Until it snaps'), disabled: !canBend, cat: 'torture' });
  // (Only someone on the floor has a hand under your heel; and only two hands to break.)
  if (T.down) out.push({ id: 't-stamp', label: 'Stomp on their hand', hint: handsDone.length >= 2 ? 'Both hands are broken' : handsDone.length ? 'The other hand' : undefined, disabled: handsDone.length >= 2, cat: 'torture' });
  // A knife in your hand.
  const blade = heldBlade(e);
  if (blade) {
    if (!asked.includes('blade')) out.push({ id: 't-blade', label: /broken bottle/i.test(blade.name) ? 'Glass to their eye' : 'Knife to their eye', hint: 'No blood: just fear', cat: 'torture' });
    const cheeks = (T.marks?.scars ?? []).filter((x) => x === 'cheek').length;
    if (cheeks < 2) out.push({ id: 't-cut', label: cheeks ? 'Cut their other cheek' : 'Cut their cheek', hint: 'A scar they’ll carry', cat: 'torture' });
  }
  // A broken arm twisted, once each (doing it again is just doing it again).
  const twistable = T.broken.filter((x) => /arm$/.test(x) && !asked.includes(`twist:${x}`));
  if (T.broken.some((x) => /arm$/.test(x))) out.push({ id: 't-twist', label: 'Twist the broken arm', hint: twistable.length ? undefined : 'You’ve done that', disabled: !twistable.length, cat: 'torture' });
  // (Both your arms broken: none of that is anything you can do.)
  if (arms(e.you) >= 2) for (const o of out) if (['t-finger', 't-twist', 't-blade', 't-cut'].includes(o.id)) Object.assign(o, { disabled: true, hint: 'Your arms are broken' });
  out.push({ id: 'punch', label: 'Hit them anyway', hint: 'It turns back into a fight', cat: 'move' });
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
    holder: person.clothes.flatMap((g) => g.loot).find((l) => !l.yours && (l.kind === 'id' || /card/.test(l.kind)))?.detail?.split(',')[0],
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

/** Legs you can't stand on: a broken leg or ankle on that side (and a broken back takes both). */
const legs = (f: Body) => (f.broken.includes('spine') ? 2 : new Set(f.broken.filter((p) => /(leg|ankle)$/.test(p)).map((p) => p.split(' ')[0])).size);
/** A blow taken where they stand firm (or against a wall): no stepping back or staggering. */
const unmoved = (t: string) => t.replace(/[^.]*\b(?:stagger|back a step|barely stay standing|knees dip)[^.]*\.\s?/gi, '').trim();
/** Arms you can't use: a broken arm, wrist or hand on that side, and a broken collarbone takes one. */
const arms = (f: Body) => Math.min(2, new Set(f.broken.filter((p) => /(arm|wrist|hand)$/.test(p)).map((p) => p.split(' ')[0])).size + (f.broken.includes('collarbone') ? 1 : 0));
/** Broken ribs make every breath hurt, and a punctured lung is worse. */
const ribs = (f: Body) => (f.lung ? 2.4 : f.broken.includes('ribs') ? 1.8 : 1);
const cost = (f: Body, n: number) => Math.round(n * ribs(f));
/** How much of your stamina you can get back with broken ribs (you can't fill your lungs). */
export const staminaCap = (f: Body) => f.maxStamina * (f.lung ? 0.3 : f.broken.includes('ribs') ? 0.5 : 1);

/** Chance to run away (or for them, to get away). Legs matter most. */
function fleeChance(f: Body, other: Body, bonus = 0) {
  if (f.down || f.broken.includes('spine')) return 0;
  let c = 0.6 + bonus + (other.down ? 0.25 : 0) + (other.dazed ? 0.15 : 0);
  // Who's faster: your Agility (and both of you as you are now, legs, breath and all) against theirs.
  const fSide: Side = f === enc.you ? 'you' : 'them';
  const oSide: Side = fSide === 'you' ? 'them' : 'you';
  if (!other.down) c += (speed(f, fSide) - speed(other, oSide)) * 1.2;
  c *= [1, 0.35, 0.08][legs(f)];
  if (f.dazed) c -= 0.15;
  if (f.stamina < cost(f, COST.run)) c -= 0.25;
  return Math.max(0.02, Math.min(0.95, c));
}

/** How far ahead someone running from you is, in words. */
const GAP_WORDS = ['Right in front of you', 'A few steps ahead', 'Half a block ahead', 'Most of a block ahead', 'Nearly out of sight'];

/**
 * How fast someone runs, about 1 for an ordinary adult: you by your Agility,
 * them by what they are and their build; then for both what's wrong with
 * them (legs, blood, breath, drink, drugs, a knock on the head).
 */
function speed(f: Body, side: Side): number {
  let s: number;
  if (side === 'you') s = 0.85 + ((you.stats.agility?.level ?? 1) - 1) * 0.004;
  else {
    const p = enc.person;
    s = { homeless: 0.88, junkie: 0.95, drunk: 0.8, civilian: 1 }[p.kind] * ({ Frail: 0.85, Skinny: 1.04, Average: 1, Stocky: 0.95, Athletic: 1.12, Heavyset: 0.84, Muscular: 0.98 }[p.build] ?? 1);
  }
  if (f.out || f.dead) return 0;
  // A broken leg: a hobble.
  if (legs(f)) s *= legs(f) > 1 ? 0.1 : 0.35;
  const blood = f.blood / f.maxBlood;
  if (blood < 0.85) s *= Math.max(0.45, 1 - (0.85 - blood) * 1.2);
  if (side === 'you' && enc.fought) s *= 0.92; // (Already spent from the fight.)
  if (f.stamina < cost(f, COST.run)) s *= 0.6;
  else if (f.stamina < f.maxStamina * 0.3) s *= 0.85;
  if (f.broken.includes('ribs')) s *= 0.85;
  if (f.lung) s *= 0.5;
  if (f.dazed) s *= 0.8;
  if (f.blinded > 0) s *= 0.6;
  s *= 1 - Math.min(0.5, (f.drunk ?? 0) / 250);
  if (f.high === 'heroin' || f.high === 'fentanyl' || f.high === 'tranq') s *= 0.75;
  else if (f.high === 'meth') s *= 1.08;
  return s;
}

/** They run for it: a head start, and it's up to you whether to go after them. */
function bolt(result: 'lost-them' | 'they-fled', gap: number) {
  const e = enc;
  e.stage = 'combat';
  e.facedYou = true;
  e.them.down = false;
  e.them.yielded = false;
  // (Caught again later, they've had a moment: the old threats can be made again.)
  e.asked = (e.asked ?? []).filter((x) => x !== 'menace' && x !== 'blade');
  e.chase = { gap: Math.min(4.5, gap + (e.you.down ? 1 : 0) + (e.you.dazed ? 0.5 : 0) + (e.you.blinded > 0 ? 1 : 0)), result };
}

/** One stretch of running after them. */
function chaseStep() {
  const e = enc;
  const c = e.chase!;
  const y = e.you;
  const T = e.them;
  if (y.down) {
    spend('you', COST.getUp);
    if (Math.random() >= getUpChance(y)) {
      c.gap += speed(T, 'them') * 1.5;
      say('you', 'You try to get up, and your legs go out from under you. They\'re getting away.');
      if (c.gap >= 5) {
        e.chaseEnd = 'You couldn\'t get up in time.';
        delete e.chase;
        end(c.result);
      }
      return;
    }
    y.down = false;
    say('you', 'You scramble up off the sidewalk and go after them.');
  }
  if (y.stamina < cost(y, COST.run) / 2) {
    // Nothing left: you stop, hands on your knees.
    delete e.chase;
    e.chaseEnd = vary(['You can\'t go on. You stop, hands on your knees, and watch them go.', 'Your legs won\'t do it anymore. You stand there, heaving, and they\'re gone.']);
    say('you', e.chaseEnd);
    end(c.result);
    return;
  }
  const mine = speed(y, 'you');
  const theirs = speed(T, 'them');
  spend('you', COST.run + 5);
  spend('them', COST.run + 5);
  const before = c.gap;
  c.gap = Math.max(0, c.gap + (theirs - mine) * 3 + (Math.random() - 0.5) * 1.6);
  // Ahead of you, they can duck round a corner, into a crowd, into a doorway.
  const slip = c.gap > 0.4 && Math.random() < 0.08 + c.gap * 0.04;
  you.gain('agility', 2);
  you.gain('stamina', 1);
  if (c.gap <= 0.4) {
    // Caught.
    delete e.chase;
    const tackle = Math.random() < 0.45 + (mine - theirs);
    if (tackle) {
      T.down = true;
      say('you', oneOf(['You catch them by the back of the jacket and drag them down onto the sidewalk.', 'You dive and catch their legs. They go down hard.', 'You run them down and shove them from behind. They sprawl on the sidewalk.']));
    } else say('you', oneOf(['You catch up and grab their arm, and spin them around. They\'re trapped.', 'You cut them off against a wall. Nowhere left to go.', 'You get a hand on their collar and yank them back.']));
    say('them', T.stamina < T.maxStamina * 0.3 ? vary(['They\'re gasping for air.', 'Their chest heaves. They\'ve got nothing left to run with.']) : vary(['"Get off me!"', 'They twist and shove, trying to get loose.']));
    // (A dive takes it out of you too.)
    if (tackle && Math.random() < 0.3) {
      y.down = true;
      say('you', 'You go down with them.');
    }
    scare(10);
    you.gain('agility', 3);
    say('info', 'You caught them.');
    delete e.whyRan;
    return;
  }
  if (c.gap >= 5 || slip) {
    delete e.chase;
    say('them', vary(['They cut through a parking lot and they\'re gone.', 'They round a corner. By the time you get there, there\'s nobody.', 'They dart across the traffic, horns blaring, and you lose them.', 'They duck into a crowd, and you can\'t see them anymore.']));
    end(c.result);
    return;
  }
  const lines = c.gap < before - 0.3
    ? (c.gap < 1.5 ? ['You\'re right behind them now. You can hear them breathing.', 'You\'re gaining. A few more steps.', 'They look back, and you\'re right there.'] : ['You\'re gaining on them.', 'You close the gap, legs burning.', 'They\'re slowing. You\'re catching up.'])
    : c.gap > before + 0.3
      ? (c.gap > 3.5 ? ['They\'re pulling away. You can barely see them.', 'They\'re almost out of sight.', 'A block ahead now, and still going.'] : ['They\'re faster than you. The gap grows.', 'They pull ahead.', 'They\'re pulling away.'])
      : ['You keep pace, but you can\'t close the gap.', 'Neither of you is gaining.', 'Feet pounding the sidewalk. Same distance.', 'Your lungs burn. They\'re no closer.'];
  say(c.gap < before - 0.3 ? 'you' : c.gap > before + 0.3 ? 'them' : 'info', vary(lines));
}

/** Chance to get back up off the floor. */
const getUpChance = (f: Body) => (legs(f) >= 2 ? 0 : Math.max(0.1, 0.8 - legs(f) * 0.3 - (f.dazed ? 0.2 : 0) - (f.stamina < COST.getUp ? 0.3 : 0)));

/** What you can do right now, sorted into tabs (see `Category`). */
/**
 * What you can do right now. All the violence (strikes, weapons, what you do
 * to someone on the ground, torture, ambushes) is one tab, in sections;
 * moving (run, get up, catch your breath, walk away) isn't a tab at all, just
 * a row of buttons under the tabs.
 */
export function options(e: Encounter): Option[] {
  const GROUP_ORDER = ['Ambush', ...Object.values(STYLE_NAMES), 'Weapons', 'Torture'];
  // (Your arms: a neck needs both hands; a choke needs an arm round the throat.)
  const noArms = arms(e.you);
  const raw = rawOptions(e).map((o) =>
    (o.id === 'ground:neck' && noArms >= 1) || ((o.id === 'choke' || o.id === 'rear-choke') && noArms >= 2) ? { ...o, disabled: true, hint: 'Your arms are broken' } : o,
  );
  const out = raw.map((o): Option => {
    if (o.cat === 'move') return { ...o, cat: undefined };
    if (o.cat === 'attack' || o.cat === 'stomp' || o.cat === 'torture' || o.cat === 'violence') {
      // Sections by the kind of fighting it is (see styles.ts), weapons and torture apart.
      const group = o.cat === 'torture' ? 'Torture' : o.cat === 'violence' ? 'Ambush' : /^(wpn|draw|stow|reload|whip|smash|spray):/.test(o.id) || /^(wpn|draw|stow|reload|whip|smash)/.test(o.id) ? 'Weapons' : STYLE_NAMES[styleOfId(o)];
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
  if (e.chase && e.stage === 'combat') {
    const y = e.you;
    const lame = legs(y) > 0;
    return [
      {
        id: 'chase',
        label: y.down ? 'Get up and go after them' : 'Chase them',
        hint: lame ? `Your leg${legs(y) > 1 ? 's are' : ' is'} broken` : `${GAP_WORDS[Math.min(4, Math.max(0, Math.round(e.chase.gap)))]}${y.stamina < cost(y, COST.run) ? " · you're out of breath" : ''}`,
        disabled: lame,
        cat: 'move',
      },
      { id: 'let-go', label: 'Let them go', cat: 'move' },
    ];
  }
  switch (e.stage) {
    case 'menu':
    case 'surveil':
    case 'violence':
      // Face to face: talk, or go for them (no more watching them from a distance, no getting behind them).
      if (e.talking) {
        return [
          ...(e.canBeg && !(e.asked ?? []).includes('beg') ? [{ id: 'beg', label: '"Spare some change?"', hint: 'Ask for a little money', cat: 'talk' as Category }] : []),
          ...(e.askConnect && !(e.asked ?? []).includes('connect') ? [{ id: 'connect', label: '"Know anyone selling?"', hint: 'Who supplies around here', cat: 'talk' as Category }] : []),
          ...((e.product ?? 0) > 0 || (e.bulk ?? 0) > 0
            ? (e.asked ?? []).includes('sell')
              ? []
              : [{ id: 'sell', label: e.regular ? '"Same as last time?"' : '"You looking?"', hint: (e.product ?? 0) > 0 ? 'Sell them a bag' : 'Bag it up first (Pockets)', disabled: !(e.product ?? 0), cat: 'talk' as Category }]
            : []),
          ...(e.them.down
            ? [{ id: 'go-at', label: 'Go at them', hint: 'They can’t get away', cat: 'violence' as Category }]
            : [
                { id: 'sucker', label: 'Hit them', hint: 'Before they see it coming', cat: 'violence' as Category },
                { id: 'shove', label: 'Shove', hint: 'Easiest to land', cat: 'violence' as Category },
                ...learned(e, [{ id: 'slam', label: 'Slam them into the wall', hint: 'Head first', level: SLAM_AMBUSH_LEVEL, style: 'clinch' as Style }], 'violence'),
              ]),
          ...((e.weapons ?? []).some((w) => w.spray && (w.doses ?? 3) > 0) ? [((full: boolean) => ({ id: 'spray-ambush', label: 'Pepper spray them', hint: full ? 'Your hands are full' : 'Right in the face', disabled: full, cat: 'violence' as Category }))(handsFull(e) && !(e.weapons ?? []).some((w) => w.spray && w.hand))] : []),
          { id: 'mug', label: 'Mug them', hint: oddsHint(yieldChance(e, mugSurprise(e))), cat: 'violence' },
          { id: 'leave', label: 'Walk off' },
        ];
      }
      // Before anything has happened: watch them, or go for them. Switching
      // between the two is free; it's only a tab. Talking means walking up to them first.
      return [
        { id: 'follow', label: e.distance < 2 ? 'Follow' : 'Keep following', hint: e.suspicion >= 45 ? 'They\'re onto you: they may run' : e.distance < 2 ? 'Closer: easier to see, easier to be seen' : 'Each step risks being noticed', cat: 'surveil' },
        ...(e.known.build ? [] : [{ id: 'build', label: 'Size up their build', cat: 'surveil' as Category }]),
        ...(e.known.carrying ? [] : [{ id: 'carrying', label: "See what they're carrying", disabled: e.distance < 1, hint: e.distance < 1 ? 'Need to be closer' : undefined, cat: 'surveil' as Category }]),
        ...(e.known.awareness ? [] : [{ id: 'awareness', label: 'Judge how alert they are', cat: 'surveil' as Category }]),
        // Noticed, or nearly: cover for yourself.
        ...(e.suspicion >= 35 && !e.recognised ? [{ id: 'bluff', label: 'Act natural', hint: 'Speech: look like you belong here', cat: 'surveil' as Category }] : []),
        ...(e.known.sex && e.known.race ? [] : [{ id: 'sex', label: 'Get a look at them', hint: e.distance < 1 ? 'Hard to tell from here' : 'Their face, their build', cat: 'surveil' as Category }]),
        ...(e.known.personality ? [] : [{ id: 'read', label: 'Read them', hint: e.distance < 1 ? 'Need to be closer' : 'What kind of person?', disabled: e.distance < 1, cat: 'surveil' as Category }]),
        // Talking to them (asking for change, a supplier, selling): walk up first.
        { id: 'approach', label: 'Walk up to them', hint: 'Face to face: talk, sell, ask', cat: 'surveil' as Category },
        ...(e.them.down
          ? [{ id: 'go-at', label: 'Go at them', hint: 'They can’t get away', cat: 'violence' as Category }]
          : [
        { id: 'bumrush', label: 'Bum rush', hint: 'Knock them down', cat: 'violence' as Category },
        { id: 'sucker', label: 'Sucker punch', hint: 'Hit them in the head', cat: 'violence' as Category },
        { id: 'shove', label: 'Shove', hint: 'Easiest to land', cat: 'violence' as Category },
        ...learned(e, [
          // (Watching you, or backed up facing you: there's no "behind" to get to.)
          ...(e.suspicion >= 75 ? [] : [{ id: 'kneecap', label: 'Kick out their knee', hint: 'From behind: down they go', level: KNEE_AMBUSH_LEVEL, style: 'kicks' as Style }]),
          { id: 'slam', label: 'Slam them into the wall', hint: 'Head first', level: SLAM_AMBUSH_LEVEL, style: 'clinch' as Style },
          ...(e.suspicion >= 75 ? [] : [{ id: 'rear-choke', label: 'Choke from behind', hint: e.distance < 2 ? 'Get right behind them first' : 'Out cold, no blood', level: CHOKE_AMBUSH_LEVEL, style: 'locks' as Style, disabled: e.distance < 2 }]),
        ], 'violence'),
            ]),
        ...((e.weapons ?? []).some((w) => w.spray && (w.doses ?? 3) > 0) ? [((full: boolean) => ({ id: 'spray-ambush', label: 'Pepper spray them', hint: full ? 'Your hands are full' : 'Blind them first', disabled: full, cat: 'violence' as Category }))(handsFull(e) && !(e.weapons ?? []).some((w) => w.spray && w.hand))] : []),
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
        { id: 'stomp-head', label: 'Stomp on their head', hint: t ? 'Too tired' : (why ?? 'Can knock them out'), disabled: t, cat: 'stomp' },
        { id: 'stomp-stomach', label: 'Stomp on their stomach', hint: t ? 'Too tired' : (why ?? 'Winds them'), disabled: t, cat: 'stomp' },
        e.them.broken.includes('ribs') && e.them.lung
          ? { id: 'stomp-ribs', label: 'Stomp on their ribs', hint: 'Broken, and a lung with them', disabled: true, cat: 'stomp' }
          : { id: 'stomp-ribs', label: 'Stomp on their ribs', hint: t ? 'Too tired' : (why ?? (e.them.broken.includes('ribs') ? 'Already broken: a lung next' : 'Can break them')), disabled: t, cat: 'stomp' },
      ];
      // On them while they're down: knee drop, ground and pound, wrenching an arm.
      const ground = (...more: (Omit<Option, 'cat'> & { level: number; style?: Style })[]): Option[] => learned(e, [...GROUND.map((t) => ({ id: t.id, label: t.name, hint: brokenAlready(e.them, t) ?? (tired(t.cost) ? 'Too tired' : t.kind === 'punch' ? (armHint ?? t.hint) : t.hint), level: t.level, style: t.style, disabled: tired(t.cost) || !!brokenAlready(e.them, t) })), ...more], 'stomp');
      if (y.down) {
        return [
          { id: 'punch', label: 'Punch', hint: armHint ?? 'From the floor', cat: 'attack' },
          { id: 'kick', label: 'Kick', hint: tired(COST.kick) ? 'Too tired' : (legHint ?? 'From the floor'), disabled: tired(COST.kick), cat: 'attack' },
          ...weaponOptions(e, 'attack', tired).filter((o) => !(e.them.out && /spray/i.test(o.label))),
          ...(e.them.down ? [] : learned(e, FLOOR.map((t) => ({ id: t.id, label: t.name, hint: tired(t.cost) ? 'Too tired' : (t.kind === 'kick' ? legHint : armHint) ?? t.hint, level: t.level, style: t.style, disabled: tired(t.cost) })), 'attack')),
          { id: 'getup', label: 'Get up', hint: legHint ?? (y.dazed ? 'Dazed' : undefined), disabled: legs(y) >= 2, cat: 'move' },
          out ? { id: 'walk', label: 'Crawl away', hint: "They're unconscious", cat: 'move' } : breathe,
          // (They've given up, and you're down here: you can still let them go.)
          ...(e.them.yielded && !out ? [{ id: 'let-go', label: 'Let them go', cat: 'move' as Category }] : []),
        ];
      }
      if (out) {
        // They're unconscious: it isn't a fight any more. Keep going, go
        // through their pockets, wake them up to talk, or walk away.
        const wake: Option[] = e.them.dead ? [] : [{ id: 'wake', label: 'Slap them awake', hint: canWake(e) ? 'Have a word with them' : "They're too far gone", disabled: !canWake(e), cat: 'threaten' }];
        return [...stomps(), ...ground(), ...weaponOptions(e, 'stomp', tired).filter((o) => !/spray/i.test(o.label)), ...searchOptions(e), ...wake, breathe, { id: 'walk', label: e.resident ? 'Leave them there' : 'Walk away', ...(e.resident ? { hint: 'Back to the rest of the house' } : {}), cat: 'move' }];
      }
      if (e.them.yielded) return yieldedOptions(e);
      const demand: Option = { id: 'demand', label: heldBlade(e) ? `"Give it up" (the ${lc(heldBlade(e)!.name)})` : '"Give it up"', hint: oddsHint(yieldChance(e, heldBlade(e) ? KNIFE_EDGE : 0)), cat: 'threaten' };
      if (e.them.down) {
        const choke = { id: 'choke', label: 'Choke', hint: tired(14) ? 'Too tired' : armHint ?? 'Out cold, no blood', level: CHOKE_LEVEL, style: 'locks' as Style, disabled: tired(14) };
        return [...stomps(legHint), ...ground(choke), ...weaponOptions(e, 'stomp', tired).filter((o) => !/spray/i.test(o.label)), demand, run, breathe];
      }
      return [
        { id: 'punch', label: 'Punch', hint: armHint, cat: 'attack' },
        { id: 'kick', label: 'Kick', hint: tired(COST.kick) ? 'Too tired' : legHint, disabled: tired(COST.kick), cat: 'attack' },
        { id: 'grapple', label: 'Grapple', hint: tired(COST.grapple) ? 'Too tired' : (armHint ?? 'Take them down'), disabled: tired(COST.grapple), cat: 'attack' },
        ...learned(
          e,
          TECHNIQUES.map((t) => ({ id: t.id, label: t.name, hint: brokenAlready(e.them, t) ?? (tired(t.cost) ? 'Too tired' : t.kind === 'kick' ? (legHint ?? t.hint) : (armHint ?? t.hint)), level: t.level, style: t.style, disabled: tired(t.cost) || !!brokenAlready(e.them, t) })),
          'attack',
        ),
        ...weaponOptions(e, 'attack', tired),
        demand,
        run,
        breathe,
      ];
    }
    case 'over':
      // Done: what you could do last, greyed out, and the way out.
      if (e.finished)
        return [
          ...(e.endOpts ?? []).map((o) => ({ ...o, disabled: true })),
          ...((inHouse) => [{ id: 'done', label: inHouse ? 'Back to the house' : 'Leave', hint: inHouse ? undefined : 'Back to the street' }])(!!e.resident && e.result !== 'you-fled'),
        ];
      return [
        ...(e.them.dead ? searchOptions(e) : []),
        ...(e.them.dead ? [{ id: 'leave-body', label: e.resident ? 'Step over them' : 'Walk away', hint: e.resident ? 'Back to the rest of the house' : 'Leave the body where it lies' }] : []),
        // (Beside a body: going through their pockets, or walking away. Nothing else.)
      ];
    default:
      return [];
  }
}

/** Your stats, and a way to train them, for the move being played out. */
let you: { stats: Stats; gain: (name: StatName, xp: number) => void; style: (k: Style, xp: number) => void };
/** What you're carrying, during the move being played out (for things that change it). */
let invNow: Inventory | undefined;
/** A knife (or other blade) in your hand right now. */
const heldBlade = (e: Encounter) =>
  (e.weapons ?? []).find((w) => w.hand && w.cuts && !/^bottle$|syringe/i.test(w.name) && (!knifeOf(w.name) || knifeOf(w.name)!.open === 'fixed' || (e.opened ?? []).includes(knifeOf(w.name)!.name)));
/** How much more likely they are to hand it over with a knife in your hand. */
const KNIFE_EDGE = 0.12;
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
/** They refused to give it up this very move (they don't then cave on the same turn). */
let refusedNow = false;
/** They gave up this move: not turning on you in the same breath. */
let yieldedNow = false;
/** Where this move's lines start in the log. */
let actLogStart = 0;
export { indoors };
const say = (by: LogLine['by'], text: string) => {
  text = text.replace(/ {2,}/g, ' ').trim();
  // (Where a blow landed, said once: not "on the cheekbone. It catches you on the cheekbone.")
  if (/\bon the [a-z ]+\..*\bIt catches (you|them) on the cheekbone\./.test(text) || /\bon the cheekbone\b.*\bIt catches (you|them) on the cheekbone\./.test(text)) text = text.replace(/\s*\bIt catches (you|them) on the cheekbone\./, '');
  // (Limping a step, then going down in the same moment: they just go down.)
  // (Only the same person, and only in this move.)
  const down = (who: string) => new RegExp(`\\b${who} (go(es)? down|hit the (sidewalk|floor|ground))|\\b${who === 'They' ? "They're" : "You're"} on the (floor|sidewalk|ground)`);
  for (const who of ['They', 'You']) {
    if (!down(who).test(text)) continue;
    text = text.replace(new RegExp(`\\s*\\b${who} limp a step\\.(?=.*${down(who).source})`), '').trim();
    const prev = enc.log[enc.log.length - 1];
    if (prev && enc.log.length - 1 >= actLogStart && new RegExp(`\\b${who} limp a step\\.$`).test(prev.text)) {
      prev.text = prev.text.replace(new RegExp(`\\s*\\b${who} limp a step\\.$`), '').trim();
      if (!prev.text) enc.log.pop();
    }
  }
  if (enc.resident) {
    text = indoors(text);
    // (Out of bed: a T-shirt, not a jacket.)
    if (enc.resident.how === 'woke') text = text.replace(/\btheir jacket\b/g, 'their shirt').replace(/back of the jacket/g, 'back of the shirt');
  }
  enc.log.push(landed ? { by, text, hit: landed } : { by, text });
  landed = null;
};

/** Does one thing (an option id, or 'open' to start from the person button). */
export function act(e: Encounter, id: string, stats: Stats, inv?: Inventory, moves?: Record<string, number>): Impact[] {
  practice = moves ?? {};
  actLogStart = e.log.length;
  refusedNow = false;
  yieldedNow = false;
  invNow = inv;
  e.you.awake ??= 100;
  e.them.awake ??= e.them.out ? -25 : 100;
  pendingTier = null;
  const out = actInner(e, id, stats, inv);
  // Face to face (a fight, a mugging, a word), you can see who they are.
  if (e.stage === 'combat' || (e.stage === 'over' && (e.fought || e.facedYou))) e.known.sex = e.known.race = true;
  if (pendingTier) e.log.push({ by: 'info', text: pendingTier });
  pendingTier = null;
  return out;
}

function actInner(e: Encounter, id: string, stats: Stats, inv?: Inventory): Impact[] {
  impacts = [];
  landed = null;
  enc = e;
  e.unarmedLevel = stats.unarmed?.level ?? 1;
  e.speechLevel = stats.speech?.level ?? 1;
  e.sneakLevel = stats.sneak?.level ?? 1;
  outBefore = !!e.them.out;
  e.styleLevels = { strikes: styleLevel(stats, 'strikes'), kicks: styleLevel(stats, 'kicks'), clinch: styleLevel(stats, 'clinch'), ground: styleLevel(stats, 'ground'), locks: styleLevel(stats, 'locks') };
  you = {
    stats,
    gain(name, xp) {
      const up = train(stats, name, xp);
      if (up) say('info', `${STAT_NAMES[name]} went up to ${up}.`);
    },
    style(k, xp) {
      const up = trainStyle(stats, k, xp);
      if (up) {
        say('info', `${STYLE_NAMES[k]} went up to ${up}.`);
        (e.styleLevels ??= {})[k] = up;
      }
    },
  };
  // In a wheelchair: the first thing you do to them is put them on the sidewalk.
  if (e.them.broken.includes('spine') && !e.tipped && !e.them.out && (e.stage === 'combat' || e.stage === 'violence') && /^(punch|kick|grapple|stomp-|tech:|ground:|choke|wpn:|whip:|smash:|go-at)/.test(id)) {
    e.tipped = true;
    e.them.down = true;
    say('you', 'You kick the chair over. They spill out onto the sidewalk.');
  }
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
  const who = e.enforcer || p.title === "Dez's man" ? 'big man' : e.resident ? (p.sex === 'Male' ? 'man' : 'woman') : p.kind === 'homeless' ? 'homeless one' : NAMES[p.kind].toLowerCase();

  // Someone you hurt, and they've been looking for you: they find you first.
  if (id === 'ambushed' && e.stage === 'seen') {
    e.stage = 'combat';
    e.facedYou = true;
    // In their own home on two broken legs: they can't come at anyone.
    const crippled = !!e.resident && legs(e.them) >= 2;
    if (crippled) e.them.down = true;
    say('them', crippled
      ? e.them.broken.includes('spine') ? `The ${who} can't get up, and never will: they're paralysed. They throw whatever's in reach at you and scream for help.` : `The ${who} can't get up: both legs still in casts. They try to come off the bed at you and end up on the floor beside it, throwing whatever's in reach and screaming for help.`
      : e.resident
      ? e.resident.phoned
        ? oneOf([`You go at them. The phone goes skidding across the floor, and the ${who} grabs for whatever's nearest.`, `"Get out of my house!" The ${who} drops the phone and comes at you.`])
        : oneOf([`You go at them before they can get to a phone. The ${who} ${e.resident.how === 'awake' ? 'backs up the hall' : 'backs away'}, yelling, and grabs for whatever's nearest.`, `"Get out of my house!" The ${who} comes at you${e.resident.how === 'woke' ? ', barefoot and furious' : ', furious'}.`])
      : e.enforcer
      ? oneOf(['A big man steps out of a doorway and fills the sidewalk in front of you. "Dez says you\'re late."', 'A hand on your collar, from behind. "You owe Dez money. Dez wants it now."'])
      : oneOf([`A hand grabs your shoulder and spins you around. It's the ${who} from before. "Remember me?"`, `Someone steps out of a doorway right in front of you: the ${who}. They've been waiting for you.`]));
    say('info', oneOf(['The fight is on.', 'No going back now.', 'Here it comes.']));
    theirTurn(true);
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
          say('info', oneOf(['The fight is on.', 'No going back now.', 'Here it comes.']));
          theirTurn(true);
          endOfRound();
        } else if (e.byRep && e.dealer && (e.grudge ?? 0) < 30 && e.person.kind !== 'civilian' && Math.random() < 0.6) {
          // Heard about you: not as someone to run from.
          say('them', oneOf([`The ${who} looks at you a second too long, then drifts over. "You're the one, right? You holding?"`, `The ${who} has heard about you. They come over, hands in pockets.`]));
          e.distance = 2;
          // (Face to face: there's no getting behind them now.)
          e.suspicion = 75;
          e.cameOver = true;
          e.talking = true;
        } else if (e.regular && (e.grudge ?? 0) < 30) {
          // Someone you've sold to: they know what you are, and that's why they come over.
          say('them', oneOf([`The ${who} sees you and nods, and drifts over. "Hey. You around?"`, `The ${who} catches your eye, glances up and down the street, and comes over.`]));
          e.distance = 2;
          e.suspicion = 75;
          e.cameOver = true;
          e.talking = true;
        } else if (lame) {
          say('them', e.them.broken.includes('spine') ? `The ${who} sees you and goes rigid. They know you. In the chair, they can't get away; they grip the wheels and back up against the wall.` : `The ${who} sees you and goes rigid. They know you. On crutches, they can't run; they back up against the wall.`);
          e.suspicion = 100;
          e.distance = 1;
        } else {
          say('them', oneOf([`The ${who} sees you, and knows you. They hurry away, looking back over their shoulder.`, `The ${who} catches sight of you and freezes, then runs.`]));
          say('info', "They know you, and they're running.");
          bolt('lost-them', 3);
        }
      } else say('info', `${p.kind === 'homeless' ? 'Someone homeless' : `A ${who}`}, ${DISTANCE[0].toLowerCase()}. They haven't seen you.`);
    }
    return impacts;
  }

  // ---------- Dealing: "You looking?" ----------
  if (id === 'sell' && (e.stage === 'menu' || e.stage === 'surveil' || e.stage === 'violence')) {
    if (!(e.product ?? 0) || (e.asked ?? []).includes('sell')) return impacts;
    (e.asked ??= []).push('sell');
    sellTo(e);
    return impacts;
  }

  // Surveil and violence are tabs: picking an option from either one is
  // what decides which you're doing.
  if (e.stage === 'menu' || e.stage === 'surveil' || e.stage === 'violence') {
    if (SURVEIL_IDS.includes(id)) e.stage = 'surveil';
    else if (VIOLENCE_IDS.includes(id)) e.stage = 'violence';
  }
  // Walking up to them: face to face now (you see them properly; they see you).
  if (id === 'approach' && !e.talking && e.stage === 'surveil') {
    e.talking = true;
    e.facedYou = true;
    e.distance = 2;
    e.suspicion = Math.max(e.suspicion, 75);
    e.known.sex = e.known.race = e.known.build = true;
    const k = p.kind;
    say('you', oneOf(['You walk up to them, hands where they can see them.', 'You cross over and fall in beside them.', 'You step into their path, not too close.']));
    say('them', k === 'junkie' ? oneOf(['They stop, twitchy, already looking at your hands. "What?"', '"You got something?" Their eyes don\'t settle.']) : k === 'drunk' ? oneOf(['They sway to a stop. "Wha\'d\'you want?"', 'They squint at you, friendly enough. "Yeah?"']) : k === 'homeless' ? oneOf(['They look up at you, wary. "Yeah?"', 'They stop, and wait to see what you want.']) : oneOf(['They stop, wary, one hand on their bag. "Can I help you?"', 'They slow down, but they keep their distance. "Yeah?"']));
    return impacts;
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
      e.suspicion += base * [0.4, 0.8, 1.4, 2.0][aw] * (1 + e.distance * 0.4) * (0.7 + Math.random() * 0.6) * noticeRate(stats) * (e.conspicuous ? 1.6 : 1) * (1 + (e.exposed ?? 0) * 1.3);
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
        {
          // Only what shows: a bag, a bottle, a bat. Wallets and folded knives are in pockets.
          const shows = p.carrying.filter((i) => /\bbags?\b|backpack|cart|blanket|bottle|\bbat\b|pipe|crowbar|umbrella|case|tote|stick|tire iron|machete|hammer/i.test(i.name));
          say('info', shows.length ? `You can see: ${shows.map((i) => i.name.toLowerCase()).join(', ')}. Anything else is in their pockets.` : 'Nothing in their hands. Anything they have is in their pockets.');
        }
        const armed = p.carrying.find((i) => (i.weapon || i.spray) && /bottle|\bbat\b|pipe|crowbar|tire iron|machete|hammer|stick/i.test(i.name));
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
      case 'bluff': {
        // (Someone who knows you isn't fooled by acting natural.)
        if (e.recognised) return impacts;
        // Stop, check your phone, look lost: anything but following them.
        const odds = clamp(0.35 + lieBonus(stats) - (e.conspicuous ? 0.2 : 0) - (e.exposed ?? 0) * 0.4 - aw * 0.06, 0.05, 0.92);
        if (Math.random() < odds) {
          e.suspicion = Math.max(0, e.suspicion - 35);
          // (Calmer now: the signs come again if it climbs back.)
          e.warned = e.suspicion >= 75 ? 2 : e.suspicion >= 45 ? 1 : 0;
          say('you', oneOf(['You stop and frown at your phone like you\'re lost, and let them get ahead. They glance back once, and lose interest.', 'You cross to a shop window and study it. In the glass you watch them decide you\'re nobody.', 'You make a call to no one, laughing at nothing. They look away.']));
          you.gain('speech', 4);
        } else {
          e.suspicion += 25;
          say('you', oneOf(['You stop dead and stare at your phone. It looks exactly like what it is.', 'You try to look casual and overdo it. They look right at you.']));
          you.gain('speech', 1);
        }
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
    // Getting noticed: clear signs first, then they act on it.
    if (e.suspicion >= 100) {
      spotted();
    } else if (e.suspicion >= 75 && (e.warned ?? 0) < 2) {
      e.warned = 2;
      say('them', oneOf(['They stop and turn, and look straight back down the street at you. They know someone\'s there.', 'They speed up, and keep checking behind them. Any more and they\'ll run.']));
    } else if (e.suspicion >= 45 && (e.warned ?? 0) < 1) {
      e.warned = 1;
      say('them', oneOf(['They glance back over their shoulder.', 'They slow down. Listening.', 'They look around, then keep walking, a little faster.']));
    } else if (e.suspicion >= 60 && Math.random() < 0.3) {
      say('them', oneOf(['They glance back again.', 'Their head turns, just slightly.']));
    }
    return impacts;
  }

  // ---------- Violence: pepper spray in the face, then the fight ----------
  if (e.stage === 'violence' && id === 'spray-ambush') {
    if (!inv) return impacts;
    // (One that's to hand first; one in a bag takes digging for.)
    const cans = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => x.spray && (x.doses ?? 3) > 0);
    const near = cans.find(({ i }) => !(e.bagged ?? []).includes(i) && !(e.ankle ?? []).includes(i)) ?? cans[0];
    if (!near) return impacts;
    if (!near.x.hand && !freeHand(inv, enc.you?.broken)) {
      say('info', 'Your hands are full. Put something away first.');
      return impacts;
    }
    if (e.distance === 0) say('you', oneOf(['You cross the street toward them.', 'You step off the curb and close in.', 'You cross over, straight at them.']));
    e.stage = 'combat';
    e.facedYou = true;
    if ((e.bagged ?? []).includes(near.i) || (e.ankle ?? []).includes(near.i)) {
      // They see you coming while you dig for it.
      (e.drawn ??= []).push(near.i);
      say('you', (e.ankle ?? []).includes(near.i) ? `You crouch for the ${lc(near.x.name)} at your ankle. They see it.` : `You dig the ${lc(near.x.name)} out of your bag. They see it.`);
    } else spray(near.i, inv);
    say('info', oneOf(['The fight is on.', 'No going back now.', 'Here it comes.']));
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
  // (In a wheelchair: no sneaking up, no taking them off their feet. You just go at them.)
  if (e.stage === 'violence' && id === 'go-at') {
    if (!e.them.down) return impacts;
    e.facedYou = true;
    say('you', 'You walk straight up to them. In the chair, they’ve got nowhere to go.');
    if (!e.them.out) say('them', oneOf(['They try to wheel back, and get nowhere. "Get away from me!"', 'They grip the wheels and freeze. "Please. Don’t."']));
    e.stage = 'combat';
    e.distance = 2;
    scare(15);
    return impacts;
  }
  if (e.stage === 'violence') {
    const b = BUILDS[p.build];
    const lvl = id === 'kneecap' ? styleLevel(stats, 'kicks') : id === 'slam' ? styleLevel(stats, 'clinch') : id === 'rear-choke' ? styleLevel(stats, 'locks') : (stats.unarmed?.level ?? 1);
    if ((id === 'kneecap' && lvl < KNEE_AMBUSH_LEVEL) || (id === 'slam' && lvl < SLAM_AMBUSH_LEVEL) || (id === 'rear-choke' && (lvl < CHOKE_AMBUSH_LEVEL || e.distance < 2))) return impacts;
    // (Someone already on the ground, in a wheelchair: none of the ways to take someone off their feet.)
    if (e.them.down && ['bumrush', 'sucker', 'shove', 'kneecap', 'slam', 'rear-choke'].includes(id)) return impacts;
    // (Facing you, or watching for you: there's no getting behind them.)
    if ((id === 'kneecap' || id === 'rear-choke') && e.suspicion >= 75) return impacts;
    // Lands more often the sneakier you are, the less aware they are, and the
    // closer you got first. Bum rush and shove are easier to land than a punch.
    const extra = id === 'shove' ? 0.12 : id === 'bumrush' ? 0.06 : id === 'kneecap' ? 0.04 : id === 'slam' ? -0.02 : id === 'rear-choke' ? -0.08 : 0;
    // (Broken arms, a broken leg for the kick, worn out or shaking: it shows.)
    const yb = e.you;
    const hurt = (id === 'kneecap' ? legs(yb) * 0.25 : arms(yb) * 0.2) + (yb.shakes ?? 0);
    const chance = clamp([0.8, 0.65, 0.45, 0.3][aw] + e.distance * 0.06 + ambushBonus(stats) + extra - hurt - b.guard * 0.5 - (e.suspicion / 100) * 0.4, 0.05, 0.97);
    if (e.distance === 0) say('you', oneOf(['You cross the street toward them.', 'You step off the curb and close in.', 'You cross over, straight at them.']));
    e.stage = 'combat';
    spend('you', COST.ambush);
    you.gain('sneak', 4);
    let theyGoFirst = false;
    const at = AMBUSH_TEXT[id] ? practise(id) : 1;
    const amb = (k: string) => {
      // (Your arms: a shove with the one you've got, a shoulder with none; a choke needs an arm round the throat.)
      const n = arms(e.you);
      if (n && k === 'shove') return n >= 2 ? 'You throw your shoulder into them.' : 'You shove them hard with your good arm.';
      if (n >= 2 && k === 'slam') return 'You drive your shoulder into their back and slam them into the wall.';
      if (n && k === 'rear-choke') return 'You hook your good arm around their throat from behind and hang on.';
      return vary(AMBUSH_TEXT[k][at]);
    };

    if (Math.random() < chance) {
      // It lands.
      you.gain('sneak', 4);
      you.gain('unarmed', 3);
      you.style(styleOfId({ id }), 4);
      you.gain('strength', 1);
      const str = damageMult(stats);
      if (id === 'kneecap') {
        const dmg = Math.round(roll(8, 13) * str);
        const goes = Math.random() < (b.solid ? 0.5 : 0.8);
        let w = wound('them', 'leg', dmg, 'kick');
        // Going down: no limping a step first.
        if (goes || e.them.down) w = w.replace(/[^.]*\b(?:limp|stumble|nearly gives out|hop back|knee buckles|leg folds)[^.]*\.\s?/gi, '').trim();
        say('you', [amb('kneecap'), w].filter(Boolean).join(' '));
        if (!e.them.down && goes) {
          e.them.down = true;
          say('them', 'Their leg folds, and they go down.');
        }
      } else if (id === 'slam') {
        const dmg = Math.round(roll(15, 23) * str);
        say('you', `${e.suspicion >= 75 ? vary(['You grab them by the collar and drive their face into the wall.', 'They see you coming, but you get a hand on their neck and slam their face into the wall.']) : amb('slam')} ${wound('them', 'head', dmg, 'punch')}`);
        if (!e.them.out && !e.them.dazed) {
          e.them.dazed = 2;
          say('them', "They're dazed.");
        }
        if (!e.them.down && !e.them.out && Math.random() < 0.5) {
          e.them.down = true;
          say('them', 'They slide down the wall to the sidewalk.');
        }
      } else if (id === 'rear-choke') {
        e.them.stamina = Math.max(0, e.them.stamina - 60);
        if (Math.random() < 0.5 + (lvl - CHOKE_AMBUSH_LEVEL) * 0.01 - arms(e.you) * 0.2) {
          e.them.out = true;
          e.them.down = true;
          e.them.awake = -8; // choked out: back in seconds
          say('you', `${amb('rear-choke')} They kick, and claw at you, and then they sag. Out cold, and not a drop of blood.`);
        } else {
          e.them.down = true;
          say('you', 'You lock an arm around their throat from behind and drag them down. They tear free, choking, on the floor.');
        }
        scare(15);
      } else if (id === 'sucker') {
        const dmg = Math.round(roll(16, 24) * (aw === 0 ? 1.3 : 1) * str);
        say('you', `${e.suspicion >= 75 ? vary(['You step in fast and swing before they can get their hands up.', 'They see it coming, but not soon enough: your fist catches the side of their head.']) : amb('sucker')} ${wound('them', 'head', dmg, 'punch')}`);
      } else if (id === 'bumrush') {
        const dmg = Math.round(roll(10, 15) * str);
        if (!b.solid) {
          e.them.down = true;
          const fell = wound('them', 'body', dmg, 'fall');
          say('you', `${amb('bumrush')} It takes them clean off their feet. ${fell}`);
        } else {
          // (They stay up: a shoulder in the ribs, not a fall.)
          say('you', `${amb('bumrush')} They're heavy and hold their ground. ${unmoved(wound('them', 'body', dmg, 'punch'))}`);
          if (Math.random() < 0.35) {
            e.you.down = true;
            say('them', 'You bounce off them and land on your back.');
          } else say('them', 'You bounce off them.');
        }
      } else {
        const dmg = Math.round(roll(4, 8) * str);
        // (The wall first; the floor only if they go down.)
        const w = unmoved(wound('them', 'body', dmg, 'punch')).replace(/[^.]*\bthud\b[^.]*\.\s?/gi, '');
        say('you', `${amb('shove')} They crash back into the wall. ${w}`);
        if (!e.them.down && Math.random() < 0.7) {
          e.them.down = true;
          say('them', 'They lose their footing and go down.');
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
      say('info', oneOf(['The fight is on.', 'No going back now.', 'Here it comes.']));
      if (theyGoFirst) theirTurn();
      endOfRound();
    }
    return impacts;
  }

  // ---------- They're running: after them, or let them go ----------
  if (e.chase && e.stage === 'combat') {
    if (id === 'let-go') {
      const c = e.chase;
      delete e.chase;
      e.chaseEnd = oneOf(['You let them go.', 'You stop and watch them go.', 'Not worth it. You let them run.']);
      say('you', e.chaseEnd);
      // (Your choice: you didn't lose them, you stopped.)
      end(c.result === 'lost-them' ? 'left' : c.result);
      return impacts;
    }
    if (id !== 'chase' || legs(e.you)) return impacts;
    const fought = e.fought;
    e.chased = true;
    if (e.you.blinded > 0) e.you.blinded--;
    chaseStep();
    // (No getting your breath back while you're running flat out.)
    const wind = [e.you.stamina, e.them.stamina];
    endOfRound();
    [e.you.stamina, e.them.stamina] = [Math.min(e.you.stamina, wind[0]), Math.min(e.them.stamina, wind[1])];
    e.fought = fought;
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
    if (e.them.yielded && (id === 'punch' || id === 'kick' || id.startsWith('stomp') || id.startsWith('wpn:') || id.startsWith('whip:') || id.startsWith('tech:') || id.startsWith('floor:'))) {
      // Hitting them anyway: it's a fight again (they didn't see it coming).
      e.them.yielded = false;
      e.them.offBalance = true;
      scare(8);
    }
    const tech = ALL_MOVES().find((t) => t.id === id);
    if (tech && tech.level > styleLevel(stats, tech.style)) return impacts;
    if (tech && brokenAlready(e.them, tech)) return impacts;
    // Each kind of move only where it makes sense.
    if (tech && GROUND.includes(tech) && (!e.them.down || y.down)) return impacts;
    if (tech && FLOOR.includes(tech) && (!y.down || e.them.down)) return impacts;
    if (tech && TECHNIQUES.includes(tech) && (y.down || e.them.down)) return impacts;
    switch (id) {
      case 'punch':
        strike('you', 'punch');
        break;
      case 'choke':
        if (!e.them.down || e.them.out || y.down || styleLevel(stats, 'locks') < CHOKE_LEVEL) return impacts;
        choke();
        break;
      case 'kick':
        strike('you', 'kick');
        break;
      default:
        if (tech) {
          if (e.them.down && tech.effect === 'sweep') return impacts;
          strike('you', tech.kind, undefined, tech);
        } else if ((id.startsWith('draw:') || id.startsWith('stow:')) && inv) {
          const it = inv.items[Number(id.slice(5))];
          if (!it || it.kind !== 'weapon') return impacts;
          if (id.startsWith('stow:')) {
            delete it.hand;
            say('you', `You put the ${lc(it.name)} away.`);
          } else {
            const hnd = freeHand(inv, enc.you?.broken);
            if (!hnd) {
              say('info', 'Your hands are full.');
              return impacts;
            }
            it.hand = hnd;
            const bagged = (e.bagged ?? []).includes(Number(id.slice(5)));
            const ankle = (e.ankle ?? []).includes(Number(id.slice(5)));
            say('you', ankle ? `You crouch and pull the ${lc(it.name)} from the sheath at your ankle.` : bagged ? `You dig the ${lc(it.name)} out of your bag${hnd === 'left' ? ' with your left hand' : ''}.` : `You take out the ${lc(it.name)}${hnd === 'left' ? ' in your left hand' : ''}.`);
            // A folding knife: open it on the way out.
            const kn = knifeOf(it.name);
            if (kn && !bagged) openKnife(kn);
            scare(10);
          }
        } else if (id.startsWith('reload:') && inv) {
          reloadGun(inv, Number(id.slice(7)));
        } else if (id.startsWith('whip:') && inv) {
          const it = inv.items[Number(id.slice(5))];
          if (!it || !gunOf(it.name)) return impacts;
          if (!it.hand) {
            const hnd = freeHand(inv, enc.you?.broken);
            if (!hnd) {
              say('info', 'Your hands are full. Put something away first.');
              return impacts;
            }
            it.hand = hnd;
            if ((e.bagged ?? []).includes(Number(id.slice(5)))) {
              say('you', `You dig the ${lc(it.name)} out of your bag.`);
              break;
            }
          }
          strike('you', 'weapon', undefined, undefined, { name: it.name, weapon: it.weapon, cuts: false });
        } else if (id.startsWith('smash:') && inv) {
          smashBottle(inv, Number(id.slice(6)));
        } else if (id.startsWith('wpn:') && inv) {
          // Something from your pockets: a blade, a bottle, pepper spray.
          const it = inv.items[Number(id.slice(4))];
          if (!it || it.kind !== 'weapon') return impacts;
          // In your bag: getting it out takes the turn.
          const wi = Number(id.slice(4));
          if (!it.hand && !freeHand(inv, enc.you?.broken)) {
            say('info', `Your hands are full. Put something away first.`);
            return impacts;
          }
          if (!it.hand && (e.bagged ?? []).includes(wi) && !(it.spray && (e.drawn ?? []).includes(wi))) {
            // (A can of spray stays in your fist only as long as you're using it.)
            if (it.spray) (e.drawn ??= []).push(wi);
            else it.hand = freeHand(inv, enc.you?.broken) ?? undefined;
            say('you', (e.ankle ?? []).includes(wi) ? `You crouch and pull the ${lc(it.name)} from the sheath at your ankle.` : `You dig the ${lc(it.name)} out of your bag.`);
            break;
          }
          // Using it: it's in your hand now.
          if (!it.hand && !it.spray) it.hand = freeHand(inv, enc.you?.broken) ?? undefined;
          if (gunOf(it.name)) shoot(it);
          else if (it.spray) spray(Number(id.slice(4)), inv);
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
          const fell = wound('them', 'body', dmg, 'fall');
          say('you', `${arms(y) >= 2 ? 'You throw your weight into them, and you both go down.' : arms(y) ? 'You hook an arm around them and drag them down, falling half on top of them.' : novice() ? 'You grab hold of them and drag them down, falling half on top of them.' : 'You get hold of them and throw them down.'} ${fell}`);
          you.gain('strength', 3);
          you.gain('agility', 2);
          you.gain('unarmed', 3);
          you.style('clinch', 3);
        } else say('you', b.solid ? "You grab them, but they're too strong. They shake you off." : 'They twist out of your grip.');
        break;
      }
      case 'run':
        spend('you', COST.run);
        // (Someone on the floor can't chase you: only your own legs can stop you.)
        if ((e.them.down && !legs(y)) || Math.random() < fleeChance(y, e.them, accuracyBonus(stats))) {
          say('you', legs(y) ? 'You limp away as fast as you can, and somehow lose them.' : e.them.down ? (e.resident ? 'You leave them on the floor and run, out the door and up the road.' : 'You leave them on the ground and run.') : e.resident ? oneOf(['You break away and run, out the door and up the road, and don\'t look back.', 'You run, out the back and over the fence. Nobody follows.']) : oneOf(['You break away and run, and don\'t look back until they\'re gone.', 'You run, and duck down a side street. They don\'t follow.', 'You break away and run. You lose them a block later.']));
          you.gain('agility', 3);
          you.gain('stamina', 2);
          end('you-fled');
          return impacts;
        }
        say('you', e.them.down ? "You try to run, but your leg won't take it. You don't get far." : legs(y) ? "You try to run, but your leg won't take it. They're on you." : "You try to run, but they're on you.");
        // (Trying is running too.)
        you.gain('agility', 1);
        you.gain('stamina', 1);
        break;
      case 'getup':
        spend('you', COST.getUp);
        if (Math.random() < getUpChance(y)) {
          y.down = false;
          say('you', 'You get back on your feet.');
        } else say('you', legs(y) >= 2 ? 'You try to stand. Neither leg will take your weight.' : legs(y) ? 'You try to stand, but your leg gives way.' : 'You try to get up, and fall back down.');
        break;
      case 'walk': {
        if (!e.them.out) break;
        say('you', e.resident ? (y.down ? 'You drag yourself away from them across the floor, and haul yourself up by the doorframe.' : 'You leave them lying there, and go back to the rest of the house.') : y.down ? (legs(y) >= 2 ? 'You drag yourself away along the sidewalk on your elbows, leaving them where they lie.' : 'You crawl away, and drag yourself up further off, leaving them where they lie.') : 'You leave them lying there and walk off' + (partOfDay() === 'night' ? ' into the dark.' : '.'));
        end('walked');
        return impacts;
      }
      case 'breathe':
        // (Broken ribs: you can't fill your lungs, whatever you do.)
        y.stamina = Math.min(staminaCap(y), y.stamina + 22);
        say('you', y.down ? 'You stay down and catch your breath.' : oneOf(['You back off a step and catch your breath.', 'You step back and suck in air.', 'You give yourself a second to breathe.', 'You keep your distance and get your wind back.']));
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
function strike(a: Side, kind: 'punch' | 'kick' | 'weapon' | 'stomp', aim?: Loc, tech?: Technique, mine?: { name: string; weapon?: number; cuts?: boolean; hand?: 'left' | 'right' }): boolean {
  const d: Side = a === 'you' ? 'them' : 'you';
  const A = enc[a];
  const D = enc[d];
  const brokenBefore = [...D.broken];
  const N = names(a);
  const b = BUILDS[enc.person.build];
  // Theirs (the one they pulled), or yours (from your pockets).
  const weapon = kind !== 'weapon' ? undefined : a === 'you' ? mine : enc.person.carrying.find((i) => i.name === enc.them.weaponOut);
  const tired = A.stamina < A.maxStamina * 0.25;
  const downBefore = D.down;
  // A knife: which one (how it opens, how it cuts).
  const kn = weapon ? knifeOf(weapon.name) : undefined;
  if (a === 'you' && kn && weapon && !openKnife(kn)) return false;
  cutBleed = kn ? kn.bleed : 0.35;
  cutStyle = kn ? kn.style : 'both';
  // How practiced you are at this one (it reads that way).
  const wkind = weapon ? (/^bottle$/i.test(weapon.name) ? 'bottle' : /broken bottle/i.test(weapon.name) ? 'broken' : /syringe/i.test(weapon.name) ? 'needle' : weapon.cuts ? 'blade' : 'blunt') : null;
  const practised: Tier = a !== 'you' ? 1 : tech ? practise(tech.id) : wkind ? practise(`wpn:${wkind}`, 'weapons') : practise(kind);
  // (From the floor there's no footwork to show: it reads plain.)
  const t: Tier = A.down ? 1 : practised;
  spend(a, tech ? tech.cost : kind === 'kick' || kind === 'stomp' ? COST.kick : kind === 'weapon' ? COST.weapon : COST.punch);

  // Will it land?
  let hit = (kind === 'punch' ? 0.8 : kind === 'kick' ? 0.66 : kind === 'stomp' ? 0.72 : 0.75) + (tech?.hit ?? 0) + (kn?.hit ?? 0) + (a === 'you' && weapon ? weaponAccuracy(you.stats) : 0);
  hit += a === 'you' ? accuracyBonus(you.stats) - stressPenalty(A) : 0;
  // Your weaker hand: clumsier with it.
  const offHand = a === 'you' && kind === 'weapon' && mine?.hand === 'left';
  if (offHand) hit -= 0.1;
  hit -= d === 'you' ? dodgeBonus(you.stats) - stressPenalty(D) : b.guard;
  // (On painkillers, a broken limb gets in your way less.)
  const hamper = A.numb ? 0.1 : 0.2;
  if (kind === 'kick' || kind === 'stomp') hit -= legs(A) * hamper;
  else hit -= arms(A) * hamper; // punches and weapons need your arms
  if (A.dazed) hit -= 0.2;
  if (A.concussed) hit -= 0.1;
  if (A.blinded > 0) hit -= 0.35;
  if (A.shakes) hit -= A.shakes;
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
    if (a === 'you' && tech && LOCKS.has(tech.id)) {
      say(a, vary(['They jerk free before you can lock it in.', 'You grab for it, and they tear loose.', "You can't get a grip on them.", 'They twist, and it slips out of your hands.']));
    } else if (a === 'you' && tech && D.down && tech.kind === 'stomp') {
      say(a, vary(['They roll, and your knee hits the sidewalk.', 'They twist out from under it.']));
    } else if (a === 'you' && A.down && kind !== 'stomp') {
      say(a, oneOf(['From the floor, you miss.', 'You lash out from the floor and catch nothing.', 'You swing up at them from your back and hit nothing.', "You kick out from the ground; they're not there."]));
    } else if (a === 'you' && D.down && kind === 'punch') {
      say(a, oneOf(['They twist away on the ground, and you miss.', 'They roll, and your fist hits the sidewalk.']));
    } else if (d === 'you' && D.down && kind !== 'stomp') {
      say(a, A.down ? oneOf([`${N.S} lash out at you across the sidewalk and miss.`, 'You roll, and it misses.']) : oneOf([`${N.S} swing down at you and miss.`, 'You roll, and it misses.']));
    } else if (a === 'you' && t !== 1 && kind !== 'kick') {
      const ms = missText(t, tech ? 'tech' : kind);
      say(a, vary(D.down ? ms.filter((x) => !/step back|slip (it|the punch)|read it/.test(x)).concat(['You miss.']) : ms));
    } else if (tech) {
      say(a, oneOf(['They see it coming and twist away.', 'They jerk back, and it misses.', 'You miss.']));
    } else if (kind === 'stomp') {
      say(a, `${N.S} stomp down, but ${N.oSub} roll away from it.`);
    } else if (kind === 'kick') {
      say(a, a === 'you' && t !== 1 ? `${vary(missText(t, 'kick'))} ${t === 0 ? 'You lose your balance.' : "You're left a step off balance."}` : vary([`${N.S} miss the kick and lose ${N.p} balance.`, `${N.S} kick and miss by a mile, and stumble with it.`, `${N.S} kick out and catch only air.`, `${N.S} kick, and ${N.oSub} step out of it.`]));
      A.offBalance = true;
      if (!A.down && Math.random() < 0.15) {
        A.down = true;
        say(a, `${N.S} slip and go down.`);
      }
    } else if (d === 'you') {
      say(a, A.down ? oneOf(['They swing up at you from the ground and miss.', 'They grab at your legs and miss.']) : vary(['They swing and miss.', 'You duck their swing.', 'They lunge. You step aside.', 'Their fist goes past your ear.', 'They swing wide, off balance.', 'You lean back, and it misses by an inch.']));
    } else if (kind === 'weapon') {
      say(a, oneOf(['You swing and miss.', 'They jerk back out of reach.', 'It catches nothing but air.']));
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
  if (offHand) dmg *= 0.85;
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
    // (An arm broken: the version the arm you've got can do.)
    text = arms(A) && ONE_ARM[tech.id] ? ONE_ARM[tech.id] : vary(t === 1 || !TECH_TEXT[tech.id] ? [tech.text, ...(TECH_ALT[tech.id] ?? [])] : TECH_TEXT[tech.id][t === 0 ? 0 : 1]);
    if (arms(A) >= 2 && tech.id === 'tech:headbutt') text = vary(['You smash your forehead forward, eyes shut.', 'Short and vicious: the top of your head, into their face.', 'You lunge in and smash your forehead into their face.']);
  } else if (a === 'you' && wkind) {
    // (Someone on the ground can't be stepped around or met coming in.)
    const lines = weaponText(t, wkind, lc(weapon!.name), where, into, cutStyle);
    const lying = D.down ? lines.filter((x) => !/step off the line|let them come|back out of reach|A feint/.test(x)) : lines;
    text = vary(lying.length ? lying : lines);
  } else if (a === 'you' && stomp) {
    text = vary(stompText(t, loc === 'head' ? 'head' : loc === 'stomach' ? 'stomach' : 'body'));
  } else if (a === 'you' && !A.down && D.down && !D.out && kind === 'punch' && !tech) {
    // They're on the ground and you're not: you bend down to it.
    text = vary([`You crouch over them and punch them ${where}.`, `You bend down and hit them ${where}.`, `You drop a fist ${into}.`]);
  } else if (a === 'you' && A.down && (kind === 'kick' || kind === 'punch')) {
    // On your back: no footwork, just whatever you can reach.
    text = kind === 'kick'
      ? D.out
        ? vary([`Still on the ground, you kick them ${where}.`, `You lash a heel out and it thumps into them ${where}.`])
        : vary([`From the floor, you kick out and catch them ${where}.`, `You drive a heel up from the ground; it lands ${where}.`])
      : D.out
        ? vary([`You drag yourself over and hit them ${where}.`, `Still on the ground, you punch them ${where}.`])
        : vary([`From the floor, you punch up and catch them ${where}.`, `You lash out from the ground and hit them ${where}.`]);
  } else if (a === 'you' && kind === 'kick') {
    text = vary(kickText(t, where, into));
  } else if (a === 'you' && (loc !== 'arm' || D.out)) {
    // (Out cold, nobody covers up.)
    text = vary(canThrow(punchText(t, where, into)));
  } else if (tech) {
    text = tech.text;
  } else if (kind === 'weapon' && weapon) {
    const w = lc(weapon.name);
    text = /^bottle$/i.test(weapon.name)
      ? vary([`${N.S} swing the bottle at ${N.o} and it thumps ${N.o} ${where}.`, `${N.S} club ${N.o} with the bottle, ${where}.`, `${N.S} swing the bottle hard; it catches ${N.o} ${where}.`])
      : /broken bottle/i.test(weapon.name)
      ? vary([`${N.S} jab the broken bottle at ${N.o} and the glass catches ${N.o} ${where}.`, `${N.S} slash at ${N.o} with the jagged neck, ${where}.`, `${N.S} twist the broken bottle ${into}.`])
      : weapon.cuts
      ? /syringe/i.test(weapon.name)
          ? vary([`${N.S} jab the syringe at ${N.o} and stick ${N.o} ${where}.`, `${N.S} stab the needle ${into}.`])
          : cutStyle === 'stab'
            ? vary([`${N.S} stab at ${N.o} with the ${w} and it goes ${into}.`, `${N.S} drive the ${w} ${into}.`, `${N.S} lunge with the ${w} and stick ${N.o} ${where}.`])
            : vary([`${N.S} slash at ${N.o} with the ${w} and catch ${N.o} ${where}.`, `The ${w} flashes, and catches ${N.o} ${where}.`, `${N.S} cut at ${N.o} with the ${w}, ${where}.`, `${N.S} lunge with the ${w} and open ${N.o} up ${where}.`])
      : vary([`${N.S} hit ${N.o} with the ${w} ${where}.`, `${N.S} swing the ${w} ${into}.`]);
  } else if (stomp) {
    text =
      loc === 'head'
        ? vary([`${N.S} stomp on ${N.oP} head.`, `${N.S} bring ${N.p} heel down on ${N.oP} head.`, `${N.S} stomp down on ${N.oP} face.`])
        : loc === 'stomach'
          ? vary([`${N.S} stomp down on ${N.oP} stomach.`, `${N.S} drive ${N.p} heel into ${N.oP} gut.`])
          : vary([`${N.S} stomp down on ${N.oP} ribs.`, `${N.S} drop ${N.p} heel into ${N.oP} side.`, `${N.S} stomp on ${N.oP} chest.`]);
  } else if (kind === 'kick') {
    text = vary([`${N.S} kick ${N.o} ${where}.`, `${N.S} drive ${N.S === 'They' && enc.resident?.how === 'woke' ? 'a bare heel' : 'a boot'} ${into}.`, `${N.S} plant a kick ${where}.`, `${N.S} catch ${N.o} with a kick ${where}.`]);
  } else {
    text =
      loc === 'arm'
        ? vary([`${N.S} hit ${N.o} on the arm as ${N.oSub} cover up.`, `${N.S} catch ${N.o} on the forearm as ${N.oSub} block.`, `${N.oSubCap} get an arm up; ${N.S.toLowerCase()} hit it anyway.`])
        : vary([`${N.S} punch ${N.o} ${where}.`, `${N.S} catch ${N.o} ${where} with a right.`, `${N.S} tag ${N.o} ${where}.`, `${N.S} hit ${N.o} ${where}.`, `${N.S} drive a punch ${into}.`, `A left from ${a === 'you' ? 'you' : 'them'} catches ${N.o} ${where}.`]);
  }
  // (A needle punctures; it doesn't slice.)
  const how = tech && LOCKS.has(tech.id) ? 'lock' : weapon && /syringe/i.test(weapon.name) ? 'jab' : weapon?.cuts && !/^bottle$/i.test(weapon.name) ? 'cut' : stomp ? 'stomp' : kind === 'kick' ? 'kick' : 'punch';
  const scarsBefore = enc[d].marks?.scars?.length ?? 0;
  let after = wound(d, loc, dmg, how);
  // (A cut to the body is opened where the blow was said to land: not "in the chest. It nicks your side.")
  // (A blade opens skin over the ribs, not the ribs: that's "side".)
  const spot = how === 'cut' && loc === 'body' && /\bchest\b/.test(text) ? 'chest' : undefined;
  if (spot) {
    after = after.replace(/\b(your|their) side\b/g, `$1 ${spot}`);
    // (And the scar is where the cut was.)
    const sc = enc[d].marks?.scars;
    if (sc) for (let i = scarsBefore; i < sc.length; i++) if (sc[i] === 'side') sc[i] = spot;
  }
  say(a, after ? `${text} ${after}` : text);
  // No guard on it: a hard stab and your hand slides down onto the blade.
  if (a === 'you' && kn?.noGuard && (loc === 'body' || loc === 'stomach') && Math.random() < 0.07) {
    enc.you.bleeding = Math.max(enc.you.bleeding, 1);
    say('info', `Your hand slides down the handle onto the blade. You've cut your own fingers. You're bleeding (light).`);
  }
  if (a === 'you') {
    // Landing blows: it's fighting that teaches you to fight (and builds a little muscle).
    if (weapon) you.gain('weapons', 4);
    else {
      you.gain('unarmed', tech ? 4 : 3);
      // (And the style it was: its own moves are what teach it.)
      you.style(tech?.style ?? (kind === 'kick' ? 'kicks' : kind === 'stomp' ? 'ground' : 'strikes'), tech ? 5 : 4);
    }
    you.gain('strength', 1);
    you.gain('agility', 2);
    if (tech) techEffect(tech, D.broken.filter((x) => !brokenBefore.includes(x)));
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

/**
 * Firing the gun. Close up, under stress, people still miss. A hit is a
 * gunshot wound: heavy, fast bleeding, shock, sometimes a broken bone, and
 * to the head, usually the end. Every shot is loud.
 */
function shoot(it: { name: string; doses?: number }) {
  const g = gunOf(it.name)!;
  const T = enc.them;
  const y = enc.you;
  /** Already on the ground (or out): nobody "drops where they stand". */
  const wasDownShot = T.down || T.out;
  landed = null;
  if (!it.doses) {
    say('you', 'You pull the trigger. Click. It’s empty.');
    return;
  }
  it.doses--;
  const first = !enc.shots;
  enc.shots = (enc.shots ?? 0) + 1;
  addStress(y, 10);
  scare(45);
  you.gain('weapons', 4);
  const bang = g.power > 1.5 ? 'The shotgun goes off with a boom that rolls down the street.' : first ? 'The gun goes off, deafening between the buildings.' : 'Another shot cracks off the walls.';
  const hit = T.out || T.dead ? 0.97 : clamp(g.acc + weaponAccuracy(you.stats) - stressPenalty(y) - arms(y) * 0.15 - (y.shakes ?? 0) - (y.dazed ? 0.2 : 0) - (y.blinded > 0 ? 0.35 : 0) - (y.drunk ?? 0) / 300 + (T.down ? 0.1 : 0), 0.08, 0.95);
  if (Math.random() >= hit) {
    say('you', `${bang} ${oneOf(['The shot goes wide. Somewhere glass breaks.', 'You miss. The bullet whines off the wall behind them.', 'It goes past them. Your ears are ringing.'])}`);
    return;
  }
  const loc = pick<Loc>(g.power > 1.5 ? [['body', 5], ['stomach', 2], ['arm', 2], ['leg', 2], ['head', 1.5]] : [['body', 4.5], ['stomach', 2], ['arm', 1.5], ['leg', 1.2], ['head', 0.8]]);
  const where = { head: 'in the head', body: 'in the chest', stomach: 'in the stomach', arm: 'in the arm', leg: 'in the leg' }[loc];
  landed = 'them';
  const pw = g.power;
  let text = `${bang} It hits them ${where}.`;
  let ml = 0;
  if (loc === 'head') {
    if (Math.random() < (pw > 1.5 ? 0.92 : 0.7)) {
      ml = Math.round(T.blood * 0.25);
      T.blood = Math.max(0, T.blood - ml);
      T.dead = true;
      T.out = true;
      T.down = true;
      T.bleeding = 0;
      say('you', !wasDownShot ? `${text} They drop where they stand and don't move again. There's a lot of blood. They're dead.` : `${text} Their body jerks once, and then nothing. There's a lot of blood. They're dead.`);
      impacts.push({ target: 'them', ml, severe: true, loc, spill: 'splash' });
      end('killed');
      return;
    }
    T.bleeding = 4;
    T.out = true;
    T.down = true;
    T.awake = Math.min(T.awake, -80);
    ml = Math.round(T.maxBlood * 0.12);
    text += wasDownShot ? ' It glances off their skull, and the blood comes fast.' : ' It glances off their skull. They drop, out cold, and the blood comes fast.';
  } else if (loc === 'body' || loc === 'stomach') {
    ml = Math.round(T.maxBlood * (0.1 + Math.random() * 0.1) * pw);
    T.bleeding = Math.min(4, Math.max(T.bleeding, pw > 1.5 ? 4 : 3));
    T.awake = Math.min(T.awake, Math.max(-40, T.awake - 45 * pw));
    if (loc === 'body' && !T.lung && Math.random() < 0.4) {
      T.lung = true;
      text += ' They make a wet, sucking sound with every breath: it’s gone into a lung.';
    } else text += loc === 'stomach' ? ' They fold over it, and blood comes through their fingers.' : ' Blood spreads through their shirt.';
    if (!T.down && Math.random() < 0.7) {
      T.down = true;
      text += ' They go down hard.';
    }
  } else {
    ml = Math.round(T.maxBlood * (0.05 + Math.random() * 0.05) * pw);
    T.bleeding = Math.min(4, Math.max(T.bleeding, pw > 1.5 ? 3 : 2));
    T.awake = Math.min(T.awake, Math.max(-20, T.awake - 20 * pw));
    const part = `${Math.random() < 0.5 ? 'left' : 'right'} ${loc}` as Part;
    if (!T.broken.includes(part) && Math.random() < 0.4 * pw) {
      T.broken.push(part);
      text += ` The bone goes: their ${part} is broken.`;
    }
    text += ' The blood comes in spurts.';
    if (loc === 'leg' && !T.down) {
      T.down = true;
      text += ' Their leg goes out from under them.';
    }
  }
  T.blood = Math.max(0, T.blood - ml);
  if (!T.out && T.awake <= 0) {
    T.out = true;
    T.down = true;
    text += " They're out.";
  }
  say('you', `${text} (−${ml}\u00a0ml)`);
  impacts.push({ target: 'them', ml, severe: true, loc, spill: 'spray' });
}

/** Reloading mid-fight: hands shaking, it takes the turn. */
function reloadGun(inv: Inventory, i: number) {
  const it = inv.items[i];
  const g = gunOf(it?.name);
  if (!it || !g) return;
  const box = inv.items.find((y) => y.name === g.ammo && (y.doses ?? 0) > 0);
  const n = Math.min(g.holds - (it.doses ?? 0), box?.doses ?? 0);
  if (!box || n <= 0) return;
  it.doses = (it.doses ?? 0) + n;
  box.doses = (box.doses ?? 0) - n;
  if (box.doses <= 0) dropItem(inv, inv.items.indexOf(box));
  say('you', g.holds > 6 && g.power < 1.5 ? 'You drop the magazine and thumb rounds into it, fumbling.' : 'You feed rounds in one by one, fumbling.');
}

/**
 * What a blow does to someone who's already unconscious: no gasping,
 * spitting, clutching or curling up (none of that's done on purpose), just
 * what a body does. Rewrites those sentences, and drops the ones that have
 * no unconscious version; if nothing's left but the bare facts, the body
 * jerks with it.
 */
function asUnconscious(text: string, d: Side): string {
  if (d !== 'them') return text;
  const swaps: [RegExp, string][] = [
    [/They gasp, and blood bubbles at their lips\./g, 'Blood bubbles at their lips with every shallow breath.'],
    [/They vomit, and there's blood in it: something inside is torn\./g, 'Vomit and blood run from the corner of their mouth: something inside is torn.'],
    [/They vomit onto the sidewalk\./g, 'Vomit runs from the corner of their mouth onto the sidewalk.'],
    [/They retch up bile and spit\./g, 'Bile trickles from the corner of their mouth.'],
    [/They cough, and it comes up pink\./g, 'Pink froth comes up with their next breath.'],
    [/A tooth comes loose; they spit it out\./g, 'A tooth comes loose and falls from their slack mouth.'],
    [/Teeth go\. They spit them out with a mouthful of blood\./g, 'Teeth go, spilling from their slack mouth with a gush of blood.'],
    [/They spit them out with a mouthful of blood\./g, 'They spill from their slack mouth with a gush of blood.'],
    [/They gasp and clutch their stomach\.\s?/g, ''],
    [/They curl up[^.]*\.\s?/g, ''],
    [/They writhe on the ground\.\s?/g, ''],
    [/They try to cover up, and can't\.\s?/g, ''],
    [/Their eyes water\.\s?/g, ''],
    [/That one connects, and their eyes go blank for a moment\./g, 'That one connects. Their head rocks with it.'],
    [/They taste copper\.\s?/g, ''],
    [/They (?:howl|scream|groan|moan|whimper|sob|wince|flinch)[^.]*\.\s?/g, ''],
    [/(?:It knocks the wind out of them|The wind's knocked out of them)\.\s?/g, 'The air goes out of them.'],
  ];
  let t = text;
  for (const [re, to] of swaps) t = t.replace(re, to);
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || 'Their body jerks with it.';
}

/** Giving up: the whole speech the first time, then just the hands going up again. */
function surrenderLine(down: boolean): string {
  if (enc.yieldedOnce) return vary(down ? ['They curl up again, arms over their head.', '"Stop! Okay! Stop!"'] : ['Their hands go back up.', '"Okay! Okay! I said okay!"', 'They back off, hands up again.']);
  enc.yieldedOnce = true;
  return speak(down ? 'giveUpDown' : 'giveUp');
}
/** Your arms: how many sides you can't use (0, 1, 2), and which side it is when it's one. */
function brokenArmSide(b: Body): 'left' | 'right' | null {
  const sides = (['left', 'right'] as const).filter((sd) => b.broken.some((p) => p === `${sd} arm` || p === `${sd} wrist` || p === `${sd} hand`));
  return sides.length === 1 ? sides[0] : null;
}
/** Your punch lines that the arms you've got can't throw: the broken side by name, a combination with both. */
function canThrow(lines: string[]): string[] {
  const y = enc.you;
  if (!arms(y)) return lines;
  const bad = brokenArmSide(y);
  const ok = lines.filter((x) => !/\bJab, then\b/.test(x) && !(bad && new RegExp(`\\b${bad}\\b`).test(x)));
  return ok.length ? ok : lines;
}
/** A learned move done with one good arm (or none), when the usual line needs both. */
const ONE_ARM: Record<string, string> = {
  'tech:headbutt': 'You lunge in and smash your forehead into their face.',
  'tech:knee': 'You step in and drive your knee up into their ribs.',
  'tech:double': 'You drop low, hook a leg with your good arm and drive through them.',
  'ground:pound': 'You kneel on their chest and punch down into their face with your good hand, again and again.',
  'ground:elbows': 'You lean your weight on them and bring your good elbow down across their face, again and again.',
  'ground:fingers': 'You kneel on their wrist and bend their fingers back.',
  'ground:ankle': 'You trap their foot under your good arm and wrench it sideways.',
  'ground:arm': 'You pin their wrist under your knee and lever the arm back against the elbow.',
  'floor:pull': 'You hook their leg with your good arm and pull.',
};
/** The blade in the blow being struck: how it bleeds them, and stab or slash. */
let cutBleed = 0.35;
let cutStyle: 'stab' | 'slash' | 'both' = 'both';

/**
 * A folding knife has to be open before it's any use. A switchblade or a
 * spring-assisted one opens as you bring it up; a thumb-stud folder too, if
 * you've practised (or it's a fumble, and your turn); a pocket knife or a
 * razor takes two hands and a thumbnail (your turn); a butterfly knife is
 * quick in practised hands and bites clumsy fingers. Once open, it stays
 * open for the fight. True if you can strike with it now.
 */
function openKnife(k: Knife): boolean {
  if (k.open === 'fixed' || (enc.opened ?? []).includes(k.name)) return true;
  const lvl = you.stats.weapons?.level ?? 1;
  const opened = () => (enc.opened ??= []).push(k.name);
  if (k.open === 'auto' || k.open === 'flip') {
    opened();
    say('you', k.open === 'auto' ? 'You press the button and the blade snaps out.' : 'You push the flipper and the blade snaps open.');
    return true;
  }
  if (k.open === 'thumb') {
    opened();
    if (Math.random() < 0.45 + lvl * 0.012) {
      say('you', 'You thumb the blade open on the way up.');
      return true;
    }
    say('you', 'Your thumb slips off the stud. It takes you a moment to get the blade open.');
    return false;
  }
  if (k.open === 'nail') {
    opened();
    say('you', `You dig a thumbnail into the ${k.name === 'Straight razor' ? 'razor' : 'blade'} and pull it open. It takes both hands.`);
    return false;
  }
  // A butterfly knife.
  opened();
  if (lvl >= 25) {
    say('you', 'You flip the butterfly knife open, handles clacking, and it’s in your fist.');
    return true;
  }
  if (Math.random() < 0.3) {
    enc.you.bleeding = Math.max(enc.you.bleeding, 1);
    say('you', "You try to flip the butterfly knife open and the edge bites your fingers. You get it open. You're bleeding (light).");
  } else say('you', 'You fumble the butterfly knife open, handles clacking.');
  return false;
}

/**
 * Breaking your bottle against the wall for an edge. Harder than it looks:
 * glass often just bounces, and sometimes it opens your hand.
 */
function smashBottle(inv: Inventory, i: number) {
  const it = inv.items[i];
  if (!it || it.kind !== 'weapon' || !/^bottle$/i.test(it.name)) return;
  if (!it.hand) {
    const hnd = freeHand(inv, enc.you?.broken);
    if (!hnd) return say('info', 'Your hands are full. Put something away first.');
    it.hand = hnd;
    if ((enc.bagged ?? []).includes(i)) return say('you', 'You dig the bottle out of your bag.');
  }
  spend('you', COST.punch);
  if (Math.random() < 0.5 + (you.stats.strength?.level ?? 1) * 0.004) {
    const booze = (it.doses ?? 0) > 0;
    it.name = 'Broken bottle';
    it.weapon = 6;
    it.cuts = true;
    delete it.drink;
    delete it.doses;
    say('you', `You smash the bottle against the wall. It goes, and you're holding the jagged neck.${booze ? ' What was left in it runs down your wrist.' : ''}`);
    if (Math.random() < 0.15) {
      enc.you.bleeding = Math.max(enc.you.bleeding, 1);
      say('info', "A sliver of glass has opened your palm. You're bleeding (light).");
    }
    you.gain('weapons', 2);
  } else say('you', "You bring the bottle down hard against the wall. It bounces off whole, and your hand rings with it.");
}

/** Your loaded syringe, pushed into them. */
function doseThem(drug: Exclude<import('./person').Drug, 'empty'>) {
  say('you', 'The needle goes in, and you press the plunger. Nothing happens, yet: in a muscle it takes a minute or two.');
  enc.them.dosing = { drug, in: 3 };
}
/** What you put in them, hitting. */
function doseThemNow(drug: Exclude<import('./person').Drug, 'empty'>) {
  const T = enc.them;
  // Already out cold: it only takes them further under.
  if (T.out) {
    if (drug !== 'meth') {
      T.awake = Math.min(T.awake, -70);
      say('them', 'Their breathing slows, and slows.');
    }
    return;
  }
  if (drug === 'meth') {
    T.stamina = Math.min(T.maxStamina, T.stamina + 30);
    scare(-15);
    say('them', enc.chase ? 'Ahead of you they find a burst of speed from somewhere, wild and jerky.' : T.yielded ? 'Their eyes go wide and wild. Their hands won\'t stay still.' : T.down ? 'Their eyes go wide and wild, and they thrash on the ground.' : 'Their eyes go wide and wild. They come at you harder.');
    return;
  }
  if (Math.random() < (drug === 'heroin' ? 0.25 : drug === 'fentanyl' ? 0.55 : 0.6)) {
    const wasDown = T.down;
    T.out = true;
    T.down = true;
    T.awake = -70; // drugged under: they won't come to soon
    if (enc.chase) {
      // (checkEnd says how they fold, ahead of you.)
    } else if (wasDown) say('them', "Their eyes roll up and their head drops back against the sidewalk. They're out.");
    else say('them', drug === 'tranq' ? 'Their legs fold and they slump to the sidewalk, out.' : "Their eyes roll up. They sag to the sidewalk, breathing slow and shallow. They're out.");
  } else {
    T.dazed = 3;
    T.stamina = Math.max(0, T.stamina - 30);
    say('them', enc.chase ? 'Ahead of you they slow, weaving, like they\'re running through water.' : 'They sway, heavy-lidded, slow. They can barely lift their hands.');
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
  y.dosedHigh = true;
  if (drug === 'heroin') {
    y.dazed = 2;
    y.stamina = Math.max(0, y.stamina - 25);
    y.stress = Math.max(0, (y.stress ?? 0) - 15);
    y.high = 'heroin';
    say('info', 'Warmth floods up your arm and through you. Your arms go heavy. Nothing hurts anymore, and nothing matters.');
  } else if (drug === 'fentanyl') {
    y.dazed = 3;
    y.stamina = Math.max(0, y.stamina - 40);
    y.high = 'fentanyl';
    if (Math.random() < 0.2) {
      y.out = true;
      y.drugOut = true;
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
      y.drugOut = true;
      y.high = 'tranq';
      say('info', "Your legs go first. You're on the sidewalk before you know it, and then you're nowhere.");
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
/** The locks: a joint bent until it gives (what it does is in techEffect, not a blow). */
const LOCKS = new Set(['tech:fingers', 'tech:wrist', 'ground:fingers', 'ground:ankle', 'ground:arm', 'ground:neck']);
function wound(d: Side, loc: Loc, dmg: number, how: 'punch' | 'kick' | 'cut' | 'fall' | 'stomp' | 'jab' | 'lock'): string {
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
  // (A needle barely bleeds: it's what's in it that counts.)
  if (how === 'cut') D.blood = Math.max(0, D.blood - ml);
  // (Toughness: a hard head takes it better.)
  const tough = d === 'you' ? 1 - toughnessResist(you.stats) : 1;
  D.awake = Math.max(-120, (D.awake ?? 100) - Math.round((dmg * AWAKE_HIT[loc] * (sharp || how === 'lock' ? 0.3 : how === 'fall' ? 0.6 : 1) * (d === 'you' ? 0.75 : 1) * tough * 100) / D.toughness));
  // Taking a beating is what makes you tough: the worse off you are when it lands, the more it teaches.
  if (d === 'you' && dmg > 0) {
    const worse = 1 + 2 * (1 - D.blood / D.maxBlood) + 1.5 * (1 - Math.max(0, D.awake) / 100) + 0.3 * D.broken.length + (D.down ? 0.5 : 0);
    you.gain('toughness', Math.max(1, Math.round((1 + dmg * 0.15) * worse)));
  }
  // A lock: the pain of it, and nothing else (no blow lands: what it breaks, techEffect says).
  if (how === 'lock') {
    impacts.push({ target: d, ml: 0, severe: false, loc, spill: 'none' });
    return '';
  }
  const out: string[] = [how === 'cut' ? `(−${ml}\u00a0ml)` : ''];
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
    if (!D.out && (D.awake <= 0 || Math.random() < chance * 0.5 * (d === 'you' ? 1 - toughnessResist(you.stats) : 1))) {
      D.out = true;
      D.down = true;
      D.awake = Math.min(D.awake, -20);
      severe = true;
      out.push(`${re} out cold.`);
    }
  };
  const breaks = (part: Part, chance: number) => {
    // A blade opens skin; it doesn't snap bone.
    if (sharp || D.broken.includes(part) || Math.random() >= chance) return false;
    severe = true;
    D.broken.push(part);
    if (d === 'them') scare(12);
    const open = part !== 'nose' && part !== 'ribs' && how === 'stomp' && Math.random() < 0.1;
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
    if (loc === 'head' && D.bleeding > before) D.headBleed = true;
    if (D.bleeding > before) {
      // One line for the blow, at the level it ends on.
      const i = out.findIndex((x) => x.startsWith(`${re} bleeding`));
      if (i >= 0) out.splice(i, 1);
      out.push(`${re} bleeding${bledBefore ? ' worse' : ''} (${BLEEDING[D.bleeding].toLowerCase()}).`);
    }
  };
  const fall = (chance: number) => {
    if (!D.down && Math.random() < chance) {
      D.down = true;
      out.push(`${N.oSubCap} go down.`);
    }
  };

  if (loc === 'head' && !sharp) {
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
      out.push(d === 'you' ? "The wind's knocked out of you." : 'It knocks the wind out of them.');
    }
    if (!sharp) knockOut(D.down && lost > 0.35 ? lost * 0.2 : 0);
  } else if (loc === 'body') {
    if (D.broken.includes('ribs') && (how === 'stomp' || dmg >= 10)) {
      D.stamina = Math.max(0, D.stamina - 15);
      out.push(vary(d === 'you' ? ['Something else in your chest gives.', 'You feel the broken ribs shift.'] : ['Something else in their chest gives.', 'The broken ribs shift under it.']));
      // A broken rib driven into the lung.
      if (!D.lung && Math.random() < (how === 'stomp' ? 0.25 : 0.1)) {
        D.lung = true;
        severe = true;
        D.stamina = Math.min(D.stamina, staminaCap(D));
        out.push(`The broken rib punctures ${N.oP} lung. ${d === 'you' ? 'You' : 'They'} gasp, and blood bubbles at ${N.oP} lips.`);
        spills('cough');
        bleed(1);
      }
      // Winded and down, not out, unless they've already lost a lot of blood.
      knockOut(lost > 0.35 ? lost * 0.35 : 0);
    } else if (breaks('ribs', (dmg - (how === 'stomp' ? 6 : 9)) * (how === 'stomp' ? 0.06 : 0.04))) {
      D.stamina = Math.min(D.stamina, staminaCap(D));
      out.push(`${d === 'you' ? 'Your' : 'Their'} breath goes short and ragged.`);
    }
  } else if (loc === 'arm') {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    breaks(`${side} arm` as Part, (dmg - 9) * 0.05);
  } else {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    // A leg takes a kick or a stamp to the knee or shin to break, not a punch.
    if ((how === 'kick' || how === 'stomp') && breaks(`${side} leg` as Part, (dmg - 9) * 0.03)) fall(1);
    else fall(dmg >= 10 ? 0.25 : 0.08);
  }
  if (openBreak) bleed(1);
  // (How badly depends on the blade: teeth and razors tear; a point punctures.)
  if (how === 'cut') bleed(Math.random() < 0.15 + cutBleed * 0.6 ? 2 : 1);
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
  // (Out cold with this very blow: it hit someone awake, but they don't react to it after.)
  if (g && D.out && !outAtStart) {
    const i = out.indexOf(g);
    const u = asUnconscious(g, d);
    if (i >= 0) out[i] = u === 'Their body jerks with it.' ? '' : u;
  }
  // (Going down, or out, with this very blow: no line about staying up.)
  if (g && (((D.down && !wasDown) || (D.out && !outAtStart)) && /stagger|stumble|back a step|barely stay standing|knees? (dip|buckle)|leg folds|nearly gives out|hop back|limp a step|shake out/i.test(g) || (D.out && !outAtStart && /for a moment/.test(g)))) out.splice(out.indexOf(g), 1);
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
  // Out cold, the body reacts; the person doesn't.
  return outAtStart ? asUnconscious(out.filter(Boolean).join(' '), d) : out.filter(Boolean).join(' ');
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
  if (how === 'fall') return tier ? vary([`${S} hit the sidewalk hard.`, `The fall knocks the breath out of ${you ? 'you' : 'them'}.`]) : '';
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
  const ribsBroken = D.broken.includes('ribs') && !fx.newBreaks.includes('ribs');
  if (how === 'cut') {
    // A blade always opens skin (the bleeding is applied with it).
    const where = { head: 'face', body: 'side', stomach: 'belly', arm: 'arm', leg: 'leg' }[loc];
    const cuts: Line[][] = [
      [
        [`The edge opens a shallow gash across ${P} ${where}. Blood beads along it.`, scar(where)],
        [`A thin red line opens on ${P} ${where}, then starts to run.`, scar(where)],
        [`It nicks ${P} ${where}, and the blood comes slowly.`, scar(where)],
      ],
      [
        [`The cut is deep. Blood sheets down ${P} ${where}.`, scar(where)],
        [`It opens ${P} ${where} like a zipper.`, scar(where)],
        [`The edge drags through ${P} ${where}, and the blood comes fast.`, scar(where)],
      ],
      [
        [`The blood comes in a rush from ${P} ${where}.`, scar(where)],
        [`Blood wells up fast from ${P} ${where}.`, scar(where)],
        [`The wound in ${P} ${where} gapes, and won't stop.`, scar(where)],
      ],
    ];
    // (How bad it reads follows how badly it actually bleeds.)
    return pickLine(cuts[Math.min(tier, Math.max(tier - 1, D.bleeding >= 3 ? 2 : D.bleeding >= 2 ? 1 : 0))]);
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
        [`That one connects, and ${P} eyes go blank for a moment.`, daze],
        ...(m.jaw ? ([] as Line[]) : ([[`There's a crack, and ${P} jaw hangs wrong: it's broken.`, () => ((m.jaw = true), fx.bleed(1))]] as Line[])),
        ...(fx.wasDown ? ([[`${Pc} head bounces off the sidewalk.`, daze]] as Line[]) : []),
        ...(teeth < 8 ? ([[`Teeth go. ${S} spit them out with a mouthful of blood.`, () => ((m.teeth = Math.min(12, teeth + 2 + Math.floor(Math.random() * 2))), fx.bleed(1))]] as Line[]) : []),
        ...(bleeding ? ([[`Blood runs freely down ${P} face now.`]] as Line[]) : []),
      ],
    ],
    body: [
      [[`${S} fold around it with a grunt.`], [`It knocks ${you ? 'you' : 'them'} back a step.`], [`The air goes out of ${P} lungs in a rush.`, wind(6)]],
      [[`A deep, heavy thud.`], [`${S} stagger, clutching ${P} side.`], [`${S} wheeze, bent over.`, wind(10)]],
      [
        [`${S} fold over it and can't straighten up.`, wind(15)],
        [`${Pc} knees dip; ${s} barely stay standing.`],
        ...(ribsBroken ? ([[`Broken bone grinds in ${P} chest.`]] as Line[]) : []),
        ...(D.lung ? ([[`${S} cough, and it comes up pink.`]] as Line[]) : []),
      ],
    ],
    stomach: [
      [[`${S} double over, retching.`], [`${S} gasp and clutch ${P} stomach.`]],
      [[`${S} retch up bile and spit.`], [`${S} vomit onto the sidewalk.`], [`${S} sag, arms wrapped around ${P} middle.`]],
      [
        [`${S} vomit, and there's blood in it: something inside is torn.`, () => fx.bleed(1)],
        [`${S} curl up around it, gray in the face, and can't get a breath.`, wind(15)],
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
      [[`${Pc} knee buckles.`], [`${S} hop back, favoring the leg.`], [`It stings ${P} thigh.`]],
      [[`${Pc} leg nearly gives out.`], [`${S} limp a step.`]],
      [...(brokeLeg ? ([[`The knee twists sideways with a sickening pop, and the leg won't take ${P} weight.`]] as Line[]) : ([[`${Pc} leg folds for a moment, and ${s} stumble.`]] as Line[]))],
    ],
  };
  let pool = pools[loc]?.[tier];
  // On the floor (or out cold), nobody staggers, limps or steps back.
  // (Knocked out by this very blow: it still landed on someone awake.)
  if (fx.outAtStart || fx.wasDown) {
    const standing = /stagger|step back|back a step|limp|hop back|knees dip|blink hard|shake out|stumble|gives out|barely stay standing|knee buckles|leg folds|head snaps back|head rocks|double over|sag,|fold over it|fold around it|bent over|knocks .* back/i;
    pool = pool?.filter(([t]) => !standing.test(t));
    // (Out cold: nothing goes blank, nothing drops for a moment.)
    if (fx.outAtStart) pool = pool?.filter(([t]) => !/eyes go blank|eyes lose focus|drops? (to|for a moment)/i.test(t));
    // (The stomach already said how the body took it.)
    if (fx.outAtStart && loc === 'stomach') return '';
    const lying: Line[] = fx.outAtStart
      ? [[`${Pc} body jerks with it.`], [`${S} don't react. ${S === 'You' ? "You're" : "They're"} out.`], [`${Pc} limp body rocks with the blow.`], ['No sound. Nothing.'], [`${S} don't so much as twitch.`]]
      : [...(loc === 'stomach' ? [] : ([[`${S} curl up on the sidewalk around it.`]] as Line[])), [`${S} writhe on the ground.`], [`${S} try to cover up, and can't.`]];
    pool = [...(pool ?? []), ...lying];
  }
  // A light blow often needs no more said; a break already says plenty.
  if (!pool?.length || (tier === 0 && Math.random() < 0.4) || fx.newBreaks.length) return '';
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
function theirTurn(started = false) {
  const e = enc;
  const p = e.person;
  const b = BUILDS[p.build];
  const T = e.them;
  if (T.out) return; // unconscious
  if (T.yielded) return yieldTurn();
  // (Still in the chair: there's no reaching you.)
  if (T.broken.includes('spine') && !enc.tipped) {
    say('them', vary(["They swing at you from the chair, and can't reach.", 'They try to wheel back. The chair hits the wall.']));
    return;
  }
  // Scared enough, they give up: hands up, or curled up on the floor.
  // (Not on the swing they came at you with.)
  const fear = T.fear ?? 0;
  const P = personalityOf(p);
  const breaking = fear + P.yield * 100;
  if (!started && !refusedNow && breaking >= 75 && Math.random() < 0.25 + (breaking - 75) / 60) {
    T.yielded = true;
    say('them', surrenderLine(!!T.down));
    you.gain('intimidation', 5);
    return;
  }
  if (T.winded) {
    T.winded = false;
    say('them', T.down ? 'They lie there, fighting for breath.' : oneOf(['They double over, fighting for breath.', 'They stagger back, bent double, trying to get air.']));
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
      say('them', legs(T) ? (arms(T) >= 2 ? 'They get up on their one good leg somehow, arms held to their chest.' : 'They drag themselves up on one good leg.') : arms(T) >= 2 ? 'They roll over and get their feet under them, arms held to their chest.' : oneOf(['They get back on their feet.', 'They scramble back up.', 'They push themselves up off the sidewalk.']));
    } else say('them', legs(T) >= 2 ? arms(T) >= 2 ? vary(['Neither leg will hold them, and their arms are no use. They lie there.', 'They lie where they are, breathing hard.', 'They try to roll over, and stop, and groan.']) : vary(['Neither leg will hold them. They stay down, and throw whatever they can reach at you.', 'They can\'t get up. They scream for help instead.', 'They grab for the edge of something and can\'t pull themselves up.']) : legs(T) ? 'They try to stand, but their leg gives way.' : oneOf(['They try to get up, and fall back down.', 'They get halfway up, and their legs fold.']));
    return;
  }
  // Losing badly: some try to run for it (much harder on a broken leg).
  const tough = ['Easy', 'Fair', 'Hard', 'Brutal'].indexOf(b.difficulty);
  const wants = (p.kind === 'civilian' || p.kind === 'junkie' ? 0.2 : 0.12) * (1 - tough * 0.25) * (1 + fear / 60) * P.flee;
  if (T.blood < T.maxBlood * 0.72 && Math.random() < wants) {
    spend('them', COST.run);
    if (Math.random() < fleeChance(T, e.you)) {
      say('them', legs(T) ? 'They limp away from you as fast as they can.' : oneOf(['They scramble away and run for it.', 'They break away and run.']));
      bolt('they-fled', 2.5);
    } else say('them', legs(T) ? "They try to run, but their leg won't carry them." : 'They try to run. You cut them off.');
    return;
  }
  // Pepper spray, once.
  const spray = p.carrying.find((i) => i.spray && !i.dropped && ((i as { doses?: number }).doses ?? 3) > 0);
  if (spray && arms(T) < 2 && !T.sprayed && !e.emptied && Math.random() < 0.6) {
    T.sprayed = true;
    (spray as { doses?: number }).doses = Math.max(0, ((spray as { doses?: number }).doses ?? 3) - 1);
    e.you.blinded = 99;
    say('them', 'They pepper spray you in the face. Your eyes clamp shut and burn like they\'re on fire. You can barely see.');
    return;
  }
  // A hard case goes for the knife in your hand: grab the wrist and twist.
  const held = heldBlade(e);
  if (held && invNow && !T.down && !T.out && T.blinded <= 0 && !T.dazed && arms(T) < 2 && P.fight > 0.15 && !e.you.down && Math.random() < 0.06) {
    const at = invNow.items.findIndex((x) => x.kind === 'weapon' && x.hand && x.name === held.name);
    const it = invNow.items[at];
    if (it) {
      dropItem(invNow, at);
      p.carrying.push({ name: it.name, weapon: it.weapon, cuts: it.cuts });
      T.weaponOut = it.name;
      say('them', `They grab your wrist and twist until the ${lc(it.name)} drops. They snatch it up off the sidewalk.`);
      return;
    }
  }
  // Pulling a weapon.
  // (Not what they dropped at your feet.)
  const weapon: Item | undefined = e.emptied ? undefined : p.carrying.find((i) => i.weapon && !i.dropped);
  if (weapon && !T.weaponOut && arms(T) < 2 && Math.random() < 0.5) {
    T.weaponOut = weapon.name;
    // A bottle: some break it first, for the edge. It doesn't always go.
    if (weapon.name === 'Bottle' && Math.random() < 0.4) {
      if (Math.random() < 0.55) {
        weapon.name = 'Broken bottle';
        weapon.weapon = 6;
        weapon.cuts = true;
        delete weapon.swigs;
        T.weaponOut = weapon.name;
        say('them', 'They smash the bottle against the wall and come up holding the jagged neck.');
      } else say('them', "They bang the bottle against the wall. It doesn't break. They come at you with it anyway.");
      return;
    }
    const k = knifeOf(weapon.name);
    say(
      'them',
      !k
        ? `They pull out a ${weapon.name.toLowerCase()}.`
        : k.open === 'auto'
          ? 'Their hand comes out of a pocket and there’s a click: a switchblade, open.'
          : k.open === 'flip'
            ? `They pull out a folding knife and flick it open in one movement.`
            : k.open === 'balisong'
              ? 'They pull out a butterfly knife and swing it open, handles clacking.'
              : k.open === 'thumb' || k.open === 'nail'
                ? `They pull out a ${lc(k.name)} and get it open.`
                : `They pull out a ${lc(k.name)}.`,
    );
    return;
  }
  // Out of breath.
  if (T.stamina < COST.punch) {
    T.stamina = Math.min(T.maxStamina, T.stamina + 22);
    say('them', oneOf(['They stop, gasping for breath.', 'They bend over, hands on their knees, sucking air.']));
    return;
  }
  // (Both arms broken: whatever they had in their hand goes, and they can't swing.)
  if (T.weaponOut && arms(T) >= 2) {
    say('them', `Their hand won't hold the ${lc(T.weaponOut)} anymore. It drops.`);
    const w = p.carrying.find((i) => i.name === T.weaponOut);
    if (w) w.dropped = true;
    T.weaponOut = null;
    return;
  }
  if (arms(T) >= 2) {
    if (!legs(T) && T.stamina >= cost(T, COST.kick)) strike('them', e.you.down ? 'stomp' : 'kick');
    else say('them', oneOf(['They back off, holding their broken arms to their chest.', 'They hunch over their broken arms, and don’t come at you.']));
    return;
  }
  if (T.weaponOut && Math.random() < 0.7) strike('them', 'weapon');
  // (Nobody kicks off a broken leg.)
  else if (e.you.down && !legs(T) && T.stamina >= cost(T, COST.kick) && Math.random() < 0.75) strike('them', 'stomp');
  else if (!e.you.down && !legs(T) && T.stamina >= cost(T, COST.kick) && Math.random() < 0.3) strike('them', 'kick');
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
  // Knocked out by a blow, people come to on their own, usually in under a
  // minute (not if they've lost too much blood).
  const T0 = enc.them;
  for (const f of [enc.you, T0]) if (!f.dead) f.awake = f.out ? Math.min(-1, f.awake + 2) : Math.min(100, f.awake + 3);
  if (T0.out && !T0.dead && canWake(enc) && Math.random() < (T0.awake > -15 ? 0.35 : T0.awake > -50 ? 0.12 : 0)) {
    T0.out = false;
    T0.outNoted = false;
    T0.down = true;
    T0.dazed = 3;
    T0.awake = 25;
    say('them', oneOf(['They groan, and their eyes open. They come to on the sidewalk, dazed, trying to figure out where they are.', 'Their eyes flutter open. They don\'t know where they are.', 'They groan and roll onto their side, blinking.']));
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
    if (enc.chase) enc.chaseOut = true;
    const lying = enc.you.down;
    enc.you.down = true;
    say('info', enc.you.out ? 'Everything goes black.' : lying ? 'Too much blood. Everything goes dark.' : enc.you.bleeding >= 3 ? 'Too much blood. Your legs give out, and everything goes dark.' : 'You hit the sidewalk. Everything goes dark.');
    end('lost');
    return true;
  }
  const T = enc.them;
  // (Out cold, they're past giving up.)
  if (T.out) T.yielded = false;
  if (enc.chase && T.out) {
    delete enc.chase;
    T.down = true;
    say('them', 'Ahead of you they stagger, and fold onto the sidewalk. They don\'t get up.');
  }
  // Someone only bleeds out once they're already unconscious: a single blow
  // knocks them out, it doesn't kill them on the spot.
  // (Out before this move: knocked out by this very blow doesn't count.)
  const wasOut = outBefore;
  if (!T.out && T.blood <= T.maxBlood * PASS_OUT) {
    // (Already lying there: nothing to fall from.)
    const lying = T.down;
    T.out = true;
    T.down = true;
    T.awake = Math.min(T.awake, -40);
    if (enc.chase) {
      delete enc.chase;
      say('them', 'Ahead of you they stagger, and fold onto the sidewalk. They don\'t get up.');
    } else say('you', lying ? "Their eyes roll back. They've lost too much blood: they're unconscious." : T.bleeding >= 3 ? "They've lost too much blood. They slump to the floor, unconscious." : "They go down and don't get up. They're unconscious.");
  }
  // However they went out, they're under now.
  for (const f of [enc.you, T]) if (f.out && f.awake > 0) f.awake = -25;
  // Out cold, they haven't given up any more: they're just a body to go through.
  if (T.out || T.dead) T.yielded = false;
  if (T.out && !T.outNoted) {
    T.outNoted = true;
    if (!enc.log.slice(actLogStart).some((l) => /out cold|pass out|unconscious|they're out\b|go limp/i.test(l.text))) say('info', "They're unconscious. They can't fight back.");
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
    say('info', "Their breathing is shallow and fast, their skin gray. They're bleeding out.");
  }
  return false;
}

/** Why they noticed you following (the biggest reasons, plainly). */
function spottedWhy(): string {
  const e = enc;
  const why: string[] = [];
  if (e.conspicuous) why.push('what you\'re wearing stands out');
  if ((e.exposed ?? 0) > 0.15) why.push('they could see what you\'re carrying');
  if (e.distance >= 2) why.push('you were right on their heels');
  if (e.person.awareness === 'Paranoid' || e.person.awareness === 'Alert') why.push(`they were ${e.person.awareness.toLowerCase()}, watching for it`);
  return why.length ? `They noticed you: ${why.slice(0, 2).join(', and ')}.` : 'They noticed you following them.';
}

/** They noticed you following them: they run, or come at you. */
function spotted() {
  const p = enc.person;
  const b = BUILDS[p.build];
  const tough = ['Easy', 'Fair', 'Hard', 'Brutal'].indexOf(b.difficulty);
  const fight = tough * 0.2 + (p.kind === 'drunk' ? 0.3 : 0) + (p.awareness === 'Paranoid' ? 0.15 : 0) + personalityOf(p).fight;
  // (In a wheelchair, there's no charging anyone: see below.)
  if (!enc.them.broken.includes('spine') && Math.random() < fight) {
    say('them', oneOf(['They spin around. "The hell do you want?" They come at you.', "They spot you, and they don't run. They come straight for you."]));
    enc.stage = 'combat';
    enc.facedYou = true;
    say('info', oneOf(['The fight is on.', 'No going back now.', 'Here it comes.']));
    theirTurn(true);
    endOfRound();
  } else if (legs(enc.them) > 0) {
    // On crutches, they can't outrun anyone.
    enc.facedYou = true;
    say('them', enc.them.broken.includes('spine') ? 'They see you and try to wheel themselves away. They get nowhere. They turn the chair, cornered, fists up.' : 'They see you and try to hobble away on their crutches. They get nowhere. They turn, cornered, and swing a crutch at you.');
    enc.stage = 'combat';
    say('info', oneOf(['The fight is on.', 'No going back now.', 'Here it comes.']));
    theirTurn(true);
    endOfRound();
  } else {
    enc.facedYou = true;
    say('them', oneOf(['They spot you and bolt.', 'They see you, and run.']));
    enc.whyRan = spottedWhy();
    say('info', enc.whyRan);
    bolt('lost-them', 3 - enc.distance);
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
  effect?: 'cut' | 'sweep' | 'ko' | 'headbutt' | 'pound' | 'break-arm' | 'break-nose' | 'break-collarbone' | 'break-jaw' | 'break-hand' | 'break-wrist' | 'break-ankle' | 'break-leg' | 'throat' | 'wind' | 'deadleg' | 'throw' | 'takedown' | 'spine' | 'neck';
  /** The kind of fighting it is (what trains it, and what it's learned by). */
  style: Style;
  text: string;
}

/** In a fight, standing: learned one by one as Unarmed goes up. */
export const TECHNIQUES: Technique[] = [
  // Standing, face to face. Each comes at a level of its own style.
  // Strikes: hands, elbows, head.
  { id: 'tech:body', style: 'strikes', name: 'Gut punch', hint: 'Winds them', level: 5, kind: 'punch', aim: 'stomach', hit: -0.04, dmg: 0.9, cost: 9, effect: 'wind', text: 'You bury a fist in their gut.' },
  { id: 'tech:palm', style: 'strikes', name: 'Palm to the nose', hint: 'Can break it', level: 12, kind: 'punch', aim: 'head', hit: 0, dmg: 0.9, cost: 9, effect: 'break-nose', text: 'You drive the heel of your hand up into their nose.' },
  { id: 'tech:hook', style: 'strikes', name: 'Haymaker', hint: 'Big swing: hard to land', level: 15, kind: 'punch', aim: 'head', hit: -0.15, dmg: 1.4, cost: 12, text: 'You wind up and throw everything you have at their head.' },
  { id: 'tech:headbutt', style: 'strikes', name: 'Headbutt', hint: 'Hurts you too', level: 25, kind: 'punch', aim: 'head', hit: 0, dmg: 1.45, cost: 10, effect: 'headbutt', text: 'You grab them by the collar and smash your forehead into their face.' },
  { id: 'tech:elbow', style: 'strikes', name: 'Elbow', hint: 'Up close: splits skin', level: 32, kind: 'punch', aim: 'head', hit: -0.05, dmg: 1.15, cost: 10, effect: 'cut', text: 'You step in close and swing an elbow across their face.' },
  { id: 'tech:collar', style: 'strikes', name: 'Hammer the collarbone', hint: 'Can break it: one arm useless', level: 36, kind: 'punch', aim: 'body', hit: -0.08, dmg: 1, cost: 11, effect: 'break-collarbone', text: 'You bring your fist down like a hammer onto their collarbone.' },
  { id: 'tech:uppercut', style: 'strikes', name: 'Uppercut', hint: 'Can knock them out', level: 40, kind: 'punch', aim: 'head', hit: -0.1, dmg: 1.45, cost: 12, effect: 'ko', text: 'You come up under their chin with an uppercut.' },
  { id: 'tech:jaw', style: 'strikes', name: 'Hook to the jaw', hint: 'Can break it', level: 46, kind: 'punch', aim: 'head', hit: -0.08, dmg: 1.3, cost: 11, effect: 'break-jaw', text: 'You turn your hip into a short hook, right on the point of the jaw.' },
  { id: 'tech:throat', style: 'strikes', name: 'Throat punch', hint: 'They can’t breathe', level: 56, kind: 'punch', aim: 'head', hit: -0.12, dmg: 0.8, cost: 10, effect: 'throat', text: 'You punch straight into their throat.' },
  // Kicks & knees.
  { id: 'tech:front', style: 'kicks', name: 'Front kick', hint: 'Winds them', level: 6, kind: 'kick', aim: 'stomach', hit: 0.02, dmg: 0.9, cost: 11, effect: 'wind', text: 'You plant a foot in their stomach and push it through.' },
  { id: 'tech:knee', style: 'kicks', name: 'Knee them', hint: 'Into the ribs', level: 10, kind: 'kick', aim: 'body', hit: -0.04, dmg: 1.2, cost: 13, text: 'You grab a fistful of their jacket and drive your knee into their ribs.' },
  { id: 'tech:lowkick', style: 'kicks', name: 'Leg kick', hint: 'Deadens the leg', level: 20, kind: 'kick', aim: 'leg', hit: 0.05, dmg: 0.8, cost: 11, effect: 'deadleg', text: 'You swing your shin into the side of their thigh.' },
  { id: 'tech:ankle', style: 'kicks', name: 'Stomp on the ankle', hint: 'Can break it', level: 30, kind: 'kick', aim: 'leg', hit: -0.06, dmg: 0.6, cost: 11, effect: 'break-ankle', text: 'You stomp down hard on the side of their ankle.' },
  { id: 'tech:kneekick', style: 'kicks', name: 'Kick the knee in', hint: 'Can break the leg', level: 44, kind: 'kick', aim: 'leg', hit: -0.1, dmg: 0.9, cost: 13, effect: 'break-leg', text: 'You drive your heel straight into the side of their knee.' },
  { id: 'tech:headkick', style: 'kicks', name: 'Head kick', hint: 'Can knock them out', level: 62, kind: 'kick', aim: 'head', hit: -0.2, dmg: 1.6, cost: 16, effect: 'ko', text: 'You whip your shin up into the side of their head.' },
  // Clinch & takedowns.
  { id: 'tech:sweep', style: 'clinch', name: 'Trip them', hint: 'Puts them on the floor', level: 18, kind: 'kick', aim: 'leg', hit: 0, dmg: 0.4, cost: 12, effect: 'sweep', text: 'You hook a foot behind their ankle and shove.' },
  { id: 'tech:throw', style: 'clinch', name: 'Hip throw', hint: 'Slams them down', level: 34, kind: 'punch', aim: 'body', hit: -0.05, dmg: 1, cost: 14, effect: 'throw', text: 'You get your hip under theirs and throw them over it.' },
  { id: 'tech:double', style: 'clinch', name: 'Double-leg takedown', hint: 'Down they go, you on top', level: 48, kind: 'punch', aim: 'leg', hit: -0.04, dmg: 0.5, cost: 15, effect: 'takedown', text: 'You drop low, wrap up both their legs and drive through them.' },
  // Locks, standing.
  { id: 'tech:fingers', style: 'locks', name: 'Grab their fingers', hint: 'Snap them back', level: 8, kind: 'punch', aim: 'arm', hit: -0.12, dmg: 0.2, cost: 8, effect: 'break-hand', text: 'You catch a handful of their fingers and wrench them backwards.' },
  { id: 'tech:wrist', style: 'locks', name: 'Wrist lock', hint: 'Can break the wrist', level: 22, kind: 'punch', aim: 'arm', hit: -0.1, dmg: 0.4, cost: 10, effect: 'break-wrist', text: 'You catch their wrist and twist it back against itself.' },
];
/** On someone who's on the floor (you standing over them, or on top), besides stamping. */
export const GROUND: Technique[] = [
  { id: 'ground:kneedrop', style: 'ground', name: 'Knee drop', hint: 'Your weight on their chest', level: 12, kind: 'stomp', aim: 'body', hit: 0, dmg: 1.2, cost: 14, text: 'You drop your full weight onto their chest, knee first.' },
  { id: 'ground:pound', style: 'ground', name: 'Ground and pound', hint: 'Sit on them and punch', level: 30, kind: 'punch', aim: 'head', hit: 0.1, dmg: 1.3, cost: 14, effect: 'pound', text: 'You kneel on their chest and rain punches down into their face.' },
  { id: 'ground:elbows', style: 'ground', name: 'Elbows from the top', hint: 'Splits them open', level: 52, kind: 'punch', aim: 'head', hit: 0.05, dmg: 1.25, cost: 13, effect: 'cut', text: 'You pin them down and bring your elbow down across their face, again and again.' },
  { id: 'ground:spine', style: 'ground', name: 'Knee on the spine', hint: 'Can cripple them for life', level: 78, kind: 'stomp', aim: 'body', hit: 0, dmg: 1.1, cost: 16, effect: 'spine', text: 'You roll them onto their front and drive your knee down into their spine with all your weight.' },
  // Locks, on the floor.
  { id: 'ground:fingers', style: 'locks', name: 'Break their fingers', hint: 'One hand useless', level: 1, kind: 'punch', aim: 'arm', hit: 0.05, dmg: 0.2, cost: 8, effect: 'break-hand', text: 'You pin their hand flat and bend their fingers back.' },
  { id: 'ground:ankle', style: 'locks', name: 'Ankle lock', hint: 'Can break the ankle', level: 40, kind: 'punch', aim: 'leg', hit: 0, dmg: 0.4, cost: 12, effect: 'break-ankle', text: 'You trap their foot under your arm and wrench it sideways.' },
  { id: 'ground:arm', style: 'locks', name: 'Arm bar', hint: 'Can break the arm', level: 45, kind: 'punch', aim: 'arm', hit: 0.05, dmg: 0.7, cost: 12, effect: 'break-arm', text: 'You pin their wrist and wrench their arm back against the elbow.' },
  { id: 'ground:neck', style: 'locks', name: 'Break their neck', hint: 'Kills them', level: 90, kind: 'punch', aim: 'head', hit: 0, dmg: 0.1, cost: 16, effect: 'neck', text: 'You get behind their head, take their chin in one hand and the back of their skull in the other, and twist.' },
];
/** When you're the one on the floor (and they're standing). */
export const FLOOR: Technique[] = [
  { id: 'floor:legs', style: 'kicks', name: 'Kick their legs', hint: 'Bring them down too', level: 18, kind: 'kick', aim: 'leg', hit: 0, dmg: 0.5, cost: 12, effect: 'sweep', text: 'From the floor, you kick hard at their ankles.' },
  { id: 'floor:pull', style: 'clinch', name: 'Drag them down', hint: 'Down here with you', level: 36, kind: 'punch', aim: 'leg', hit: 0.05, dmg: 0.3, cost: 12, effect: 'sweep', text: 'You grab at their legs and pull.' },
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
export const ALL_TECHNIQUES: { name: string; level: number; where: string; style: Style }[] = [
  ...TECHNIQUES.map((t) => ({ name: t.name, level: t.level, where: 'in a fight', style: t.style })),
  ...GROUND.map((t) => ({ name: t.name, level: t.level, where: 'on someone on the floor', style: t.style })),
  ...FLOOR.map((t) => ({ name: t.name, level: t.level, where: 'from the floor', style: t.style })),
  { name: 'Kick their knee', level: KNEE_AMBUSH_LEVEL, where: 'ambush', style: 'kicks' as Style },
  { name: 'Slam them into the wall', level: SLAM_AMBUSH_LEVEL, where: 'ambush', style: 'clinch' as Style },
  { name: 'Choke', level: CHOKE_LEVEL, where: 'on someone on the floor', style: 'locks' as Style },
  { name: 'Choke from behind', level: CHOKE_AMBUSH_LEVEL, where: 'ambush', style: 'locks' as Style },
].sort((a, b) => a.level - b.level);

/** Barely knows how to throw a punch yet (Unarmed 1–10): it shows. */
const novice = () => (enc.unarmedLevel ?? 1) <= 10;

const FINGERS = ['thumb', 'index finger', 'middle finger', 'ring finger', 'little finger'];
/** Fingers still there to bend back: not broken already, and not on a hand that's broken already. */
function fingersLeft(T: Body): string[] {
  const done = T.marks?.fingerList ?? [];
  // (Counted before there was a list: those are broken, somewhere.)
  const extra = Math.max(0, (T.marks?.fingers ?? 0) - done.length);
  const all = (['left', 'right'] as const).filter((sd) => !T.broken.includes(`${sd} hand` as Part)).flatMap((sd) => FINGERS.map((f) => `${sd} ${f}`));
  const left = all.filter((f) => !done.includes(f));
  return left.slice(0, Math.max(0, left.length - extra));
}
/** A move whose whole point is breaking something that's already broken (both of them, for a pair): why not. */
function brokenAlready(T: Body, t: Technique): string | undefined {
  const pair = (what: string) => (['left', 'right'] as const).every((sd) => T.broken.includes(`${sd} ${what}` as Part));
  switch (t.effect) {
    case 'break-nose':
      return T.broken.includes('nose') ? 'Already broken' : undefined;
    case 'break-collarbone':
      return T.broken.includes('collarbone') ? 'Already broken' : undefined;
    case 'break-jaw':
      return T.marks?.jaw ? 'Already broken' : undefined;
    case 'break-hand':
      return pair('hand') ? 'Both hands broken' : undefined;
    case 'break-wrist':
      return pair('wrist') ? 'Both wrists broken' : undefined;
    case 'break-ankle':
      return pair('ankle') ? 'Both ankles broken' : undefined;
    case 'break-leg':
      return pair('leg') ? 'Both legs broken' : undefined;
    case 'break-arm':
      return pair('arm') ? 'Both arms broken' : undefined;
    case 'spine':
      return T.broken.includes('spine') ? 'They’ll never walk again' : undefined;
    default:
      return undefined;
  }
}
/** The chance a move meant to break something does: more as you get better at that style. */
const breakOdds = (t: Technique, base: number) => clamp(base + ((enc.styleLevels?.[t.style] ?? enc.unarmedLevel ?? 1) - t.level) * 0.006 + (enc.them.out ? 0.15 : enc.them.dazed ? 0.08 : 0) - (t.kind === 'punch' ? arms(enc.you) * 0.2 : 0), 0.05, 0.9);
/** What a technique does when it lands, beyond the blow itself. */
function techEffect(t: Technique, newBreaks: Part[] = []) {
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
        say('them', 'They go down hard.');
        scare(5);
      } else if (!T.down) say('them', oneOf(['They stagger, and keep their feet.', 'They lurch, catch themselves, and stay up.']));
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
      if (arm && Math.random() < breakOdds(t, 0.35)) {
        T.broken.push(arm);
        say('you', T.out ? `There's a crack, and their ${arm} bends the wrong way. They don't even stir.` : `There's a crack, and their ${arm} bends the wrong way. They scream.`);
        impacts.push({ target: 'them', ml: 0, severe: true, loc: 'arm', spill: 'none' });
        scare(15);
      } else if (arm && LOCKS.has(t.id)) say('them', vary(T.out ? ['The elbow strains, and holds.'] : ['They buck and pull the arm free.', 'They twist onto their side, and the arm comes loose.']));
      break;
    }
    case 'break-nose':
      if (!T.broken.includes('nose') && Math.random() < breakOdds(t, 0.45)) {
        T.broken.push('nose');
        T.bleeding = Math.min(4, Math.max(T.bleeding, 1));
        say('you', 'Their nose crunches and folds sideways under your palm. Blood pours out of it.');
        impacts.push({ target: 'them', ml: 0, severe: true, loc: 'head', spill: 'spatter' });
        scare(10);
      }
      break;
    case 'break-collarbone':
      if (!T.broken.includes('collarbone') && Math.random() < breakOdds(t, 0.35)) {
        T.broken.push('collarbone');
        say('you', 'Something snaps under your fist: their collarbone. That arm drops to their side, useless.');
        impacts.push({ target: 'them', ml: 0, severe: true, loc: 'body', spill: 'none' });
        scare(15);
      }
      break;
    case 'break-jaw': {
      const m = (T.marks ??= {});
      if (!m.jaw && Math.random() < breakOdds(t, 0.35)) {
        m.jaw = true;
        T.dazed = Math.max(T.dazed ?? 0, 2);
        say('you', 'There’s a crack you feel all the way up your arm. Their jaw hangs crooked: it’s broken.');
        impacts.push({ target: 'them', ml: 0, severe: true, loc: 'head', spill: 'spatter' });
        scare(15);
      }
      break;
    }
    case 'throat':
      T.stamina = Math.max(0, T.stamina - 35);
      if (!T.out) {
        T.dazed = Math.max(T.dazed ?? 0, 1);
        say('them', 'They clutch their throat, gagging, trying to pull in air that won’t come.');
      }
      break;
    case 'wind':
      T.stamina = Math.max(0, T.stamina - 18);
      if (!T.out && !T.winded && Math.random() < 0.5) say('them', 'The air goes out of them in a rush.');
      break;
    case 'deadleg':
      T.stamina = Math.max(0, T.stamina - 12);
      if (!T.out && !T.down && Math.random() < 0.15) {
        T.down = true;
        say('them', 'Their leg goes dead under them, and they drop.');
      } else if (!T.out && !T.down) say('them', 'Their leg buckles. They limp on it.');
      break;
    case 'break-hand':
    case 'break-wrist':
    case 'break-ankle':
    case 'break-leg': {
      const what = t.effect === 'break-hand' ? 'hand' : t.effect === 'break-wrist' ? 'wrist' : t.effect === 'break-ankle' ? 'ankle' : 'leg';
      // (The blow broke one already: that's this move's break, not a second one.)
      // (A leg broken by the blow is that leg; a broken arm is that arm.)
      if (newBreaks.some((p) => (what === 'ankle' || what === 'leg' ? /(leg|ankle)$/ : /(arm|wrist|hand)$/).test(p))) break;
      const sides = (['left', 'right'] as const).filter((sd) => !T.broken.includes(`${sd} ${what}` as Part));
      const sd = sides[Math.floor(Math.random() * sides.length)];
      if (!sd || Math.random() >= breakOdds(t, what === 'hand' ? 0.5 : what === 'wrist' ? 0.4 : 0.32)) {
        // (A lock that holds: something has to be said, the blow said nothing.)
        if (LOCKS.has(t.id) && sd) {
          const held: Record<string, [string[], string[]]> = {
            hand: [['They wrench their hand free before anything gives.', 'They tear their fingers loose, gasping.'], ['The fingers bend back, and hold.']],
            wrist: [['They turn with it, and the wrist holds.', 'They twist out of it before it goes.'], ['The wrist bends, and holds.']],
            ankle: [['They kick and twist, and the ankle holds.', 'They thrash, and wrench the foot free.'], ['The ankle turns, and holds.']],
          };
          const h = held[what];
          if (h) say('them', vary(T.out ? h[1] : h[0]));
        }
        break;
      }
      const part = `${sd} ${what}` as Part;
      T.broken.push(part);
      const drop = (what === 'hand' || what === 'wrist') && T.weaponOut && Math.random() < 0.6;
      const scream = T.out ? ' They don’t even stir.' : ' They scream.';
      say(
        'you',
        what === 'hand'
          ? `Their fingers snap back at angles fingers don't go.${scream}`
          : what === 'wrist'
            ? `There's a pop, and their ${sd} wrist goes loose and wrong.${scream}`
            : what === 'ankle'
              ? T.broken.includes('spine') || T.down ? `Their ${sd} ankle snaps.${T.broken.includes('spine') ? ' They don’t feel it.' : scream}` : `Their ${sd} ankle rolls under them with a crack.${scream}`
              : `Their ${sd} knee bends sideways with a crack. The leg's broken.${scream}`,
      );
      // (What they had in that hand goes.)
      if (drop && T.weaponOut) {
        const w = enc.person.carrying.find((i) => i.name === T.weaponOut);
        if (w) w.dropped = true;
        say('them', `The ${lc(T.weaponOut)} falls out of their hand.`);
        T.weaponOut = null;
      }
      impacts.push({ target: 'them', ml: 0, severe: true, loc: what === 'ankle' || what === 'leg' ? 'leg' : 'arm', spill: 'none' });
      // (Nobody stays up on two broken legs.)
      if ((what === 'ankle' || what === 'leg') && !T.down && (legs(T) >= 2 || Math.random() < 0.6)) {
        T.down = true;
        if (!T.out) say('them', legs(T) >= 2 ? 'Neither leg holds them. They go down hard.' : 'The leg folds, and they go down.');
      }
      scare(15);
      break;
    }
    case 'throw':
      if (!T.down && Math.random() < (BUILDS[enc.person.build].solid ? 0.55 : 0.8)) {
        T.down = true;
        T.stamina = Math.max(0, T.stamina - 15);
        say('them', 'They go over your hip and hit the ground flat on their back.');
        scare(8);
      } else if (!T.down) say('them', 'They twist out of it and keep their feet.');
      break;
    case 'takedown':
      if (!T.down && Math.random() < (BUILDS[enc.person.build].solid ? 0.6 : 0.85)) {
        T.down = true;
        say('them', 'They go down under you, and you land on top.');
        scare(8);
      } else if (!T.down) say('them', 'They sprawl, and push you off.');
      break;
    case 'spine':
      if (!T.broken.includes('spine') && Math.random() < breakOdds(t, 0.1) + (T.out ? 0.08 : 0)) {
        T.broken.push('spine');
        T.down = true;
        say('you', T.out ? 'There’s a deep crack under your knee. Their legs don’t move. They never will again.' : 'There’s a deep crack under your knee. Their legs stop kicking. "I can’t feel my legs. I can’t feel my legs."');
        impacts.push({ target: 'them', ml: 0, severe: true, loc: 'body', spill: 'none' });
        scare(40);
      }
      break;
    case 'neck': {
      // (Held down, out, or dazed, it's easier to get the angle.)
      const odds = clamp(breakOdds(t, 0.3) + (T.out ? 0.35 : T.dazed ? 0.2 : 0), 0.05, 0.9);
      if (Math.random() < odds) {
        T.dead = true;
        T.out = true;
        T.down = true;
        T.bleeding = 0;
        say('you', 'A crack like a branch going. Their body goes slack all at once. They’re dead.');
        impacts.push({ target: 'them', ml: 0, severe: true, loc: 'head', spill: 'none' });
        end('killed');
      } else say('you', T.out ? 'You can’t get the angle on it. Their head lolls out of your hands.' : 'They twist and buck, and you lose your grip before you can turn it.');
      break;
    }
    case 'headbutt': {
      enc.you.awake = Math.max(1, (enc.you.awake ?? 100) - roll(6, 14));
      if (Math.random() < 0.2) enc.you.dazed = 1;
      say('you', 'Your own head rings with it.');
      if (!T.out && !T.dazed && Math.random() < 0.6) {
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
  const odds = clamp(0.55 + accuracyBonus(you.stats) + (styleLevel(you.stats, 'locks') - CHOKE_LEVEL) * 0.005 - arms(enc.you) * 0.25 + (T.dazed ? 0.15 : 0), 0.05, 0.95);
  if (Math.random() >= odds) {
    say('you', 'You try to get them in a headlock, but they twist away and fight you off.');
    return;
  }
  T.stamina = Math.max(0, T.stamina - 40);
  you.gain('unarmed', 3);
  you.style('locks', 5);
  if (T.stamina === 0 || Math.random() < 0.3) {
    T.out = true;
    T.awake = -8;
    say('you', 'You get them in a headlock and squeeze. They claw at you, slower, slower, then go limp. Out cold.');
  } else say('you', 'You get them in a headlock and squeeze. They claw at your arm, choking, and tear free.');
  scare(15);
}

/**
 * Selling them a bag. Who buys is who's already using: junkies most, drunks
 * late at night, a civilian now and then (and sometimes the civilian is a
 * cop). What they pay is the going rate if they have it, whatever they've
 * got if they're desperate; some would rather grab it and run. Speech helps.
 */
function sellTo(e: Encounter) {
  const p = e.person;
  const hr = new Date().getHours();
  const night = hr >= 21 || hr < 5;
  e.distance = 2;
  e.facedYou = true;
  say('you', e.regular ? oneOf(['You give them a nod. "Same as last time?"', '"Hey. You need?"']) : oneOf(['You fall in beside them and keep your voice low. "You looking?"', 'You catch their eye. "You need something? I got you."', '"Hey. You good? I can help you out."']));
  // A plainclothes cop, playing a buyer (more of them when they're after you).
  // (Low-key and careful, you smell more of them before you ever open your mouth: Sneak.)
  const quiet = Math.min(0.6, ((e.sneakLevel ?? 1) - 1) * 0.006);
  const cop = p.kind === 'civilian' ? (0.04 + (e.heat ?? 0) / 300) * (1 - quiet * 0.7) : 0;
  if (!e.regular && Math.random() < cop) {
    say('them', oneOf(['"Yeah. Yeah, I\'m looking." A twenty, folded small. They take the bag and look at it a little too long.', '"How much for one?" They pay without haggling, and slip the bag into a jacket pocket.']));
    say('info', 'A car door opens behind you. Then another.');
    e.deal = { kind: 'sting', price: 2000 };
    end('sold');
    return;
  }
  // (Anything in your hand, a blade, a bat, a gun: nobody buys from that.)
  const scary = (e.conspicuous ? 0.2 : 0) + ((e.weapons ?? []).some((w) => w.hand) ? 0.3 : 0) + (hr >= 8 && hr < 18 ? 0.08 : 0);
  const want = clamp(-scary + ({ junkie: 0.75, drunk: night ? 0.45 : 0.25, homeless: 0.3, civilian: night ? 0.16 : 0.06 } as Record<string, number>)[p.kind] + (e.cameOver ? 0.55 : e.regular ? 0.3 : 0) - (e.cameOver ? 0 : e.suspicion / 250) + ((e.speechLevel ?? 1) - 1) * 0.004, 0.02, 0.95);
  if (Math.random() >= want) {
    say('them', e.cameOver ? oneOf(['"Nah. Changed my mind." They step back, and they\'re gone.', 'They look at the bag, then up the street. "Not here. Not now."']) : p.kind === 'civilian' ? oneOf(['"What? No. Get away from me."', 'They look at you like you\'re something on their shoe and walk faster.', '"I\'m good." They don\'t look at you again.']) : oneOf(['"Nah. Not tonight."', '"I\'m good, man."', 'They shake their head and keep going.']));
    // Some people call it in.
    e.deal = { kind: 'no', price: 0, reported: p.kind === 'civilian' && Math.random() < 0.2 * (1 - quiet) };
    end('left');
    return;
  }
  const cents = p.clothes.reduce((n, g) => n + g.loot.filter((l) => l.kind === 'cash').reduce((m, l) => m + Math.round((l.cash ?? 0) * 100), 0), 0);
  const rate = ({ junkie: 15, drunk: 20, homeless: 10, civilian: 25 } as Record<string, number>)[p.kind] * (1 + ((e.speechLevel ?? 1) - 1) * 0.004);
  const price = Math.round(rate) * 100;
  if (cents < price) {
    // Not enough: desperate ones grab it; some pay what they have.
    if ((p.kind === 'junkie' || p.kind === 'homeless') && legs(e.them) === 0 && Math.random() < 0.3) {
      say('them', oneOf(['They look at the bag. They look at you. Then they snatch it out of your hand and run.', '"Lemme see it." The second it\'s in their hand they\'re off and running.']));
      e.deal = { kind: 'snatched', price: 0 };
      bolt('lost-them', 1.2);
      return;
    }
    if (cents >= Math.min(price / 2, 800)) {
      const all = Math.floor(cents / 100) * 100;
      say('them', `"I only got ${Math.floor(cents / 100)}. Come on. That's all I got." They hold it out, crumpled.`);
      say('you', 'You take it, and hand them the bag.');
      e.deal = { kind: 'sold', price: all };
      e.customer = true;
      end('sold');
      return;
    }
    say('them', oneOf(['"I ain\'t got it right now. Front me one? I\'m good for it."', '"I got like two dollars, man."']));
    say('you', 'You shake your head.');
    e.deal = { kind: 'no', price: 0 };
    end('left');
    return;
  }
  say('them', oneOf([`"How much?" You tell them: ${Math.round(price / 100)}. They count it out quick, eyes on the street, and the bag's gone into their pocket.`, `They palm you ${Math.round(price / 100)} dollars, folded small. You palm them the bag. It takes a second.`]));
  e.deal = { kind: 'sold', price };
  e.customer = true;
  end('sold');
}

/** Takes something out of your inventory mid-fight (the lists of what's where move up with it). */
function dropItem(inv: Inventory, i: number) {
  if (i < 0) return;
  inv.items.splice(i, 1);
  const shift = (xs?: number[]) => xs?.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x));
  enc.drawn = shift(enc.drawn);
  enc.bagged = shift(enc.bagged);
  enc.ankle = shift(enc.ankle);
}

/** Pepper spray in their face: they can barely see to hit you for the rest of the fight. */
function spray(i: number, inv: Inventory) {
  const it = inv.items[i];
  if (!it?.spray) return;
  if ((it.doses ?? 3) <= 0) {
    say('you', 'You press the button. The can hisses, and nothing comes out. It\'s empty.');
    return;
  }
  if (enc.them.out) return;
  it.doses = Math.max(0, (it.doses ?? 3) - 1);
  spend('you', 4);
  enc.them.blinded = 99;
  say('you', enc.them.down ? 'You pepper spray them full in the face. They curl up on the ground, eyes streaming and screwed shut.' : 'You pepper spray them full in the face. They stagger back, eyes streaming and screwed shut, swinging blind.');
  if (it.doses === 0) {
    dropItem(inv, i);
    say('info', 'The can sputters out. You drop it.');
  }
  scare(8);
  you.gain('weapons', 2);
}

/** Getting the drop on them makes a mugging easier: close, and them not looking. */
function mugSurprise(e: Encounter) {
  const aw = AWARENESS.indexOf(e.person.awareness);
  return [0.15, 0.08, 0, -0.08][aw] + e.distance * 0.05 - (e.suspicion / 100) * 0.3;
}

/** Knocked out, but not bled out: a slap can bring them round. */
// (Not if the next two rounds of their bleeding (the slap's, and the one after)
// would only put them straight back under.)
const canWake = (e: Encounter) => !!e.them.out && !e.them.dead && e.them.blood - (2 * BLEED_ML[e.them.bleeding] * e.them.maxBlood) / 5000 > e.them.maxBlood * (PASS_OUT + 0.03) && e.them.awake > -60;

/** "Wallet. Now." Before any blows: they give it up, run, or fight. */
function mug() {
  const e = enc;
  const T = e.them;
  e.stage = 'combat';
  e.facedYou = true;
  spend('you', COST.ambush);
  // A blade already in your hand, or one you can get to (not at the bottom of a bag), with a hand free.
  const blade = heldBlade(e) ?? (e.weapons ?? []).find((w) => w.cuts && !w.hand && !/^bottle$|syringe/i.test(w.name) && !(e.bagged ?? []).includes(w.i) && !handsFull(e));
  const gun = (e.weapons ?? []).find((w) => w.gun && (w.hand || (!(e.bagged ?? []).includes(w.i) && !handsFull(e))));
  // (You get up close first, then the weapon comes out.)
  say(
    'you',
    [
      `You cross the street and get right in their face. "Wallet. Phone. Now."`,
      `You close in fast and grab their arm. "Don't make a sound. Give me what you've got."`,
      `You step out in front of them, close enough to smell them. "You know what this is. Hand it over."`,
    ][e.distance],
  );
  if (gun) {
    const gi = invNow?.items[gun.i];
    if (gi && !gi.hand) gi.hand = freeHand(invNow!, enc.you?.broken) ?? undefined;
    say('you', `You let them see the gun.`);
    scare(35);
  } else if (blade) {
    // Out in your hand, where they can see it.
    const it = invNow?.items[blade.i];
    const wasHeld = !!blade.hand;
    if (it && !it.hand) {
      it.hand = freeHand(invNow!, enc.you?.broken) ?? undefined;
      blade.hand = it.hand;
    }
    const kn = knifeOf(blade.name);
    if (kn && !(e.opened ?? []).includes(kn.name) && kn.open !== 'fixed') (e.opened ??= []).push(kn.name);
    say('you', wasHeld ? `You let them see the ${lc(blade.name)}.` : `You take out the ${lc(blade.name)}${kn && kn.open !== 'fixed' ? ', open it,' : ''} and let them see it.`);
    scare(18);
  }
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
      say('them', oneOf(['They shove past you and run.', 'They bolt out into the traffic.']));
      bolt('lost-them', 2.2);
      return;
    }
    say('them', 'They try to run. You grab them by the collar and drag them back.');
    scare(6);
    say('info', oneOf(['The fight is on.', 'No going back now.', 'Here it comes.']));
    endOfRound();
    return;
  }
  say('them', speak('refuseMug'));
  say('info', oneOf(['The fight is on.', 'No going back now.', 'Here it comes.']));
  theirTurn(true);
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
  // (Not in the same breath as giving up, and not with no arms to swing.)
  if (!yieldedNow && fear < nerve && Math.random() < (nerve - fear) / 70) {
    if (!T.down && legs(T) === 0 && Math.random() < clamp(0.55 * P.flee - P.fight, 0.05, 0.95)) {
      if (e.you.down || Math.random() < fleeChance(T, e.you, 0.1)) {
        say('them', e.you.down ? 'You\'re on the ground. They see their chance and bolt.' : 'They see their chance and bolt.');
        bolt('they-fled', 2.5);
      } else {
        say('them', 'They try to bolt. You catch them by the collar and slam them into the wall.');
        scare(10);
      }
      return;
    }
    if (arms(T) >= 2) return;
    T.yielded = false;
    say('them', T.down ? 'Something changes in their face. They lash out at you from the ground.' : oneOf(['Something changes in their face. They come at you.', '"Screw this." They swing at you.']));
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
    const blade = heldBlade(e);
    if (Math.random() < yieldChance(e, blade ? KNIFE_EDGE : 0)) {
      T.yielded = true;
      yieldedNow = true;
      say('you', blade ? `You let them see the ${lc(blade.name)} in your hand. "Give it up. Now."` : oneOf(['"Give it up," you tell them. "Or this gets worse."', '"Stop. Look at you. Just give me what you\'ve got."']));
      say('them', surrenderLine(!!T.down));
      you.gain('intimidation', 8);
    } else {
      say('you', vary(['"Give it up," you tell them.', '"Hand it over. Now."', '"Last chance. Give it up."']));
      say('them', speak('refuse'));
      refusedNow = true;
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
      yieldedNow = true;
      scare(30);
      say('you', arms(e.you) >= 2 ? 'You nudge their head with your foot until their eyes open.' : vary(['You slap them until their eyes open.', 'You slap their face, back and forth, until their eyes open.', 'You shake them by the shoulder and slap them until their eyes open.']));
      say('them', speak('woken') || 'They see you standing over them and start to beg.');
      you.gain('intimidation', 4);
    } else say('you', arms(e.you) >= 2 ? "You nudge them with your foot. Their head lolls. They're still out." : "You slap them. Their head lolls. They're still out.");
    return true;
  }
  if (!T.yielded || T.out) return false;
  const fear = T.fear ?? 0;
  if (id === 'menace') {
    if (asked.includes('menace')) return false;
    asked.push('menace');
    const bl = heldBlade(e);
    say('you', bl ? (/broken bottle/i.test(bl.name) ? 'You hold the jagged edge of the bottle under their chin. "Try anything."' : `You lay the flat of the ${lc(bl.name)} against their cheek. "Try anything."`) : oneOf(['You lean in close. "Try anything, and I\'ll know where to find you."', ...(arms(e.you) >= 2 ? [] : ['You grab their face and make them look at you. "Don\'t even think about it."']), ...(legs(T) ? [] : ['"Run, and I\'ll catch you. And then it gets worse."'])]));
    // It only goes so far: past terrified, more threats do nothing.
    if (fear >= 80) {
      say('them', "They're as scared as they're going to get.");
      return true;
    }
    const before = fearLevel(fear);
    scare((bl ? 20 : 12) * (1 - fear / 150));
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
    const shown = all.filter((l) => !l.hidden).map((l) => lootWords(l));
    say('them', shown.length ? `They turn out their pockets${isBrute(e.person.personality) ? '' : ' with shaking hands'}: ${list(shown)}.` : "They turn out their pockets. There's nothing in them.");
    if (shown.length) maybeSay('emptied', 0.85);
    const arms_ = e.person.carrying.filter((it) => (it.weapon || it.spray) && !it.dropped);
    if (arms_.length) {
      say('them', `They drop ${list(arms_.map((it) => `the ${lc(it.name)}`))} at your feet.`);
      e.them.weaponOut = null;
    }
    you.gain('intimidation', 3);
    return true;
  }
  if (id === 'patdown') {
    if (asked.includes('patdown')) return false;
    asked.push('patdown');
    e.emptied = true;
    const hid: string[] = [];
    for (const g of e.person.clothes) {
      g.searched = true;
      for (const l of g.loot)
        if (l.hidden) {
          l.hidden = false;
          hid.push(`${lootWords(l)} (${g.name.toLowerCase()}, ${l.where})`);
        }
    }
    const all = e.person.clothes.flatMap((g) => g.loot);
    const arms_ = e.person.carrying.filter((it) => (it.weapon || it.spray) && !it.dropped);
    say(
      'you',
      hid.length
        ? `You pat them down and find ${list(hid)} they were keeping from you.`
        : all.length
          ? `You pat them down: ${list(all.map((l) => lootWords(l)))}. Nothing else.`
          : arms_.length
            ? 'You pat them down. No money, nothing in their pockets.'
            : 'You pat them down. Nothing on them at all.',
    );
    if (arms_.length) {
      say('you', `You find ${list(arms_.map((it) => a(lc(it.name))))} on them, and make them drop ${arms_.length > 1 ? 'them' : 'it'}.`);
      e.them.weaponOut = null;
    }
    if (hid.length) {
      scare(8);
      maybeSay('caught', 1);
    }
    return true;
  }
  if (id === 'ask-rest') {
    if (asked.includes('rest')) return false;
    asked.push('rest');
    const hidden = e.person.clothes.flatMap((g) => g.loot.map((l) => ({ g, l }))).filter(({ l }) => l.hidden);
    say('you', '"Is that everything?"');
    if (hidden.length && Math.random() < fear / 100 + 0.1) {
      const { g, l } = hidden[0];
      l.hidden = false;
      say('them', `"Okay! Okay, there's this too." They pull ${lootWords(l).replace(/ \(([^)]*)\)$/, ', $1,')} out of their ${g.name.toLowerCase()}.`);
      you.gain('intimidation', 4);
    } else say('them', speak(hidden.length ? 'holdingOut' : 'allThere') || (fear >= 50 ? '"That\'s all of it, I swear. I swear!"' : '"That\'s everything." They hold your eye a little too long.'));
    return true;
  }
  if (id.startsWith('pin:') || id.startsWith('pin-mine:')) {
    let card: { name: string; kind?: string; pin?: string; pinOk?: boolean; noPin?: boolean; pinAsked?: boolean } | undefined;
    if (id.startsWith('pin:')) {
      const [, gi, li] = id.split(':').map(Number);
      card = e.person.clothes[gi]?.loot[li];
    } else {
      const it = inv?.items[Number(id.slice(9))];
      card = it && /card/.test(it.kind) && it.detail === e.holder ? it : undefined;
    }
    if (!card || card.pin || card.pinAsked) return false;
    say('you', `"The ${card.name.toLowerCase()}. What's the PIN?"`);
    // (A credit card most people never set one for: there's nothing to tell.)
    if (card.noPin && fear >= 25) {
      card.pinAsked = true;
      say('them', oneOf(['"It doesn\'t have one! It\'s a credit card, I just tap it!"', '"There isn\'t a PIN! I swear! I never set one up!"', '"I don\'t know it. I never use it at a machine. Nobody does."']));
      you.gain('intimidation', 2);
      return true;
    }
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
    say('you', '"I lost some things. Someone around here has them. Who?"');
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
    say('you', e.robbed && !e.you.down ? (arms(e.you) >= 2 ? 'You step back. "Go."' : oneOf(['You shove them away from you.', 'You push them off. "Go."', 'You let go of them and step back.'])) : 'You let them go.');
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
      {
        const m = (T.marks ??= {});
        const done = (m.fingerList ??= []);
        const left = fingersLeft(T);
        if (!left.length) return;
        // One hand at a time: finish one before starting on the other.
        const hand = left.find((f) => done.some((d) => d.split(' ')[0] === f.split(' ')[0])) ?? left[0];
        const fing = left.filter((f) => f.split(' ')[0] === hand.split(' ')[0]);
        const f = fing[Math.floor(Math.random() * fing.length)];
        done.push(f);
        m.fingers = Math.max(m.fingers ?? 0, done.length);
        const [sd, ...rest] = f.split(' ');
        const name = rest.join(' ');
        text = oneOf([`You take their ${sd} ${name} and bend it back until it pops. They shriek.`, `You take their ${sd} ${name} and bend it back until it snaps. They scream through their teeth.`, `You grab their ${sd} hand and bend the ${name} back, slowly. There's a wet crack. They howl.`]);
        // All five on that hand: that hand's done.
        if (FINGERS.every((x) => done.includes(`${sd} ${x}`))) {
          if (!T.broken.includes(`${sd} hand` as Part)) T.broken.push(`${sd} hand` as Part);
          text += ` That's every finger on their ${sd} hand.`;
        }
      }
      break;
    case 'stamp':
      {
        if (!T.down) return;
        const sd = (['right', 'left'] as const).find((x) => !T.broken.includes(`${x} hand` as Part));
        if (!sd) return;
        T.broken.push(`${sd} hand` as Part);
        (T.marks ??= {}).hand = true;
        text = `You put your heel on their ${sd} hand and lean on it until the small bones crunch. Their ${sd} hand is broken.`;
      }
      break;
    case 'blade': {
      const b = heldBlade(e);
      if (!b || e.asked?.includes('blade')) return;
      (e.asked ??= []).push('blade');
      text = oneOf([`You put the point of the ${lc(b.name)} under their eye, close enough that they can't blink without feeling it.`, `You hold the ${lc(b.name)} an inch from their eye and let them look at it.`]);
      break;
    }
    case 'cut': {
      const b = heldBlade(e);
      if (!b || (T.marks?.scars ?? []).filter((x) => x === 'cheek').length >= 2) return;
      text = (T.marks?.scars ?? []).includes('cheek')
        ? `You turn their head the other way and draw the ${lc(b.name)} across the other cheek. It opens like paper.`
        : `You take their jaw in one hand and draw the ${lc(b.name)} across their cheek. It opens like paper.`;
      (T.marks ??= {}).scars = [...(T.marks.scars ?? []), 'cheek'];
      T.bleeding = Math.max(T.bleeding, 1);
      ml = 60;
      break;
    }
    case 'twist':
      {
        const arm = T.broken.find((x) => /arm$/.test(x) && !(e.asked ?? []).includes(`twist:${x}`));
        if (!arm) return;
        (e.asked ??= []).push(`twist:${arm}`);
        text = `You take their broken ${arm} and twist. The bone ends grind.`;
      }
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
  // The pain can be too much (a blade held to the eye is fear, not pain).
  const lost = 1 - T.blood / T.maxBlood;
  if (how !== 'blade' && Math.random() < 0.03 + lost * 0.4) {
    T.out = true;
    T.down = true;
    T.awake = -10;
    T.yielded = false;
    say('them', 'Their eyes roll back. They pass out from the pain.');
  } else say('them', speak('torture') || "They're sobbing now.");
}

/** A thing off them in a list ("$105 in cash", not "cash, $105"). */
function lootWords(l: Loot): string {
  return a(lc(lootLabel(l)))
    .replace(/^(?:some )?cash, (\$[\d,.]+)$/i, '$1 in cash')
    .replace(/^your cash, (\$[\d,.]+)$/i, '$1 of your cash')
    // ("$59 in folded bills", not "folded bills, $59"; "a lighter (43% full)".)
    .replace(/^((?:folded|crumpled|loose|rolled)[a-z ]*?), (\$[\d,.]+)$/i, '$2 in $1')
    .replace(/^(an? [^,]+), ([^,]+)$/i, '$1 ($2)');
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
    const parts = loose.map((l) => `${lootWords(l)} (${l.where})`);
    if (wallet.length) parts.unshift(`a wallet with ${list(wallet.map((l) => lootWords(l)))}`);
    say('you', `You go through their ${g.name.toLowerCase()} and find ${list(parts)}.`);
    return;
  }
  if (!inv) return;
  const grab = (g: (typeof clothes)[number], l: Loot) => {
    const r = take(inv, l);
    say('you', r.text);
    if (r.cents) enc.robbed = true;
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
        const r = take(inv, l);
        if (l.kind === 'cash' && r.cents) {
          cash += r.cents / 100;
          enc.robbed = true;
        }
        if (!r.ok) {
          left.push(l.kind === 'cash' ? lootWords(l) : named(l.name));
          continue;
        }
        if (l.kind !== 'cash') lines.push(named(l.name));
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
    if (left.length) say('you', `There's no room for ${list(left)}. You leave ${left.length > 1 || /[^s]s$/i.test(left[0].split(/ of | \(/)[0]) ? 'them' : 'it'}.`);
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
  // (The head noun: "pack of cigarettes" is one pack.)
  const last = s.split(',')[0].trim().split(' of ')[0].split(' ').pop() ?? '';
  return /^[a-z]+s$/.test(last) && !/(ss|us|is|gas|lens)$/.test(last);
};
/** Lower-case the first letter only ("state ID", not "state id"). */
const lc = (s: string) => s.replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase());
/** A thing's name, in a list: "a state ID (expired)", not "a state ID, expired". */
const named = (s: string) => a(lc(s)).replace(/^(an? [^,]+), ([^,]+)$/, '$1 ($2)');
export const a = (s: string) => (/^(pepper spray|cash|loose|folded|groceries|house keys|car keys|cigarettes|headphones|matches|some |your |bills|bandages|gauze|iron tablets|painkillers)/.test(s) || plural(s) ? s : /^[aeiou]/.test(s) ? `an ${s}` : `a ${s}`);
export const list = (xs1: string[]) => {
  // (Money of the same kind, different amounts: one sum. "$30 of your cash" and "$50 of your cash" are $80 of it.)
  const xs0: string[] = [];
  const sums = new Map<string, { i: number; c: number; k: number }>();
  for (const x of xs1) {
    const m = /^\$([\d,]+(?:\.\d+)?) ((?:in|of) [^(]+?)( \([^)]*\))?$/.exec(x);
    if (!m) {
      xs0.push(x);
      continue;
    }
    const key = m[2] + (m[3] ?? '');
    const v = Math.round(Number(m[1].replace(/,/g, '')) * 100);
    const had = sums.get(key);
    if (had) {
      had.c += v;
      had.k++;
    } else {
      sums.set(key, { i: xs0.length, c: v, k: 1 });
      xs0.push(x);
    }
  }
  for (const [key, { i, c, k }] of sums) if (k > 1) xs0[i] = `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} ${key}`;
  // (The same thing twice is "two receipts", not "a receipt and a receipt".)
  const n = new Map<string, number>();
  for (const x of xs0) n.set(x, (n.get(x) ?? 0) + 1);
  const xs = [...n].flatMap(([x, k]) => (k < 2 ? [x] : several(x, k)));
  // (A list inside the list, "a wallet with A and B": a comma before the last "and".)
  const out = xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')}${xs.slice(0, -1).some((x) => / and /.test(x)) ? ',' : ''} and ${xs[xs.length - 1]}`;
  // ("matches (20 left, in the bag)", not "(20 left) (in the bag)".)
  return out.replace(/\) \(/g, ', ');
};
const NUMBER = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const pluralWord = (w: string) => (/(s|x|z|ch|sh)$/i.test(w) ? `${w}es` : /[^aeiou]y$/i.test(w) ? `${w.slice(0, -1)}ies` : /fe?$/i.test(w) && /(knife|wife|life)$/i.test(w) ? `${w.replace(/fe?$/i, '')}ves` : `${w}s`);
/** "a receipt", 3 → "three receipts"; "a pack of gum", 2 → "two packs of gum". */
function several(x: string, k: number): string[] {
  // ("a receipt (in the bag)": the where stays as it is.)
  const where = /( \([^)]*\))+$/.exec(x)?.[0] ?? '';
  const bare = where ? x.slice(0, -where.length) : x;
  const m = /^(?:a|an|the) (.+)$/i.exec(bare);
  // (The same sum twice: "$40 in cash", "$80 of your cash".)
  const sum = /^\$([\d,]+(?:\.\d+)?) (in|of) (.+)$/.exec(bare);
  if (sum) {
    const total = Math.round(Number(sum[1].replace(/,/g, '')) * k * 100) / 100;
    const cents = total % 1 !== 0;
    return [`$${total.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })} ${sum[2]} ${sum[3]}${where}`];
  }
  // (Money, or a detail after a comma or in brackets: listed as many times as there are.)
  if (/^\$/.test(bare) || bare.includes(',') || bare.includes('(') || / (in|with|from) /.test(bare)) return Array(k).fill(x);
  // (No "a" to count by: "two sets of house keys", "two cans of pepper spray"; anything else, listed as many times as there are.)
  if (!m) return /(rounds|shells)$/i.test(bare) ? [`${NUMBER[k] ?? k} boxes of ${bare}${where}`] : /keys$/i.test(bare) ? [`${NUMBER[k] ?? k} sets of ${bare}${where}`] : /spray$/i.test(bare) ? [`${NUMBER[k] ?? k} cans of ${bare}${where}`] : [x];
  const body = m[1];
  if (/spray$/i.test(body)) return [`${NUMBER[k] ?? k} cans of ${body}${where}`];
  const of = body.search(/ of /);
  const head = of >= 0 ? body.slice(0, of) : body;
  const rest = of >= 0 ? body.slice(of) : '';
  const words = head.split(' ');
  const last = words[words.length - 1];
  if (!/[^s]s$/i.test(last)) words[words.length - 1] = pluralWord(last);
  return [`${NUMBER[k] ?? k} ${words.join(' ')}${rest}${where}`];
}

function end(result: Result) {
  delete enc.chase;
  enc.stage = 'over';
  enc.result = result;
  if (result !== 'killed' && result !== 'lost') bleedOut();
}

/**
 * However it ends, someone left bleeding badly may not make it: out cold
 * with nobody pressing on it, or awake and trying to stop it themselves
 * (better odds). A few hours, unless it clots.
 */
function bleedOut() {
  const T = enc.them;
  // (Beaten past saving: walking off straight away doesn't change it.)
  if (!T.dead && T.out && T.awake <= -100) {
    T.dead = true;
    return;
  }
  if (T.dead || T.bleeding < (T.out ? 1 : 2)) return;
  let blood = T.blood;
  let bleed = T.bleeding;
  const press = T.out ? 0 : 0.2;
  for (let hr = 0; hr < 3 && bleed > 0; hr++) {
    blood -= ([0, 60, 200, 600, 1200][bleed] * T.maxBlood) / 5000;
    if (blood <= T.maxBlood * DEATH) {
      T.dead = true;
      T.out = true;
      T.down = true;
      T.bleeding = 0;
      T.blood = Math.round(blood);
      return;
    }
    if (Math.random() < Math.min(0.95, [0, 0.9, 0.7, 0.45, 0.25][bleed] + press)) bleed--;
  }
  T.blood = Math.round(blood);
  T.bleeding = bleed;
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
    Brutal: "You'd be taking a real risk.",
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
