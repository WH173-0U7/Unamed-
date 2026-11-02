import { BLEEDING, PASS_OUT, type Body, type Part, type Result } from './encounter';

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
}

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
export const isHurt = (h: Health) => h.blood < h.maxBlood || h.bleeding > 0 || h.broken.length > 0 || h.concussion > 0;

/** What's wrong with you, for showing. */
export function healthConditions(h: Health): string[] {
  const c: string[] = [];
  if (h.concussion > 0) c.push('Concussed');
  if (h.bleeding) c.push(`Bleeding: ${BLEEDING[h.bleeding]}`);
  for (const p of h.broken) c.push(`Broken ${p}`);
  return c;
}

/** Your body going into a fight. */
export function bodyFrom(h: Health, stamina: number): Body {
  return {
    blood: h.blood,
    maxBlood: h.maxBlood,
    toughness: 100,
    stamina,
    maxStamina: stamina,
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
  if (result === 'lost') {
    // Out cold for a few hours; the bleeding slows while you lie there.
    const lines = ['You come to on the pavement, hours later.'];
    h.bleeding = Math.min(h.bleeding, 1);
    lines.push(...passHours(h, 3));
    h.blood = Math.max(h.blood, Math.round(h.maxBlood * (PASS_OUT + 0.05)));
    return lines;
  }
  return [];
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
  for (let i = 0; i < hours; i++) {
    if (h.bleeding) {
      h.blood -= BLEED_PER_HOUR[h.bleeding];
      if (Math.random() < CLOT[h.bleeding] * (resting ? 1.5 : 1)) {
        h.bleeding--;
        if (!h.bleeding) lines.push('The bleeding has stopped.');
      }
      if (h.blood <= h.maxBlood * PASS_OUT) {
        lines.push("You've lost too much blood. You collapse, and wake up hours later.");
        h.bleeding = 0;
        h.blood = Math.round(h.maxBlood * (PASS_OUT + 0.05));
      }
    } else {
      h.blood = Math.min(h.maxBlood, h.blood + REGEN_PER_HOUR * (resting ? 1.5 : 1));
    }
    for (const p of [...h.broken]) {
      h.mending[p] = (h.mending[p] ?? MEND_HOURS[p]) - (resting ? 1.5 : 1);
      if (h.mending[p]! <= 0) {
        h.broken = h.broken.filter((x) => x !== p);
        delete h.mending[p];
        lines.push(`Your ${p} ${p === 'ribs' ? 'have' : 'has'} healed.`);
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
