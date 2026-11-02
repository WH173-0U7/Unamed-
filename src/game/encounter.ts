import { AWARENESS, BUILDS, NAMES, type Item, type Loot, type Person } from './person';
import { lootLabel, take, type Inventory } from './inventory';
import {
  STAT_NAMES,
  accuracyBonus,
  ambushBonus,
  damageMult,
  dodgeBonus,
  noticeRate,
  staminaRegen,
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
export type Result = 'won' | 'lost' | 'they-fled' | 'you-fled' | 'lost-them' | 'left' | 'walked' | 'killed';
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
}

export interface LogLine {
  by: Side | 'info';
  text: string;
}

/** Someone's body in a fight. */
export interface Body {
  /** Blood (ml). Passes out at or below 55% of `maxBlood`. */
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
  /** Turns left half blind (pepper spray). */
  blinded: number;
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
}

export interface Encounter {
  version: number;
  person: Person;
  stage: Stage;
  /** How close you are: 0 across the street, 1 behind them, 2 right on them. */
  distance: number;
  /** How close they are to noticing you (0..100). */
  suspicion: number;
  known: { build: boolean; carrying: boolean; awareness: boolean; sex: boolean };
  you: Body;
  them: Body & { weaponOut: string | null; sprayed: boolean };
  log: LogLine[];
  result: Result | null;
}

export interface Option {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  /** Which tab it's under. Options without one are always shown, below the tabs. */
  cat?: Category;
}

/** The tabs the options are sorted into. */
export type Category = 'surveil' | 'violence' | 'attack' | 'stomp' | 'search' | 'move';
export const CATEGORY_NAMES: Record<Category, string> = {
  surveil: 'Surveil',
  violence: 'Violence',
  attack: 'Attack',
  stomp: 'Stomp',
  search: 'Search',
  move: 'Move',
};
const SURVEIL_IDS = ['follow', 'build', 'carrying', 'awareness', 'sex'];
const VIOLENCE_IDS = ['bumrush', 'sucker', 'shove'];

/** Can you go through their clothes? Only once they can't stop you. */
export const searchable = (e: Encounter) => !!(e.them.out || e.them.dead) && (!e.you.down || e.stage === 'over');

/** Searching: each garment, then whatever you found in it to take. */
function searchOptions(e: Encounter): Option[] {
  const found: Option[] = [];
  const todo: Option[] = [];
  e.person.clothes.forEach((g, gi) => {
    if (!g.searched) todo.push({ id: `search:${gi}`, label: `Search their ${g.name.toLowerCase()}`, cat: 'search' });
    else g.loot.forEach((l, li) => found.push({ id: `take:${gi}:${li}`, label: lootLabel(l), hint: l.where === 'wallet' ? 'In their wallet' : `${g.name}, ${l.where}`, cat: 'search' }));
  });
  const all: Option[] = found.length > 1 ? [{ id: 'take-all', label: 'Take everything', hint: `${found.length} things`, cat: 'search' }] : [];
  const out = [...all, ...found, ...todo];
  return out.length ? out : [{ id: 'nothing', label: 'Nothing left on them', disabled: true, cat: 'search' }];
}

/** At or below this share of their blood, people pass out. */
export const PASS_OUT = 0.55;
/** Someone unconscious dies when their blood falls this low (a fraction of all of it). */
export const DEATH = 0.4;
export const BLEEDING = ['None', 'Light', 'Moderate', 'Heavy', 'Severe'];
/** Blood lost per turn at each level of bleeding, per 5 litres of blood. */
const BLEED_ML = [0, 35, 80, 150, 260];
const COST = { punch: 8, kick: 14, grapple: 12, weapon: 10, run: 15, getUp: 10, ambush: 10 };

function body(blood: number, toughness: number, stamina: number): Body {
  return {
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
  const b = BUILDS[person.build];
  const tired = person.kind === 'junkie' || person.kind === 'drunk' ? 0.8 : 1;
  return {
    version: ENCOUNTER_VERSION,
    person,
    stage: 'seen',
    distance: 0,
    suspicion: 0,
    known: { build: false, carrying: false, awareness: false, sex: false },
    you: yours,
    them: { ...body(b.blood, b.hp, Math.round(b.stamina * tired)), weaponOut: null, sprayed: false },
    log: [],
    result: null,
  };
}

const DISTANCE = ['Across the street', 'Behind them', 'Right on them'];
export const distanceLabel = (e: Encounter) => DISTANCE[e.distance];

/** The states someone is in, for showing (e.g. "On the floor", "Bleeding: Heavy"). */
export function conditions(f: Body): string[] {
  const c: string[] = [];
  c.push(f.out ? 'Unconscious' : f.down ? 'On the floor' : 'Standing');
  if (f.winded) c.push('Winded');
  if (f.dazed > 0) c.push('Dazed');
  if (f.concussed) c.push('Concussed');
  if (f.bleeding) c.push(`Bleeding: ${BLEEDING[f.bleeding]}`);
  if (f.lung) c.push('Punctured lung');
  for (const p of f.broken) c.push(`Broken ${p}`);
  if (f.blinded > 0) c.push('Blinded');
  if (f.stamina <= 0) c.push('Exhausted');
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
export function options(e: Encounter): Option[] {
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
        { id: 'sex', label: 'Male or female?', disabled: e.known.sex, cat: 'surveil' },
        { id: 'bumrush', label: 'Bum rush', hint: 'Knock them down', cat: 'violence' },
        { id: 'sucker', label: 'Sucker punch', hint: 'Hit them in the head', cat: 'violence' },
        { id: 'shove', label: 'Shove', hint: 'Easiest to land', cat: 'violence' },
        { id: 'leave', label: 'Leave them' },
      ];
    case 'combat': {
      const y = e.you;
      const tired = (n: number) => y.stamina < cost(y, n);
      const armHint = arms(y) ? `Broken arm${arms(y) > 1 ? 's' : ''}` : undefined;
      const legHint = legs(y) ? `Broken leg${legs(y) > 1 ? 's' : ''}` : undefined;
      const out = !!e.them.out;
      const run: Option = { id: 'run', label: 'Run', hint: legHint ?? (tired(COST.run) ? 'Too tired' : undefined), cat: 'move' };
      const breathe: Option = { id: 'breathe', label: 'Catch your breath', cat: 'move' };
      const stomps = (why?: string, t = tired(COST.kick)): Option[] => [
        { id: 'stomp-head', label: 'Head', hint: t ? 'Too tired' : (why ?? 'Can knock them out'), disabled: t, cat: 'stomp' },
        { id: 'stomp-stomach', label: 'Stomach', hint: t ? 'Too tired' : (why ?? 'Winds them'), disabled: t, cat: 'stomp' },
        { id: 'stomp-ribs', label: 'Ribs', hint: t ? 'Too tired' : (why ?? 'Can break them'), disabled: t, cat: 'stomp' },
      ];
      if (y.down) {
        return [
          { id: 'punch', label: 'Punch', hint: armHint ?? 'From the floor', cat: 'attack' },
          { id: 'kick', label: 'Kick', hint: tired(COST.kick) ? 'Too tired' : 'From the floor', disabled: tired(COST.kick), cat: 'attack' },
          { id: 'getup', label: 'Get up', hint: legHint ?? (y.dazed ? 'Dazed' : undefined), cat: 'move' },
          out ? { id: 'walk', label: 'Crawl away', hint: "They're unconscious", cat: 'move' } : breathe,
        ];
      }
      if (out) {
        // They're unconscious: it isn't a fight any more. Keep going, go
        // through their pockets, or walk away.
        return [...stomps(), ...searchOptions(e), breathe, { id: 'walk', label: 'Walk away', cat: 'move' }];
      }
      if (e.them.down) return [...stomps(legHint), run, breathe];
      return [
        { id: 'punch', label: 'Punch', hint: armHint, cat: 'attack' },
        { id: 'kick', label: 'Kick', hint: tired(COST.kick) ? 'Too tired' : legHint, disabled: tired(COST.kick), cat: 'attack' },
        { id: 'grapple', label: 'Grapple', hint: tired(COST.grapple) ? 'Too tired' : (armHint ?? 'Take them down'), disabled: tired(COST.grapple), cat: 'attack' },
        run,
        breathe,
      ];
    }
    case 'over':
      return [
        ...(e.them.dead ? searchOptions(e) : []),
        { id: 'lurk', label: 'Lurk again' },
        { id: 'rest', label: 'Rest', hint: 'Let time pass and heal' },
        { id: 'pockets', label: 'Pockets' },
        { id: 'go', label: 'Go somewhere' },
      ];
    default:
      return [];
  }
}

/** Your stats, and a way to train them, for the move being played out. */
let you: { stats: Stats; gain: (name: StatName, xp: number) => void };
let enc: Encounter;
let impacts: Impact[] = [];
const say = (by: LogLine['by'], text: string) => enc.log.push({ by, text });

/** Does one thing (an option id, or 'open' to start from the person button). */
export function act(e: Encounter, id: string, stats: Stats, inv?: Inventory): Impact[] {
  impacts = [];
  enc = e;
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
    search(id, inv);
    // Searching takes a moment, and they go on bleeding.
    if (e.stage === 'combat' && id.startsWith('search:')) endOfRound();
    return impacts;
  }
  if (e.stage === 'over') return impacts;
  const p = e.person;
  const aw = AWARENESS.indexOf(p.awareness);
  const who = NAMES[p.kind].toLowerCase();

  if (id === 'open') {
    if (e.stage === 'seen') {
      e.stage = 'menu';
      say('info', `A ${who}, ${DISTANCE[0].toLowerCase()}. They haven't seen you.`);
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
      e.suspicion += base * [0.4, 0.8, 1.4, 2.0][aw] * (1 + e.distance * 0.4) * (0.7 + Math.random() * 0.6) * noticeRate(stats);
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
      case 'sex':
        e.known.sex = true;
        say('info', `${p.sex}.`);
        watch(3);
        you.gain('sneak', 2);
        break;
    }
    // Getting noticed.
    if (e.suspicion >= 100) {
      spotted();
    } else if (e.suspicion >= 60 && Math.random() < 0.6) {
      say('them', oneOf(['They glance back over their shoulder.', 'They slow down. Listening.', 'They look around, then keep walking.']));
    }
    return impacts;
  }

  // ---------- Violence: the ambush ----------
  if (e.stage === 'violence') {
    const b = BUILDS[p.build];
    // Lands more often the sneakier you are, the less aware they are, and the
    // closer you got first. Bum rush and shove are easier to land than a punch.
    const extra = id === 'shove' ? 0.12 : id === 'bumrush' ? 0.06 : 0;
    const chance = clamp([0.8, 0.65, 0.45, 0.3][aw] + e.distance * 0.06 + ambushBonus(stats) + extra - b.guard * 0.5, 0.05, 0.97);
    if (e.distance === 0) say('you', 'You cross the street toward them.');
    e.stage = 'combat';
    spend('you', COST.ambush);
    you.gain('sneak', 4);
    let theyGoFirst = false;

    if (Math.random() < chance) {
      // It lands.
      you.gain('sneak', 4);
      you.gain('strength', 3);
      const str = damageMult(stats);
      if (id === 'sucker') {
        const dmg = Math.round(roll(16, 24) * (aw === 0 ? 1.3 : 1) * str);
        say('you', `You sucker punch them from behind, on the side of the head. ${wound('them', 'head', dmg, 'punch')}`);
      } else if (id === 'bumrush') {
        const dmg = Math.round(roll(10, 15) * str);
        if (!b.solid) {
          e.them.down = true;
          say('you', `You bum rush them and slam them into the pavement. ${wound('them', 'body', dmg, 'fall')} They're on the floor.`);
        } else {
          say('you', `You bum rush them. They're heavy and hold their ground. ${wound('them', 'body', dmg, 'fall')}`);
          if (Math.random() < 0.35) {
            e.you.down = true;
            say('them', "You bounce off them and land on your back. You're on the floor.");
          } else say('them', 'You bounce off them.');
        }
      } else {
        const dmg = Math.round(roll(4, 8) * str);
        say('you', `You shove them hard into the wall. ${wound('them', 'body', dmg, 'fall')}`);
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
      const move = { sucker: 'punch', bumrush: 'rush', shove: 'shove' }[id] ?? 'move';
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
    switch (id) {
      case 'punch':
        strike('you', 'punch');
        break;
      case 'kick':
        strike('you', 'kick');
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
          0.6 + accuracyBonus(stats) + (stats.strength.level - 1) * 0.02 + (b.solid ? -0.15 : 0.1) - arms(y) * 0.2 - (y.dazed ? 0.2 : 0) + (e.them.dazed ? 0.15 : 0),
          0.05,
          0.95,
        );
        if (Math.random() < odds) {
          const dmg = Math.round(roll(3, 6) * damageMult(stats));
          e.them.down = true;
          say('you', `You get hold of them and throw them down. ${wound('them', 'body', dmg, 'fall')} They're on the floor.`);
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
        y.stamina = Math.min(y.maxStamina, y.stamina + 22);
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
function strike(a: Side, kind: 'punch' | 'kick' | 'weapon' | 'stomp', aim?: Loc) {
  const d: Side = a === 'you' ? 'them' : 'you';
  const A = enc[a];
  const D = enc[d];
  const N = names(a);
  const b = BUILDS[enc.person.build];
  const weapon = kind === 'weapon' ? enc.person.carrying.find((i) => i.name === enc.them.weaponOut) : undefined;
  const tired = A.stamina < A.maxStamina * 0.25;
  spend(a, kind === 'kick' || kind === 'stomp' ? COST.kick : kind === 'weapon' ? COST.weapon : COST.punch);

  // Will it land?
  let hit = kind === 'punch' ? 0.8 : kind === 'kick' ? 0.66 : kind === 'stomp' ? 0.72 : 0.75;
  hit += a === 'you' ? accuracyBonus(you.stats) : 0;
  hit -= d === 'you' ? dodgeBonus(you.stats) : b.guard;
  if (kind === 'kick' || kind === 'stomp') hit -= legs(A) * 0.2;
  else hit -= arms(A) * 0.2; // punches and weapons need your arms
  if (A.dazed) hit -= 0.2;
  if (A.concussed) hit -= 0.1;
  if (A.blinded > 0) hit -= 0.35;
  if (tired) hit -= 0.15;
  if (A.down) hit -= kind === 'kick' ? 0.1 : 0.2;
  if (D.down) hit += 0.2;
  if (D.out) hit = 2; // can't defend themselves
  if (D.dazed) hit += 0.15;
  if (D.offBalance) hit += 0.15;
  D.offBalance = false;
  if (A.offBalance) hit -= 0.15;
  A.offBalance = false;

  if (Math.random() >= clamp(hit, 0.05, 0.95)) {
    if (kind === 'stomp') {
      say(a, `${N.S} stomp down, but ${N.oSub} roll away from it.`);
    } else if (kind === 'kick') {
      say(a, `${N.S} miss the kick and lose ${N.p} balance.`);
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
    return;
  }

  // Where it lands.
  const stomp = kind === 'stomp';
  const loc: Loc = aim ?? pick<Loc>(
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
      ? (stomp ? (loc === 'head' ? roll(11, 17) : loc === 'stomach' ? roll(9, 14) : roll(10, 15)) : kind === 'kick' ? roll(9, 15) : roll(6, 11)) * damageMult(you.stats)
      : b.power + roll(-3, 3) + (kind === 'kick' ? 3 : stomp ? 4 : 0) + (weapon?.weapon ?? 0);
  if (tired) dmg *= 0.75;
  if (A.stamina <= 0) dmg *= 0.7;
  if (A.down) dmg *= 0.6;
  dmg = Math.max(1, Math.round(dmg));

  const where = { head: 'in the face', body: 'in the ribs', stomach: 'in the stomach', arm: 'on the arm', leg: 'in the leg' }[loc];
  let text: string;
  if (kind === 'weapon' && weapon) {
    text = weapon.cuts
      ? `${N.S} slash at ${N.o} with the ${weapon.name.toLowerCase()} and catch ${N.o} ${where}.`
      : `${N.S} hit ${N.o} with the ${weapon.name.toLowerCase()} ${where}.`;
  } else if (stomp) {
    text = { head: `${N.S} stomp on ${N.oP} head.`, stomach: `${N.S} stomp down on ${N.oP} stomach.`, body: `${N.S} stomp down on ${N.oP} ribs.` }[loc as 'head'] ?? `${N.S} stomp on ${N.o}.`;
  } else if (kind === 'kick') {
    text = loc === 'leg' ? `${N.S} kick ${N.o} in the knee.` : `${N.S} kick ${N.o} ${where}.`;
  } else {
    text = loc === 'arm' ? `${N.S} hit ${N.o} on the arm as ${N.oSub} cover up.` : `${N.S} punch ${N.o} ${where}.`;
  }
  say(a, `${text} ${wound(d, loc, dmg, weapon?.cuts ? 'cut' : stomp ? 'stomp' : kind === 'kick' ? 'kick' : 'punch')}`);
  if (a === 'you') {
    you.gain('strength', 3);
    you.gain('agility', 2);
  }
}

/**
 * Damage to a part of someone's body: blood lost, plus whatever else it does
 * (dazed, concussed, bleeding, broken bones, knocked down). Returns the text
 * describing it.
 */
function wound(d: Side, loc: Loc, dmg: number, how: 'punch' | 'kick' | 'cut' | 'fall' | 'stomp'): string {
  const D = enc[d];
  const N = names(d === 'you' ? 'them' : 'you'); // the attacker's view: N.o is the one hurt
  const ml = Math.round((dmg * (D.maxBlood * (1 - PASS_OUT))) / D.toughness);
  D.blood = Math.max(0, D.blood - ml);
  const out: string[] = [`(−${ml} ml)`];
  const re = N.oRe;
  let severe = ml >= 450;
  /** Blood already lost makes passing out more likely. */
  const lost = 1 - D.blood / D.maxBlood;
  const knockOut = (chance: number) => {
    if (!D.out && Math.random() < chance) {
      D.out = true;
      D.down = true;
      severe = true;
      out.push(`${re} out cold.`);
    }
  };
  const breaks = (part: Part, chance: number) => {
    if (D.broken.includes(part) || Math.random() >= chance) return false;
    severe = true;
    D.broken.push(part);
    out.push(
      part === 'nose'
        ? `${N.oP[0].toUpperCase() + N.oP.slice(1)} nose flattens with a crunch: it's broken, and blood pours from it.`
        : part === 'ribs'
          ? `A crack like a snapped branch: ${N.oP} ribs are broken.`
          : `A crack: ${N.oP} ${part} is broken.${Math.random() < 0.3 ? ' Bone shows through the skin.' : ''}`,
    );
    return true;
  };
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
  if (how === 'cut') bleed(Math.random() < 0.4 ? 2 : 1);
  if (D.dazed && how !== 'fall') fall(0.15);
  // What it looks like, sounds like.
  const g = gore(d, loc, how, ml, out.join(' '));
  if (g) out.splice(1, 0, g);
  impacts.push({ target: d, ml, severe, loc });
  return out.join(' ');
}

/**
 * The gruesome detail of a blow: what it does to a face, a chest, a limb.
 * Worse the more blood it costs. `already` is what's been said about it (so a
 * break or a knockout isn't described twice).
 */
function gore(d: Side, loc: Loc, how: string, ml: number, already: string): string {
  const you = d === 'you';
  const P = you ? 'your' : 'their';
  const S = you ? 'You' : 'They';
  const s = you ? 'you' : 'they';
  const tier = ml >= 420 ? 2 : ml >= 220 ? 1 : 0;
  if (how === 'fall') return tier ? `${S} hit the ground hard enough to skin ${P} palms raw.` : '';
  const broke = already.includes('broken');
  const pools: Partial<Record<Loc, string[][]>> = {
    head: [
      [`${P[0].toUpperCase() + P.slice(1)} lip splits against ${P} teeth.`, `${S} taste copper.`, `A cut opens over ${P} eye.`, `${P[0].toUpperCase() + P.slice(1)} cheek swells, purple already.`],
      [`${P[0].toUpperCase() + P.slice(1)} head snaps back, and blood sprays from ${P} mouth.`, `${P[0].toUpperCase() + P.slice(1)} eyebrow splits open and blood runs into ${P} eye.`, `A tooth comes loose; ${s} spit it out in a string of blood.`],
      [`Something in ${P} face caves in with a wet crunch.`, `${P[0].toUpperCase() + P.slice(1)} jaw hangs wrong, and blood pours over ${P} chin.`, `${P[0].toUpperCase() + P.slice(1)} skull bounces off the pavement with a hollow knock.`, `${S} choke on ${P} own blood, teeth scattered on the ground.`],
    ],
    body: [
      [`${S} fold around it with a grunt.`, `The air goes out of ${P} chest in a rush.`],
      [`It lands with a deep, heavy thud.`, `${S} cough, and there's blood in it.`],
      [`Bone grinds against bone.`, `${S} cough up a mouthful of dark blood.`],
    ],
    stomach: [
      [`${S} double over, retching.`],
      [`${S} retch up bile and spit.`, `${S} vomit onto the pavement.`],
      [`${S} retch, and it comes up red.`, `Something tears inside ${P} gut. ${S} make a sound like a kicked dog.`],
    ],
    arm: [[`${P[0].toUpperCase() + P.slice(1)} forearm goes numb.`], [`The skin of ${P} arm splits over the bone.`], [`The arm bends where an arm doesn't bend.`]],
    leg: [[`${P[0].toUpperCase() + P.slice(1)} knee buckles.`], [`Something pops in ${P} knee.`], [`The knee twists sideways with a sickening pop.`]],
  };
  if (how === 'cut') {
    return oneOf(
      [
        [`The blade opens a shallow gash. Blood beads along it.`, `A thin red line opens, then starts to run.`],
        [`The cut is deep. Blood sheets down ${P} skin.`, `It opens ${P} skin like a zip. ${S} can see the white of fat.`],
        [`The blade goes in deep and comes out red to the handle.`, `Blood pumps from the wound in thick spurts.`],
      ][tier],
    );
  }
  const pool = pools[loc]?.[broke ? Math.max(tier, 1) : tier];
  if (!pool || (tier === 0 && Math.random() < 0.4)) return '';
  return oneOf(pool);
}

/** Their move in a fight. */
function theirTurn() {
  const e = enc;
  const p = e.person;
  const b = BUILDS[p.build];
  const T = e.them;
  if (T.out) return; // unconscious
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
  const wants = (p.kind === 'civilian' || p.kind === 'junkie' ? 0.2 : 0.12) * (1 - tough * 0.25);
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
  if (spray && !T.sprayed && Math.random() < 0.6) {
    T.sprayed = true;
    e.you.blinded = 2;
    say('them', 'They pepper spray you in the face. You can barely see.');
    return;
  }
  // Pulling a weapon.
  const weapon: Item | undefined = p.carrying.find((i) => i.weapon);
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
  const regen = { you: staminaRegen(you.stats), them: 7 };
  for (const side of ['you', 'them'] as Side[]) {
    const f = enc[side];
    if (f.bleeding) f.blood = Math.max(0, f.blood - Math.round((BLEED_ML[f.bleeding] * f.maxBlood) / 5000));
    const cap = staminaCap(f);
    f.stamina = Math.round(Math.min(Math.max(cap, 0), f.stamina + regen[side] * (f.lung ? 0.1 : f.broken.includes('ribs') ? 0.2 : 1)));
    // Broken ribs: shallow, stabbing breaths, and sometimes a coughing fit.
    if (!f.out && f.broken.includes('ribs') && Math.random() < (f.lung ? 0.45 : 0.2)) {
      f.stamina = Math.max(0, f.stamina - (f.lung ? 14 : 7));
      say(side, f.lung ? oneOf(side === 'you' ? ['You cough, and it comes up pink and frothy. You can\'t get any air.', 'Every breath bubbles in your chest.'] : ['They cough up pink froth, wheezing.', 'Their breathing bubbles wetly in their chest.']) : side === 'you' ? oneOf(['Every breath is a knife in your side.', 'You try to breathe deep and your ribs scream.']) : oneOf(['They clutch their side, breathing in short, painful gasps.', 'They wince with every breath.']));
    }
    if (f.dazed > 0) f.dazed--;
    if (side === 'you') f.winded = false;
  }
  enc.them.blinded = 0;
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
  const wasOut = !!T.out;
  if (!T.out && T.blood <= T.maxBlood * PASS_OUT) {
    T.out = true;
    T.down = true;
    say('you', T.bleeding >= 3 ? "They've lost too much blood. They slump to the floor, unconscious." : "They go down and don't get up. They're unconscious.");
  }
  if (T.out && !T.outNoted) {
    T.outNoted = true;
    say('info', "They're unconscious. They can't fight back.");
  }
  // Unconscious and still losing blood: they can bleed out.
  if (wasOut && T.blood <= T.maxBlood * DEATH) {
    T.dead = true;
    T.bleeding = 0;
    say('you', oneOf(["Their chest stops moving. The blood around them stops spreading. They're dead.", "One last rattling breath, then nothing. They've bled out."]));
    end('killed');
    return true;
  }
  if (T.out && !T.dyingNoted && T.blood <= T.maxBlood * (DEATH + 0.07)) {
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
  const fight = tough * 0.2 + (p.kind === 'drunk' ? 0.3 : 0) + (p.awareness === 'Paranoid' ? 0.15 : 0);
  if (Math.random() < fight) {
    say('them', oneOf(['They spin around. "The hell do you want?" They come at you.', "They spot you, and they don't run. They come straight for you."]));
    enc.stage = 'combat';
    say('info', 'The fight is on.');
    theirTurn();
    endOfRound();
  } else {
    say('them', oneOf(['They spot you and bolt. Gone.', 'They see you. They run, and you lose them.']));
    end('lost-them');
  }
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
    const parts = loose.map((l) => `${a(lootLabel(l).toLowerCase())} (${l.where})`);
    if (wallet.length) parts.unshift(`a wallet with ${list(wallet.map((l) => a(lootLabel(l).toLowerCase())))}`);
    say('you', `You go through their ${g.name.toLowerCase()} and find ${list(parts)}.`);
    return;
  }
  if (!inv) return;
  const grab = (g: (typeof clothes)[number], l: Loot) => {
    say('you', take(inv, l));
    g.loot.splice(g.loot.indexOf(l), 1);
  };
  if (id === 'take-all') {
    const lines: string[] = [];
    let cash = 0;
    for (const g of clothes) {
      if (!g.searched) continue;
      for (const l of [...g.loot]) {
        take(inv, l);
        if (l.kind === 'cash') cash += l.cash ?? 0;
        else lines.push(a(l.name.toLowerCase()));
        g.loot.splice(g.loot.indexOf(l), 1);
      }
    }
    if (cash) lines.unshift(`$${Math.round(cash * 100) / 100} in cash`);
    if (lines.length) say('you', `You take everything: ${list(lines)}.`);
    return;
  }
  const [, gi, li] = id.split(':').map(Number);
  const g = clothes[gi];
  const l = g?.loot[li];
  if (g && l) grab(g, l);
}

const a = (s: string) => (/^(cash|loose|groceries|house keys|car keys|cigarettes|headphones|some )/.test(s) ? s : /^[aeiou]/.test(s) ? `an ${s}` : `a ${s}`);
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
