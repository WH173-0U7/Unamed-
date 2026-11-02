import { AWARENESS, BUILDS, NAMES, type Item, type Person } from './person';
import {
  STAT_NAMES,
  accuracyBonus,
  ambushBonus,
  damageMult,
  dodgeBonus,
  noticeRate,
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
 * - **Combat:** turn by turn (punch, kick, grapple, run), with a log of what
 *   happens to them and to you.
 */

export type Stage = 'seen' | 'menu' | 'surveil' | 'violence' | 'combat' | 'over';
export type Result = 'won' | 'lost' | 'they-fled' | 'you-fled' | 'lost-them' | 'left';

export interface LogLine {
  by: 'you' | 'them' | 'info';
  text: string;
}

export interface Fighter {
  hp: number;
  max: number;
  /** Loses their next turn. */
  stunned: boolean;
  /** Their next attack is easier to land on / weaker. */
  offBalance: boolean;
}

export interface Encounter {
  person: Person;
  stage: Stage;
  /** How close you are: 0 across the street, 1 behind them, 2 right on them. */
  distance: number;
  /** How close they are to noticing you (0..100). */
  suspicion: number;
  known: { build: boolean; carrying: boolean; awareness: boolean; sex: boolean };
  you: Fighter & { blinded: number };
  them: Fighter & { weaponOut: string | null; sprayed: boolean };
  log: LogLine[];
  result: Result | null;
}

export interface Option {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

const YOUR_HP = 100;

export function newEncounter(person: Person): Encounter {
  const b = BUILDS[person.build];
  return {
    person,
    stage: 'seen',
    distance: 0,
    suspicion: 0,
    known: { build: false, carrying: false, awareness: false, sex: false },
    you: { hp: YOUR_HP, max: YOUR_HP, stunned: false, offBalance: false, blinded: 0 },
    them: { hp: b.hp, max: b.hp, stunned: false, offBalance: false, weaponOut: null, sprayed: false },
    log: [],
    result: null,
  };
}

const DISTANCE = ['Across the street', 'Behind them', 'Right on them'];
export const distanceLabel = (e: Encounter) => DISTANCE[e.distance];

/** What you can do right now. */
export function options(e: Encounter): Option[] {
  switch (e.stage) {
    case 'menu':
      return [
        { id: 'violence', label: 'Violence' },
        { id: 'surveil', label: 'Surveil' },
        { id: 'leave', label: 'Leave them' },
      ];
    case 'surveil':
      return [
        { id: 'follow', label: e.distance < 2 ? 'Follow' : 'Keep following', hint: e.distance < 2 ? 'Get closer' : undefined },
        { id: 'build', label: 'Size up their build', disabled: e.known.build },
        { id: 'carrying', label: 'What are they carrying?', disabled: e.known.carrying, hint: e.distance < 1 ? 'Need to be closer' : undefined },
        { id: 'awareness', label: 'How aware are they?', disabled: e.known.awareness },
        { id: 'sex', label: 'Male or female?', disabled: e.known.sex },
        { id: 'back', label: 'Back' },
      ];
    case 'violence':
      return [
        { id: 'bumrush', label: 'Bum rush' },
        { id: 'sucker', label: 'Sucker punch' },
        { id: 'shove', label: 'Shove' },
        { id: 'back', label: 'Back' },
      ];
    case 'combat':
      return [
        { id: 'punch', label: 'Punch' },
        { id: 'kick', label: 'Kick' },
        { id: 'grapple', label: 'Grapple' },
        { id: 'run', label: 'Run' },
      ];
    case 'over':
      return [{ id: 'lurk', label: 'Lurk again' }];
    default:
      return [];
  }
}

/** Your stats, and a way to train them, for the move being played out. */
let you: { stats: Stats; gain: (name: StatName, xp: number) => void };

/** Does one thing (an option id, or 'open' to start from the person button). */
export function act(e: Encounter, id: string, stats: Stats) {
  if (e.stage === 'over') return;
  const say = (by: LogLine['by'], text: string) => e.log.push({ by, text });
  you = {
    stats,
    gain(name, xp) {
      const up = train(stats, name, xp);
      if (up) say('info', `${STAT_NAMES[name]} went up to ${up}.`);
    },
  };
  const p = e.person;
  const aw = AWARENESS.indexOf(p.awareness);
  const who = NAMES[p.kind].toLowerCase();
  const strong = (dmg: number) => Math.round(dmg * damageMult(stats));

  if (id === 'open') {
    if (e.stage === 'seen') {
      e.stage = 'menu';
      say('info', `A ${who}, ${DISTANCE[0].toLowerCase()}. They haven't seen you.`);
    }
    return;
  }

  if (e.stage === 'menu') {
    if (id === 'violence' || id === 'surveil') e.stage = id;
    if (id === 'leave') {
      say('info', 'You let them go.');
      end(e, 'left');
    }
    return;
  }
  if (id === 'back' && (e.stage === 'surveil' || e.stage === 'violence')) {
    e.stage = 'menu';
    return;
  }

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
          return;
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
      spotted(e);
    } else if (e.suspicion >= 60 && Math.random() < 0.6) {
      say('them', oneOf(['They glance back over their shoulder.', 'They slow down. Listening.', 'They look around, then keep walking.']));
    }
    return;
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
    you.gain('sneak', 4);
    let theyGoFirst = false;

    if (Math.random() < chance) {
      // It lands.
      you.gain('sneak', 4);
      you.gain('strength', 3);
      if (id === 'sucker') {
        const dmg = strong(roll(16, 24) * (aw === 0 ? 1.3 : 1));
        hurt(e.them, dmg);
        say('you', `You sucker punch them from behind. ${blow(dmg)} (−${dmg})`);
        if (aw <= 1) {
          e.them.stunned = true;
          say('them', "They're dazed.");
        }
      } else if (id === 'bumrush') {
        const dmg = strong(roll(10, 15));
        hurt(e.them, dmg);
        if (!b.solid) {
          e.them.stunned = true;
          say('you', `You bum rush them and slam them into the pavement. (−${dmg})`);
        } else {
          const back = roll(3, 6);
          hurt(e.you, back);
          say('you', `You bum rush them. They're heavy and hold their ground. (−${dmg})`);
          say('them', `You bounce off them. (−${back} you)`);
        }
      } else {
        const dmg = strong(roll(4, 8));
        hurt(e.them, dmg);
        say('you', `You shove them hard into the wall. (−${dmg})`);
        if (Math.random() < 0.7) {
          e.them.stunned = true;
          say('them', 'They lose their footing.');
        } else e.them.offBalance = true;
      }
    } else {
      // They react in time: block, dodge, or counter. Heavy builds tend to
      // block, quick ones to dodge, alert ones to counter.
      const how = pickWeighted<'block' | 'dodge' | 'counter'>([
        ['block', b.solid ? 3 : 1],
        ['dodge', 1 + b.guard * 10],
        ['counter', aw >= 2 ? 2 : 0.6],
      ]);
      const move = { sucker: 'punch', bumrush: 'rush', shove: 'shove' }[id] ?? 'move';
      if (how === 'block') {
        const dmg = strong(roll(2, 5));
        hurt(e.them, dmg);
        say('them', `They turn just in time and block your ${move}. (−${dmg})`);
      } else if (how === 'dodge') {
        say('them', `They hear you coming and dodge your ${move}. You stumble past.`);
        e.you.offBalance = true;
        theyGoFirst = true;
      } else {
        const dmg = Math.max(1, Math.round(b.power * 1.3) + roll(-2, 2));
        hurt(e.you, dmg);
        say('them', `They see it coming and counter: a hard hit straight back at you. (−${dmg} you)`);
      }
    }
    check(e);
    if (e.stage === 'combat') {
      say('info', 'The fight is on.');
      if (theyGoFirst) theirTurn(e);
      check(e);
    }
    return;
  }

  // ---------- Combat ----------
  if (e.stage === 'combat') {
    const b = BUILDS[p.build];
    const blind = e.you.blinded > 0 ? 0.35 : 0;
    const open = e.them.offBalance || e.them.stunned ? 0.15 : 0;
    const aim = accuracyBonus(stats) - blind + open - b.guard;
    if (e.you.blinded > 0) e.you.blinded--;
    const landed = () => {
      you.gain('strength', 3);
      you.gain('agility', 2);
    };
    switch (id) {
      case 'punch': {
        if (Math.random() < 0.82 + aim) {
          const dmg = strong(roll(6, 11));
          hurt(e.them, dmg);
          say('you', `${oneOf(['You catch them on the jaw.', 'A punch to the gut.', 'You hit them square in the face.', 'A short jab lands.'])} (−${dmg})`);
          landed();
        } else say('you', oneOf(['Your punch glances off.', 'They slip the punch.', 'You miss.']));
        break;
      }
      case 'kick': {
        if (Math.random() < 0.66 + aim) {
          const dmg = strong(roll(9, 15));
          hurt(e.them, dmg);
          say('you', `${oneOf(['A kick to the knee buckles them.', 'You kick them in the ribs.', 'Your kick lands hard.'])} (−${dmg})`);
          landed();
        } else {
          say('you', 'You miss the kick and lose your balance.');
          e.you.offBalance = true;
        }
        break;
      }
      case 'grapple': {
        const odds = 0.6 + aim + (b.solid ? -0.15 : 0.1) + (stats.strength.level - 1) * 0.02;
        if (Math.random() < odds) {
          const dmg = strong(roll(3, 6));
          hurt(e.them, dmg);
          e.them.stunned = true;
          say('you', `You get hold of them and wrench them down. (−${dmg})`);
          landed();
        } else say('you', b.solid ? "You grab them, but they're too strong. They shake you off." : 'They twist out of your grip.');
        break;
      }
      case 'run':
        if (Math.random() < 0.6 + (e.them.stunned ? 0.3 : 0) + accuracyBonus(stats)) {
          say('you', 'You break away and run. You lose them in the dark.');
          you.gain('agility', 2);
          end(e, 'you-fled');
          return;
        }
        say('you', "You try to run, but they're on you.");
        break;
    }
    e.them.offBalance = false;
    check(e);
    if (e.stage === 'combat') theirTurn(e);
    check(e);
  }
}

/** They noticed you following them: they run, or come at you. */
function spotted(e: Encounter) {
  const p = e.person;
  const b = BUILDS[p.build];
  const tough = ['Easy', 'Fair', 'Hard', 'Brutal'].indexOf(b.difficulty);
  const fight = tough * 0.2 + (p.kind === 'drunk' ? 0.3 : 0) + (p.awareness === 'Paranoid' ? 0.15 : 0);
  if (Math.random() < fight) {
    e.log.push({ by: 'them', text: oneOf(['They spin around. "The hell do you want?" They come at you.', 'They spot you, and they don\'t run. They come straight for you.']) });
    e.stage = 'combat';
    e.log.push({ by: 'info', text: 'The fight is on.' });
    theirTurn(e);
    check(e);
  } else {
    e.log.push({ by: 'them', text: oneOf(['They spot you and bolt. Gone.', 'They see you. They run, and you lose them.']) });
    end(e, 'lost-them');
  }
}

/** Their move in a fight. */
function theirTurn(e: Encounter) {
  const p = e.person;
  const b = BUILDS[p.build];
  const say = (text: string) => e.log.push({ by: 'them', text });
  if (e.them.stunned) {
    e.them.stunned = false;
    say(oneOf(['They\'re still reeling.', 'They struggle to get up.']));
    return;
  }
  // Losing badly: some run for it.
  const tough = ['Easy', 'Fair', 'Hard', 'Brutal'].indexOf(b.difficulty);
  const flee = (p.kind === 'civilian' || p.kind === 'junkie' ? 0.18 : 0.1) * (1 - tough * 0.25);
  if (e.them.hp < e.them.max * 0.3 && Math.random() < flee) {
    say('They scramble away and run. They\'re gone.');
    end(e, 'they-fled');
    return;
  }
  // Pepper spray, once.
  const spray = p.carrying.find((i) => i.spray);
  if (spray && !e.them.sprayed && Math.random() < 0.6) {
    e.them.sprayed = true;
    e.you.blinded = 2;
    say('They pepper spray you in the face. You can barely see.');
    return;
  }
  // Pulling a weapon.
  const weapon: Item | undefined = p.carrying.find((i) => i.weapon);
  if (weapon && !e.them.weaponOut && Math.random() < 0.5) {
    e.them.weaponOut = weapon.name;
    say(`They pull out a ${weapon.name.toLowerCase()}.`);
    return;
  }
  const hit = 0.7 + (e.you.offBalance ? 0.15 : 0) - (e.them.offBalance ? 0.2 : 0) - dodgeBonus(you.stats);
  e.you.offBalance = false;
  if (Math.random() < hit) {
    const bonus = e.them.weaponOut ? (p.carrying.find((i) => i.name === e.them.weaponOut)?.weapon ?? 0) : 0;
    const dmg = Math.max(1, b.power + roll(-3, 3) + bonus);
    hurt(e.you, dmg);
    const how = e.them.weaponOut
      ? `They come at you with the ${e.them.weaponOut.toLowerCase()}.`
      : oneOf(['They hit you in the face.', 'A fist to your ribs.', 'They catch you with a wild swing.', 'They knee you in the stomach.']);
    say(`${how} (−${dmg} you)`);
  } else {
    say(oneOf(['They swing and miss.', 'You duck their swing.', 'They lunge. You step aside.']));
    you.gain('agility', 3);
  }
}

function check(e: Encounter) {
  if (e.stage !== 'combat') return;
  if (e.them.hp <= 0) {
    e.log.push({ by: 'you', text: 'They go down, and stay down.' });
    end(e, 'won');
  } else if (e.you.hp <= 0) {
    e.log.push({ by: 'them', text: 'You hit the pavement. Everything goes dark.' });
    end(e, 'lost');
  }
}

function end(e: Encounter, result: Result) {
  e.stage = 'over';
  e.result = result;
}

function hurt(f: Fighter, dmg: number) {
  f.hp = Math.max(0, Math.round(f.hp - dmg));
}

function blow(dmg: number) {
  return dmg > 22 ? 'They crumple.' : 'They stagger.';
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

function pickWeighted<T>(table: [T, number][]): T {
  let r = Math.random() * table.reduce((n, [, c]) => n + c, 0);
  for (const [v, c] of table) if ((r -= c) < 0) return v;
  return table[table.length - 1][0];
}
