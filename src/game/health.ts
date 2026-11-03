import { BLEEDING, DEATH, PASS_OUT, STRESS_NAMES, marksText, stressLevel, type Body, type Marks, type Part, type Result } from './encounter';

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
  /** On cocaine: the next fight, you've energy to burn and feel less. */
  wired?: boolean;
  /** Stress, 0..100 (see encounter.ts addStress): eases with time and cigarettes. */
  stress?: number;
  /** How used to violence you are, 0..100: at 100 it doesn't stress you. */
  nerve?: number;
  /** Smoking a cigarette until this time (ms, real clock). */
  smokingUntil?: number;
  /** Teeth gone, scars, a split lip... (see Marks), and hours until the ones that heal do. */
  marks?: Marks;
  markHours?: Partial<Record<HealingMark, number>>;
}

type HealingMark = 'lip' | 'cheek' | 'eye' | 'brow' | 'jaw';
/** Hours for a mark to heal (game time). A cut brow leaves a scar. */
export const MARK_HOURS: Record<HealingMark, number> = { lip: 24, cheek: 36, eye: 72, brow: 96, jaw: 48 };

/** Stress lost per hour of game time (more when resting). */
const STRESS_EASE = 6;

export const COLD_NAMES = ['', 'Chilled', 'Cold', 'Freezing'];

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
const BLEED_PER_HOUR = [0, 60, 160, 320, 520];
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
  c.push(...marksText(h.marks));
  const sl = stressLevel(h.stress ?? 0);
  if (sl) c.push(STRESS_NAMES[sl]);
  return c;
}

/** Your body going into a fight. */
export function bodyFrom(h: Health, stamina: number): Body {
  return {
    blood: h.blood,
    maxBlood: h.maxBlood,
    toughness: 100,
    // Broken ribs: you can't fill your lungs, so you start the fight short of breath.
    // Cold stiffens you; cocaine gives you more than you've got.
    stamina: Math.round(stamina * (h.lung ? 0.3 : h.broken.includes('ribs') ? 0.5 : 1) * (1 - (h.cold ?? 0) * 0.1) * (h.wired ? 1.25 : 1)),
    maxStamina: Math.round(stamina * (h.wired ? 1.25 : 1)),
    lung: h.lung,
    stress: h.stress ?? 0,
    smoking: (h.smokingUntil ?? 0) > Date.now(),
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
  // New marks start healing (teeth and scars never do).
  const was = h.marks ?? {};
  h.marks = b.marks ?? was;
  for (const k of Object.keys(MARK_HOURS) as HealingMark[]) if (h.marks[k] && !was[k]) (h.markHours ??= {})[k] = MARK_HOURS[k];
  // Every fight you live through, you get a little more used to it.
  h.nerve = Math.min(100, (b.nerve ?? h.nerve ?? 0) + 2);
  const lines: string[] = [];
  if (h.wired) {
    h.wired = false;
    lines.push('The coke wears off. Your jaw aches, and you feel hollow.');
  }
  if (result === 'lost') {
    // Out cold for a few hours, still bleeding. You may not wake up.
    const out = lieThere(h);
    if (!h.dead) out.unshift('You come to on the pavement, hours later.');
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
  for (let i = 0; i <= 3; i++) {
    if (i > 0) {
      if (!h.bleeding) break;
      h.blood -= BLEED_PER_HOUR[h.bleeding];
    }
    if (h.blood <= h.maxBlood * DEATH) {
      h.blood = Math.max(0, Math.round(h.blood));
      h.dead = true;
      return ['You never wake up. You bleed out where you fell.'];
    }
    // Lying still, a wound clots faster than it does on your feet.
    if (i > 0 && Math.random() < Math.min(0.9, CLOT[h.bleeding] * 2)) h.bleeding--;
  }
  h.blood = Math.round(Math.max(h.blood, h.maxBlood * (PASS_OUT + 0.03)));
  return [h.bleeding ? "You're still bleeding." : 'The blood has dried on you.'];
}

/**
 * Time passing: bleeding drains blood (and slowly stops), blood comes back,
 * bones and concussion mend. Returns lines describing what changed. If you
 * bleed down to passing out, you collapse and wake up later.
 */
export function passHours(h: Health, hours: number, resting = false): string[] {
  const lines: string[] = [];
  if (resting && h.bleeding) {
    h.bleeding--;
    lines.push(h.bleeding ? 'You press on the wound. The bleeding slows.' : 'You manage to stop the bleeding.');
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
        if (k === 'brow') (h.marks.scars ??= []).push('eyebrow');
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

/** One injury, for the stats sheet: what it is, what it does to you, how long it lasts. */
export interface InjuryInfo {
  name: string;
  /** What it does to you, line by line. */
  effects: string[];
  /** How long it has left, and what helps. */
  heals: string;
}

const hrs = (n: number) => {
  const h = Math.max(1, Math.ceil(n));
  return `${h} hour${h === 1 ? '' : 's'}`;
};
const litres = (ml: number) => `${(ml / 1000).toFixed(2).replace(/0$/, '')} L`;

/**
 * Everything wrong with you and exactly what it does (the same numbers the
 * fights use: see encounter.ts strike, fleeChance, getUpChance, staminaCap,
 * and the police chase in game.ts). Hours are game hours: a lurk is one,
 * resting is four, and resting heals half as fast again.
 */
export function injuryEffects(h: Health): InjuryInfo[] {
  const out: InjuryInfo[] = [];
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
    const effects = [`${litres(h.blood)} of ${litres(h.maxBlood)}. At ${litres(h.maxBlood * PASS_OUT)} you pass out`];
    if (lost >= 0.01) effects.push(`Easier to knock out: +${Math.round(lost * 20)}% from a head blow (+${Math.round(lost * 45)}% on the floor)`);
    if (h.blood < h.maxBlood * 0.75) effects.push('Running from the police: −15%');
    const regen = REGEN_PER_HOUR * ((h.cold ?? 0) >= 3 ? 0.4 : (h.cold ?? 0) === 2 ? 0.75 : 1);
    out.push({
      name: 'Blood lost',
      effects,
      heals: h.bleeding
        ? 'Comes back once the bleeding stops.'
        : `Back to full in about ${hrs((h.maxBlood - h.blood) / regen)}. Iron tablets give 0.4 L.`,
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
      effects.push(`Fights start with ${h.lung ? '30%' : 'half'} your stamina, and you can't get back more than that`);
      if (!h.lung) effects.push('A stamp or hard blow there can drive a rib into your lung');
    }
    if (p === 'nose') effects.push('It hurts and it shows, but it doesn\'t slow you in a fight');
    const left = h.mending[p] ?? 0;
    const splinted = h.splinted?.includes(p);
    out.push({
      name: `Broken ${p}${splinted ? ' (splinted)' : ''}`,
      effects,
      heals:
        `Heals in about ${hrs(left)}.` +
        (p.endsWith('arm') || p.endsWith('leg') ? (splinted ? '' : ' A splint halves that.') : ''),
    });
  }
  if (h.lung) {
    out.push({
      name: 'Punctured lung',
      effects: ['Every move costs 2.4× the stamina', 'Fights start with 30% of your stamina, and you can\'t get back more than that'],
      heals: 'Heals when your ribs do.',
    });
  }
  if (h.concussion > 0) {
    out.push({
      name: 'Concussed',
      effects: ['Your blows land: −10%', 'Dazed more easily: 1.5× the chance', 'Easier to knock out: +5% from a head blow (+12% on the floor)'],
      heals: `Clears in about ${hrs(h.concussion)}. Painkillers clear 3 hours of it.`,
    });
  }
  if (h.cold) {
    const effects = [`Fights start with ${h.cold * 10}% less stamina`, `Running from the police: −${h.cold * 5}%`];
    if (h.cold >= 2) effects.push(`Your body makes blood back ${h.cold >= 3 ? '40%' : '75%'} as fast`);
    out.push({ name: COLD_NAMES[h.cold], effects, heals: 'Get out of the rain: indoors, or by a fire.' });
  }
  if (h.wired) {
    out.push({
      name: 'Wired',
      effects: ['Next fight: 25% more stamina'],
      heals: 'Wears off when that fight is over, and leaves you hollow.',
    });
  }
  const m = h.marks ?? {};
  const markLeft = (k: HealingMark) => {
    const left = h.markHours?.[k];
    return left ? `Heals in about ${hrs(left)}.` : 'Heals with time.';
  };
  const looks = 'It shows on your face, nothing more: it doesn\'t slow you in a fight';
  if (m.jaw) out.push({ name: 'Broken jaw, wired shut', effects: [looks], heals: markLeft('jaw') });
  if (m.eye) out.push({ name: 'Black eye', effects: [looks], heals: markLeft('eye') });
  if (m.brow) out.push({ name: 'Cut over your eye', effects: [looks], heals: `${markLeft('brow')} It will leave a scar.` });
  if (m.lip) out.push({ name: 'Split lip', effects: [looks], heals: markLeft('lip') });
  if (m.cheek) out.push({ name: 'Swollen cheek', effects: [looks], heals: markLeft('cheek') });
  if (m.teeth) out.push({ name: m.teeth === 1 ? 'A tooth missing' : `${m.teeth} teeth missing`, effects: [looks], heals: 'They never grow back.' });
  if (m.scars?.length) out.push({ name: `Scar${m.scars.length > 1 ? 's' : ''}`, effects: [looks], heals: 'For good.' });
  return out;
}
