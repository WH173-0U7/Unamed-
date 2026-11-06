import { BLEEDING, DEATH, PASS_OUT, STRESS_NAMES, stressLevel, type Body, type Marks, type Part, type Result } from './encounter';

/**
 * Your body between fights. Blood, bleeding, broken bones and concussion
 * carry over from one person to the next, and heal slowly with time: every
 * lurk passes about an hour, and resting passes several. Stamina, being
 * dazed and being on the floor don't carry over (you get your breath back
 * and get up once it's over).
 */
export interface Health {
  blood: number;
  maxBlood: number;
  /** 0 none .. 4 severe. */
  bleeding: number;
  broken: Part[];
  /** Hours left until each broken bone has healed. */
  mending: Partial<Record<Part, number>>;
  /** Hours left until a concussion clears (0: not concussed). */
  concussion: number;
  /** A broken rib went into a lung; it heals when the ribs do. */
  lung?: boolean;
  /** Broken limbs already set in a splint (a second splint does nothing). */
  splinted?: Part[];
  /** You bled out. The run is over. */
  dead?: boolean;
  /** Soaked and cold from the rain: 0 fine, 1 chilled, 2 cold, 3 freezing. */
  cold?: number;
  /** On cocaine (or meth): the next fight, you've energy to burn and feel less. */
  wired?: boolean;
  wiredBy?: 'coke' | 'meth';
  /** When being wired wears off (real time). */
  wiredUntil?: number;
  /** On something from a syringe, until this time (ms, real clock). */
  high?: 'heroin' | 'fentanyl' | 'meth' | 'tranq';
  highUntil?: number;
  /** Caffeine taken (mg) and when (ms, real clock): see caffeineNow. */
  caffeine?: { mg: number; at: number }[];
  /** How drunk you are (0..100), as of `drunkAt` (it wears off on the real clock). */
  drunk?: number;
  drunkAt?: number;
  /** Stress, 0..100 (see encounter.ts addStress): eases with time and cigarettes. */
  stress?: number;
  /** How used to violence you are, 0..100: at 100 it doesn't stress you. */
  nerve?: number;
  /** Smoking a cigarette until this time (ms, real clock). */
  smokingUntil?: number;
  /** Teeth gone, scars, a split lip... (see Marks), and hours until the ones that heal do. */
  marks?: Marks;
  /** Cuts the ER stitched (they heal to a faint line, not a scar). */
  stitched?: { brow?: boolean; lip?: boolean };
  /** The ER set your broken nose (once is all it takes). */
  noseSet?: boolean;
  markHours?: Partial<Record<HealingMark, number>>;
}

type HealingMark = 'lip' | 'cheek' | 'eye' | 'brow' | 'jaw';
/** Hours for a mark to heal (game time). A cut brow leaves a scar. */
export const MARK_HOURS: Record<HealingMark, number> = { lip: 24, cheek: 36, eye: 72, brow: 96, jaw: 400 };

/** Stress lost per hour of game time (more when resting). */
const STRESS_EASE = 6;

export const COLD_NAMES = ['', 'Chilled', 'Cold', 'Freezing'];
export const DRUNK_NAMES = ['', 'Tipsy', 'Drunk', 'Wasted', 'Blackout'];

// ---------- Caffeine ----------
/**
 * Caffeine, the way it really goes: each dose is absorbed over about 45
 * minutes (peaking then), and the body clears half of what's there every 5
 * hours, on the real clock. Doses add up. Returns mg in you now.
 */
const ABSORB_MS = 45 * 60_000;
const HALF_LIFE_MS = 5 * 3_600_000;
export function caffeineNow(h: Health, t = Date.now()): number {
  if (!h.caffeine?.length) return 0;
  let mg = 0;
  for (const d of h.caffeine) {
    const dt = Math.max(0, t - d.at);
    mg += d.mg * Math.min(1, dt / ABSORB_MS) * Math.pow(0.5, dt / HALF_LIFE_MS);
  }
  // Forget doses that have all but gone (after about a day and a half).
  h.caffeine = h.caffeine.filter((d) => d.mg * Math.pow(0.5, Math.max(0, t - d.at) / HALF_LIFE_MS) > 2 && d.at <= t + 60_000);
  if (!h.caffeine.length) delete h.caffeine;
  return mg;
}
export function addCaffeine(h: Health, mg: number, t = Date.now()) {
  (h.caffeine ??= []).push({ mg, at: t });
  useHabit(h, 'caffeine', (mg / 100) * 3, t);
}
/** What it's doing to you, by how much is in you. */
export const caffeineLevel = (mg: number) => (mg >= 600 ? 3 : mg >= 400 ? 2 : mg >= 40 ? 1 : 0);
export const CAFFEINE_NAMES = ['', 'Alert', 'Jittery', 'Heart racing'];
/** To landing and dodging blows: sharper up to a point, then shaking. */
export const caffeineEdge = (mg: number) => (mg < 40 ? 0 : mg < 400 ? (Math.min(mg, 250) / 250) * 0.04 : Math.max(-0.1, 0.04 - ((mg - 400) / 200) * 0.06));
export const drunkLevel = (d: number) => (d >= 80 ? 4 : d >= 55 ? 3 : d >= 30 ? 2 : d >= 10 ? 1 : 0);
/** Sobering up: 20 points an hour, real time. */
export function soberUp(h: Health, t = Date.now()) {
  if (!h.drunk) return;
  const at = Math.min(h.drunkAt ?? t, t);
  h.drunk = Math.max(0, h.drunk - ((t - at) / 3_600_000) * 20);
  h.drunkAt = t;
  if (h.drunk < 0.5) {
    delete h.drunk;
    delete h.drunkAt;
  }
}
/** How long a high lasts (real hours). */
export const HIGH_HOURS = { heroin: 2, fentanyl: 2, meth: 4, tranq: 1 } as const;

/** Hours for each kind of break to heal. */
const MEND_HOURS: Record<Part, number> = {
  nose: 8,
  ribs: 16,
  'left arm': 24,
  'right arm': 24,
  'left leg': 24,
  'right leg': 24,
};
const CONCUSSION_HOURS = 6;
/** Blood lost per hour at each level of bleeding. */
const BLEED_PER_HOUR = [0, 60, 200, 600, 1200];
/** Chance per hour that bleeding eases by a level, by level. */
const CLOT = [0, 0.6, 0.45, 0.3, 0.15];
/** Blood your body makes back per hour (when not bleeding). */
const REGEN_PER_HOUR = 140;
/** Each lurk passes this many hours; resting passes `REST_HOURS`. */
export const LURK_HOURS = 1;
export const REST_HOURS = 4;

export function newHealth(): Health {
  return { blood: 5000, maxBlood: 5000, bleeding: 0, broken: [], mending: {}, concussion: 0 };
}

/** Anything to heal? */
export const isHurt = (h: Health) => h.blood < h.maxBlood || h.bleeding > 0 || h.broken.length > 0 || h.concussion > 0 || !!h.cold;

/** What's wrong with you, for showing. */
export function healthConditions(h: Health): string[] {
  const c: string[] = [];
  if (h.concussion > 0) c.push('Concussed');
  if (h.bleeding) c.push(`Bleeding: ${BLEEDING[h.bleeding]}`);
  for (const p of h.broken) c.push(`Broken ${p}`);
  if (h.lung) c.push('Punctured lung');
  if (h.cold) c.push(COLD_NAMES[h.cold]);
  if (h.wired) c.push('Wired');
  if (h.high && (h.highUntil ?? 0) > Date.now()) c.push(`High: ${h.high}`);
  soberUp(h);
  if (h.drunk && drunkLevel(h.drunk)) c.push(DRUNK_NAMES[drunkLevel(h.drunk)]);
  const cf = caffeineLevel(caffeineNow(h));
  if (cf) c.push(CAFFEINE_NAMES[cf]);
  const sl = stressLevel(h.stress ?? 0);
  if (sl) c.push(STRESS_NAMES[sl]);
  return c;
}

/** Your body going into a fight. */
export function bodyFrom(h: Health, stamina: number): Body {
  return {
    // Concussed, you're already part of the way there.
    awake: h.concussion > 0 ? 80 : 100,
    blood: h.blood,
    maxBlood: h.maxBlood,
    toughness: 100,
    // Broken ribs: you can't fill your lungs, so you start the fight short of breath.
    // Cold stiffens you; cocaine gives you more than you've got.
    // (In withdrawal, you've less in you, and your hands shake.)
    stamina: Math.round(stamina * (h.lung ? 0.3 : h.broken.includes('ribs') ? 0.5 : 1) * (1 - (h.cold ?? 0) * 0.1) * (h.wired ? 1.25 : 1) * (1 - withdrawalEffects(h).stamina)),
    shakes: withdrawalEffects(h).hit,
    maxStamina: Math.round(stamina * (h.wired ? 1.25 : 1)),
    lung: h.lung,
    stress: h.stress ?? 0,
    smoking: (h.smokingUntil ?? 0) > Date.now(),
    high: h.high && (h.highUntil ?? 0) > Date.now() ? h.high : undefined,
    drunk: (soberUp(h), h.drunk ?? 0),
    caffeine: caffeineNow(h),
    marks: JSON.parse(JSON.stringify(h.marks ?? {})) as Marks,
    nerve: h.nerve ?? 0,
    bleeding: h.bleeding,
    dazed: 0,
    concussed: h.concussion > 0,
    broken: [...h.broken],
    down: false,
    offBalance: false,
    blinded: 0,
  };
}

/** After a fight: what it did to you carries over. Returns lines to show. */
export function afterFight(h: Health, b: Body, result: Result): string[] {
  h.blood = b.blood;
  h.bleeding = b.bleeding;
  for (const p of b.broken) {
    if (!h.broken.includes(p)) {
      h.broken.push(p);
      h.mending[p] = MEND_HOURS[p];
    }
  }
  if (b.concussed && h.concussion <= 0) h.concussion = CONCUSSION_HOURS;
  if (b.lung) h.lung = true;
  h.stress = b.stress ?? h.stress;
  // Stuck with a needle in the fight: it lasts.
  if (b.high && b.dosedHigh) {
    const d = b.high;
    useHabit(h, d === 'meth' ? 'stimulants' : d === 'tranq' ? 'sedatives' : 'opioids', d === 'fentanyl' ? 20 : d === 'heroin' ? 15 : d === 'meth' ? 12 : 10);
    if (d === 'meth') {
      h.wired = true;
      h.wiredBy = 'meth';
      h.wiredUntil = Date.now() + HIGH_HOURS.meth * 3_600_000;
    }
    h.high = d;
    h.highUntil = Date.now() + HIGH_HOURS[d] * 3_600_000;
  }
  // New marks start healing (teeth and scars never do).
  const was = h.marks ?? {};
  h.marks = b.marks ?? was;
  for (const k of Object.keys(MARK_HOURS) as HealingMark[]) if (h.marks[k] && !was[k]) (h.markHours ??= {})[k] = MARK_HOURS[k];
  // Every fight you live through, you get a little more used to it.
  h.nerve = Math.min(100, (b.nerve ?? h.nerve ?? 0) + 2);
  // (Being wired wears off on the clock now, not at the end of a fight.)
  const lines: string[] = [];
  // Something they put in you that hadn't hit yet: it does now.
  if (b.dosing) {
    const d = b.dosing.drug;
    useHabit(h, d === 'meth' ? 'stimulants' : d === 'tranq' ? 'sedatives' : 'opioids', d === 'fentanyl' ? 20 : d === 'heroin' ? 15 : d === 'meth' ? 12 : 10);
    h.high = d;
    h.highUntil = Date.now() + HIGH_HOURS[d] * 3_600_000;
    if (d === 'meth') {
      h.wired = true;
      h.wiredBy = 'meth';
      h.wiredUntil = Date.now() + HIGH_HOURS.meth * 3_600_000;
    }
    lines.push(
      d === 'heroin'
        ? 'Whatever was in that needle hits you now: warmth floods up your arm, and your limbs go heavy.'
        : d === 'fentanyl'
          ? 'What was in the needle hits you like a wall. Every breath is an effort.'
          : d === 'tranq'
            ? 'What was in the needle drags at you: your legs go heavy and the street swims.'
            : 'What was in the needle hits: your heart slams and your jaw locks.',
    );
    // Strong enough, and you're out where you stand.
    if ((d === 'fentanyl' && Math.random() < 0.3) || (d === 'tranq' && Math.random() < 0.5)) {
      lines.push('You sit down hard against a wall, and then you are somewhere else.');
      // (Fentanyl stops people breathing; drink on top makes it likelier.)
      if (d === 'fentanyl' && Math.random() < 0.15 + (h.drunk ?? 0) / 300) {
        h.dead = true;
        lines.push('Your breathing slows. Slower. Then it stops, and nobody comes.');
        return lines;
      }
      lines.push(...passHours(h, 3));
      if (h.dead) return lines;
    }
  }
  if (result === 'lost') {
    // Knocked out by a blow: a minute or two, and you come to, concussed.
    if (b.drugOut && h.blood > h.maxBlood * (PASS_OUT + 0.01)) {
      // Under for hours, not minutes.
      const gone = passHours(h, 1 + Math.floor(Math.random() * 3));
      if (h.dead) return gone;
      return ['You come to on the sidewalk, sick and slow, with no idea how long you were gone.', ...gone, ...(h.bleeding ? ["You're still bleeding."] : []), ...lines];
    }
    if (h.blood > h.maxBlood * (PASS_OUT + 0.01)) {
      h.concussion = Math.max(h.concussion, CONCUSSION_HOURS);
      return ['You come to on the sidewalk a minute or two later, your head ringing. You\'re concussed.', ...(h.bleeding ? ["You're still bleeding."] : []), ...lines];
    }
    // Passed out from blood loss: out for hours, still bleeding. You may not wake up.
    const out = lieThere(h);
    if (!h.dead) out.unshift('You come to on the sidewalk, hours later.');
    return [...out, ...(h.dead ? [] : lines)];
  }
  return lines;
}

/**
 * Unconscious for a few hours, bleeding where you fell. Light bleeding
 * usually clots; heavy bleeding can kill you before it does. If you live,
 * you wake up just strong enough to stand.
 */
function lieThere(h: Health): string[] {
  const off = skipClock(h, 3);
  for (let i = 0; i <= 3; i++) {
    if (i > 0) {
      if (!h.bleeding) break;
      h.blood -= BLEED_PER_HOUR[h.bleeding];
    }
    if (h.blood <= h.maxBlood * DEATH) {
      // Sometimes someone finds you in time and presses on the wound (not
      // once you've lost far too much).
      if (h.blood >= h.maxBlood * 0.3 && Math.random() < 0.5) {
        h.blood = Math.round(h.maxBlood * (PASS_OUT + 0.03));
        h.bleeding = 0;
        if ((h.cold ?? 0) > 0) h.cold = Math.min(3, (h.cold ?? 0) + 1);
        return ['Someone finds you lying there. They press on the wound until the bleeding stops, and leave before you can thank them.'];
      }
      h.blood = Math.max(0, Math.round(h.blood));
      h.dead = true;
      return ['You never wake up. You bleed out where you fell.'];
    }
    // Lying still, a wound clots faster than it does on your feet.
    if (i > 0 && Math.random() < Math.min(0.9, CLOT[h.bleeding] * 2)) h.bleeding--;
  }
  h.blood = Math.round(Math.max(h.blood, h.maxBlood * (PASS_OUT + 0.03)));
  // (Hours lying on the sidewalk: the cold gets into you.)
  if ((h.cold ?? 0) > 0) h.cold = Math.min(3, (h.cold ?? 0) + 1);
  return [h.bleeding ? "You're still bleeding." : 'The blood has dried on you.', ...off];
}

/**
 * Time passing: bleeding drains blood (and slowly stops), blood comes back,
 * bones and concussion mend. Returns lines describing what changed. If you
 * bleed down to passing out, you collapse and wake up later.
 */
export function passHours(h: Health, hours: number, resting = false, clock = true): string[] {
  const lines: string[] = [];
  if (clock) lines.push(...skipClock(h, hours));
  if (resting && h.bleeding) {
    if (Math.random() < [0, 0.85, 0.65, 0.4, 0.2][h.bleeding]) {
      h.bleeding--;
      lines.push(h.bleeding ? 'You press on the wound. The bleeding slows.' : 'You manage to stop the bleeding.');
    } else lines.push('You press on the wound, hard. It keeps coming.');
  }
  // Time takes the edge off.
  if (h.stress) h.stress = Math.max(0, h.stress - hours * STRESS_EASE * (resting ? 1.5 : 1));
  // Cuts and bruises heal; a cut brow leaves a scar.
  for (const [k, left] of Object.entries(h.markHours ?? {}) as [HealingMark, number][]) {
    const now = left - hours * (resting ? 1.5 : 1);
    if (now > 0) h.markHours![k] = now;
    else {
      delete h.markHours![k];
      if (h.marks) {
        h.marks[k] = false;
        if (k === 'brow') (h.marks.scars ??= []).push(h.stitched?.brow ? 'faint line through one eyebrow' : 'eyebrow');
        if (h.stitched && (k === 'brow' || k === 'lip')) delete h.stitched[k];
        if (k === 'jaw') lines.push('Your jaw has knitted. You can open your mouth again.');
      }
    }
  }
  for (let i = 0; i < hours; i++) {
    if (h.bleeding) {
      h.blood -= BLEED_PER_HOUR[h.bleeding];
      if (Math.random() < CLOT[h.bleeding] * (resting ? 1.5 : 1)) {
        h.bleeding--;
        if (!h.bleeding) lines.push('The bleeding has stopped.');
      }
      if (h.blood <= h.maxBlood * PASS_OUT) {
        lines.push("You've lost too much blood. You collapse.");
        lines.push(...lieThere(h));
        if (h.dead) return lines;
        lines.push('You wake up hours later.');
      }
    } else {
      // Freezing, your body has nothing spare to make blood with.
      h.blood = Math.min(h.maxBlood, h.blood + REGEN_PER_HOUR * (resting ? 1.5 : 1) * ((h.cold ?? 0) >= 3 ? 0.4 : (h.cold ?? 0) === 2 ? 0.75 : 1));
    }
    for (const p of [...h.broken]) {
      h.mending[p] = (h.mending[p] ?? MEND_HOURS[p]) - (resting ? 1.5 : 1);
      if (h.mending[p]! <= 0) {
        h.broken = h.broken.filter((x) => x !== p);
        delete h.mending[p];
        h.splinted = h.splinted?.filter((x) => x !== p);
        if (p === 'nose') delete h.noseSet;
        lines.push(`Your ${p} ${p === 'ribs' ? 'have' : 'has'} healed.`);
        if (p === 'ribs' && h.lung) {
          h.lung = false;
          lines.push('You can breathe deep again.');
        }
      }
    }
    if (h.concussion > 0) {
      h.concussion -= resting ? 1.5 : 1;
      if (h.concussion <= 0) {
        h.concussion = 0;
        lines.push('Your head has cleared.');
      }
    }
  }
  h.blood = Math.round(h.blood);
  return lines;
}

/**
 * Hours gone by (resting, a cell, out cold) that the real clock didn't see:
 * a high, being wired, the drink, caffeine, a cigarette and the cravings all
 * move on by as much, so what you're told matches what's on the card.
 */
export function skipClock(h: Health, hours: number): string[] {
  const ms = hours * 3_600_000;
  const t = Date.now();
  const lines: string[] = [];
  clampClock(h, t);
  if (h.highUntil != null) {
    const was = h.highUntil > t;
    h.highUntil -= ms;
    if (h.highUntil <= t) {
      if (was && h.high && h.high !== 'meth') lines.push(`The ${h.high === 'tranq' ? 'tranquilizer' : h.high} has worn off.`);
      delete h.high;
      delete h.highUntil;
    }
  }
  if (h.wiredUntil != null) {
    const was = h.wiredUntil > t;
    h.wiredUntil -= ms;
    if (h.wiredUntil <= t) {
      if (was && h.wired) lines.push(h.wiredBy === 'meth' ? 'The meth has worn off. Your skin crawls, and you feel hollow.' : 'The coke has worn off. You feel hollow.');
      h.wired = false;
      delete h.wiredBy;
      delete h.wiredUntil;
    }
  }
  if (h.smokingUntil != null && (h.smokingUntil -= ms) <= t) delete h.smokingUntil;
  if (h.drunk) {
    soberUp(h, t);
    if (h.drunk) h.drunkAt = (h.drunkAt ?? t) - ms;
    soberUp(h, t);
  }
  for (const d of h.caffeine ?? []) d.at -= ms;
  for (const s of Object.values(habitsOf(h))) {
    if (!s) continue;
    s.last -= ms;
    s.at -= ms;
  }
  return lines;
}

/** A clock set ahead and put right: nothing lasts longer than it can. */
export function clampClock(h: Health, t = Date.now()) {
  if (h.high && h.highUntil != null) h.highUntil = Math.min(h.highUntil, t + HIGH_HOURS[h.high] * 3_600_000);
  if (h.wiredUntil != null) h.wiredUntil = Math.min(h.wiredUntil, t + HIGH_HOURS.meth * 3_600_000);
}

/** One injury, for the stats sheet: what it is, what it does to you, how long it lasts. */
export interface InjuryInfo {
  name: string;
  /** What it does to you, line by line. */
  effects: string[];
  /** How long it has left, and what helps. */
  heals: string;
  /** A state you're in (stress, drink, a drug...), not an injury: shown with its own meter. */
  status?: boolean;
  /** How far along it is: 0..1, with words for the bar. */
  meter?: { k: number; text: string };
  /** A mark on you (a black eye, a scar, missing teeth): not dangerous; shown apart, greyed. */
  mark?: boolean;
}

const hrs = (n: number) => {
  const h = Math.max(1, Math.ceil(n));
  return `${h} hour${h === 1 ? '' : 's'}`;
};
const litres = (ml: number) => `${(ml / 1000).toFixed(2).replace(/\.?0+$/, '')}\u00a0L`;

/**
 * Everything wrong with you and exactly what it does (the same numbers the
 * fights use: see encounter.ts strike, fleeChance, getUpChance, staminaCap,
 * and the police chase in game.ts). Hours are game hours: a lurk is one,
 * resting is four, and resting heals half as fast again.
 */
export function injuryEffects(h: Health, stressNow?: number): InjuryInfo[] {
  const out: InjuryInfo[] = [];
  // Stress: on edge, stressed, panicking.
  const stress = stressNow ?? h.stress ?? 0;
  if (stress >= 1) {
    const sl = stress >= 75 ? 3 : stress >= 45 ? 2 : stress >= 20 ? 1 : 0;
    const p = Math.round(stress / 4);
    out.push({
      name: `Stress: ${['calm enough', 'on edge', 'high', 'panicking'][sl]}`,
      status: true,
      meter: { k: Math.min(1, stress / 100), text: `${Math.round(stress)} / 100` },
      effects: [`Your blows land: −${p}%`, `Dodging their blows: −${p}%`, ...(sl >= 3 ? ['Your hands shake; the world narrows'] : [])],
      heals: `Eases about ${STRESS_EASE} an hour (faster at rest), and quicker with a cigarette, a drink or painkillers.`,
    });
  }
  // Hooked on something, and withdrawal.
  out.push(...habitCards(h));
  // Smoking: a cigarette burning.
  if ((h.smokingUntil ?? 0) > Date.now()) {
    const left = ((h.smokingUntil ?? 0) - Date.now()) / 60000;
    out.push({ name: 'Smoking', status: true, meter: { k: Math.min(1, left / 6), text: `${Math.ceil(left)} min left` }, effects: ['Stress eases while it burns'], heals: 'Burns down in a few minutes.' });
  }
  const legs = h.broken.filter((p) => p.endsWith('leg')).length;
  const lost = 1 - h.blood / h.maxBlood;

  if (h.bleeding) {
    const ml = BLEED_PER_HOUR[h.bleeding];
    out.push({
      name: `Bleeding: ${BLEEDING[h.bleeding]}`,
      effects: [
        `Losing ${litres(ml)} of blood an hour, and more each turn in a fight`,
        'No blood comes back until it stops',
        `Pass out at ${litres(h.maxBlood * PASS_OUT)}; bleed out at ${litres(h.maxBlood * DEATH)}`,
      ],
      heals: `About a ${Math.round(CLOT[h.bleeding] * 100)}% chance an hour it eases a level. Bandages, gauze or resting help.`,
    });
  }
  if (h.blood < h.maxBlood) {
    const effects = [`${litres(h.blood)} left of ${litres(h.maxBlood)} (${litres(h.maxBlood - h.blood)} lost). At ${litres(h.maxBlood * PASS_OUT)} you pass out`];
    if (lost >= 0.01) effects.push(`Easier to knock out: +${Math.round(lost * 20)}% from a head blow (+${Math.round(lost * 45)}% on the floor)`);
    if (h.blood < h.maxBlood * 0.75) effects.push('Running from the police: −15%');
    const regen = REGEN_PER_HOUR * ((h.cold ?? 0) >= 3 ? 0.4 : (h.cold ?? 0) === 2 ? 0.75 : 1);
    out.push({
      name: 'Blood lost',
      effects,
      heals: h.bleeding
        ? 'Comes back once the bleeding stops.'
        : `Back to full in about ${hrs((h.maxBlood - h.blood) / regen)}.`,
    });
  }
  for (const p of h.broken) {
    const effects: string[] = [];
    if (p.endsWith('arm')) {
      effects.push('Punches and weapon blows land: −20%');
      effects.push('Grappling works: −20%');
    }
    if (p.endsWith('leg')) {
      effects.push('Kicks and stomps land: −20%');
      effects.push(`Running away: ${legs >= 2 ? '8%' : '35%'} of the usual chance${legs >= 2 ? ' (both legs)' : ''}`);
      effects.push('Getting up off the floor: −30%');
      effects.push('Running from the police: −30%');
    }
    if (p === 'ribs') {
      effects.push(`Every move costs ${h.lung ? '2.4' : '1.8'}× the stamina`);
      effects.push(`Fights start with ${h.lung ? '30% of' : 'half'} your stamina, and you can't get back more than that`);
      if (!h.lung) effects.push('A stomp or hard blow there can drive a rib into your lung');
    }
    if (p === 'nose') effects.push('It hurts and it shows, but it doesn\'t slow you in a fight');
    const left = h.mending[p] ?? 0;
    const splinted = h.splinted?.includes(p);
    out.push({
      name: `Broken ${p}${splinted ? ' (splinted)' : ''}`,
      effects,
      heals:
        `Heals in about ${hrs(left)}.` +
        (p.endsWith('arm') || p.endsWith('leg') ? (splinted ? '' : ' Left loose, it takes twice as long to heal: a splint holds it still.') : ''),
    });
  }
  if (h.lung) {
    out.push({
      name: 'Punctured lung',
      effects: ['Every move costs 2.4× the stamina', "Fights start with 30% of your stamina, and you can't get back more than that"],
      heals: 'Heals when your ribs do.',
    });
  }
  if (h.concussion > 0) {
    out.push({
      name: 'Concussed',
      effects: ['Your blows land: −10%', 'Dazed more easily: 1.5× the chance', 'Easier to knock out: +5% from a head blow (+12% on the floor)'],
      heals: `Clears in about ${hrs(h.concussion)}. Rest helps; painkillers only dull the headache.`,
    });
  }
  if (h.cold) {
    const effects = [`Fights start with ${h.cold * 10}% less stamina`, `Running from the police: −${h.cold * 5}%`];
    if (h.cold >= 2) effects.push(`Your body makes blood back ${h.cold >= 3 ? '40%' : '75%'} as fast`);
    out.push({ name: COLD_NAMES[h.cold], status: true, meter: { k: h.cold / 3, text: `${h.cold} / 3` }, effects, heals: 'Get out of the weather: indoors, or by a fire.' });
  }
  if (h.high && (h.highUntil ?? 0) > Date.now()) {
    const mins = Math.ceil(((h.highUntil ?? 0) - Date.now()) / 60000);
    out.push({
      name: `High: ${h.high}`,
      status: true,
      meter: { k: Math.min(1, mins / (HIGH_HOURS[h.high] * 60)), text: mins < 90 ? `${mins} min left` : `${Math.round(mins / 60)} h left` },
      effects:
        h.high === 'meth'
          ? ['Your blows do 12% more damage', 'Your blows land: −4% (you can\'t keep still)']
          : h.high === 'tranq'
            ? ['Your blows land: −8%', 'Their blows land: +6% (groggy)']
            : ['Your blows land: −12%', 'Their blows land: +10% (you\'re slow to move)'],
      heals: `Wears off in about ${mins < 90 ? `${mins} minute${mins === 1 ? '' : 's'}` : `${Math.round(mins / 60)} hours`}.`,
    });
  }
  const mg = caffeineNow(h);
  if (caffeineLevel(mg)) {
    const edge = caffeineEdge(mg);
    const pct = `${edge >= 0 ? '+' : '−'}${Math.abs(Math.round(edge * 100))}%`;
    out.push({
      name: `Caffeine: ${CAFFEINE_NAMES[caffeineLevel(mg)].toLowerCase()}`,
      status: true,
      meter: { k: Math.min(1, mg / 600), text: `${Math.round(mg)} mg (jittery at 400)` },
      effects: [`Your blows land: ${pct}`, `Their blows land: ${edge >= 0 ? '−' : '+'}${Math.abs(Math.round(edge * 100))}%`, ...(mg >= 400 ? ['Stress builds faster (your heart is pounding)'] : [])],
      heals: `Half of it is gone every 5 hours (real time). Below 40 mg you won't feel it: about ${hrs(Math.log2(mg / 40) * 5)} from now.`,
    });
  }
  soberUp(h);
  if (h.drunk && drunkLevel(h.drunk)) {
    const d = h.drunk;
    out.push({
      name: DRUNK_NAMES[drunkLevel(d)],
      status: true,
      meter: { k: Math.min(1, d / 100), text: `${Math.round(d)} / 100 (blackout at 90)` },
      effects: [`Your blows land: −${Math.round(d / 4)}%`, `Their blows land: +${Math.round(d / 5)}%`, `Your blows do ${Math.round(d / 10)}% more damage (you swing heavy)`, ...(d >= 80 ? ['Any more and you black out'] : [])],
      heals: `Drops 20 an hour (real time): about ${Math.max(1, Math.ceil(d / 20))} hour${Math.ceil(d / 20) === 1 ? '' : 's'} to clear.`,
    });
  }
  if (h.wired) {
    const left = Math.max(0, ((h.wiredUntil ?? Date.now()) - Date.now()) / 60000);
    const full = h.wiredBy === 'meth' ? HIGH_HOURS.meth * 60 : 40;
    out.push({
      name: `Wired${h.wiredBy ? ` (${h.wiredBy})` : ''}`,
      status: true,
      meter: { k: Math.min(1, left / full), text: left < 90 ? `${Math.ceil(left)} min left` : `${Math.round(left / 60)} h left` },
      effects: ['Fights: 25% more stamina'],
      heals: 'Wears off on its own, and leaves you hollow.',
    });
  }
  const m = h.marks ?? {};
  const markLeft = (k: HealingMark) => {
    const left = h.markHours?.[k];
    return left ? `Heals in about ${hrs(left)}.` : 'Heals with time.';
  };
  const looks = 'It shows on your face, nothing more: it doesn\'t slow you in a fight';
  if (m.jaw) out.push({ mark: true, name: 'Broken jaw', effects: [looks], heals: markLeft('jaw') });
  if (m.eye) out.push({ mark: true, name: 'Black eye', effects: [looks], heals: markLeft('eye') });
  if (m.brow) out.push({ mark: true, name: 'Cut over one eye', effects: [looks], heals: `${markLeft('brow')} ${h.stitched?.brow ? 'Stitched: it’ll leave a faint line.' : 'Unstitched, it will leave a scar.'}` });
  if (m.lip) out.push({ mark: true, name: 'Split lip', effects: [looks], heals: markLeft('lip') });
  if (m.cheek) out.push({ mark: true, name: 'Swollen face', effects: [looks], heals: markLeft('cheek') });
  if (m.teeth) out.push({ mark: true, name: m.teeth === 1 ? 'A tooth missing' : `${m.teeth} teeth missing`, effects: [looks], heals: 'They never grow back.' });
  if (m.scars?.length) {
    // Where each one actually is (a face scar shows; one on the forearm doesn't, much).
    const places = [...new Set(m.scars)];
    const face = places.filter((p) => /cheek|eyebrow|lip|jaw|face/.test(p));
    out.push({
      mark: true, name: `Scar${places.length > 1 ? 's' : ''}: ${places.join(', ')}`,
      effects: [face.length ? `On your face${face.some((p) => p !== 'face') ? ` (${face.filter((p) => p !== 'face').join(', ')})` : ''}: people will remember it. It doesn't slow you in a fight.` : `On your ${places.join(' and ')}. It doesn't slow you in a fight.`],
      heals: 'For good.',
    });
  }
  return out;
}

// ---------- Addiction and withdrawal ----------
/**
 * What you can get hooked on. Each use builds dependence (0..100); staying
 * off it, dependence fades slowly. Hooked, and without it for long enough,
 * withdrawal sets in on its own clock (real time, like everything else):
 * it builds to a peak, stays there for a while, and eases off over days.
 * Using again stops it at once, and hooks you a little deeper.
 */
export type Habit = 'nicotine' | 'alcohol' | 'caffeine' | 'opioids' | 'stimulants' | 'sedatives';
export const HABIT_NAMES: Record<Habit, string> = { nicotine: 'nicotine', alcohol: 'alcohol', caffeine: 'caffeine', opioids: 'opioids', stimulants: 'stimulants', sedatives: 'sedatives' };
interface HabitState {
  dep: number;
  /** Last use (ms). */
  last: number;
  /** When dependence was last brought up to date (ms). */
  at: number;
}
const HR = 3_600_000;
/** Hours after the last use before withdrawal starts; hours to build to its peak; hours at the peak before it eases (over as long again). */
const WD_CLOCK: Record<Habit, [number, number, number]> = {
  nicotine: [1.5, 3, 24],
  caffeine: [12, 12, 24],
  alcohol: [8, 18, 48],
  opioids: [8, 24, 48],
  stimulants: [18, 12, 48],
  sedatives: [12, 24, 72],
};
/** Dependence lost per real hour off it. */
const DECAY: Record<Habit, number> = { nicotine: 0.15, caffeine: 0.6, alcohol: 0.2, opioids: 0.12, stimulants: 0.15, sedatives: 0.1 };
/** At the peak, fully hooked: blows land worse, less stamina, stress that won't settle below this, seizure risk an hour. */
const WD_HIT: Record<Habit, { hit: number; stamina: number; floor: number; seizure: number }> = {
  nicotine: { hit: 0.02, stamina: 0, floor: 30, seizure: 0 },
  caffeine: { hit: 0.04, stamina: 0.1, floor: 12, seizure: 0 },
  alcohol: { hit: 0.12, stamina: 0.15, floor: 45, seizure: 0.05 },
  opioids: { hit: 0.12, stamina: 0.35, floor: 55, seizure: 0 },
  stimulants: { hit: 0.06, stamina: 0.3, floor: 35, seizure: 0 },
  sedatives: { hit: 0.1, stamina: 0.1, floor: 50, seizure: 0.06 },
};
const WD_NAME: Record<Habit, string> = {
  nicotine: 'Craving a cigarette',
  caffeine: 'Caffeine headache',
  alcohol: 'The shakes',
  opioids: 'Dope sick',
  stimulants: 'The crash',
  sedatives: 'Coming off the downers',
};
const WD_EFFECTS: Record<Habit, string> = {
  nicotine: 'Irritable, restless, can’t think about anything else',
  caffeine: 'A dull, pounding headache; slow and foggy',
  alcohol: 'Shaking hands, sweats, a racing heart; badly hooked, a seizure can drop you',
  opioids: 'Sweating, aching, cramps, the runs; every bone hurts and you can’t get warm',
  stimulants: 'Exhausted to the bone, flat and hopeless, starving and sleepy',
  sedatives: 'Panic, tremors, can’t sleep; a seizure can drop you',
};
const WD_RELIEF: Record<Habit, string> = {
  nicotine: 'a cigarette',
  caffeine: 'coffee, an energy drink or a pill',
  alcohol: 'a drink',
  opioids: 'heroin or fentanyl',
  stimulants: 'meth or coke',
  sedatives: 'a tranquilizer',
};

const habitsOf = (h: Health) => ((h as Health & { habits?: Partial<Record<Habit, HabitState>> }).habits ??= {});

/** Dependence, brought up to date (it fades while you're off it). */
export function dependence(h: Health, k: Habit, t = Date.now()): number {
  const s = habitsOf(h)[k];
  if (!s) return 0;
  s.dep = Math.max(0, s.dep - (Math.max(0, t - s.at) / HR) * DECAY[k]);
  s.at = t;
  return s.dep;
}
/** Using: dependence builds, and any withdrawal stops. */
export function useHabit(h: Health, k: Habit, amount: number, t = Date.now()) {
  const d = dependence(h, k, t);
  habitsOf(h)[k] = { dep: Math.min(100, d + amount), last: t, at: t };
}
/** How bad withdrawal from this is right now, 0..1. */
export function withdrawal(h: Health, k: Habit, t = Date.now()): number {
  const s = habitsOf(h)[k];
  const d = dependence(h, k, t);
  if (!s || d < 15) return 0;
  const [on, ramp, peak] = WD_CLOCK[k];
  const since = (t - s.last) / HR;
  if (since < on) return 0;
  const x = since - on;
  const curve = x < ramp ? x / ramp : x < ramp + peak ? 1 : Math.max(0, 1 - (x - ramp - peak) / peak);
  return Math.min(1, (d / 100) * 1.25) * curve;
}
/** All of it together, for a fight and for your stress. */
export function withdrawalEffects(h: Health, t = Date.now()) {
  let hit = 0;
  let stamina = 0;
  let floor = 0;
  let seizure = 0;
  let worst: { k: Habit; sev: number } | null = null;
  for (const k of Object.keys(WD_HIT) as Habit[]) {
    const sev = withdrawal(h, k, t);
    if (!sev) continue;
    const e = WD_HIT[k];
    hit += e.hit * sev;
    stamina = Math.max(stamina, e.stamina * sev);
    floor = Math.max(floor, e.floor * sev);
    seizure = Math.max(seizure, e.seizure * sev);
    if (!worst || sev > worst.sev) worst = { k, sev };
  }
  return { hit, stamina, floor, seizure, worst };
}
/** A craving, said now and then on the street. */
export function cravingLine(k: Habit): string {
  return {
    nicotine: 'You pat your pockets for a cigarette before you remember.',
    caffeine: 'Your head pounds. A coffee would fix it.',
    alcohol: 'Your hands won’t keep still. One drink and they would.',
    opioids: 'Your skin crawls, your gut cramps, and all you can think about is a fix.',
    stimulants: 'You could sleep for a week, and you hate everything.',
    sedatives: 'Your heart races at nothing. You need something to bring you down.',
  }[k];
}
/** The status cards: how hooked you are, and withdrawal while it lasts. */
export function habitCards(h: Health, t = Date.now()): InjuryInfo[] {
  const out: InjuryInfo[] = [];
  for (const k of Object.keys(WD_HIT) as Habit[]) {
    const d = dependence(h, k, t);
    if (d < 15) continue;
    const sev = withdrawal(h, k, t);
    if (sev > 0.04) {
      const s = habitsOf(h)[k]!;
      const [on, ramp, peak] = WD_CLOCK[k];
      const left = Math.max(1, Math.round(on + ramp + 2 * peak - (t - s.last) / HR));
      const e = WD_HIT[k];
      out.push({
        name: `Withdrawal: ${WD_NAME[k].toLowerCase()}`,
        status: true,
        meter: { k: sev, text: sev > 0.75 ? 'Bad' : sev > 0.4 ? 'Rough' : 'Mild' },
        effects: [
          WD_EFFECTS[k],
          ...(e.hit * sev >= 0.01 ? [`Your blows land: −${Math.round(e.hit * sev * 100)}%`] : []),
          ...(e.stamina * sev >= 0.01 ? [`Stamina in a fight: −${Math.round(e.stamina * sev * 100)}%`] : []),
          ...(e.floor * sev >= 5 ? [`Stress won’t settle below ${Math.round(e.floor * sev)}`] : []),
        ],
        heals: `${WD_RELIEF[k][0].toUpperCase()}${WD_RELIEF[k].slice(1)} ends it at once (and hooks you deeper). Or ride it out: about ${left < 48 ? hrs(left) : `${Math.round(left / 24)} days`}.`,
      });
    }
    out.push({
      name: `Hooked: ${HABIT_NAMES[k]}`,
      status: true,
      meter: { k: d / 100, text: d >= 70 ? 'Badly' : d >= 40 ? 'Hooked' : 'Getting a habit' },
      effects: [`Go about ${WD_CLOCK[k][0]} hours without ${WD_RELIEF[k]} and withdrawal starts`],
      heals: 'Fades slowly if you stay off it.',
    });
  }
  return out;
}
