import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { settings } from '../core/settings';
import { floatChange, type Float } from '../ui/floaters';
import { createTv } from './tv';
import { BUILDS, CHANCES, RACE_CHANCES, NAMES, makePerson, type Kind, personalityOf, randomName, type Loot } from './person';
import { ENCOUNTER_VERSION, act, indoors, liftables, newEncounter, options as encounterOptions, type Encounter } from './encounter';
import { RESULT, createEncounterView } from '../ui/encounterView';
import { runStamina, toughnessResist } from './stats';
import { STAT_NAMES, lieBonus, persuadeBonus, train, newStats, xpToNext, MAX_LEVEL, maxStamina, ambushBonus, noticeRate, damageMult, accuracyBonus, dodgeBonus, staminaRegen, fearBonus, STAT_SHORT, unarmedDamage, strengthDamage, strengthFear, weaponDamage, weaponAccuracy, type StatName, type Stats } from './stats';
import { MEND_HOURS, CONCUSSION_HOURS } from './health';
import { addFatigue, fatigueLevel, fatigueNow, fatigueOdds, restLeft, FATIGUE_NAMES, FATIGUE_SPENT } from './health';
import { clampClock, cravingLine, useHabit, withdrawalEffects, HIGH_HOURS, addCaffeine, caffeineNow, caffeineLevel, drunkLevel, soberUp, REST_HOURS, afterFight, bodyFrom, healthConditions, injuryEffects, isHurt, newHealth, passHours, type Health } from './health';
import { ALL_TECHNIQUES, PASS_OUT, addStress, type Impact } from './encounter';
import type { Glass } from '../fx/glass';
import type { Upcoming } from '../core/notify';
import { uiGlitch } from '../fx/uiGlitch';
import { guilt } from './voices';
import { sound } from '../fx/sound';
import type { DrugLook } from '../fx/drugs';
import { clockText, dateText, now, partOfDay } from './clock';
import { COLD_AMOUNT, RAIN_AMOUNT, SNOW_AMOUNT, WEATHER_NAME, WET_AMOUNT, isSnow, newWeather, updateWeather, weatherLine, type WeatherState } from './weather';
import { COLD_NAMES, easeStress } from './health';
import { maybeThief, newWorld, robBody, robKnockedOut, settle, type World } from './legacy';
import { isBrute } from './voices';
import { knifeOf } from './knives';
import { gunOf } from './guns';
import { HEAT_NAMES, applyTo, heatGain, hoursToDrop, comeBack, heal, fade, heatLevel, historyText, injuriesText, meet, newInfamy, recognises, remember, repName, type Infamy, type Known } from './people';
import { anonymity, camAnonymity, coverByName, coldFactor, conspicuous, describe, faceWord, gloved, hasHood, lookClothes, topColdFactor, veryConspicuous, warmthWord, wearing } from './look';
import { marksText, list as listOf, a as aOf } from './encounter';
import { cashFill, cashFits, cashWhere, pocketCash, roomForCents, spotMl } from './inventory';
import { mlOf } from './money';
import { lootIcon, lootMark } from './lootIcon';
import { STYLES, STYLE_HOW, STYLE_NAMES, stylesOf } from './styles';
import { BIN_MAX, BIN_REFILL, TOSS_ODDS, binsLook, cutOdds, rareOdds, rollDig, shooOdds, spoilOdds, uncommonOdds, type BinArea, type BinFind } from './scavenge';
import { CORNERS, DEFAULT_CORNER, MAP_H, MAP_W, MAP_ZMAX, PLACE_AT, PLACE_ICON, addressAt, blocksBetween, buildingAddr, buildingAt, buildingById, buildingOfPlace, buildings, cornerById, mapHtml, zoomStyle, type Building, type District, type MapMark } from './map';
import { MEDS, take, alarmOf, alarmStat, bulkOf, concealOf, exposure, hideStat, spotsFor, hidesWord, inBag, nextSpot, showWord, showing, cashOf, purseKg, wear, wouldLeave, kgLabel, carriedKg, carryLimit, awayTo, fitsIn, findRoom, SIZE_RANK, OVERLOAD, TIRING_LOAD, measure, medById, newInventory, noRoomWhy, stow, upgradeInventory, usedKg, tooHeavy, reweigh, freeHand, type Inventory, type InvItem, type Spot as Pocket, type MedId } from './inventory';

/**
 * What's left of your humanity. Killing someone takes a lot of it; stamping
 * on someone who's already unconscious takes a little. It only goes one way:
 * cold, then cruel, then heartless, and in the end a husk, with no humanity
 * left inside. Saved under `state.humanity`.
 */
interface Humanity {
  lost: number;
  kills: number;
}
const HUMANITY: { at: number; name: string; line: string }[] = [
  { at: 10, name: 'Cold', line: 'Something in you has gone cold.' },
  { at: 20, name: 'Callous', line: "Their pain doesn’t reach you the way it did." },
  { at: 32, name: 'Cruel', line: "You’ve started to enjoy their pain." },
  { at: 46, name: 'Vicious', line: 'You hurt people more than you need to now. You know it.' },
  { at: 62, name: 'Heartless', line: 'You feel nothing for them. Nothing at all.' },
  { at: 80, name: 'Sadist', line: 'You take your time with them now. You like the begging.' },
  { at: 100, name: 'Monster', line: 'People cross the street when they see you coming. They’re right to.' },
  { at: 125, name: 'Butcher', line: "You’ve stopped counting what you’ve done." },
  { at: 155, name: 'Devil', line: "When they talk about you on the street, they don’t use your name." },
  { at: 190, name: 'Husk', line: "There’s nothing left inside you. You’re a husk." },
];
/** How evil you are shows: people are more scared of you, the further gone you are. */
// Someone far gone carries it in how they look at you, a little (strangers can't
// know what you've done, only see it in your eyes).
/** One of these, at random. */
const oneOf = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
/** A lock that never gets changed (nobody left to change it). */
const NEVER = 8.64e15;
/** A prison sentence, said the way a judge would: whole years, else months. */
const prisonTerm = (days: number) => {
  const months = Math.round(days / 30.4);
  // (Two years or more: in years, rounded, the way a judge says it.)
  if (months >= 24) return `${Math.round(months / 12)} years`;
  return months === 12 ? 'a year' : `${months} months`;
};
/** A date, with the year when it isn't this year's (a debt that came due while you were inside). */
/** Real hours behind the door: a night in a cell, the wait in County for a hearing. */
const CELL_HOURS = 1;
/** (Half an hour: the hearing comes quickly.) */
const COUNTY_HOURS = 0.5;
/**
 * A sentence, in real hours: a day of it is far less than a real day. Up to a
 * month it grows (a week is about 8 hours, a month 16); past that, only a little
 * (three months about 22, a year about 29, five years about 37).
 */
const servedHours = (days: number) => Math.max(2, Math.round(days <= 30 ? 3 * Math.sqrt(days) : 3 * Math.sqrt(30) + 5 * Math.log(days / 30)));
/** The sentence named in "Serving 30 days in County" / "Serving 2 years in state prison", in days. */
const termDays = (what: string) => {
  const m = /(\d+) (day|month|year)s?|\ba (year)\b/i.exec(what);
  if (!m) return null;
  const n = m[3] ? 1 : Number(m[1]);
  const unit = (m[2] ?? m[3]).toLowerCase();
  return unit === 'day' ? n : unit === 'month' ? Math.round(n * 30.4) : n * 365;
};
/** On the shelf: how warm a top or a hat keeps you in the rain (nothing for anything else). */
const stockWarmth = (s: { slot?: string; name: string }) =>
  (s.slot === 'top' ? ` Warmth: ${warmthWord(topColdFactor(s.name))}.` : s.slot === 'head' ? ` Warmth: ${/beanie/i.test(s.name) ? 'some' : 'little'}.` : '') + stockCover(s);
/** On the shelf: how much of your face it hides, from people and from cameras. */
const stockCover = (s: { slot?: string; name: string }) => {
  const c = s.slot === 'head' || s.slot === 'face' || s.slot === 'eyes' ? coverByName(s.name) : undefined;
  if (!c) return '';
  const w = (k: number) => (k >= 0.7 ? 'most' : k >= 0.35 ? 'some' : k >= 0.15 ? 'a little' : 'barely');
  return ` Hides: ${w(c.hides)} from people, ${w(c.cam ?? c.hides)} from cameras.${c.veryLoud ? ' Draws trouble.' : c.loud ? ' Draws looks.' : ''}`;
};
const dueText = (t: number) => (new Date(t).getFullYear() === new Date(now()).getFullYear() ? dateText(t) : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }));
/** Days Dez's vig keeps compounding once you're late. */
const VIG_DAYS = 14;
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
/** What a corner is like to work: who comes by (out of 100), how busy (more of them about), how often a patrol does. */
type CornerFeel = { chances: [Kind, number][]; busy: number; police: number; blurb: string };
const CORNER_FEEL: Record<District | 'bar', CornerFeel> = {
  downtown: { chances: [['civilian', 60], ['drunk', 22], ['homeless', 10], ['junkie', 8]], busy: 1.35, police: 1.3, blurb: 'Downtown: office people by day, theater crowds and drunks by night, and a patrol car every few minutes.' },
  flats: { chances: CHANCES, busy: 1, police: 1, blurb: 'The Flats: the same faces, mostly. A patrol now and then.' },
  oldtown: { chances: [['civilian', 46], ['drunk', 28], ['homeless', 14], ['junkie', 12]], busy: 1.1, police: 1, blurb: 'Old Town: bars and walk-ups, people out late.' },
  southside: { chances: [['civilian', 28], ['drunk', 24], ['homeless', 24], ['junkie', 24]], busy: 0.85, police: 0.8, blurb: 'Southside: rougher, quieter, fewer patrols. More people who need what you’ve got.' },
  bar: { chances: [['civilian', 48], ['drunk', 48], ['homeless', 1], ['junkie', 3]], busy: 1.4, police: 0.7, blurb: 'In the bar: drinkers, and people looking for something to go with it. The police mostly stay outside.' },
};
/** Somewhere you've hidden things: what's there, and when you last looked. */
type StashBox = { items: InvItem[]; cents: number; at: number; seen?: boolean };
/** A lock-up by the river: a week, cash; two days' grace, then they cut the lock. */
const LOCKUP_RENT = 60;
const LOCKUP_GRACE = 2 * 86_400_000;
/** The bar: drinks by the glass, half again what the liquor store charges. */
const BAR_DRINKS: { id: string; name: string; desc: string; cents: number; std: number; drunk: number; line: string }[] = [
  { id: 'beer', name: 'A beer', desc: 'Draft, in a sticky glass.', cents: 450, std: 2, drunk: 10, line: 'He pulls you a beer. You drink it at the bar, slowly, then not so slowly.' },
  { id: 'wine', name: 'A glass of wine', desc: 'Red, from a box under the counter.', cents: 275, std: 2, drunk: 10, line: 'A glass of red, poured to the brim. It tastes like the box.' },
  { id: 'shot', name: 'A shot of whiskey', desc: 'The well stuff. Burns all the way down.', cents: 350, std: 3, drunk: 14, line: 'A shot of well whiskey. You knock it back and it burns all the way down.' },
];
/** The church's kitchen feeds you once a day; a pew by day; the shelter's beds at night. */
const MEAL_EVERY = 20 * 3_600_000;
/** Dealing within a block of a school. */
const SCHOOL_CHARGE = 'Distribution near a school';
const pewHours = (t = now()) => ((h) => h >= 7 && h < 20)(new Date(t).getHours());
const shelterHours = (t = now()) => ((h) => h >= 19 || h < 9)(new Date(t).getHours());
/** When the shelter still takes people in: from seven, until the small hours (not just before they put everyone out). */
const shelterCheckIn = (t = now()) => ((h) => h >= 19 || h < 4)(new Date(t).getHours());
/** The next time it's this hour o'clock (the church locks at 8 PM, the shelter puts you out at 9 AM). */
const nextAt = (hour: number, t = now()) => {
  const d = new Date(t);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= t) d.setDate(d.getDate() + 1);
  return d.getTime();
};
/** When this shelter night began (7 PM, today or yesterday). */
const shelterNight = (t = now()) => {
  const d = new Date(t);
  if (d.getHours() < 19) d.setDate(d.getDate() - 1);
  d.setHours(19, 0, 0, 0);
  return d.getTime();
};
/** Watching a place: ten minutes, real time; not the same one again for a while. */
const WATCH_MS = 10 * 60_000;
const WATCH_AGAIN = 6 * 3_600_000;
/** Seeing who lives there without being seen: your sneak, and not looking like trouble. */
export const watchOdds = (sneak: number, loud: boolean) => Math.max(0.15, Math.min(0.9, 0.35 + sneak * 0.05 - (loud ? 0.15 : 0)));
/** The buildings you can walk into. */
const SPOT_KINDS = new Set(['vacant', 'warehouse', 'bar', 'church', 'shelter']);
const spotOf = (id: unknown) => ((b) => (b && SPOT_KINDS.has(b.kind) ? b : undefined))(buildingById(id));
/** Where somebody lives (an address you could find out). */
const isHome = (b: Building) => b.kind === 'house' || b.kind === 'rowhouse' || b.kind === 'apartment';
/** Your unit at the lock-up, by the building. */
const unitNo = (b: Building) => `#${10 + Math.floor((Math.abs(b.cx * 7 + b.cy * 13) % 80))}`;
/** Who lives in that building: an address, as if off their ID. */
export function homeFor(b: Building): Home {
  const kind: Kind = ((r) => (b.district === 'southside' ? (r < 0.6 ? 'civilian' : r < 0.82 ? 'drunk' : 'junkie') : r < 0.8 ? 'civilian' : r < 0.93 ? 'drunk' : 'junkie'))(Math.random());
  let home: Home | null = null;
  // (The building decides what kind of place it is; the dog, alarm and camera are rolled for that.)
  const type = b.kind === 'apartment' ? 'apartment' : b.kind === 'house' ? 'house' : 'rowhouse';
  for (let i = 0; !home && i < 20; i++) {
    const sex = Math.random() < 0.5 ? 'Male' : 'Female';
    const race = RACE_CHANCES[Math.floor(Math.random() * RACE_CHANCES.length)][0];
    home = makeHome({ name: nameFor(sex, race), sex, kind: i < 10 ? kind : 'civilian', age: 22 + Math.floor(Math.random() * 50), type });
  }
  const h = home!;
  h.floor = h.type === 'apartment' ? 1 + Math.floor(Math.random() * 4) : 1;
  if (h.type === 'apartment') h.car = null;
  // (The number on the building's door; a flat in it, its own letter.)
  h.addr = `${buildingAddr(b)}${h.type === 'apartment' ? `, Apt ${h.floor}${'ABCD'[Math.floor(Math.random() * 4)]}` : ''}`;
  h.bld = b.id;
  return h;
}
/** At an address: outside, or in, and what's happened so far. */
/** Everything in the save that's this character's (not the world's). */
const CHAR_KEYS = ['encounter', 'stats', 'health', 'inventory', 'humanity', 'place', 'policeStop', 'policeKnow', 'me', 'account', 'moves', 'koLines', 'record', 'policeResult', 'policeArrested', 'case', 'probationUntil', 'bailOffer', 'pawnBan', 'policeWhy', 'endLines', 'wokeLines', 'stash', 'room', 'sales', 'erSeen', 'debt', 'stingCash', 'homes', 'homeAt', 'job', 'homesLearned', 'idOk', 'hadId', 'cars', 'carAt', 'hunt', 'carStopHow', 'carReported', 'jail', 'footage', 'laterLines', 'restLines', 'connect', 'work', 'workLines', 'plasma', 'gig', 'bins', 'crowd', 'corner', 'spotAt', 'vacant', 'lockup', 'churchMeal', 'shelterAt', 'watched', 'policeCuffed', 'policeDucked', 'dezCalled', 'policeOffCorner'];
/** What only makes sense in the moment (a stop, a fight, a door you're at): not kept when you stop being them. */
const MOMENT_KEYS = ['spotAt', 'work', 'workLines', 'laterLines', 'restLines', 'crowd', 'encounter', 'policeStop', 'policeKnow', 'policeResult', 'policeArrested', 'bailOffer', 'jail', 'job', 'homeAt', 'carAt', 'hunt', 'koLines', 'endLines', 'wokeLines', 'policeWhy', 'carStopHow', 'policeCuffed', 'policeDucked', 'dezCalled', 'policeOffCorner'];
/**
 * Someone you used to be: kept whole (stats, body, pockets, record), inside
 * or out on the streets, to free, to meet, and to go on as again.
 */
type Self = {
  id: string;
  name: string;
  /** Which life they were (their own ID says so). */
  life: number;
  state: Record<string, unknown>;
  infamy: Infamy;
  status: 'inside' | 'free';
  /** Inside: when they're out (or the hearing, while they wait for one). */
  until: number;
  what: string;
  hearingAt?: number;
  /** Bail set for them (cents), while they wait for the hearing. */
  bail?: number;
  charges?: string[];
  priors?: number;
  /** The van that moves them: when (they told you, on a visit). */
  van?: number;
  /** Broke out: there's a warrant for them. */
  wanted?: boolean;
  /** When they walked out, and when you last saw them. */
  at?: number;
  metAt?: number;
};
/** Someone else on the street: who, as you'd meet them, and when they walk on (real time, ms). */
type Bystander = { e: Encounter; leaveAt: number; saw?: boolean };
/** Your supplier: known (someone vouched for you), how much he trusts you (−40..100), who vouched, when he cut you off. */
type Connect = { known: boolean; trust: number; via?: string; cutOff?: number; metBig?: boolean };
/**
 * What Dez sells: by how far he trusts you (tier) and how far up you are as a
 * dealer (standing). Cash prices by tier; fronted, more, and due in days.
 */
type DezDeal = { id: string; name: string; detail: string; doses: number; cash: [number, number, number]; front: number; days: number; tier: 1 | 2 | 3; standing: number; desc: string; product: Product; pill?: PillKind; pressed?: boolean };
const DEZ_DEALS: DezDeal[] = [
  { id: 'weed14', name: 'Half ounce of weed', detail: 'Fourteen grams, in a sandwich bag', doses: 140, cash: [110, 100, 90], front: 150, days: 3, tier: 1, standing: 0, desc: '14 g. Goes for about $12 a gram, $35 an eighth.', product: 'weed' },
  { id: 'perc20', name: 'Bottle of percs', detail: 'Twenty percs in an orange bottle, the label peeled off', doses: 20, cash: [170, 155, 140], front: 230, days: 3, tier: 1, standing: 0, desc: 'Twenty Percocet, sold one at a time.', product: 'pills', pill: 'perc' },
  { id: 'xan20', name: 'Roll of Xanax bars', detail: 'Twenty bars in a twist of plastic wrap', doses: 20, cash: [70, 60, 55], front: 100, days: 3, tier: 1, standing: 0, desc: 'Twenty bars. The party crowd wants them.', product: 'pills', pill: 'xanax' },
  { id: 'ball', name: 'Eight-ball', detail: 'Rocky powder in the knotted corner of a sandwich bag', doses: 35, cash: [180, 160, 150], front: 280, days: 3, tier: 1, standing: 0, desc: '3.5 g. Goes for about $90 a gram, $15 a point.', product: 'powder' },
  { id: 'weed28', name: 'Ounce of weed', detail: 'An ounce, pressed flat in a vacuum bag', doses: 280, cash: [0, 190, 170], front: 260, days: 5, tier: 2, standing: 1, desc: '28 g. Goes for about $12 a gram, $60 a quarter.', product: 'weed' },
  { id: 'adder30', name: 'Adderall, thirty', detail: 'Thirty orange tablets in a pill bottle', doses: 30, cash: [0, 110, 100], front: 160, days: 4, tier: 2, standing: 1, desc: 'Students pay for these at exam time.', product: 'pills', pill: 'adderall' },
  { id: 'blues', name: 'Blues', detail: 'Thirty little blue pills, pressed, stamped “M 30”', doses: 30, cash: [0, 300, 270], front: 450, days: 4, tier: 2, standing: 1, desc: '“Thirties.” Pressed, not from any pharmacy: nobody knows what’s in them. Buyers can’t tell. Some of them don’t wake up.', product: 'pills', pill: 'oxy', pressed: true },
  { id: 'quarter', name: 'Quarter ounce', detail: 'Seven grams, pressed, in a taped-up baggie', doses: 70, cash: [0, 320, 300], front: 500, days: 5, tier: 2, standing: 1, desc: '7 g. Goes for about $90 a gram, $15 a point.', product: 'powder' },
  { id: 'crystal35', name: 'Eight-ball of crystal', detail: 'Glassy shards in a zip bag', doses: 35, cash: [0, 150, 140], front: 230, days: 4, tier: 2, standing: 1, desc: '3.5 g. Goes for about $70 a gram, $12 a point.', product: 'crystal' },
  { id: 'crack', name: 'Bag of rocks', detail: 'Off-white rocks, a lot of them, in a knotted bag', doses: 60, cash: [0, 0, 210], front: 330, days: 4, tier: 3, standing: 2, desc: '6 g, about thirty rocks: $20 a rock. Southside and the Flats go through them fast.', product: 'crack' },
  { id: 'heroin', name: 'Heroin, five grams', detail: 'Brown powder, wrapped in a balloon and tape', doses: 50, cash: [0, 0, 240], front: 360, days: 5, tier: 3, standing: 2, desc: '5 g. Goes for about $85 a gram, $12 a bag.', product: 'heroin' },
  { id: 'oxy30', name: 'Oxycodone 30s, real', detail: 'Thirty pharmacy tablets in a bottle with someone else’s name on it', doses: 30, cash: [0, 0, 540], front: 760, days: 5, tier: 3, standing: 2, desc: 'The real thing, off a script. Worth every dollar to the people who want them.', product: 'pills', pill: 'oxy' },
  { id: 'crystal70', name: 'Quarter of crystal', detail: 'Seven grams of shards, double-bagged', doses: 70, cash: [0, 0, 270], front: 400, days: 5, tier: 3, standing: 2, desc: '7 g. Goes for about $70 a gram, $12 a point.', product: 'crystal' },
  { id: 'ounce', name: 'Ounce', detail: 'A full ounce, in a vacuum-sealed brick wrapped in tape', doses: 280, cash: [0, 0, 1100], front: 1600, days: 7, tier: 3, standing: 2, desc: '28 g, from Dez’s own supplier. Goes for about $90 a gram.', product: 'powder' },
];
/** Something that takes real time on its own screen: a plasma visit, a delivery shift. */
type Work = { kind: 'plasma' | 'deliver' | 'watch'; since: number; until?: number; drops?: number; earned?: number; tick?: number; part?: number; bld?: string };
/** The delivery app (made up). */
const GIG_APP = 'Handoff';
/** Camera footage someone will look at: when, where, what it shows. */
type Footage = { at: number; place: string; charges: string[]; sev: number; face: boolean; look: string; clothes: string };
/** Places with cameras, as said when the footage is pulled. */
const PLACE_NAMES: Record<string, string> = { bank: 'the bank’s cash machine', gas: 'the gas station', pharmacy: 'the pharmacy', liquor: 'the liquor store', pawn: 'the pawn shop' };
/** Your case: what you're charged with, bail, court, and any warrant (and what a warrant's for). */
type Case = {
  charges: string[];
  bail: number;
  courtAt: number;
  warrant?: boolean;
  /** Missed court (unset), a buy you ran from, an escape, or a crime they know was you. */
  warrantFor?: 'sting' | 'escape' | 'crime';
  /** For a crime warrant: what for (booked on these when they catch you). */
  warrantCharges?: string[];
  /** For a crime warrant: how hot it keeps you, till it's dealt with. */
  floor?: number;
  /** Missed the court date on top of another warrant (Failure to appear goes on when they book you). */
  missedCourt?: boolean;
  bailPaid?: number;
  stingPending?: number;
  /** How many of those sting sales were within a block of the school (booked with the school charge). */
  stingSchool?: number;
  jumped?: boolean;
};
/** Held: since when, until when (real time), what for, and what's said when the door opens. */
type Jail = { from: number; until: number; what: string; after?: string[]; triedAt?: number; tried?: string; escaped?: boolean };
/** Whether this one in the house (the owner, or whoever else lives there) has seen your face. */
type FaceSeen = boolean | { owner?: boolean | number; other?: boolean | number };
const sawFace = (j: { faceSeen?: FaceSeen } | undefined, owner: boolean) =>
  !!j && (j.faceSeen === true || (typeof j.faceSeen === 'object' && (owner ? j.faceSeen.owner : j.faceSeen.other) != null && (owner ? j.faceSeen.owner : j.faceSeen.other) !== false));
/** How covered you were when they saw your face (what they'll remember, mask or not since). */
const faceAnon = (j: { faceSeen?: FaceSeen } | undefined, owner: boolean, now: number): number => {
  if (!sawFace(j, owner)) return now;
  // (An older save's plain "seen": whoever it was.)
  const v = j!.faceSeen === true ? true : (j!.faceSeen as { owner?: boolean | number; other?: boolean | number })[owner ? 'owner' : 'other'];
  return Math.min(now, typeof v === 'number' ? v : 0.3);
};
interface HomeJob {
  home: string;
  in: boolean;
  /** How much noise you've made. */
  noise: number;
  how?: 'key' | 'try' | 'window' | 'kick';
  knocked?: boolean;
  tried?: boolean;
  /** Someone was home (that's a home invasion, not a burglary). */
  occupied?: boolean;
  /** Woken up (by your knocking, say). */
  woke?: boolean;
  /** Things you've taken. */
  took?: number;
  /** The alarm's going. */
  siren?: boolean;
  /** The police get here in this many more things you do. */
  policeIn?: number;
  /** Someone saw your face; the doorbell camera got you (and whether your face showed). */
  seen?: boolean;
  /** Your face as it was when they came on you (a mask pulled up after doesn't take it back). */
  faceSeen?: FaceSeen;
  filmed?: boolean;
  faceFilmed?: boolean;
  called?: boolean;
  /** You saw them make the call. */
  phoned?: boolean;
  /** Face to face with someone who lives there (and how they found you). */
  confront?: { owner: boolean; sex: 'Male' | 'Female'; text: string; how: 'awake' | 'woke' | 'home'; phoned?: boolean };
  /** Who you've already had it out with in there; someone dead in the house. */
  metOwner?: boolean;
  metOther?: boolean;
  killed?: boolean;
  /** You beat whoever it was; the cash you took out of the house (cents). */
  beat?: boolean;
  cash?: number;
  /** Your cash when a fight in the house started. */
  cashBefore?: number;
}
/** What the pharmacy sells (iron tablets aren't: they do nothing in a hurry). */
const SOLD_MEDS = () => MEDS.filter((m) => m.id !== 'iron');
const evilFear = (lost: number) => Math.min(15, lost * 0.1);
const humanityLevel = (lost: number) => HUMANITY.filter((l) => lost >= l.at).pop() ?? null;
const KILL_COST = 10;
/** A cigarette, start to finish (real time), and how much stress it takes away. */
const SMOKE_MS = 6 * 60_000;
const SMOKE_EASE = 35;
const STOMP_HELPLESS_COST = 1;
/** Each time you torture someone; robbing someone who's given up costs a little. */
const TORTURE_COST = 3;
const MUG_COST = 0.5;

import { worth as worthOf, chargeOf, chargeHtml, chargeName, COIN_MACHINE_FEE, ER_PRICES, ROOM_RENT, DEZ_FRONT, GAS_STOCK, GUN_STOCK, HIDDEN_PLACES, ID_FEE, LIQUOR_STOCK, PAWN_STOCK, PLACES, offer, placeInfo, type ErCare, type Place, type Stock } from './shops';
import { BILLS, COINS, addTo, cents, type Purse, breakBill, breaksInto, cashLike, coinsToBills, changeUp, count, denomName, fewest, isBill, money, pay, purseText } from './money';
import { hoursText, isOpen } from './clock';
import { DISTRICTS, DISTRICT_NAMES, EVENT_LINES, MARKET_KEYS, PILLS, midName, PRODUCTS, SELL_SIZE, SIZES, STANDING_NAMES, bagsFor, addLocalSupply, amountText, pkgAmount, districtWord, keyName, keyOf, keyProduct, marketWord, newMarket, nextStandingAt, priceFactor, productOf, qualityOf, qualityWord, quote, requestFor, returnHours, sizePrice, standingOf, standingScore, streetPrice, tickMarket, wantFor, type Market, type MarketKey, type PillKind, type Product } from './drugs';
import { anyoneIn, idText, makeHome, nameFor, ROOM_DESC, ROOM_SEARCH, roomLoot, roomName, roomsOf, steady, whoIsIn, type Home, type Presence, type RoomId } from './homes';
import { createHitUi } from '../fx/hitUi';
import { CAR_PARTS, PART_DESC, PART_NAME, REPORTED_HOURS, makeCar, makeOf, partLoot, reported, rollHunt, searchLine, type Car, type CarPart, type HuntState } from './cars';

/** Progress stored in the save file under `state.tv`. */
interface TvState {
  on: boolean;
}

/** Progress stored under `state.lurk`: how often you've lurked, who you've seen. */
interface LurkState {
  times: number;
  seen: Record<string, number>;
  races: Record<string, number>;
}

type Phase = 'idle' | 'cut' | 'waiting';

/**
 * The game itself. It starts with a television in the dark and one option:
 * turn it on. Once it has warmed up, there's one option: lurk. Each time you
 * lurk, the signal cuts out while you wait, then whoever you saw shows up as
 * a button (a civilian, a drunk, someone homeless or a junkie, with a race
 * from the U.S. standard categories). Tap them to choose: violence or
 * surveil (see encounter.ts). Each system keeps its progress in
 * `save.state`, so it is saved at every pause point automatically, including
 * an encounter in progress.
 */
/** One thing on the pile by the bins: something you found, or the cans. */
interface Found {
  item?: InvItem;
  cans?: number;
  day: string;
}
/** A thing by name, in a sentence: "the claw hammer", but "half a sandwich". */
// (Names that already say how much, like "half a sandwich", go without "the".)
const theThing = (name: string) => (/^(half|some|a|an|two|three|four)\b/i.test(name) ? name.toLowerCase() : `the ${name.toLowerCase()}`);
/** How many things can wait on the pile at once. */
const FOUND_MAX = 12;
/** One row of the finds wheel (CSS: .scav-item height). */
const WHEEL_ROW = 40;

export class Game {
  running = false;
  /** You bled out, and the death screen is up. */
  dead = false;
  /** Called the moment you die (to save: the world goes on without you). */
  onDeath?: () => void;
  /** Something changed (a screen, a move, a purchase): main.ts saves shortly after. */
  onChanged?: () => void;
  private readonly tv;
  private readonly powerBtn: HTMLButtonElement;
  /** "Shake your phone to wake up", on the dark screen after a knockout. */
  private readonly koHint: HTMLParagraphElement;
  private readonly lurkBtn: HTMLButtonElement;
  private readonly seenEl: HTMLElement;
  private readonly encView;
  private readonly hitUi;
  private readonly timers: number[] = [];
  private readonly listeners = new AbortController();
  /** Real seconds spent where you are, for warming up or getting cold. */
  private exposure = 0;
  private readonly statsEl: HTMLElement;
  private readonly youEl: HTMLElement;
  private readonly restBtn: HTMLButtonElement;
  private readonly noteEl: HTMLElement;
  private readonly goBtn: HTMLButtonElement;
  private readonly bagBtn: HTMLButtonElement;
  private readonly youBtn: HTMLButtonElement;
  private readonly shopEl: HTMLElement;
  private readonly sheetEl: HTMLElement;
  private sheet: 'places' | 'pockets' | 'stats' | 'police' | 'scav' | null = null;
  /** This time at the bins: what each dig turned up, newest first. */
  private scavLog: string[] = [];
  /** Which of what you've found the wheel has in its middle. */
  private scavSel = 0;
  /** A row you tapped, that the wheel's turning to. */
  private wheelTo: { i: number; until: number } | null = null;
  /** On the map: what you've tapped (its card shows under the map). */
  private mapPick: string | null = null;
  /** How the map is zoomed: z times, its layer moved by (tx, ty) parts of the map (0 to 1 − z). */
  private mapView = { z: 1, tx: 0, ty: 0 };
  /** A finger moved on the map since it went down: that wasn't a tap. */
  private mapMoved = false;
  /** When the last drag or pinch on the map ended (the click that follows it isn't a tap). */
  private mapDragEnd = 0;
  /** The landmark a finger came down on, on the map (see mapTap). */
  private mapDownOn: Element | null = null;
  private noteTimer = 0;
  private readonly clockEl: HTMLElement;
  private clockShown = '';
  private clockSec = 0;
  private weatherTimer = 0;
  private phase: Phase = 'idle';
  private timer = 0;
  private jam = 0;

  constructor(
    readonly save: SaveData,
    private readonly view: HTMLElement,
    renderer: THREE.WebGLRenderer,
    private readonly fx: Glass,
  ) {
    this.tv = createTv(renderer);
    this.repairSave();
    // (Old bagged product, from before it went by weight: one lot, from the start.)
    try {
      this.unbag();
    } catch {
      /* (an old save with no pockets yet) */
    }
    this.powerBtn = view.querySelector('#power-btn') as HTMLButtonElement;
    this.koHint = document.createElement('p');
    this.koHint.id = 'ko-hint';
    this.koHint.hidden = true;
    this.powerBtn.after(this.koHint);
    this.lurkBtn = view.querySelector('#lurk-btn') as HTMLButtonElement;
    this.seenEl = view.querySelector('#seen') as HTMLElement;
    this.statsEl = view.querySelector('#stats') as HTMLElement;
    this.statsEl.onclick = () => this.openSheet('stats');
    this.youEl = view.querySelector('#you-status') as HTMLElement;
    // Tapping your injuries shows what they do.
    // A tap on the street (not on a button or a panel) puts away the note that waits for you.
    view.addEventListener(
      'click',
      (ev) => {
        if (!this.noteSticky || performance.now() < this.tapsFrom) return;
        if ((ev.target as HTMLElement).closest('button, a, input, #sheet, #shop, #enc, #seen, #stats, #you-status')) return;
        this.dismissNote();
      },
      { signal: this.listeners.signal },
    );
    this.youEl.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('.enc-conds')) this.openSheet('stats');
    }, { signal: this.listeners.signal });
    this.restBtn = view.querySelector('#rest-btn') as HTMLButtonElement;
    this.noteEl = view.querySelector('#note') as HTMLElement;
    this.clockEl = view.querySelector('#clock') as HTMLElement;
    this.restBtn.onclick = () => performance.now() >= this.tapsFrom && this.rest();
    this.goBtn = view.querySelector('#go-btn') as HTMLButtonElement;
    this.bagBtn = view.querySelector('#bag-btn') as HTMLButtonElement;
    this.youBtn = view.querySelector('#you-btn') as HTMLButtonElement;
    this.shopEl = view.querySelector('#shop') as HTMLElement;
    this.shopEl.addEventListener('scroll', () => this.markShopMore(), { signal: this.listeners.signal, passive: true, capture: true });
    this.sheetEl = view.querySelector('#sheet') as HTMLElement;
    // A sheet with more below than shows: a fade at the bottom edge.
    {
      const mark = () => {
        for (const b of this.sheetEl.querySelectorAll<HTMLElement>('.sheet-body')) b.classList.toggle('more', b.scrollTop + b.clientHeight < b.scrollHeight - 4);
      };
      this.sheetEl.addEventListener('scroll', mark, { capture: true, signal: this.listeners.signal });
      const mo = new MutationObserver(() => requestAnimationFrame(mark));
      mo.observe(this.sheetEl, { childList: true, subtree: true });
      this.listeners.signal.addEventListener('abort', () => mo.disconnect());
    }
    this.goBtn.onclick = () => this.openSheet('places');
    this.bagBtn.onclick = () => this.openSheet('pockets');
    this.youBtn.onclick = () => this.openSheet('stats');
    this.edgeSwipes();
    this.mapGestures();
    // The finds wheel: when it stops turning, what's in the middle is picked.
    {
      let t = 0;
      this.sheetEl.addEventListener('scroll', (e) => {
        const w = e.target as HTMLElement;
        if (!w.classList?.contains('scav-wheel')) return;
        clearTimeout(t);
        t = window.setTimeout(() => {
          const at = Math.round(w.scrollTop / WHEEL_ROW);
          const to = this.wheelTo;
          if (to && performance.now() < to.until && at !== to.i) return;
          this.wheelTo = null;
          this.scavPicked(at);
        }, 90);
      }, { capture: true, signal: this.listeners.signal });
    }
    this.sheetEl.onclick = (ev) => this.sheetClick(ev);
    this.shopEl.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest('button');
      if (!b || b.disabled) return;
      this.withFeedback(b, () => this.shopAction(b));
    };
    this.restBtn.hidden = true;
    this.hitUi = createHitUi(view);
    this.encView = createEncounterView(view.querySelector('#enc') as HTMLElement, (id) => this.act(id));
    this.powerBtn.onclick = () => this.turnOn();
    this.lurkBtn.onclick = () => performance.now() >= this.tapsFrom && this.lurk();
    this.lurkBtn.hidden = true;
    document.addEventListener('pointerdown', this.onTap, { capture: true });
    this.refresh();
  }

  /** A shop button: what it does. */
  private shopAction(b: HTMLButtonElement) {
    if (b.dataset.leave !== undefined) {
      this.goTo('street');
      return;
    }
    if (b.dataset.buy) this.buy(b.dataset.buy as MedId);
      else if (b.dataset.sell) this.sell(Number(b.dataset.sell));
      else if (b.dataset.stock) this.buyStock(b.dataset.stock);
      else if (b.dataset.stockc) this.buyStock(b.dataset.stockc, 'carry');
      else if (b.dataset.bank) this.bank(b.dataset.bank);
      else if (b.dataset.atm) this.atm(Number(b.dataset.atm));
      else if (b.dataset.records) this.getId();
      else if (b.dataset.er) this.er(b.dataset.er as ErCare);
      else if (b.dataset.court) this.appear();
      else if (b.dataset.cans) this.cashCans();
      else if (b.dataset.plasma) this.donatePlasma();
      else if (b.dataset.selfact) this.selfAct(b.dataset.selfact);
      else if (b.dataset.room) this.roomAct(b.dataset.room);
      else if (b.dataset.spotact) this.spotAct(b.dataset.spotact);
      else if (b.dataset.dez) this.dez(b.dataset.dez);
      else if (b.dataset.homeact) this.homeAct(b.dataset.homeact);
      else if (b.dataset.huntact) this.huntAct(b.dataset.huntact);
      else if (b.dataset.caract) this.carAct(b.dataset.caract);
      else if (b.dataset.unstash) this.unstash(b.dataset.unstash);
      else if (b.dataset.cash) this.stashCash(b.dataset.cash);
      else if (b.dataset.cutpkg) this.cutPkg(b.dataset.cutpkg);
      else if (b.dataset.sellsz) this.stepSellSize(b.dataset.sellsz);
      else if (b.dataset.stash) this.stashItem(Number(b.dataset.stash));
  }

  /** What you're carrying and holding, to see whether a tap did anything. */
  /** Your numbers as of the last look (floating numbers float the difference). */
  private nums: Record<string, number> | null = null;
  private numsWho = '';
  private numbers(): Record<string, number> {
    const inv = this.inventory;
    const h = this.health;
    const e = this.encounter;
    const body = e && e.stage !== 'seen' && e.you ? e.you : null;
    const n: Record<string, number> = {
      cash: Math.round(cashOf(inv) * 100),
      bank: this.account?.cents ?? 0,
      blood: Math.round(body?.blood ?? h.blood),
      heat: this.infamy.heat,
      stress: body?.stress ?? h.stress ?? 0,
      fatigue: fatigueNow(h),
      humanity: this.humanity.lost,
      rep: this.infamy.rep,
      debt: this.debt?.owed ?? 0,
    };
    for (const k of Object.keys(this.stats) as StatName[]) n[`lvl:${k}`] = this.stats[k].level;
    for (const x of inv.items) {
      const key = keyOf(x);
      if (key) n[`p:${key}`] = (n[`p:${key}`] ?? 0) + (x.doses ?? 0);
    }
    return n;
  }
  /** What changed since the last look, floated up from where it lives (not the slow drift of time: see tick). */
  private floatNumbers(show: boolean) {
    const now_ = this.numbers();
    const who = `${this.world.lives}|${this.me.name}`;
    const was = this.nums;
    this.nums = now_;
    const same = who === this.numsWho;
    this.numsWho = who;
    if (!show || !was || !same || !settings.floaters || !this.tvState.on || this.dead) return;
    const e = this.encounter;
    const inEnc = !!e && e.stage !== 'seen';
    const fighter = document.querySelector('#enc .enc-fighter.you');
    // (On the street: under your status at the top, one column. In an encounter: over your side of it.)
    const you = inEnc ? [fighter] : [this.youEl];
    const hud = !inEnc && !!this.youEl && !this.youEl.hidden;
    const sign = (v: number) => (v > 0 ? '+' : '−');
    const keys = new Set([...Object.keys(was), ...Object.keys(now_)]);
    for (const k of keys) {
      const d = (now_[k] ?? 0) - (was[k] ?? 0);
      if (!d) continue;
      const a = Math.abs(d);
      let f: Float | null = null;
      if (k === 'cash' && a >= 1) f = { stat: k, value: d, text: (v) => `${sign(v)}${money(Math.abs(v))}`, tone: (v) => (v > 0 ? 'good' : 'neutral'), anchors: inEnc ? [fighter] : [this.youEl, this.bagBtn], start: hud, below: hud };
      else if (k === 'bank' && a >= 1) f = { stat: k, value: d, text: (v) => `${sign(v)}${money(Math.abs(v))} bank`, tone: (v) => (v > 0 ? 'good' : 'neutral'), anchors: inEnc ? [fighter] : [this.youEl, this.bagBtn], start: hud, below: hud };
      else if (k === 'blood' && a >= 50) f = { stat: k, value: d, text: (v) => `${sign(v)}${(Math.abs(v) / 1000).toFixed(1)} L`, tone: (v) => (v > 0 ? 'good' : 'bad'), anchors: you, start: hud, below: hud };
      else if (k === 'heat' && a >= 1) f = { stat: k, value: d, text: (v) => `${sign(v)}${Math.round(Math.abs(v))} Heat`, tone: (v) => (v > 0 ? 'bad' : 'good'), anchors: [this.sheetEl.querySelector('.police-card h3'), ...you], start: hud, below: hud };
      else if ((k === 'stress' || k === 'fatigue') && a >= 2) f = { stat: k, value: d, text: (v) => `${sign(v)}${Math.round(Math.abs(v))} ${k === 'stress' ? 'Stress' : 'Fatigue'}`, tone: (v) => (v > 0 ? 'bad' : 'good'), anchors: you, start: hud, below: hud };
      else if (k === 'humanity' && a >= 0.5) f = { stat: k, value: d, text: (v) => `${v > 0 ? '−' : '+'}${Math.round(Math.abs(v))} Humanity`, tone: (v) => (v > 0 ? 'bad' : 'good'), anchors: you, start: hud, below: hud };
      else if (k === 'rep' && a >= 1) f = { stat: k, value: d, text: (v) => `${sign(v)}${Math.round(Math.abs(v))} Rep`, tone: (v) => (v > 0 ? 'good' : 'bad'), anchors: you, start: hud, below: hud };
      else if (k === 'debt' && a >= 100) f = { stat: k, value: d, text: (v) => `Owe Dez ${sign(v)}${money(Math.abs(v))}`, tone: (v) => (v > 0 ? 'bad' : 'good'), anchors: you, start: hud, below: hud };
      else if (k.startsWith('lvl:') && d > 0) {
        const name = STAT_NAMES[k.slice(4) as StatName];
        f = { stat: k, value: d, text: (v) => `+${v} ${name}`, tone: () => 'good', anchors: you, start: hud, below: hud };
      } else if (k.startsWith('p:')) {
        const key = k.slice(2) as Parameters<typeof keyName>[0];
        const pr = keyProduct(key);
        f = { stat: k, value: d, text: (v) => `${sign(v)}${pr === 'pills' ? `${Math.abs(v)} ${midName(key)}` : `${amountText(pr, Math.abs(v))} ${midName(key)}`}`, tone: () => 'neutral', anchors: inEnc ? [fighter] : [this.bagBtn] };
      }
      if (f) floatChange(f);
    }
  }

  private snapshot() {
    const inv = this.inventory;
    return {
      cents: Math.round(cashOf(inv) * 100),
      bank: (this.account?.cents ?? 0),
      items: inv.items.length,
      key: JSON.stringify([inv.items.map((x) => [x.name, x.spot, x.doses ?? null]), inv.clothes, inv.gear ?? [], wearing(inv), this.health.bleeding, this.health.broken, this.health.splinted ?? [], Math.round(this.health.blood)]),
    };
  }

  /**
   * A tap's result, shown where you tapped: if it did something, the row
   * flashes and a label floats up from the button (what you got, what it
   * cost, where it went), and the Pockets tab bounces when you gain
   * something; if it did nothing, the button gives a short shake.
   */
  private withFeedback(b: HTMLButtonElement, run: () => void) {
    const before = this.snapshot();
    const rect = b.getBoundingClientRect();
    const attr = Object.keys(b.dataset)[0];
    const sel = attr ? `[data-${attr.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${CSS.escape(b.dataset[attr] ?? '')}"]` : '';
    const label = b.closest('li')?.querySelector('b')?.textContent ?? '';
    run();
    const after = this.snapshot();
    const now = (sel && (this.shopEl.querySelector(sel) ?? this.sheetEl.querySelector(sel))) as HTMLElement | null;
    if (before.key === after.key && before.cents === after.cents && before.bank === after.bank) {
      // Nothing happened (the note says why).
      const el = now ?? b;
      el.classList.remove('did-no');
      void el.offsetWidth;
      el.classList.add('did-no');
      sound.deny();
      buzz([8, 40, 8]);
      return;
    }
    // It worked: the good sound (unless money moved, which has its own).
    if (after.cents === before.cents && after.bank === before.bank) sound.good();
    const row = (now ?? b).closest('li');
    if (row) {
      row.classList.remove('did-ok');
      void (row as HTMLElement).offsetWidth;
      row.classList.add('did-ok');
    }
    // What changed, in a word or two.
    const bits: string[] = [];
    const dc = after.cents - before.cents;
    const db = after.bank - before.bank;
    if (after.items > before.items && label) bits.push(`+ ${label}`);
    else if (attr === 'move') {
      const it = this.inventory.items[Number(b.dataset.move)];
      const sp = it && this.inventory.spots.find((x) => x.id === it.spot);
      if (sp) bits.push(`→ ${sp.name}`);
    } else if (attr === 'load') bits.push('Loaded');
    else if (attr === 'drop' || after.items < before.items) bits.push(attr === 'drop' ? 'Trashed' : attr === 'use' ? 'Used' : '');
    // (The money itself floats up from your cash: see floatNumbers. Here, just what it was for.)
    if (!settings.floaters) {
      if (db) bits.push(`${db > 0 ? '+' : '−'}${money(Math.abs(db))} in the bank`);
      else if (dc) bits.push(`${dc > 0 ? '+' : '−'}${money(Math.abs(dc))}`);
    }
    const text = bits.filter(Boolean).join('  ');
    if (text) {
      const f = document.createElement('div');
      f.className = `float-label${db > 0 ? ' gain' : db < 0 || dc < 0 ? ' cost' : dc > 0 ? ' gain' : ''}`;
      f.textContent = text;
      // Over the button as it is now (the list may have moved).
      const at = now?.isConnected ? now.getBoundingClientRect() : rect;
      f.style.top = `${at.top}px`;
      document.body.append(f);
      // (Centred on the button, but all of it on the screen.)
      const half = f.offsetWidth / 2;
      f.style.left = `${Math.min(innerWidth - half - 8, Math.max(half + 8, at.left + at.width / 2))}px`;
      window.setTimeout(() => f.remove(), 1300);
    }
    // Something new on you: the Pockets tab bounces.
    if (after.items > before.items) {
      this.bagBtn.classList.remove('bump');
      void this.bagBtn.offsetWidth;
      this.bagBtn.classList.add('bump');
    }
    // The cash on you changed: it pulses.
    if (dc) {
      for (const el of document.querySelectorAll<HTMLElement>('.you-cash, .pocket-cash b')) {
        el.classList.remove('pulse');
        void el.offsetWidth;
        el.classList.add('pulse');
      }
    }
  }

  private get tvState(): TvState {
    return (this.save.state.tv ??= { on: false }) as TvState;
  }

  /** A save that's been knocked about (by hand, or a bad write): lists that should be lists, numbers that should be numbers. */
  private repairSave() {
    const st = this.save.state as Record<string, unknown>;
    // (Someone seen in a save from before the ten-minute rule: their time runs from when it was saved.)
    const se = st.encounter as Encounter | undefined;
    if (se && typeof se === 'object' && se.stage === 'seen' && !Number.isFinite(se.seenAt)) se.seenAt = Number.isFinite(this.save.savedAt) ? this.save.savedAt : now();
    const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
    const list = <T,>(o: Record<string, unknown>, k: string) => {
      if (k in o && !Array.isArray(o[k])) o[k] = [];
      if (Array.isArray(o[k])) o[k] = (o[k] as T[]).filter((v) => v != null);
    };
    const num = (o: Record<string, unknown>, k: string, d: number) => {
      if (k in o && !Number.isFinite(o[k] as number)) o[k] = d;
    };
    list(st, 'homes');
    if (Array.isArray(st.homes)) st.homes = (st.homes as unknown[]).filter((h) => obj(h) && typeof h.addr === 'string' && typeof h.id === 'string');
    list(st, 'cars');
    if (obj(st.inventory)) list(st.inventory, 'clothes');
    if (obj(st.health)) {
      num(st.health, 'fatigueAt', Date.now());
      num(st.health, 'fatigue', 0);
      num(st.health, 'stress', 0);
      for (const k of ['fatigue', 'stress']) if (typeof st.health[k] === 'number') st.health[k] = Math.min(100, Math.max(0, st.health[k] as number));
      for (const k of ['restEnd', 'restingSince']) if (k in st.health && !Number.isFinite(st.health[k] as number)) delete st.health[k];
    }
    if (obj(st.debt)) num(st.debt, 'owed', 0);
    if (obj(st.case)) list(st.case, 'charges');
    for (const k of ['stash', 'room']) if (obj(st[k])) list(st[k] as Record<string, unknown>, 'items');
    if (obj(st.vacant)) for (const v of Object.values(st.vacant)) if (obj(v)) list(v, 'items');
    if (obj(st.bins)) for (const b of Object.values(st.bins)) if (obj(b)) {
      list(b, 'aside');
      list(b, 'found');
      if (Array.isArray(b.found)) b.found = (b.found as unknown[]).filter((f) => obj(f) && (obj(f.item) || (Number.isFinite(f.cans) && (f.cans as number) > 0))).slice(0, 40);
    }
    const w = (this.save.state.world ?? null) as Record<string, unknown> | null;
    if (obj(w)) {
      list(w, 'thieves');
      list(w, 'people');
      list(w, 'selves');
      num(w, 'lives', 1);
      if (obj(w.infamy)) {
        for (const k of ['rep', 'heat']) {
          if (typeof w.infamy[k] === 'string') w.infamy[k] = Number(w.infamy[k]);
          num(w.infamy, k, 0);
        }
        num(w.infamy, 'at', Date.now());
      }
    }
  }
  private get lurkState(): LurkState {
    const s = (this.save.state.lurk ??= { times: 0, seen: {}, races: {} }) as LurkState;
    s.races ??= {};
    if (!s.seen || typeof s.seen !== 'object') s.seen = {};
    for (const [k] of CHANCES) s.seen[k] ??= 0;
    for (const [r] of RACE_CHANCES) s.races[r] ??= 0;
    return s;
  }

  /** Your stats: sneak, strength, agility (saved). */
  private get stats(): Stats {
    const s = (this.save.state.stats ??= newStats()) as Stats;
    const fresh = newStats();
    // From before Unarmed: the fighting you'd done counts (Strength used to be it).
    if (!s.unarmed && s.strength) s.unarmed = { level: s.strength.level, xp: 0 };
    // From when levels went to 20: the same skill is five times the level now.
    if (!this.save.state.statScale) {
      for (const k of Object.keys(s) as StatName[]) if (s[k]) s[k] = { level: Math.min(MAX_LEVEL, 1 + (s[k].level - 1) * 5), xp: 0 };
      this.save.state.statScale = 100;
    }
    for (const k of Object.keys(fresh) as StatName[]) s[k] ??= fresh[k];
    return s;
  }

  /** Your body between fights: blood and injuries carry over (saved). */
  private get health(): Health {
    return (this.save.state.health ??= newHealth()) as Health;
  }

  /** What's in your pockets: cash, loot, medicine (saved). */
  private get inventory(): Inventory {
    const inv = (this.save.state.inventory ??= newInventory()) as Inventory;
    upgradeInventory(inv);
    // (What you can carry, all told: your Strength.)
    inv.maxKg = carryLimit(this.stats.strength.level);
    return inv;
  }

  private get weather(): WeatherState {
    return (this.save.state.weather ??= newWeather()) as WeatherState;
  }

  /** How hard it's raining where you are (0 indoors), for the rain. */
  get rainAmount(): number {
    if (!this.tvState.on || this.inside) return 0;
    return RAIN_AMOUNT[this.weather.now];
  }
  /** How hard it's snowing where you are (0 indoors), for the snow. */
  get snowAmount(): number {
    if (!this.tvState.on || this.inside) return 0;
    return SNOW_AMOUNT[this.weather.now];
  }

  /**
   * Time out on the street: the rain soaks you and you get colder (a coat
   * helps, a T-shirt doesn't); dry weather lets you dry off. Returns what
   * to say, if anything.
   */
  private chill(): string | null {
    const h = this.health;
    const cold = h.cold ?? 0;
    // (Under a roof, like a bar's corner: no rain on you, and you dry off.)
    const rain = this.inside ? 0 : COLD_AMOUNT[this.weather.now];
    const snowing = isSnow(this.weather.now);
    const top = this.inventory.clothes[0] ?? '';
    const warm = coldFactor(this.inventory);
    if (rain > 0 && cold < 3 && Math.random() < rain * 0.65 * warm) {
      h.cold = cold + 1;
      return [
        '',
        snowing ? `Snow melts into your ${top.toLowerCase() || 'clothes'} and the cold gets in. You’re chilled.` : warm < 1 ? "The rain gets in at your collar and cuffs. You’re chilled." : `The rain soaks through your ${top.toLowerCase() || 'clothes'}. You’re chilled.`,
        snowing ? "The snow has worked its way in under everything. You’re cold to the bone." : "Your clothes cling, cold and heavy. You’re cold to the bone.",
        "You can’t stop shivering. Your fingers won’t work properly. You’re freezing.",
      ][h.cold];
    }
    if (rain === 0 && cold > 0 && Math.random() < 0.35) {
      h.cold = cold - 1;
      return h.cold ? 'You dry off a little.' : "You’ve dried off. You’re warm enough again.";
    }
    return null;
  }

  private get world(): World {
    const w = (this.save.state.world ??= newWorld()) as World;
    w.people ??= [];
    return w;
  }

  private get people(): Known[] {
    return this.world.people!;
  }

  /** Your reputation and heat, faded up to now. */
  private get infamy(): Infamy {
    const f = (this.world.infamy ??= newInfamy());
    fade(f);
    // (A warrant doesn't fade: your name's in the system until it's dealt with.)
    f.heat = Math.max(f.heat, this.warrantFloor);
    return f;
  }
  /** How hot a warrant keeps you, until it's dealt with: missed court, Low; a buy you ran from, Watched; an escape, Wanted; a crime, by what it was. */
  /** Booked for it: what witnesses saw of it is spent (no picking you out of a line-up for it again). */
  private spendSeen(charge: string) {
    const f = this.infamy;
    if (/^homicide$/i.test(charge)) f.killsSeen = 0;
    else if (/^assault/i.test(charge)) f.reports = 0;
    else if (/burglary|home invasion/i.test(charge)) f.burglaries = 0;
  }
  private get warrantFloor(): number {
    const c = this.case;
    if (!c?.warrant) return 0;
    const base = c.warrantFor === 'sting' ? 40 : c.warrantFor === 'escape' ? 60 : c.warrantFor === 'crime' ? 40 : 25;
    return Math.max(base, c.floor ?? 0);
  }
  /**
   * A warrant in your name for something they know you did: added to your
   * case (made one if there's none), with how hot it keeps you till it's dealt
   * with. It doesn't fade.
   */
  private warrantFor(charges: string[], floor: number) {
    if (!charges.length) return;
    const c: Case = this.case ?? { charges: [], bail: 0, courtAt: now() };
    if (!c.warrant) {
      c.warrant = true;
      c.warrantFor = 'crime';
    }
    c.warrantCharges = [...(c.warrantCharges ?? []), ...charges];
    c.floor = Math.max(c.floor ?? 0, floor);
    this.save.state.case = c;
  }

  /**
   * After an encounter with someone who lives: they remember you (see
   * people.ts). If they saw your face they talk, and some go to the police.
   */
  private rememberThem(e: Encounter) {
    // Someone from a house: dressed again, with their wallet and keys, before they're remembered.
    const a = e.resident?.away;
    if (a) {
      const p = e.person;
      if (a.top && p.clothes[0]?.name === 'T-shirt' && !p.clothes[0].loot.length) p.clothes[0] = a.top;
      p.clothes.push(...a.garments);
      p.carrying.push(...a.carrying);
      if (a.loot.length) (p.clothes[1] ?? p.clothes[0])?.loot.push(...a.loot.map((l) => ({ ...l, where: 'pocket' })));
      delete e.resident!.away;
    }
    const inv = this.inventory;
    if (e.them.dead && e.person.known) this.world.thieves = this.world.thieves.filter((t) => t.person.known !== e.person.known);
    const before = e.person.known ? this.people.find((k) => k.id === e.person.known)?.memory.sawFace : false;
    // (A regular of the life before: not yours to lose.)
    const wasCustomer = ((m) => !!m?.customer && !m.otherLife)(e.person.known ? this.people.find((k) => k.id === e.person.known)?.memory : undefined);
    const k = remember(this.people, e, e.seenAs ?? { anon: anonymity(inv), looked: describe(inv), clothes: lookClothes(inv) }, { robbed: !!e.robbed, stomped: !!e.stomped, mugged: !!e.mugged, tortured: e.tortured ?? 0 });
    if (k && (e.sale || wasCustomer)) this.customerBought(k, e, wasCustomer);
    if (!k || k.memory.beatYou || !this.people.includes(k)) return;
    const f = this.infamy;
    if (k.memory.sawFace && !before) f.rep += k.memory.grudge / 8;
    // Who goes to the police: most civilians, few junkies.
    // (Sworn to keep quiet, and scared enough to mean it: they mostly do. They still remember you.)
    const hush = e.hushed != null ? (e.hushed >= 88 ? 0.15 : e.hushed >= 70 ? 0.2 : 0.3) : 1;
    const reports = { civilian: 0.7, drunk: 0.4, homeless: 0.25, junkie: 0.15 }[k.person.kind] * hush;
    // (Charged for it on the spot: their statement is that charge, not a report for later.)
    if (e.result !== 'sold' && !e.enforcer && !e.charged && Math.random() < reports) {
      const amt = (k.memory.grudge / 5) * (k.memory.sawFace ? 1 : 0.4) * (e.hushed != null ? 0.4 : 1);
      // What they tell the police it was: taken from, hurt, or just scared.
      const hurt = !!e.fought && (e.them.out || e.them.broken.length > (e.start?.broken.length ?? 0) || e.them.blood < (e.start?.blood ?? e.them.maxBlood) - e.them.maxBlood * 0.15 || (e.tortured ?? 0) > 0);
      const charges = [...(e.robbed || e.mugged ? ['Robbery'] : []), ...(hurt ? ['Assault'] : []), ...(e.hushed != null && (e.robbed || e.mugged || hurt) ? ['Witness tampering'] : [])];
      this.reportedHeat(amt, e.seenAs?.anon, {
        sev: hurt ? ((e.tortured ?? 0) > 0 ? 10 : 6) : e.robbed || e.mugged ? 8 : 2,
        charges: k.memory.sawFace ? charges : [],
        floor: hurt ? 60 : 40,
        identified: k.memory.sawFace && (e.seenAs?.anon ?? 0) < 0.5,
      });
      // (So it's never a mystery why the police are more interested.)
      if (amt >= 1) this.later([k.memory.sawFace ? 'Word is they went to the police, with a good description of you.' : 'Word is they went to the police.']);
      if (k.memory.sawFace && e.fought) f.reports = (f.reports ?? 0) + 1;
    }
  }

  private get humanity(): Humanity {
    return (this.save.state.humanity ??= { lost: 0, kills: 0 }) as Humanity;
  }

  /** Loses some humanity; returns the line to show if it got worse. */
  private loseHumanity(n: number): string | null {
    const h = this.humanity;
    const before = humanityLevel(h.lost);
    h.lost += n;
    const after = humanityLevel(h.lost);
    return after && after !== before ? `${after.line} (Humanity: ${after.name})` : null;
  }

  /** Where you are (saved). */
  private get place(): Place {
    const p = (this.save.state.place as Place) ?? 'street';
    // (Saved inside a place that's hidden now: you're back outside.)
    return HIDDEN_PLACES.has(p) || (p === 'home' && !this.homeById(this.save.state.homeAt)) || (p === 'spot' && !spotOf(this.save.state.spotAt)) || (p === 'car' && !(this.carById(this.save.state.carAt) && this.inventory.items.some((x) => x.kind === 'car keys' && x.carId === this.save.state.carAt)) && !this.huntKeys()) ? 'street' : p;
  }
  private set place(p: Place) {
    this.save.state.place = p;
  }

  /** Your body as it is now, ready for a fight. */
  private yourBody() {
    return bodyFrom(this.health, maxStamina(this.stats));
  }

  /** A few lines shown in the middle of the screen for a while. */
  private note(lines: string[], sticky = false, tag?: string) {
    if (!lines.length) return;
    const fight = this.encounter;
    // The beat after a fight ends (the screen's about to change), lying down, inside:
    // it waits, and shows once there's a screen to show it on.
    if ((this.ending && fight) || (!this.running && (this.health.restingSince != null || this.jailed || !!this.work))) {
      this.later(lines);
      return;
    }
    // In a shop, or with a sheet open, what happened shows right there (the
    // street's note would be behind it).
    if (this.sheet === 'stats' || this.sheet === 'pockets') {
      this.sheetNote = lines;
      this.renderSheet();
      // (A note waiting on the street stays as it was; and mid-fight, the log has it too, if it's yours.)
      if (fight && fight.stage !== 'seen' && this.tvState.on) {
        if (this.ticking) this.later(lines);
        else for (const text of lines) fight.log.push({ by: 'info', text });
        return;
      }
      if (this.noteSticky && !this.noteEl.hidden) return;
    } else if (this.sheet) {
      // (Places and the police have no room for it: it waits until they close.)
      this.heldNote = [...this.heldNote, ...lines];
      return;
    }
    // Mid-fight, it goes in the fight's log (not over the top of it); unless it's the
    // clock's doing, not yours: that waits till it's over (the log is what you do).
    // (And on the screen where it ended, or beside a body: under the last of the log.)
    if (fight && fight.stage !== 'seen' && this.tvState.on && this.ticking) {
      this.later(lines);
      return;
    }
    if (fight && fight.stage !== 'seen' && this.tvState.on) {
      for (const text of lines) fight.log.push({ by: 'info', text });
      this.refresh();
      return;
    }
    if (this.place !== 'street' && this.tvState.on && !this.encounter) {
      // (Something else a moment later goes under what's there: the weather doesn't wipe how you woke.)
      // (What you did just now replaces it, though.)
      const yours = performance.now() - this.lastTap < 1500;
      this.shopNote = !yours && performance.now() - this.shopNoteAt < 15_000 ? [...this.shopNote, ...lines].slice(-8) : lines;
      this.shopNoteAt = performance.now();
      this.renderShop();
    }
    const p = (l: string) => Object.assign(document.createElement('p'), { textContent: l });
    // On the street, every note waits for a tap (you read it, then it goes):
    // anything else that comes in meanwhile (the weather, a cigarette burning
    // down) goes under it, and what happened with someone stays on top.
    const head = sticky;
    sticky = true;
    if (!head && this.noteSticky && !this.noteEl.hidden) {
      // (The weather: only how it is now, not how it was a minute ago.)
      if (tag) this.noteEl.querySelectorAll(`p[data-tag="${tag}"]`).forEach((x) => x.remove());
      this.noteEl.querySelector('.note-tap')?.before(...lines.map((l) => { const el = Object.assign(p(l), { className: 'note-extra' }); if (tag) el.dataset.tag = tag; return el; }));
      // (Only the latest few of those: what the note said first stays.)
      const extra = [...this.noteEl.querySelectorAll('p.note-extra')];
      for (const el of extra.slice(0, Math.max(0, extra.length - 3))) el.remove();
      this.save.state.stickyExtra = [...((this.save.state.stickyExtra as string[] | undefined) ?? []), ...lines].slice(-3);
      // (Longer now: find it room again.)
      this.fitStreet();
      return;
    }
    this.noteSticky = sticky;
    if (sticky) this.save.state.stickyNote = [...lines];
    else delete this.save.state.stickyNote;
    delete this.save.state.stickyExtra;
    this.noteEl.classList.toggle('sticky', sticky);
    this.noteEl.replaceChildren(...lines.map((l) => { const el = head ? Object.assign(p(l), { className: 'note-head' }) : p(l); if (tag) el.dataset.tag = tag; return el; }), Object.assign(p('Tap to dismiss'), { className: 'note-tap' }));
    this.noteEl.hidden = false;
    clearTimeout(this.noteFade);
    this.noteEl.classList.remove('fading');
    // Someone across the street: under their card, not on it.
    const low = this.encounter?.stage === 'seen';
    this.noteEl.classList.toggle('low', low);
    // (Below the card and Lurk, whichever is lower.)
    // (Its place is the same strip every time: see fitStreet.)
    void low;
    this.fitStreet();
    this.noteEl.style.animation = 'none';
    void this.noteEl.offsetWidth;
    this.noteEl.style.animation = '';
    this.noteTimer = sticky ? 0 : 3 + lines.length * 1.2;
  }
  /**
   * The street screen, laid out once: nothing moves to make room for a note.
   * The card for who you've seen stays where it is (shortened to just who it
   * is if the screen's too short for more), Lurk stays where it is, and a note
   * always goes in the same strip: under Lurk, above the You tab. A long one
   * scrolls in there.
   */
  private fitStreet() {
    const vr = this.view.getBoundingClientRect();
    if (!vr.height) return;
    const box = (el: Element | null) => {
      if (!el || (el as HTMLElement).hidden || !el.getClientRects().length) return null;
      const r = el.getBoundingClientRect();
      return r.width && r.height ? r : null;
    };
    // (Older layouts moved these about: never now.)
    this.seenEl.style.marginTop = '';
    const idleBar = document.getElementById('idle-bar');
    if (idleBar) idleBar.style.transform = '';
    const lurks = [box(this.lurkBtn), box(this.restBtn)].filter((x): x is DOMRect => !!x);
    // The card: just who it is, when the full card would reach Lurk (the screen decides, not a note).
    const card = this.seenEl.querySelector('button');
    if (card) {
      this.seenEl.classList.remove('compact');
      // (Clear of the clock: fixed by the screen, the same every time.)
      const clock = box(document.getElementById('clock'));
      const c0 = box(card);
      if (c0 && clock && c0.top < clock.bottom + 6 && c0.right > clock.left && c0.left < clock.right) this.seenEl.style.marginTop = `${Math.ceil(clock.bottom + 6 - c0.top)}px`;
      const c = box(this.seenEl);
      if (c && lurks.some((l) => c.bottom + 4 > l.top)) {
        this.seenEl.classList.add('compact');
        this.seenEl.style.marginTop = '';
        const c1 = box(card);
        if (c1 && clock && c1.top < clock.bottom + 6 && c1.right > clock.left && c1.left < clock.right) this.seenEl.style.marginTop = `${Math.ceil(clock.bottom + 6 - c1.top)}px`;
      }
    }
    const note = this.noteEl;
    // (In a shop, its own rules place it.)
    if (this.view.classList.contains('in-shop')) {
      note.style.top = note.style.bottom = note.style.maxHeight = '';
      return;
    }
    if (note.hidden) return;
    note.classList.remove('over');
    note.classList.toggle('tight', vr.height < 460);
    // Its strip: under Lurk (or where Lurk sits), down to the You tab.
    const under = lurks.length ? Math.max(...lurks.map((l) => l.bottom)) : (box(idleBar)?.bottom ?? vr.top + vr.height * 0.62);
    const you = box(this.youBtn);
    const top = under + 6;
    const bottom = (you ? you.top : vr.bottom) - 6;
    note.style.top = `${Math.round(top - vr.top)}px`;
    // (Its top is set here: its bottom comes from what's in it, never from an older rule.)
    note.style.bottom = 'auto';
    note.style.maxHeight = `${Math.max(44, Math.round(bottom - top))}px`;
  }
  /** The note that waits for you (see note): up until you tap, lurk, rest or go somewhere. */
  private noteSticky = false;
  private dismissNote() {
    if (!this.noteSticky) return;
    this.unstick();
    this.noteTimer = 0.01;
  }
  /** No longer waiting (and not brought back on a reload). */
  private unstick() {
    this.noteSticky = false;
    this.noteEl.classList.remove('sticky');
    delete this.save.state.stickyNote;
    delete this.save.state.stickyExtra;
  }

  /** Rest: several hours pass, and you heal. */
  rest() {
    if (!this.canLurk) return;
    this.unstick();
    const hurt = isHurt(this.health) && this.restHeals;
    if (!hurt) {
      if (isHurt(this.health) && fatigueNow(this.health) < 3) {
        this.note(['You rested not long ago. What’s left of it heals with time.']);
        return;
      }
      if (fatigueNow(this.health) < 3) {
        this.note(["You’re not hurt, and you’re not tired. There’s nothing to rest off."]);
        return;
      }
      this.encounter = null;
      this.save.state.crowd = [];
      this.lieDown('street', [this.atBar ? 'You fold your arms on the bar, put your head down, and close your eyes. Nobody stops you.' : WET_AMOUNT[this.weather.now] > 0 ? `You find a doorway out of the ${isSnow(this.weather.now) ? 'snow' : 'rain'} and lie down.` : 'You find somewhere out of the way, sit down against the wall, and close your eyes.']);
      return;
    }
    this.encounter = null;
    this.save.state.crowd = [];
    this.wipeBlood();
    const raining = !this.atBar && WET_AMOUNT[this.weather.now] > 0;
    const lieAfter = fatigueNow(this.health) >= 3;
    this.health.restHealAt = now();
    const lines = [this.atBar ? 'You take a booth at the back and rest.' : raining ? `You find a doorway out of the ${isSnow(this.weather.now) ? 'snow' : 'rain'} and rest.` : 'You find somewhere quiet and rest.', ...passHours(this.health, REST_HOURS, true, !lieAfter)];
    if (this.health.dead) return this.die(lines);
    const h = this.health;
    if (h.cold) {
      // Out of the wind you warm up a little; dry, you warm up more.
      h.cold = Math.max(0, h.cold - (raining ? 1 : 2));
      lines.push(h.cold ? `You’re still ${COLD_NAMES[h.cold].toLowerCase()}, but less.` : 'You stop shivering.');
    }
    if (h.wired && h.wiredUntil == null) {
      h.wired = false;
      lines.push(h.wiredBy === 'meth' ? 'The meth wears off while you sit there. Your skin crawls, and you feel hollow.' : 'The coke wears off while you sit there. You feel hollow.');
      delete h.wiredBy;
    }
    this.refresh();
    // (And then you stay down, as long as it takes to get your strength back.)
    if (fatigueNow(h) >= 3) return this.lieDown('street', lines);
    this.note(lines);
    buzz(8);
  }
  /** Lying down for real: real time, until you're fresh or you get up. */
  private lieDown(where: 'street' | 'room' | 'car' | 'squat' | 'shelter' | 'pew', lines: string[], car?: string) {
    const h = this.health;
    fatigueNow(h);
    h.restingSince = now();
    h.restWhere = where;
    if (where !== 'pew' && where !== 'shelter') delete h.restEnd;
    if (car) h.restCar = car;
    else delete h.restCar;
    this.save.state.restLines = lines;
    this.running = false;
    this.showRest();
  }
  /** What happened as you lay down (on the rest screen, and said again when you get up). */
  private get restLines(): string[] {
    return (this.save.state.restLines as string[] | undefined) ?? [];
  }
  private restTick = -1;
  private showRest() {
    const h = this.health;
    if (h.restingSince == null) return;
    document.getElementById('rest')?.remove();
    const el = document.createElement('div');
    el.id = 'rest';
    el.className = 'lockup';
    const where = h.restWhere === 'room' ? 'In your room at the Marlow, the door wedged shut.' : h.restWhere === 'car' ? 'In the back seat, doors locked, windows fogged.' : h.restWhere === 'squat' ? 'In the back room of an empty house, out of sight of the street.' : h.restWhere === 'shelter' ? 'On a cot at the shelter, your shoes under your head so nobody takes them.' : h.restWhere === 'pew' ? 'On a back pew at St. Agnes, the candles guttering.' : this.atBar ? 'Head down on the bar, the jukebox going.' : WET_AMOUNT[this.weather.now] > 0 ? 'In a doorway, out of the weather, your back to the wall.' : 'Against a wall, your eyes shut.';
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    el.innerHTML =
      `<h2>Resting</h2>` +
      `<p class="jail-what">${where}</p>` +
      this.restLines.slice(-3).map((l) => `<p class="rest-line">${esc(l)}</p>`).join('') +
      `<div class="rest-bar"><i></i></div>` +
      `<p class="jail-left"></p>` +
      `<p class="jail-out"></p>` +
      `<p class="jail-how">Rest is real time. Come back later, or get up now with what you’ve got back so far.${h.restWhere === 'room' || h.restWhere === 'shelter' ? '' : ' A bed gets you there quicker: your room at the Marlow, or the shelter at night.'}</p>` +
      `<div class="lockup-btns"><button type="button" class="jail-quit">Get up</button><button type="button" class="jail-quit lockup-you">You</button></div>`;
    const shown = performance.now();
    el.querySelector('button')!.addEventListener('click', () => performance.now() - shown > 800 && this.getUp(false));
    el.querySelector('.lockup-you')!.addEventListener('click', () => this.openSheet('stats'));
    if (this.sheet === 'stats') el.classList.add('behind');
    this.view.append(el);
    this.restTick = -1;
    this.tickRest();
  }
  private tickRest() {
    const h = this.health;
    if (h.restingSince == null) return;
    // (The church locks the sanctuary at night; the shelter puts everyone out in the morning:
    // that comes first, so being away past closing doesn't count as sleeping on.)
    if ((h.restWhere === 'pew' || h.restWhere === 'shelter') && (now() >= (h.restEnd ?? Infinity) || (h.restWhere === 'pew' ? !pewHours() : !shelterHours()))) {
      fatigueNow(h);
      this.save.state.laterLines = [...((this.save.state.laterLines as string[] | undefined) ?? []), h.restWhere === 'pew' ? 'Someone shakes your shoulder: they’re locking up for the night. You’re shown out onto the street.' : 'The lights come on and a volunteer walks the rows calling time. Everyone out, onto the street.'];
      // (Out the door with everyone else: back on your corner.)
      if (this.place === 'spot') {
        this.place = 'street';
        this.wasInside = this.inside;
        this.insideAt = 'street';
      }
      return this.getUp(false);
    }
    const f = fatigueNow(h);
    if (f <= 0) return this.getUp(true);
    const el = document.getElementById('rest');
    if (!el) return this.showRest();
    const sec = Math.ceil(restLeft(h) / 1000);
    if (sec === this.restTick) return;
    this.restTick = sec;
    const hh = Math.floor(sec / 3600);
    const mm = Math.floor((sec % 3600) / 60);
    const ss = sec % 60;
    const two = (n: number) => String(n).padStart(2, '0');
    (el.querySelector('.rest-bar i') as HTMLElement).style.width = `${Math.max(0, 100 - f)}%`;
    el.querySelector('.jail-left')!.textContent = `${two(hh)}:${two(mm)}:${two(ss)} to fully rested`;
    el.querySelector('.jail-out')!.textContent = `${FATIGUE_NAMES[fatigueLevel(Math.round(f))]} (${Math.round(f)} / 100) · ${h.restEnd != null && h.restEnd < now() + restLeft(h) ? `${h.restWhere === 'pew' ? 'they lock up at' : 'everyone out at'} ${clockText(h.restEnd)}` : `rested by ${clockText(now() + restLeft(h))}`}`;
  }
  /** Up again: rested, or not quite. */
  private getUp(rested: boolean) {
    const h = this.health;
    if (h.restingSince == null) return;
    // (The body first, at the resting rate, before you're up.)
    this.healOnClock(true);
    if (h.restingSince == null || this.dead) return;
    fatigueNow(h);
    const where = h.restWhere;
    const car = h.restCar;
    const slept = now() - h.restingSince;
    delete h.restingSince;
    delete h.restWhere;
    delete h.restEnd;
    delete h.restCar;
    document.getElementById('rest')?.remove();
    const lay = this.restLines;
    delete this.save.state.restLines;
    this.running = !this.paused && !this.jail && !this.dead;
    const f = Math.round(fatigueNow(h));
    const meanwhile = (this.save.state.laterLines as string[] | undefined) ?? [];
    delete this.save.state.laterLines;
    // (What happened as you lay down, after the first line of it, which the screen led with.)
    const said = lay.slice(1);
    const lines = [rested ? (where === 'room' ? 'You wake up in your room at the Marlow, rested. The street’s still out there.' : where === 'car' ? 'You wake up in the back seat, stiff, but rested.' : where === 'squat' ? 'You wake up on the floor of the empty house, stiff, but rested. Nobody came.' : where === 'shelter' ? 'You wake up on the cot, rested. Your shoes are still there.' : where === 'pew' ? 'You wake up on the pew, rested. Nobody moved you on.' : 'You wake up against the wall, rested. Nobody bothered you.') : `You get up${slept < 10 * 60_000 ? ' after a few minutes' : ''}. ${f >= 20 ? `Still ${FATIGUE_NAMES[fatigueLevel(f)].toLowerCase()}.` : 'Good enough.'}`];
    // (Towed while you slept: you wake to it.)
    const c = car ? this.carById(car) : undefined;
    if (c && now() >= c.towAt) {
      this.refresh();
      this.note([...said, ...this.towed(c, 'You wake to a hammering on the glass: the tow truck driver. You climb out, and he hooks it up without a word to you.'), ...meanwhile]);
      return;
    }
    // (Reported by now: someone's been looking for it.)
    if (c && this.place === 'car' && slept > 30 * 60_000 && reported(c, now()) && Math.random() < 0.4) {
      lines.unshift(...said);
      lines.push(...meanwhile, 'A flashlight on the glass. Someone is tapping on the window with a baton.');
      this.infamy.heat = Math.min(100, this.infamy.heat + 10);
      this.refresh();
      return this.carCops(c, lines, 'asleep');
    }
    this.refresh();
    this.note([...said, ...lines, ...meanwhile]);
    buzz(rested ? [30, 20, 30] : 8);
  }

  /** The person you saw last, and what's happened with them (saved). */
  private get encounter(): Encounter | null {
    const e = this.save.state.encounter as Encounter | undefined;
    // An encounter saved by an older version of the game can't be continued.
    if (e && e.version !== ENCOUNTER_VERSION) {
      delete this.save.state.encounter;
      return null;
    }
    return e ?? null;
  }
  private set encounter(e: Encounter | null) {
    // Done with whoever was there: if they had your old things, remember
    // what's left on them.
    const old = this.encounter;
    if (old && old !== e) {
      if (old.them.dead && old.person.home) {
        const h = this.homeById(old.person.home.id);
        if (h && !h.deadAt) {
          h.deadAt = now();
          // (Nobody left to change the locks: unless someone else lives there, or it's already arranged.)
          if (h.lockAt == null && h.household === 'alone') h.lockAt = NEVER;
        }
      }
      // Someone else who lived there, dead: one fewer in the house.
      if (old.them.dead && old.resident && !old.resident.owner) {
        // (Wherever you are now: it's the house you were at.)
        const h = this.homeById(this.save.state.homeAt);
        if (h) h.household = 'alone';
      }
      if (old.enforcer && old.result !== 'lost' && this.debt) {
        this.debt.strikes = (this.debt.strikes ?? 0) + 1;
        const t = this.trustDez(-30);
        if (t) this.later([t]);
      }
      // (Remembered first: the thief record then knows who they are, and the two stay one person.)
      if (old.stage !== 'seen') this.rememberThem(old);
      settle(this.world, old);
    }
    this.save.state.encounter = e ?? undefined;
  }

  /**
   * Can you lurk right now? Once the TV has warmed up, and not in the middle
   * of something with someone (you can always skip a person you haven't
   * approached).
   */
  private get canLurk() {
    const e = this.encounter;
    // (Not while the police have you stopped.)
    return this.running && this.tv.showingPicture && this.phase === 'idle' && this.place === 'street' && !this.save.state.policeStop && (!e || e.stage === 'seen' || e.stage === 'over');
  }

  /** Lurk: the signal cuts out while you wait for whoever comes. */
  lurk() {
    if (!this.canLurk) return;
    this.save.state.crowd = [];
    // Known around here: his people come to you.
    if (!this.connect.known && !this.connect.cutOff && this.infamy.rep >= 30 && Math.random() < 0.05) {
      this.note(['A kid on a bike slows down beside you and doesn’t look at you. “Dez wants to meet you. The alley behind the laundromat.” Then he’s gone.', ...this.learnConnect('a kid on a bike')]);
      return;
    }
    if (fatigueNow(this.health) >= FATIGUE_SPENT) {
      this.note(['You’re spent. Your eyes keep closing on their own and the street swims. You need to lie down. Tap Rest.']);
      return;
    }
    addFatigue(this.health, 0.2);
    this.phase = 'cut';
    sound.static();
    this.timer = 0.45;
    this.encounter = null;
    this.unstick();
    this.noteEl.hidden = true;
    this.wipeBlood();
    // (Wounds bleed and heal on the real clock now, not by the lurk.)
    const lines: string[] = [];
    // Withdrawal: the craving, and (off drink or downers, badly) a seizure.
    {
      const wd = withdrawalEffects(this.health);
      if (wd.worst && wd.worst.sev > 0.15 && Math.random() < 0.3) {
        const inv = this.inventory;
        const pack = wd.worst.k === 'nicotine' && inv.items.some((x) => /cigarettes/i.test(x.name) && (x.doses ?? 1) > 0);
        const bottle = wd.worst.k === 'alcohol' && inv.items.some((x) => (x.drink === 'liquor' || x.drink === 'beer') && (x.doses ?? 1) > 0);
        lines.push(pack ? 'Your hand keeps going to the pack in your pocket.' : bottle ? 'You keep thinking about the bottle in your pocket.' : cravingLine(wd.worst.k));
      }
      if (wd.seizure > 0 && Math.random() < wd.seizure) {
        lines.push('Your jaw locks, your arms jerk, and the street tilts away. When you come to, you’re on the sidewalk, your tongue bitten, your whole body aching. A seizure.');
        lines.push(...passHours(this.health, 1));
        this.health.stress = Math.min(100, (this.health.stress ?? 0) + 25);
        this.health.concussion = Math.max(this.health.concussion, 2);
        this.fx.dirt(0.7);
      }
    }
    if (this.health.dead) return this.die(lines);
    const c = this.chill();
    if (c) lines.push(c);
    // With heat on you, a patrol might stop you instead of anyone turning up.
    // A patrol stops you if they're looking for you, or if they can see what you're carrying.
    const shows = exposure(this.inventory);
    // (Looking like the description they have, and how much of your face shows: see patrolOdds.)
    const odds = this.patrolOdds();
    // (Their odds already count your heat, any description out, and a mask that draws eyes.)
    const wanted = Math.random() < odds.wanted;
    if (wanted || (shows > 0.15 && Math.random() < odds.shows)) {
      this.phase = 'idle';
      this.refresh();
      // What happened while you waited, and why they've stopped: at the top of the stop.
      const why = wanted
        ? oneOf(['A patrol car slows as it passes. The one in the passenger seat looks from you to his phone, and back.', "A patrol car rolls past, slow. The brake lights come on. They’ve had a description."])
        : oneOf(['A patrol car slows alongside. The one in the passenger seat is looking at your pocket, at what shows.', "A patrol car slows alongside. The driver’s eyes go to the shape under your clothes and stay there."]);
      const stop = (said: string[]) => {
        this.save.state.policeWhy = said;
        this.save.state.policeStop = true;
        this.openSheet('police');
        buzz([30, 30, 30]);
      };
      // Sometimes you see them first: a moment to get out of sight (Sneak).
      const sneak = this.stats.sneak?.level ?? 1;
      if (Math.random() < Math.min(0.7, 0.35 + sneak * 0.004)) {
        // (Saved as a stop already: closing the game on the choice doesn't get you out of it.)
        this.save.state.policeWhy = [...lines, why];
        this.save.state.policeStop = true;
        this.showChoice('A patrol car', [...lines, 'A patrol car turns onto the block, slow.'], [
          {
            label: 'Duck into a doorway',
            act: () => {
              if (Math.random() < 0.45 + sneak * 0.004 - fatigueOdds(this.health) - (wanted ? 0.1 : 0)) {
                delete this.save.state.policeStop;
                delete this.save.state.policeWhy;
                this.note(['You step into a doorway and wait, still, until its taillights turn the corner.']);
                return;
              }
              // (Seen ducking: they're less inclined to believe a story.)
              this.save.state.policeDucked = true;
              stop(['You step into a doorway, a second too late. The patrol car stops.']);
            },
          },
          { label: 'Stay where you are', act: () => stop([...lines, why]) },
        ]);
        return;
      }
      stop([...lines, why]);
      return;
    }
    this.refresh();
    // (Lurk greys out while you wait, rather than vanishing: the screen stays put.)
    this.lurkBtn.classList.add('waiting');
    this.restBtn.hidden = true;
    if (lines.some((l) => l.includes('collapse'))) {
      // Collapsed from blood loss: nobody this time.
      this.phase = 'idle';
      this.lurkBtn.classList.remove('waiting');
      this.note(lines);
      return;
    }
    // (Said once the static clears: nobody can read through the cut.)
    this.pendingLurk = lines;
    buzz(10);
  }
  /** What to say as the lurk's static clears (the cold, a craving). */
  private pendingLurk: string[] = [];

  /** An option picked in the encounter (or 'open' from the person button). */
  private act(id: string) {
    const e = this.encounter;
    if (!e || !this.running || this.ending) return;
    if ((id === 'lurk' || id === 'rest') && performance.now() < this.tapsFrom) return;
    if (id === 'lurk') return this.lurk();
    if (id === 'rest') return this.rest();
    if (id === 'pockets') return this.openSheet('pockets');
    if (id === 'go') return this.openSheet('places');
    if (id === 'leave-body') {
      // (Nothing left to say about it on the street: it's all there in the fight.)
      return this.closeEncounter([], true);
    }
    if (id === 'done') {
      if (performance.now() < this.tapsFrom) return;
      delete this.save.state.endLines;
      return this.closeEncounter([], true);
    }
    // Walking up to them: whatever note was waiting goes (it's the fight's screen now).
    if (e.stage === 'seen') {
      this.unstick();
      this.noteEl.hidden = true;
    }
    // Approaching someone: bring your body as it is now (and lose the cigarette).
    if (e.stage === 'seen' && id === 'ambushed') e.you = this.yourBody();
    else if (e.stage === 'seen') {
      e.you = this.yourBody();
      if (e.you.smoking && id !== 'leave') e.log.push({ by: 'info', text: 'You walk over with the cigarette still burning between your lips.' });
      // Whether they know you depends on how you look as you walk up.
      const inv = this.inventory;
      e.conspicuous = conspicuous(inv);
      const k = e.person.known ? this.people.find((x) => x.id === e.person.known) : undefined;
      // (In their house, a face they've already seen stays seen.)
      const anon = e.resident ? faceAnon(this.save.state.job as HomeJob | undefined, e.resident.owner, anonymity(inv)) : anonymity(inv);
      const clothes = lookClothes(inv).join('|');
      const was = e.lookAt;
      if (!was || was.anon !== anon || was.clothes !== clothes) {
        if (k) e.recognised = recognises(k, anon, lookClothes(inv));
        // (Known from what people say: more covered up now, less chance.)
        else if (e.byRep && was && anon > was.anon) {
          e.recognised = Math.random() < (1 - anon) / Math.max(0.05, 1 - was.anon);
          if (!e.recognised) {
            delete e.byRep;
            delete e.history;
            e.grudge = 0;
          }
        }
        // (Uncovered now, a stranger who's heard about you may know your face after all.)
        else if (!e.byRep && !e.recognised && was && anon < was.anon && Math.random() < Math.min(0.5, this.infamy.rep / 200) * (1 - anon) - Math.min(0.5, this.infamy.rep / 200) * (1 - was.anon)) {
          e.recognised = true;
          e.byRep = true;
          e.grudge = 0;
          e.history = "You’ve never met. But they know your face: people talk.";
        }
        e.lookAt = { anon, clothes };
        // (A regular who doesn't know you like this isn't buying from a regular.)
        if (!e.recognised) e.regular = false;
      }
    }
    if (e.stage === 'seen') e.them.fear = this.fearOf(e);
    this.prime(e);
    // (What you could do before this move: if it ends here, they stay on the screen, greyed out.)
    const optsBefore = e.stage === 'over' ? [] : encounterOptions(e).filter((o) => !o.disabled && !['lurk', 'rest', 'pockets', 'go', 'open'].includes(o.id));
    const wasOver = e.stage === 'over';
    const wasOut = !!e.them.out;
    const tortured = e.tortured ?? 0;
    const mugged = !!e.mugged;
    const levelsBefore = this.levelSum();
    const shotsBefore = e.shots ?? 0;
    const downBefore = !!e.you?.down;
    const logFrom = e.log.length;
    if (id === 'connect') {
      if (e.asked?.includes('connect')) return;
      this.askConnect(e);
      this.refresh();
      return;
    }
    if (id === 'beg') {
      if (e.asked?.includes('beg')) return;
      this.beg(e);
      this.refresh();
      return;
    }
    const stageBefore = e.stage;
    const impacts = act(e, id, this.stats, this.inventory, (this.save.state.moves ??= {}) as Record<string, number>);
    this.witness(e);
    // Walking up to someone with others about: you know they'd see.
    if (id === 'open' && this.crowd.length && e.stage !== 'over') e.log.push({ by: 'info', text: this.crowd.length === 1 ? 'Someone else is on the street. They’d see anything you do.' : `${this.crowd.length === 2 ? 'Two others are' : 'Others are'} on the street. They’d see anything you do.` });
    // Fighting wears you down: every move (more for a chase, a lot more for being beaten senseless).
    if (!wasOver && stageBefore !== 'seen' && stageBefore !== 'menu' && stageBefore !== 'surveil' && !id.startsWith('search') && !id.startsWith('take')) {
      addFatigue(this.health, 0.7 + (e.chase ? 0.5 : 0) + (e.stage === 'over' && e.result === 'lost' ? 6 : 0));
    }
    this.settleDeal(e);
    // Down on the sidewalk: dirt on the glass.
    if (!downBefore && e.you?.down) this.fx.dirt(e.you.out ? 0.9 : 0.6);
    // Gunshots get called in.
    if ((e.shots ?? 0) > shotsBefore) this.reportedHeat(18 * ((e.shots ?? 0) - shotsBefore), e.seenAs?.anon ?? anonymity(this.inventory), { sev: 9 });
    if (this.levelSum() > levelsBefore) sound.levelUp();
    // Knocked out of your mouth (or you're out cold): the cigarette's gone.
    if (!wasOver && this.smoking && e.you && (e.you.smoking === false || e.you.out || e.result === 'lost')) {
      delete this.health.smokingUntil;
      e.you.smoking = false;
    }
    const worse: string[] = [];
    let after: string[] = [];
    // Torturing someone; robbing someone who'd given up.
    if ((e.tortured ?? 0) > tortured) {
      const l = this.loseHumanity(TORTURE_COST * ((e.tortured ?? 0) - tortured));
      if (l) worse.push(l);
    }
    // (Caught trying to lift something, with nothing taken: not a mugging on your conscience.)
    if (e.mugged && !mugged && e.robbed) {
      const l = this.loseHumanity(MUG_COST);
      if (l) worse.push(l);
    }
    // A tip-off about your old things.
    // (One who still has something of yours.)
    const holding = this.world.thieves.filter((t) => t.person.clothes.some((g) => g.loot.some((l) => l.yours)));
    if (e.tip === 'thief' && holding.length) {
      this.world.lead = holding[Math.floor(Math.random() * holding.length)].id;
      delete e.tip;
    }
    // Stamping on someone who can't defend themselves.
    if (wasOut && impacts.some((x) => x.target === 'them') && (id.startsWith('stomp') || id.startsWith('ground:') || id.startsWith('whip:') || id.startsWith('wpn:'))) {
      e.stomped = true;
      const l = this.loseHumanity(STOMP_HELPLESS_COST);
      if (l) worse.push(l);
    }
    if (!wasOver && e.stage === 'over') {
      if (e.result === 'killed' || (e.result !== 'lost' && e.them.dead)) {
        // Killing someone (or leaving them to bleed out): the worst of it, unless you're long past caring.
        addStress(e.you, 30);
        // Was anyone watching? A face in a window, a car going past.
        const anon = anonymity(this.inventory);
        if (e.witnessed || Math.random() < 0.3) {
          const f = this.infamy;
          f.rep += 15 * (1 - anon * 0.7);
          this.reportedHeat(35 * (1 - anon * 0.6) / Math.max(0.3, 1 - anon * 0.7), anon, { sev: 20, charges: ['Homicide'], floor: 75, identified: anon <= 0.6 });
          if (anon <= 0.6) f.killsSeen = (f.killsSeen ?? 0) + 1;
          worse.push(
            e.result !== 'killed'
              ? anon > 0.6
                ? 'Someone saw you with them before they died. Your face was covered.'
                : 'Someone saw you with them before they died. They saw your face.'
              : anon > 0.6
                ? 'Someone saw that. A face in a window, then gone. At least your face was covered.'
                : 'Someone saw that. A face in a window, then gone. They saw yours.',
          );
        }
        // (Left alive, gone later: say so.)
        if (e.result !== 'killed' && !worse.some((w) => /died|didn’t make it/.test(w))) worse.push('Later, you hear they didn’t make it.');
        this.humanity.kills++;
        const l = this.loseHumanity(KILL_COST);
        if (l) worse.push(l);
      }
      // Crippled for life: you did that.
      if (e.them.broken.includes('spine') && !(e.start?.broken ?? []).includes('spine') && !e.them.dead) {
        worse.push('They’ll never walk again. You did that.');
        const l = this.loseHumanity(Math.round(KILL_COST * 0.7));
        if (l) worse.push(l);
      }
      // It's done. The fight's log stays (a body stays to be searched, and the
      // last blows should still be there); what happens to you afterwards is
      // added, and is what the closing note says.
      // Walked away before anything happened: nothing carries over (no nerve, the coke still in you).
      const nothing = !e.fought && !e.chased && (e.result === 'left' || e.result === 'lost-them' || e.result === 'sold');
      after = nothing ? [] : afterFight(this.health, e.you, e.result!);
      if (e.resident) after = after.map(indoors);
      // How it sits with you: what you did to them, and who they were.
      if (e.result !== 'lost' && e.result !== 'killed') {
        const start = e.start?.blood ?? e.them.maxBlood;
        const beat = e.them.out || e.them.blood < start - e.them.maxBlood * 0.25 || e.them.broken.length > (e.start?.broken.length ?? 0);
        const what = (e.tortured ?? 0) > 0 ? 'torture' : (e.mugged && e.robbed) || (e.robbed && e.result === 'mugged') ? 'mug' : beat ? 'beat' : null;
        if (what) {
          const g = guilt(e, what, this.humanity.lost);
          after.push(...(e.resident ? g.lines.map(indoors) : g.lines));
          const h = this.health;
          h.stress = Math.max(0, Math.min(100, (h.stress ?? 0) + g.stress));
        }
      }
    }
    after.push(...worse);
    /** (Where the fight's own lines end, before what happens to you after.) */
    const fightTo = e.log.length;
    for (const text of after) e.log.push({ by: 'info', text });
    // What finished you: the last thing they did.
    const lastHit = ([...e.log].reverse().find((l) => l.by === 'them' && l.hit === 'you') ?? [...e.log].reverse().find((l) => l.by === 'them'))?.text;
    const hitText = lastHit?.replace(/(\s*(You['’]re out cold|You['’]re concussed|You['’]re bleeding[^.]*|You['’]re winded|Something cracks[^.]*)\.)+\s*$/, '');
    const remember = hitText && !e.you.drugOut && e.result === 'lost' ? [`The last thing you remember: ${hitText[0].toLowerCase()}${hitText.slice(1)}`] : [];
    if (this.health.dead) {
      if (impacts.length) this.feel(impacts);
      return this.die(after.length ? [...remember, ...after] : e.log.map((l) => l.text), after.some((l) => /Then it stops, and nobody comes/.test(l)) ? 'You overdosed.' : undefined);
    }
    if (impacts.length) this.feel(impacts);
    else buzz(6);
    // It's over and they're gone (or you are): the screen closes, and how it
    // ended is a note. A body stays, to be searched, until you walk away.
    // Knocked out: the screen goes off, and you have to come to.
    // (A beat first, so the blow that ended it lands, and you can read it.)
    if (!wasOver && e.stage === 'over' && e.result !== 'killed') {
      const ko = e.result === 'lost';
      // They got away (or walked off): say how, and why, not just that they're gone.
      const how = e.result === 'lost-them' || e.result === 'they-fled' ? [...e.log.slice(logFrom, fightTo).filter((l) => l.by !== 'you' && !/ went up to \d+\.$/.test(l.text)).map((l) => l.text).slice(-2), ...(e.chaseEnd ? [e.chaseEnd] : []), ...(e.whyRan ? [e.whyRan] : [])].filter((x, i, a) => a.indexOf(x) === i) : [];
      const lines = ko && e.chaseOut ? ['You collapsed.', ...after] : ko ? [RESULT.lost, ...remember, ...after] : [e.deal?.kind === 'sting' ? 'It was a setup.' : e.resident && e.result === 'walked' ? 'You leave them where they lie.' : RESULT[e.result ?? 'left'], ...how, ...after];
      // Not knocked out (and not a setup): it stays on the screen. How it ended is the last of
      // the log, everything you could do greys out, and the one way on is to leave.
      const quietLeave = e.result === 'left' && !e.fought && !e.chased && !e.robbed && !e.mugged && !e.deal;
      if (!ko && e.deal?.kind !== 'sting' && !quietLeave) {
        // (Not again what the log already says, just above; nor the heading, which says how it ended.)
        const said = new Set(e.log.slice(0, fightTo).map((l) => l.text));
        e.log.splice(fightTo, 0, ...[lines[0], ...how].filter((t, i) => i === 0 ? t !== RESULT[e.result ?? 'left'] && !e.log.slice(Math.max(0, logFrom), fightTo).some((l) => l.text === t) : !said.has(t)).map((text) => ({ by: 'info' as const, text, end: true })));
        e.finished = true;
        e.endOpts = optsBefore;
        // (Whatever note was up before the fight stays gone: it's all in the log now.)
        this.noteEl.hidden = true;
        this.save.state.endLines = lines;
        this.closeSheet();
        this.tapsFrom = performance.now() + 400;
        this.refresh();
        return;
      }
      // (Saved now: a reload in the beat still ends it properly.)
      if (ko) this.save.state.koLines = lines;
      else this.save.state.endLines = lines;
      this.ending = true;
      this.closeSheet();
      this.refresh();
      this.timers.push(
        window.setTimeout(() => {
          this.ending = false;
          if (this.closed || this.encounter !== e) return;
          delete this.save.state.endLines;
          if (ko) this.knockedOut(lines);
          else this.closeEncounter(lines, quietLeave);
        }, impacts.length ? 1100 : e.result === 'left' || e.result === 'walked' ? 700 : 1800),
      );
      return;
    }
    // A body on the ground: a moment before Lurk and Rest take a tap.
    if (!wasOver && e.stage === 'over') {
      this.tapsFrom = performance.now() + 800;
    }
    this.refresh();
  }

  private noteFade = 0;
  /** A fight just ended: a beat to see it land before the screen changes. */
  private ending = false;
  /** Taps on Lurk and Rest count from here (not straight through from a fight). */
  private tapsFrom = 0;
  /** Knocked out, the screen off: what to say when you come to. */
  private koLines: string[] | null = null;
  /** Out cold: listening for a shake to bring the power button back. */
  private koListen: AbortController | null = null;

  /**
   * Knocked out: the screen switches off like an old set (picture, line,
   * dot), the cracks stay on the glass, and nothing comes back until you
   * shake the phone; then the power button, and you come to.
   */
  private knockedOut(lines: string[]) {
    this.closeSheet();
    this.heldNote = [];
    // While you lay there, they may have gone through your pockets.
    const beaten = this.encounter;
    if (beaten?.enforcer) {
      const dz = this.debt;
      const inv = this.inventory;
      const c = Math.round(cashOf(inv) * 100);
      const owed = dz?.owed ?? 0;
      if (dz && c) {
        dz.owed = Math.max(0, dz.owed - c);
        inv.purse = {};
      }
      // Short, and they take what's worth taking too (that's for the trouble).
      const took = dz && dz.owed ? inv.items.filter((x) => x.kind === 'phone' || x.kind === 'weapon' || (x.secret && x.secret !== 'empty')) : [];
      inv.items = inv.items.filter((x) => !took.includes(x));
      const gone = [...(c ? [money(c)] : []), ...took.map((x) => aOf(lc(x.name)).replace(/^(an? [^,]+), ([^,]+)$/, '$1 ($2)'))];
      lines = [
        ...lines,
        gone.length ? `They’ve been through your pockets. Gone to Dez: ${listOf(gone)}.` : 'They’ve been through your pockets and found nothing.',
        dz && dz.owed ? `You still owe ${money(dz.owed)}.` : c > owed ? "That’s the debt paid. Dez’s man kept the rest, for the trouble." : "That’s the debt paid.",
      ];
      if (dz && !dz.owed) delete this.save.state.debt;
    } else if (beaten?.resident && this.place === 'home') {
      lines = [...lines.map(indoors).filter((l) => !/^(You come to|Someone finds you)\b/.test(l)), 'You come to face down on their floor, a knee in your back and your wrists cuffed behind you. Blue light through the blinds.'];
      this.save.state.policeWhy = ['They held you down until the police came. You couldn’t have gotten up if you’d tried.'];
      this.save.state.policeStop = 'burglary';
      this.save.state.policeCuffed = true;
      const j = this.job;
      if (j) j.occupied = true;
      // (What you did to them, and took off them, before they got the better of you.)
      this.afterResidentFight(beaten);
    } else if (beaten && !beaten.chaseOut && !beaten.them.out) {
      const robbed = robKnockedOut(this.world, this.inventory, beaten, isBrute(beaten.person.personality));
      if (robbed) lines = [...lines, robbed];
    }
    this.encounter = null;
    this.koLines = lines;
    // (Saved too: a reload while you're out doesn't skip coming to.)
    this.save.state.koLines = lines;
    this.tvState.on = false;
    this.tv.switchOff();
    sound.thunk();
    this.view.classList.add('ko-out');
    this.powerBtn.hidden = true;
    this.powerBtn.classList.remove('pressed');
    this.koHint.hidden = true;
    // (Whatever note was up before it went dark goes with it.)
    this.noteEl.hidden = true;
    this.refresh();
    buzz([200, 80, 400]);
    this.waitToComeRound();
  }

  /** Out cold, the screen off: the hint, then a shake (or a tap) brings the power button back. */
  private waitToComeRound() {
    this.koListen?.abort();
    const ko = (this.koListen = new AbortController());
    const comeRound = () => {
      if (ko.signal.aborted) return;
      ko.abort();
      this.koListen = null;
      this.koHint.hidden = true;
      this.powerBtn.hidden = false;
      buzz(20);
    };
    // A shake: two hard jolts within a moment.
    let last: { x: number; y: number; z: number } | null = null;
    let jolts: number[] = [];
    let heard = false;
    addEventListener(
      'devicemotion',
      (ev) => {
        const a = ev.accelerationIncludingGravity;
        if (!a || a.x == null || a.y == null || a.z == null) return;
        heard = true;
        const p = { x: a.x, y: a.y, z: a.z };
        if (last) {
          const d = Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z);
          // A jolt: a big change, or a lot more (or less) than gravity alone.
          const off = Math.abs(Math.hypot(p.x, p.y, p.z) - 9.81);
          const t = performance.now();
          if (d > 9 || off > 7) {
            jolts = jolts.filter((j) => t - j < 900);
            jolts.push(t);
            if (jolts.length >= 2 && !this.koHint.hidden) comeRound();
          }
        }
        last = p;
      },
      { signal: ko.signal },
    );
    // After the dot has faded: the hint. With no motion sensor (a computer),
    // a tap does it instead.
    this.timers.push(
      window.setTimeout(() => {
        if (ko.signal.aborted) return;
        // No motion heard yet (a computer, or a phone keeping it to itself): a tap.
        this.koHint.textContent = heard ? 'Shake your phone to wake up' : 'Tap to wake up';
        this.koHint.hidden = false;
        if (!heard) this.koHint.onclick = comeRound;
        // Anywhere on the screen, not just the words.
        this.view.addEventListener('click', () => !heard && comeRound(), { signal: ko.signal });
      }, 2600),
    );
    // A phone that won't share its motion (permission refused): a tap, after a while.
    this.timers.push(
      window.setTimeout(() => {
        if (ko.signal.aborted) return;
        // (Shaking not working, or the phone's lying flat: a tap does it too.)
        this.koHint.textContent = heard ? 'Shake your phone (or tap) to wake up' : 'Tap to wake up';
        this.koHint.onclick = comeRound;
        this.view.addEventListener('click', comeRound, { signal: ko.signal });
      }, 9000),
    );
  }

  /** Done with whoever it was: back to the street, with what happened as a note. */
  private closeEncounter(lines: string[], quiet = false) {
    const was = this.encounter;
    this.encounter = null;
    if (was?.resident) this.afterResidentFight(was);
    this.tapsFrom = performance.now() + 800;
    this.refresh();
    uiGlitch(this.view, 0.35);
    // A sale that was a setup: what happened goes at the top of the stop (not a note waiting for you after jail).
    if (this.save.state.policeStop === 'sting') {
      this.save.state.policeWhy = [...lines, 'The buyer has a badge out now. So do the two coming up behind you.'];
      this.openSheet('police');
      return;
    }
    if (quiet || !lines.length) return;
    this.note(lines, true);
    this.noteEl.firstElementChild?.classList.add('note-title');
  }

  /**
   * Blows landing, felt on the screen and in the hand: glitches, static,
   * shaking, colour fringing, blood on the glass and the panels, a red edge
   * when you're the one hit, and vibration. One after another, a beat apart.
   */
  private feel(impacts: Impact[]) {
    impacts.forEach((im, i) => {
      const t = window.setTimeout(() => {
        // (Done: off the list. And nothing after you've quit.)
        const at = this.timers.indexOf(t);
        if (at >= 0) this.timers.splice(at, 1);
        if (this.closed) return;
        const you = im.target === 'you';
        const power = Math.min(1, im.ml / 600) * (im.severe ? 1.3 : 1);
        // Blood only when the blow would throw it (see Spill).
        this.fx.impact(you, im.ml, im.severe, im.spill);
        sound.hit(Math.max(0.15, power), im.severe);
        if (im.ml > 0) this.hitUi.kick(power, you);
        // The picture breaks up a little with every blow (more when it's you).
        if (im.ml > 0) dispatchEvent(new CustomEvent('ui-glitch', { detail: (you ? 0.3 : 0.15) + power * 0.5 }));
        const wet = im.spill === 'splash' || im.spill === 'spray' || (im.spill === 'spatter' && you);
        if (wet && you && (power > 0.35 || Math.random() < 0.4)) this.hitUi.splash(im.severe ? 2 : 1, im.severe);
        if (wet && !you && im.severe && Math.random() < 0.6) this.hitUi.splash(1, false);
        this.jam = Math.max(this.jam, (you ? 0.45 : 0.25) + power * 0.4);
        if (you) buzz(im.severe ? [70, 40, 110] : [35 + Math.round(power * 30), 25, 45]);
        else buzz(im.severe ? [25, 35, 45] : [14 + Math.round(power * 16)]);
      }, i * 280);
      this.timers.push(t);
      if (this.timers.length > 40) this.timers.splice(0, this.timers.length - 40);
    });
  }

  /**
   * Clean the blood off the panels (they're put away). The blood on the
   * screen itself stays until you wipe it off with your finger.
   */
  private wipeBlood() {
    this.hitUi.clear();
  }

  // ---------- Places, pockets, the pharmacy ----------

  /** Free to do something else: no one in front of you but maybe a passer-by. */
  private get idle() {
    const e = this.encounter;
    return this.running && this.tv.showingPicture && this.phase === 'idle' && (!e || e.stage === 'seen');
  }

  /** Pockets and Go can be opened when idle, and once a fight is over (from its options). */
  private get canOpenSheet() {
    const e = this.encounter;
    return !this.ending && (this.idle || (this.running && !!e && e.stage === 'over'));
  }

  /**
   * You bled out. That character is gone for good: whoever finds the body
   * takes everything on it (see legacy.ts), and you go on as someone new,
   * with nothing. The world remembers.
   */
  private die(lines: string[], title = 'You bled out.', jailed = false) {
    if (this.dead) return;
    this.dead = true;
    this.running = false;
    this.closeSheet();
    document.getElementById('jail')?.remove();
    document.getElementById('rest')?.remove();
    document.getElementById('work')?.remove();
    delete this.save.state.work;
    if (!jailed) this.fx.impact(true, 900, true);
    buzz([120, 80, 200, 120, 400]);
    const h = this.humanity;
    const lvl = humanityLevel(h.lost);
    const w = this.world;
    const cash = cashOf(this.inventory);
    const lurked = this.lurkState.times - w.lifeStart;
    // The encounter you died in (its person may be the one who robs you).
    const e = this.encounter;
    if (e && e.stage !== 'seen') this.rememberThem(e);
    if (e) settle(w, e);
    // (Dying in the ER, nobody goes through your pockets.)
    const inEr = this.place === 'hospital';
    // (In someone's house counts: nobody goes through your pockets on their hallway floor.)
    const indoors = this.inside || (this.place === 'home' && !!this.job?.in);
    const robbed = indoors || jailed ? false : robBody(w, this.inventory, e);
    // (Whoever has your things now: their thief record and what you remember of them are one person.)
    const tid = e?.person.thief;
    const th = tid ? w.thieves.find((t) => t.id === tid) : undefined;
    if (e && th && e.person.known) {
      th.person.known = e.person.known;
      const k = this.people.find((x) => x.id === e.person.known);
      if (k) k.person = JSON.parse(JSON.stringify(th.person));
    }
    // (The old life's note doesn't wait for the new one.)
    this.unstick();
    this.noteEl.hidden = true;
    // A new you: nothing carried over but the world.
    // (Your name, your ID and your bank account were that character's.)
    for (const k of CHAR_KEYS) delete this.save.state[k];
    // Nobody knows this face. The people the old you hurt are still out there
    // (and your things on some of them), but they'd be looking for someone else.
    this.world.infamy = newInfamy();
    for (const k of this.people) {
      k.memory.sawFace = false;
      k.memory.clothes = [];
      k.memory.otherLife = true;
    }
    w.lives = this.nextLifeNo();
    w.lifeStart = this.lurkState.times;
    const p = (t: string) => `<p>${t}</p>`;
    const html =
      `<h2>${title}</h2>` +
      `<div class="death-lines">${lines.slice(-3).map(p).join('')}</div>` +
      `<dl class="death-sum">` +
      `<div><dt>Lurked</dt><dd>${lurked}</dd></div>` +
      `<div><dt>Killed</dt><dd>${h.kills}</dd></div>` +
      `<div><dt>Humanity</dt><dd>${lvl?.name ?? (h.lost ? 'Shaken' : 'Intact')}</dd></div>` +
      `<div><dt>Cash</dt><dd>${money(Math.round(cash * 100))}</dd></div>` +
      `</dl>` +
      `<p class="death-after">${
        jailed
          ? 'What you came in with is in a plastic bag with your name on it, on a shelf. As someone new, you can visit who you were at the County Courthouse.'
          : robbed
          ? 'Someone went through your pockets before you were cold. Whatever you had is out there now, on somebody.'
          : indoors && !inEr
            ? 'Somebody called it in. What you had on you went into a plastic bag with your name on it, and nobody comes for it.'
            : inEr
            ? 'You died in the hospital. What you had on you goes into a plastic bag with your name on it, and nobody comes for it.'
            : 'There was nothing on you worth taking.'
      }</p>` +
      `<button type="button" class="death-btn">Go on as someone new</button>`;
    // (Saved with it: closing the app on this screen still shows it next time.)
    this.save.state.deathScreen = html;
    this.onDeath?.();
    this.showDeath(html);
  }
  private showDeath(html: string) {
    document.getElementById('death')?.remove();
    const el = document.createElement('div');
    el.id = 'death';
    el.innerHTML = html;
    // (Not before it's faded in: a tap meant for the fight mustn't skip this.)
    const shownAt = performance.now();
    el.querySelector('button')?.addEventListener('click', () => performance.now() - shownAt > 2500 && this.rebirth());
    // Above everything, the blood on the glass included, so it can be read.
    document.body.append(el);
  }

  /** Off the death screen: a new character, same streets. */
  private rebirth() {
    // (Nothing the old life had waiting carries over.)
    this.offLines = [];
    this.heldNote = [];
    this.sheetNote = [];
    this.pendingLurk = [];
    document.getElementById('death')?.remove();
    delete this.save.state.deathScreen;
    this.dead = false;
    this.running = !this.paused;
    this.phase = 'idle';
    this.hitUi.clear();
    this.refresh();
    this.note(['Someone else now. Same streets. Empty pockets.']);
  }

  /**
   * Where to go slides in from the left edge, your pockets from the right:
   * put your finger on the edge (or its tab) and pull it in. Push a drawer
   * back towards its edge to put it away.
   */
  private edgeSwipes() {
    const EDGE = 44;
    type Drag = { id: number; x: number; y: number; side: 'left' | 'right' | 'bottom'; closing: boolean; grip?: boolean; atTop?: boolean };
    let drag: Drag | null = null;
    const down = (id: number, x: number, y: number, target: EventTarget | null) => {
      drag = null;
      // (Lying down or locked up, only the You page can be open: it still swipes shut. Nothing opens from the edges.)
      if (!this.running && !this.sheet) return;
      if (this.sheet === 'police') return;
      if (this.sheet) {
        // (Dragging a zoomed-in map around isn't pushing the drawer shut.)
        if (this.sheet === 'places' && this.mapView.z > 1.01 && (target as Element | null)?.closest?.('.map')) return;
        // On the open drawer: a push back towards its edge closes it.
        const side = this.sheetEl.classList.contains('from-right') ? 'right' : this.sheetEl.classList.contains('from-bottom') ? 'bottom' : 'left';
        // Only from its top bar (the grab handle), or a big pull once its list is
        // scrolled all the way up: scrolling the list shouldn't close it.
        const card = this.sheetEl.firstElementChild as HTMLElement;
        const top = card.getBoundingClientRect().top;
        const grip = !!(target as Element | null)?.closest?.('.sheet-head') || y < top + 56;
        const rect = card.getBoundingClientRect();
        const atTop = (card.querySelector('.sheet-body')?.scrollTop ?? 0) <= 2 && y < rect.top + rect.height / 3;
        drag = { id, x, y, side, closing: true, grip, atTop };
        return;
      }
      const tab = (target as Element | null)?.closest?.('.edge-tab');
      // Up from the bottom: you (any time, like the stats used to be).
      if (tab === this.youBtn || (!tab && y > innerHeight - EDGE && Math.abs(x - innerWidth / 2) < innerWidth * 0.3 && !this.youBtn.hidden)) {
        drag = { id, x, y, side: 'bottom', closing: false };
        return;
      }
      if (!this.canOpenSheet) return;
      if (tab === this.goBtn || (!tab && x < EDGE)) drag = { id, x, y, side: 'left', closing: false };
      else if (tab === this.bagBtn || (!tab && x > innerWidth - EDGE)) drag = { id, x, y, side: 'right', closing: false };
    };
    const move = (id: number, x: number, y: number) => {
      if (!drag || drag.id !== id) return;
      if (drag.side === 'bottom') {
        const up = drag.y - y;
        const dx = Math.abs(x - drag.x);
        if (!drag.closing && up > 34 && up > dx * 1.2) {
          drag = null;
          this.openSheet('stats');
        } else if (drag.closing && ((drag.grip && -up > 50) || (drag.atTop && -up > 200)) && -up > dx * 1.5) {
          drag = null;
          this.closeSheet();
        }
        return;
      }
      const inward = (x - drag.x) * (drag.side === 'left' ? 1 : -1);
      const dy = Math.abs(y - drag.y);
      if (!drag.closing && inward > 34 && inward > dy * 1.2) {
        const side = drag.side;
        drag = null;
        this.openSheet(side === 'left' ? 'places' : 'pockets');
      } else if (drag.closing && -inward > 90 && -inward > dy * 1.5) {
        drag = null;
        this.closeSheet();
      }
    };
    const up = (id: number) => {
      if (drag?.id === id) drag = null;
    };
    const opt = { capture: true, passive: true, signal: this.listeners.signal } as const;
    // (A second finger: a pinch, not a swipe.)
    addEventListener('touchstart', (e) => e.touches.length > 1 && (drag = null), opt);
    addEventListener('touchstart', (e) => e.touches.length === 1 && down(e.changedTouches[0].identifier, e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.target), opt);
    addEventListener('touchmove', (e) => { for (const t of e.changedTouches) move(t.identifier, t.clientX, t.clientY); }, opt);
    addEventListener('touchend', (e) => { for (const t of e.changedTouches) up(t.identifier); }, opt);
    addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) up(t.identifier); }, opt);
    addEventListener('pointerdown', (e) => e.pointerType === 'mouse' && down(-1, e.clientX, e.clientY, e.target), opt);
    addEventListener('pointermove', (e) => e.pointerType === 'mouse' && e.buttons & 1 && move(-1, e.clientX, e.clientY), opt);
    addEventListener('pointerup', (e) => e.pointerType === 'mouse' && up(-1), opt);
  }

  private openSheet(kind: 'places' | 'pockets' | 'stats' | 'police' | 'scav') {
    // Stopped by the police: nothing else opens over that.
    if (this.sheet === 'police' && kind !== 'police' && !(kind === 'stats' && this.lockedAway)) return;
    // (Held, or lying down: only the You page, nothing else.)
    if (this.lockedAway && kind !== 'stats' && kind !== 'police') return;
    // Your stats can be looked at any time, even mid-fight; the police don't ask.
    if (kind === 'stats' || kind === 'police' ? !this.tvState.on || this.dead || this.ending : !this.canOpenSheet) return;
    this.sheet = kind;
    if (kind === 'places') {
      this.mapPick = null;
      this.mapView = { z: 1, tx: 0, ty: 0 };
    }
    this.renderSheet();
    // Where to go comes in from the left, pockets from the right.
    this.sheetEl.classList.toggle('from-left', kind === 'places' || kind === 'scav');
    this.sheetEl.classList.toggle('from-right', kind === 'pockets');
    this.sheetEl.classList.toggle('from-bottom', kind === 'stats');
    this.sheetEl.hidden = false;
    // (Over the jail or rest screen: that waits behind, its clock still running.)
    const lock = document.querySelector<HTMLElement>('#jail.lockup, #rest.lockup');
    if (kind === 'stats' && lock) {
      lock.classList.add('behind');
      this.view.classList.add('lockup-you');
    }
    sound.whoosh();
    uiGlitch(this.sheetEl.firstElementChild, 0.4);
    buzz(6);
  }

  /** Held, or lying down: a screen of its own you can't leave (but you can look at yourself). */
  private get lockedAway(): boolean {
    return !this.dead && (!!this.jailed || this.health.restingSince != null);
  }
  /** What happened while Places or the police were open, shown when they close. */
  private heldNote: string[] = [];
  /** Walking somewhere from the map: the map stays open (you close it when you're ready). */
  private stayOnMap = false;
  /** What you found where you last walked to from the map (gone from what's waiting once you walk on). */
  private arrived: string[] = [];
  private dropArrived() {
    if (this.arrived.length) this.heldNote = this.heldNote.filter((l) => !this.arrived.includes(l));
    this.arrived = [];
  }
  /** Close the sheet, unless you walked there from the map: then it stays, showing where you are now. */
  private leaveSheet() {
    if (this.stayOnMap && this.sheet === 'places') return;
    this.closeSheet();
  }
  private closeSheet() {
    this.sheetNote = [];
    if (this.sheet) uiGlitch(null, 0.25);
    this.sheet = null;
    this.sheetEl.hidden = true;
    for (const el of document.querySelectorAll('.lockup.behind')) el.classList.remove('behind');
    this.view.classList.remove('lockup-you');
    const held = this.heldNote;
    this.heldNote = [];
    this.arrived = [];
    if (held.length && !this.closed && this.tvState.on) requestAnimationFrame(() => !this.closed && this.note(held));
  }

  private sheetClick(ev: MouseEvent) {
    const t = ev.target as HTMLElement;
    if (this.sheet === 'police') {
      // No walking away from this one: you answer.
      const b = t.closest('button');
      if (b?.dataset.police === 'bail' && !b.hasAttribute('disabled')) this.payBail();
      else if (b?.dataset.police === 'dez') this.dezBail();
      else if (b?.dataset.police === 'bribe' && b.hasAttribute('disabled')) return;
      else if (b?.dataset.police === 'custody') this.heldForCourt();
      else if (b?.dataset.police === 'done') {
        delete this.save.state.policeResult;
        delete this.save.state.policeArrested;
        this.closeSheet();
        this.refresh();
      } else if (b?.dataset.police && !this.save.state.policeResult) this.police(b.dataset.police as 'run' | 'stay' | 'talk' | 'bribe');
      return;
    }
    if (t === this.sheetEl) return this.closeSheet(); // tapped outside the card
    // (A drag or a pinch on the map isn't a tap on what was under it.)
    if (performance.now() - this.mapDragEnd < 400 && t.closest('.map') && !t.closest('.map-zoomctl')) return;
    // (A finger on a landmark's name, handed to a pin beside it: the landmark it was on.)
    if (this.sheet === 'places' && this.mapDownOn?.isConnected && t.closest('.map-pin')) {
      const m = t.closest<HTMLElement>('.map');
      if (m) return this.mapTap(ev, m, this.mapDownOn);
    }
    const b = t.closest('button');
    if (!b) {
      // On the map, between the pins: whatever building is there.
      const m = t.closest<HTMLElement>('.map');
      if (m && this.sheet === 'places') this.mapTap(ev, m);
      return;
    }
    // (Pockets: a tap that does something shows it.)
    if (this.sheet === 'pockets' && !b.disabled && b.dataset.close === undefined) {
      this.withFeedback(b, () => this.sheetAction(b));
      return;
    }
    this.sheetAction(b);
  }

  /** A sheet button: what it does. */
  private sheetAction(b: HTMLButtonElement) {
    if (b.dataset.close !== undefined) this.closeSheet();
    else if (b.dataset.forget) this.forgetHome(b.dataset.forget);
    else if (b.dataset.mapzoom === 'fit') this.mapShow({ z: 1, tx: 0, ty: 0 }, true);
    else if (b.dataset.mapzoom) this.mapZoomBy(b.dataset.mapzoom === 'in' ? 1.8 : 1 / 1.8);
    else if (b.dataset.mappick) {
      this.mapPick = b.dataset.mappick;
      const fromList = !!b.closest('.map-list');
      this.renderSheet();
      // (A pin: the map stays put. Picked from the list while zoomed in, it slides into view if it's off the edge.)
      const pin = this.sheetEl.querySelector<HTMLElement>('.map-pin.picked');
      if (pin && fromList) this.mapReveal((parseFloat(pin.style.left) / 100) * MAP_W, (parseFloat(pin.style.top) / 100) * MAP_H);
      // (Bring its card into view: from the list under the map, or a pin with the card below the fold.)
      this.sheetEl.querySelector(fromList ? '.map-card' : '.map-card button')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (b.dataset.place || b.dataset.home || b.dataset.spot || b.dataset.corner) {
      // (Walking there from the map: the map stays open, showing you where you are now.)
      this.stayOnMap = this.sheet === 'places';
      try {
        if (b.dataset.place) this.goTo(b.dataset.place as Place);
        else if (b.dataset.home) this.goHome(b.dataset.home);
        else if (b.dataset.spot) this.goSpot(b.dataset.spot);
        else if (b.dataset.corner) this.workCorner(b.dataset.corner!);
      } finally {
        this.stayOnMap = false;
      }
    }
    else if (b.dataset.watch) ((x) => x && this.startWatch(x))(buildingById(b.dataset.watch));
    else if (b.dataset.use) this.useMed(Number(b.dataset.use));
    else if (b.dataset.drop) this.drop(Number(b.dataset.drop));
    else if (b.dataset.fire) this.fire(Number(b.dataset.fire));
    else if (b.dataset.smoke) this.smoke(Number(b.dataset.smoke));
    else if (b.dataset.burn) this.burn(Number(b.dataset.burn));
    else if (b.dataset.takeoff) this.takeOff(b.dataset.takeoff as 'head' | 'face' | 'eyes' | 'hands' | 'top' | 'bag');
    else if (b.dataset.flip !== undefined) this.flipJacket();
    else if (b.dataset.puton) this.putOn(Number(b.dataset.puton));
    else if (b.dataset.mask !== undefined) this.toggleCover('mask');
    else if (b.dataset.hood !== undefined) this.toggleCover('hood');
    else if (b.dataset.taste) this.identify(Number(b.dataset.taste), false);
    else if (b.dataset.test) this.identify(Number(b.dataset.test), true);
    else if (b.dataset.bump) this.bump(Number(b.dataset.bump));
    else if (b.dataset.bagup) this.bagUp(Number(b.dataset.bagup));
    else if (b.dataset.gig) this.gigAct(b.dataset.gig, Number(b.dataset.gigi));
    else if (b.dataset.bins !== undefined) this.openBins();
    else if (b.dataset.dig) this.digBins();
    else if (b.dataset.ftake) this.takeFound(Number(b.dataset.ftake));
    else if (b.dataset.fleave) this.leaveFound(Number(b.dataset.fleave));
    else if (b.dataset.wheel) {
      // (A tap on one: it turns to the middle.)
      const i = Number(b.dataset.wheel);
      this.scavPicked(i);
      // (While it turns there, the rows it passes on the way don't count.)
      this.wheelTo = { i, until: performance.now() + 800 };
      const w = this.sheetEl.querySelector<HTMLElement>('.scav-wheel');
      w?.scrollTo({ top: i * WHEEL_ROW, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    else if (b.dataset.stash) this.stashItem(Number(b.dataset.stash));
    else if (b.dataset.inject) this.inject(Number(b.dataset.inject));
    else if (b.dataset.pack) this.packLoose(Number(b.dataset.pack));
    else if (b.dataset.move) this.moveItem(Number(b.dataset.move));
    else if (b.dataset.combine) this.combinePack(Number(b.dataset.combine));
    else if (b.dataset.findcar) this.startHunt(Number(b.dataset.findcar));
    else if (b.dataset.gocar) this.goCarKey(Number(b.dataset.gocar));
    else if (b.dataset.car) this.goCar(b.dataset.car);
    else if (b.dataset.holdR) this.hold(Number(b.dataset.holdR), 'right');
    else if (b.dataset.holdL) this.hold(Number(b.dataset.holdL), 'left');
    else if (b.dataset.putaway) this.putAway(Number(b.dataset.putaway));
    else if (b.dataset.load) this.loadGun(Number(b.dataset.load));
    else if (b.dataset.drink) this.drink(Number(b.dataset.drink));
    else if (b.dataset.eat) this.eat(Number(b.dataset.eat));
    else if (b.dataset.water) this.eat(Number(b.dataset.water));
  }

  /** Walk somewhere else. */
  private goTo(p: Place, arrive?: string[]) {
    this.roomView = 'room';
    // (Stopped by the police: you're not walking anywhere.)
    if (this.ending || this.save.state.policeStop) return;
    this.shopNote = [];
    // (What was waiting while Places was open goes first, ahead of where you've got to, not over it.)
    // (From the map, it stays open: what you find there waits, under the map, till you close it.)
    const onMap = this.stayOnMap && this.sheet === 'places';
    if (onMap) this.dropArrived();
    const held = { lines: onMap ? [] : this.heldNote };
    if (!onMap) this.heldNote = [];
    this.leaveSheet();
    if (held.lines.length) requestAnimationFrame(() => held.lines.length && !this.closed && this.note(held.lines));
    if (p === this.place || HIDDEN_PLACES.has(p)) return;
    if (p === 'home' && !this.homeById(this.save.state.homeAt)) return;
    if (p === 'spot' && !spotOf(this.save.state.spotAt)) return;
    // (On foot, across town: it adds up.)
    if (p === 'car' && !this.carById(this.save.state.carAt) && !this.save.state.hunt) return;
    // Thrown out of the pawn shop: he won't let you back in for a while.
    // (Checked before anything else: turned away, you're still where you were.)
    if (((this.save.state.pawnBan as number) ?? 0) > now() + 30 * 60_000) this.save.state.pawnBan = now() + 30 * 60_000;
    if (p === 'pawn' && ((this.save.state.pawnBan as number) ?? 0) > now()) {
      const away = ['He sees you through the glass and shakes his head. The door stays locked.'];
      this.note(away);
      if (onMap && this.sheet === 'places') {
        this.arrived = away;
        this.renderSheet();
      }
      return;
    }
    if (p !== 'street') this.save.state.crowd = [];
    // (On foot: free, unless you're loaded up to your limit or past it. A heavy load builds you up a little too.)
    {
      const inv = this.inventory;
      const load = carriedKg(inv) / (inv.maxKg ?? 15);
      if (load >= TIRING_LOAD) addFatigue(this.health, 0.4 * (1 + (load - TIRING_LOAD) * 5));
      if (load > 0.5) {
        const up = train(this.stats, 'strength', 1 + Math.round(load * 2));
        if (up) this.later([`Strength went up to ${up}. You can carry ${kgLabel(carryLimit(up))} now.`]);
      }
    }
    // Walking away from an address: if you were in, it's done (and a fight in there counts for what it was).
    if (this.place === 'home') this.walkOutOfHome();
    if (this.place === 'car') this.leaveCar();
    this.shopAt = '';
    // A new trip to the ER is a new wait.
    this.erSeen = false;
    this.place = p;
    this.encounter = null;
    this.unstick();
    this.noteEl.hidden = true;
    this.wipeBlood();
    this.jam = 0.8;
    this.refresh();
    uiGlitch(p === 'street' ? this.view : this.shopEl, 0.55);
    const info = placeInfo(p);
    const inside = this.inside;
    const lines = arrive ? [...arrive] : [
      !inside && info.indoors && p !== 'spot' ? `You get to the ${info.name}. The doors are locked.` : {
        street: this.corner.bar ? `You head back into ${this.corner.name}.` : 'You head back out into the street.',
        pharmacy: 'You walk to the all-night pharmacy.',
        gas: 'You walk over to the gas station. The door chimes as you go in.',
        pawn: 'You walk over to the pawn shop.',
        fence: 'You slip down the alley behind the laundromat.',
        bank: 'You walk to the bank.',
        plasma: 'You push into the plasma center. A nurse at the desk slides a clipboard at you without looking up.',
        liquor: 'You walk into the liquor store. A bell jangles over the door.',
        records: 'You push through the doors of the City Records Office and take a ticket.',
        hospital: 'The ER doors hiss open. You give a name at the desk and they tell you to sit.',
        guns: 'A buzzer sounds as you push the door. The man behind the counter looks up, and keeps looking.',
        court: 'A deputy at the door watches you put your keys and phone in a plastic tray for the metal detector.',
        room: 'You climb the stairs to the Hotel Marlow. The man in the cage looks up, then down again.',
        car: ((c, s) => (c ? (now() >= c.towAt ? `You walk ${c.visited ? 'back ' : ''}to where the ${c.color} ${c.make} was parked, ${c.street}.` : `You walk ${c.visited ? 'back ' : ''}to the ${c.color} ${c.make}, parked ${c.street}.`) : s ? `You start down the block with the ${makeOf(this.keysFor(s.car) ?? {})} fob in your hand.` : ''))(this.atCar, this.hunt),
        spot: this.atSpot ? this.spotArrive(this.atSpot) : '',
        home: this.atHome?.type === 'room' ? `You walk to ${this.atHome.addr}. The street door’s propped open with a brick; you go up to their floor.` : `You walk to ${this.atHome?.addr ?? 'the address'}, and take a look at it from across the street.`,
      }[p] ?? '',
    ];
    lines.unshift(...this.offLines);
    lines.unshift(...held.lines);
    held.lines = [];
    this.offLines = [];
    this.exposure = 0;
    this.wasInside = inside;
    this.insideAt = p;
    if (inside && !(p === 'room' && this.roomRented) && !(p === 'spot' && this.atSpot?.kind === 'vacant')) lines.push(...this.goingIn());
    // Whether your hiding places are as you left them.
    if (p === 'fence') lines.push(...this.checkStash());
    if (p === 'room') lines.push(...this.checkRoom());
    if (p === 'spot' && this.atSpot?.kind === 'vacant') lines.push(...this.checkVacant(this.atSpot.id));
    if (p === 'spot' && this.atSpot?.kind === 'warehouse') lines.push(...this.checkLockup());
    if (p === 'car') {
      lines.push(...this.checkCar());
      if (this.atCar) this.atCar.visited = true;
    }
    if (!inside && WET_AMOUNT[this.weather.now] > 0) lines.push(`It’s still ${isSnow(this.weather.now) ? 'snowing' : 'raining'} (${WEATHER_NAME[this.weather.now].toLowerCase()}).`);
    // Wanted, with your face showing, somewhere full of uniforms: a deputy, a cop at the ER desk, knows you.
    if ((p === 'court' || p === 'hospital') && this.case?.warrant && anonymity(this.inventory) < 0.5 && Math.random() < (p === 'court' ? 0.35 : 0.2) * (this.record.arrests > 0 ? 1.3 : 1)) {
      this.place = 'street';
      this.save.state.policeKnow = true;
      this.save.state.policeOffCorner = true;
      this.save.state.policeWhy = [...lines, p === 'court' ? 'A deputy by the metal detector looks at you, then at the sheet taped by his radio. He steps out from behind the desk.' : 'A cop at the ER desk, waiting on a statement, looks up. He knows your face from somewhere. Then he knows where.'];
      this.save.state.policeStop = true;
      this.refresh();
      this.openSheet('police');
      return;
    }
    this.note(lines);
    buzz(10);
    if (onMap && this.sheet === 'places') {
      this.arrived = lines;
      this.renderSheet();
    }
  }

  /** Whether you were inside the place you're at (it can open or close around you). */
  private wasInside = false;
  private insideAt: Place | null = null;
  /** Through the door: the mask down, the knife away, the cigarette out. */
  private goingIn(): string[] {
    const lines: string[] = [];
    const h = this.health;
    const w = wearing(this.inventory);
    // (The bank's cash machines are in the lobby, off the street: a covered face stays covered there.)
    if (w.masked && this.place !== 'bank') {
      w.masked = false;
      lines.push(`You pull the ${w.face!.toLowerCase()} down before you go in.`);
    }
    if (h.cold) lines.push("It’s warm in here. Stay a while and you’ll thaw out.");
    // (Put away where there's room for it.)
    const inHand = this.inventory.items.filter((x) => x.hand && x.kind === 'weapon' && awayTo(this.inventory, x));
    if (inHand.length) {
      for (const x of inHand) {
        x.spot = awayTo(this.inventory, x)!.id;
        delete x.hand;
      }
      lines.push(`You put the ${inHand.map((x) => lc(x.name)).join(' and the ')} away before you go in.`);
    }
    if (this.smoking) {
      delete h.smokingUntil;
      lines.push('You stub the cigarette out on the wall before you go in.');
    }
    return lines;
  }

  /** Buy something at the pharmacy (cash only). */
  private buy(id: MedId) {
    if (id === 'iron') return;
    const m = medById(id);
    const inv = this.inventory;
    if (this.place !== 'pharmacy' || cashOf(inv) < m.price) return;
    const it = stow(inv, { kind: 'med', name: m.name, med: id });
    if (!it) {
      this.note([`You’ve got nowhere to put ${withA(m.name)}. ${noRoomWhy(inv, measure({ kind: 'med', name: m.name, med: id }).size, measure({ kind: 'med', name: m.name, med: id }).kg)}`]);
      return;
    }
    const paid = this.payLine(m.price * 100);
    this.refresh();
    this.note([`You buy ${withA(m.name)}. ${paid}`]);
    buzz(8);
  }

  /** Hands over the money for something (cents), and says how it went. */
  private payLine(price: number): string {
    sound.coin();
    const inv = this.inventory;
    const fitBefore = cashFits(inv);
    const r = pay(inv.purse, price)!;
    const back = count(r.change) ? ` and get ${money(Object.entries(r.change).reduce((s, [d, n]) => s + Number(d) * n, 0))} back (${purseText(r.change)})` : '';
    // (Change you've nowhere to put: they keep it.)
    let kept = '';
    if (fitBefore && !cashFits(inv)) {
      const all = inv.purse;
      inv.purse = {};
      const rest = cents(pocketCash(inv, all));
      if (rest) kept = ` You’ve no room for all the change: you tell them to keep ${money(rest)}.`;
    }
    return `You hand over ${purseText(r.gave)}${back}.${kept} ${money(Math.round(cashOf(inv) * 100))} left.`;
  }

  /** Sell something to the pawn shop or the fence. */
  private sell(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const place = this.place;
    if (!it || (place !== 'pawn' && place !== 'fence') || !isOpen(placeInfo(place).hours!)) return;
    if (it.kind === 'phone') this.phoneLocked(it);
    const o = offer(place, it);
    if (!('cents' in o)) return;
    const lines: string[] = [];
    // The pawn shop pays from the till; the fence peels small bills off a roll.
    // (A car pays in a roll of twenties.)
    const got = place === 'pawn' ? fewest(o.cents) : it.kind === 'car keys' ? ((p) => ((p[2000] = (p[2000] ?? 0) + Math.floor(o.cents / 2000)), p))(fewest(o.cents % 2000)) : cashLike(o.cents, 'small');
    // (Nowhere to put the money once the thing's off you: no sale.)
    const without = { ...inv, items: inv.items.filter((x) => x !== it) };
    const after: Purse = { ...inv.purse };
    addTo(after, got);
    if (!cashFits(without, after)) {
      this.note([`${place === 'pawn' ? 'He counts it out on the counter' : 'He peels it off the roll'}, and you’ve nowhere to put it. Your pockets are full of cash already.`]);
      return;
    }
    if (place === 'pawn') {
      const check = this.showId('pawn');
      if (!check) return;
      lines.push(check);
    }
    inv.items.splice(i, 1);
    addTo(inv.purse, got);
    sound.coin();
    lines.push(`You sell the ${lc(it.name)} for ${money(o.cents)} (${purseText(got)}).`);
    // (The car goes with its keys: someone drives it off to be taken apart.)
    const sold = it.kind === 'car keys' ? this.carById(it.carId) : undefined;
    if (sold) {
      if (sold.items.length || sold.cents) lines.push('Whatever you’d left in the trunk goes with it.');
      this.cars.splice(this.cars.indexOf(sold), 1);
    }
    // Pawn shops log serial numbers, and the police read the log.
    if (place === 'pawn' && it.hot) {
      lines.push(it.kind === 'phone' || /laptop|tablet|console/i.test(it.name) ? 'He copies down the serial number, into a ledger and into his computer. Every pawn shop reports what it buys.' : 'He photographs it front and back for the police log. Every pawn shop reports what it buys.');
      // (If it was reported stolen, the log turns it up, with your ID and the camera over the counter.)
      if (Math.random() < 0.5) this.footage('pawn', ['Possession of stolen property'], 4, 0);
    }
    this.refresh();
    this.note(lines);
    buzz(8);
  }

  /** Buy something at the pawn shop or the gas station (and put it on, if it's clothes). */
  /**
   * Why you wouldn't buy this, because you've already got it: clothes and a
   * bag you're wearing, a cap or mask or shades you've got on, a sheath or
   * holster, a knife or gun of that kind. (Things that get used up, you can
   * always buy more of.)
   */
  private ownsWhy(s: { name: string; slot?: string; knife?: string; gun?: string }): string | null {
    const inv = this.inventory;
    if (s.slot === 'top' || s.slot === 'bottom' || s.slot === 'bag') return inv.clothes.includes(s.name) ? 'Wearing it' : null;
    if (s.slot === 'head' || s.slot === 'face' || s.slot === 'eyes' || s.slot === 'hands') return wearing(inv)[s.slot] === s.name ? 'Wearing it' : null;
    if (s.slot === 'gear') return (inv.gear ?? []).includes(s.name) ? 'You have one' : null;
    const w = s.knife ?? s.gun;
    if (w) return inv.items.some((x) => x.kind === 'weapon' && x.name === w) ? 'You have one' : null;
    return null;
  }

  private buyStock(id: string, how: 'wear' | 'carry' = 'wear') {
    const place = this.place;
    const s = (place === 'gas' ? GAS_STOCK : place === 'liquor' ? LIQUOR_STOCK : place === 'guns' ? GUN_STOCK : PAWN_STOCK).find((x) => x.id === id);
    const inv = this.inventory;
    if (s && this.ownsWhy(s)) return;
    if (!s || (place !== 'pawn' && place !== 'gas' && place !== 'liquor' && place !== 'guns') || (place !== 'gas' && !isOpen(placeInfo(place).hours!)) || cashOf(inv) < s.price) return;
    // Wearing it: everything moves into it, and what won't go anywhere, you're told about first (before any money or ID changes hands).
    if (how === 'wear' && (s.slot === 'top' || s.slot === 'bottom' || s.slot === 'bag')) {
      const w = wouldLeave(inv, s.slot, s.name);
      if (w.cash) {
        this.note([`If you swap to the ${lc(s.name)}, you’d have nowhere to put all your cash.`]);
        return;
      }
      const armed = this.armedWear?.id === s.id && performance.now() - this.armedWear.at > 450 && performance.now() - this.armedWear.at < 8000;
      // (And what you have on now: if there's nowhere to carry it, it goes in the trash.)
      const binned = ((): string | null => {
        const copy: Inventory = { ...inv, items: [...inv.items], clothes: [...inv.clothes], spots: [...inv.spots] };
        const r = wear(copy, s.slot as 'top' | 'bottom' | 'bag', s.name, true);
        const old = r.ok && r.old && !(s.slot === 'top' && /^t-shirt$/i.test(r.old)) ? r.old : null;
        return old && !stow(copy, { kind: 'wear', name: old, slot: s.slot }) ? old : null;
      })();
      if ((w.items.length || binned) && !armed) {
        this.armedWear = { id: s.id, at: performance.now() };
        const parts = [
          w.items.length ? `there’d be nowhere for ${list2(w.items.map((x) => `the ${lc(x.name)}`))}` : '',
          binned ? `there’s nowhere to carry your old ${lc(binned)}: it goes in the trash` : '',
        ].filter(Boolean);
        this.note([`If you wear the ${lc(s.name)}, ${parts.join(', and ')}. Tap Wear again to go ahead${w.items.length ? ` and leave ${w.items.length > 1 ? 'them' : 'it'} here` : ''}, or Carry it instead.`]);
        return;
      }
      this.armedWear = null;
    }
    // The pawn shop and the liquor store want to see ID first.
    let idLine = '';
    if (place === 'pawn' || place === 'liquor') {
      const check = this.showId(place);
      if (!check) return;
      idLine = check;
    }
    // A gun: your own ID, a form, and a background check (ammunition and a holster just want ID).
    if (place === 'guns') {
      const mine = this.ownId();
      if (!mine) {
        const fake = inv.items.some((x) => x.kind === 'id');
        if (fake) this.goTo('street');
        this.note([fake ? 'He looks at the ID, then at you. “That’s not you.” He slides it back and doesn’t take his eyes off you until you’re out the door.' : '“ID first. Your own. Everybody gets the background check.”']);
        return;
      }
      if (s.gun) {
        if (this.charged) {
          this.note(['You fill in the form, and he phones it through. It doesn’t take long. “Denied.” He doesn’t say why. He doesn’t need to: you’ve been charged with something.']);
          return;
        }
        idLine = `You fill in the federal form and he phones your ${lc(mine.name)} through for the background check. Twenty minutes of waiting, then: “Proceed.”`;
      } else idLine = `He checks your ${lc(mine.name)}.`;
    }
    let line: string;
    if (s.drink) {
      // Hot coffee, drunk standing at the counter.
      const h = this.health;
      const was = h.cold ?? 0;
      h.cold = Math.max(0, was - 1);
      h.stress = Math.max(0, (h.stress ?? 0) - 6);
      addCaffeine(h, 95);
      line = `You buy a coffee and drink it at the counter, too hot to taste. ${was ? (h.cold ? "Some of the cold goes out of you." : "You’re warm again.") : 'Your hands steady a little.'}`;
    } else if (s.med) {
      const m = medById(s.med);
      if (!stow(inv, { kind: 'med', name: m.name, med: s.med })) {
        this.note([`You’ve got nowhere to put ${withA(m.name)}. ${noRoomWhy(inv, measure({ kind: 'med', name: m.name, med: s.med }).size, measure({ kind: 'med', name: m.name, med: s.med }).kg)}`]);
        return;
      }
      line = `You buy ${withA(m.name)} from behind the counter.`;
    } else if (s.gun && gunOf(s.gun)) {
      const gn = gunOf(s.gun)!;
      // (Sold unloaded.)
      if (!stow(inv, { kind: 'weapon', name: gn.name, weapon: gn.club, doses: 0 })) {
        this.note([`Nowhere to carry it. ${noRoomWhy(inv, measure({ kind: 'weapon', name: gn.name }).size, measure({ kind: 'weapon', name: gn.name }).kg)}`]);
        return;
      }
      line = `He hands it over across the counter, unloaded, in a cardboard box. ${gn.desc}`;
    } else if (s.ammo) {
      if (!stow(inv, { kind: 'misc', name: s.name, doses: s.ammo })) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, measure({ kind: 'misc', name: s.name }).size, measure({ kind: 'misc', name: s.name }).kg)}`]);
        return;
      }
      line = `A box of ${s.ammo} ${s.name.replace(/ rounds$/, ' rounds').toLowerCase()}, heavier than it looks.`;
    } else if (s.knife && knifeOf(s.knife)) {
      const k = knifeOf(s.knife)!;
      if (!stow(inv, { kind: 'weapon', name: k.name, weapon: k.dmg, cuts: true })) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, measure({ kind: 'weapon', name: k.name }).size, measure({ kind: 'weapon', name: k.name }).kg)}`]);
        return;
      }
      line = `He unlocks the case and slides the ${lc(k.name)} across. ${k.desc}`;
    } else if (s.slot === 'gear') {
      // Worn under your clothes, for a blade.
      if ((inv.gear ?? []).includes(s.name)) {
        this.note([`You’ve already got ${withA(lc(s.name))}.`]);
        return;
      }
      (inv.gear ??= []).push(s.name);
      inv.spots = spotsFor(inv.clothes, inv.gear);
      line = `You buy the ${lc(s.name)} and strap it on${s.id === 'anklesheath' ? ', under your pant leg' : ''}. Move ${s.id === 'holster' ? 'a handgun' : 'a knife'} into it from Pockets.`;
    } else if (s.id === 'phone') {
      // A phone of your own: unlocked, in your name.
      if (!stow(inv, { kind: 'phone', name: 'Prepaid phone', detail: 'Prepaid, yours', own: this.world.lives, locked: false })) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, 'small')}`]);
        return;
      }
      line = 'The clerk rings up a prepaid phone in a plastic clamshell and slides it under the glass. It’s yours, and it works.';
    } else if (how === 'carry' && s.slot) {
      // (Bought to carry: on later, from Pockets.)
      if (!stow(inv, { kind: 'wear', name: s.name, slot: s.slot as 'top' | 'bottom' | 'bag' | 'head' | 'face' | 'eyes' })) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, measure({ kind: 'wear', name: s.name }).size, measure({ kind: 'wear', name: s.name }).kg)}`]);
        return;
      }
      line = `You buy the ${lc(s.name)} and put ${/s$/i.test(s.name) && s.slot !== 'bag' ? 'them' : 'it'} away. (Pockets: put ${/s$/i.test(s.name) && s.slot !== 'bag' ? 'them' : 'it'} on.)`;
    } else if (s.slot === 'head' || s.slot === 'face' || s.slot === 'eyes' || s.slot === 'hands') {
      // Something for your face: worn (a mask starts pulled down; pull it up in Pockets).
      const w = wearing(inv);
      const old = w[s.slot];
      w[s.slot] = s.name;
      if (s.slot === 'face') w.masked = false;
      line = `You buy the ${lc(s.name)}${old ? ` and toss your old ${old.toLowerCase()}` : ''}.${s.slot === 'face' ? ' You keep it pulled down for now (Pockets: pull it up).' : /s$/i.test(s.name) ? ' You put them on.' : ' You put it on.'}`;
    } else if (s.slot) {
      const slot = s.slot as 'top' | 'bottom' | 'bag';
      const r = wear(inv, slot, s.name, true);
      if (!r.ok) {
        this.note([`If you swap to the ${lc(s.name)}, ${lc(r.why)}`]);
        return;
      }
      // (The old one: in your bag if it'll go, or the bin out front.)
      const old = r.old && !(slot === 'top' && /^t-shirt$/i.test(r.old)) ? r.old : null;
      const kept = old ? stow(inv, { kind: 'wear', name: old, slot }) : null;
      const it2 = slot === 'bottom' ? 'them' : 'it';
      line = [
        `You buy the ${lc(s.name)}, move your things into ${it2} and put ${it2} on.`,
        r.left.length ? `You leave ${list2(r.left.map((x) => `the ${lc(x.name)}`))} behind.` : '',
        old ? (kept ? `Your old ${old.toLowerCase()} goes in your ${lc(inv.spots.find((x) => x.id === kept.spot)?.on ?? 'bag')}.` : `Your old ${old.toLowerCase()} goes in the trash can out front.`) : '',
      ].filter(Boolean).join(' ');
    } else if (s.id === 'zipbags' && inv.items.some((x) => x.name === 'Zip bags')) {
      // (More of them: into the pack you've got, not a second one.)
      const z = inv.items.find((x) => x.name === 'Zip bags')!;
      z.doses = (z.doses ?? 0) + (s.doses ?? 50);
      line = `You buy another pack of zip bags. ${z.doses} in all.`;
    } else {
      const brand = s.id === 'cigs' ? ['Red Crest', 'Mayfield Lights', 'Dakota Menthols', 'Ridgeway Reds', 'Union Blues', 'Harbor 100s'][Math.floor(Math.random() * 6)] : undefined;
      if (!stow(inv, { kind: 'misc', name: s.name, ...(brand ? { detail: brand } : {}), ...(s.drinkType ? { drink: s.drinkType } : {}), ...(s.doses ? { doses: s.doses } : s.id === 'lighter' ? { doses: 100 } : {}) })) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, measure({ kind: 'misc', name: s.name }).size, measure({ kind: 'misc', name: s.name }).kg)}`]);
        return;
      }
      line = s.id === 'energy' ? 'You buy an energy drink.' : s.id === 'beer' ? 'You buy a can of beer.' : s.id === 'vodka' ? 'You buy a pint of vodka in a paper bag.' : s.id === 'whiskey' ? 'You buy a pint of whiskey in a paper bag.' : s.id === 'wine' ? 'You buy a bottle of cheap red.' : s.id === 'cigs' ? `You buy a pack of ${brand}.` : s.id === 'matches' ? 'You buy a book of matches.' : `You buy the ${lc(s.name)}.`;
    }
    const paid = this.payLine(s.price * 100);
    this.refresh();
    this.note([...(idLine ? [idLine] : []), line, paid]);
    buzz(8);
  }

  /** How bright the tube is for the hour (eased toward it). */
  private dim = 1;
  /** Wear tapped once with things that wouldn't fit: a second tap goes ahead. */
  private armedWear: { id: string; at: number } | null = null;
  /** A shop row's buttons: clothes can be worn now or carried. */
  private stockBtns(s: Stock, cents: number, btn: (attr: string, v: string | number, label: string, no?: string | false | null) => string): string {
    const no = this.ownsWhy(s) || (cents < s.price * 100 && 'Not enough cash');
    if (!s.slot || s.slot === 'gear') return btn('stock', s.id, money(s.price * 100), no);
    return btn('stock', s.id, `Wear · ${money(s.price * 100)}`, no) + btn('stockc', s.id, `Carry · ${money(s.price * 100)}`, no);
  }
  /** Who you are, this time round: a name (for your ID), and an age. */
  private get me(): { name: string; age: number } {
    return (this.save.state.me ??= { name: randomName(), age: 22 + Math.floor(Math.random() * 25) }) as { name: string; age: number };
  }
  /** Your bank account, once you've opened one (this character's). */
  private get account(): { cents: number } | undefined {
    return this.save.state.account as { cents: number } | undefined;
  }
  /** Your own ID, if you have it on you. */
  private ownId(): InvItem | undefined {
    return this.inventory.items.find((x) => x.kind === 'id' && x.own === this.world.lives);
  }
  /**
   * Showing ID at the pawn shop or the liquor store: your own is fine; a
   * stolen one might not look like you (thrown out); none, and no sale.
   * Returns the line to show, or null if it went wrong (and says so).
   */
  private showId(place: 'pawn' | 'liquor'): string | null {
    const inv = this.inventory;
    const mine = this.ownId();
    if (mine) return place === 'pawn' ? `He glances at your ${lc(mine.name)} and copies the name into a book.` : 'The clerk glances at your ID and nods.';
    const id = inv.items.find((x) => x.kind === 'id' && !/expired/i.test(x.name));
    if (!id) {
      this.note([place === 'pawn' ? '“I need to see some ID.” He taps the sign: all customers must show photo ID.' : '“ID?” You haven’t got any. “Then no.”']);
      return null;
    }
    // It isn't you, and they can tell... unless you talk them round. (Taken once today, it'll do again.)
    const ok = this.save.state.idOk as { place: string; id: string; until: number } | undefined;
    const passed = !!ok && ok.place === place && ok.id === id.detail && now() < ok.until;
    const doubt = !passed && Math.random() < (place === 'pawn' ? 0.2 : 0.25);
    if (doubt && Math.random() < 0.15 + lieBonus(this.stats) * 0.8 - fatigueOdds(this.health)) {
      train(this.stats, 'speech', 5);
      this.save.state.idOk = { place, id: id.detail ?? '', until: now() + 3 * 3_600_000 };
      return `${place === 'pawn' ? 'He looks' : 'The clerk looks'} at the photo, then at you, frowning. “Lost a lot of weight since then,” you say, and laugh, and ${place === 'pawn' ? 'he lets' : 'they let'} it go.`;
    }
    if (doubt) train(this.stats, 'speech', 1);
    if (doubt) {
      // It isn't you, and they can tell.
      const line = place === 'pawn' ? `He looks at the ${lc(id.name)}, then at you, then at it again. “That’s not you.” He slides it back. “Get out of my shop.”` : `The clerk looks at the photo, then at you. “Nice try.” They keep the bottle, and the ID goes in a drawer under the counter.`;
      if (place === 'liquor') inv.items.splice(inv.items.indexOf(id), 1);
      if (place === 'pawn') {
        this.save.state.pawnBan = now() + 30 * 60_000;
        this.goTo('street');
        this.note([line, 'You end up back on the street.']);
      } else this.note([line]);
      return null;
    }
    this.save.state.idOk = { place, id: id.detail ?? '', until: now() + 3 * 3_600_000 };
    return place === 'pawn' ? (passed ? 'He doesn’t look at the ID twice.' : `He glances at the ${lc(id.name)} and copies the name into a book.`) : passed ? 'The clerk waves you through.' : `The clerk squints at the ${lc(id.name)}, and lets it go.`;
  }
  /** What the ER can do for you right now (and for which limbs). */
  private erNeeds() {
    const h = this.health;
    const limbs = h.broken.filter((p) => /arm|leg/.test(p) && !h.splinted?.includes(p));
    return {
      stitches: h.bleeding > 0 || (!!h.marks?.brow && !h.stitched?.brow) || (!!h.marks?.lip && !h.stitched?.lip),
      nose: h.broken.includes('nose') && !h.noseSet && (h.mending.nose ?? 0) > 1,
      cast: limbs,
      lung: !!h.lung,
      blood: h.blood < h.maxBlood * 0.8,
    };
  }
  /** Seen once this visit: the wait in the waiting room is over. */
  /** Seen by triage on this trip to the ER (kept in the save: a reload doesn't put you back in the queue). */
  private get erSeen(): boolean {
    return !!this.save.state.erSeen;
  }
  private set erSeen(v: boolean) {
    if (v) this.save.state.erSeen = true;
    else delete this.save.state.erSeen;
  }

  /**
   * The ER. They treat what you can't: stitches, setting a nose, a cast, a
   * chest tube, blood. Self-pay at the window. First the wait (unless you're
   * bleeding badly or can't breathe: then they take you straight in), and
   * the wait is real: you keep bleeding while you sit there.
   */
  private er(what: ErCare) {
    if (this.place !== 'hospital') return;
    const h = this.health;
    const inv = this.inventory;
    let need = this.erNeeds();
    let price = ER_PRICES[what] * (what === 'cast' ? Math.max(1, need.cast.length) : 1);
    const can = what === 'cast' ? need.cast.length > 0 : need[what];
    if (!can || cashOf(inv) * 100 < price * 100) return;
    const lines: string[] = [];
    const hadCut = h.bleeding > 0;
    if (!this.erSeen) {
      // Triage: bleeding badly, can't breathe, or white as a sheet, you go straight in;
      // bleeding at all, they move you up the list.
      const urgent = h.bleeding >= 3 || h.lung || h.blood < h.maxBlood * (PASS_OUT + 0.1);
      if (urgent) lines.push('One look at you and triage takes you straight through, past everyone waiting.');
      else {
        const wait = h.bleeding >= 2 ? 1 : 2 + Math.floor(Math.random() * 3);
        lines.push(wait === 1 ? 'Triage moves you up the list. Still an hour in a plastic chair, pressing a wad of paper towels to the wound.' : `You wait. ${wait} hours of plastic chairs, a TV nobody’s watching, and a vending machine that eats your change.`);
        // (Sitting up in a chair, not lying down resting.)
        lines.push(...passHours(h, wait, false));
        if (h.dead) return this.die(lines, 'You died in the waiting room.');
      }
      this.erSeen = true;
      // By the time they call your name, it may not need doing (a cut that's
      // stopped bleeding still gets closed, though).
      need = this.erNeeds();
      if (what === 'stitches' && hadCut) need.stitches = true;
      price = ER_PRICES[what] * (what === 'cast' ? Math.max(1, need.cast.length) : 1);
      if (what === 'cast' ? !need.cast.length : !need[what]) {
        lines.push('By the time they call your name, there’s nothing they need to do. They send you home.');
        this.refresh();
        this.note(lines);
        return;
      }
    }
    switch (what) {
      case 'stitches': {
        const was = h.bleeding;
        h.bleeding = 0;
        if (h.marks?.brow) (h.stitched ??= {}).brow = true;
        if (h.marks?.lip) {
          (h.stitched ??= {}).lip = true;
          (h.markHours ??= {}).lip = Math.min(h.markHours.lip ?? 12, 4);
        }
        lines.push(was ? 'A tired resident cleans you up, numbs it and sews you shut. The bleeding stops.' : 'They clean the cut out, glue it and tape it. It stings like hell.');
        if (h.marks?.brow) lines.push('Stitched, the cut over your eye will heal to a faint line.');
        break;
      }
      case 'nose':
        h.mending.nose = Math.ceil((h.mending.nose ?? 4) / 3);
        h.noseSet = true;
        lines.push('A doctor puts both thumbs on your nose and pushes it straight. You see white. Packing, tape, and a sheet of instructions.');
        break;
      case 'cast':
        for (const p of need.cast) {
          // (Set properly and cast: the quickest a break can knit.)
          h.mending[p] = Math.ceil((h.mending[p] ?? 12) / 4);
          (h.splinted ??= []).push(p);
        }
        lines.push(`An X-ray, then they set the ${need.cast.join(' and the ')} and put ${need.cast.length > 1 ? 'them' : 'it'} in a cast. ${need.cast.some((p) => p.endsWith('leg')) ? 'They give you crutches and a lecture.' : 'They give you a sling.'}`);
        break;
      case 'lung':
        h.lung = false;
        lines.push('They numb your side and push a tube in between your ribs. Air hisses out, and you can breathe again. A few hours on a gurney in the hall, then you sign yourself out against medical advice.');
        lines.push(...passHours(h, 1, true));
        break;
      case 'blood':
        h.blood = Math.max(h.blood, Math.round(h.maxBlood * 0.92));
        lines.push('Two bags of someone else’s blood, a few hours on a drip. Color comes back into your hands.');
        lines.push(...passHours(h, 1, true));
        break;
    }
    if (h.dead) return this.die(lines);
    lines.push(this.payLine(price * 100).replace(/^You hand over/, 'At the window you hand over'));
    this.refresh();
    this.note(lines);
    buzz(8);
  }

  /** At the Records Office: your own State ID, in your name. */
  private getId() {
    const inv = this.inventory;
    if (this.place !== 'records' || !isOpen(placeInfo('records').hours!) || this.ownId() || cashOf(inv) < ID_FEE) return;
    const me = this.me;
    const it = stow(inv, { kind: 'id', name: 'State ID', detail: `${me.name}, ${me.age}`, own: this.world.lives });
    if (!it) {
      this.note([`Nowhere to put it. ${noRoomWhy(inv, 'small')}`]);
      return;
    }
    const paid = this.payLine(ID_FEE * 100);
    const again = !!this.save.state.hadId;
    this.save.state.hadId = true;
    const waited = passHours(this.health, 1);
    if (this.health.dead) return this.die(waited);
    this.refresh();
    this.note([...waited, `An hour of waiting${again ? ', a form for a lost card,' : ''}, a photo where you look like a suspect, and a card still warm from the printer: ${me.name}.`, paid]);
    buzz(8);
  }

  /** At the bank: change money up or down. */
  private bank(what: string) {
    const inv = this.inventory;
    const p = inv.purse;
    if (this.place !== 'bank') return;
    const teller = isOpen(placeInfo('bank').hours!);
    let line = '';
    // Your account: opening it, and using it, take your own ID.
    // A typed amount (in dollars, to the cent).
    if (what.endsWith(':amt')) {
      const v = Number((document.getElementById('bank-amt') as HTMLInputElement | null)?.value ?? '');
      const cents = Math.round(v * 100);
      if (!Number.isFinite(cents) || cents <= 0) {
        this.note(['Type in how much first.']);
        return;
      }
      what = `${what[0]}:${cents}`;
    }
    if (what === 'open' || what === 'deposit' || what.startsWith('w:') || what.startsWith('d:')) {
      if (!teller) return;
      const mine = this.ownId();
      if (!mine) {
        this.note(['“I’ll need to see your ID.” Your own. The City Records Office can make you one.']);
        return;
      }
      const acct = this.account;
      if (what === 'open') {
        if (acct) return;
        this.save.state.account = { cents: 0 };
        line = `The teller checks your ${lc(mine.name)}, types for a long time, and slides a form across. “You’re all set, ${this.me.name.split(' ')[0]}.”`;
      } else if (!acct) return;
      else if (what === 'deposit') {
        const c = Math.round(cashOf(inv) * 100);
        if (!c) return;
        acct.cents += c;
        inv.purse = {};
        sound.coin();
        line = `You hand over everything: ${money(c)}. Your balance is ${money(acct.cents)}.`;
      } else if (what.startsWith('d:')) {
        const want = Math.round(Number(what.slice(2)));
        if (!Number.isFinite(want) || want <= 0) return;
        const have = Math.round(cashOf(inv) * 100);
        if (want > have) {
          this.note([`You’ve only got ${money(have)} on you.`]);
          return;
        }
        // You hand it all over; the teller counts it, keeps what you said,
        // and gives the rest back in as few bills as it'll go.
        inv.purse = {};
        addTo(inv.purse, fewest(have - want));
        acct.cents += want;
        sound.coin();
        line = `The teller counts your cash, puts ${money(want)} in your account and hands back ${money(have - want)}. Balance: ${money(acct.cents)}.`;
      } else {
        const want = what === 'w:all' ? acct.cents : Math.round(Number(what.slice(2)));
      if (!Number.isFinite(want) || want <= 0) return;
        const asked = Math.min(acct.cents, want);
        // (No more than you can carry.)
        if (roomForCents(inv, asked) <= 0) {
          this.note(['“Where are you going to put it?” Your pockets are full of cash already.']);
          return;
        }
        // (The big bills first, as many as will go; the rest stays in the account.)
        const back = cents(pocketCash(inv, fewest(asked)));
        const c = asked - back;
        acct.cents -= c;
        sound.coin();
        line = c < asked ? `The teller counts out ${money(c)}, all you’ve got room for on you. ${money(acct.cents)} left in your account.` : `The teller counts out ${money(c)}. ${money(acct.cents)} left in your account.`;
      }
      this.refresh();
      this.note([line]);
      buzz(8);
      return;
    }
    if (what === 'machine') {
      if (!count(p, COINS)) return;
      // (Less than a dollar's worth, after its cut: it gives you your coins back.)
      if (Math.floor(COINS.reduce((s, d) => s + d * (p[d] ?? 0), 0) * (1 - COIN_MACHINE_FEE)) < 100) {
        this.note(['You pour in your coins. The machine counts them, beeps, and spits them back out: not enough for a single bill.']);
        return;
      }
      const fee = coinsToBills(p, COIN_MACHINE_FEE);
      line = `You pour your coins into the machine. It counts them with a roar and prints a slip, minus ${money(fee)}. You have ${purseText(p)}.`;
    } else if (!teller) return;
    else if (what === 'up') {
      const before = JSON.stringify(p);
      changeUp(p);
      line = JSON.stringify(p) === before ? 'The teller looks at what you’ve got and slides it back. “Nothing to change.”' : `The teller counts it all twice and slides back ${purseText(p)}.`;
    } else if (what.startsWith('break:')) {
      const d = Number(what.slice(6));
      const trial = { ...p };
      if (!breakBill(trial, d)) return;
      if (!cashFits(inv, trial)) {
        this.note(['You’ve no room on you for that many more bills.']);
        return;
      }
      breakBill(p, d);
      line = `You hand over a ${denomName(d)} and get back ${purseText(breaksInto(d))}.`;
    }
    this.refresh();
    this.note([line]);
    buzz(8);
  }

  /**
   * A stolen card and the PIN they gave you. If they lied, the machine keeps
   * the card. If not, it pays out, once: by morning the card is stopped.
   * The camera sees whoever's using it.
   */
  private atm(i: number) {
    const inv = this.inventory;
    const card = inv.items[i];
    if (this.place !== 'bank' || !card || !/card/.test(card.kind) || !card.pin || card.drained) return;
    // (A camera up over the screen: a brim and a hood do more than a mask against it.)
    const anon = camAnonymity(inv);
    const lines: string[] = [];
    lines.push(anon >= 0.5 ? 'You keep your face down, away from the camera, and push the card in.' : 'You push the card in. The little camera over the screen watches you.');
    // (Covered up at a cash machine: the camera can't see you, but a guard and the people in line can see that.)
    if (wearing(inv).masked) {
      lines.push('Someone waiting in the lobby takes one look at your face covering and leaves.');
      this.reportedHeat(3, anonymity(inv), { sev: 3 });
    }
    if (!card.pinOk) {
      inv.items.splice(i, 1);
      lines.push(`You type ${card.pin}. WRONG PIN. You try again. On the third try the machine swallows the card. They lied to you.`);
      this.footage('bank', ['Access device fraud'], 6, anon);
      if (anon < 0.5) lines.push('The camera got your face.');
    } else {
      const credit = card.kind === 'credit card';
      // What the account (or the card's cash advance) will give, in twenties, up to the machine's daily limit.
      // (Old saves, before cards had money behind them: about what they used to give.)
      const behind = card.balance ?? (credit ? 2 + Math.floor(Math.random() * 19) : 1 + Math.floor(Math.random() * 15)) * 2000;
      const cap = card.limit ?? 40000;
      const avail = Math.floor(Math.min(behind, cap) / 2000);
      if (avail <= 0) {
        card.drained = true;
        card.empty = true;
        lines.push(`You type ${card.pin}. It works. You ask for $20, and the screen says INSUFFICIENT FUNDS. ${credit ? 'Maxed out.' : 'There’s nothing in there.'} The card’s no use to you now.`);
        this.footage('bank', ['Access device fraud'], 6, anon);
        if (anon < 0.5) lines.push('The camera got your face.');
        this.refresh();
        this.note(lines);
        buzz(8);
        return;
      }
      // (As many twenties as you can stuff in your pockets.)
      const room = { ...inv, purse: { ...inv.purse } };
      const can = avail - (pocketCash(room, { 2000: avail })[2000] ?? 0);
      if (!can) {
        this.note(['You type the PIN, and then stop. You’ve nowhere to put any more cash. You take the card back out before it asks.']);
        return;
      }
      const twenties = avail - (pocketCash(inv, { 2000: avail })[2000] ?? 0);
      card.drained = true;
      const limited = behind > cap && twenties === avail;
      lines.push(`You type ${card.pin}. It works. You take out ${twenties === 1 ? 'a single twenty' : `${money(twenties * 2000)} in twenties`}${credit ? ' on a cash advance' : ''}${twenties < avail ? ', all you can carry. The rest stays in the machine.' : limited ? `, as much as the machine gives in a day.${credit ? '' : ' There was more in there.'}` : credit ? ', all the card allows.' : behind - twenties * 2000 >= 100 ? `, all of it but ${money(behind - twenties * 2000)} the machine can’t give in twenties.` : ', all that was in there.'}`);
      lines.push(anon < 0.5 ? 'By morning they’ll have stopped the card, and pulled the camera footage.' : "By morning they’ll have stopped the card.");
      // (Someone else's card, as them: fraud and their identity; a cash advance on credit is the bank's money.)
      this.footage('bank', ['Access device fraud', 'Aggravated identity theft', ...(credit ? ['Bank fraud'] : [])], 9, anon);
    }
    this.refresh();
    this.note(lines);
    buzz(8);
  }

  /** Use medicine from your pockets (by its place in the list). */
  private useMed(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it?.med) return;
    const m = medById(it.med);
    if (m.blocked(this.health)) return;
    inv.items.splice(i, 1);
    const line = m.use(this.health);
    this.refresh();
    this.note([line]);
    buzz(8);
  }

  /** Your lighter or matches, if you have any. */
  private flame() {
    return this.inventory.items.find((x) => /^(lighter|matches)$/i.test(x.name)) ?? null;
  }

  /**
   * Uses the flame: a lighter burns fuel (a quick light a little, keeping it
   * lit for a fire a lot), a matchbook loses matches (more in the rain).
   * Returns a line if it's run out (and it's thrown away).
   */
  private useFlame(fire: InvItem, use: 'light' | 'burn' | 'fire'): string | null {
    const inv = this.inventory;
    const wet = WET_AMOUNT[this.weather.now] > 0 && !this.inside;
    const matches = /matches/i.test(fire.name);
    const left = flameLeft(fire);
    if (matches) {
      const n = { light: 1, burn: 2, fire: 3 }[use] + (wet ? 1 : 0);
      fire.doses = Math.max(0, left - n);
    } else {
      const pct = { light: 2, burn: 5, fire: 10 }[use] * (wet ? 1.5 : 1) * (0.7 + Math.random() * 0.6);
      fire.doses = Math.max(0, Math.round(left - pct));
    }
    if (fire.doses > 0) return null;
    inv.items.splice(inv.items.indexOf(fire), 1);
    return matches ? 'That was the last match. You drop the empty book.' : "The lighter sputters and dies. It’s out of fuel. You toss it.";
  }

  /**
   * A cigarette. It steadies your hands for a minute and does nothing good
   * for you. With a punctured lung, it comes back up red.
   */
  private smoke(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const fire = this.flame();
    if (!it || !fire || this.smokeBlocked() || (it.doses ?? 1) <= 0) return;
    it.doses = (it.doses ?? 1) - 1;
    const h = this.health;
    useHabit(h, 'nicotine', 4);
    // A cigarette takes about six minutes to smoke, for real.
    h.smokingUntil = now() + SMOKE_MS;
    const lines = [
      WET_AMOUNT[this.weather.now] > 0 && !this.inside
        ? `You hunch over a cigarette, cupping it from the ${isSnow(this.weather.now) ? 'snow' : 'rain'}, and get it lit on the third try.`
        : ['You light a cigarette and pull the smoke deep. Your hands stop shaking.', 'You light up and lean back, watching the street.', 'The first drag burns. The second one helps.'][Math.floor(Math.random() * 3)],
    ];
    if (h.lung) {
      lines.push('Your chest seizes. You cough, and it comes up pink and frothy.');
      this.fx.impact(true, 0, false, 'cough');
    } else if (h.broken.includes('ribs')) lines.push('Every drag pulls at your broken ribs.');
    if (it.doses <= 0) {
      if (/^loose/i.test(it.name)) {
        inv.items.splice(inv.items.indexOf(it), 1);
        lines.push('That was your last loose one.');
      } else {
        // Keep the empty pack: loose ones can go in it.
        it.doses = 0;
        lines.push("That was the last one in the pack. You keep the empty pack.");
      }
    }
    const out = this.useFlame(fire, 'light');
    if (out) lines.push(out);
    this.refresh();
    this.note(lines);
    buzz(6);
  }

  /** What you're on right now, for how the screen looks (fx/drugs.ts), and how strongly. */
  /**
   * How awake you are, for the cracks on the glass: in a fight, your Awake
   * bar (knocked out, nothing left); otherwise fine, or a little less while
   * you're concussed.
   */
  get awakeNow(): number {
    // Out cold, the screen off: the cracks stay.
    if (this.koLines) return 4;
    const e = this.encounter;
    if (e && (e.stage === 'combat' || e.stage === 'over') && this.tvState.on) return e.you.out ? 0 : (e.you.awake ?? 100);
    return this.health.concussion > 0 ? 82 : 100;
  }

  get drugNow(): { drug: DrugLook | null; k: number } {
    const e = this.encounter;
    if (e && e.stage === 'combat' && e.you.high) return { drug: e.you.high, k: 1 };
    const h = this.health;
    // Coke (or meth's edge) wears off on the clock, fight or no fight.
    if (h.wired) {
      h.wiredUntil ??= now() + 40 * 60_000;
      if (now() > h.wiredUntil && !(e && e.stage === 'combat')) {
        h.wired = false;
        delete h.wiredBy;
        delete h.wiredUntil;
      }
    }
    const left = (h.highUntil ?? 0) - now();
    // Wearing off over its last ten minutes.
    if (h.high && left > 0) return { drug: h.high, k: Math.min(1, 0.25 + left / 800_000) };
    if (h.wired) return { drug: 'cocaine', k: 1 };
    // Drunk: the more you've had, the more it shows.
    if (e && e.stage === 'combat' && (e.you.drunk ?? 0) >= 10) return { drug: 'drunk', k: Math.min(1, (e.you.drunk ?? 0) / 75) };
    soberUp(h);
    if ((h.drunk ?? 0) >= 10) return { drug: 'drunk', k: Math.min(1, (h.drunk ?? 0) / 75) };
    // Withdrawal: sick and grey, a tremor.
    const wdl = withdrawalEffects(h).worst;
    if (wdl && wdl.sev > 0.15) return { drug: 'withdrawal', k: Math.min(1, wdl.sev) };
    // Caffeine: a clean clarity, which turns into a tremor when it's too much.
    const mg = e && e.stage === 'combat' ? (e.you.caffeine ?? 0) : caffeineNow(h);
    if (caffeineLevel(mg)) return mg >= 400 ? { drug: 'jitters', k: Math.min(1, (mg - 300) / 300) } : { drug: 'caffeine', k: Math.min(1, mg / 200) };
    return { drug: null, k: 0 };
  }

  /**
   * A drink. Beer is a can's worth; liquor a swig. It eases stress and takes
   * the edge off the cold, and makes you worse in a fight. Too much and you
   * black out where you are.
   */
  /** Someone else's lunch, groceries, a bottle of water: it takes the edge off. */
  private eat(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const h = this.health;
    if (!it || !this.canOpenSheet) return;
    const water = /^(water bottle|bottle of water)$/i.test(it.name);
    const groceries = /^groceries$/i.test(it.name);
    const sandwich = /^sandwich$/i.test(it.name);
    const trash = it.food === 'trash';
    if (!water && !groceries && !sandwich && !trash && !/^lunch in a plastic tub$/i.test(it.name)) return;
    if (this.inside && !this.privateSpace) {
      this.note(['Not in here. Someone behind the counter is already watching you.']);
      return;
    }
    // (Only so often: you're not hungry again for a couple of hours, or thirsty for half an hour.)
    if (water ? this.thirstWait : this.hungerWait) {
      this.note([water ? 'You’re not thirsty. You just had some water.' : 'You’re not hungry. You just ate.']);
      return;
    }
    // Out of the trash and gone off: it takes more out of you than it gives (and you're still hungry).
    if (trash && it.spoiled) {
      inv.items.splice(i, 1);
      addFatigue(h, 6);
      this.refresh();
      this.note([oneOf([`Halfway through the ${lc(it.name)} you taste it: it’s gone bad. You spit out what you can. You feel worse than before.`, `The ${lc(it.name)} smells fine and tastes wrong. You get it down anyway, and regret it. It leaves you drained.`])]);
      return;
    }
    if (water) h.drankAt = now();
    else h.ateAt = now();
    h.fatigue = Math.max(0, fatigueNow(h) - (water ? 3 : trash ? 4 : 6));
    if (!water) h.stress = Math.max(0, (h.stress ?? 0) - 3);
    let line: string;
    if (groceries) {
      it.doses ??= 3;
      it.doses--;
      line = oneOf(['You tear into the groceries standing up: whatever you can eat without cooking it.', 'You eat out of the grocery bag on the sidewalk, like an animal. It helps.']);
      if (it.doses <= 0) {
        inv.items.splice(i, 1);
        line += ' That’s the last of it.';
      }
    } else if (trash) {
      inv.items.splice(i, 1);
      line = oneOf([`You eat the ${lc(it.name)} out of the trash, standing up. It’s food.`, `You eat the ${lc(it.name)} without looking at it too closely. It helps.`]);
    } else if (sandwich) {
      inv.items.splice(i, 1);
      line = oneOf(['You tear the plastic off with your teeth and eat the sandwich in a few bites.', 'You eat the sandwich standing up. Mostly bread. It helps.']);
    } else {
      inv.items.splice(i, 1);
      line = water ? oneOf(['You drink the water down in one go.', 'You drain the water bottle and toss it.']) : oneOf(['You eat someone else’s lunch with your fingers, standing up. It helps.', 'You pop the lid and wolf down someone else’s lunch. Cold, but it’s food.']);
    }
    this.refresh();
    this.note([line]);
  }
  /** Ate not long ago (2 hours) / drank water not long ago (half an hour). */
  private get hungerWait(): boolean {
    return now() - (this.health.ateAt ?? 0) < 2 * 3_600_000;
  }
  private get thirstWait(): boolean {
    return now() - (this.health.drankAt ?? 0) < 30 * 60_000;
  }
  private drink(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const h = this.health;
    if (!it?.drink || (it.doses ?? 0) <= 0 || !this.canOpenSheet) return;
    if (this.inside && !this.privateSpace && it.drink !== 'energy') {
      this.note(['Not in here. Someone behind the counter is already watching you.']);
      return;
    }
    if (it.drink === 'energy') {
      // Caffeine, not alcohol: nothing now, sharper in half an hour, for hours.
      inv.items.splice(i, 1);
      addCaffeine(h, 160);
      const mg = caffeineNow(h, now() + 45 * 60_000);
      this.closeSheet();
      this.refresh();
      this.note([
        'You crack the can and drink it down. Sickly sweet, and fizzing.',
        mg >= 600 ? "That’s a lot of caffeine in you. Your heart’s going to be pounding." : mg >= 400 ? 'Your hands are going to shake.' : "In half an hour you’ll be sharp.",
        'You crush the can and drop it.',
      ]);
      buzz(6);
      return;
    }
    soberUp(h);
    const was = drunkLevel(h.drunk ?? 0);
    const beer = it.drink === 'beer';
    useHabit(h, 'alcohol', beer || /wine/i.test(it.name) ? 2 : 3);
    it.doses = (it.doses ?? 1) - 1;
    // About one standard drink in a can or a swig of wine; a swig of whiskey or
    // vodka from the bottle is nearer one and a half.
    h.drunk = Math.min(100, (h.drunk ?? 0) + (beer || /wine/i.test(it.name) ? 10 : 14));
    h.drunkAt = now();
    h.stress = Math.max(0, (h.stress ?? 0) - 8);
    const lines = [beer ? 'You crack the can and drink it down. Cold, and a little sour.' : 'You take a long pull from the bottle. It burns all the way down.'];
    // It feels like warmth, but it opens up your skin and you lose heat faster.
    if (h.cold) lines.push("A glow spreads out from your stomach. You’re not any warmer, really: you just can’t feel the cold as much.");
    if ((it.doses ?? 0) <= 0) {
      if (beer || /vodka|whiskey|wine/i.test(it.name)) {
        inv.items.splice(inv.items.indexOf(it), 1);
        lines.push(beer ? 'You crush the can and drop it.' : 'That was the last of it. You leave the bottle in a doorway.');
      } else lines.push("That’s the last of it. The bottle’s empty.");
    }
    const now_ = drunkLevel(h.drunk);
    if (h.drunk >= 90) {
      lines.push('The street tips over. You sit down hard, and then you are somewhere else entirely.');
      // Hours go by, as with resting: whoever you were watching is long gone.
      this.dropEncounter();
      this.unstick();
      this.wipeBlood();
      lines.push(...passHours(h, 3));
      if (h.dead) return this.die(lines);
      // (Old saves, with no end time on it.)
      if (h.wired && h.wiredUntil == null) {
        h.wired = false;
        delete h.wiredBy;
        lines.push('Whatever you took wore off while you were gone.');
      }
      h.drunk = 40;
      h.drunkAt = now();
      lines.push('You come to in a doorway, hours later, with your mouth tasting like vomit.');
    } else if (h.drunk >= 78 && h.drunk < 90) lines.push("The street spins. You’re close to blacking out.");
    else if (now_ > was) lines.push(['', "You’re tipsy. Everything’s a bit funnier.", "You’re drunk. The street sways when you turn your head.", "You’re wasted. Your feet aren’t where you left them.", "You’re blackout drunk. One more and you’re gone."][now_]);
    this.closeSheet();
    this.refresh();
    this.note(lines);
    buzz(6);
  }

  /** Loads a gun from a box of its rounds. */
  private loadGun(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const gn = gunOf(it?.name);
    if (!it || !gn) return;
    const box = inv.items.find((y) => y.name === gn.ammo && (y.doses ?? 0) > 0);
    const n = Math.min(gn.holds - (it.doses ?? 0), box?.doses ?? 0);
    if (!box || n <= 0) return;
    it.doses = (it.doses ?? 0) + n;
    box.doses = (box.doses ?? 0) - n;
    if (box.doses <= 0) inv.items.splice(inv.items.indexOf(box), 1);
    this.refresh();
    this.note([`You load ${n} round${n > 1 ? 's' : ''} into the ${lc(gn.name)}. ${it.doses} in it now.`]);
    buzz(6);
  }

  /** Into the next pocket or bag it fits (to hide it, or have it to hand). */
  private moveItem(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it || !this.canOpenSheet) return;
    const to = nextSpot(inv, it);
    if (!to) return;
    const from = it.spot;
    const fitBefore = cashFits(inv);
    it.spot = to.id;
    if (fitBefore && !cashFits(inv)) {
      it.spot = from;
      this.note(['There’s no room there: your cash is in the way.']);
      return;
    }
    const where = `${to.on.toLowerCase()}, ${to.name.toLowerCase()}`;
    const v = showing(inv, it);
    this.refresh();
    this.note([`You put the ${lc(it.name)} in your ${where}.${it.kind === 'weapon' ? ` ${v < 0.06 ? 'Nobody would know it was there.' : v < 0.16 ? 'It makes a slight bulge.' : v < 0.35 ? 'You can see the shape of it.' : 'Anyone can see it.'}${inBag(inv, it.spot) ? ' It’ll take a moment to get out.' : ''}` : ''}`]);
    buzz(5);
  }

  /** Put loose cigarettes into a pack (the fullest one with room: up to 20). */
  private packLoose(i: number) {
    const inv = this.inventory;
    const loose = inv.items[i];
    if (!loose || !/^loose cigarettes$/i.test(loose.name)) return;
    const pack = inv.items.filter((y) => /^(pack of )?cigarettes$/i.test(y.name) && (y.doses ?? 0) < 20).sort((a, b) => (b.doses ?? 0) - (a.doses ?? 0))[0];
    if (!pack) return;
    const n = Math.min(loose.doses ?? 1, 20 - (pack.doses ?? 0));
    pack.doses = (pack.doses ?? 0) + n;
    loose.doses = (loose.doses ?? 1) - n;
    if (loose.doses <= 0) inv.items.splice(inv.items.indexOf(loose), 1);
    this.refresh();
    this.note([`You slide ${n === 1 ? 'the cigarette' : `${n} cigarettes`} into the pack. ${pack.doses} in it now.`]);
    buzz(5);
  }

  // ---------- Cars: the fob, the car, the trunk ----------

  private get cars(): Car[] {
    return (this.save.state.cars ??= []) as Car[];
  }
  private carById(id: unknown): Car | undefined {
    return typeof id === 'string' ? this.cars.find((c) => c.id === id) : undefined;
  }
  /** The keys to that car, if you've still got them. */
  private keysFor(id: string): InvItem | undefined {
    return this.inventory.items.find((x) => x.kind === 'car keys' && x.carId === id);
  }
  /** Cars you've the keys to (without them, a car's no use to you). */
  private get myCars(): Car[] {
    // (Not one that's been towed: you'd only find an empty space.)
    return this.cars.filter((c) => this.keysFor(c.id) && now() < c.towAt);
  }
  /** The car you're at. */
  private get atCar(): Car | undefined {
    return this.place === 'car' ? this.carById(this.save.state.carAt) : undefined;
  }
  /** On the hunt, with the fob still on you. */
  private huntKeys(): boolean {
    const s = this.save.state.hunt as HuntState | undefined;
    return !!s && this.inventory.items.some((x) => x.kind === 'car keys' && x.carId === s.car);
  }
  /** The keys to that car anywhere you've put them (pockets, the brick, your room, a trunk). */
  private keysKept(id: string): boolean {
    const st = this.save.state;
    const stash = st.stash as { items: InvItem[] } | undefined;
    const room = st.room as { items: InvItem[] } | undefined;
    return [...this.inventory.items, ...(stash?.items ?? []), ...(room?.items ?? []), ...this.cars.flatMap((c) => c.items)].some((x) => x.kind === 'car keys' && x.carId === id);
  }
  /** Walking the blocks with a fob (and the keys still on you). */
  private get hunt(): HuntState | undefined {
    const s = this.save.state.hunt as HuntState | undefined;
    return this.place === 'car' && s && this.keysFor(s.car) ? s : undefined;
  }
  /** The police are by it, after someone called it in. */
  private copsAtCar(c: Car): boolean {
    if (c.copsUntil != null && now() < c.copsUntil) return true;
    // (Parked out front of a house the police are at: they're by it too.)
    const h = c.home ? this.homeById(c.home) : undefined;
    return !!h && this.policeThere(h);
  }

  /** Car keys, and no idea where the car is: out on the street, pressing the fob. */
  private startHunt(i: number) {
    const it = this.inventory.items[i];
    if (!it || it.kind !== 'car keys' || it.car || this.ending || this.save.state.policeStop) return;
    if (this.place !== 'street' || !this.canLurk) return;
    // (Wherever the save last had you, you're on the street now.)
    this.place = 'street';
    it.carId ??= Math.random().toString(36).slice(2, 10);
    it.hunt ??= rollHunt(it.takenAt, now());
    this.save.state.hunt = { car: it.carId, heard: false, presses: 0, blocks: 0 } satisfies HuntState;
    delete this.save.state.carAt;
    this.goTo('car');
  }
  /** Keys whose car you know (off their kitchen hook: it's out front): the car, on file. */
  private ensureCar(it: InvItem): Car | undefined {
    if (it.kind !== 'car keys' || it.car !== 'found') return undefined;
    const had = this.carById(it.carId);
    if (had) return had;
    // (Keys to a car you'd found before, and it's not there now: it's gone.)
    if (it.carId) {
      it.car = 'gone';
      return undefined;
    }
    it.carId = Math.random().toString(36).slice(2, 10);
    const home = this.homeById(it.carOf);
    const c = makeCar({ id: it.carId, make: makeOf(it), takenAt: it.takenAt ?? now(), t: now(), at: home, of: home });
    this.cars.push(c);
    // (Only so many: the oldest you've no keys to go first.)
    while (this.cars.length > 12) {
      const k = this.cars.findIndex((x) => !this.keysKept(x.id));
      if (k < 0) break;
      this.cars.splice(k, 1);
    }
    return c;
  }
  /** Walk to a car you've found. */
  private goCar(id: string) {
    if (this.ending || this.save.state.policeStop) return;
    const c = this.carById(id);
    if (!c || !this.keysFor(id)) return;
    if (this.place === 'car' && this.save.state.carAt === id) return this.closeSheet();
    // (Where the save has you, as it is: not a car that's gone.)
    this.place = this.place;
    // (From one car to the next, or off the hunt: by way of the street.)
    if (this.place === 'car') {
      this.leaveCar();
      this.place = 'street';
    }
    this.save.state.carAt = id;
    delete this.save.state.hunt;
    this.goTo('car');
  }
  /** "Go to it", from Pockets. */
  private goCarKey(i: number) {
    const it = this.inventory.items[i];
    if (!it) return;
    const c = this.ensureCar(it);
    if (c) this.goCar(c.id);
    else if (it.car === 'gone') {
      this.note(['You walk back to where the car was. It isn’t there anymore.']);
      this.refresh();
    }
  }
  /** Walking off from the car (or giving up looking). */
  private leaveCar() {
    const c = this.carById(this.save.state.carAt);
    // Someone was on the phone about you: the police get there after you've gone.
    if (c && c.watch != null) {
      delete c.watch;
      c.copsUntil = now() + 2 * 3_600_000;
      // (Reported: they have it towed.)
      if (reported(c, now())) c.towAt = Math.min(c.towAt, now() + 2 * 3_600_000);
      this.infamy.heat = Math.min(100, this.infamy.heat + 4);
    }
    delete this.save.state.carAt;
    delete this.save.state.hunt;
  }
  /** Back at the car: is it still there? */
  private checkCar(): string[] {
    const c = this.atCar;
    if (!c || now() < c.towAt) return [];
    return this.towed(c, `${c.visited ? `Where you left the ${c.make}` : 'Where it was'}, there’s ${c.home ? 'an empty space at the curb' : 'an empty space, and someone else’s car pulling into it'}. Towed, or found and taken home.`);
  }
  /** At a car that's been towed while you stood there (the app left open, or reopened): it's gone. */
  private carTowedNow(): boolean {
    const c = this.atCar;
    if (!c || now() < c.towAt || this.save.state.policeStop) return false;
    this.note(this.towed(c, `A tow truck backs up to the ${c.make} and the driver gets out with a clipboard. You walk away before he looks at you.`));
    return true;
  }
  /** The car's gone (towed, or the owner has it back), and so's what was in it. You're on the street. */
  private towed(c: Car, line: string): string[] {
    const lines = [line];
    if (c.items.length || c.cents) lines.push('Whatever you had in the trunk went with it.');
    this.cars.splice(this.cars.indexOf(c), 1);
    for (const x of this.inventory.items) if (x.carId === c.id) x.car = 'gone';
    delete this.save.state.carAt;
    this.place = 'street';
    this.refresh();
    return lines;
  }

  /** On the hunt: press the fob, walk on, give up. */
  private huntAct(what: string) {
    const s = this.hunt;
    if (!s || this.ending || this.save.state.policeStop || this.sheet === 'police') return;
    if (what === 'stop') {
      this.goTo('street');
      return;
    }
    const key = this.keysFor(s.car)!;
    const hunt = (key.hunt ??= rollHunt(key.takenAt, now()));
    const make = makeOf(key);
    const lines: string[] = [];
    if (what === 'press') {
      s.presses++;
      if (!hunt.gone && hunt.dist === 0) {
        const c = makeCar({ id: s.car, make, takenAt: key.takenAt ?? now(), t: now(), of: this.homeById(key.carOf) });
        this.cars.push(c);
        key.car = 'found';
        delete key.hunt;
        if (s.watched) c.watch = 2;
        c.visited = true;
        delete this.save.state.hunt;
        this.save.state.carAt = c.id;
        lines.push(`You press the fob, and halfway down the block a ${c.color} ${make} chirps and flashes its lights. There it is, parked ${c.street}.`);
        if (s.watched) lines.push('Whoever was watching you try cars has seen which one.');
        this.refresh();
        this.note(lines);
        buzz([10, 40, 10]);
        return;
      }
      if (!hunt.gone && hunt.dist === 1) {
        s.heard = true;
        lines.push(oneOf(['You press the fob. Somewhere ahead, faint, a chirp. Then nothing.', 'You press it. Down past the corner, lights flash orange once, and go out.']));
      } else lines.push(oneOf(['You press the fob. Nothing.', 'You hold the fob up and press it. Not a chirp, not a flash.', 'Click. Nothing answers.']));
    } else if (what === 'walk') {
      s.blocks++;
      // (A block takes a few minutes. Long enough, and it's reported; reported, it gets moved or towed.)
      const walk = 5 * 60_000;
      if (key.takenAt != null) key.takenAt -= walk;
      if (key.tookAt != null) key.tookAt -= walk;
      if (!hunt.gone && now() - (key.takenAt ?? now()) > REPORTED_HOURS * 3_600_000 && Math.random() < 0.12) hunt.gone = true;
      if (s.heard) {
        if (Math.random() < 0.75) hunt.dist = Math.max(0, hunt.dist - 1);
        lines.push('You walk toward where the sound came from.');
      } else {
        hunt.dist = Math.max(0, Math.min(5, hunt.dist + (Math.random() < 0.5 ? -1 : 1)));
        lines.push(oneOf(['You walk on to the next block.', 'You turn the corner onto the next street.', 'You cross over and try the next block.']));
      }
      s.heard = false;
      // Every block round here, and nothing: it isn't here.
      if (hunt.gone && s.blocks >= 4) {
        key.car = 'gone';
        delete key.hunt;
        lines.push(`You’ve walked every block around here pressing it. Wherever the ${make} is, it isn’t near here: reported, moved on the spare key, or towed.`);
        delete this.save.state.hunt;
        this.place = 'street';
        this.refresh();
        this.note(lines);
        return;
      }
    } else return;
    // Out there trying cars: someone might see.
    const night = partOfDay() === 'night';
    if (Math.random() < (night ? 0.05 : 0.09) + this.infamy.heat / 500) {
      const k = Math.random();
      const fresh = now() - (key.takenAt ?? 0) < 3_600_000;
      if (fresh && !hunt.gone && hunt.dist <= 1 && k > 0.8) {
        lines.push('Down the block, someone’s patting their pockets, then walking the parked cars with a phone to their ear. Looking for theirs. It’ll be reported now.');
        key.tookAt ??= key.takenAt;
        key.takenAt = now() - (REPORTED_HOURS * 3_600_000 + 60_000);
      } else if (k < 0.45) {
        s.watched = true;
        this.infamy.heat = Math.min(100, this.infamy.heat + 3);
        lines.push(oneOf(['A curtain moves in a window across the street. Someone’s watching you try cars.', 'A man on a stoop has stopped talking on his phone to watch you.']));
      } else {
        this.infamy.heat = Math.min(100, this.infamy.heat + 2);
        lines.push('A patrol car turns onto the block and rolls past, slow. You put the fob in your pocket and keep walking.');
        if (this.infamy.heat >= 60 && Math.random() < 0.5) {
          lines.push('The brake lights come on.');
          this.refresh();
          this.save.state.policeWhy = lines;
          this.save.state.policeStop = true;
          this.openSheet('police');
          buzz([30, 30, 30]);
          return;
        }
      }
    }
    this.refresh();
    this.note(lines);
    buzz(6);
  }

  /** At the car: go through it, sleep in it, walk away. */
  private carAct(what: string) {
    const c = this.atCar;
    if (!c || this.ending || this.save.state.policeStop || this.sheet === 'police') return;
    if (what === 'leave') {
      this.goTo('street');
      return;
    }
    if (!this.keysFor(c.id)) return;
    // Gone while you stood there.
    if (now() >= c.towAt) {
      this.note(this.towed(c, `A tow truck backs up to the ${c.make} and the driver gets out with a clipboard. You walk away before he looks at you.`));
      return;
    }
    if (this.copsAtCar(c)) return;
    const lines: string[] = [];
    // The first time in: the fob, the clunk of the locks.
    const firstIn = !c.looked || !Object.keys(c.looked).length;
    if (what === 'sleep') {
      if (((c.slept != null && now() - c.slept < 4 * 3_600_000) || !this.restHeals) && fatigueNow(this.health) < 3) {
        this.note(['You lie down across the back seat, but you’re not tired. You watch the windows fog, and give up.']);
        return;
      }
      c.slept = now();
      this.unstick();
      const h = this.health;
      const lieAfter = fatigueNow(h) >= 3;
      const heals = this.restHeals;
      if (heals) h.restHealAt = now();
      lines.push(`${firstIn ? 'The fob unlocks it with a clunk. ' : ''}You climb into the back seat, lock the doors and curl up. The windows fog over.`, ...(heals ? passHours(h, REST_HOURS, true, !lieAfter) : []));
      if (h.dead) return this.die(lines);
      if (heals) {
        h.cold = 0;
        h.stress = Math.max(0, (h.stress ?? 0) - 15);
      }
      // (Worn out: you stay down, in real time, and the world goes on meanwhile.)
      if (fatigueNow(h) >= 3) return this.lieDown('car', lines, c.id);
      // (Towed while you slept: you wake to it.)
      if (now() >= c.towAt) {
        this.unstick();
        this.note([...lines, ...this.towed(c, 'You wake to a hammering on the glass: the tow truck driver. You climb out, and he hooks it up without a word to you.')]);
        return;
      }
      lines.push('You wake stiff and cold-footed, but dry.');
      // Reported by now: someone's been looking for it.
      if (reported(c, now()) && Math.random() < 0.4) {
        lines.push('A flashlight on the glass. Someone is tapping on the window with a baton.');
        this.infamy.heat = Math.min(100, this.infamy.heat + 10);
        return this.carCops(c, lines, 'asleep');
      }
      return this.carNote(c, lines, 0.03);
    }
    c.looked ??= {};
    c.left ??= {};
    const tk = /^take:(\w+):(\d+|all)$/.exec(what);
    if (tk) {
      const p = tk[1] as CarPart;
      const there = c.left[p];
      if (!CAR_PARTS.includes(p) || !there?.length) return;
      const picks = tk[2] === 'all' ? [...there] : there[Number(tk[2])] ? [there[Number(tk[2])]] : [];
      if (!picks.length) return;
      for (const l of picks) {
        const r = take(this.inventory, l);
        lines.push(r.text);
        if (r.ok) there.splice(there.indexOf(l), 1);
      }
      return this.carNote(c, lines, 0.02);
    }
    const m = /^part:(\w+)$/.exec(what);
    const part = m?.[1] as CarPart | undefined;
    if (!part || !CAR_PARTS.includes(part) || c.looked[part] != null) return;
    if (firstIn && part !== 'trunk') lines.push('The fob unlocks it with a clunk. You slide in and pull the door to.');
    const { loot, empty } = partLoot(c, part);
    c.left[part] = loot;
    c.looked[part] = now();
    lines.push(loot.length ? `${searchLine(part)} You turn up ${list2(loot.map(lootA))}.` : `${searchLine(part)} ${empty}`);
    this.carNote(c, lines, part === 'trunk' ? 0.08 : 0.04, part === 'trunk');
  }
  /** After each thing you do at the car: who saw. */
  private carNote(c: Car, lines: string[], exposed: number, atTrunk = false) {
    const night = partOfDay() === 'night';
    if (c.watch != null) {
      c.watch--;
      if (c.watch <= 0) return this.carCops(c, lines, atTrunk ? 'trunk' : 'searching');
    } else if (Math.random() < exposed * (night ? 0.6 : 1.5) + (reported(c, now()) ? 0.04 : 0) + this.infamy.heat / 600) {
      c.watch = 2 + Math.floor(Math.random() * 2);
      lines.push(oneOf(['A man walking a dog slows down, looks at you, then at the car, and walks on with his phone out.', 'Up on a balcony, someone’s on the phone, looking down at you.', 'A woman across the street stops and stares. Then she takes out her phone.']));
    } else if (!reported(c, now()) && !c.home && Math.random() < 0.03) {
      // (Not reported yet: they don't know it's gone. They've just come back for it.)
      c.watch = 1;
      lines.push('Someone’s coming up the sidewalk patting their pockets, looking at the car. Then at you. “Hey! HEY! That’s my car!” They’re backing off, phone out.');
    }
    this.refresh();
    this.note(lines);
    buzz(8);
  }
  /** The police, at the car. */
  private carCops(c: Car, lines: string[], how: 'asleep' | 'searching' | 'trunk') {
    if (how !== 'asleep') lines.push(reported(c, now()) ? `A patrol car pulls in behind, lights going${how === 'trunk' ? '' : ', and a flashlight finds you'}.` : 'A patrol car noses in behind the car. Someone called it in.');
    this.save.state.carStopHow = how;
    this.save.state.carReported = reported(c, now());
    this.refresh();
    this.save.state.policeWhy = lines;
    this.save.state.policeStop = 'car';
    this.openSheet('police');
    buzz([30, 30, 30]);
  }
  /** Your car keys gone with the police, and the car with them. */
  private impound(c: Car | undefined, keys: boolean) {
    if (c) {
      const i = this.cars.indexOf(c);
      if (i >= 0) this.cars.splice(i, 1);
    }
    // (No car to go with it: nothing of yours to take.)
    if (!c) return;
    const mine = (x: InvItem) => x.kind === 'car keys' && x.carId === c.id;
    if (keys) this.inventory.items = this.inventory.items.filter((x) => !mine(x));
    else for (const x of this.inventory.items) if (mine(x)) x.car = 'gone';
  }

  /** What you've turned up in a house or a car: pick it up a thing at a time, or all of it. */
  private foundHtml(found: { l: Loot; at: string; where: string }[], attr: string, btn: (attr: string, v: string | number, label: string, no?: string | false | null) => string, li: (name: string, small: string, button: string) => string): string {
    if (!found.length) return '';
    const rows = found.map(({ l, at, where }) => {
      const m = measure(l);
      const what = l.kind === 'cash' ? money(Math.round((l.cash ?? 0) * 100)) : `${l.detail ? `${l.detail} · ` : ''}${m.size}, ${kgLabel(m.kg)}`;
      return li(named(l), `${what} · ${where}`, btn(attr, `take:${at}`, 'Take'));
    });
    // (Everything from one place, in one go: quicker, and noisier.)
    const places = [...new Set(found.map((f) => f.at.split(':')[0]))];
    const all = places.filter((p) => found.filter((f) => f.at.startsWith(`${p}:`)).length > 1).map((p) => li(`All of it from ${lc(found.find((f) => f.at.startsWith(`${p}:`))!.where)}`, 'Quicker than one at a time. Noisier.', btn(attr, `take:${p}:all`, 'Take all')));
    return `<p class="shop-sub">What you’ve turned up</p><ul class="shop-list">${rows.join('')}${all.join('')}</ul>`;
  }

  /** The hunt: what you've heard, and what you can do. */
  private huntHtml(s: HuntState, btn: (attr: string, v: string | number, label: string, no?: string | false | null) => string, li: (name: string, small: string, button: string) => string): string {
    const key = this.keysFor(s.car)!;
    const cues = [
      s.heard ? 'You heard it. Somewhere ahead.' : s.blocks ? `${s.blocks} block${s.blocks > 1 ? 's' : ''} walked, and nothing yet.` : 'Parked cars both sides, under the streetlights. The fob only reaches so far: if it’s near, it’ll answer.',
      ...(now() - (key.takenAt ?? 0) > REPORTED_HOURS * 3_600_000 ? ['By now it’s probably been reported, or moved.'] : []),
      ...(s.watched ? ['Someone saw you trying cars.'] : []),
    ];
    return (
      `<ul class="home-cues">${cues.map((l) => `<li>${l}</li>`).join('')}</ul>` +
      `<ul class="shop-list">` +
      li('Press the fob', 'Listen for a chirp, look for lights.', btn('huntact', 'press', 'Press')) +
      li(s.heard ? 'Toward the sound' : 'The next block', s.heard ? 'It came from up ahead.' : 'Walk on, and try again there.', btn('huntact', 'walk', 'Walk')) +
      li('Give up', 'Put the fob away and go.', btn('huntact', 'stop', 'Stop')) +
      `</ul>`
    );
  }
  /** The car: what you can see of it, and its parts. */
  private carHtml(c: Car, btn: (attr: string, v: string | number, label: string, no?: string | false | null) => string, li: (name: string, small: string, button: string) => string): string {
    const t = now();
    const rep = reported(c, t);
    const cops = this.copsAtCar(c) && 'Police by it';
    const night = partOfDay() === 'night';
    const cues = [
      ...(cops ? ['A patrol car parked right behind it, and an officer walking around it with a flashlight.'] : []),
      `The ${c.color} ${c.make}, parked ${c.street}.`,
      ...(rep && t - c.takenAt > 8 * 3_600_000 ? ['A parking ticket under the wiper.'] : []),
      ...(rep ? ['It’s been reported by now. Every patrol car in the city has the plate.'] : c.watch != null || cops ? [] : ['Not reported yet, probably. That won’t last.']),
      night ? 'Dark here, between the streetlights.' : 'People walking past, in daylight.',
      ...(c.watch != null ? ['Someone saw you. The police are on their way.'] : []),
    ];
    const rows = CAR_PARTS.map((p) => {
      const looked = c.looked?.[p] != null;
      const n = looked ? (c.left?.[p]?.length ?? 0) : 0;
      return li(PART_NAME[p], !looked ? PART_DESC[p] : n ? `${n} thing${n > 1 ? 's' : ''} you could take, below.` : 'You’ve been through it.', btn('caract', `part:${p}`, 'Go through it', cops || (looked && 'Searched')));
    }).join('');
    const found = cops ? [] : CAR_PARTS.flatMap((p) => (c.looked?.[p] != null ? (c.left?.[p] ?? []).map((l, i) => ({ l, at: `${p}:${i}`, where: PART_NAME[p] })) : []));
    return (
      `<ul class="home-cues">${cues.map((l) => `<li>${l}</li>`).join('')}</ul>` +
      `<ul class="shop-list">${rows}` +
      li('Sleep in it', `The back seat, doors locked. Warm and dry, and the windows fog. ${rep ? 'It’s been reported: someone may come looking.' : 'Until it’s been reported.'}`, btn('caract', 'sleep', 'Sleep', cops)) +
      li('Walk away', 'Leave it where it is. It’ll be here, for a while.', btn('caract', 'leave', 'Go')) +
      `</ul>` +
      this.foundHtml(found, 'caract', btn, li) +
      (cops ? '' : this.stashHtml('trunk'))
    );
  }

  /** A weapon into your hand: out, ready, and seen by everyone. */
  private hold(i: number, hand: 'left' | 'right') {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it || it.kind !== 'weapon' || inv.items.some((y) => y.hand === hand)) return;
    if (this.handBroken(hand)) return;
    if (this.inside) {
      this.note(['Not in here.']);
      return;
    }
    it.hand = hand;
    this.refresh();
    this.note([`You take out the ${lc(it.name)} and hold it in your ${hand} hand. Anyone who looks can see it.`]);
    buzz(6);
  }
  /** That arm, wrist or hand is broken: it holds nothing. */
  private handBroken(side: 'left' | 'right') {
    return this.health.broken.some((p) => p === `${side} arm` || p === `${side} wrist` || p === `${side} hand`);
  }
  /** A weapon back where it's kept. */
  private putAway(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it?.hand) return;
    // (Its pocket went with the clothes you changed, or it won't go in now: somewhere else, if there's room.)
    const to = awayTo(inv, it);
    if (!to) {
      const rest = { ...inv, items: inv.items.filter((y) => y !== it) };
      this.note([`There’s nowhere to put the ${lc(it.name)} away. ${noRoomWhy(rest, it.size, it.kg)}`]);
      return;
    }
    it.spot = to.id;
    delete it.hand;
    const sp = inv.spots.find((s) => s.id === it.spot);
    this.refresh();
    this.note([`You put the ${lc(it.name)} away${sp ? ` (${sp.on.toLowerCase()}, ${sp.name.toLowerCase()})` : ''}.`]);
    buzz(5);
  }

  /** Cigarettes from one pack into another (the fullest with room; a pack holds 20). */
  private combinePack(i: number) {
    const inv = this.inventory;
    const from = inv.items[i];
    if (!from || !/^(pack of )?cigarettes$/i.test(from.name) || (from.doses ?? 0) <= 0) return;
    const to = inv.items.filter((y) => y !== from && /^(pack of )?cigarettes$/i.test(y.name) && (y.doses ?? 0) < 20).sort((a, b) => (b.doses ?? 0) - (a.doses ?? 0))[0];
    if (!to) return;
    const n = Math.min(from.doses ?? 0, 20 - (to.doses ?? 0));
    to.doses = (to.doses ?? 0) + n;
    from.doses = (from.doses ?? 0) - n;
    this.refresh();
    this.note([`You move ${n === 1 ? 'a cigarette' : `${n} cigarettes`} across. That pack has ${to.doses} now${from.doses ? `; ${from.doses} left in this one` : ', and this one’s empty'}.`]);
    buzz(5);
  }

  /** Smoking now (a cigarette that hasn't burned down yet). */
  get smoking(): boolean {
    const h = this.health;
    // A clock that was set ahead, then put right: a cigarette lasts six minutes at most.
    if ((h.smokingUntil ?? 0) > now() + SMOKE_MS) h.smokingUntil = now() + SMOKE_MS;
    clampClock(h);
    return (h.smokingUntil ?? 0) > now();
  }

  /** Why you can't light a cigarette now, or null. */
  private smokeBlocked(): string | null {
    if (!this.flame()) return 'Nothing to light it';
    if (this.inside && !this.privateSpace) return 'No smoking in here';
    if (this.smoking) return `Still smoking (${Math.ceil(((this.health.smokingUntil ?? 0) - now()) / 60000)} min left)`;
    if (!this.canOpenSheet) return 'Not now';
    return null;
  }

  /** How stressed you are right now (in a fight, the fight's). */
  get stressNow(): number {
    const e = this.encounter;
    if (!this.tvState.on) return 0;
    return (e && e.stage !== 'seen' && e.stage !== 'over' ? e.you.stress : this.health.stress) ?? 0;
  }

  /**
   * Time spent somewhere besides lurking (real time): indoors you thaw out,
   * a level every couple of minutes; out in the alley in the rain, you get
   * colder. (On the street, lurking does it.)
   */
  private tickExposure(dt: number) {
    const h = this.health;
    if (this.place === 'street' || !this.tvState.on) return;
    if ((this.exposure += dt) < 120) return;
    this.exposure = 0;
    if (this.inside && h.cold) {
      h.cold--;
      this.note([h.cold ? 'The warmth is getting into you. You thaw out a little.' : "You’ve warmed up. You stop shivering."]);
      this.refresh();
    } else if (!this.inside) {
      const c = this.chill();
      if (c) {
        this.note([c]);
        this.refresh();
      }
    }
  }

  /** While a cigarette burns, stress eases; when it's done, you flick it away. */
  private tickSmoke(dt: number) {
    const h = this.health;
    if (!h.smokingUntil) return;
    if (this.smoking) {
      // It eases the stress you're carrying: in a fight, the fight's.
      const e = this.encounter;
      const fighting = e && e.stage !== 'seen' && e.stage !== 'over' ? e.you : null;
      const f = fighting ?? h;
      if (f.stress) f.stress = Math.max(0, f.stress - (dt * SMOKE_EASE) / (SMOKE_MS / 1000));
      return;
    }
    delete h.smokingUntil;
    const e = this.encounter;
    if (e?.you) e.you.smoking = false;
    if (this.running && this.tvState.on) this.note(['The cigarette burns down to the filter. You flick it away.']);
    this.refresh();
  }

  /**
   * The police stop you (see lurk). Stay calm: they look at you and search
   * you; anything stolen on you, or a face that matches what they've been
   * told, and you're arrested. Run: agility against your injuries; get
   * caught and they put you on the ground first.
   */
  /** “Offer them cash”, on an ordinary stop (not with a warrant out, or a weapon in your hand). */
  private bribeBtn(): string {
    if (this.case?.warrant || this.inventory.items.some((x) => x.kind === 'weapon' && x.hand)) return '';
    const low = cashOf(this.inventory) < 20;
    return `<button type="button" class="place" data-police="bribe"${low ? ' disabled' : ''}><b>Offer them cash</b><small>${low ? 'You’ve less than $20 on you' : `${money(this.bribeCents())}. Speech. If they won’t take it, it’s another charge.`}</small></button>`;
  }
  /** What you'd offer them to look the other way: $40 or a quarter of your cash, whichever's more, up to $300 (cents). */
  private bribeCents(): number {
    const cash = Math.round(cashOf(this.inventory) * 100);
    return Math.min(cash, 30_000, Math.max(4000, Math.floor(cash / 400) * 100));
  }
  private police(choice: 'run' | 'stay' | 'talk' | 'bribe') {
    // (No stop going on: a left-over sheet, nothing to answer.)
    if (!this.save.state.policeStop) return;
    const inv = this.inventory;
    const h = this.health;
    const f = this.infamy;
    const w = wearing(inv);
    const carStop = this.save.state.policeStop === 'car';
    const sting = this.save.state.policeStop === 'sting';
    const burglary = this.save.state.policeStop === 'burglary';
    // Caught at an address: whatever happens now, you're not going back in.
    const job = this.save.state.job as HomeJob | undefined;
    const invasion = !!job?.occupied;
    const killed = !!job?.killed || (!!this.encounter?.resident && !!this.encounter.them.dead);
    const cuffed = !!this.save.state.policeCuffed;
    delete this.save.state.policeCuffed;
    if (cuffed) choice = 'stay';
    const ducked = !!this.save.state.policeDucked;
    delete this.save.state.policeDucked;
    // (A new stop: a new call, if it comes to that.)
    delete this.save.state.dezCalled;
    // (Only for an ordinary stop, with cash on you and nothing they're already after you for.)
    if (choice === 'bribe' && (sting || burglary || !!this.case?.warrant || inv.items.some((x) => x.kind === 'weapon' && x.hand) || cashOf(inv) < 20)) choice = 'stay';
    const upstairs = (this.atHome?.type === 'apartment' && this.atHome.floor > 1) || this.atHome?.type === 'room';
    // (Caught on your corner, or somewhere else: at a car, in a house, at the courthouse. Only the corner counts for the school.)
    const onCorner = this.place === 'street' && !carStop && !burglary && !this.save.state.policeOffCorner;
    delete this.save.state.policeOffCorner;
    // (Out of the house either way; whether you got away is settled below.)
    // At a car (or out looking for one): the car, if they've come for it.
    const stopCar = carStop ? this.carById(this.save.state.carAt) : undefined;
    const carHow = this.save.state.carStopHow as 'asleep' | 'searching' | 'trunk' | undefined;
    const carReported = this.save.state.carReported !== false;
    delete this.save.state.carStopHow;
    delete this.save.state.carReported;
    if (this.place === 'car') {
      delete this.save.state.carAt;
      delete this.save.state.hunt;
      this.place = 'street';
      this.unstick();
      this.noteEl.hidden = true;
    }
    const atHouse = this.place === 'home';
    if (atHouse) {
      if (this.encounter?.resident) this.afterResidentFight(this.encounter);
      this.place = 'street';
      // (What was said in the house stays in the house.)
      this.unstick();
      this.noteEl.hidden = true;
    }
    delete this.save.state.policeStop;
    delete this.save.state.policeWhy;
    const lines: string[] = [];
    let arrested = false;
    /** What they charge you with, if it comes to that. */
    const charges: string[] = [];
    /** You lied to them and they didn't buy it: they look harder. */
    let lied = false;
    // Cash, folded, held low: they take it and go, or it's another charge.
    let bribed = false;
    if (choice === 'bribe') {
      const amt = this.bribeCents();
      const odds = Math.max(0.03, Math.min(0.85, 0.25 + (this.stats.speech?.level ?? 1) * 0.004 + Math.min(0.2, amt / 150_000) - f.heat / 300 - (exposure(inv) > 0.15 ? 0.2 : 0)));
      pay(inv.purse, amt);
      if (Math.random() < odds) {
        bribed = true;
        lines.push(`You hold out ${money(amt)}, folded small. One of them looks at the bills, then up the street. He takes them. “Go home.”`);
        f.heat = Math.max(0, f.heat - 5);
        const up = train(this.stats, 'speech', 4);
        if (up) lines.push(`Speech went up to ${up}.`);
      } else {
        lines.push(`You hold out ${money(amt)}, folded small. He looks at it, then at you. “You just made this a lot worse.” The money goes in an evidence bag, and the cuffs go on.`);
        arrested = true;
        charges.push('Bribery of a public official');
        train(this.stats, 'speech', 2);
      }
    }
    // Talking your way out: a story, a calm face. Harder the hotter you are,
    // and with a weapon showing or a mask on.
    // A warrant out for you: they run your name, and that's that.
    const pending = this.case;
    // Do they know who you are? Your face (covered, they can tell you to uncover it), and a booking photo if you've been arrested before.
    const w0 = wearing(inv);
    const photo = this.record.arrests > 0;
    let faceShows = anonymity(inv) < 0.5;
    const wantedNow = !!pending?.warrant || heatLevel(f.heat) >= 5;
    if (!faceShows && wantedNow && choice !== 'run' && w0.face && w0.masked && Math.random() < 0.6) {
      w0.masked = false;
      lines.push(`“Take that off. Let’s see your face.” You pull the ${w0.face.toLowerCase()} down.`);
      faceShows = anonymity(inv) < 0.5;
    }
    // (Spotted by someone who already knew the face: no doubt about it.)
    const spotted = !!this.save.state.policeKnow;
    delete this.save.state.policeKnow;
    const knowYou = faceShows && (spotted || Math.random() < (photo ? 0.95 : 0.7));
    if (pending?.warrant && choice !== 'run' && !knowYou) lines.push(faceShows ? 'One of them looks at you a long second, then at his phone. Nothing.' : 'They can’t get a look at you. Whoever they think you are, they don’t know it’s you.');
    // Hunted, and they know your face: they take you in, warrant or not.
    if (!pending?.warrant && knowYou && heatLevel(f.heat) >= 5 && choice !== 'run' && !bribed) {
      lines.push('“That’s him.” One of them already has the cuffs out. They want you downtown for questioning.');
      arrested = true;
    }
    let toldWarrant = false;
    if (pending?.warrant && choice !== 'run' && knowYou) {
      toldWarrant = true;
      lines.push(`One of them runs your name on the radio. A pause. “There’s a warrant out for you. Turn around.”${photo ? '' : ' Your face matches the one they’ve been sent.'}`);
      arrested = true;
      if (!['sting', 'escape', 'crime'].includes(pending.warrantFor ?? '')) charges.push('Failure to appear');
      // (Wanted for an escape: that's what they book you on, now.)
      if (pending.warrantFor === 'escape') {
        charges.push(...pending.charges.filter((x) => /escape|^failure to appear$/i.test(x)));
        pending.charges = pending.charges.filter((x) => !/escape|^failure to appear$/i.test(x));
      }
    }
    /** The sting(s) you ran from: charged now, at the station, like any other (so they go on your record). */
    let servedStings = 0;
    let servedSchool = false;
    const serveStings = () => {
      const n = pending?.stingPending ?? 0;
      if (!pending || !n) return;
      servedStings += n;
      if (pending.stingSchool) servedSchool = true;
      delete pending.stingSchool;
      for (let k = 0; k < n; k++) {
        const at = pending.charges.lastIndexOf('Selling a controlled substance');
        if (at >= 0) pending.charges.splice(at, 1);
        charges.push('Selling a controlled substance');
      }
      delete pending.stingPending;
    };
    if (pending?.warrant && choice !== 'run' && knowYou) serveStings();
    // A buy that was a setup: arrested, the marked money goes back in an evidence bag.
    const takeMarked = () => {
      const marked = Math.min(Math.round(cashOf(inv) * 100), (this.save.state.stingCash as number) ?? 0);
      if (marked) pay(inv.purse, marked);
      delete this.save.state.stingCash;
    };
    if (sting && choice !== 'run') {
      const marked = (this.save.state.stingCash as number) ?? 0;
      takeMarked();
      lines.push(marked > 0 ? `The cuffs go on. The ${money(marked)} you took is marked; the bag is already in an evidence envelope.` : 'The cuffs go on. The bag is already in an evidence envelope.');
      arrested = true;
      charges.push('Selling a controlled substance');
    }
    // Inside someone's home: there's nothing to say.
    if (burglary && choice !== 'run') {
      lines.push(
        cuffed
          ? 'They haul you up by the cuffs and walk you out to the car. Faces in every window on the street.'
          : killed
            ? 'They put you face down in the hallway, next to the body. For a moment nobody says anything.'
            : job?.beat
              ? 'They put you face down in the hallway. Behind them, a paramedic is kneeling over the person you left on the floor.'
              : invasion
              ? 'They put you face down in the hallway. Behind them, whoever lives here is pressed against the wall, shaking.'
              : 'They put you face down on someone else’s floor, and go through your pockets.',
      );
      arrested = true;
      charges.push(invasion ? 'Home invasion' : 'Burglary');
      if (killed) charges.push('Homicide');
      else if (job?.beat) charges.push('Assault');
      // The cash out of their house: counted into an evidence bag.
      if (job?.cash) {
        const c = Math.min(Math.round(cashOf(inv) * 100), job.cash);
        if (c) pay(inv.purse, c);
      }
    }
    // Asleep in a stolen car: they've run the plate.
    if (carStop && choice !== 'run' && !bribed) {
      lines.push(carHow === 'searching' || carHow === 'trunk' ? (carReported ? 'They run the plate. It comes back stolen. “Hands on the roof.”' : 'They run the plate, and get the owner on the phone. Nobody lent you this car. “Hands on the roof.”') : 'They run the plate while you blink at the flashlight. It comes back stolen. “Out of the car. Slowly.”');
      arrested = true;
      charges.push('Possession of stolen property');
      this.impound(stopCar, true);
    }
    // A weapon in your hand when they pull up: that's the whole stop.
    const brandished = inv.items.find((x) => x.kind === 'weapon' && x.hand);
    if (brandished && choice !== 'run') {
      lines.push(`“Drop it! DROP THE ${brandished.name.toUpperCase()}!” Two guns on you. You drop it. They put you face down on the sidewalk.`);
      arrested = true;
      charges.push('Brandishing a weapon');
    }
    const talk = () => {
      const odds = Math.max(0.03, Math.min(0.9, 0.3 + lieBonus(this.stats) - fatigueOdds(h) - f.heat / 150 - exposure(inv) * 0.6 - (w.masked ? 0.15 : 0) - ((h.drunk ?? 0) >= 40 ? 0.15 : 0) - (ducked ? 0.1 : 0)));
      if (Math.random() < odds) {
        lines.push(oneOf(['You tell them you’re walking home from a late shift, and keep your voice bored. They look at each other. “Alright. Get going.”', 'You give them a name, a street, a reason, all of it easy. One of them almost smiles. “Get home.”', 'You apologize for nothing in particular and ask them for directions. They point the way, and drive off.']));
        f.heat = Math.max(0, f.heat - 3);
        const up = train(this.stats, 'speech', 6);
        if (up) lines.push(`Speech went up to ${up}.`);
        return true;
      }
      lines.push(oneOf(['You start on a story. Halfway through, you hear how it sounds. So do they.', 'You talk too fast. “Uh-huh. Turn around, hands on the car.”']));
      lied = true;
      train(this.stats, 'speech', 2);
      return false;
    };
    if (choice === 'run') {
      const legs = new Set(h.broken.filter((p) => /(leg|ankle)$/.test(p)).map((p) => p.split(' ')[0])).size;
      const tired = fatigueOdds(h) * 2;
      addFatigue(h, 6);
      // (Agility counts through accuracyBonus; Sneak, for losing them once you're away.)
      const odds = 0.5 - tired - (burglary ? 0.15 : 0) + accuracyBonus(this.stats) + (this.stats.sneak?.level ?? 1) * 0.002 + runStamina(this.stats) - legs * 0.3 - (h.cold ?? 0) * 0.05 - (h.stress ?? 0) * 0.002 - (h.blood < h.maxBlood * 0.75 ? 0.15 : 0);
      if (Math.random() < odds) {
        lines.push(burglary ? (upstairs ? 'Down the fire escape, the last ten feet in a drop, and away down the alley. Flashlights behind you, then fewer, then none.' : 'Out the back, over a fence, through somebody’s yard and a hedge that tears your face. Flashlights behind you, then fewer, then none.') : 'You bolt. Shouts behind you, a car door, footsteps. You go over a fence and through a yard and down an alley, and when you stop, they’re gone.');
        f.heat = Math.min(100, f.heat + (burglary ? 25 : 10));
        // (Away on foot: the car stays with them.)
        if (carStop) this.impound(stopCar, false);
        // They had the buy on camera: a warrant goes out for you.
        if (sting) {
          f.heat = Math.min(100, f.heat + 25);
          const c = this.case ?? { charges: [], bail: 0, courtAt: now() };
          c.charges = [...c.charges, 'Selling a controlled substance'];
          c.stingPending = (c.stingPending ?? 0) + 1;
          if (this.nearSchool()) c.stingSchool = (c.stingSchool ?? 0) + 1;
          // (Already wanted for missing court, that stays the reason; otherwise it's the buy.)
          if (!c.warrant) c.warrantFor = 'sting';
          c.warrant = true;
          lines.push("They’ve got the buy on camera. There’ll be a warrant out for you by morning.");
          if (c.bailPaid) {
            lines.push(`You were out on bail. Not anymore: the ${money(c.bailPaid)} is gone.`);
            c.bailPaid = 0;
            c.jumped = true;
          }
          this.save.state.case = c;
          delete this.save.state.stingCash;
        }
      } else {
        lines.push(burglary ? (upstairs ? 'You get as far as the stairwell.' : 'You get as far as the back door.') + ' One of them takes your legs out and you hit the floor face first. A knee in your back, your arms wrenched behind you.' : 'You bolt, and get about ten yards. One of them takes your legs out and you hit the sidewalk face first. A knee in your back, your arms wrenched behind you.');
        h.blood = Math.min(h.blood, Math.max(h.maxBlood * 0.6, h.blood - 350));
        h.stress = Math.min(100, (h.stress ?? 0) + 25);
        this.fx.impact(true, 350, true, 'spatter');
        this.fx.dirt(0.8);
        arrested = true;
        charges.push('Resisting arrest');
        // (What they stopped you for still stands.)
        if (burglary) charges.push(invasion ? 'Home invasion' : 'Burglary');
        if (burglary && killed) charges.push('Homicide');
        else if (burglary && job?.beat) charges.push('Assault');
        if (burglary && job?.cash) {
          const c = Math.min(Math.round(cashOf(inv) * 100), job.cash);
          if (c) pay(inv.purse, c);
        }
        if (carStop) {
          charges.push('Possession of stolen property');
          this.impound(stopCar, true);
        }
        if (brandished) charges.push('Brandishing a weapon');
        if (sting) {
          charges.push('Selling a controlled substance');
          takeMarked();
        }
      }
    } else if (brandished || arrested || sting || burglary) {
      // (Nothing to talk about.)
    } else if (choice === 'talk' && talk()) {
      // Talked your way out: no search.
    } else if (bribed) {
      // Paid off: no search.
    } else {
      // (Wanted and they didn't get a look at you: the mask stays on, or they'd know you.)
      if (w.masked && !(wantedNow && !knowYou)) {
        w.masked = false;
        lines.push(`You pull the ${w.face!.toLowerCase()} down.`);
      }
      // Do you look like who they're after?
      const looks = !(pending?.warrant && !knowYou) && Math.random() < (f.heat / 100) * (1 - anonymity(inv) * 0.5) + (lied ? 0.12 : 0);
      lines.push('They pat you down and go through your pockets.');
      // Weapons get taken off you, and they remember it. (A loaded syringe is evidence instead.)
      // A pat-down is your clothes. Your bag, only if they've reason to.
      const bagSearched = looks || lied || f.heat > 40 || Math.random() < 0.35;
      if (!bagSearched && inv.items.some((x) => inBag(inv, x.spot))) lines.push("They don’t look in your bag.");
      const blades = inv.items.filter((x) => x.kind === 'weapon' && !(x.secret && x.secret !== 'empty') && (bagSearched || !inBag(inv, x.spot)));
      // A switchblade, a butterfly knife, a push dagger: illegal to carry, and that's an arrest.
      const banned = blades.filter((x) => /switchblade|butterfly|push dagger/i.test(x.name));
      if (banned.length) {
        arrested = true;
        charges.push('Carrying an illegal weapon');
      }
      if (blades.length) {
        inv.items = inv.items.filter((x) => !blades.includes(x));
        f.heat = Math.min(100, f.heat + 6);
        lines.push(`They find ${list2(blades.map((x) => `the ${lc(x.name)}`))} and take ${blades.length > 1 ? 'them' : 'it'}. “${blades.length > 1 ? 'What are these' : "What’s this"} for?”`);
        // A gun on you: that's serious.
        if (blades.some((x) => gunOf(x.name))) {
          f.heat = Math.min(100, f.heat + 15);
          lines.push('The gun changes everything: one of them keeps a hand on his holster the whole time.');
        }
      }
      const evidence = inv.items.filter((x) => (this.stolen(x) || (x.secret && x.secret !== 'empty')) && (bagSearched || !inBag(inv, x.spot)));
      if (evidence.length) {
        // (The drugs said as drugs; anything else, as something that isn't yours.)
        const dope = evidence.filter((x) => x.secret && x.secret !== 'empty');
        const hot = evidence.filter((x) => !dope.includes(x));
        if (dope.length) {
          // (Two of the same: "the eight-ball, and another just like it", not "the eight-ball and the eight-ball".)
          const names = [...new Set(dope.map((x) => lc(x.name)))];
          const what =
            dope.length === 1 ? `the ${names[0]}` : names.length === 1 ? (dope.length === 2 ? `the ${names[0]}, and another just like it` : `the ${names[0]}, and ${dope.length - 1} more just like it`) : names.length === 2 ? `the ${names[0]} and the ${names[1]}` : `the ${names[0]}, the ${names[1]} and more`;
          lines.push(`They find ${what}. One of them holds ${dope.length === 1 ? 'it' : 'one'} up to the light. “Well, well.”`);
        }
        if (hot.length) lines.push(`They find ${hot.length === 1 ? `the ${lc(hot[0].name)}` : `${hot.length} things that aren’t yours`}. “${hot.length === 1 ? 'Whose is this' : 'Whose are these'}?”`);
        arrested = true;
        if (evidence.some((x) => x.kind !== 'misc' && !(x.secret && x.secret !== 'empty'))) charges.push('Possession of stolen property');
        if (evidence.some((x) => x.secret && x.secret !== 'empty')) charges.push(this.drugCharge());
      }
      if (looks) {
        lines.push('One of them looks at you a long time, then at his phone. “That’s the one.” The cuffs go on.');
        arrested = true;
        // Someone who saw your face went to them: picked out of a line-up.
        const onWarrant = pending?.warrantCharges ?? [];
        if ((f.killsSeen ?? 0) > 0 && f.heat > 60 && !onWarrant.includes('Homicide')) {
          charges.push('Homicide');
          f.killsSeen = 0;
        } else if ((f.reports ?? 0) > 0 && f.heat > 60 && !onWarrant.includes('Assault')) {
          charges.push('Assault');
          f.reports = 0;
        } else if ((f.burglaries ?? 0) > 0 && f.heat > 50 && !onWarrant.some((x) => /burglary|home invasion/i.test(x))) {
          charges.push('Burglary');
          f.burglaries = 0;
        }
      } else if (!evidence.length && !banned.length) {
        lines.push('They find nothing. “Stay out of trouble.” They get back in the car and roll away.');
        f.heat = Math.max(0, f.heat - 5);
      }
    }
    // Caught at the house, or got away past them (then the break-in, and any body, are on file like any other).
    if (atHouse) {
      this.leaveHome(undefined, burglary && arrested);
      // Whoever you fought in there is remembered now, before the clock jumps (and their report is this arrest).
      const fought = this.encounter;
      if (fought?.resident) {
        if (arrested) fought.charged = true;
        this.encounter = null;
      }
    }
    if (arrested && pending?.stingPending) {
      if (pending.warrantFor === 'sting' && !toldWarrant) lines.push('At the station they run your name. There’s a warrant out for you: the buy you ran from.');
      serveStings();
    }
    // (Caught running, wanted for an escape: that's what they book you on.)
    if (arrested && pending?.warrant && pending.warrantFor === 'escape' && !charges.some((x) => /escape/i.test(x)) && pending.charges.some((x) => /escape/i.test(x))) {
      if (!toldWarrant) lines.push('At the station they run your name. There’s a warrant out for you: the escape.');
      charges.push(...pending.charges.filter((x) => /escape|^failure to appear$/i.test(x)));
      pending.charges = pending.charges.filter((x) => !/escape|^failure to appear$/i.test(x));
    }
    // (Wanted for something they know you did: that's what they book you on.)
    if (arrested && pending?.warrantCharges?.length) {
      const what = list2(pending.warrantCharges.map((x) => lc(chargeName(x))));
      lines.push(toldWarrant ? `At the station they book you on it: ${what}.` : `At the station they run your name. There’s a warrant out for you: ${what}.`);
      // (Booked now: the line-up counters for these are spent.)
      for (const x of pending.warrantCharges) this.spendSeen(x);
      charges.push(...pending.warrantCharges);
      delete pending.warrantCharges;
      delete pending.floor;
      if (pending.warrantFor === 'crime') {
        pending.warrant = false;
        delete pending.warrantFor;
      }
    }
    if (arrested && pending?.warrant && !['sting', 'escape', 'crime'].includes(pending.warrantFor ?? '') && !charges.includes('Failure to appear')) {
      lines.push('At the station they run your name. There’s a warrant out for you, too.');
      charges.push('Failure to appear');
    }
    if (arrested) {
      // Booking: everything on you, bag and all. What's stolen or illegal is charged.
      if (!charges.includes('Possession of stolen property') && inv.items.some((x) => this.stolen(x))) charges.push('Possession of stolen property');
      if (!charges.some((x) => /controlled substance|intent to|marijuana/.test(x)) && inv.items.some((x) => x.secret && x.secret !== 'empty')) charges.push(this.drugCharge());
      // With heat on you and a room rented, they get the address from the desk clerk.
      lines.push(...this.searchRoom(charges, f.heat));
      if (!charges.includes('Carrying an illegal weapon') && inv.items.some((x) => x.kind === 'weapon' && /switchblade|butterfly|push dagger/i.test(x.name))) charges.push('Carrying an illegal weapon');
      // Whatever's stolen is taken; a night in a cell.
      const before = inv.items.length;
      inv.items = inv.items.filter((x) => !(this.stolen(x) || x.kind === 'weapon' || (x.secret && x.secret !== 'empty') || x.name === 'Zip bags'));
      const took = before - inv.items.length;
      // Selling (or holding to sell) within a block of the school: a federal charge on top.
      // (Only what this stop caught: a buy you ran from elsewhere doesn't count, one you ran from here does.)
      const soldHere = charges.filter((x) => x === 'Selling a controlled substance').length > servedStings || charges.some((x) => /intent to (distribute|sell)/.test(x));
      if (((onCorner && this.nearSchool() && soldHere) || servedSchool) && !charges.includes(SCHOOL_CHARGE)) charges.push(SCHOOL_CHARGE);
      // It goes on your record: every arrest, and every charge.
      const rec = this.record;
      rec.arrests++;
      for (const c of charges) rec.charges[c] = (rec.charges[c] ?? 0) + 1;
      rec.last = now();
      lines.push(`You’re arrested.${took ? ` They keep ${took === 1 ? 'the evidence' : `${took === 2 ? 'both' : `all ${took}`} things they took off you`}.` : ''}`);
      lines.push(...custodyCare(h));
      delete h.smokingUntil;
      lines.push('You spend the night in a holding cell that smells of bleach and piss.');
      rec.nights = (rec.nights ?? 0) + 1;
      h.cold = 0;
      if (h.dead) return this.die(lines);
      if (charges.length) {
        // A case against you: bail, and a court date.
        const c = this.case ?? { charges: [], bail: 0, courtAt: 0 };
        c.charges = [...c.charges, ...charges];
        const priors = Math.max(0, rec.arrests - 1);
        // Arrested again while out on bail: it's revoked, and the money's gone.
        const revoked = !!c.bailPaid;
        if (revoked) {
          lines.push(`You were already out on bail. It’s revoked: the ${money(c.bailPaid!)} bail is gone.`);
          c.bailPaid = 0;
        }
        const noBail = revoked || !!c.jumped || c.charges.some((x) => chargeOf(x).bail === 0) || now() < ((this.save.state.probationUntil as number) ?? 0);
        c.bail = noBail ? 0 : Math.round(c.charges.reduce((n, x) => n + chargeOf(x).bail, 0) * (1 + priors * 0.5));
        c.courtAt = courtDate();
        c.warrant = false;
        delete c.warrantFor;
        delete c.warrantCharges;
        delete c.floor;
        delete c.jumped;
        delete c.missedCourt;
        this.save.state.case = c;
        lines.push(`In the morning you’re charged: ${charges.map((x) => lc(chargeName(x))).join(', ')}.`);
        // Picked up holding his product: Dez hears about it, and wonders what you said.
        if (this.connect.known && charges.some((x) => /intent to distribute|Selling/.test(x))) lines.push(this.trustDez(-15) ?? 'Word will get back to Dez that you were picked up holding. He won’t like it.');
        if (noBail) {
          lines.push(revoked ? 'No bail this time. You’re held until your hearing.' : now() < ((this.save.state.probationUntil as number) ?? 0) ? 'You were on probation. The judge doesn’t even look up: no bail. You’re held for your hearing.' : 'No bail. You’re held until your hearing.');
          this.save.state.bailOffer = 'custody';
        } else {
          lines.push(`Bail is set at ${money(c.bail * 100)}. Pay it and you walk out today with a court date, and get it back when you show up. Or wait in jail for the hearing.`);
          this.save.state.bailOffer = 'bail';
        }
      } else {
        lines.push('In the morning they let you go: not enough to charge you. This time.');
        // (Questioned and let go: they've had their look at you. Not Hunted any more.)
        f.heat = Math.max(this.warrantFloor, Math.min(f.heat, 74));
      }
      if (charges.length) f.heat = Math.max(0, f.heat - 45);
      f.rep += 5;
      h.stress = Math.min(100, (h.stress ?? 0) + 15);
    }
    // What happened stays on the screen until you've read it (once they let you out).
    this.save.state.policeResult = lines;
    this.save.state.policeArrested = arrested;
    this.refresh();
    this.renderSheet();
    if (arrested) this.lockUp(CELL_HOURS, 'A night in a holding cell');
    buzz(arrested ? [80, 60, 120] : 12);
  }

  /** Actually indoors: in a place that's open (outside a locked door, you're on the street). */
  private get inside(): boolean {
    // (A lock-up's a roll-up door by the river: you're out in the weather. An empty house, a bar, the church, the shelter: a roof.)
    if (this.place === 'spot') return this.atSpot?.kind !== 'warehouse';
    // (On the street at a bar's corner, you're in the bar.)
    if (this.place === 'street') return !!this.corner.bar;
    const info = placeInfo(this.place);
    return info.indoors && (!info.hours || isOpen(info.hours));
  }
  /** A case against you: the charges, bail, and when your court date is. */
  private get case(): Case | undefined {
    return this.save.state.case as Case | undefined;
  }
  /** Paying bail: cash first, then the bank. You're out, with a court date. */
  private payBail() {
    const c = this.case;
    if (!c || this.save.state.bailOffer !== 'bail') return;
    const inv = this.inventory;
    const want = c.bail * 100;
    const cash = Math.round(cashOf(inv) * 100);
    const acct = this.account;
    if (cash + (acct?.cents ?? 0) < want) return;
    const fromCash = Math.min(cash, want);
    if (fromCash) {
      inv.purse = {};
      addTo(inv.purse, fewest(cash - fromCash));
    }
    if (want > fromCash && acct) acct.cents -= want - fromCash;
    c.bailPaid = want;
    c.courtAt = courtDate();
    delete this.save.state.bailOffer;
    this.save.state.policeResult = [
      `You pay the ${money(want)}${want > fromCash ? ' (some of it from your bank account)' : ''} and sign where they tell you to.`,
      `Your court date: ${dateText(c.courtAt)}, at the County Courthouse. Show up and you get the bail back. Don’t, and there’ll be a warrant out for you.`,
    ];
    sound.coin();
    this.refresh();
    this.renderSheet();
  }
  /** Your one call: Dez, if he’d pick up for you (once an arrest). */
  private get canCallDez(): boolean {
    const con = this.connect;
    return con.known && !con.cutOff && con.trust >= 30 && !this.save.state.dezCalled;
  }
  /** Dez posts your bail. You owe him for it, and a fifth on top. */
  private dezBail() {
    const c = this.case;
    if (!c || this.save.state.bailOffer !== 'bail' || !this.canCallDez) return;
    const want = c.bail * 100;
    this.save.state.dezCalled = true;
    const owe = Math.round(want * 1.2);
    const d = this.debt;
    if (d) {
      d.base = (d.base ?? d.owed) + owe;
      d.owed += owe;
      // (He gives you a few days for this, like any new money: it's all due then.)
      d.due = Math.max(d.due, now() + 3 * 86_400_000);
      delete d.vigAt;
    } else this.save.state.debt = { owed: owe, base: owe, due: now() + 3 * 86_400_000, strikes: 0 };
    c.bailPaid = want;
    c.courtAt = courtDate();
    delete this.save.state.bailOffer;
    this.save.state.policeResult = [
      'You get one call. Dez picks up on the fourth ring, listens, and sighs. “You owe me.” An hour later, you’re out.',
      `You owe him ${money(owe)} now.`,
      `Your court date: ${dateText(c.courtAt)}, at the County Courthouse. Show up and you get the bail back. Don’t, and there’ll be a warrant out for you.`,
    ];
    this.refresh();
    this.renderSheet();
  }
  /** No bail (or you wouldn't pay it): County until the hearing, then the judge. */
  private heldForCourt() {
    const c = this.case;
    if (!c) return;
    const h = this.health;
    delete this.save.state.bailOffer;
    const lines = [...custodyCare(h), 'A day and a half in County: a bunk, a toilet with no seat, and the noise that never stops.'];
    this.record.heldHours = (this.record.heldHours ?? 0) + 36;
    this.lockUp(COUNTY_HOURS, 'In County, waiting for your hearing');
    if (h.dead) return this.die(lines);
    h.stress = Math.min(100, (h.stress ?? 0) + 20);
    lines.push(...this.verdict(true));
    if (h.dead) return this.die(lines);
    wearOff(h);
    this.save.state.policeResult = lines;
    this.save.state.policeArrested = true;
    this.refresh();
    this.renderSheet();
  }
  /**
   * Before the judge: dropped, a fine, probation, or jail time, by the
   * charges, your record and how well you talk. Clears the case.
   */
  private verdict(inCustody: boolean): string[] {
    const c = this.case;
    if (!c) return [];
    const f = this.infamy;
    const rec = this.record;
    const priors = Math.max(0, rec.arrests - 1);
    // Convicted again while on probation: the old sentence comes back on top.
    const onProbation = now() < ((this.save.state.probationUntil as number) ?? 0);
    let sev = c.charges.reduce((n, x) => n + chargeOf(x).sev, 0) + (onProbation ? 4 : 0);
    const lines: string[] = [`Your case is called: ${c.charges.map((x) => lc(chargeName(x))).join(', ')}. A public defender you’ve never met reads your file in the hallway.`];
    // Talking to the judge.
    const talk = lieBonus(this.stats) - fatigueOdds(this.health);
    train(this.stats, 'speech', 4);
    // Your bail back, for turning up.
    let held = 0;
    if (c.bailPaid && !inCustody) {
      held = cents(pocketCash(this.inventory, fewest(c.bailPaid)));
      lines.push(`You get your ${money(c.bailPaid)} bail back.`);
    }
    // (What wouldn't fit: toward a fine if there's one; else the clerk keeps it.)
    const keep = (): string[] => (held ? [`You’ve no room for ${money(held)} of your bail. The clerk shrugs and keeps it for the court’s fees.`] : []);
    delete this.save.state.case;
    if (Math.random() < Math.max(0.03, Math.min(0.6, 0.38 - sev * 0.04 + talk * 0.5 - priors * 0.06))) {
      lines.push('The evidence is thin and the prosecutor lets it go. “Dismissed.” You’re out the door before anyone changes their mind.');
      f.heat = Math.max(0, f.heat - 20);
      return [...lines, ...keep()];
    }
    // (Convicted while on it: the probation's done with, one way or another.)
    if (onProbation) delete this.save.state.probationUntil;
    // Speaking up for yourself (Speech): a charge dropped, or the sentence cut.
    let half = false;
    if (Math.random() < Math.min(0.55, 0.15 + (this.stats.speech?.level ?? 1) * 0.004)) {
      lines.push('You speak up for yourself, calm and clear. The judge listens.');
      if (c.charges.length >= 2) {
        const minor = c.charges.reduce((a, b) => (chargeOf(b).sev < chargeOf(a).sev ? b : a));
        c.charges = c.charges.filter((_, i) => i !== c.charges.indexOf(minor));
        sev -= chargeOf(minor).sev;
        lines.push(`The ${lc(chargeName(minor))} charge is dropped.`);
      } else if (sev <= 3 || sev > 6 || onProbation) {
        half = true;
        lines.push('The judge goes easier on you: half what it would have been.');
      } else {
        // (It was going to be probation anyway: nothing to halve.)
        lines.push('The judge nods.');
      }
      const up = train(this.stats, 'speech', 4);
      if (up) lines.push(`Speech went up to ${up}.`);
    }
    if (sev <= 3 && !onProbation) {
      const fine = Math.round(c.charges.reduce((n, x) => n + chargeOf(x).fine, 0) * (1 + priors * 0.25) * (half ? 0.5 : 1));
      const have = Math.round(cashOf(this.inventory) * 100) + (this.account?.cents ?? 0) + held;
      if (have >= fine * 100) {
        let left = fine * 100;
        // (The bail they're holding goes on the fine first.)
        const fromHeld = Math.min(held, left);
        held -= fromHeld;
        left -= fromHeld;
        const cash = Math.round(cashOf(this.inventory) * 100);
        const fromCash = Math.min(cash, left);
        this.inventory.purse = {};
        addTo(this.inventory.purse, fewest(cash - fromCash));
        left -= fromCash;
        if (left && this.account) this.account.cents -= left;
        lines.push(`Your lawyer takes the deal: you plead guilty. ${/^\$(8|1[18](,|$))/.test(money(fine * 100)) ? 'An' : 'A'} ${money(fine * 100)} fine, paid at the window on the way out.`);
        this.record.convictions = (this.record.convictions ?? 0) + 1;
        this.record.fines = (this.record.fines ?? 0) + 1;
        this.record.finedCents = (this.record.finedCents ?? 0) + fine * 100;
        f.heat = Math.max(0, f.heat - 30);
        return [...lines, ...keep()];
      }
      const days = Math.max(2, Math.round(fine / 100));
      this.record.convictions = (this.record.convictions ?? 0) + 1;
      lines.push(`You plead guilty. ${/^\$(8|1[18](,|$))/.test(money(fine * 100)) ? 'An' : 'A'} ${money(fine * 100)} fine you can’t pay, so it’s ${days} days instead.`);
      return [...lines, ...keep(), ...this.serve(days)];
    }
    if (sev <= 6 && !onProbation) {
      this.save.state.probationUntil = now() + 30 * 24 * 3_600_000;
      this.record.convictions = (this.record.convictions ?? 0) + 1;
      this.record.probations = (this.record.probations ?? 0) + 1;
      lines.push('Your lawyer takes the deal: you plead guilty and get probation. Get charged with anything while you’re on it and you’re held with no bail.');
      f.heat = Math.max(0, f.heat - 30);
      return [...lines, ...keep()];
    }
    const days = Math.round(c.charges.reduce((n, x) => n + chargeOf(x).days, 0) * (1 + priors * 0.3) * (half ? 0.5 : 1));
    lines.push(days >= 365 ? `Found guilty. ${prisonTerm(days).replace(/^a/, 'A')} in state prison.` : `Found guilty. ${days} days in County.`);
    return [...lines, ...keep(), ...this.serve(days)];
  }
  /** Time inside: you heal, you get harder, and you come out with nothing new. */
  private serve(days: number): string[] {
    const h = this.health;
    // On your record: the sentence, and the time.
    const rec = this.record;
    rec.convictions = (rec.convictions ?? 0) + 1;
    rec.sentences = (rec.sentences ?? 0) + 1;
    rec.daysServed = (rec.daysServed ?? 0) + days;
    rec.longest = Math.max(rec.longest ?? 0, days);
    if (days >= 365) rec.prison = (rec.prison ?? 0) + 1;
    // (Real time: you're inside until the day they let you out.)
    this.lockUp(servedHours(days), days >= 365 ? `Serving ${prisonTerm(days)} in state prison` : `Serving ${days} days in County`);
    rec.lastOut = this.jail?.until ?? now();
    // (They don't let you bleed out inside: the wound's seen to first.)
    // (Bones and faces mend on the real clock while you're in there.)
    const lines = [...custodyCare(h), `You serve ${days >= 365 ? (prisonTerm(days) === 'a year' ? 'the year' : prisonTerm(days)) : `your ${days} days`}. The food is gray, the nights are loud, and you learn who not to look at.`];
    if (h.dead) return lines;
    h.stress = Math.min(100, (h.stress ?? 0) + 25);
    h.nerve = Math.min(100, (h.nerve ?? 0) + 5);
    this.infamy.heat = 0;
    wearOff(h);
    lines.push('They give you back what you came in with, in a plastic bag, and open the door.');
    return lines;
  }
  /** At the courthouse: appear for your hearing (turning up late, with a warrant, they hold you). */
  private appear() {
    const c = this.case;
    if (this.place !== 'court' || !c || !isOpen(placeInfo('court').hours!) || this.inventory.items.some((x) => x.kind === 'weapon' && !/bottle|syringe/i.test(x.name))) return;
    if (!c.warrant && !hearingToday(c.courtAt)) {
      this.note([`The clerk finds your name. “Your hearing’s ${dateText(c.courtAt)}. Come back then.”`]);
      return;
    }
    const lines: string[] = [];
    if (c.warrant) {
      lines.push('You give your name at the desk. The clerk looks at her screen, then at the deputy. You’re cuffed in the hall: there’s a warrant out for you.');
      const fta = !['sting', 'escape', 'crime'].includes(c.warrantFor ?? '');
      if (fta) c.charges.push('Failure to appear');
      const escaped = c.warrantFor === 'escape';
      // (Wanted for something they know you did: it's added to the case now, and on your record.)
      const wanted = c.warrantCharges ?? [];
      c.charges.push(...wanted);
      delete c.warrantCharges;
      delete c.floor;
      c.warrant = false;
      delete c.warrantFor;
      delete c.missedCourt;
      const rec = this.record;
      for (const x of wanted) {
        rec.charges[x] = (rec.charges[x] ?? 0) + 1;
        this.spendSeen(x);
      }
      rec.arrests++;
      if (fta) rec.charges['Failure to appear'] = (rec.charges['Failure to appear'] ?? 0) + 1;
      if (escaped) for (const x of c.charges.filter((y) => /escape|^failure to appear$/i.test(y))) rec.charges[x] = (rec.charges[x] ?? 0) + 1;
      if (c.stingPending) rec.charges['Selling a controlled substance'] = (rec.charges['Selling a controlled substance'] ?? 0) + c.stingPending;
      delete c.stingPending;
      if (c.stingSchool && !c.charges.includes(SCHOOL_CHARGE)) {
        c.charges.push(SCHOOL_CHARGE);
        rec.charges[SCHOOL_CHARGE] = (rec.charges[SCHOOL_CHARGE] ?? 0) + 1;
      }
      delete c.stingSchool;
      rec.last = now();
      // Booked: everything on you, bag and all. What's stolen or illegal is charged and taken.
      const inv = this.inventory;
      const extra: string[] = [];
      if (inv.items.some((x) => this.stolen(x))) extra.push('Possession of stolen property');
      if (inv.items.some((x) => x.secret && x.secret !== 'empty')) extra.push(this.drugCharge());
      if (inv.items.some((x) => x.kind === 'weapon' && /switchblade|butterfly|push dagger/i.test(x.name))) extra.push('Carrying an illegal weapon');
      lines.push(...this.searchRoom(extra, this.infamy.heat));
      const before = inv.items.length;
      inv.items = inv.items.filter((x) => !(this.stolen(x) || x.kind === 'weapon' || (x.secret && x.secret !== 'empty') || x.name === 'Zip bags'));
      if (before > inv.items.length) lines.push('At booking they go through everything you have on you, and keep what they find.');
      if (extra.length) {
        c.charges.push(...extra);
        for (const x of extra) rec.charges[x] = (rec.charges[x] ?? 0) + 1;
        lines.push(`They add ${extra.map((x) => lc(chargeName(x))).join(' and ')}.`);
      }
      lines.push(...this.passCell());
      this.record.nights = (this.record.nights ?? 0) + 1;
      if (this.health.dead) return this.die(lines);
    }
    lines.push(...this.verdict(false));
    if (this.health.dead) return this.die(lines);
    this.refresh();
    if (this.jailed) this.jail!.after = lines;
    else this.note(lines);
    buzz(10);
  }
  /**
   * What's coming, for the phone to tell you while the game's closed (see
   * core/notify.ts): rested, out of jail, court, the room, Dez, who you were.
   */
  upcoming(): Upcoming[] {
    if (this.dead) return [];
    // Only two: rested, and out of jail. Plain words.
    const out: Upcoming[] = [];
    const t = now();
    const h = this.health;
    if (h.restingSince != null) {
      // (On a pew or a shelter cot it can end at closing, before you're rested: say which.)
      const closes = h.restEnd != null && (h.restWhere === 'pew' || h.restWhere === 'shelter') && t + restLeft(h) >= h.restEnd - 60_000;
      out.push(closes ? { id: 1, at: t + restLeft(h), title: 'Awake', body: `${this.me.name} is awake. You can play again.` } : { id: 1, at: t + restLeft(h), title: 'Rested', body: `${this.me.name} is rested. You can play again.` });
    }
    const j = this.jail;
    if (j && j.until > t) out.push({ id: 2, at: j.until, title: 'Out of jail', body: `${this.me.name} is out. You can play again.` });
    return out;
  }
  /**
   * Your body on the real clock, like everyone else's: bleeding, blood coming
   * back, bones and cuts mending, a concussion clearing, an hour at a time,
   * game open or not (lying down or locked up, faster).
   */
  private healOnClock(force = false) {
    const h = this.health;
    const t = now();
    // (A clock set back: nothing heals till it's caught up again. Set back by more than a day, start over from now.)
    if (h.healedAt == null || h.healedAt > t + 86_400_000) {
      h.healedAt = t;
      return;
    }
    if (h.healedAt > t) return;
    // (Mid-fight, the fight's own body is the one that counts: it catches up after.
    // On the menu, the power screen, out cold: it catches up once you're back, so you see it.)
    const e = this.encounter;
    // Stress settles as you go, minute by minute (not in a fight: that's the fight's own).
    if (e && e.stage !== 'seen' && e.stage !== 'over') h.stressAt = t;
    else if (!this.dead) {
      easeStress(h, t - Math.min(t, h.stressAt ?? t), h.restingSince != null || !!this.jail);
      h.stressAt = t;
    }
    // (Forced: settling up before you get up or walk out, paused or not.)
    if (this.dead || (!force && (this.paused || !this.tvState.on)) || this.koLines || this.save.state.koLines || (e && e.stage !== 'seen' && e.stage !== 'over')) return;
    // Away from the game (it wasn't running to look): bleeding leaves you weak, not dead.
    const away = this.lastHealLook == null || performance.now() - this.lastHealLook > 5 * 60_000;
    this.lastHealLook = performance.now();
    const hours = Math.floor((t - h.healedAt) / 3_600_000);
    if (hours < 1) return;
    const from = h.healedAt;
    h.healedAt += hours * 3_600_000;
    // (Lying down or locked up, faster: but only up to when that ended, not after.)
    const j = this.jail;
    const restEnd = j ? j.until : h.restingSince != null ? (h.restEnd ?? Infinity) : from;
    const all = Math.min(hours, 24 * 120);
    const restH = Math.max(0, Math.min(all, restEnd === Infinity ? all : Math.floor((restEnd - from) / 3_600_000)));
    const lines = [...(restH ? passHours(h, restH, true, false, away, false) : []), ...(all - restH && !h.dead ? passHours(h, all - restH, false, false, away, false) : [])];
    if (h.dead) return this.die(lines);
    if (away && h.bleeding && h.blood <= h.maxBlood * (PASS_OUT + 0.06)) {
      // (An hour's grace from now, to do something about it.)
      h.healedAt = t;
      lines.push('While you were gone you kept bleeding. You’re weak and light-headed, close to passing out: bandage it, or get to the ER, now.');
    }
    // (Collapsed from losing blood: whoever was across the street is long gone.)
    if (lines.some((l) => /You collapse\./.test(l)) && e?.stage === 'seen') this.encounter = null;
    if (lines.length) {
      this.refresh();
      this.note(lines);
    }
  }
  /** When the body was last looked at with the game running (null: just opened, so anything owed was time away). */
  private lastHealLook: number | null = null;
  /** A rest's quick healing: once every few hours (after that, the rest takes time). */
  private get restHeals(): boolean {
    const h = this.health;
    if ((h.restHealAt ?? 0) > now()) h.restHealAt = 0;
    return now() - (h.restHealAt ?? 0) >= 4 * 3_600_000;
  }
  /** Kept for later: what happened while you couldn't see it (saved, so a reload keeps it too). */
  private later(lines: string[]) {
    this.save.state.laterLines = [...((this.save.state.laterLines as string[] | undefined) ?? []), ...lines].slice(-6);
  }
  /** Shown once there's a street to show it on. */
  private flushLater() {
    const xs = this.save.state.laterLines as string[] | undefined;
    if (!xs?.length) return;
    const e = this.encounter;
    if (!this.running || !this.tvState.on || !this.tv.showingPicture || this.koLines || this.save.state.koLines || this.save.state.wokeLines || this.ending || this.dead || this.jail || this.work || this.health.restingSince != null || this.sheet || (e && e.stage !== 'seen')) return;
    delete this.save.state.laterLines;
    this.note(xs);
  }
  /** Where you're held, and until when (real time: the game's clock is yours). */
  private get jail(): Jail | undefined {
    return this.save.state.jail as Jail | undefined;
  }
  private get jailed(): boolean {
    const j = this.jail;
    return !!j && now() < j.until;
  }
  /** Jail got shorter: time already set the old way is cut to the new lengths (once). */
  private shortenOldTerms() {
    const st = this.save.state;
    if (st.termsV5) return;
    st.termsV5 = true;
    const t = now();
    const hoursFor = (what: string) => (/holding cell/i.test(what) ? CELL_HOURS : /waiting for your hearing/i.test(what) ? COUNTY_HOURS : ((d) => (d ? servedHours(d) : null))(termDays(what)));
    const j = this.jail;
    if (j && j.until > t) {
      const hrs = hoursFor(j.what);
      if (hrs != null) j.until = Math.max(t, Math.min(j.until, j.from + hrs * 3_600_000));
    }
    for (const x of this.selves) {
      // (Held for a hearing: it comes quickly now.)
      if (x.status === 'inside' && x.hearingAt != null && x.hearingAt > t + COUNTY_HOURS * 3_600_000) x.hearingAt = x.until = t + COUNTY_HOURS * 3_600_000;
      if (x.status !== 'inside' || x.hearingAt != null || x.until <= t) continue;
      const hrs = hoursFor(x.what);
      if (hrs != null) x.until = Math.min(x.until, t + hrs * 3_600_000);
    }
  }
  /** Held: that many more real hours behind a door you can't open. */
  private lockUp(hours: number, what: string) {
    if (this.health.restingSince != null) {
      fatigueNow(this.health);
      delete this.health.restingSince;
      delete this.health.restEnd;
      document.getElementById('rest')?.remove();
    }
    if (this.work) this.endWork(false, true);
    this.dropEncounter();
    const t = now();
    const j = this.jail;
    const live = !!j && j.until > t;
    this.save.state.jail = { from: live ? j!.from : t, until: (live ? j!.until : t) + hours * 3_600_000, what, ...(live && j!.after ? { after: j!.after } : {}) } satisfies Jail;
    this.running = false;
    this.showJail();
  }
  /** The cell: how long, and the one way out that isn't the door. */
  private showJail() {
    const j = this.jail;
    if (!j) return;
    document.getElementById('jail')?.remove();
    const el = document.createElement('div');
    el.id = 'jail';
    el.className = 'lockup';
    const c = this.case;
    el.innerHTML =
      `<h2>Inside</h2>` +
      `<p class="jail-what">${j.what}</p>` +
      `<p class="jail-left"></p>` +
      `<p class="jail-out"></p>` +
      (c?.charges.length ? `<p class="jail-charges">${/holding/.test(j.what) ? 'Held on' : 'Charged with'} ${c.charges.map((x) => lc(chargeName(x))).join(', ')}.</p>` : '') +
      (j.tried ? `<p class="jail-charges">${j.tried}</p>` : '') +
      `<p class="jail-how">Time inside is real time. Your body mends while you wait, and the streets, your room and what you owe run on without you. Come back when they let you out.</p>` +
      // Serving time: a way out that isn't the door.
      `<div class="lockup-btns">` +
      (/^Serving/.test(j.what) ? `<button type="button" class="jail-quit jail-escape"${this.escapeSoon ? ' disabled' : ''}>${this.escapeSoon ? 'Try to escape: not yet' : 'Try to escape'}</button>` : '') +
      `<button type="button" class="jail-quit jail-giveup">Give up on this life</button>` +
      `<button type="button" class="jail-quit lockup-you">You</button></div>`;
    el.querySelector('.jail-escape')?.addEventListener('click', () => this.tryEscape());
    el.querySelector('.lockup-you')!.addEventListener('click', () => this.openSheet('stats'));
    if (this.sheet === 'stats') el.classList.add('behind');
    const btn = el.querySelector<HTMLButtonElement>('.jail-giveup')!;
    let armed = 0;
    btn.addEventListener('click', () => {
      if (performance.now() - armed < 4000) return this.giveUp();
      armed = performance.now();
      btn.textContent = 'Tap again: go on as someone new';
      window.setTimeout(() => {
        if (btn.isConnected) btn.textContent = 'Give up on this life';
      }, 4000);
    });
    // (In the game's layer, so the pause button stays on top of it.)
    this.view.append(el);
    this.jailTick = -1;
    this.tickJail();
  }
  private jailTick = -1;
  /** Tried to get out not long ago (once every few hours). */
  private get escapeSoon(): boolean {
    const j = this.jail;
    return !!j?.triedAt && now() - j.triedAt < 6 * 3_600_000;
  }
  /** Out over the fence, or in a laundry cart: free and wanted. Caught: more time. */
  private tryEscape() {
    const j = this.jail;
    if (!j || !/^Serving/.test(j.what) || this.escapeSoon || j.until <= now() || this.dead) return;
    const st = this.stats;
    const h = this.health;
    j.triedAt = now();
    const odds = Math.min(0.5, 0.2 + (st.agility?.level ?? 1) * 0.002 + (st.sneak?.level ?? 1) * 0.002 + (st.strength?.level ?? 1) * 0.001 - fatigueOdds(h));
    if (Math.random() < odds) {
      const c = this.case ?? { charges: [], bail: 0, courtAt: now() };
      c.charges = [...c.charges, 'Escape'];
      c.warrant = true;
      c.warrantFor = 'escape';
      this.save.state.case = c;
      this.infamy.heat = 100;
      delete this.save.state.policeResult;
      delete this.save.state.policeArrested;
      j.after = [
        oneOf([
          'Laundry day. You fold yourself into a cart under a pile of gray sheets and hold your breath while it rolls through two doors and out onto the loading dock.',
          'In the yard, you wait for the guard on the corner to light a cigarette, then go up the fence where the wire sags. It tears your hands. You don’t stop.',
        ]),
        'You run, and keep running. There’ll be a warrant out for you by tonight.',
      ];
      j.until = now();
      j.escaped = true;
      this.record.lastOut = now();
      buzz([80, 40, 80, 40, 160]);
      return this.release();
    }
    // Caught: they add time for it.
    const left = j.until - now();
    j.until += Math.max(2 * 3_600_000, left * 0.5);
    this.record.lastOut = j.until;
    const rec = this.record;
    rec.charges['Attempted escape'] = (rec.charges['Attempted escape'] ?? 0) + 1;
    h.stress = Math.min(100, (h.stress ?? 0) + 20);
    j.tried = 'You got as far as the yard fence. A guard dragged you down by the ankle, and they added time for it.';
    buzz([80, 60, 120]);
    this.showJail();
  }
  /** Once a second: the countdown, and the door when it's time. */
  private tickJail() {
    const j = this.jail;
    if (!j) return;
    const left = j.until - now();
    if (left <= 0) return this.release();
    const el = document.getElementById('jail');
    if (!el) return this.showJail();
    // (Able to try again: the button comes back.)
    if (el.querySelector<HTMLButtonElement>('.jail-escape')?.disabled && !this.escapeSoon) return this.showJail();
    const sec = Math.ceil(left / 1000);
    if (sec === this.jailTick) return;
    this.jailTick = sec;
    const d = Math.floor(sec / 86_400);
    const hh = Math.floor((sec % 86_400) / 3600);
    const mm = Math.floor((sec % 3600) / 60);
    const ss = sec % 60;
    const two = (n: number) => String(n).padStart(2, '0');
    el.querySelector('.jail-left')!.textContent = `${d ? `${d} day${d === 1 ? '' : 's'}, ` : ''}${two(hh)}:${two(mm)}:${two(ss)} left`;
    const out = new Date(j.until);
    el.querySelector('.jail-out')!.textContent = `Out ${dueText(j.until)} at ${out.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  /** The door opens. */
  private release() {
    // (The body first, at the inside rate up to the day you're out, before the door opens.)
    if (this.jail) this.healOnClock(true);
    if (this.dead) return;
    const j = this.jail;
    // Inside, people talk: sometimes about who's selling.
    if (j && !j.escaped && !this.connect.known && Math.random() < 0.5) j.after = [...(j.after ?? []), 'On your way out, the man from the next bunk catches your sleeve. “You need work? Dez. The alley behind the laundromat. Tell him Rook sent you.”', ...this.learnConnect('Rook')];
    delete this.save.state.jail;
    document.getElementById('jail')?.remove();
    if (!j || this.dead) return;
    this.running = !this.paused;
    // (The police sheet left behind the jail screen, with nothing on it now: gone.)
    if (this.sheet === 'police' && !this.save.state.policeResult && !this.save.state.policeStop) this.closeSheet();
    this.refresh();
    if (this.save.state.policeResult) {
      if (this.tvState.on) this.openSheet('police');
    } else if (this.tvState.on) this.note(j.after?.length ? j.after : ['They give you back your things in a plastic bag and open the door. You’re out.']);
    else if (j.after?.length) this.save.state.wokeLines = j.after;
    buzz([40, 30, 40]);
  }
  /** Stopped counting the days: this one stays inside, and you go on as someone new. */
  private giveUp() {
    document.getElementById('jail')?.remove();
    // (Kept: still inside, until they're let out, bailed out, or broken out.)
    const me = this.snapshotSelf();
    const j = this.jail;
    const c = this.case;
    me.status = 'inside';
    me.priors = Math.max(0, this.record.arrests - 1);
    if (c && this.save.state.bailOffer) {
      // Waiting on a judge: held till the hearing (out on bail before it, if someone pays).
      // (The hearing comes quickly when you're held for it.)
      me.hearingAt = Math.min(c.courtAt, now() + COUNTY_HOURS * 3_600_000);
      me.until = me.hearingAt;
      me.charges = [...c.charges];
      if (this.save.state.bailOffer === 'bail' && c.bail) me.bail = c.bail * 100;
      me.what = 'In County, waiting for a hearing';
    } else {
      me.until = j?.until ?? now();
      me.what = j?.what ?? 'Inside';
      // (Out on bail with a court date: that still stands when they walk out.)
      if (!c?.courtAt) delete me.state.case;
    }
    this.selves.push(me);
    // (Only so many lives anyone keeps track of.)
    while (this.selves.length > 6) this.selves.shift();
    this.die(['You stop counting the days.', 'Whoever you were stays in here, for now. Someone on the outside could still come for them.'], 'Gone inside.', true);
  }
  /** A number nobody has had yet, for a new character (older saves: past the highest one in use). */
  private nextLifeNo(): number {
    this.world.issued = this.topLifeNo() + 1;
    return this.world.issued;
  }
  /** The highest character number anyone has had (remembered, so it's never handed out twice). */
  private topLifeNo(): number {
    const w = this.world;
    return (w.issued = Math.max(w.issued ?? 0, w.lives, ...this.selves.map((x) => x.life ?? 0)));
  }
  /** The people you used to be. */
  private get selves(): Self[] {
    const w = this.world as World & { selves?: Self[] };
    return (w.selves ??= []);
  }
  /** You, now, as someone to keep: everything that's yours, but not the moment you're in. */
  private snapshotSelf(): Self {
    // (Read first: a name nobody's asked for yet is only made when it's read.)
    const name = this.me.name;
    const st = this.save.state;
    const state: Record<string, unknown> = {};
    for (const k of CHAR_KEYS) if (st[k] !== undefined) state[k] = JSON.parse(JSON.stringify(st[k]));
    for (const k of MOMENT_KEYS) delete state[k];
    state.place = 'street';
    const wanted = !!(state.case as { warrant?: boolean } | undefined)?.warrant;
    return { id: Math.random().toString(36).slice(2, 10), name, life: this.world.lives, state, infamy: JSON.parse(JSON.stringify(this.infamy)) as Infamy, status: 'free', until: 0, what: '', at: now(), metAt: now(), ...(wanted ? { wanted } : {}) };
  }
  /** Time moves for them too: the hearing comes, the sentence ends. */
  private settleSelves() {
    const t = now();
    for (const x of this.selves) {
      if (x.status !== 'inside') continue;
      if (x.hearingAt != null && t >= x.hearingAt) this.judgeSelf(x);
      if (x.hearingAt == null && t >= x.until) {
        x.status = 'free';
        x.at = x.until;
        x.metAt = x.until - 7 * 3_600_000;
        delete x.van;
      }
    }
  }
  /** Their day in court (without you there): dropped, probation, or time. */
  private judgeSelf(x: Self) {
    let charges = x.charges ?? [];
    const priors = x.priors ?? 0;
    const at = x.hearingAt ?? now();
    // (They speak up for themselves too, as well as they can: a charge dropped, or the time cut.)
    const speech = (x.state.stats as Stats | undefined)?.speech?.level;
    let cut = 1;
    if (speech != null && Math.random() < Math.min(0.55, 0.15 + speech * 0.004)) {
      if (charges.length >= 2) {
        const minor = charges.reduce((a, b) => (chargeOf(b).sev < chargeOf(a).sev ? b : a));
        charges = charges.filter((_, i) => i !== charges.indexOf(minor));
      } else cut = 0.5;
    }
    const sev = charges.reduce((n, c) => n + chargeOf(c).sev, 0);
    delete x.hearingAt;
    delete x.bail;
    delete x.van;
    // (Judged: those charges are done with. A break-out after this is a new case.)
    delete x.charges;
    delete x.state.case;
    const rec = (x.state.record ?? { arrests: 1, charges: {} }) as CrimeRecord;
    x.state.record = rec;
    let days = 0;
    if (Math.random() < Math.max(0.03, Math.min(0.6, 0.38 - sev * 0.04 - priors * 0.06))) days = 0;
    else if (sev <= 3) days = Math.max(2, Math.round((charges.reduce((n, c) => n + chargeOf(c).fine, 0) * cut) / 100));
    else if (sev <= 6) {
      x.state.probationUntil = at + 30 * 24 * 3_600_000;
      rec.convictions = (rec.convictions ?? 0) + 1;
      rec.probations = (rec.probations ?? 0) + 1;
    } else days = Math.round(charges.reduce((n, c) => n + chargeOf(c).days, 0) * (1 + priors * 0.3) * cut);
    if (days) {
      rec.convictions = (rec.convictions ?? 0) + 1;
      rec.sentences = (rec.sentences ?? 0) + 1;
      rec.daysServed = (rec.daysServed ?? 0) + days;
      rec.longest = Math.max(rec.longest ?? 0, days);
      if (days >= 365) rec.prison = (rec.prison ?? 0) + 1;
      rec.lastOut = at + servedHours(days) * 3_600_000;
      x.what = days >= 365 ? `Serving ${prisonTerm(days)} in state prison` : `Serving ${days} days in County`;
    }
    x.until = at + (days ? servedHours(days) * 3_600_000 : 0);
  }
  /** On the You sheet: who you were, and where they are now. */
  private selvesHtml(): string {
    this.settleSelves();
    const xs = this.selves;
    if (!xs.length) return '';
    return (
      `<section class="stat-card selves"><h3><span>Who you were</span><b>${xs.length}</b></h3>` +
      xs
        .map((x) => {
          const where =
            x.status === 'free'
              ? `Out, somewhere on the streets.${x.wanted ? ' Wanted: there’s a warrant out for them.' : ''}`
              : x.hearingAt != null
                ? `In County, waiting for a hearing on ${dateText(x.hearingAt)}.${x.bail ? ` Bail is ${money(x.bail)}.` : ' No bail.'}`
                : `${x.what}. Out ${dueText(x.until)}.`;
          return `<div class="mark"><h4>${x.name}</h4><p class="stat-how">${where}${x.status === 'inside' ? ' Visit them at the County Courthouse.' : ''}</p></div>`;
        })
        .join('') +
      `</section>`
    );
  }
  /** At the courthouse: the jail behind it, and who you know inside. */
  private jailVisitHtml(open: boolean, btn: (attr: string, v: string | number, label: string, no?: string | false | null) => string, li: (name: string, small: string, button: string) => string): string {
    this.settleSelves();
    const t = now();
    const xs = this.selves.filter((x) => x.status === 'inside');
    if (!xs.length) return '';
    const cash = Math.round(cashOf(this.inventory) * 100) + (this.account?.cents ?? 0);
    const rows = xs
      .map((x) => {
        const vanNow = x.van != null && t >= x.van && t <= x.van + 45 * 60_000;
        const vanText = x.van != null && t < x.van ? ` The van moves them ${dueText(x.van)} at ${clockText(x.van)}.` : vanNow ? ' The van’s out back by the loading dock, right now.' : '';
        const small = (x.hearingAt != null ? `Waiting for a hearing, ${hearingToday(x.hearingAt) ? 'today' : dateText(x.hearingAt)}.${x.bail ? ` Bail: ${money(x.bail)}.` : ' No bail.'}` : `${x.what}. Out ${dueText(x.until)}.`) + vanText;
        const btns = [
          ...(open ? [btn('selfact', `visit:${x.id}`, 'Visit', !this.ownId() && 'Visitors need ID')] : []),
          ...(open && x.bail && x.hearingAt != null ? [btn('selfact', `bail:${x.id}`, `Bail: ${money(x.bail)}`, cash < x.bail && 'Not enough money')] : []),
          ...(vanNow ? [btn('selfact', `van:${x.id}`, 'Hit the van')] : []),
        ];
        return btns.length || open ? li(x.name, small, btns.join('')) : '';
      })
      .join('');
    if (!rows) return '';
    return `<p class="shop-sub">County Jail, around back</p><ul class="shop-list">${rows}</ul><p class="shop-broke">Bail only before a hearing. After that, they serve it out, or someone gets them out another way: the transport van is the only time they’re outside the walls. Long odds, and if it goes wrong, you’re inside with them.</p>`;
  }
  private selfAct(v: string) {
    const [what, id] = v.split(':');
    const x = this.selves.find((y) => y.id === id && y.status === 'inside');
    if (!x || this.place !== 'court') return;
    const open = isOpen(placeInfo('court').hours!);
    if (what === 'visit') {
      if (!open || !this.ownId()) return;
      const t = now();
      if (x.van == null || x.van + 45 * 60_000 < t) {
        if (x.hearingAt != null) {
          // To court: the morning of the hearing.
          const d = new Date(x.hearingAt);
          d.setHours(7, 30, 0, 0);
          x.van = d.getTime() > t ? d.getTime() : undefined;
        } else if (x.until - t > 26 * 3_600_000) {
          // Upstate, or to the hospital, or another court: a weekday, early.
          const d = new Date(t + (1 + Math.floor(Math.random() * 4)) * 86_400_000);
          while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
          d.setHours(6, 15 + Math.floor(Math.random() * 60), 0, 0);
          x.van = d.getTime() < x.until ? d.getTime() : undefined;
        }
      }
      if (x.van != null && x.van + 45 * 60_000 < t) delete x.van;
      const lines = [`You show your ID, sign the visitor log and wait an hour on a plastic chair. They bring ${x.name} out behind the glass, in orange.`];
      lines.push(x.van != null ? `“They move me ${dueText(x.van)}, ${clockText(x.van)},” they say into the phone, low. “The van, out back by the loading dock.” They look at you a long time.` : x.hearingAt != null ? '“My hearing’s today,” they say. “Whatever happens, happens.”' : '“Not long now,” they say. “I just sit it out.”');
      this.note(lines);
      this.renderShop();
      return;
    }
    if (what === 'bail') {
      if (!open || !x.bail || x.hearingAt == null) return;
      const want = x.bail;
      const inv = this.inventory;
      const cash = Math.round(cashOf(inv) * 100);
      const acct = this.account;
      if (cash + (acct?.cents ?? 0) < want) return;
      const fromCash = Math.min(cash, want);
      if (fromCash) {
        inv.purse = {};
        addTo(inv.purse, fewest(cash - fromCash));
      }
      if (want > fromCash && acct) acct.cents -= want - fromCash;
      // Out, with a court date of their own (and the bail back to whoever shows up for it).
      const c = (x.state.case ?? { charges: x.charges ?? [], bail: 0, courtAt: x.hearingAt }) as { charges: string[]; bail: number; courtAt: number; bailPaid?: number };
      c.bailPaid = want;
      // (Out on bail: a court date of their own, like anyone's.)
      c.courtAt = courtDate();
      x.state.case = c;
      x.status = 'free';
      x.at = x.metAt = now();
      delete x.hearingAt;
      delete x.bail;
      delete x.van;
      sound.coin();
      this.refresh();
      this.chooseSelf(x, [`You pay the ${money(want)}${want > fromCash ? ' (some of it from your bank account)' : ''} at the window. An hour later a door buzzes and ${x.name} walks out, squinting, a plastic bag of their things in one hand.`, `Their court date: ${dateText(c.courtAt)}. Miss it, and there’s a warrant.`]);
      return;
    }
    if (what === 'van') {
      const t = now();
      if (x.van == null || t < x.van || t > x.van + 45 * 60_000) return;
      delete x.van;
      const st = this.stats;
      const lv = (k: StatName) => st[k]?.level ?? 1;
      const armed = this.inventory.items.some((y) => y.kind === 'weapon' && !/bottle|syringe/i.test(y.name));
      const odds = Math.max(0.03, Math.min(0.3, 0.04 - fatigueOdds(this.health) + (lv('agility') + lv('strength') + lv('sneak')) * 0.0012 + lv('intimidation') * 0.001 + (armed ? 0.04 : 0) + anonymity(this.inventory) * 0.06));
      if (Math.random() < odds) {
        // Out: both of you wanted now.
        const sc = (x.state.case ?? { charges: [], bail: 0, courtAt: t }) as { charges: string[]; bail: number; courtAt: number; warrant?: boolean; warrantFor?: string };
        sc.charges = [...(x.charges ?? sc.charges), 'Escape'];
        sc.warrant = true;
        sc.warrantFor = 'escape';
        sc.bail = 0;
        sc.courtAt = t;
        x.state.case = sc;
        x.infamy.heat = 100;
        x.status = 'free';
        x.wanted = true;
        x.at = x.metAt = t;
        delete x.hearingAt;
        delete x.bail;
        const c = this.case ?? { charges: [], bail: 0, courtAt: t };
        const lost = c.bailPaid ?? 0;
        // (Already wanted for missing court: that's on there too.)
        if (c.warrant && !['sting', 'escape', 'crime'].includes(c.warrantFor ?? '') && !c.charges.includes('Failure to appear')) c.charges.push('Failure to appear');
        c.charges = [...c.charges, 'Aiding an escape'];
        c.warrant = true;
        c.warrantFor = 'escape';
        c.bailPaid = 0;
        this.save.state.case = c;
        this.infamy.heat = 100;
        buzz([80, 40, 80, 40, 160]);
        this.refresh();
        this.chooseSelf(x, [`You wait behind the dumpsters by the loading dock. The door clanks, and two deputies walk them out in a line, cuffed, toward the van.`, `You go. One deputy goes down hard; the other’s on the radio. ${x.name} is already running, and you’re running with them.`, `By the time the sirens start, you’re four blocks away. There’ll be warrants out for both of you.${lost ? ` The ${money(lost)} bail you put up for yourself is gone now.` : ''}`]);
      } else {
        // Caught: in there with them.
        const inv = this.inventory;
        const h = this.health;
        const rec = this.record;
        const lines = ['You wait behind the dumpsters by the loading dock. The door clanks, and two deputies walk them out toward the van.', `You go. You don’t get close: a third deputy you didn’t see has you face down on the asphalt, a knee in your neck. Through the van’s mesh window, ${x.name} watches them cuff you.`];
        const c = this.case ?? { charges: [], bail: 0, courtAt: 0 };
        // (Booked like anyone: what they were already after you for goes on the record too, and what's on you.)
        const fta = !!c.warrant && !['sting', 'escape', 'crime'].includes(c.warrantFor ?? '') && !c.charges.includes('Failure to appear');
        if (fta) c.charges.push('Failure to appear');
        const was = c.warrant ? c.charges.filter((y) => (fta && y === 'Failure to appear') || (c.warrantFor === 'escape' && /escape|^failure to appear$/i.test(y))) : [];
        for (const y of was) rec.charges[y] = (rec.charges[y] ?? 0) + 1;
        // (And what they already had your name for.)
        for (const y of c.warrantCharges ?? []) {
          rec.charges[y] = (rec.charges[y] ?? 0) + 1;
          this.spendSeen(y);
        }
        c.charges.push(...(c.warrantCharges ?? []));
        delete c.warrantCharges;
        delete c.floor;
        if (c.stingPending) rec.charges['Selling a controlled substance'] = (rec.charges['Selling a controlled substance'] ?? 0) + c.stingPending;
        delete c.stingPending;
        if (c.stingSchool && !c.charges.includes(SCHOOL_CHARGE)) {
          c.charges.push(SCHOOL_CHARGE);
          rec.charges[SCHOOL_CHARGE] = (rec.charges[SCHOOL_CHARGE] ?? 0) + 1;
        }
        delete c.stingSchool;
        const extra: string[] = [];
        if (inv.items.some((y) => this.stolen(y))) extra.push('Possession of stolen property');
        if (inv.items.some((y) => y.secret && y.secret !== 'empty')) extra.push(this.drugCharge());
        if (inv.items.some((y) => y.kind === 'weapon' && /switchblade|butterfly|push dagger/i.test(y.name))) extra.push('Carrying an illegal weapon');
        inv.items = inv.items.filter((y) => !(this.stolen(y) || y.kind === 'weapon' || (y.secret && y.secret !== 'empty') || y.name === 'Zip bags'));
        for (const y of extra) rec.charges[y] = (rec.charges[y] ?? 0) + 1;
        rec.arrests++;
        rec.charges['Aiding an escape'] = (rec.charges['Aiding an escape'] ?? 0) + 1;
        rec.last = t;
        rec.nights = (rec.nights ?? 0) + 1;
        lines.push('You’re arrested: aiding an escape.', ...custodyCare(h), 'You spend the night in a holding cell.');
        h.cold = 0;
        delete h.smokingUntil;
        if (h.dead) return this.die(lines);
        if (c.bailPaid) {
          lines.push(`You were already out on bail. It’s revoked: the ${money(c.bailPaid)} bail is gone.`);
          c.bailPaid = 0;
        }
        c.charges = [...c.charges, ...extra, 'Aiding an escape'];
        c.bail = 0;
        c.courtAt = courtDate();
        c.warrant = false;
        delete c.warrantFor;
        this.save.state.case = c;
        this.save.state.bailOffer = 'custody';
        lines.push(`In the morning you’re charged: aiding an escape${extra.length ? `, and ${extra.map((y) => lc(chargeName(y))).join(' and ')}` : ''}. No bail. You’re held until your hearing.`);
        this.infamy.heat = Math.min(100, this.infamy.heat + 40);
        h.stress = Math.min(100, (h.stress ?? 0) + 25);
        this.save.state.policeResult = lines;
        this.save.state.policeArrested = true;
        this.refresh();
        this.openSheet('police');
        this.lockUp(CELL_HOURS, 'A night in a holding cell');
        buzz([80, 60, 120]);
      }
    }
  }
  /** Face to face with them, out: who do you go on as? */
  private chooseSelf(x: Self, lines: string[]) {
    this.closeSheet();
    this.showChoice('Out', lines, [
      { label: `Go on as ${x.name}`, act: () => this.become(x) },
      { label: `Stay as ${this.me.name}`, act: () => this.note([`${x.name} nods at you once, and walks off down the block with their plastic bag. You’ll see them around.`]) },
    ]);
  }
  /** Them, out walking. */
  private meetSelf(x: Self) {
    this.showChoice(x.name, [`Across the street: ${x.name}. You’d know that walk anywhere. You were them, once.`, x.wanted ? 'They keep their hood up and their eyes down: there’s a warrant out for them.' : 'They see you, and stop.'], [
      { label: `Go on as ${x.name}`, act: () => this.become(x) },
      { label: 'Let them walk on', act: () => {} },
    ]);
  }
  /** A full-screen choice (who you go on as). */
  private showChoice(title: string, lines: string[], opts: { label: string; act: () => void }[]) {
    document.getElementById('choose')?.remove();
    const el = document.createElement('div');
    el.id = 'choose';
    el.className = 'lockup';
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    el.innerHTML = `<h2>${esc(title)}</h2>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}<div class="choose-btns">${opts.map((o, i) => `<button type="button" class="jail-quit" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`;
    const shown = performance.now();
    this.running = false;
    for (const b of el.querySelectorAll('button')) {
      b.addEventListener('click', () => {
        if (performance.now() - shown < 1200) return;
        el.remove();
        this.running = !this.paused && !this.jail && !this.dead;
        opts[Number(b.dataset.i)].act();
        this.refresh();
      });
    }
    this.view.append(el);
  }
  /** Going on as them: you, now, are kept the way they were. */
  private become(x: Self) {
    const st = this.save.state;
    const w = this.world;
    const cur = this.snapshotSelf();
    const here = this.place;
    for (const k of CHAR_KEYS) delete st[k];
    const loaded = JSON.parse(JSON.stringify(x.state)) as Record<string, unknown>;
    // (They keep their own number: their ID and phone are theirs again.)
    this.topLifeNo();
    w.lives = x.life ?? this.nextLifeNo();
    Object.assign(st, loaded);
    st.place = here === 'court' || here === 'street' ? here : 'street';
    w.infamy = JSON.parse(JSON.stringify(x.infamy)) as Infamy;
    // A different face: what people saw of the one you were is no use to them.
    for (const k of this.people) {
      k.memory.sawFace = false;
      k.memory.clothes = [];
      k.memory.otherLife = true;
    }
    const xs = this.selves;
    xs.splice(xs.indexOf(x), 1);
    xs.push(cur);
    w.lifeStart = this.lurkState.times;
    this.unstick();
    this.noteEl.hidden = true;
    this.phase = 'idle';
    this.refresh();
    this.note([`You’re ${x.name} again.${x.wanted ? ' And you’re wanted: keep your head down.' : ''}`, `${cur.name} goes their own way. You’ll see them around.`]);
  }
  /** A night held after turning yourself in. */
  private passCell(): string[] {
    const lines = [...custodyCare(this.health), 'You spend the night in a holding cell.'];
    this.lockUp(CELL_HOURS, 'A night in a holding cell');
    this.health.cold = 0;
    delete this.health.smokingUntil;
    return lines;
  }

  /** Time inside, and what the courts gave you. */
  private recordTimeHtml(): string {
    const r = this.record;
    // ("1.5 years", "1 year": never "1.0 years".)
    const n1 = (v: number) => v.toFixed(1).replace(/\.0$/, '');
    const span = (days: number) => (days >= 365 ? `${n1(days / 365)} year${n1(days / 365) === '1' ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'}`);
    const held = (r.nights ?? 0) * 8 + (r.heldHours ?? 0);
    const rows: [string, string][] = [];
    if (r.convictions) rows.push(['Convicted', `${r.convictions} time${r.convictions === 1 ? '' : 's'}`]);
    if (r.sentences) rows.push(['Sentences served', `${r.sentences}${r.prison ? ` (${r.prison} in state prison)` : ''}`]);
    if (r.daysServed) rows.push(['Time served', span(r.daysServed)]);
    if (r.longest && (r.sentences ?? 0) > 1) rows.push(['Longest stretch', span(r.longest)]);
    if (held) rows.push(['Held in a cell', held < 24 ? `${held} hour${held === 1 ? '' : 's'}` : n1(held / 24) === '1' ? '1 day' : `${n1(held / 24)} days`]);
    if (r.fines) rows.push(['Fines paid', `${money(r.finedCents ?? 0)} (${r.fines})`]);
    if (r.probations) rows.push(['Probation', `${r.probations} time${r.probations === 1 ? '' : 's'}`]);
    if (r.lastOut && r.lastOut <= now()) rows.push(['Last let out', dueText(r.lastOut)]);
    return rows.length ? `<ul class="record-list record-time">${rows.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('')}</ul>` : '';
  }
  /** Your criminal record (this character's): arrests, and what for. */
  private get record(): CrimeRecord {
    const r = this.save.state.record;
    // (Older saves: just "charged once".)
    if (r === true) this.save.state.record = { arrests: 1, charges: { 'Possession of stolen property': 1 } };
    else if (!r || typeof r !== 'object') this.save.state.record = { arrests: 0, charges: {} };
    return this.save.state.record as CrimeRecord;
  }
  /** Ever been charged with anything (the gun store's background check sees it). */
  private get charged(): boolean {
    return Object.values(this.record.charges).some((n) => n > 0);
  }
  /** Marks on you (scars, teeth, bruises): nothing dangerous, so set apart and greyed. */
  private marksHtml(): string {
    const ms = injuryEffects(this.health).filter((i) => i.mark);
    if (!ms.length) return '';
    return (
      `<section class="stat-card marks"><h3><span>Marks and scars</span><b>${ms.length}</b></h3>` +
      ms.map((i) => `<div class="mark"><h4>${i.name}</h4><p class="stat-how">${i.effects.join(' ')} ${i.heals}</p></div>`).join('') +
      `</section>`
    );
  }

  /** The record, for the You sheet. */
  private recordHtml(): string {
    const r = this.record;
    // (Old names read as the new ones: counted together.)
    const merged: Record<string, number> = {};
    for (const [c, n] of Object.entries(r.charges)) if (n > 0) merged[chargeName(c)] = (merged[chargeName(c)] ?? 0) + n;
    const rows = Object.entries(merged);
    return (
      `<section class="stat-card record"><h3><span>Criminal record</span><b>${r.arrests ? `${r.arrests} arrest${r.arrests > 1 ? 's' : ''}` : this.case?.warrant ? 'Wanted' : 'Clean'}</b></h3>` +
      (this.case ? `<p class="record-case${this.case.warrant ? ' warrant' : ''}">${this.case.warrant ? `Warrant out for you: ${this.case.warrantFor === 'sting' ? 'the buy you ran from' : this.case.warrantFor === 'escape' ? 'the escape' : this.case.warrantFor === 'crime' ? list2((this.case.warrantCharges ?? []).map((x) => lc(chargeName(x)))) || 'what you did' : 'a missed court date'}. If the police see your face, they’ll take you in. Turn yourself in at the County Courthouse to end it.` : `Court date: ${dateText(this.case.courtAt)}, County Courthouse. Charges: ${this.case.charges.map((x) => x.toLowerCase()).join(', ')}.${this.case.bailPaid ? ` Bail paid: ${money(this.case.bailPaid)} (back when you show up).` : ''}`}</p>` : '') +
      ((d) => (d ? `<p class="record-case${now() > d.due ? ' warrant' : ''}">You owe Dez ${money(d.owed)}${now() > d.due ? `. You’re late (it was due ${dueText(d.due)}), ${(d.vigDays ?? 0) >= VIG_DAYS ? "he’s done waiting" : 'it grows every day'}, and he’s sending someone.` : `, due ${dateText(d.due)} ${clockText(d.due)}. In the alley.`}</p>` : ''))(this.debt) +
      (now() < ((this.save.state.probationUntil as number) ?? 0) ? `<p class="record-case">On probation until ${dateText(this.save.state.probationUntil as number)} ${clockText(this.save.state.probationUntil as number)}: get charged with anything and you’re held, no bail.</p>` : '') +
      (r.arrests
        ? (rows.length ? `<ul class="record-list">${rows.map(([c, n]) => `<li><span>${chargeHtml(c)}</span><b>×${n}</b></li>`).join('')}</ul>` : '') +
          `<p class="record-note">${rows.length ? 'Each charge means a court date.' : 'Held, and let go without charge.'}${r.last ? ` Last arrested ${dueText(r.last)}.` : ''}</p>` +
          this.recordTimeHtml()
        : `<p class="record-note">${this.case?.warrant ? "No arrests yet. They’re looking for you." : 'No arrests. The police have nothing on this face.'}</p>`) +
      `</section>`
    );
  }

  /** A reversible jacket, inside out: the other colour shows, and you're not the one in the description. */
  private flipJacket() {
    const inv = this.inventory;
    if (!/reversible/i.test(inv.clothes[0] ?? '') || !this.canOpenSheet) return;
    const w = wearing(inv);
    w.flipped = !w.flipped;
    this.refresh();
    this.note([`You shrug out of the jacket and turn it inside out. ${w.flipped ? 'Gray' : 'Black'} now.`]);
  }
  /** Pull your mask or hood up or down. */
  /** Take off a cap, glasses, a mask, your jacket or your bag: it goes in your pockets (or your bag), if there's room. */
  private takeOff(slot: 'head' | 'face' | 'eyes' | 'hands' | 'top' | 'bag') {
    const inv = this.inventory;
    if (!this.canOpenSheet) return;
    let name: string | undefined;
    if (slot === 'head' || slot === 'face' || slot === 'eyes' || slot === 'hands') {
      const w = wearing(inv);
      name = w[slot];
      if (!name) return;
      const it = stow(inv, { kind: 'wear', name, slot });
      if (!it) {
        this.note([`Nowhere to put the ${lc(name)}. ${noRoomWhy(inv, measure({ kind: 'wear', name }).size, measure({ kind: 'wear', name }).kg)}`]);
        return;
      }
      delete w[slot];
      if (slot === 'face') w.masked = false;
      const sp = inv.spots.find((x) => x.id === it.spot);
      this.refresh();
      this.note([`You take off the ${lc(name)} and put ${/s$/i.test(name) ? 'them' : 'it'} in your ${sp ? `${sp.on.toLowerCase()}, ${sp.name.toLowerCase()}` : 'pocket'}.`]);
      return;
    }
    // A jacket off: you're in your T-shirt. A bag off: what was in it has to fit on you.
    const at = slot === 'top' ? 0 : 3;
    name = inv.clothes[at];
    if (!name || (slot === 'top' && /^t-shirt$/i.test(name))) return;
    const r = wear(inv, slot, slot === 'top' ? 'T-shirt' : (null as unknown as string));
    if (!r.ok) {
      this.note([`If you take off the ${lc(name)}, ${lc(r.why)}`]);
      return;
    }
    if (slot === 'bag') {
      inv.clothes = inv.clothes.filter((c, i) => i !== 3 || c);
      inv.spots = spotsFor(inv.clothes, inv.gear);
    }
    let it = stow(inv, { kind: 'wear', name, slot });
    // (A bag with nowhere to go: you carry it by the strap, if you've a hand free.)
    const hand = !it && slot === 'bag' ? freeHand(inv, this.health.broken) : null;
    if (!it && hand) {
      const m = measure({ kind: 'wear', name });
      it = { kind: 'wear', name, slot, size: m.size, kg: m.kg, spot: '', hand };
      inv.items.push(it);
      this.refresh();
      this.note([`You take off the ${lc(name)} and carry it in your ${hand} hand.`]);
      return;
    }
    if (!it) {
      // (Nowhere to carry it once it's off: put it back on.)
      wear(inv, slot, name);
      this.note([`If you take off the ${lc(name)}, you’d have nowhere to carry it${slot === 'bag' ? ', and no free hand' : ''}.`]);
      return;
    }
    const sp = inv.spots.find((x) => x.id === it.spot);
    this.refresh();
    this.note([`You take off the ${lc(name)}${slot === 'top' ? ' and roll it up' : ''}, and carry it in your ${sp ? `${sp.on.toLowerCase()}, ${sp.name.toLowerCase()}` : 'hands'}.`]);
  }
  /** Put something back on (and what you had on there comes off, into your pockets). */
  private putOn(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it || it.kind !== 'wear' || !it.slot || !this.canOpenSheet) return;
    const slot = it.slot;
    inv.items.splice(i, 1);
    if (slot === 'head' || slot === 'face' || slot === 'eyes' || slot === 'hands') {
      const w = wearing(inv);
      const old = w[slot];
      w[slot] = it.name;
      if (slot === 'face') w.masked = false;
      if (old && !stow(inv, { kind: 'wear', name: old, slot })) {
        // (No room for the old one: back as you were.)
        w[slot] = old;
        inv.items.splice(i, 0, it);
        this.note([`You’d have nowhere to put the ${lc(old)}.`]);
        return;
      }
      this.refresh();
      this.note([`You put on the ${lc(it.name)}${old ? ` and put the ${lc(old)} away` : ''}.${slot === 'face' ? ' It’s pulled down for now.' : ''}`]);
      return;
    }
    // (What won't go in it: said first; a second tap goes ahead and leaves it.)
    const w = wouldLeave(inv, slot, it.name);
    const armed = this.armedWear?.id === `on:${it.name}` && performance.now() - this.armedWear.at > 450 && performance.now() - this.armedWear.at < 8000;
    if (!w.cash && w.items.length && !armed) {
      inv.items.splice(i, 0, it);
      this.armedWear = { id: `on:${it.name}`, at: performance.now() };
      this.note([`If you put on the ${lc(it.name)}, there’d be nowhere for ${list2(w.items.map((x) => `the ${lc(x.name)}`))}. Tap Put on again to leave ${w.items.length > 1 ? 'them' : 'it'} here.`]);
      return;
    }
    this.armedWear = null;
    const r = wear(inv, slot, it.name, true);
    if (!r.ok) {
      inv.items.splice(i, 0, it);
      this.note([`If you put on the ${lc(it.name)}, ${lc(r.why)}`]);
      return;
    }
    const leftLine = r.left.length ? ` You leave ${list2(r.left.map((x) => `the ${lc(x.name)}`))} behind.` : '';
    // (What you had on comes off: a T-shirt under a jacket stays on, of course.)
    if (r.old && !(slot === 'top' && /^t-shirt$/i.test(r.old)) && !stow(inv, { kind: 'wear', name: r.old, slot })) {
      // (Back as you were, with everything you had.)
      inv.items.push(...r.left);
      wear(inv, slot, r.old, true);
      inv.items.splice(i, 0, it);
      this.note([`You’d have nowhere to put the ${lc(r.old)}.`]);
      return;
    }
    this.refresh();
    this.note([`You put on the ${lc(it.name)}${r.old && !/^t-shirt$/i.test(r.old) ? ` and carry the ${lc(r.old)}` : ''}.${leftLine}`]);
  }
  private toggleCover(what: 'mask' | 'hood') {
    const inv = this.inventory;
    const w = wearing(inv);
    if (what === 'mask' && w.face) {
      if (!w.masked && this.inside && !this.privateSpace && this.place !== 'bank') {
        this.note([`Not in here. You’d be thrown out, or worse.`]);
        return;
      }
      w.masked = !w.masked;
      this.note([w.masked ? `You pull the ${w.face.toLowerCase()} up over your face.` : `You pull the ${w.face.toLowerCase()} down.`]);
    } else if (what === 'hood' && hasHood(inv)) {
      w.hood = !w.hood;
      this.note([w.hood ? 'You pull your hood up.' : 'You push your hood back.']);
    }
    const e = this.encounter;
    if (e) e.conspicuous = conspicuous(inv);
    this.refresh();
    buzz(5);
  }

  /** Why you can't burn something right now, or null. */
  private burnBlocked(): string | null {
    if (!this.flame()) return 'Nothing to light it';
    if (this.inside && !this.privateSpace) return 'Not in here';
    return null;
  }

  /**
   * Burn the evidence: a stolen ID or card, held in the lighter's flame until
   * the name's gone. Plastic curls and stinks. Rain makes it fiddly; in a
   * downpour it can take a few goes.
   */
  private burn(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const fire = this.flame();
    if (!it || !fire || this.burnBlocked()) return;
    const lines: string[] = [];
    const tries = { clear: 0, drizzle: 0.15, rain: 0.35, downpour: 0.6, flurries: 0.1, snow: 0.25, heavysnow: 0.45 }[this.weather.now];
    if (Math.random() < tries) {
      lines.push(`You crouch in a doorway and try to burn the ${lc(it.name)}, but the ${isSnow(this.weather.now) ? 'snow' : 'rain'} keeps killing the flame.`);
    } else {
      inv.items.splice(i, 1);
      const whose = it.detail ? it.detail.split(',')[0] : null;
      lines.push(
        it.kind === 'id'
          ? `You hold the ${lc(it.name)} over the flame. The plastic bubbles and blackens, and ${whose ? `${whose}’s face` : 'the face'} curls away to nothing. You drop what’s left down a drain.`
          : `You hold the ${lc(it.name)} in the flame until the chip pops and the numbers melt into a black, stinking lump. You flick it into the gutter.`,
      );
    }
    const out = this.useFlame(fire, 'burn');
    if (out) lines.push(out);
    this.refresh();
    this.note(lines);
    buzz(8);
  }

  /** Why you can't make a fire right now, or null. */
  private fireBlocked(): string | null {
    if (this.place !== 'street') return 'Not in here';
    if (!this.canLurk) return 'Not now';
    if (this.weather.now === 'downpour' || this.weather.now === 'heavysnow') return 'Too wet';
    return null;
  }

  /**
   * Make a fire with the lighter: some paper from your pockets for kindling
   * (or whatever trash is about), in an old drum or a doorway. Warms you
   * right through. Rain makes it hard to get going.
   */
  private fire(i: number) {
    const inv = this.inventory;
    const lighter = inv.items[i];
    if (!lighter || this.fireBlocked()) return;
    this.closeSheet();
    const paper = inv.items.findIndex((x) => x.kind === 'misc' && /receipt|note|transfer|slip/i.test(x.name));
    const lines: string[] = [];
    let kindling: string;
    if (paper >= 0) {
      kindling = `the ${lc(inv.items[paper].name)}`;
      inv.items.splice(paper, 1);
    } else if (Math.random() < 0.6) kindling = 'some cardboard from a dumpster';
    else {
      this.note(["You’ve got nothing to burn, and there’s nothing dry lying around. You need some paper."]);
      return;
    }
    const catches = { clear: 1, drizzle: 0.7, rain: 0.35, downpour: 0, flurries: 0.8, snow: 0.5, heavysnow: 0 }[this.weather.now];
    if (Math.random() >= catches) {
      lines.push(`You try to light ${kindling}, cupping it from the ${isSnow(this.weather.now) ? 'snow' : 'rain'}. It hisses and goes out.`);
    } else {
      const h = this.health;
      // (An hour by the fire: whoever was across the street is gone, and the moment's passed.)
      this.dropEncounter();
      this.unstick();
      lines.push(`You get a fire going in an old oil drum, with ${kindling} for kindling. You hold your hands over it until the feeling comes back.`);
      lines.push(...passHours(h, 1));
      if (h.dead) return this.die(lines);
      if (h.cold) lines.push("You’re warm again, right through.");
      h.cold = 0;
    }
    // Keeping a flame going long enough to catch takes a lot of fuel.
    const out = this.useFlame(lighter, 'fire');
    if (out) lines.push(out);
    this.refresh();
    this.note(lines);
    buzz(10);
  }

  /** Find out what the powder is: taste it, or test it with a kit. */
  private identify(i: number, kit: boolean) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it?.secret || it.known) return;
    let line: string;
    if (it.secret !== 'cocaine') {
      // A syringe: only the kit can tell you.
      const k = inv.items.findIndex((x) => x.med === 'testkit');
      if (!kit || k < 0 || it.secret === 'empty') return;
      inv.items.splice(k, 1);
      const what = DRUG_TEST[it.secret];
      it.known = true;
      it.name = `Syringe of ${what.name}`;
      it.detail = what.name[0].toUpperCase() + what.name.slice(1);
      this.refresh();
      this.note([`You squeeze a drop from the needle into the vial and shake it. ${what.line}`]);
      buzz(8);
      return;
    }
    if (kit) {
      const k = inv.items.findIndex((x) => x.med === 'testkit');
      if (k < 0) return;
      inv.items.splice(k, 1);
      line = 'You tip a few grains into the vial and shake it. The liquid turns a bright, clear blue: cocaine.';
    } else {
      line = 'You rub a little on your gums. They go numb almost at once, and there’s a bitter taste at the back of your throat. Cocaine.';
    }
    it.known = true;
    it.name = 'Baggie of cocaine';
    it.detail = undefined;
    this.refresh();
    this.note([line]);
    buzz(8);
  }

  /** Why you can't inject right now, or null. */
  private injectBlocked(): string | null {
    if (!this.canOpenSheet) return 'Not now';
    if (this.inside && !this.privateSpace) return 'Not in here';
    const h = this.health;
    if (h.high && (h.highUntil ?? 0) > now()) return 'Still high';
    return null;
  }

  /**
   * Shooting up whatever's in the syringe (you may not know what it is).
   * Heroin: calm, no stress, slow in the next fights for a couple of hours,
   * and a small chance of overdose. Fentanyl: the same, far stronger, and an
   * overdose that can kill. Meth: wired for the next fight, harder hitting,
   * and on edge. Tranq: you're out for hours, wherever you are.
   */
  private inject(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const h = this.health;
    if (!it?.secret || it.secret === 'cocaine' || it.secret === 'empty' || this.injectBlocked()) return;
    const drug = it.secret;
    const knew = it.known;
    this.closeSheet();
    // The syringe is spent: still a needle, still sharp.
    it.secret = 'empty';
    it.known = true;
    it.name = 'Syringe';
    it.detail = 'Empty. Used.';
    const lines: string[] = [knew ? `You find a vein and push the ${DRUG_TEST[drug].name} in.` : 'You find a vein and push the plunger, not knowing what goes in.'];
    useHabit(h, drug === 'meth' ? 'stimulants' : drug === 'tranq' ? 'sedatives' : 'opioids', drug === 'fentanyl' ? 20 : drug === 'heroin' ? 15 : drug === 'meth' ? 12 : 10);
    const onTranq = h.high === 'tranq' && (h.highUntil ?? 0) > now();
    const od = (chance: number, deadly: number): boolean => {
      // Drink or a downer on top, and the odds get worse.
      const mix = 1 + (h.drunk ?? 0) / 60 + (onTranq ? 0.6 : 0);
      if (Math.random() >= chance * mix) return false;
      deadly = Math.min(0.9, deadly * mix);
      if (Math.random() < deadly) {
        lines.push('Your breathing slows. Slower. Then it stops, and nobody comes.');
        this.die(lines, 'You overdosed.');
        return true;
      }
      lines.push('Your breathing slows to almost nothing, and the world goes out.');
      // (Hours out: whoever was lying here is long gone.)
      this.dropEncounter();
      this.unstick();
      lines.push(...passHours(h, 4));
      if (h.dead) {
        this.die(lines);
        return true;
      }
      lines.push('You come to on the sidewalk hours later, soaked in sweat and shaking, sick to your stomach. You nearly died.');
      return true;
    };
    if (drug === 'heroin') {
      lines.push('Warmth floods up your arm and all through you. The stress melts away. Your eyelids are heavy.');
      h.stress = 0;
      h.high = 'heroin';
      h.highUntil = now() + HIGH_HOURS.heroin * 3_600_000;
      if (od(0.05, 0.12)) {
        if (h.dead) return;
      }
    } else if (drug === 'fentanyl') {
      lines.push('It hits like a wall, all at once. Nothing hurts. Nothing matters. It’s very hard to breathe.');
      h.stress = 0;
      h.high = 'fentanyl';
      h.highUntil = now() + HIGH_HOURS.fentanyl * 3_600_000;
      if (od(0.3, 0.35) && h.dead) return;
      if (this.health.dead) return;
    } else if (drug === 'meth') {
      lines.push('Your heart slams. Your jaw locks tight. Everything is fast and bright and loud, and you could fight anyone.');
      h.wired = true;
      h.wiredBy = 'meth';
      h.wiredUntil = now() + HIGH_HOURS.meth * 3_600_000;
      h.high = 'meth';
      h.highUntil = now() + HIGH_HOURS.meth * 3_600_000;
      h.stress = Math.min(100, (h.stress ?? 0) + 15);
    } else {
      lines.push("A heavy, sick drowsiness pulls you down before you can get the needle out. You’re out where you sit.");
      // (Hours out: whoever was lying here is long gone.)
      this.dropEncounter();
      this.unstick();
      lines.push(...passHours(h, 4));
      if (h.dead) return this.die(lines);
      lines.push('You wake hours later, your skin crawling, with no idea how long you were gone.');
      // Groggy for a while after.
      h.high = 'tranq';
      h.highUntil = now() + HIGH_HOURS.tranq * 3_600_000;
    }
    if (!knew) lines.push(`It was ${DRUG_TEST[drug].name}.`);
    if (this.dead) return;
    this.refresh();
    this.note(lines);
    buzz([20, 40, 20]);
  }

  /** A bump of coke: you're wired for the next fight (more stamina, less pain). */
  /** Carrying like a dealer: several bags, or bags and the zip bags to make more. */
  private intent(items = this.inventory.items): boolean {
    const coke = items.filter((x) => x.secret === 'cocaine');
    const bags = coke.length;
    // (Pills in their own prescription bottle, and only that: a few is just a prescription.)
    // By weight: more than an eighth of anything hard, or an ounce of weed, isn't for yourself. (Pills: a bottle's worth.)
    const by = (p: Product) => coke.filter((x) => productOf(x) === p).reduce((n, x) => n + (x.doses ?? 0), 0);
    const heavy = by('powder') > 35 || by('crack') > 35 || by('crystal') > 35 || by('heroin') > 35 || by('weed') > 280 || by('pills') > 40;
    return heavy || bags >= 3 || (bags > 0 && items.some((x) => x.name === 'Zip bags'));
  }
  /** What they book you on for what you're carrying: weed alone is lighter. */
  private drugCharge(items = this.inventory.items): string {
    const drugs = items.filter((x) => x.secret && x.secret !== 'empty');
    const weedOnly = drugs.length > 0 && drugs.every((x) => productOf(x) === 'weed');
    const intent = this.intent(items);
    return weedOnly ? (intent ? 'Possession of marijuana with intent to distribute' : 'Possession of marijuana') : intent ? 'Possession with intent to distribute' : 'Possession of a controlled substance';
  }

  /** A deal, settled: the bag out of your pocket, their money into yours (or the police). */
  private settleDeal(e: Encounter) {
    const d = e.deal;
    if (!d || d.done) return;
    d.done = true;
    const f = this.infamy;
    // Selling trains your tongue; selling without drawing eyes trains you to keep it quiet.
    train(this.stats, 'speech', d.kind === 'sold' ? 3 : 1);
    if (d.kind === 'no') {
      if (d.reported) this.reportedHeat(6, e.seenAs?.anon, { sev: 3 });
      return;
    }
    const inv = this.inventory;
    const key = e.sale?.key ?? 'powder';
    const unit = this.takeAmount(key, e.sale?.units ?? 1);
    if (!unit) return;
    // Weighed out into baggies, one a bag, as you hand it over (pills straight from the bottle).
    let bagsLeft = keyProduct(key) === 'pills' ? 0 : (e.sale?.bags ?? 1);
    for (const z of inv.items.filter((x) => x.name === 'Zip bags')) {
      const t = Math.min(bagsLeft, z.doses ?? 0);
      z.doses = (z.doses ?? 0) - t;
      bagsLeft -= t;
    }
    inv.items = inv.items.filter((x) => x.name !== 'Zip bags' || (x.doses ?? 0) > 0);
    if (unit.emptied) (e.log ??= []).push({ by: 'info', text: 'The bag’s empty.' });
    if (d.kind === 'snatched') {
      // In their fist as they run: catch them, and it's yours again.
      e.person.clothes[0]?.loot.push({ kind: 'misc', name: unit.name, detail: 'Yours: they snatched it', secret: 'cocaine', known: true, doses: e.sale?.units ?? 1, product: unit.product, ...(unit.pill ? { pill: unit.pill } : {}), quality: unit.quality, ...(unit.pressed ? { pressed: true } : {}), where: 'clenched in their fist', yours: true });
      return;
    }
    // Their money, out of their pockets and into yours.
    // (A cop pays with a marked twenty from the department, not their own pocket.)
    if (d.kind === 'sting') {
      const notIn = cents(pocketCash(inv, fewest(d.price)));
      this.save.state.policeStop = 'sting';
      this.save.state.stingCash = d.price - notIn;
      return;
    }
    let need = d.price;
    let got = 0;
    for (const g of e.person.clothes)
      for (const l of [...g.loot]) {
        if (need <= 0 || l.kind !== 'cash') continue;
        const have = Math.round((l.cash ?? 0) * 100);
        const take = Math.min(have, need);
        need -= take;
        got += take;
        const left = have - take;
        if (left > 0) {
          l.cash = left / 100;
          l.purse = fewest(left);
        } else g.loot.splice(g.loot.indexOf(l), 1);
      }
    // (What you've no room for, they keep: they put it back in their pocket.)
    const back = cents(pocketCash(inv, cashLike(got, 'small')));
    if (back) {
      e.person.clothes[0]?.loot.push({ kind: 'cash', name: 'Cash', cash: back / 100, where: 'pocket' });
      (e.log ??= []).push({ by: 'info', text: `You’ve no room on you for ${money(back)} of it. They shrug and put it back in their pocket.` });
    }
    // Word gets around: to buyers, and to the police (more with people watching; less, the quieter you keep it: Sneak).
    // (The more of a name you have, the more they're watching for you.)
    f.rep += 1;
    this.reportedHeat((2 + this.crowd.length * 2 + this.standing * 0.5) * (1 - this.quiet), e.seenAs?.anon, { sev: 5 });
    if (this.crowd.length) (e.log ??= []).push({ by: 'info', text: 'Somebody on the street saw the hand-off.' });
    // More of it on this corner: flood it, and the price round here drops.
    // (By what changed hands, not by weight: an eighth of weed floods it no faster than half a gram of powder.)
    // (About a bag's worth of local supply for every $50 sold: a flooded corner gets cheaper.)
    addLocalSupply(this.market, key, d.price / 5000, this.cornerDistrict);
    // Pressed pills: nobody knows what's in them. Some don't wake up.
    if (unit.pressed && Math.random() < 0.06) e.odLater = true;
    if (!this.crowd.length) train(this.stats, 'sneak', 2);
    this.save.state.sales = ((this.save.state.sales as number) ?? 0) + 1;
    // A regular who likes you: where to get more.
    if (!this.connect.known && e.regular && Math.random() < 0.35) {
      (e.log ??= []).push({ by: 'them', text: '“You’re gonna run out, way you’re going. Talk to Dez. The alley behind the laundromat. Say I sent you.”' });
      for (const l of this.learnConnect(e.person.name ?? 'a regular')) e.log.push({ by: 'info', text: l });
    } else if (this.connect.known) {
      // (Moving his product without trouble: it gets back to him.)
      if (((this.save.state.sales as number) ?? 0) % 5 === 0) {
        const t = this.trustDez(4);
        if (t) (e.log ??= []).push({ by: 'info', text: t });
      }
    }
  }

  /** The bag size you sell that in (tenths of a gram; pills counted). */
  private sellSize(p: Product): number {
    const set = (this.save.state.sellSize as Partial<Record<Product, number>> | undefined)?.[p];
    const [def, min, max] = SELL_SIZE[p];
    return Math.max(min, Math.min(max, set ?? def));
  }
  /** A step up or down in the size you sell in. */
  private stepSellSize(arg: string) {
    const [p, dir] = arg.split(':') as [Product, string];
    if (!(p in SELL_SIZE)) return;
    const [, min, max, step] = SELL_SIZE[p];
    const at = (this.save.state.sellSize ??= {}) as Partial<Record<Product, number>>;
    at[p] = Math.max(min, Math.min(max, this.sellSize(p) + Number(dir) * step));
    this.refresh();
  }
  /**
   * Old saves: product already split into little bags (a point each) goes back
   * in one lot, by weight, and the baggies come back empty.
   */
  private unbag() {
    const inv = this.inventory;
    const names = new Set(Object.values(PRODUCTS).map((x) => x.bag?.name).filter(Boolean) as string[]);
    // (Only genuinely old ones, bagged before product went by weight: never a bag you found on someone.)
    const bagged = inv.items.filter((x) => x.secret === 'cocaine' && x.known && names.has(x.name) && x.doses === 1 && !x.product && /bagged to sell/i.test(x.detail ?? ''));
    if (bagged.length < 1) return;
    const groups = new Map<Product, typeof bagged>();
    for (const x of bagged) {
      const p = productOf(x) ?? 'powder';
      groups.set(p, [...(groups.get(p) ?? []), x]);
    }
    for (const [p, xs] of groups) {
      const amt = xs.reduce((n, x) => n + (x.doses ?? 0), 0);
      const q = Math.round(xs.reduce((n, x) => n + qualityOf(x), 0) / xs.length);
      const keep = xs[0];
      Object.assign(keep, { name: PRODUCTS[p as Product].name, detail: 'Loose, in one bag', doses: amt, quality: q, product: p as Product });
      keep.kg = measure(keep).kg;
      inv.items = inv.items.filter((x) => !xs.includes(x) || x === keep);
    }
    const zip = inv.items.find((x) => x.name === 'Zip bags');
    if (zip) zip.doses = (zip.doses ?? 0) + bagged.length;
    else stow(inv, { kind: 'misc', name: 'Zip bags', doses: bagged.length });
  }
  /** Your product of that kind, the weakest first (that's what goes out first). */
  private productItems(key: MarketKey) {
    return this.inventory.items.filter((x) => x.secret === 'cocaine' && x.known && keyOf(x) === key && (x.doses ?? 0) > 0).sort((a, b) => qualityOf(a) - qualityOf(b));
  }
  /** How good that amount would be, taken weakest first. */
  private qualityFor(key: MarketKey, amt: number): number {
    let left = amt;
    let sum = 0;
    for (const x of this.productItems(key)) {
      const t = Math.min(left, x.doses ?? 0);
      sum += t * qualityOf(x);
      left -= t;
      if (left <= 0) break;
    }
    return Math.round(sum / Math.max(1, amt - Math.max(0, left)));
  }
  /** That amount out of your pockets (by weight; pills counted), from as many bags as it takes, the weakest first. */
  private takeAmount(key: MarketKey, amt: number): { emptied: boolean; name: string; product: Product; pill?: PillKind; quality: number; pressed?: boolean } | null {
    const inv = this.inventory;
    const xs = this.productItems(key);
    if (xs.reduce((n, x) => n + (x.doses ?? 0), 0) < amt) return null;
    const p = productOf(xs[0])!;
    const quality = this.qualityFor(key, amt);
    let left = amt;
    let pressed = false;
    let emptied = false;
    for (const x of xs) {
      if (left <= 0) break;
      const t = Math.min(left, x.doses ?? 0);
      x.doses = (x.doses ?? 0) - t;
      left -= t;
      if (x.pressed) pressed = true;
      if ((x.doses ?? 0) <= 0) {
        inv.items.splice(inv.items.indexOf(x), 1);
        emptied = true;
      }
    }
    return { emptied, name: p === 'pills' ? 'Pills' : (PRODUCTS[p].bag?.name ?? 'Small baggie'), product: p, ...(xs[0].pill ? { pill: xs[0].pill } : {}), quality, ...(pressed ? { pressed: true } : {}) };
  }
  /** After a sale: what the buyer remembers of you as a dealer, and what that does. */
  private customerBought(k: Known, e: Encounter, wasCustomer: boolean) {
    const f = this.infamy;
    const mem = k.memory;
    const sale = e.sale;
    // Sold them something that killed them: it gets around.
    if (e.odLater) {
      const i = this.people.indexOf(k);
      if (i >= 0) this.people.splice(i, 1);
      f.heat = Math.min(100, f.heat + 12);
      f.rep -= 3;
      this.later([`Word on the street: someone overdosed on blues last night. People are saying where they got them.`]);
      return;
    }
    if (e.deal?.kind === 'sold' && sale) {
      mem.usual = sale.key;
      mem.usualBags = sale.bags ?? 1;
      mem.lastBuy = now();
      mem.buys = (mem.buys ?? 0) + 1;
      mem.returnH = returnHours(sale.key, sale.q);
      mem.sat = (mem.sat ?? 0) + (sale.q >= 70 ? 1 : sale.q < 45 ? -1 : 0);
      // (Burned once, they don't come back to being a regular.)
      if (mem.burned) delete mem.customer;
      // Good stuff: they tell people. Garbage: they tell people that too.
      if (sale.q >= 70) f.rep += 1;
      if ((mem.sat ?? 0) <= -2) {
        delete mem.customer;
        mem.burned = true;
        f.rep -= 2;
        if (Math.random() < 0.3) {
          mem.snitch = true;
          f.heat = Math.min(100, f.heat + 8);
        }
      }
    }
    // Hurt or robbed a regular: you're not their dealer any more, and some of them talk.
    if (wasCustomer && !mem.customer && !mem.burned) {
      mem.burned = true;
      if (Math.random() < 0.25) {
        mem.snitch = true;
        f.heat = Math.min(100, f.heat + 6);
      }
    }
  }
  /** A package in a line: “Powder · 20 g package · 12.5 g left · Decent”. */
  private packageLine(x: InvItem): string {
    const p = productOf(x) ?? 'powder';
    return `${x.pill ? PILLS[x.pill].street : PRODUCTS[p].name} · ${x.pkg && x.pkg !== x.doses ? `${pkgAmount(p, x.pkg)} package · ${amountText(p, x.doses ?? 0)} left` : x.pkg ? `${pkgAmount(p, x.pkg)} package` : amountText(p, x.doses ?? 0)} · ${qualityWord(qualityOf(x))}${x.pressed ? ' · pressed' : ''}`;
  }
  /** What's to hand in your room: on you, or left in it. */
  private inRoom(): { x: InvItem; where: 'inv' | 'room'; i: number }[] {
    const r = this.room;
    return [...this.inventory.items.map((x, i) => ({ x, where: 'inv' as const, i })), ...(r && this.inOwnRoom ? r.items.map((x, i) => ({ x, where: 'room' as const, i })) : [])];
  }
  /** What's missing to cut it (nothing: it can be done). */
  private cutWhy(add: number, it?: InvItem): string | null {
    // (Once per package, and never so weak people will notice.)
    if (it?.cut) return 'Already cut once';
    if (it && qualityOf(it) < 30) return 'Too weak to cut';
    const all = this.inRoom();
    if (!all.some(({ x }) => /^digital scale$/i.test(x.name))) return 'No scale';
    if (!all.some(({ x }) => /^cutting kit$/i.test(x.name))) return 'No cutting kit';
    if (all.filter(({ x }) => x.name === 'Lactose powder').reduce((n, { x }) => n + (x.doses ?? 0), 0) < add) return 'No lactose';
    return null;
  }
  /** Cutting it, in your room with the door locked: a quarter as much again in lactose; each gram weaker. */
  private cutPkg(arg: string) {
    if (!this.inOwnRoom) return;
    const [where, n] = arg.split(':');
    const it = (where === 'room' ? this.room?.items : this.inventory.items)?.[Number(n)];
    const prod = it ? productOf(it) : null;
    if (!it || !prod || !PRODUCTS[prod].cuts || !it.known || (it.doses ?? 0) < 2) return;
    const was = it.doses ?? 0;
    const add = Math.max(1, Math.round(was * 0.25));
    const why = this.cutWhy(add, it);
    if (why) {
      if (why === 'Already cut once') this.note(['You’ve cut this one already. Any more and it’s not worth selling.']);
      else if (why === 'Too weak to cut') this.note(['It won’t take any more. People are going to notice.']);
      return;
    }
    let need = add;
    for (const { x } of this.inRoom().filter(({ x }) => x.name === 'Lactose powder')) {
      const t = Math.min(need, x.doses ?? 0);
      x.doses = (x.doses ?? 0) - t;
      need -= t;
    }
    this.inventory.items = this.inventory.items.filter((x) => x.name !== 'Lactose powder' || (x.doses ?? 0) > 0);
    if (this.room) this.room.items = this.room.items.filter((x) => x.name !== 'Lactose powder' || (x.doses ?? 0) > 0);
    const q = qualityOf(it);
    it.doses = was + add;
    it.pkg = it.doses;
    it.quality = Math.max(5, Math.round((q * was) / (was + add)));
    it.cut = true;
    // (Bigger now: it may not go where it was. Somewhere it fits, or it stays in the room.)
    Object.assign(it, measure(it));
    if (where === 'inv') {
      const inv = this.inventory;
      const sp = inv.spots.find((s) => s.id === it.spot);
      const rest = { ...inv, items: inv.items.filter((y) => y !== it) };
      if (!sp || !fitsIn(sp, it) || SIZE_RANK[sp.fits] < SIZE_RANK[it.size] || usedKg(rest, sp.id) + it.kg > sp.maxKg + 1e-9) {
        const to = findRoom(rest, it.size, it.kg, it);
        if (to) it.spot = to.id;
        else {
          // (Nowhere on you for it now: it stays on the table, in the room.)
          inv.items = inv.items.filter((y) => y !== it);
          if (this.room) this.room.items.push(it);
        }
      }
    }
    this.refresh();
    this.note([`You lock the door, lay it out on the plate and work the lactose through with the card. ${amountText(prod, was)} becomes ${amountText(prod, it.doses)}. ${qualityWord(q)} before; ${qualityWord(it.quality).toLowerCase()} now.${it.quality < 40 ? ' People are going to notice.' : ''}`]);
  }
  /**
   * The business, at the table in your room: your packages (here and on you)
   * with the bag size you sell each in, cutting, and moving them between you
   * and the room; the gear; the street; your customers.
   */
  private businessHtml(btn: (attr: string, v: string, label: string, no?: string | false) => string, li: (name: string, small: string, button: string) => string): string {
    const all = this.inRoom();
    const pk = all.filter(({ x }) => x.secret === 'cocaine' && x.known && productOf(x));
    const prods = [...new Set(pk.map(({ x }) => productOf(x)!))];
    const sizes = prods
      .map((p) => {
        const sz = this.sellSize(p);
        // (− size +: the same two buttons every time, greyed at the ends.)
        const step = (d: number, label: string, off: boolean, why: string) => `<button type="button" class="sz-step" data-sellsz="${p}:${d}" ${off ? `disabled title="${why}" aria-label="${why}"` : `aria-label="${d < 0 ? 'Smaller' : 'Bigger'} bags"`}>${label}</button>`;
        return li(`Sell ${PRODUCTS[p].name.toLowerCase()} in`, 'Bags of this much. Buyers ask for one, sometimes two or three.', `<span class="sz-stepper">${step(-1, '−', sz <= SELL_SIZE[p][1], 'Smallest')}<b class="sz-now">${amountText(p, sz)}</b>${step(1, '+', sz >= SELL_SIZE[p][2], 'Biggest')}</span>`);
      })
      .join('');
    const prod = pk
      .map(({ x, where, i }) => li(x.name, `${this.packageLine(x)} · ${where === 'room' ? 'In the room' : 'On you'}`, where === 'room' ? btn('unstash', `room:${i}`, 'Take') : btn('stash', String(i), 'Leave it here')))
      .join('');
    const count = (re: RegExp) => all.filter(({ x }) => re.test(x.name)).reduce((n, { x }) => n + (x.doses ?? 1), 0);
    const gear =
      li('Digital scale', count(/^digital scale$/i) ? 'On the table.' : 'You haven’t got one.', '') +
      li('Cutting kit', count(/^cutting kit$/i) ? 'On the table.' : 'You haven’t got one.', '') +
      li('Lactose', count(/^lactose powder$/i) ? `${amountText('powder', count(/^lactose powder$/i))} left.` : 'None.', '') +
      li('Zip bags', count(/^zip bags$/i) ? `${count(/^zip bags$/i)} empty bag${count(/^zip bags$/i) === 1 ? '' : 's'}.` : 'None: you need one for each bag you sell (pills go from the bottle). The gas station has them.', '');
    return (
      `<ul class="shop-list">${li('Your business', 'Room 14, the table by the window, the door locked.', btn('room', 'back', 'Back to the room'))}</ul>` +
      `<h3>Product</h3><ul class="shop-list">${prod || li('Nothing here', 'Buy from Dez in the alley.', '')}${sizes}</ul>` +
      this.cutHtml(btn, li) +
      `<h3>Gear</h3><ul class="shop-list">${gear}</ul>` +
      this.marketHtml(true) +
      this.customersHtml()
    );
  }
  /** The room's table: what you could cut, and the gear for it (or have it brought up). */
  private cutHtml(btn: (attr: string, v: string, label: string, no?: string | false) => string, li: (name: string, small: string, button: string) => string): string {
    const all = this.inRoom();
    const c = Math.round(cashOf(this.inventory) * 100);
    const pk = all.filter(({ x }) => x.secret === 'cocaine' && x.known && productOf(x) && PRODUCTS[productOf(x)!].cuts && (x.doses ?? 0) >= 2);
    let rows = pk
      .map(({ x, where, i }) => {
        const p = productOf(x)!;
        const add = Math.max(1, Math.round((x.doses ?? 0) * 0.25));
        return li(x.name, `${PRODUCTS[p].name} · ${amountText(p, x.doses ?? 0)} · ${qualityWord(qualityOf(x))} · ${where === 'room' ? 'In the room' : 'On you'}. Takes ${amountText(p, add)} of lactose.`, btn('cutpkg', `${where}:${i}`, 'Cut', this.cutWhy(add, x) ?? false));
      })
      .join('');
    if (!pk.length) rows = li('Nothing to cut', 'Powder, crystal or heroin: bring it up, or leave it here.', '');
    const has = (re: RegExp) => all.some(({ x }) => re.test(x.name));
    const order = (id: string, name: string, price: number, why: string) => li(`${name}, brought up`, why, btn('room', `order:${id}`, money(price * 100), c < price * 100 && 'Not enough cash'));
    const orders =
      (!has(/^digital scale$/i) ? order('scale', 'A digital scale', 35, 'The night man knows a guy. It’s on the table in ten minutes, and costs you ten more than the pawn shop.') : '') +
      (!has(/^cutting kit$/i) ? order('cutkit', 'A cutting kit', 22, 'A plate, a card, a sifter. Ten more than the pawn shop, and no walking.') : '') +
      order('lactose', 'A tub of lactose', 16, '100 g, from the all-night place. Ten more than the gas station.');
    return `<h3>Cut product</h3><ul class="shop-list">${rows}${orders}</ul>`;
  }
  /** Splitting powder into little bags to sell, a point in each. */
  private bagUp(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const zip = inv.items.find((y) => y.name === 'Zip bags' && (y.doses ?? 0) > 0);
    const prod = it ? productOf(it) : null;
    const bagged = prod ? PRODUCTS[prod].bag : undefined;
    if (!it || it.secret !== 'cocaine' || !it.known || !bagged || (it.doses ?? 0) < 2 || !zip || !this.canOpenSheet) return;
    if (this.inside && !this.privateSpace) {
      this.note(['Not in here. Not with someone behind the counter watching.']);
      return;
    }
    const n = Math.min(it.doses ?? 0, zip.doses ?? 0);
    let made = 0;
    for (let k = 0; k < n; k++) {
      if (!stow(inv, { kind: 'misc', name: bagged.name, detail: bagged.detail, secret: 'cocaine', known: true, doses: 1, product: prod!, quality: qualityOf(it) })) break;
      made++;
    }
    it.doses = (it.doses ?? 0) - made;
    zip.doses = (zip.doses ?? 0) - made;
    inv.items = inv.items.filter((x) => (x !== it || (it.doses ?? 0) > 0) && (x !== zip || (zip.doses ?? 0) > 0));
    this.refresh();
    this.note([
      made
        ? `${this.place === 'room' ? 'At the little table by the window' : 'Hunched in a doorway'}, you tip it out and split it into ${made} ${made === 1 ? PRODUCTS[prod!].unit.replace(/^an? /, '') : PRODUCTS[prod!].units}.${made < n ? ' You run out of room for the rest.' : ''}`
        : "You’ve got nowhere to put the bags.",
    ]);
  }

  /**
   * What you owe Dez, if anything: how much, when it was due, and how often
   * you've beaten the people he sent. Late, it grows a fifth a day (the vig).
   */
  private get debt(): { owed: number; base?: number; due: number; vigAt?: number; strikes?: number; vigDays?: number } | undefined {
    const d = this.save.state.debt as { owed: number; base?: number; due: number; vigAt?: number; strikes?: number; vigDays?: number } | undefined;
    if (!d) return undefined;
    const t = now();
    if (t > d.due) {
      const from = Math.max(d.due, d.vigAt ?? d.due);
      const days = Math.floor((t - from) / 86_400_000);
      if (days > 0) {
        // The vig runs two weeks; after that it's not about the money any more (that's what the big man is for).
        const add = Math.max(0, Math.min(days, VIG_DAYS - (d.vigDays ?? 0)));
        d.owed = Math.round(d.owed * Math.pow(1.2, add));
        d.vigDays = (d.vigDays ?? 0) + add;
        d.vigAt = from + days * 86_400_000;
      }
    }
    // (A debt that ran away before the vig stopped: no more than two weeks of it.)
    d.owed = Math.min(d.owed, Math.round((d.base ?? DEZ_FRONT * 100) * Math.pow(1.2, VIG_DAYS)));
    return d;
  }

  /**
   * Your connection: whether Dez will deal with you at all (someone has to
   * vouch for you), and how far he trusts you. Trust buys bigger amounts and
   * better prices; lose it and he cuts you off.
   */
  private get connect(): Connect {
    const st = this.save.state;
    // (From before there were introductions: you'd dealt with him already.)
    return (st.connect ??= { known: ((st.sales as number) ?? 0) >= 1 || !!st.debt, trust: 0 }) as Connect;
  }
  /** The city's drug market (the same for every life: the street goes on). */
  private get market(): Market {
    return (this.save.state.market ??= newMarket()) as Market;
  }
  /**
   * Heat for something you did that someone reports: less the less of you they
   * could see. And they've a description now: how you looked, to match you by.
   */
  /**
   * Something you did, gone to the police. Seen with your face showing (or your
   * prints, your ID, a victim who knows you): it's on you, and something
   * serious puts a warrant in your name. With your face covered they've only a
   * description, with its own heat: change how you look and it's not you.
   */
  private reportedHeat(amount: number, anon = anonymity(this.inventory), o: { sev?: number; charges?: string[]; floor?: number; identified?: boolean } = {}) {
    const f = this.infamy;
    const inv = this.inventory;
    const known = o.identified ?? anon < 0.5;
    if (known) {
      f.heat = heatGain(f.heat, amount * (1 - anon * 0.7), o.sev ?? 3);
      f.lastLook = { clothes: lookClothes(inv).join('|'), covered: anon >= 0.5, at: now() };
      if (o.charges?.length) this.warrantFor(o.charges, o.floor ?? 40);
    } else {
      const d = (f.desc ??= { text: describe(inv), clothes: lookClothes(inv).join('|'), heat: 0, at: now() });
      d.text = describe(inv);
      d.clothes = lookClothes(inv).join('|');
      d.at = now();
      d.heat = heatGain(d.heat, amount, o.sev ?? 3);
    }
  }
  /**
   * A camera saw it: a few hours later someone pulls the footage. Your face on
   * it, a warrant in your name; covered, a description of someone.
   */
  private footage(place: string, charges: string[], sev: number, camAnon: number) {
    const list = ((this.save.state.footage as Footage[] | undefined) ??= []);
    list.push({ at: now() + (3 + Math.random() * 5) * 3_600_000, place, charges, sev, face: camAnon < 0.5, look: describe(this.inventory), clothes: lookClothes(this.inventory).join('|') });
    while (list.length > 12) list.shift();
  }
  /** Footage whose time has come: what it shows, and what that means for you. */
  private reviewFootage() {
    const list = this.save.state.footage as Footage[] | undefined;
    if (!list?.length) return;
    // (In custody or waiting on bail: it keeps till you're out, or the warrant would vanish with the case.)
    if ((this.jail && this.jail.until > now()) || this.save.state.bailOffer || this.save.state.policeStop) return;
    const t = now();
    const due = list.filter((x) => x.at <= t);
    if (!due.length) return;
    this.save.state.footage = list.filter((x) => x.at > t);
    const f = this.infamy;
    const lines: string[] = [];
    for (const x of due) {
      const where = PLACE_NAMES[x.place] ?? 'the store';
      if (x.face) {
        f.heat = heatGain(f.heat, 8 + x.sev, x.sev);
        this.warrantFor(x.charges, x.sev >= 9 ? 60 : 40);
        lines.push(`They pulled the footage from ${where}. Your face is on it: there’s a warrant out for you now.`);
      } else {
        const d = (f.desc ??= { text: x.look, clothes: x.clothes, heat: 0, at: t });
        d.text = x.look;
        d.clothes = x.clothes;
        d.at = t;
        d.heat = heatGain(d.heat, 8 + x.sev, x.sev);
        lines.push(`They pulled the footage from ${where}: ${x.look}, face covered. They’re looking for that.`);
      }
    }
    this.later(lines);
  }
  /** Do you look like the description they have of a masked stranger? */
  private get looksLikeStranger(): boolean {
    const d = this.infamy.desc;
    return !!d && lookClothes(this.inventory).join('|') === d.clothes;
  }
  /** Do you still look like the description they have? (Changed clothes, or face covered now.) */
  private get looksLikeDescription(): boolean {
    const l = this.infamy.lastLook;
    if (!l) return true;
    const anon = anonymity(this.inventory);
    return lookClothes(this.inventory).join('|') === l.clothes && (anon >= 0.5) === l.covered;
  }
  /** How likely a patrol stops you on a lurk right now (wanted, and showing a weapon). */
  private patrolOdds(): { wanted: number; shows: number } {
    const heat = this.infamy.heat;
    const anon = anonymity(this.inventory);
    // (They know your face: covered, they can't pick you out. A description: only if you still look like it. A face covering that screams trouble: more stops.)
    const desc = this.infamy.desc;
    const wanted = Math.min(
      0.45,
      (heat >= 10 ? Math.min(0.35, heat / 230) * (this.looksLikeDescription ? 1 : 0.4) * (1 - anon * 0.8) : 0) +
        (desc && this.looksLikeStranger ? Math.min(0.25, desc.heat / 300) : 0) +
        (veryConspicuous(this.inventory) ? 0.08 : conspicuous(this.inventory) ? 0.03 : 0),
    );
    const shows = exposure(this.inventory);
    // (More patrols downtown; fewer in Southside, and in a bar.)
    const cops = this.place === 'street' ? this.cornerFeel.police : 1;
    return { wanted: Math.min(0.5, wanted * cops), shows: shows > 0.15 ? shows * 0.08 * cops : 0 };
  }
  /** Your regulars: people who buy from you and haven't been burned. */
  private get regulars() {
    return this.people.filter((k) => k.memory.customer && !k.memory.otherLife);
  }
  private get standingPoints(): number {
    return standingScore((this.save.state.sales as number) ?? 0, this.regulars.length, this.infamy.rep);
  }
  /** How far up you are as a dealer (0 nobody .. 3 supplier). */
  private get standing(): number {
    return standingOf(this.standingPoints);
  }
  private get tier(): 1 | 2 | 3 {
    const t = this.connect.trust;
    return t >= 70 ? 3 : t >= 30 ? 2 : 1;
  }
  /** Trust up or down; too low and he's done with you. Returns a line to say, if there is one. */
  private trustDez(n: number): string | null {
    const c = this.connect;
    if (!c.known) return null;
    const was = this.tier;
    c.trust = Math.max(-40, Math.min(100, c.trust + n));
    if (c.trust <= -20) {
      c.known = false;
      c.trust = 0;
      c.cutOff = now();
      return 'Word comes back from the alley: Dez is done with you. You’d need someone to vouch for you all over again.';
    }
    const t = this.tier;
    if (t > was) return t === 3 ? 'Dez trusts you now, as much as he trusts anyone. There’s someone he wants you to meet.' : 'Dez is starting to trust you. Better prices, and more if you want it.';
    if (t < was) return 'Dez doesn’t trust you like he did.';
    return null;
  }
  /** Learning who supplies: a name, and where (once). */
  private learnConnect(via: string): string[] {
    const c = this.connect;
    if (c.known) return [];
    c.known = true;
    c.via = via;
    c.trust = 0;
    return ['You know a supplier now: Dez, in the alley behind the laundromat (Go: The alley).'];
  }
  /** Asking someone on the street if they know anyone selling. */
  private askConnect(e: Encounter) {
    (e.asked ??= []).push('connect');
    const k = e.person.kind;
    const talk = lieBonus(this.stats);
    const odds = Math.max(0.03, Math.min(0.85, ({ junkie: 0.5, homeless: 0.3, drunk: 0.25, civilian: 0.05 } as Record<string, number>)[k] + (e.regular ? 0.35 : 0) + talk * 0.5 - e.suspicion / 200 - fatigueOdds(this.health)));
    const say = (by: 'you' | 'them' | 'info', text: string) => e.log.push({ by, text });
    say('you', oneOf(['You keep your voice low. “You know anyone selling? Weight, not a bag.”', '“Who’s holding around here? I mean real amounts.”', 'You lean in. “I’m looking for a connect. Who do you go to?”']));
    train(this.stats, 'speech', 2);
    if (Math.random() < odds) {
      // Some want paying for it.
      const want = k === 'junkie' && Math.random() < 0.5 ? 2000 : 0;
      if (want && Math.round(cashOf(this.inventory) * 100) < want) {
        say('them', '“Maybe. What’s it worth to you?” They hold out a hand. “Twenty. Come back when you got it.”');
        e.asked = e.asked.filter((x) => x !== 'connect');
        e.suspicion = Math.min(100, e.suspicion + 10);
        return;
      }
      const paid = want ? this.payLine(want) : '';
      const name = e.person.name ?? (k === 'junkie' ? 'the skinny one' : 'a friend');
      say('them', `${want ? 'They pocket the twenty. ' : ''}${oneOf(['They look up and down the street. “Dez. The alley behind the laundromat. Tell him', '“You didn’t hear it from me. Dez, out back of the laundromat. Say', '“Dez. Behind the laundromat, where the steam comes out. Tell him'])} ${name.split(' ')[0]} sent you.”`);
      for (const l of this.learnConnect(name)) say('info', l);
      if (paid) say('info', paid);
    } else {
      say('them', oneOf(['“I don’t know nothing about that.” They’re already moving off.', 'They look at you a long second. “You a cop?”', '“Wrong person, man.”', '“Get away from me.”']));
      e.suspicion = Math.min(100, e.suspicion + 25);
      // (A straight citizen might mention it to someone in a uniform.)
      if (k === 'civilian' && Math.random() < 0.3) {
        this.reportedHeat(4, e.seenAs?.anon, { sev: 1 });
        say('info', 'They’ll mention it to someone in a uniform.');
      }
    }
  }
  // ---------- Small, honest money ----------

  /** Asking someone for change. */
  private beg(e: Encounter) {
    (e.asked ??= []).push('beg');
    const k = e.person.kind;
    const h = this.health;
    const say = (by: 'you' | 'them' | 'info', text: string) => e.log.push({ by, text });
    say('you', oneOf(['“Spare some change? Anything helps.”', 'You hold out a hand. “Got a dollar? Anything.”', '“Sorry to bother you. Any change at all?”']));
    // Somebody you hurt: not a cent.
    if (e.recognised && (e.grudge ?? 0) >= 30) {
      say('them', oneOf(['“You? Get the hell away from me.”', 'They know you. Their face goes hard and they keep walking.']));
      e.suspicion = Math.min(100, e.suspicion + 20);
      return;
    }
    // Looking rough helps: cold, hurt, bloody.
    const rough = ((h.cold ?? 0) > 0 ? 0.08 : 0) + (h.broken.length ? 0.08 : 0) + (h.bleeding ? 0.1 : 0) + (h.blood < h.maxBlood * 0.9 ? 0.05 : 0);
    const roll = Math.random();
    let amt = 0;
    if (k === 'civilian') {
      if (roll < 0.25 + rough) amt = Math.random() < 0.8 ? 25 * (1 + Math.floor(Math.random() * 4)) : 100 * (1 + Math.floor(Math.random() * 5));
    } else if (k === 'drunk') {
      if (roll < 0.4 + rough) amt = 100 * (1 + Math.floor(Math.random() * 10));
      else if (roll < 0.6) {
        say('them', oneOf(['“Get a job, you bum!” They laugh at their own joke.', '“Change? I’ll give you change.” They spit near your feet.']));
        return;
      }
    } else if (k === 'homeless') {
      if (roll < 0.1 + rough / 2) amt = 25;
    }
    if (k === 'junkie') {
      say('them', oneOf(['“I was gonna ask you, man.”', 'They laugh, a dry, empty sound. “Yeah. Me too.”']));
      return;
    }
    if (!amt && k === 'homeless') {
      say('them', oneOf(['They show you their own empty cup.', '“Wish I could, friend.”', 'They shake their head slowly. “Nothing today.”']));
      return;
    }
    if (!amt) {
      say('them', oneOf(['They don’t even look at you.', '“Sorry, no cash.” They keep walking.', 'They step around you like you’re a puddle.', 'A quick shake of the head. Eyes straight ahead.']));
      // (A straight citizen might mention you to someone in a uniform.)
      if (k === 'civilian' && Math.random() < 0.15) {
        this.reportedHeat(3, e.seenAs?.anon, { sev: 1 });
        say('info', 'They’ll mention you to a cop.');
      }
      return;
    }
    const left = cents(pocketCash(this.inventory, fewest(amt)));
    say('them', amt >= 100 ? oneOf([`They dig out ${money(amt)} and press it into your hand.`, `“Here.” ${money(amt)}, folded small. “Get something to eat.”`]) : oneOf([`They drop ${money(amt)} in coins into your palm.`, `A few coins, ${money(amt)}, without a word.`]));
    if (left) say('info', `You’ve no room for ${money(left)} of it, and it rolls into the gutter.`);
    else say('info', `+${money(amt)}`);
  }

  /** The cans and bottles you've picked up. */
  private get cansCount(): number {
    return this.inventory.items.filter((x) => x.name === 'Empty cans').reduce((n, x) => n + (x.doses ?? 0), 0);
  }
  /** The bins on each block: how full they are (they fill back up over a few hours), a bag just thrown out, the day's rare find, and being told to clear off. */
  private binAt(id: string): { left: number; at: number; tossed?: boolean; rareDay?: string; shooedUntil?: number; aside?: { item: InvItem; day: string }[]; found?: Found[] } {
    const st = this.save.state;
    // (Older saves: one lot of bins for everywhere.)
    if (!st.bins || typeof st.bins !== 'object' || 'left' in (st.bins as object)) st.bins = {};
    const all = st.bins as Record<string, { left: number; at: number; tossed?: boolean; rareDay?: string; shooedUntil?: number; aside?: { item: InvItem; day: string }[]; found?: Found[] }>;
    const b = (all[id] ??= { left: BIN_MAX * 0.8, at: now() });
    if (b.at > now()) b.at = now();
    const hours = (now() - b.at) / 3_600_000;
    if (hours > 0) {
      b.left = Math.min(BIN_MAX, b.left + hours * BIN_REFILL);
      b.at = now();
    }
    // (Older saves: what was set aside is what you've found.)
    if (b.aside) {
      b.found = [...(b.found ?? []), ...b.aside.map((x) => ({ item: x.item, day: x.day }))];
      delete b.aside;
    }
    // (What you leave by the bins is gone by the next day: the truck, or somebody else.)
    if (b.found?.length) {
      const day = new Date(now()).toDateString();
      b.found = b.found.filter((x) => x.day === day);
      if (!b.found.length) delete b.found;
    }
    return b;
  }
  /** Where your corner's bins are: its part of town, or out back of the bar. */
  private get binArea(): BinArea {
    return this.corner.bar ? 'bar' : this.corner.district;
  }
  /** Why you can't get at the bins at all (to dig, or to sort through what you found). */
  private binsWhy(): string | null {
    if (this.place !== 'street' || !this.canLurk) return 'Not now';
    const b = this.binAt(this.corner.id);
    if ((b.shooedUntil ?? 0) > now()) return `They told you to move along. Not till ${clockText(b.shooedUntil!)}`;
    // (Picked clean, or too tired to dig: what you found is still there to sort through.)
    if (b.found?.length) return null;
    if (fatigueNow(this.health) >= FATIGUE_SPENT) return 'Too worn out';
    return b.left < 1 ? binsLook(0) : null;
  }
  /** Why you can't dig: the bins themselves, or nowhere on you for even a small thing. */
  private digWhy(): string | null {
    const why = this.binsWhy();
    if (why) return why;
    if (fatigueNow(this.health) >= FATIGUE_SPENT) return 'Too worn out';
    if (this.binAt(this.corner.id).left < 1) return binsLook(0);
    // (What you find waits on the pile for you to take or leave: just not too big a pile.)
    if ((this.binAt(this.corner.id).found?.length ?? 0) >= FOUND_MAX - 1) return 'Sort through what you’ve found first';
    return null;
  }
  /** Going through the bins on your block: its own screen, one dig at a time. */
  private openBins() {
    if (this.binsWhy()) return;
    this.scavLog = [];
    this.openSheet('scav');
  }
  /** One dig: a couple of minutes elbow-deep in other people's trash. */
  private digBins() {
    if (this.sheet !== 'scav') return;
    if (this.digWhy()) return this.renderSheet();
    const c = this.corner;
    const area = this.binArea;
    const b = this.binAt(c.id);
    const lvl = this.stats.scavenging.level;
    const h = this.health;
    addFatigue(h, 1);
    train(this.stats, 'scavenging', 1);
    const lines: string[] = [];
    // Somebody wants you out of their trash.
    if (Math.random() < shooOdds(lvl, area)) {
      b.shooedUntil = now() + 30 * 60_000;
      h.stress = Math.min(100, (h.stress ?? 0) + 3);
      lines.push(
        oneOf(
          area === 'bar'
            ? ['The back door bangs open. “Hey! Get out of there before I call somebody.” You put the lid down and go.', 'The bartender comes out with a bag of empties and sees you. “Not here. Go on.” You go.']
            : area === 'downtown'
              ? ['A shopkeeper raps on the glass and points you away. When you don’t move fast enough, he comes out. “Not my bins. Go.”', 'A security guard in a yellow vest walks over. “Move along. Now.” You move along.']
              : area === 'southside'
                ? ['A man on a forklift stops and leans on the horn until you walk away.', 'Someone shouts from a loading dock: “That’s private property!” You walk away.']
                : ['A window goes up. “Get out of my trash!” Lights come on along the block. You walk away.', 'A woman on her porch watches you, then takes out her phone. You don’t wait to find out who she’s calling.'],
        ),
      );
      this.scavLog.unshift(lines.join(' '));
      this.refresh();
      this.renderSheet();
      return;
    }
    const tossed = !!b.tossed;
    b.tossed = false;
    const day = new Date(now()).toDateString();
    const finds = rollDig(area, b.left, lvl, tossed, b.rareDay !== day);
    b.left = Math.max(0, b.left - 1);
    if (finds.some((f) => !f.find.cash)) this.scavSel = 0;
    if (!finds.length)
      lines.push(oneOf(['Nothing. Coffee grounds and wet paper.', 'Nothing worth having.', 'You tear open a bag: diapers. You tie it back up.', 'Nothing but takeout boxes and cat litter.', 'Nothing. Somebody got here first.']));
    for (const { tier, find } of finds) {
      if (tier === 'rare') b.rareDay = day;
      if (tier !== 'common') train(this.stats, 'scavenging', tier === 'rare' ? 8 : 3);
      lines.push(this.takeFind(find, lvl));
    }
    // Broken glass in a bag (gloves help, and knowing how to go through a bag).
    if (Math.random() < cutOdds(lvl, gloved(this.inventory))) {
      h.bleeding = Math.max(h.bleeding, 1);
      h.blood = Math.max(0, h.blood - 40);
      lines.push(gloved(this.inventory) ? 'Broken glass in a bag goes right through your glove. Your palm’s bleeding.' : 'You reach into a bag and a broken bottle opens up your palm. You’re bleeding.');
    }
    // Someone throws something out while you're here: the next dig's a better one.
    if (Math.random() < TOSS_ODDS) {
      b.tossed = true;
      b.left = Math.min(BIN_MAX, b.left + 1);
      lines.push(
        oneOf(
          area === 'bar'
            ? ['The kitchen door opens and someone heaves a full bag into the dumpster without looking at you.']
            : area === 'downtown'
              ? ['A man in a suit tosses a bag into the dumpster on his way past, still on his phone.', 'A store clerk drags out a bag at the end of a shift and drops it by the curb.']
              : area === 'southside'
                ? ['A worker on a smoke break throws a box out by the loading dock.']
                : ['Someone comes down their steps with a full trash bag and sets it by the curb.', 'A woman clearing out an apartment drops a box by the bins and goes back inside.'],
        ),
      );
    }
    this.scavLog.unshift(lines.join(' '));
    if (this.scavLog.length > 10) this.scavLog.length = 10;
    this.refresh();
    this.renderSheet();
  }
  /** Taking something off the pile of what you've found. */
  private takeFound(i: number) {
    if (this.sheet !== 'scav') return;
    const b = this.binAt(this.corner.id);
    const x = b.found?.[i];
    // (Gone: the day turned over while you stood there. Show what's really left.)
    if (!x) return this.renderSheet();
    if (x.cans) {
      const had = this.cansCount;
      const line = this.addCans(x.cans);
      const got = this.cansCount - had;
      if (!got) {
        this.scavLog.unshift(`No room for the cans. ${noRoomWhy(this.inventory, 'small', 0.015)}`);
        return this.renderSheet();
      }
      x.cans -= got;
      this.scavLog.unshift(line);
      if (x.cans > 0) return (this.refresh(), this.renderSheet());
    } else {
      const { spot: _s, ...it } = x.item!;
      if (!stow(this.inventory, it)) {
        this.scavLog.unshift(`No room for ${theThing(x.item!.name)}. ${noRoomWhy(this.inventory, x.item!.size, x.item!.kg)}`);
        return this.renderSheet();
      }
      this.scavLog.unshift(`You take ${theThing(x.item!.name)}.`);
    }
    b.found!.splice(i, 1);
    if (!b.found!.length) delete b.found;
    this.scavSel = Math.min(this.scavSel, Math.max(0, (b.found?.length ?? 1) - 1));
    this.refresh();
    this.renderSheet();
  }
  /** Leaving something on the pile: it goes back in the bin. */
  private leaveFound(i: number) {
    if (this.sheet !== 'scav') return;
    const b = this.binAt(this.corner.id);
    const x = b.found?.[i];
    if (!x) return this.renderSheet();
    b.found!.splice(i, 1);
    if (!b.found!.length) delete b.found;
    this.scavLog.unshift(x.cans ? (x.cans === 1 ? 'You leave the can.' : `You leave the ${x.cans} cans.`) : `You leave ${theThing(x.item!.name)}.`);
    this.scavSel = Math.min(this.scavSel, Math.max(0, (b.found?.length ?? 1) - 1));
    this.renderSheet();
  }
  /** The wheel's middle moved: what's picked, and its Take and Leave (without drawing the whole screen again). */
  private scavPicked(i: number) {
    const b = this.binAt(this.corner.id);
    const n = b.found?.length ?? 0;
    if (!n) return;
    this.scavSel = Math.max(0, Math.min(n - 1, i));
    const wheel = this.sheetEl.querySelector<HTMLElement>('.scav-wheel');
    wheel?.querySelectorAll('.scav-item').forEach((el, k) => el.classList.toggle('on', k === this.scavSel));
    const pick = this.sheetEl.querySelector<HTMLElement>('.scav-pick');
    if (pick) pick.innerHTML = this.scavPickHtml(b.found![this.scavSel], this.scavSel);
  }
  /** Under the wheel: what's in the middle, and whether you've room for it. */
  private scavPickHtml(x: Found, i: number): string {
    const inv = this.inventory;
    let why: string | null = null;
    if (x.cans) {
      const canBag = inv.items.some((y) => y.name === 'Empty cans' && ((sp) => !!sp && usedKg(inv, sp.id) + 0.015 <= sp.maxKg + 1e-9)(inv.spots.find((s) => s.id === y.spot)));
      if (tooHeavy(inv, 0.015) || (!canBag && !findRoom(inv, 'small', 0.015))) why = noRoomWhy(inv, 'small', 0.015);
    } else if (!(x.item!.kind === 'weapon' ? findRoom(inv, x.item!.size, x.item!.kg, x.item) || findRoom(inv, x.item!.size, x.item!.kg) : findRoom(inv, x.item!.size, x.item!.kg, x.item))) why = noRoomWhy(inv, x.item!.size, x.item!.kg);
    const name = x.cans ? `${x.cans} can${x.cans === 1 ? '' : 's'}` : x.item!.name;
    const what = x.cans ? 'Crushed flat: 10¢ each at the gas station' : `${x.item!.detail ?? ''}${x.item!.detail ? ' · ' : ''}${x.item!.size}, ${kgLabel(x.item!.kg)}`;
    return `<li><div><b>${name}</b><small>${what}</small></div><span class="li-btns"><button type="button" data-ftake="${i}" ${why ? `disabled title="${why}"` : ''}>Take${why ? `<small>${why}</small>` : ''}</button><button type="button" data-fleave="${i}">Leave</button></span></li>`;
  }
  /** Something out of the bins: cash into your pocket; anything else onto the pile, for you to take or leave. */
  private takeFind(f: BinFind, lvl: number): string {
    const inv = this.inventory;
    const rnd = (r: [number, number]) => r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
    const day = new Date(now()).toDateString();
    const b = this.binAt(this.corner.id);
    if (f.cans) {
      const n = rnd(f.cans);
      // (Cans go with the cans already on the pile.)
      const pile = b.found?.find((x) => x.cans);
      if (pile) {
        pile.cans! += n;
        b.found!.splice(b.found!.indexOf(pile), 1);
        b.found!.unshift(pile);
      } else (b.found ??= []).unshift({ cans: n, day });
      return `${n} can${n === 1 ? '' : 's'}, crushed flat.`;
    }
    if (f.cash) {
      const c = rnd(f.cash);
      const left = cents(pocketCash(inv, fewest(c)));
      if (left >= c) return `${f.line} You’ve no room left for it, not even for change.`;
      return `${f.line} ${money(c - left)}.${left ? ` You’ve no room for the other ${money(left)}.` : ''}`;
    }
    const it = { ...f.item! };
    if (it.food === 'trash') it.spoiled = Math.random() < spoilOdds(lvl);
    const m = measure(it);
    (b.found ??= []).unshift({ item: { ...it, size: m.size, kg: m.kg, spot: '' } as InvItem, day });
    return f.line;
  }
  /** Cans into a bag of them you're carrying: topped up where there's room, moved to a roomier pocket, or a new bag somewhere else. */
  private addCans(n: number): string {
    const inv = this.inventory;
    const KG = 0.015;
    const kgOf = (k: number) => Math.round(k * 15) / 1000;
    const bags = () => inv.items.filter((x) => x.name === 'Empty cans');
    const total = () => bags().reduce((k, x) => k + (x.doses ?? 0), 0);
    const roomIn = (x: InvItem, more: number) => {
      const sp = inv.spots.find((s) => s.id === x.spot);
      return !!sp && usedKg(inv, sp.id) + more * KG <= sp.maxKg + 1e-9;
    };
    /** As many of the k as can go somewhere: into a bag that has room, a bag moved somewhere roomier, or a new bag. */
    const put = (k: number): boolean => {
      if (tooHeavy(inv, k * KG)) return false;
      const fits = bags().find((x) => roomIn(x, k));
      if (fits) {
        fits.doses = (fits.doses ?? 0) + k;
        fits.kg = kgOf(fits.doses);
        return true;
      }
      // (The bag's outgrown its pocket: into one with room for all of it.)
      for (const x of bags()) {
        const others: Inventory = { ...inv, items: inv.items.filter((y) => y !== x) };
        const to = findRoom(others, 'small', kgOf((x.doses ?? 0) + k), x);
        if (to) {
          x.spot = to.id;
          x.doses = (x.doses ?? 0) + k;
          x.kg = kgOf(x.doses);
          return true;
        }
      }
      return !!stow(inv, { kind: 'misc', name: 'Empty cans', detail: 'Rinsed out, crushed flat, in a plastic bag', doses: k, size: 'small', kg: kgOf(k) });
    };
    const had = total();
    let took = 0;
    // (As many as will go, a bag at a time, till they're all in or nothing more fits.)
    while (took < n) {
      let placed = 0;
      for (let k = n - took; k >= 1 && !placed; k--) if (put(k)) placed = k;
      if (!placed) break;
      took += placed;
    }
    const left = n - took;
    const s = (k: number) => (k === 1 ? '' : 's');
    if (!took) return `${n} can${s(n)}, and nowhere to put ${n === 1 ? 'it' : 'them'}. ${noRoomWhy(inv, 'small', n * KG)}`;
    const head = had ? `${took} more can${s(took)}. ${total()} in all.` : `${took} can${s(took)}, crushed flat into a plastic bag.`;
    return left ? `${head} No room for the other ${left}. ${noRoomWhy(inv, 'small', KG)}` : head;
  }
  /** The bins screen: how full they are, a dig, and what each dig turned up. */
  private scavHtml(): string {
    const c = this.corner;
    const b = this.binAt(c.id);
    const why = this.digWhy();
    const btn = (attr: string, v: string | number, label: string, no?: string | false | null) => `<button type="button" data-${attr}="${v}" ${no ? `disabled title="${no}"` : ''}>${label}${no ? `<small>${no}</small>` : ''}</button>`;
    const li = (name: string, small: string, button: string) => `<li><div><b>${name}</b><small>${small}</small></div><span class="li-btns">${button}</span></li>`;
    const cans = this.cansCount;
    const lvl = this.stats.scavenging.level;
    return (
      `<p class="scav-where">${c.bar ? `Out back of ${c.name}` : c.name}. ${binsLook(b.left)}</p>` +
      `<div class="spot-bar"><i style="width:${Math.round((100 * Math.max(0, b.left)) / BIN_MAX)}%"></i><span>${b.tossed ? 'A bag just went in' : 'What’s left in the bins'}</span></div>` +
      `<ul class="shop-list">` +
      li('Keep digging', `A couple of minutes, a little more tired.${lvl > 1 ? ` Scavenging ${lvl}.` : ''}`, btn('dig', 1, 'Dig', why)) +
      li('Done', `Put the lids back and walk away.${cans ? ` You’ve ${cans} can${cans === 1 ? '' : 's'}: 10¢ each at the gas station.` : ''}`, btn('close', 1, 'Stop')) +
      `</ul>` +
      (b.found?.length
        ? `<h3>What you’ve found <b>${b.found.length}</b></h3>` +
          `<div class="scav-wheel-box${b.found.length === 1 ? ' one' : b.found.length === 2 ? ' few' : ''}"><div class="scav-wheel" role="listbox" aria-label="What you’ve found">` +
          b.found.map((x, i) => `<button type="button" role="option" class="scav-item${i === Math.min(this.scavSel, b.found!.length - 1) ? ' on' : ''}" data-wheel="${i}">${x.cans ? `${x.cans} can${x.cans === 1 ? '' : 's'}` : x.item!.name}</button>`).join('') +
          `</div></div>` +
          `<ul class="shop-list scav-pick">${this.scavPickHtml(b.found[Math.min(this.scavSel, b.found.length - 1)], Math.min(this.scavSel, b.found.length - 1))}</ul>`
        : '') +
      (this.scavLog.length ? `<div class="scav-log">${this.scavLog.map((l, i) => `<p${i ? '' : ' class="new"'}>${l}</p>`).join('')}</div>` : `<p class="scav-hint">Most bags are nothing. Now and then, something somebody shouldn’t have thrown out.</p>`)
    );
  }
  /** At the gas station: the cans back, for the deposit. */
  private cashCans() {
    if (this.place !== 'gas') return;
    const inv = this.inventory;
    const n = this.cansCount;
    if (!n) return;
    inv.items = inv.items.filter((x) => x.name !== 'Empty cans');
    const left = cents(pocketCash(inv, fewest(n * 10)));
    this.refresh();
    this.note([`You feed ${n} can${n === 1 ? '' : 's'} into the machine one at a time. It spits out a ticket, and the clerk gives you ${money(n * 10 - left)} for it.${left ? ` You’ve no room for the other ${money(left)}.` : ''}`]);
  }

  /** Plasma: when you've given (real time), to keep to twice a week. */
  private get plasmaLog(): { visits: number[]; total: number } {
    return (this.save.state.plasma ??= { visits: [], total: 0 }) as { visits: number[]; total: number };
  }
  private plasmaWhy(): string | null {
    const h = this.health;
    const t = now();
    const log = this.plasmaLog;
    const week = log.visits.filter((v) => t - v < 7 * 86_400_000);
    const last = log.visits.length ? Math.max(...log.visits) : 0;
    if (!this.ownId()) return 'They need to see your own ID';
    if (week.length >= 2) return 'Twice a week at most';
    if (last && t - last < 48 * 3_600_000) return `Not till ${dueText(last + 48 * 3_600_000)} ${clockText(last + 48 * 3_600_000)}`;
    if (h.blood < h.maxBlood * 0.9) return 'Not enough blood in you';
    if ((h.drunk ?? 0) >= 20 || h.wired || (h.high && (h.highUntil ?? 0) > t)) return 'They can tell you’re on something';
    if (h.bleeding) return 'Not while you’re bleeding';
    return null;
  }
  private plasmaHtml(btn: (attr: string, v: string | number, label: string, no?: string | false | null) => string, li: (name: string, small: string, button: string) => string): string {
    const pay = this.plasmaLog.total ? 45 : 60;
    return `<ul class="shop-list">${li('Donate plasma', `About fifty minutes in a recliner with a needle in your arm, real time. ${money(pay * 100)} on the way out${this.plasmaLog.total ? '' : ' (the first visit; $45 after that)'}. You leave light-headed. Leave early and you don’t get paid.`, btn('plasma', 'go', 'Sit down', this.plasmaWhy()))}</ul>` +
      `<p class="shop-broke">They screen everyone: your own ID, a finger prick, a few questions. Twice a week at most, two days apart.</p>`;
  }
  private donatePlasma() {
    if (this.place !== 'hospital' || this.plasmaWhy() || this.work) return;
    this.startWork({ kind: 'plasma', since: now(), until: now() + 50 * 60_000 }, ['A finger prick, a blood pressure cuff, a form with too many questions. Then a recliner, a needle in the crook of your arm, and the machine starts to hum.']);
  }

  // ---------- The delivery app ----------
  /** Your account with the delivery app (this character's). */
  private get gig(): { signedUp: boolean; balance: number; cashedAt?: number; drops: number } {
    return (this.save.state.gig ??= { signedUp: false, balance: 0, drops: 0 }) as { signedUp: boolean; balance: number; cashedAt?: number; drops: number };
  }
  /** Locked or not: yours never; someone else's, usually (decided the first time you look). */
  private phoneLocked(x: InvItem): boolean {
    if (x.kind !== 'phone') return true;
    if (x.own != null && x.own === this.world.lives) return false;
    if (x.locked == null) x.locked = Math.random() < 0.75;
    return x.locked;
  }
  /** A phone you can actually use. */
  private get usablePhone(): InvItem | undefined {
    return this.inventory.items.find((x) => x.kind === 'phone' && !this.phoneLocked(x));
  }
  private phoneActs(x: InvItem, i: number): string {
    if (this.phoneLocked(x)) return '';
    const g = this.gig;
    const b = (v: string, label: string, no?: string | null) => `<button type="button" data-gig="${v}" data-gigi="${i}" ${no ? `disabled title="${no}"` : ''}>${label}${no ? `<small>${no}</small>` : ''}</button>`;
    if (!g.signedUp) return b('signup', `${GIG_APP}: sign up`, this.ownId() ? null : 'Needs your own ID');
    const free = !g.cashedAt || now() - g.cashedAt >= 7 * 86_400_000;
    return (
      b('start', 'Start a delivery shift', !this.canOpenSheet || this.place !== 'street' ? 'Out on the street' : fatigueNow(this.health) >= 70 ? 'Too worn out' : null) +
      b('cash', free ? 'Cash out (free)' : 'Cash out ($2 fee)', !this.account ? 'Needs a bank account' : g.balance < (free ? 100 : 300) ? 'Not enough to cash out' : null)
    );
  }
  private gigAct(what: string, _i: number) {
    const g = this.gig;
    if (!this.usablePhone) return;
    if (what === 'signup' && !g.signedUp && this.ownId()) {
      g.signedUp = true;
      this.refresh();
      this.renderSheet();
      this.note([`You download ${GIG_APP}, photograph your ID, take a selfie, and wait. Ten minutes later: you’re approved. Start a shift whenever you like, from the street.`]);
      return;
    }
    if (what === 'start' && g.signedUp && this.place === 'street' && this.canOpenSheet && fatigueNow(this.health) < 70) {
      this.closeSheet();
      this.startWork({ kind: 'deliver', since: now(), drops: 0, earned: 0, tick: now(), part: 0 }, [`You open ${GIG_APP} and go online. The first order pings before you’ve put the phone away.`]);
      return;
    }
    if (what === 'cash' && g.signedUp && this.account) {
      const free = !g.cashedAt || now() - g.cashedAt >= 7 * 86_400_000;
      const fee = free ? 0 : 200;
      if (g.balance < (free ? 100 : 300)) return;
      const out = g.balance - fee;
      this.account.cents += out;
      g.balance = 0;
      if (free) g.cashedAt = now();
      this.refresh();
      this.renderSheet();
      this.note([`${money(out)} goes from ${GIG_APP} into your bank account${fee ? ` (${money(fee)} for the instant cash-out)` : ''}.`]);
    }
  }

  // ---------- Busy: a plasma visit, a delivery shift (real time, on its own screen) ----------
  private get work(): Work | undefined {
    return this.save.state.work as Work | undefined;
  }
  private startWork(w: Work, lines: string[]) {
    this.dropEncounter();
    this.save.state.work = w;
    this.save.state.workLines = lines;
    this.running = false;
    this.unstick();
    this.noteEl.hidden = true;
    this.showWork();
  }
  private workTick = -1;
  private showWork() {
    const w = this.work;
    if (!w) return;
    document.getElementById('work')?.remove();
    const el = document.createElement('div');
    el.id = 'work';
    el.className = 'lockup';
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const lines = ((this.save.state.workLines as string[] | undefined) ?? []).slice(-2);
    el.innerHTML =
      `<h2>${w.kind === 'plasma' ? 'Plasma' : w.kind === 'watch' ? 'Watching' : 'Delivering'}</h2>` +
      `<p class="jail-what">${w.kind === 'plasma' ? 'In a recliner in the hospital’s plasma room, the machine humming.' : w.kind === 'watch' ? `In a doorway across from ${((b) => (b ? buildingAddr(b) : 'the place'))(buildingById(w.bld))}, watching the door and the windows.` : `Online with ${GIG_APP}, bag on your back, phone in your hand.`}</p>` +
      lines.map((l) => `<p class="rest-line">${esc(l)}</p>`).join('') +
      (w.kind !== 'deliver' ? `<div class="rest-bar"><i></i></div>` : '') +
      `<p class="jail-left"></p><p class="jail-out"></p>` +
      `<p class="jail-how">${w.kind === 'plasma' ? 'Real time. Leave early and you don’t get paid.' : w.kind === 'watch' ? 'Real time. Leave early and you won’t have seen enough.' : 'Real time: orders come in while the game is open or closed. Stop whenever you like; you keep what you’ve made.'}</p>` +
      `<button type="button" class="jail-quit">${w.kind === 'deliver' ? 'Go offline' : 'Leave early'}</button>`;
    const shown = performance.now();
    el.querySelector('button')!.addEventListener('click', () => performance.now() - shown > 800 && this.endWork(false));
    this.view.append(el);
    this.workTick = -1;
    this.tickWork();
  }
  private tickWork() {
    const w = this.work;
    if (!w) return;
    const t = now();
    if (w.kind !== 'deliver') {
      if (w.until != null && t >= w.until) return this.endWork(true);
    } else this.deliverUpTo(w, t);
    if (!this.work) return;
    const el = document.getElementById('work');
    if (!el) return this.showWork();
    const sec = Math.floor(t / 1000);
    if (sec === this.workTick) return;
    this.workTick = sec;
    const two = (n: number) => String(n).padStart(2, '0');
    if (w.kind !== 'deliver') {
      const left = Math.max(0, Math.ceil(((w.until ?? t) - t) / 1000));
      (el.querySelector('.rest-bar i') as HTMLElement).style.width = `${Math.min(100, (100 * (t - w.since)) / ((w.until ?? t) - w.since))}%`;
      el.querySelector('.jail-left')!.textContent = `${two(Math.floor(left / 60))}:${two(left % 60)} to go`;
      el.querySelector('.jail-out')!.textContent = `Done by ${clockText(w.until ?? t)}`;
    } else {
      const on = Math.floor((t - w.since) / 1000);
      el.querySelector('.jail-left')!.textContent = `${w.drops ?? 0} drop${w.drops === 1 ? '' : 's'} · ${money(w.earned ?? 0)}`;
      el.querySelector('.jail-out')!.textContent = `Online ${Math.floor(on / 3600)}:${two(Math.floor((on % 3600) / 60))} · ${FATIGUE_NAMES[fatigueLevel(Math.round(fatigueNow(this.health)))]}`;
    }
  }
  /** Out on deliveries up to now: orders come and go (more at dinner and in bad weather, fewer worn out). */
  private deliverUpTo(w: Work, t: number) {
    const h = this.health;
    let at = w.tick ?? w.since;
    // (Ten hours on, the app logs you off.)
    const stopAt = Math.min(t, w.since + 10 * 3_600_000);
    while (at < stopAt) {
      const step = Math.min(stopAt - at, 60_000);
      const hr = new Date(at).getHours();
      const dinner = hr >= 17 && hr < 21;
      const wet = WET_AMOUNT[this.weather.now] > 0;
      const rate = (2.5 + (dinner ? 1 : 0) + (wet ? 0.8 : 0)) * Math.max(0.3, 1 - (h.fatigue ?? 0) * 0.008);
      w.part = (w.part ?? 0) + (rate * step) / 3_600_000;
      while ((w.part ?? 0) >= 1) {
        w.part = (w.part ?? 0) - 1;
        const pay = 300 + Math.floor(Math.random() * 301) + Math.floor(Math.random() * (wet ? 450 : 300));
        w.drops = (w.drops ?? 0) + 1;
        w.earned = (w.earned ?? 0) + pay;
        this.gig.balance += pay;
        this.gig.drops += 1;
        h.fatigue = Math.min(100, (h.fatigue ?? 0) + 3.5);
        train(this.stats, 'stamina', 2);
      }
      at += step;
      w.tick = at;
      // (On shift you're working, not resting: no getting your breath back while you ride.)
      h.fatigueAt = Math.max(h.fatigueAt ?? 0, at);
      if ((h.fatigue ?? 0) >= 88) return this.endWork(false, false, 'You’re dead on your feet. You go offline before you drop.');
    }
    if (t >= w.since + 10 * 3_600_000) return this.endWork(false, false, `Ten hours on: ${GIG_APP} logs you off.`);
    if (!this.usablePhone) return this.endWork(false, false, 'No phone: you’re offline.');
  }
  /** Done (or left): paid, or not. */
  private endWork(finished: boolean, quiet = false, why?: string) {
    const w = this.work;
    if (!w) return;
    // (Not when the shift's own catching up is what ended it: that's done already.)
    if (w.kind === 'deliver' && !quiet && !why) this.deliverUpTo(w, now());
    if (!this.work) return;
    delete this.save.state.work;
    delete this.save.state.workLines;
    document.getElementById('work')?.remove();
    this.running = !this.paused && !this.jail && !this.dead;
    if (quiet) return;
    const meanwhile = (this.save.state.laterLines as string[] | undefined) ?? [];
    delete this.save.state.laterLines;
    const lines: string[] = [];
    if (w.kind === 'plasma') {
      if (finished) {
        const h = this.health;
        const log = this.plasmaLog;
        const pay = log.total ? 4500 : 6000;
        log.visits.push(now());
        log.visits = log.visits.filter((v) => now() - v < 14 * 86_400_000);
        log.total += 1;
        h.blood = Math.max(Math.round(h.maxBlood * 0.6), h.blood - 400);
        addFatigue(h, 12);
        const left = cents(pocketCash(this.inventory, fewest(pay)));
        lines.push(`They unhook you and tape a cotton ball in the crook of your arm. At the desk, ${money(pay - left)} in cash.${left ? ` You’ve no room on you for the other ${money(left)}.` : ''} You stand up too fast and the room tilts.`);
      } else lines.push('You pull the tape and tell the nurse you have to go. She stops the machine with a sigh. No pay.');
    } else if (w.kind === 'watch') {
      lines.push(...this.endWatch(w, finished));
    } else {
      lines.push(`${why ?? 'You go offline.'} ${w.drops ?? 0} drop${w.drops === 1 ? '' : 's'}, ${money(w.earned ?? 0)} into ${GIG_APP}. ${money(this.gig.balance)} waiting to cash out.`);
    }
    this.refresh();
    this.note([...lines, ...meanwhile]);
    buzz(8);
  }
  /** The others on the street, besides whoever you're looking at (each walks on after a while). */
  private get crowd(): Bystander[] {
    return (this.save.state.crowd ??= []) as Bystander[];
  }
  /** How many others are about, by the hour, the weather (and up to two). */
  private gatherCrowd() {
    if (this.place !== 'street') return;
    const hr = new Date(now()).getHours();
    const w: number[] = hr >= 1 && hr < 5 ? [0.85, 0.13, 0.02] : hr >= 22 || hr < 1 ? [0.6, 0.3, 0.1] : hr >= 7 && hr < 20 ? [0.3, 0.4, 0.3] : [0.45, 0.35, 0.2];
    // (Your corner: downtown's busier, Southside quieter.)
    {
      const busy = this.cornerFeel.busy;
      w[1] *= busy;
      w[2] *= busy * busy;
      const sum = w[0] + w[1] + w[2];
      for (let k = 0; k < 3; k++) w[k] /= sum;
    }
    // (Rain and snow keep people in.)
    if (WET_AMOUNT[this.weather.now] > 0) {
      w[0] += (w[1] + w[2]) * 0.5;
      w[1] *= 0.5;
      w[2] *= 0.5;
    }
    let r = Math.random();
    const n = r < w[0] ? 0 : (r -= w[0]) < w[1] ? 1 : 2;
    const list: Bystander[] = [];
    const inv = this.inventory;
    for (let i = 0; i < n; i++) {
      const p = makePerson(this.cornerFeel.chances);
      const x = newEncounter(p, this.yourBody());
      if (this.atBar) x.bar = true;
      x.conspicuous = conspicuous(inv);
      x.start = { blood: x.them.blood, broken: [...x.them.broken] };
      this.lurkState.seen[p.kind]++;
      this.lurkState.races[p.race]++;
      list.push({ e: x, leaveAt: now() + (20 + Math.random() * 70) * 1000 });
    }
    this.save.state.crowd = list;
  }
  /** Going over to one of the others instead: whoever you were looking at becomes one of them. */
  private approachOther(i: number) {
    const e = this.encounter;
    const c = this.crowd;
    const b = c[i];
    if (!b || !e || e.stage !== 'seen' || !this.canLurk) return;
    c.splice(i, 1);
    // (Whoever you were watching walks on: you'd let them go. Not settled or remembered: nothing happened.)
    this.save.state.encounter = b.e;
    this.act('open');
  }
  /** The others walk on, a while later; with nobody being looked at, the next is. */
  private tickCrowd() {
    const c = this.save.state.crowd as Bystander[] | undefined;
    if (!c?.length) return;
    const t = now();
    const e = this.encounter;
    const gone = c.filter((b) => b.leaveAt <= t);
    if (gone.length) {
      this.save.state.crowd = c.filter((b) => b.leaveAt > t);
      const who = (b: Bystander) => (b.e.person.title ?? (b.e.person.kind === 'civilian' ? (b.e.person.sex === 'Male' ? 'man' : 'woman') : b.e.person.kind === 'homeless' ? `homeless ${b.e.person.sex === 'Male' ? 'man' : 'woman'}` : NAMES[b.e.person.kind])).toLowerCase();
      const line = e?.witnessed || gone.every((b) => b.saw)
        ? gone.length > 1 ? 'The ones who saw it are gone.' : `The ${who(gone[0])} who saw it is gone.`
        : gone.length > 1 ? 'The others walk on.' : `The ${who(gone[0])} walks on.`;
      // (Mid-encounter, the log is what you do: who's left shows as the Watched count.)
      if (e && e.stage !== 'seen' && e.stage !== 'over') {
        e.watchers = this.crowd.length;
      } else if (this.place === 'street' && this.tvState.on && !e?.witnessed && !gone.every((b) => b.saw)) this.note([line], false, 'crowd');
      this.refresh();
      return;
    }
    // Nobody you're looking at, but someone's still about: they're the one in front of you now.
    // (Not someone who just watched you hurt somebody: they're leaving.)
    if (!e && this.place === 'street' && this.phase === 'idle' && this.running && this.tvState.on && !this.ending && !this.save.state.policeStop && !this.sheet && c.some((b) => !b.saw)) {
      const b = c.splice(c.findIndex((x) => !x.saw), 1)[0];
      b.e.you = this.yourBody();
      // (In front of you from now: their ten minutes start here.)
      b.e.seenAt = now();
      this.save.state.encounter = b.e;
      this.refresh();
    }
  }
  /** Violence, with others on the street: they see it. Once per encounter. */
  /** How low-key you keep things (Sneak): 0 .. 0.6. */
  private get quiet(): number {
    return Math.min(0.6, ((this.stats.sneak?.level ?? 1) - 1) * 0.006);
  }
  private witness(e: Encounter) {
    const c = this.crowd;
    e.watchers = e.stage === 'seen' ? 0 : c.length;
    if (!c.length || e.witnessed != null || e.resident || this.place !== 'street') return;
    const violent = !!e.fought || !!e.mugged || (e.tortured ?? 0) > 0 || e.them.down || e.them.out || e.them.dead || e.stage === 'combat' || e.stage === 'violence';
    if (!violent || (e.stage === 'violence' && !e.fought)) return;
    const f = this.infamy;
    const anon = anonymity(this.inventory);
    const q = this.quiet;
    // Each of them catches it, or doesn't: Sneak (kept low-key) and a covered face make it easy to miss.
    const sees = c.filter(() => Math.random() < (1 - q) * (1 - anon * 0.5));
    const n = sees.length;
    if (!n) {
      // (Nobody caught that one. They're still there for the next, and nobody misses a killing.)
      e.watchers = c.length;
      if (e.them.dead) e.witnessed = c.length;
      return;
    }
    e.witnessed = n;
    const say = (text: string) => e.log.push({ by: 'info', text });
    say(n === 1 ? (c.length === 1 ? 'Someone on the street sees it.' : 'One of the others on the street sees it.') : 'The others on the street see it.');
    // (Low-key, they're less sure what they saw: Sneak.)
    // (A good look at your face, and somebody hurt: an assault they can put a name to.)
    const hurtSeen = e.them.out || e.them.dead || e.them.broken.length > (e.start?.broken.length ?? 0);
    this.reportedHeat(5 * n * (1 - q * 0.5), anon, { sev: hurtSeen ? 6 : 4, charges: hurtSeen && anon < 0.5 ? ['Assault'] : [], floor: 60 });
    if (Math.random() < (0.3 + 0.15 * n) * (1 - q) * 0.35) {
      say(oneOf(['One of them has a phone out. They’re calling it in.', 'Someone’s on the phone already, backing away, looking right at you.']));
      this.reportedHeat(15, anon, { sev: hurtSeen ? 6 : 4 });
    }
    // A good look at your face: what they'll tell the police.
    if (Math.random() > anon && Math.random() < 0.6 * (1 - q)) {
      f.reports = (f.reports ?? 0) + 1;
      say('They got a good look at you.');
    }
    // (Nobody steps in: they keep their distance.)
    // Then whoever saw it gets out of there.
    for (const b of sees) {
      b.leaveAt = Math.min(b.leaveAt, now() + (3 + Math.random() * 6) * 1000);
      b.saw = true;
    }
    e.watchers = this.crowd.length;
  }
  /** Who Dez sends: big, calm, and carrying. Bigger each time you send one back. */
  private enforcerFor(d: { strikes?: number }): import('./person').Person {
    const p = makePerson();
    p.kind = 'civilian';
    p.title = 'Dez’s man';
    p.sex = 'Male';
    p.personality = 'hard';
    p.build = (d.strikes ?? 0) >= 1 ? 'Muscular' : 'Stocky';
    p.awareness = 'Alert';
    p.carrying = [...p.carrying.filter((x) => !x.weapon && !x.spray), { name: 'Lockback folder', weapon: 5, cuts: true }];
    return p;
  }

  /** Dez, by the dumpsters at night: an eight-ball for cash, or fronted on credit. */
  private dezHtml(open: boolean): string {
    if (!open) return '';
    const btn = (attr: string, v: string, label: string, no?: string | false) => `<button type="button" data-${attr}="${v}" ${no ? `disabled title="${no}"` : ''}>${label}${no ? `<small>${no}</small>` : ''}</button>`;
    const li = (name: string, small: string, button: string) => `<li><div><b>${name}</b><small>${small}</small></div><span class="li-btns">${button}</span></li>`;
    const c = Math.round(cashOf(this.inventory) * 100);
    const d = this.debt;
    const late = !!d && now() > d.due;
    const con = this.connect;
    let rows = '';
    if (d)
      rows += li('What you owe Dez', `${money(d.owed)}, ${late ? `late: it was due ${dueText(d.due)}, ${(d.vigDays ?? 0) >= VIG_DAYS ? 'and he’s done adding to it. Now he wants it, or you.' : 'and it grows a fifth every day.'}` : `due ${dateText(d.due)}.`}`, btn('dez', 'pay', c >= d.owed ? 'Pay it all' : 'Pay what you have', !c && 'No cash'));
    // Nobody's vouched for you: he doesn't know you.
    if (!con.known) {
      rows += li('A man by the dumpsters', con.cutOff ? 'Dez. He looks straight through you. He’s done with you: you’d need someone to vouch for you again.' : 'He watches you come, hands in his pockets. “I don’t know you.” Nobody sells to a stranger: someone has to vouch for you. Ask around on the street.', '');
      return `<p class="shop-sub">Dez, by the dumpsters</p><ul class="shop-list">${rows}</ul>`;
    }
    const tier = this.tier;
    const hot = this.infamy.heat >= 70;
    const standing = ['', 'He knows you. Barely.', 'He trusts you, some.', 'He trusts you. His supplier knows your face.'][tier];
    const next = tier === 1 ? 'Pay what he fronts you, on time, and keep your head down: better prices, and more.' : tier === 2 ? 'Keep it up and he’ll take you to his own supplier.' : '';
    rows += li('Dez', `${standing}${con.via ? ` (${con.via.split(' ')[0]} vouched for you.)` : ''} ${next}`, '');
    const stand = this.standing;
    const locked = DEZ_DEALS.filter((x) => x.tier <= tier && x.standing > stand);
    for (const deal of DEZ_DEALS.filter((x) => x.tier <= tier && x.standing <= stand)) {
      const price = deal.cash[tier - 1];
      const why = (hot && '“You’re hot. Come back when it cools down.”') || (late && '“Not till you pay me.”') || false;
      rows += li(deal.id === 'ounce' ? `An ${deal.name.toLowerCase()}, from his supplier` : deal.name, `${deal.desc} Cash, or fronted: ${money(deal.front * 100)} in ${deal.days} days.`, (price ? btn('dez', `cash:${deal.id}`, money(price * 100), why || (c < price * 100 && 'Not enough cash')) : '') + btn('dez', `front:${deal.id}`, 'Front me', why || (!!d && '“You owe me already.”') || (con.trust < 10 && deal.tier === 1 && '“Buy from me first. Then we talk.”')));
    }
    if (locked.length) rows += li('More, later', `Move more, and keep your customers coming back, and he’ll have more for you. Next: ${locked.slice(0, 2).map((x) => x.name).join('; ')}. To him you’re ${/^[AEIOU]/.test(STANDING_NAMES[stand]) ? 'an' : 'a'} ${STANDING_NAMES[stand].toLowerCase()} now.`, '');
    return `<p class="shop-sub">Dez, by the dumpsters</p><ul class="shop-list">${rows}</ul>${this.marketHtml()}`;
  }
  /** What's moving on the street: each thing, its price and which way it's going, and where it sells. */
  private marketHtml(asSection = false): string {
    const m = this.market;
    const short: Record<string, string> = { downtown: 'Dtn', flats: 'Flats', oldtown: 'Old T', southside: 'South' };
    const rows = MARKET_KEYS.map((k) => {
      const { word, arrow } = marketWord(m, k);
      // (Each pair kept together when it wraps.)
      const where = DISTRICTS.map((d) => `<span class="nw">${short[d]} ${districtWord(m, k, d)}</span>`).join(' · ');
      return `<li><div><b>${keyName(k)} <span class="mkt-arrow">${arrow}</span></b><small>${((p) => (p === 'pills' ? `${money(streetPrice(m, k) * 100)} a pill` : `${money(Math.round(streetPrice(m, k)) * 100)} a gram${SIZES[p][0].amt === 10 ? '' : ` · ${money(Math.round(sizePrice(k, SIZES[p][0].amt) * (streetPrice(m, k) / PRODUCTS[p].price)) * 100)} ${SIZES[p][0].word}`}`))(keyProduct(k))} · ${word}</small><small class="mkt-where">${where}</small></div></li>`;
    }).join('');
    return `${asSection ? `<h3>What’s moving</h3><p class="shop-sub">Street prices, ${DISTRICT_NAMES[this.cornerDistrict]}</p>` : `<p class="shop-sub">What’s moving (street prices, ${DISTRICT_NAMES[this.cornerDistrict]})</p>`}<ul class="shop-list market-list">${rows}</ul>`;
  }

  /** Buying from Dez, or paying him back. */
  private dez(what: string) {
    if (this.place !== 'fence' || !isOpen(placeInfo('fence').hours!)) return;
    const inv = this.inventory;
    const c = Math.round(cashOf(inv) * 100);
    const d = this.debt;
    const late = !!d && now() > d.due;
    const con = this.connect;
    const tier = this.tier;
    if (what === 'pay' && d && c) {
      const amount = Math.min(c, d.owed);
      const paid = this.payLine(amount);
      d.owed -= amount;
      const done = d.owed <= 0;
      if (done) delete this.save.state.debt;
      // Paid up on time: he remembers. Late: he remembers that too.
      const t = done ? this.trustDez(now() <= d.due ? 12 : -10) : null;
      this.refresh();
      this.note([done ? (now() <= d.due ? 'Dez counts it twice, slowly, and puts it away. “We’re good. You’re all right.”' : 'Dez counts it twice and puts it away. “Late. Don’t be late again.”') : `Dez takes it without counting. “That’s a start. ${money(d.owed)} to go.”`, paid, ...(t ? [t] : [])]);
      return;
    }
    const [how, id] = what.split(':');
    const deal = DEZ_DEALS.find((x) => x.id === (id ?? 'ball'));
    if (!deal || !con.known || deal.tier > tier || deal.standing > this.standing || late || this.infamy.heat >= 70) return;
    // (Dez's is decent, and much the same every time.)
    const bag = () => stow(inv, { kind: 'misc', name: deal.name, detail: deal.detail, secret: 'cocaine', known: true, doses: deal.doses, pkg: deal.doses, product: deal.product, ...(deal.pill ? { pill: deal.pill } : {}), ...(deal.pressed ? { pressed: true } : {}), quality: deal.pill && !deal.pressed ? 100 : 58 + Math.floor(Math.random() * 12) });
    // The first time at the top: his supplier, in a car at the mouth of the alley.
    const meet = deal.tier === 3 && !con.metBig ? `Dez walks you out to a car idling at the mouth of the alley. The window comes down a few inches. Nobody says a name. ${deal.detail.replace(/^./, (c) => c.toUpperCase()).replace(/\.?$/, '')} comes out through the gap.` : '';
    if (how === 'cash') {
      const price = deal.cash[tier - 1] * 100;
      if (!price || c < price) return;
      if (!bag()) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, 'small')}`]);
        return;
      }
      if (deal.tier === 3) con.metBig = true;
      const paid = this.payLine(price);
      const t = this.trustDez(3);
      this.refresh();
      this.note([meet || (deal.tier === 1 ? 'Dez looks up and down the alley, then presses something small and hard into your hand. “Don’t open it here.”' : 'Dez takes your money and comes back from the dark with it wrapped in a paper bag. “Careful with that.”'), paid, ...(t ? [t] : [])]);
      return;
    }
    if (how === 'front' && !d && (con.trust >= 10 || deal.tier > 1)) {
      if (!bag()) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, 'small')}`]);
        return;
      }
      if (deal.tier === 3) con.metBig = true;
      this.save.state.debt = { owed: deal.front * 100, base: deal.front * 100, due: now() + deal.days * 86_400_000, strikes: 0 };
      this.refresh();
      this.note([meet, `Dez puts it in your hand and doesn’t let go straight away. “${money(deal.front * 100)}. ${['', 'One day', 'Two days', 'Three days', 'Four days', 'Five days', 'Six days', 'A week'][deal.days]}. I know where you sleep.”`].filter(Boolean));
    }
  }

  // ---------- Addresses you know, and breaking in ----------

  /** Homes you know the address of (off an ID you took). Yours to lose when you die. */
  private get homes(): Home[] {
    return (this.save.state.homes ??= []) as Home[];
  }
  private homeById(id: unknown): Home | undefined {
    return typeof id === 'string' ? this.homes.find((h) => h.id === id) : undefined;
  }
  /** The address you're at. */
  private get atHome(): Home | undefined {
    return this.place === 'home' ? this.homeById(this.save.state.homeAt) : undefined;
  }
  /** What's going on at the address you're at (outside, or in). */
  private get job(): HomeJob | undefined {
    const j = this.save.state.job as HomeJob | undefined;
    return j && j.home === this.save.state.homeAt && this.place === 'home' ? j : undefined;
  }
  private newJob(h: Home): HomeJob {
    const j: HomeJob = { home: h.id, in: false, noise: 0 };
    this.save.state.job = j;
    return j;
  }

  /**
   * An ID in your pockets: its address is one you know now (once: an address
   * you've forgotten stays forgotten). Their keys: the locks get changed.
   * Their car keys: that car isn't out front any more.
   */
  /** An address on your map (from an ID, or from their own mouth). */
  private learnHome(home: Home, carrying: Set<string>) {
    const learned = (this.save.state.homesLearned ??= []) as string[];
    if (learned.includes(home.id) && this.homeById(home.id)) return;
    if (!learned.includes(home.id)) learned.push(home.id);
    if (learned.length > 300) learned.splice(0, learned.length - 300);
    if (!this.homeById(home.id)) {
      this.homes.push(JSON.parse(JSON.stringify(home)) as Home);
      while (this.homes.length > 16) {
        const i = this.homes.findIndex((h) => h.id !== this.save.state.homeAt && !carrying.has(h.id));
        if (i < 0) break;
        this.homes.splice(i, 1);
      }
    }
  }
  private learnHomes() {
    const inv = this.inventory;
    const learned = (this.save.state.homesLearned ??= []) as string[];
    const carrying = new Set(inv.items.flatMap((x) => [x.homeInfo?.id, x.opens]).filter((x): x is string => !!x));
    // (They told you where they live.)
    const told = this.encounter?.toldHome ? this.encounter.person.home : null;
    if (told) {
      carrying.add(told.id);
      this.learnHome(told, carrying);
    }
    for (const x of inv.items) {
      if (x.homeInfo && !learned.includes(x.homeInfo.id)) this.learnHome(x.homeInfo, carrying);
      if (x.opens) {
        const h = this.homeById(x.opens);
        // Their keys went with you: give them a day or two, and they'll have the locks changed.
        if (h && h.lockAt == null) h.lockAt = h.deadAt && h.household === 'alone' ? NEVER : now() + (10 + Math.random() * 38) * 3_600_000;
      }
      // (The spare off the hook: you've got that car now.)
      // (Their keys, from the hook or their pocket: that car isn't out front for anyone else to take.)
      if (x.kind === 'car keys' && x.carOf) {
        const h = this.homeById(x.carOf);
        if (h?.carClaim && x.carId !== h.carClaim) {
          // (Another set of keys to a car you've already got the keys to: the same car, if it's still about.)
          x.carId = h.carClaim;
          x.car = this.carById(h.carClaim) ? 'found' : 'gone';
          delete x.hunt;
        } else if (h && !h.carClaim) {
          if (h.car == null && x.car !== 'found') x.car = 'gone';
          else {
            // (A spare off the hook: the car's out front now. Pocket keys: the hunt finds it under this id.)
            if (x.car === 'found' && !x.carId && this.inventory.items.includes(x)) this.ensureCar(x);
            x.carId ??= Math.random().toString(36).slice(2, 10);
            h.carClaim = x.carId;
            h.car = null;
          }
        }
        // (And it's out front, where they left it: a car you know about.)
        // (A fob from before, its car long gone: it's gone.)
        if (x.car === 'found' && this.inventory.items.includes(x)) {
          this.ensureCar(x);
        }
      } else if (x.kind === 'car keys' && x.car === 'found' && x.carId && !this.carById(x.carId) && this.inventory.items.includes(x)) x.car = 'gone';
      // (Keys back from whoever had them: as old as the car knows they are.)
      if (x.kind === 'car keys' && x.carId) {
        const c = this.carById(x.carId);
        if (c && (x.takenAt == null || c.takenAt < x.takenAt)) {
          x.tookAt ??= x.takenAt;
          x.takenAt = c.takenAt;
        }
      }
    }
  }

  /** The person the address belongs to, if you've met them (you have: you've got their ID). */
  private ownerOf(h: Home): Known | undefined {
    return this.people.find((k) => k.person.home?.id === h.id);
  }
  /**
   * Who's in, right now. `any` is whoever you haven't already met face to face
   * in there (someone you've fought in the hall isn't going to surprise you).
   */
  private presence(h: Home): { owner: Presence; other: Presence | null; any: Presence } {
    const k = this.ownerOf(h);
    if (k) heal(k);
    const e = this.encounter;
    const j = this.job;
    // You've just left them somewhere (or they're right here with you on the street): not home yet.
    const away = !j?.metOwner && ((!!e && !e.resident && e.person.home?.id === h.id) || (!!k && now() - k.at < 2 * 3_600_000));
    const w = whoIsIn(h, now(), away);
    // A broken leg keeps you home.
    if (!away && !h.deadAt && w.owner === 'out' && k?.broken.some((p) => /(leg|ankle)$/.test(p) || p === 'spine')) w.owner = 'awake';
    if (j?.woke || (h.wokeAt && now() - h.wokeAt < 3_600_000)) {
      if (w.owner === 'asleep') w.owner = 'awake';
      if (w.other === 'asleep') w.other = 'awake';
    }
    if (j?.metOwner) w.owner = 'awake';
    if (j?.metOther) w.other = 'awake';
    return { ...w, any: anyoneIn({ owner: j?.metOwner ? 'out' : w.owner, other: j?.metOther ? 'out' : w.other }) };
  }
  private hasKeyTo(h: Home): boolean {
    return this.inventory.items.some((x) => x.opens === h.id);
  }
  /** Every level you've got, the fighting styles' included (for the level-up sound). */
  private levelSum(): number {
    type L = { level?: unknown };
    const st = this.stats as unknown as Record<string, L & Record<string, L>>;
    let n = 0;
    for (const [k, x] of Object.entries(st)) {
      if (k === 'styles') for (const y of Object.values(x ?? {}) as L[]) n += typeof y?.level === 'number' ? y.level : 0;
      else if (typeof x?.level === 'number') n += x.level;
    }
    return n;
  }
  /** What walking off from a confrontation looked like (said on arriving wherever you went). */
  private offLines: string[] = [];
  /** Blacked out or nodded off with someone across the street, or a fight just over: it's gone (and a fight in a house counts for what it was). */
  private dropEncounter() {
    const e = this.encounter;
    if (!e || (e.stage !== 'seen' && e.stage !== 'over')) return;
    if (e.stage === 'over' && e.resident) this.afterResidentFight(e);
    this.encounter = null;
  }
  /** Out of the house you're at: a fight in there counts for what it was, and the job's done. */
  private walkOutOfHome() {
    // Walking off while they stand there looking at you: that's running, and they saw you.
    const j = this.save.state.job as HomeJob | undefined;
    if (j?.confront && j.home === this.save.state.homeAt) {
      this.offLines = ['You walk straight out past them, and keep going.'];
      if (anonymity(this.inventory) < 0.6 || sawFace(j, j.confront.owner)) this.offLines.push('They saw your face. They’ll be telling the police what you look like.');
    }
    if (this.encounter?.resident) this.afterResidentFight(this.encounter);
    this.leaveHome();
    // (Cleared while this is still the address, so a death in there stays with this house.)
    this.encounter = null;
  }
  /** After a break-in, once the new locks are in: the camera, the alarm they paid for. */
  private fixUp(h: Home) {
    if (!h.fixedAt || now() < h.fixedAt) return;
    if (h.addCam) h.cam = true;
    if (h.addAlarm) h.alarm = h.sign = true;
    delete h.addCam;
    delete h.addAlarm;
  }
  /** An officer out front, walking round the car of theirs you've got the keys to. */
  private copsOutFront(h: Home): boolean {
    return this.cars.some((c) => c.home === h.id && now() < c.towAt && this.copsAtCar(c));
  }
  /** The police are at the address (after an alarm, a call, a body). */
  private policeThere(h: Home): boolean {
    return !!h.scene && now() < h.scene.until;
  }

  /** Walk to an address you know. */
  private goHome(id: string) {
    const h = this.homeById(id);
    if (!h || this.ending || this.save.state.policeStop) return;
    if (this.place === 'home' && this.save.state.homeAt === id) return this.closeSheet();
    // (Settled at the old address, before the next one is "where you are".)
    if (this.place === 'home') this.walkOutOfHome();
    this.save.state.homeAt = id;
    delete this.save.state.job;
    // (From one address to the next: by way of the street.)
    if (this.place === 'home') this.place = 'street';
    this.goTo('home');
  }

  /**
   * What you can see from outside. Not the whole truth: a TV left on for the
   * dog, a lamp on a timer, the car home while they took the bus.
   */
  private homeCues(h: Home): string[] {
    const p = this.presence(h);
    const big = h.type === 'house' || h.type === 'rowhouse';
    const out: string[] = [];
    if (this.policeThere(h)) out.push(h.scene!.body ? 'Police tape across the door, a patrol car out front, and a van with its back doors open.' : 'A patrol car out front, lights turning. An officer on the steps, talking to a neighbor in a bathrobe.');
    out.push(
      h.type === 'house'
        ? h.wealth > 1.15
          ? 'A two-story house with a trimmed hedge, a porch light and a side gate.'
          : 'A one-story house behind a chain-link fence, the yard gone to weeds.'
        : h.type === 'rowhouse'
          ? 'A narrow rowhouse in a row of them, three steps up to the door.'
          : h.type === 'apartment'
            ? `A brick apartment building with a buzzer panel by the street door. Their door is ${h.floor === 1 ? 'off the ground-floor hall' : `on the ${ordinal(h.floor)} floor, off the stairs; a fire escape zigzags down the back`}.`
            : 'A rooming house: a hallway of numbered doors, one bathroom at the end, a pay phone nobody uses. You stand outside their door.',
    );
    const r = steady(h, now(), 7);
    const lit = p.any === 'awake' ? r < 0.85 : p.any === 'asleep' ? r < 0.1 : r < 0.35;
    const tv = steady(h, now(), 8) < 0.5;
    out.push(
      h.type === 'room'
        ? lit
          ? 'Light under the door, and a radio going.'
          : 'No light under the door.'
        : h.type === 'apartment'
          ? lit
            ? tv
              ? 'Their window’s lit, and a TV’s going.'
              : 'Their window’s lit.'
            : 'Their window’s dark.'
          : lit
            ? tv
              ? 'Lights on inside, and the blue flicker of a TV.'
              : 'A lamp on in the front room.'
            : 'Dark windows.',
    );
    // The car's out front when they are, mostly.
    // (The car you've got the spare to, still where they left it.)
    // (Not once it's been towed, or the keys have gone from you.)
    const mine = this.cars.find((c) => c.home === h.id && now() < c.towAt && this.keysKept(c.id));
    if (mine) {
      out.push(`Their ${mine.color} ${mine.make} still parked out front, and you’ve got the keys to it.`);
      if (this.copsAtCar(mine) && !this.policeThere(h)) out.push(`A patrol car pulled up behind the ${mine.make}, and an officer walking around it with a flashlight.`);
    } else if (this.cars.some((c) => c.home === h.id && now() < c.towAt)) {
      // (Still there, the keys gone from you.)
      const c = this.cars.find((x) => x.home === h.id && now() < x.towAt)!;
      out.push(`Their ${c.color} ${c.make} parked out front.`);
      if (this.copsAtCar(c) && !this.policeThere(h)) out.push(`A patrol car pulled up behind the ${c.make}, and an officer walking around it with a flashlight.`);
    } else if (this.cars.some((c) => c.home === h.id) && big) out.push('Nothing parked out front.');
    else if (h.car && big) out.push((p.owner !== 'out' || h.works === 'home' || h.deadAt ? steady(h, now(), 9) < 0.9 : steady(h, now(), 9) < 0.2) ? `A ${h.car} parked out front.` : 'Nothing parked out front.');
    if (h.sign) out.push(h.type === 'house' ? 'A security company sign in the flowerbed.' : 'A security company sticker on the door.');
    if (h.cam) out.push('A doorbell camera by the front door. It sees whoever comes up the steps.');
    if (h.dogKnown && h.dog) out.push(h.dog === 'big' ? 'Something big lives in there. You heard it.' : 'A small dog in there, yapping at every sound.');
    if (h.fixedAt && now() > h.fixedAt) out.push(now() - h.fixedAt < 30 * 86_400_000 ? 'A new deadbolt on the door, the brass still shiny.' : 'A deadbolt on the door that wasn’t there the first time.');
    if (h.deadAt && now() - h.deadAt > 86_400_000) out.push('Mail piling up in the box. Nobody’s been home for a while.');
    return out;
  }
  /** Is the car out front right now (for the spare on the kitchen hook)? */
  private carHere(h: Home): boolean {
    const p = this.presence(h);
    return !!h.car && (p.owner !== 'out' || h.works === 'home' || !!h.deadAt ? steady(h, now(), 9) < 0.9 : steady(h, now(), 9) < 0.2);
  }

  /** The address: outside, or in. */
  private homeHtml(h: Home, btn: (attr: string, v: string | number, label: string, no?: string | false | null) => string, li: (name: string, small: string, button: string) => string): string {
    this.fixUp(h);
    const j = this.job;
    const health = this.health;
    if (j?.confront) {
      return (
        `<p class="home-alert">${j.confront.text}</p><ul class="shop-list">` +
        li('Get out', 'Back out the way you came in, now. They’ve seen you.', btn('homeact', 'flee', 'Run')) +
        li('Go at them', `${j.confront.phoned ? 'Before they can finish the call.' : 'Before they can get to a phone.'} It’s their house; they’ll fight for it.`, btn('homeact', 'fight', 'Fight')) +
        `</ul>`
      );
    }
    if (j?.in) {
      const p = this.presence(h);
      const looked = (r: RoomId) => h.looked?.[r] != null && now() - h.looked[r]! < 10 * 86_400_000;
      const rows = roomsOf(h)
        .map((r) => {
          const n = looked(r) ? (h.left?.[r]?.length ?? 0) : 0;
          return li(roomName(h, r), !looked(r) ? ROOM_DESC[r] : n ? `${n} thing${n > 1 ? 's' : ''} you could take, below.` : 'You’ve been through it.', btn('homeact', `room:${r}`, 'Go through it', looked(r) && 'Searched'));
        })
        .join('');
      // What you've turned up: yours to pick from, one thing at a time.
      const found = roomsOf(h).flatMap((r) => (looked(r) ? (h.left?.[r] ?? []).map((l, i) => ({ l, at: `${r}:${i}`, where: roomName(h, r) })) : []));
      const state =
        (j.siren ? 'The alarm is screaming. ' : '') +
        (j.killed ? 'There’s a body in the hall. ' : '') +
        (p.any === 'asleep' ? 'Someone’s asleep in here. You can hear them breathing. ' : p.any === 'out' && !j.metOwner && !j.metOther && !j.siren ? 'Quiet. Nobody moving. ' : '') +
        (j.phoned ? 'They called the police. Not long now. ' : '');
      return (
        `<p class="home-state">You’re inside. ${state}Every room you go through, and everything you pick up, takes time and makes noise.</p><ul class="shop-list">${rows}${li('Get out', 'With what you’ve got.', btn('homeact', 'out', 'Leave'))}</ul>` +
        this.foundHtml(found, 'homeact', btn, li)
      );
    }
    const legs = health.broken.filter((p) => p.endsWith('leg')).length;
    const key = this.hasKeyTo(h);
    const cops = (this.policeThere(h) || this.copsOutFront(h)) && 'Police outside';
    const dog = cops || (h.dogKnown && h.dog === 'big' && 'The dog');
    const knocked = j?.knocked || (h.knockedAt != null && now() - h.knockedAt < 30 * 60_000);
    const tried = j?.tried || (h.triedAt != null && now() - h.triedAt < 6 * 3_600_000);
    return (
      `<ul class="home-cues">${this.homeCues(h).map((l) => `<li>${l}</li>`).join('')}</ul>` +
      `<ul class="shop-list">` +
      li('Knock', 'See if anyone answers. Whoever opens the door sees your face.', btn('homeact', 'knock', 'Knock', cops || (knocked && 'Knocked'))) +
      (key ? li('Their keys', 'Let yourself in, quiet as anything. If the locks are still the same.', btn('homeact', 'key', 'Use them', dog)) : '') +
      li('Try the doors and windows', 'Quiet. People leave a back door unlocked more than you’d think.', btn('homeact', 'try', 'Try', dog || (tried && 'Locked'))) +
      li('Break a window', h.type === 'apartment' && h.floor > 1 ? 'Up the fire escape. Loud, and the whole building hears glass go. Glass cuts.' : 'Loud. Glass cuts.', btn('homeact', 'window', 'Break it', dog || (h.type === 'room' && 'No window off the hall'))) +
      li('Kick the door in', 'Strength. Very loud, and it might not give.', btn('homeact', 'kick', 'Kick it', dog || (legs ? 'Not on that leg' : null))) +
      `</ul>`
    );
  }

  /** Something done at the address. */
  private homeAct(what: string) {
    addFatigue(this.health, 0.6);
    const h = this.atHome;
    if (!h || this.ending || this.encounter || this.sheet === 'police' || this.save.state.policeStop) return;
    this.fixUp(h);
    const j = this.job ?? this.newJob(h);
    const inv = this.inventory;
    const health = this.health;
    const anon = anonymity(inv);
    const lines: string[] = [];
    const atDoor = () => {
      // A doorbell camera: your face (or your mask) on someone's phone.
      if (h.cam && !j.filmed) {
        j.filmed = true;
        j.faceFilmed = anon < 0.6;
      }
    };
    if (j.confront && what === 'flee') {
      lines.push(j.how === 'window' || (j.how === 'try' && h.type !== 'room') ? 'You go back out the way you came in, fast, and don’t stop for three blocks.' : oneOf(['You go back out the way you came, fast, and don’t stop for three blocks.', 'You’re out the door and gone before they can get it shut behind you.']));
      const face = anon < 0.6 || sawFace(j, j.confront.owner);
      if (face) lines.push('They saw your face. They’ll be telling the police what you look like.');
      j.seen ||= face;
      j.called = true;
      this.leaveHome(lines);
      return;
    }
    if (j.confront && what === 'fight') {
      this.residentFight(h, j);
      return;
    }
    if (j.confront) return;
    // ---- Outside ----
    if (!j.in) {
      if (this.policeThere(h) || this.copsOutFront(h)) return;
      if (what === 'knock' && !j.knocked && !(h.knockedAt != null && now() - h.knockedAt < 30 * 60_000)) {
        j.knocked = true;
        h.knockedAt = now();
        atDoor();
        const p = this.presence(h);
        const barked = this.dogHeard(h, lines, 0.9) || (!!h.dog && h.dogKnown);
        if (p.any === 'awake') {
          const masked = wearing(inv).masked;
          if (masked) lines.push('Footsteps. Someone looks at you through the peephole for a long moment, and doesn’t open. A chain rattles on.');
          else {
            lines.push(oneOf(['The door opens on the chain. “Yes?” You ask for someone who doesn’t live here. The door shuts.', '“Who is it?” You give a name, any name, and ask if this is the right place. “No.” Footsteps going away.']));
            j.seen = true;
            h.sawYou = true;
          }
        } else if (p.any === 'asleep' && Math.random() < 0.4) {
          j.woke = true;
          h.wokeAt = now();
          lines.push('Nothing. Then a light comes on somewhere inside, and stays on. Nobody comes to the door.');
        } else lines.push(barked ? 'The barking goes on and on. Nobody comes to the door.' : oneOf(['Nothing. You knock again. Nothing.', 'You knock and wait. Not a sound from inside.']));
        return this.homeNote(h, j, lines, 0.05);
      }
      let entry: 'key' | 'try' | 'window' | 'kick' | null = null;
      if (what === 'key' && this.hasKeyTo(h)) {
        atDoor();
        if (now() >= (h.lockAt ?? NEVER) && h.lockAt !== NEVER) {
          lines.push('The key goes in, and won’t turn. They’ve had the locks changed.');
          inv.items = inv.items.filter((x) => x.opens !== h.id);
          lines.push('You drop the useless keys down a drain.');
          return this.homeNote(h, j, lines, 0);
        }
        lines.push(h.type === 'apartment' ? `The street door, the ${h.floor === 1 ? 'hall' : 'stairs'}, their door. The deadbolt turns like it’s glad to see you.` : 'The key turns. The door swings open onto the smell of someone else’s home.');
        entry = 'key';
      } else if (what === 'try' && !j.tried && !(h.triedAt != null && now() - h.triedAt < 6 * 3_600_000)) {
        j.tried = true;
        h.triedAt = now();
        this.dogHeard(h, lines, 0.6);
        const odds = h.type === 'house' ? 0.3 : h.type === 'rowhouse' ? 0.2 : h.type === 'room' ? 0.25 : h.floor === 1 ? 0.15 : 0.08;
        if (Math.random() < odds * (h.fixedAt && now() > h.fixedAt ? 0.3 : 1)) {
          lines.push(h.type === 'room' ? 'The lock’s a joke. You slip it with a card and you’re in.' : h.type === 'apartment' && h.floor > 1 ? 'Up the fire escape. Their window isn’t latched.' : oneOf(['The back door isn’t locked.', 'A window around the side slides up. Not even latched.']));
          entry = 'try';
        } else {
          lines.push(oneOf(['Locked, all of it. The back door, the windows. Somebody here is careful.', 'You go around every door and window you can reach. Locked.']));
          return this.homeNote(h, j, lines, 0.05);
        }
      } else if (what === 'window' && h.type !== 'room') {
        lines.push(`${h.type === 'apartment' && h.floor > 1 ? 'You climb the fire escape to their window. ' : ''}You pull your sleeve down over your elbow and put it through the glass. It’s loud. It’s always louder than you think.`);
        if (Math.random() < 0.3) {
          health.bleeding = Math.max(health.bleeding, 1);
          lines.push('A shard opens your forearm on the way in. You’re bleeding.');
        }
        this.dogHeard(h, lines, 1);
        entry = 'window';
      } else if (what === 'kick' && !health.broken.some((p) => p.endsWith('leg'))) {
        atDoor();
        const odds = (h.type === 'apartment' ? 0.2 : 0.35) * (h.fixedAt && now() > h.fixedAt ? 0.5 : 1) + (this.stats.strength.level - 1) * 0.025 - fatigueOdds(this.health);
        this.dogHeard(h, lines, 1);
        if (Math.random() < odds) {
          lines.push('Third kick, and the frame splits around the deadbolt. The door bangs open.');
          train(this.stats, 'strength', 4);
          entry = 'kick';
        } else {
          lines.push('You kick it, and kick it again. It shakes in the frame and holds. Everyone on the street heard that.');
          train(this.stats, 'strength', 2);
          return this.homeNote(h, j, lines, 0.8);
        }
      } else return;
      // ---- Going in ----
      const p = this.presence(h);
      if (h.dog === 'big') {
        h.dogKnown = true;
        const through = entry === 'window' || (entry === 'try' && h.type !== 'room');
        lines.push(through ? 'A big dog comes out of the dark at you, all teeth. It gets your arm as you come through, and you fall back out.' : 'A big dog comes skidding down the hall at you, all teeth. It gets your arm before you can get the door between you.');
        health.bleeding = Math.max(health.bleeding, 2);
        health.blood = Math.max(health.maxBlood * 0.55, health.blood - 300);
        health.stress = Math.min(100, (health.stress ?? 0) + 25);
        this.fx.impact(true, 300, true, 'spatter');
        lines.push('You’re back outside, bleeding, and the dog is still going.');
        return this.homeNote(h, j, lines, 0.7);
      }
      j.in = true;
      j.how = entry;
      j.occupied = p.any !== 'out';
      const noise = { key: 0.05, try: 0.08, window: h.type === 'apartment' ? 0.6 : 0.5, kick: 0.85 }[entry];
      // The alarm: armed when nobody's home (and some nights).
      if (h.alarm && (p.any === 'out' ? Math.random() < 0.9 : p.any === 'asleep' ? Math.random() < 0.5 : false)) {
        j.siren = true;
        j.policeIn = 3;
        lines.push('A beep, beep, beep from a panel by the door, then the siren, deafening. You’ve got minutes.');
      }
      if (h.dog === 'small' && !lines.some((l) => /yapping/.test(l))) lines.push('A little dog goes off at your feet, yapping and yapping.');
      if (p.any === 'awake') return this.confront(h, j, lines, 'awake');
      if (p.any === 'asleep' && Math.random() < noise * 0.8 + (h.dog ? 0.3 : 0) + (j.siren ? 0.9 : 0)) return this.confront(h, j, lines, 'woke');
      return this.homeNote(h, j, lines, noise);
    }
    // ---- Inside ----
    if (what === 'out') {
      lines.push(j.killed ? 'You step over them on the way out, and pull the door shut behind you. Walk. Don’t run.' : 'You let yourself out, and walk. Not fast. Fast looks wrong.');
      this.leaveHome(lines);
      return;
    }
    h.left ??= {};
    h.looked ??= {};
    // Picking something up (or all of it): a moment's noise, in that room.
    const tk = /^take:(\w+):(\d+|all)$/.exec(what);
    if (tk) {
      const room = tk[1] as RoomId;
      const there = h.left[room];
      if (!roomsOf(h).includes(room) || !there?.length || h.looked[room] == null) return;
      const picks = tk[2] === 'all' ? [...there] : there[Number(tk[2])] ? [there[Number(tk[2])]] : [];
      if (!picks.length) return;
      for (const l of picks) {
        const r = take(inv, l);
        lines.push(r.text);
        // (Cash, even some of it, is taken.)
        if (l.kind === 'cash' && r.cents) j.cash = (j.cash ?? 0) + r.cents;
        if (!r.ok) {
          if (l.kind === 'cash' && r.cents) j.took = (j.took ?? 0) + 1;
          continue;
        }
        there.splice(there.indexOf(l), 1);
        j.took = (j.took ?? 0) + 1;
      }
      return this.homeNote(h, j, lines, picks.length > 1 ? 0.08 : 0.03, room);
    }
    const m = /^room:(\w+)$/.exec(what);
    if (!m) return;
    const room = m[1] as RoomId;
    if (!roomsOf(h).includes(room)) return;
    const fresh = h.looked[room] == null || now() - h.looked[room]! >= 10 * 86_400_000;
    if (!fresh) return;
    h.left[room] = roomLoot(h, room, this.carHere(h));
    h.looked[room] = now();
    // (A car you've already had: its spare isn't worth anything now.)
    if (h.car == null && h.left[room]?.some((l) => l.kind === 'car keys' && l.carOf)) h.left[room] = h.left[room]!.filter((l) => !(l.kind === 'car keys' && l.carOf));
    const there = h.left[room] ?? [];
    lines.push(there.length ? `${ROOM_SEARCH[room]} You turn up ${list2(there.map(lootA))}.` : `${ROOM_SEARCH[room]} Nothing worth taking.`);
    this.homeNote(h, j, lines, 0.12, room);
  }

  /** A dog behind the door, if there is one. */
  private dogHeard(h: Home, lines: string[], odds: number): boolean {
    if (h.dog && !h.dogKnown && Math.random() < odds) {
      h.dogKnown = true;
      lines.push(h.dog === 'big' ? 'A deep bark from right behind the door, and claws on the floor. Something big.' : 'A small dog starts yapping inside, and doesn’t stop.');
      return true;
    }
    return false;
  }

  /**
   * After each thing you do there: the noise you made, the neighbors, whoever's
   * asleep in there, whoever's coming home. Then what happened, as a note.
   */
  private homeNote(h: Home, j: HomeJob, lines: string[], noise: number, room?: RoomId) {
    // (What happened is at the top of the card: show it.)
    this.shopAt = '';
    j.noise += noise;
    const night = partOfDay() === 'night';
    // The police: on their way (an alarm, a call), or someone hears you.
    if (j.policeIn != null) {
      j.policeIn--;
      if (j.policeIn <= 0) return this.policeAtHome(h, j, lines);
    } else if (Math.random() < (noise >= 0.3 ? noise : noise * 0.15) * (night ? 0.4 : 0.55) * (h.type === 'house' ? 0.8 : 1.3)) {
      j.policeIn = 2 + Math.floor(Math.random() * 3);
      if (noise >= 0.5) lines.push(h.type === 'house' ? oneOf(['A light comes on in the house next door.', 'Somewhere a window goes up, and a voice says “Hey!”']) : oneOf(['A door opens somewhere down the hall, and closes again.', 'Somewhere a window goes up, and a voice says “Hey!”']));
    }
    if (j.in) {
      const p = this.presence(h);
      // Someone asleep in there: the noise, and the bedroom most of all.
      if (p.any === 'asleep' && Math.random() < noise * 0.7 + (room === 'bedroom' ? 0.3 : room ? 0.06 : 0)) return this.confront(h, j, lines, 'woke');
      // Someone out: they come home some time (not the one you left on the floor, or the street).
      if (p.any === 'out' && room && Math.random() < 0.05 + (h.household === 'family' ? 0.06 : 0)) {
        const ownerCan = !h.deadAt && !j.metOwner && p.owner === 'out' && !(this.ownerOf(h) && now() - this.ownerOf(h)!.at < 2 * 3_600_000);
        const otherCan = h.household !== 'alone' && !j.metOther;
        if (ownerCan || otherCan) return this.confront(h, j, lines, 'home', ownerCan && (!otherCan || Math.random() < 0.6));
      }
    }
    this.refresh();
    this.note(lines);
    buzz(noise > 0.4 ? [20, 30, 20] : 8);
  }

  /** Someone in the house sees you. */
  private confront(h: Home, j: HomeJob, lines: string[], how: 'awake' | 'woke' | 'home', ownerHome?: boolean) {
    // (What happened is at the top of the card: show it.)
    this.shopAt = '';
    const p = this.presence(h);
    const owner = how === 'home' ? !!ownerHome : !j.metOwner && p.owner !== 'out' && (j.metOther || p.other === 'out' || p.other == null || Math.random() < 0.6);
    // (Who saw your face: this one, as you were when they came on you.)
    const seenAnon = anonymity(this.inventory);
    if (seenAnon < 0.6) j.faceSeen = { ...(typeof j.faceSeen === 'object' ? j.faceSeen : {}), [owner ? 'owner' : 'other']: seenAnon };
    const sex: 'Male' | 'Female' = owner ? h.sex : h.household === 'partner' ? (Math.random() < 0.8 ? (h.sex === 'Male' ? 'Female' : 'Male') : h.sex) : Math.random() < 0.5 ? 'Male' : 'Female';
    const [He, he, his] = sex === 'Male' ? ['He', 'he', 'his'] : ['She', 'she', 'her'];
    const who = owner ? h.owner.split(' ')[0] : sex === 'Male' ? 'a man' : 'a woman';
    const Who = who[0].toUpperCase() + who.slice(1);
    const known = owner ? (this.inventory.items.some((x) => x.homeInfo?.id === h.id) ? ' The face off the ID in your pocket.' : ' The face off the ID you took.') : '';
    const broken = j.how === 'kick' || j.how === 'window';
    // On two broken legs, the owner's in bed and staying there.
    const ownerK = owner ? this.ownerOf(h) : undefined;
    if (ownerK) heal(ownerK);
    const crippled = owner && (ownerK?.broken.includes('spine') || new Set(ownerK?.broken.filter((b) => /(leg|ankle)$/.test(b)).map((b) => b.split(' ')[0])).size >= 2);
    const body = !!j.killed;
    j.occupied = true;
    j.woke = true;
    h.wokeAt = now();
    let text =
      crippled && how !== 'home'
        ? `A light snaps on. ${Who} is in the bed, both legs in casts, and can’t get up.${known} ${He} sees you, and starts screaming for help.`
        : how === 'awake'
        ? `You’re barely inside when someone steps into the hall: ${who}.${known} ${He} stares at you, and then ${he} understands.`
        : how === 'woke'
          ? h.type === 'room'
            ? `A light snaps on. ${Who} is sitting up in the bed, half asleep, then not at all.${known}`
            : `A light snaps on. ${Who} is in the bedroom doorway, half asleep, then not at all.${known}`
          : broken && j.how === 'kick'
            ? body
              ? `Someone pushes the broken door open and stops dead: ${who}. ${He} sees the body in the hall, and then ${he} sees you.${known}`
              : `Someone pushes the broken door open and stops dead: ${who}, looking straight at you.${known}`
            : body
            ? `Keys in the front door. It opens, and ${who} sees the body in the hall before ${he} sees you. Then ${he} sees you.${known}`
            : partOfDay() === 'night'
              ? `Keys in the front door. It opens, and ${who} is standing there in a work jacket, keys still in hand, looking straight at you.${known}`
              : `Keys in the front door. It opens, and ${who} is standing there with a bag of groceries, looking straight at you.${known}`;
    // Most reach for a phone (anyone who's just found a body, all of them).
    const phones = Math.random() < (body ? 0.95 : 0.65);
    if (phones) {
      j.policeIn = Math.min(j.policeIn ?? 4, 4);
      j.phoned = true;
      text += ` ${He}’s got a phone in ${his} hand.`;
    }
    j.confront = { owner, sex, text, how, phoned: phones };
    this.refresh();
    this.note(lines.length ? lines : [text]);
    buzz([40, 40, 80]);
  }

  /** Going at whoever lives there: it's a fight, in their hallway. */
  private residentFight(h: Home, j: HomeJob) {
    const c = j.confront;
    if (!c) return;
    const k = c.owner ? this.ownerOf(h) : undefined;
    let person = k ? meet(k) : makePerson();
    if (!k) {
      // Someone of the kind who'd live here (dressed like it).
      const kind = h.kind === 'junkie' ? 'junkie' : h.kind === 'drunk' && Math.random() < 0.5 ? 'drunk' : 'civilian';
      for (let i = 0; i < 40 && person.kind !== kind; i++) person = makePerson();
      person.kind = kind;
      person.sex = c.sex;
      // (Their things say who they are, and where they live: here.)
      const name = c.owner ? h.owner : nameFor(c.sex, person.race);
      person.name = name;
      person.home = c.owner ? h : null;
      for (const g of person.clothes)
        for (const l of g.loot) {
          if (l.kind === 'id') {
            l.detail = `${name}, ${person.age ?? 30}`;
            if (l.card) l.card = { ...l.card, addr: h.addr, sex: c.sex === 'Male' ? 'M' : 'F' };
            l.homeInfo = h;
          } else if (/card/.test(l.kind)) l.detail = name;
          else if (l.opens) l.opens = h.id;
          else if (l.kind === 'car keys') {
            // (Theirs is the car out front, if any; someone else in the house drives something else.)
            if (c.owner && h.car) {
              l.detail = `${h.car} key fob`;
              l.carOf = h.id;
            } else if (c.owner) g.loot = g.loot.filter((x) => x !== l);
            else delete l.carOf;
          }
        }
    }
    // What they've put down somewhere in the house (not on them now): theirs again when they're next out.
    const away: { garments: typeof person.clothes; loot: Loot[]; top?: (typeof person.clothes)[number]; carrying: typeof person.carrying } = { garments: [], loot: [], carrying: [] };
    // Out of bed, or already in for the night: no shopping, no backpack.
    if (c.how !== 'home') {
      away.garments.push(...person.clothes.filter((g) => g.name === 'Grocery bag' || g.name === 'Backpack'));
      person.clothes = person.clothes.filter((g) => g.name !== 'Grocery bag' && g.name !== 'Backpack');
      away.carrying.push(...person.carrying.filter((x) => x.name === 'Grocery bag' || x.name === 'Backpack'));
      person.carrying = person.carrying.filter((x) => x.name !== 'Grocery bag' && x.name !== 'Backpack');
    }
    // Out of bed: barefoot, no coat, nothing in their pockets (the wallet's on the dresser, not on them).
    if (c.how === 'woke') {
      const pocketed = (l: Loot) => l.kind === 'id' || l.kind === 'cash' || /card/.test(l.kind) || l.kind === 'car keys' || l.kind === 'phone' || !!l.opens || l.where === 'wallet';
      for (const g of person.clothes) {
        away.loot.push(...g.loot.filter(pocketed));
        g.loot = g.loot.filter((l) => !pocketed(l));
      }
      away.garments.push(...person.clothes.filter((g) => /shoe|boot|sneaker|loafer|slide/i.test(g.name)));
      person.clothes = person.clothes.filter((g) => !/shoe|boot|sneaker|loafer|slide/i.test(g.name));
      if (person.clothes[0] && /coat|jacket|blazer|windbreaker|puffer|parka|hoodie|flannel/i.test(person.clothes[0].name)) {
        away.top = person.clothes[0];
        person.clothes[0] = { name: 'T-shirt', loot: [], searched: false };
      }
    }
    // The phone they were calling on went across the floor.
    if (j.phoned)
      for (const g of person.clothes) {
        away.loot.push(...g.loot.filter((l) => l.kind === 'phone'));
        g.loot = g.loot.filter((l) => l.kind !== 'phone');
      }
    const inv = this.inventory;
    const e = newEncounter(person, this.yourBody());
    if (this.atBar) e.bar = true;
    e.conspicuous = conspicuous(inv);
    if (k) {
      applyTo(k, e.them);
      // (A mask pulled up once they've already seen your face doesn't hide it.)
      const anon = faceAnon(j, c.owner, anonymity(inv));
      e.recognised = recognises(k, anon, lookClothes(inv));
      e.lookAt = { anon, clothes: lookClothes(inv).join('|') };
      e.grudge = k.memory.grudge;
      e.history = k.memory.otherLife ? undefined : historyText(k);
      e.looks = [...injuriesText(k), ...marksText(k.marks)];
      e.dread = k.memory.fear ?? 0;
    }
    e.start = { blood: e.them.blood, broken: [...e.them.broken] };
    e.resident = { owner: c.owner, how: c.how, phoned: !!c.phoned, away };
    j.cashBefore = Math.round(cashOf(inv) * 100);
    if (c.owner) j.metOwner = true;
    else j.metOther = true;
    delete j.confront;
    this.encounter = e;
    this.phase = 'idle';
    this.act('ambushed');
    buzz([60, 40, 90]);
  }

  /** The fight in the house is over: what that means for the rest of it. */
  private afterResidentFight(e: Encounter) {
    const j = this.job;
    const h = this.atHome;
    if (!j || !h || e.afterDone) return;
    e.afterDone = true;
    if (e.them.dead) j.killed = true;
    else if (e.them.out || e.result === 'won' || e.result === 'walked' || e.them.broken.length > (e.start?.broken.length ?? 0) || e.them.blood < (e.start?.blood ?? e.them.blood) - 1) j.beat = true;
    // Cash you took off them in there: from the house, as far as the police are concerned.
    const got = Math.round(cashOf(this.inventory) * 100) - (j.cashBefore ?? Math.round(cashOf(this.inventory) * 100));
    if (got > 0) j.cash = (j.cash ?? 0) + got;
    delete j.cashBefore;
    // They ran out (to the neighbors, to a phone), or you let them go: the police are coming, fast.
    if (e.result === 'they-fled' || e.result === 'lost-them' || e.result === 'left') {
      j.policeIn = Math.min(j.policeIn ?? 2, 2);
      j.phoned = true;
    }
    // You ran: you're gone, and they saw you. (Walking away from them where they lie, you're still in the house.)
    if (e.result === 'you-fled') {
      j.called = true;
      j.seen ||= anonymity(this.inventory) < 0.6 || sawFace(j, !!e.resident?.owner);
      this.leaveHome();
      this.place = 'street';
    }
  }

  /** The police, at the house. */
  private policeAtHome(h: Home, j: HomeJob, lines: string[]) {
    if (!j.in) {
      // Still outside: they've had a call about a prowler.
      lines.push('Someone called about a prowler.');
      this.leaveHome();
      h.scene = { until: now() + 45 * 60_000 };
      this.place = 'street';
      this.save.state.policeOffCorner = true;
      this.save.state.policeWhy = lines;
      this.save.state.policeStop = true;
      this.refresh();
      this.openSheet('police');
      return;
    }
    lines.push(j.siren ? 'Sirens, close, then right outside. Car doors. Flashlights in the front window.' : 'Blue light sweeps across the ceiling. Someone called it in. Car doors, quiet ones.');
    this.save.state.policeWhy = lines;
    this.save.state.policeStop = 'burglary';
    this.refresh();
    this.openSheet('police');
    buzz([30, 30, 30]);
  }

  /**
   * Leaving an address (walking off, running, or taken away): if you were in,
   * it's a break-in, and they'll find out. They change the locks, and some
   * put in a camera or an alarm. An alarm, a call or a body: the police are
   * there for a while after.
   */
  private leaveHome(lines?: string[], caught = false) {
    const h = this.homeById(this.save.state.homeAt);
    const j = this.save.state.job as HomeJob | undefined;
    delete this.save.state.job;
    if (!h || !j || j.home !== h.id) {
      if (lines) this.goToStreet(lines);
      return;
    }
    const e = this.encounter;
    if (e?.resident && e.them.dead) j.killed = true;
    // Walked off in the middle of being seen: that's running, and they saw you.
    if (j.confront) {
      j.seen ||= anonymity(this.inventory) < 0.6 || sawFace(j, j.confront.owner);
      j.called = true;
    }
    // Their car keys gone with you, and they know you were in: the car goes on the report too.
    // (Only once they know someone was in: not a prowler call about noise outside.)
    if ((j.in || j.took || j.confront) && (j.called || j.phoned || j.siren || j.policeIn != null || j.killed || caught)) {
      const early = now() - (REPORTED_HOURS * 3_600_000 + 60_000);
      const st = this.save.state;
      const kept = [...this.inventory.items, ...((st.stash as { items: InvItem[] } | undefined)?.items ?? []), ...((st.room as { items: InvItem[] } | undefined)?.items ?? []), ...this.cars.flatMap((c) => c.items)];
      const theirs = new Set<string>();
      for (const x of kept) {
        if (x.kind !== 'car keys' || x.carOf !== h.id) continue;
        if (x.carId) theirs.add(x.carId);
        if ((x.takenAt ?? now()) > early) {
          x.tookAt ??= x.takenAt;
          x.takenAt = early;
        }
      }
      for (const c of this.cars) if ((c.home === h.id || theirs.has(c.id)) && c.takenAt > early) c.takenAt = early;
    }
    if (j.in || j.took) {
      h.hits = (h.hits ?? 0) + 1;
      h.hitAt = now();
      // New locks in a day or two; a camera, an alarm, sometimes. (Unless there's nobody left to do it.)
      const ownerKilled = !!e?.resident?.owner && e.them.dead;
      const nobody = h.household === 'alone' && (!!h.deadAt || ownerKilled);
      if (nobody) h.lockAt = NEVER;
      else if (h.lockAt !== NEVER || h.household !== 'alone') {
        const fix = now() + (18 + Math.random() * 30) * 3_600_000;
        h.lockAt = h.lockAt === NEVER ? fix : Math.min(h.lockAt ?? fix, fix);
        h.fixedAt = fix;
        if (Math.random() < 0.4) h.addCam = true;
        if (Math.random() < 0.25) h.addAlarm = true;
      }
      if (j.killed || j.siren || j.phoned || j.policeIn != null || caught) h.scene = { until: now() + (j.killed ? 6 * 3_600_000 : (45 + Math.random() * 45) * 60_000), body: !!j.killed };
      if (!caught) {
        const f = this.infamy;
        // A burglary gets reported; a face makes it worse; a body, far worse.
        const face = !!j.seen || !!j.faceFilmed;
        // (No gloves, and your prints already on file from an arrest: they match them.)
        const prints = !face && !gloved(this.inventory) && this.record.arrests > 0 && Math.random() < 0.3;
        const charge = j.killed ? 'Homicide' : j.occupied ? 'Home invasion' : 'Burglary';
        // (Nobody saw a thing, and no prints: a break-in on file, but no description to go with it.)
        const unseen = !face && !prints && !j.occupied && !j.killed;
        if (!unseen) this.reportedHeat(6 + (j.occupied ? 14 : 0) + (face ? 12 : 0) + (j.killed ? 30 : 0), face || prints ? 0 : 0.9, { sev: j.killed ? 20 : j.occupied ? 15 : 10, charges: face || prints ? [charge] : [], floor: j.killed ? 75 : j.occupied ? 60 : 40, identified: face || prints });
        if (lines && prints) lines.push('You left prints on the door. They’re on file from your last arrest.');
        if (face) f.burglaries = (f.burglaries ?? 0) + 1;
        if (j.killed && face) f.killsSeen = (f.killsSeen ?? 0) + 1;
        if (lines && j.faceFilmed) lines.push('That doorbell camera got a good look at you.');
      }
    } else if (j.seen || j.faceFilmed) {
      // (Hanging round and knocking: remembered, a little.)
      this.infamy.heat = Math.min(100, this.infamy.heat + 2);
    }
    if (lines) this.goToStreet(lines);
  }
  /** Back out to the street, with what happened as a note. */
  private goToStreet(lines: string[]) {
    this.place = 'street';
    this.shopNote = [];
    this.encounter = null;
    // (Whatever was said in the house stays in the house.)
    this.unstick();
    this.noteEl.hidden = true;
    this.refresh();
    uiGlitch(this.view, 0.4);
    this.note(lines);
    buzz(10);
  }

  /** What's stolen on you: someone else's ID or cards, things from a break-in. */
  private stolen(x: InvItem): boolean {
    return (x.kind === 'id' && x.own !== this.world.lives) || x.kind === 'credit card' || x.kind === 'debit card' || !!x.hot || !!x.opens;
  }

  /** The loose brick in the alley: what's behind it. */
  private get stash(): { items: InvItem[]; cents: number; at: number; seen?: boolean } {
    return (this.save.state.stash ??= { items: [], cents: 0, at: now() }) as { items: InvItem[]; cents: number; at: number; seen?: boolean };
  }
  /** Your room at the Hotel Marlow (if you've rented one): paid until when, and what you left in it. */
  private get room(): { until: number; items: InvItem[]; cents: number; at: number } | undefined {
    return this.save.state.room as { until: number; items: InvItem[]; cents: number; at: number } | undefined;
  }
  /** In your own room (rented, and you're in it): smoke, drink, use, mask up, burn things. */
  private get inOwnRoom(): boolean {
    return this.place === 'room' && this.roomRented;
  }
  private get roomRented(): boolean {
    const r = this.room;
    return !!r && now() < r.until;
  }

  /** Back at the alley: has someone found it? (More likely if someone saw you.) */
  private checkStash(): string[] {
    const s = this.save.state.stash as { items: InvItem[]; cents: number; at: number; seen?: boolean } | undefined;
    if (!s) return [];
    const days = Math.max(0, (now() - s.at) / 86_400_000);
    s.at = now();
    if (!s.items.length && !s.cents) return [];
    if (Math.random() < 1 - Math.pow(1 - (s.seen ? 0.3 : 0.04), days)) {
      s.items = [];
      s.cents = 0;
      s.seen = false;
      return ['The loose brick is lying in the gravel. Behind it, nothing. Someone found your stash.'];
    }
    return [];
  }

  /** Back at the room: rent run out (they clear it), or someone's been in. */
  private checkRoom(): string[] {
    const r = this.room;
    if (!r) return [];
    const t = now();
    if (t > r.until + 2 * 86_400_000) {
      delete this.save.state.room;
      return ["Your key doesn’t turn. The man in the cage doesn’t look up: the rent ran out, so they cleared the room. Whatever you left is in a dumpster, or in someone’s pocket."];
    }
    const days = Math.max(0, (t - r.at) / 86_400_000);
    r.at = t;
    if ((r.cents || r.items.length) && Math.random() < 1 - Math.pow(0.985, days)) {
      const took = r.items.filter((x) => (x.secret && x.secret !== 'empty') || x.kind === 'phone' || x.kind === 'weapon');
      r.items = r.items.filter((x) => !took.includes(x));
      const had = r.cents;
      r.cents = 0;
      if (had || took.length) return ["The lock’s been scratched up. Someone’s been in: " + [had ? 'the cash under the mattress' : '', took.length ? `what was under the board` : ''].filter(Boolean).join(' and ') + ' is gone.'];
    }
    return t > r.until ? ['The rent ran out. They hold the room two days, then clear it.'] : [];
  }

  /** The room: rent it, pay ahead, or sleep. */
  /** Which view of your room is up: the room, or the business at the table. */
  private roomView: 'room' | 'business' = 'room';
  private roomAct(what: string) {
    if (what === 'business' || what === 'back') {
      this.roomView = what === 'business' ? 'business' : 'room';
      this.renderShop();
      (this.shopEl.querySelector('.shop-body') as HTMLElement | null)?.scrollTo?.(0, 0);
      return;
    }
    if (what.startsWith('order:')) {
      if (!this.inOwnRoom) return;
      const o = ({ scale: ['Digital scale', 35, 0], cutkit: ['Cutting kit', 22, 0], lactose: ['Lactose powder', 16, 1000] } as Record<string, [string, number, number]>)[what.slice(6)];
      if (!o || cashOf(this.inventory) * 100 < o[1] * 100) return;
      const paid = this.payLine(o[1] * 100);
      const it: InvItem = { kind: 'misc', name: o[0], ...(o[2] ? { doses: o[2] } : {}), ...measure({ kind: 'misc', name: o[0] }), spot: '' };
      this.room!.items.push(it);
      this.refresh();
      this.note([`A knock, ten minutes later. The night man, with a paper bag. He doesn’t ask, and you don’t say. ${o[0]}: it’s on the table.`, paid]);
      return;
    }
    if (this.place !== 'room') return;
    const inv = this.inventory;
    const h = this.health;
    if (what === 'rent') {
      if (Math.round(cashOf(inv) * 100) < ROOM_RENT * 100) return;
      const cleared = this.checkRoom();
      if (cleared.length && !this.room) {
        this.note(cleared);
        return;
      }
      const paid = [...cleared.filter((x) => !/rent ran out/.test(x)), this.payLine(ROOM_RENT * 100)].join(' ');
      const r = this.room;
      const t = now();
      if (r && t <= r.until + 2 * 86_400_000) r.until = Math.max(t, r.until) + 7 * 86_400_000;
      else this.save.state.room = { until: t + 7 * 86_400_000, items: [], cents: 0, at: t };
      this.refresh();
      this.note([r ? 'You push the week through the slot. He writes it in a book without looking up.' : 'You push the cash through the slot. A key on a plastic tag comes back: room 14, up two flights.', paid]);
      return;
    }
    if (what === 'sleep' && this.roomRented) {
      const r = this.room!;
      const recent = now() - ((r as { slept?: number }).slept ?? 0) < 4 * 3_600_000 || !this.restHeals;
      if (recent && fatigueNow(h) < 3) {
        this.note(["You lie down, but you’re not tired. You stare at the water stain on the ceiling until you give up."]);
        return;
      }
      this.unstick();
      // (Just slept: lying down again rests you, but the night's healing was had already.)
      if (recent) return this.lieDown('room', ['You lock the door again and lie back down.']);
      (r as { slept?: number }).slept = now();
      h.restHealAt = now();
      const was = h.cold ?? 0;
      const lieAfter = fatigueNow(h) >= 3;
      const lines = [lieAfter ? 'You lock the door, wedge the chair under the handle, and lie down. Nobody comes.' : 'You lock the door, wedge the chair under the handle, and sleep. Eight hours. Nobody comes.', ...passHours(h, 8, true, !lieAfter)];
      if (h.dead) return this.die(lines);
      h.cold = 0;
      h.stress = Math.max(0, (h.stress ?? 0) - 30);
      if (was) lines.push('You’re warm, for once.');
      this.refresh();
      if (fatigueNow(h) >= 3) return this.lieDown('room', lines);
      this.note(lines);
    }
  }

  /** Where that kind of hiding place is, if you're at it: "stash", "room", "trunk", "vac", "lock". */
  private stashBox(kind: string): { items: InvItem[]; cents: number } | undefined {
    if (kind === 'stash') return this.place === 'fence' ? this.stash : undefined;
    if (kind === 'room') return this.place === 'room' && this.roomRented ? this.room : undefined;
    if (kind === 'trunk') return this.atCar && !this.copsAtCar(this.atCar) ? this.atCar : undefined;
    const s = this.atSpot;
    if (kind === 'vac') return s?.kind === 'vacant' ? this.vacantBox(s.id) : undefined;
    if (kind === 'lock') return s?.kind === 'warehouse' && this.lockupOwned(s) ? this.lockup : undefined;
    return undefined;
  }
  /** In a building with somewhere of yours to hide things: an empty house's floorboards, your lock-up. */
  private get spotBoxKind(): 'vac' | 'lock' | undefined {
    const s = this.atSpot;
    return s?.kind === 'vacant' ? 'vac' : s?.kind === 'warehouse' && this.lockupOwned(s) ? 'lock' : undefined;
  }
  /** Leaving something behind the brick, or in your room. */
  private stashItem(i: number) {
    if (this.carTowedNow()) return;
    const inv = this.inventory;
    const it = inv.items[i];
    const car = this.atCar && !this.copsAtCar(this.atCar) && it?.carId !== this.atCar.id ? this.atCar : undefined;
    const box = this.spotBoxKind;
    const where = this.place === 'fence' ? this.stash : this.place === 'room' && this.roomRented ? this.room : box ? this.stashBox(box) : car;
    if (!it || !where || !this.canOpenSheet) return;
    inv.items.splice(i, 1);
    delete it.hand;
    where.items.push(it);
    const lines = [this.place === 'fence' ? `You work the loose brick out, push the ${lc(it.name)} into the gap, and fit the brick back.` : box === 'vac' ? `You pry up a floorboard in the back room, push the ${lc(it.name)} under it, and stamp it back down.` : box === 'lock' ? `You put the ${lc(it.name)} on the shelf at the back of your unit.` : car ? `You put the ${lc(it.name)} in the trunk, under the cover with the spare.` : `You leave the ${lc(it.name)} in your room, under the loose board by the radiator.`];
    // (In an empty house: someone sleeping upstairs may have heard.)
    if (box === 'vac') {
      const v = where as StashBox;
      if (!v.seen && Math.random() < 0.05 + this.infamy.heat / 300) {
        v.seen = true;
        lines.push('A board creaks upstairs. When you look, there’s nobody on the stairs.');
      }
    }
    // In the alley someone may see you do it (the man by the vents, a face in a window).
    if (this.place === 'fence') {
      const s = this.stash;
      const open = isOpen(placeInfo('fence').hours!);
      if (!s.seen && Math.random() < 0.06 + this.infamy.heat / 300 + (open ? 0.12 : 0)) {
        s.seen = true;
        lines.push(open ? 'The man by the vents is looking your way. He looks away when you look back.' : 'You feel eyes on you. When you turn, the end of the alley is empty.');
      }
    }
    this.refresh();
    this.note(lines);
  }

  /** Taking something back out of the stash or the room: "stash:3", "room:0". */
  private unstash(v: string) {
    if (this.carTowedNow()) return;
    const [kind, n] = v.split(':');
    const where = this.stashBox(kind);
    const it = where?.items[Number(n)];
    if (!where || !it) return;
    const { spot: _spot, size: _size, kg: _kg, ...rest } = it;
    void _spot;
    void _size;
    void _kg;
    const got = stow(this.inventory, rest);
    if (!got) {
      this.note([`No room for the ${lc(it.name)}. ${noRoomWhy(this.inventory, measure(it).size, measure(it).kg)}`]);
      return;
    }
    where.items.splice(Number(n), 1);
    this.refresh();
    this.note([`You take the ${lc(it.name)}.`]);
  }

  /** All your cash in, or all of it back out: "stash:in", "room:out". */
  private stashCash(v: string) {
    if (this.carTowedNow()) return;
    const [kind, dir] = v.split(':');
    const where = this.stashBox(kind);
    if (!where) return;
    const inv = this.inventory;
    if (dir === 'in') {
      const c = Math.round(cashOf(inv) * 100);
      if (!c) return;
      // (The same bills you put there: a roll of small bills stays a roll of small bills.)
      const w = where as { purse?: Purse };
      const prev = w.purse && cents(w.purse) === where.cents ? w.purse : cashLike(where.cents, 'small');
      w.purse = { ...prev };
      addTo(w.purse, inv.purse);
      where.cents += c;
      inv.purse = {};
      const lines = [`You leave ${money(c)}, rolled tight, ${kind === 'stash' ? 'behind the brick' : kind === 'trunk' ? 'under the spare tire' : kind === 'vac' ? 'under the floorboard' : kind === 'lock' ? 'in a coffee can on the shelf' : 'under the mattress'}.`];
      if (kind === 'stash') {
        const s = this.stash;
        const open = isOpen(placeInfo('fence').hours!);
        if (!s.seen && Math.random() < 0.06 + this.infamy.heat / 300 + (open ? 0.12 : 0)) {
          s.seen = true;
          lines.push(open ? 'The man by the vents is looking your way. He looks away when you look back.' : 'You feel eyes on you. When you turn, the end of the alley is empty.');
        }
      }
      this.refresh();
      this.note(lines);
    } else if (where.cents) {
      // (The bills as you left them, if they're all still there.)
      const kept = (where as { purse?: Purse }).purse;
      const p = kept && cents(kept) === where.cents ? kept : cashLike(where.cents, 'small');
      const rest = pocketCash(inv, p);
      const left = cents(rest);
      const took = where.cents - left;
      if (!took) {
        this.note(['You’ve no room on you for any of it. Your pockets are full of cash already.']);
        return;
      }
      this.note([left ? `You take ${money(took)}, all you can fit on you. ${money(left)} stays where it is.` : `You take the ${money(took)}.`]);
      where.cents = left;
      (where as { purse?: Purse }).purse = left ? rest : undefined;
      this.refresh();
    }
  }

  /** Arrested with heat on you: they get your room from the desk clerk, and search it. */
  private searchRoom(charges: string[], heat: number): string[] {
    const r = this.room;
    if (!r || now() > r.until + 2 * 86_400_000 || heat < 50 || Math.random() >= 0.35) return [];
    const lines = ['The desk clerk at the Hotel Marlow gives them your room. They search it too.'];
    const found = r.items.filter((x) => (x.secret && x.secret !== 'empty') || this.stolen(x) || x.name === 'Zip bags');
    if (found.length) {
      lines.push(`They find what you’d hidden under the board by the radiator.`);
      if (found.some((x) => x.secret && x.secret !== 'empty') && !charges.some((x) => /controlled substance|intent to|marijuana/.test(x))) charges.push(this.drugCharge(found));
      if (found.some((x) => this.stolen(x)) && !charges.includes('Possession of stolen property')) charges.push('Possession of stolen property');
      // (Product, and the scale and the plate to work it: the room was where you did it.)
      if (found.some((x) => x.secret && x.secret !== 'empty') && r.items.some((x) => /digital scale|cutting kit/i.test(x.name)) && !charges.includes('Maintaining a drug-involved premises')) {
        charges.push('Maintaining a drug-involved premises');
        // (The gear goes as evidence too: said as what it is.)
        const gear = r.items.filter((x) => /digital scale|cutting kit/i.test(x.name));
        const scale = gear.some((x) => /scale/i.test(x.name));
        const kit = gear.some((x) => /cutting kit/i.test(x.name));
        lines.push(`${scale && kit ? 'The scale and the plate' : scale ? 'The scale' : 'The plate and the razor card'} on the table go${scale && kit ? '' : 'es'} into a bag too.`);
        found.push(...gear);
      }
      r.items = r.items.filter((x) => !found.includes(x));
    }
    if (r.cents) {
      lines.push(`The ${money(r.cents)} under the mattress goes into an evidence bag: proceeds, they call it.`);
      r.cents = 0;
    }
    return lines;
  }

  /** A hiding place, in a shop body: what's in it, and taking it back. */
  private stashHtml(kind: 'stash' | 'room' | 'trunk' | 'vac' | 'lock'): string {
    const where = kind === 'stash' ? this.save.state.stash as { items: InvItem[]; cents: number } | undefined : kind === 'trunk' ? this.atCar : kind === 'vac' || kind === 'lock' ? this.stashBox(kind) : this.room;
    const say = { stash: ['Behind the loose brick, low in the wall by the dumpster', 'behind it', 'Hide it'], trunk: ['Your things: in the trunk, under the cover with the spare', 'of yours in there', 'In the trunk'], room: ['Under the loose board by the radiator', 'left here', 'Leave it here'], vac: ['Under a floorboard in the back room', 'under it', 'Hide it here'], lock: ['On the shelf at the back of your unit', 'in the unit', 'In the lock-up'] }[kind];
    const items = where?.items ?? [];
    const cents = where?.cents ?? 0;
    const c = Math.round(cashOf(this.inventory) * 100);
    const btn = (attr: string, v: string, label: string, no?: string | false) => `<button type="button" data-${attr}="${v}" ${no ? `disabled title="${no}"` : ''}>${label}${no ? `<small>${no}</small>` : ''}</button>`;
    const li = (name: string, small: string, button: string) => `<li><div><b>${name}</b><small>${small}</small></div><span class="li-btns">${button}</span></li>`;
    return (
      `<p class="shop-sub">${say[0]}</p>` +
      `<ul class="shop-list">` +
      items.map((x, i) => li(named(x), x.secret === 'cocaine' && x.known && productOf(x) ? this.packageLine(x) : (x.detail ?? ''), btn('unstash', `${kind}:${i}`, 'Take'))).join('') +
      li('Cash', cents ? `${money(cents)} hidden here.` : 'None hidden here.', btn('cash', `${kind}:in`, 'Leave yours', !c && 'No cash') + btn('cash', `${kind}:out`, 'Take it', !cents && 'Nothing there')) +
      `</ul>` +
      (items.length ? '' : `<p class="shop-broke">Nothing ${say[1]}. Leave things from Pockets (“${say[2]}”). ${kind === 'trunk' ? 'If the car goes, so does what’s in it.' : kind === 'vac' ? 'Squatters come and go: they might find it.' : ''}</p>`)
    );
  }

  private bump(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const h = this.health;
    if (it?.secret !== 'cocaine' || !it.known || h.wired || productOf(it) !== 'powder') return;
    if (this.inside && !this.privateSpace) {
      this.note(['Not in here. Someone behind the counter is already watching you.']);
      return;
    }
    it.doses = (it.doses ?? 1) - 1;
    h.wired = true;
    h.wiredBy = 'coke';
    useHabit(h, 'stimulants', 6);
    // A bump lasts about forty minutes.
    h.wiredUntil = now() + 40 * 60_000;
    const lines = ['You do a bump off the end of a key. Your heart kicks, your teeth buzz, and everything goes sharp and bright.'];
    if (it.doses <= 0) {
      inv.items.splice(i, 1);
      lines.push("That’s the last of it.");
    }
    this.refresh();
    this.note(lines);
    buzz([20, 30, 20]);
  }

  /** Get rid of something to make room. */
  /** Worth thinking twice about before it goes in a bin: product, weapons, papers, phones, keys, cash, or anything worth $20. */
  private precious(it: InvItem): boolean {
    return (!!it.secret && it.secret !== 'empty') || ['weapon', 'id', 'credit card', 'debit card', 'phone', 'car keys', 'cash'].includes(it.kind) || !!it.opens || /keys/i.test(it.name) || worthOf(it) > 20;
  }
  /** A first tap on Trash for something precious: which, and when (a second, a moment later, throws it away). */
  private armedDrop: { item: InvItem; at: number } | null = null;
  private drop(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it) return;
    if (this.precious(it)) {
      const t = performance.now();
      const armed = this.armedDrop?.item === it && t - this.armedDrop.at > 450 && t - this.armedDrop.at < 5000;
      if (!armed) {
        // (A double tap doesn't count: it has to be meant.)
        if (this.armedDrop?.item !== it || t - this.armedDrop.at >= 5000) this.armedDrop = { item: it, at: t };
        this.refresh();
        this.note([`Tap again to throw away the ${it.secret === 'cocaine' && it.known && productOf(it) && it.pkg ? `${pkgAmount(productOf(it)!, it.pkg)} package of ${PRODUCTS[productOf(it)!].name.toLowerCase()}` : lc(it.name)}.`]);
        return;
      }
      this.armedDrop = null;
    }
    // (The keys to the car you're at: you're walking away from it, properly.)
    if (it.kind === 'car keys' && this.save.state.place === 'car' && it.carId && (it.carId === this.save.state.carAt || it.carId === (this.save.state.hunt as HuntState | undefined)?.car)) {
      this.leaveCar();
      this.place = 'street';
    }
    inv.items.splice(i, 1);
    this.refresh();
    this.note([`You throw the ${lc(it.name)} away.`]);
    buzz(6);
  }

  /** Your bills and coins, as little chips: "$20 ×2". */
  /** Off the map: an address you don't need any more (it stays forgotten, even with their ID on you). */
  private forgetHome(id: string) {
    if (this.place === 'home' && this.save.state.homeAt === id) return;
    const i = this.homes.findIndex((h) => h.id === id);
    if (i < 0) return;
    const learned = (this.save.state.homesLearned ??= []) as string[];
    if (!learned.includes(id)) learned.push(id);
    this.homes.splice(i, 1);
    this.mapPick = null;
    this.renderSheet();
  }
  /** Keep the zoomed map covering its frame (no empty edge showing). */
  private mapClamp(v: { z: number; tx: number; ty: number }) {
    const z = Math.min(MAP_ZMAX, Math.max(1, v.z));
    return { z, tx: Math.min(0, Math.max(1 - z, v.tx)), ty: Math.min(0, Math.max(1 - z, v.ty)) };
  }
  /** Put the map's view where it should be: sliding there, or straight away (under a finger). */
  private mapShow(v: { z: number; tx: number; ty: number }, slide: boolean) {
    this.mapView = this.mapClamp(v);
    const m = this.sheetEl.querySelector<HTMLElement>('.map');
    const layer = m?.querySelector<HTMLElement>('.map-zoom');
    if (!m || !layer) return;
    if (slide && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void layer.offsetWidth; // (from where it was drawn)
      layer.classList.add('slide');
      layer.addEventListener('transitionend', () => layer.classList.remove('slide'), { once: true });
    } else layer.classList.remove('slide');
    layer.setAttribute('style', zoomStyle(this.mapView));
    m.classList.toggle('zoomed', this.mapView.z > 1.01);
    const [zin, zout, fit] = m.querySelectorAll<HTMLButtonElement>('[data-mapzoom]');
    if (zin) zin.disabled = this.mapView.z >= MAP_ZMAX - 0.01;
    if (zout) zout.disabled = this.mapView.z <= 1.01;
    if (fit) fit.hidden = this.mapView.z <= 1.01;
  }
  /** Zoom in on a spot on the map (a building you tapped, a pin): it slides to the middle. */
  private mapFocus(x: number, y: number) {
    // (Already in close: leave the map where it is, unless it's near the edge.)
    if (this.mapView.z >= 1.8) return this.mapReveal(x, y);
    const z = 2.6;
    this.mapShow({ z, tx: 0.5 - (x / MAP_W) * z, ty: 0.5 - (y / MAP_H) * z }, true);
  }
  /** Zoomed in and that spot's off (or right at) the edge: slide it into view, at the same zoom. */
  private mapReveal(x: number, y: number) {
    const v = this.mapView;
    if (v.z <= 1.01) return;
    const sx = (x / MAP_W) * v.z + v.tx;
    const sy = (y / MAP_H) * v.z + v.ty;
    if (sx > 0.15 && sx < 0.85 && sy > 0.15 && sy < 0.85) return;
    this.mapShow({ z: v.z, tx: 0.5 - (x / MAP_W) * v.z, ty: 0.5 - (y / MAP_H) * v.z }, true);
  }
  /** The + and − buttons: in or out on the middle of what you can see. */
  private mapZoomBy(f: number) {
    const v = this.mapView;
    const z = Math.min(MAP_ZMAX, Math.max(1, v.z * f));
    // (The middle of the frame stays where it is.)
    const cx = (0.5 - v.tx) / v.z;
    const cy = (0.5 - v.ty) / v.z;
    this.mapShow({ z, tx: 0.5 - cx * z, ty: 0.5 - cy * z }, true);
  }
  /** Dragging the zoomed map around, pinching it in and out (and a mouse wheel). */
  private mapGestures() {
    const pts = new Map<number, { x: number; y: number }>();
    let start: { v: { z: number; tx: number; ty: number }; pts: { x: number; y: number }[]; r: DOMRect } | null = null;
    const begin = (m: HTMLElement) => {
      start = { v: { ...this.mapView }, pts: [...pts.values()].map((p) => ({ ...p })), r: m.getBoundingClientRect() };
    };
    const sig = this.listeners.signal;
    // (How fast a drag was going as it let go, for the map to glide on and slow down.)
    let vel = { x: 0, y: 0, t: 0 };
    let glide = 0;
    this.sheetEl.addEventListener('pointerdown', (e) => {
      // (Where the finger really came down: a phone may hand the tap to a pin next to it.)
      this.mapDownOn = (e.target as Element).closest?.('.m-landmark[data-bld]') ?? null;
      const m = (e.target as Element).closest<HTMLElement>('.map');
      if (!m || this.sheet !== 'places' || (e.target as Element).closest('.map-zoomctl')) return;
      cancelAnimationFrame(glide);
      if (!pts.size) this.mapMoved = false;
      vel = { x: 0, y: 0, t: performance.now() };
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      begin(m);
    }, { signal: sig });
    this.sheetEl.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p || !start) return;
      p.x = e.clientX;
      p.y = e.clientY;
      const now = [...pts.values()];
      const { v, r } = start;
      if (now.length >= 2 && start.pts.length >= 2) {
        // Pinch: the spot between your fingers stays under them.
        const d0 = Math.hypot(start.pts[0].x - start.pts[1].x, start.pts[0].y - start.pts[1].y) || 1;
        const d1 = Math.hypot(now[0].x - now[1].x, now[0].y - now[1].y);
        const z = Math.min(MAP_ZMAX, Math.max(1, v.z * (d1 / d0)));
        const s0 = { x: ((start.pts[0].x + start.pts[1].x) / 2 - r.left) / r.width, y: ((start.pts[0].y + start.pts[1].y) / 2 - r.top) / r.height };
        const s1 = { x: ((now[0].x + now[1].x) / 2 - r.left) / r.width, y: ((now[0].y + now[1].y) / 2 - r.top) / r.height };
        const mx = (s0.x - v.tx) / v.z;
        const my = (s0.y - v.ty) / v.z;
        this.mapMoved = true;
        this.mapShow({ z, tx: s1.x - mx * z, ty: s1.y - my * z }, false);
      } else if (now.length === 1 && v.z > 1.01) {
        // One finger, zoomed in: drag the map.
        const dx = p.x - start.pts[0].x;
        const dy = p.y - start.pts[0].y;
        if (!this.mapMoved && Math.hypot(dx, dy) < 8) return;
        this.mapMoved = true;
        const before = this.mapView;
        this.mapShow({ z: v.z, tx: v.tx + dx / r.width, ty: v.ty + dy / r.height }, false);
        const t = performance.now();
        const dt = Math.max(1, t - vel.t);
        // (Smoothed: the last few moves, in map widths a millisecond.)
        vel = { x: vel.x * 0.5 + ((this.mapView.tx - before.tx) / dt) * 0.5, y: vel.y * 0.5 + ((this.mapView.ty - before.ty) / dt) * 0.5, t };
      } else if (now.length === 1 && Math.hypot(p.x - start.pts[0].x, p.y - start.pts[0].y) >= 8) this.mapMoved = true;
    }, { signal: sig });
    const end = (e: PointerEvent) => {
      if (!pts.delete(e.pointerId)) return;
      if (this.mapMoved) this.mapDragEnd = performance.now();
      const m = this.sheetEl.querySelector<HTMLElement>('.map');
      const wasPinch = (start?.pts.length ?? 0) >= 2;
      // (One finger left after a pinch: it carries on as a drag from here.)
      if (pts.size && m) return begin(m);
      start = null;
      // A pinch let go just short of all the way out: all the way out.
      if (wasPinch && this.mapView.z < 1.12) return this.mapShow({ z: 1, tx: 0, ty: 0 }, true);
      // A flick: the map glides on and slows to a stop.
      const fresh = performance.now() - vel.t < 60;
      if (e.type === 'pointerup' && this.mapView.z > 1.01 && fresh && Math.hypot(vel.x, vel.y) > 0.0004 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        let { x: vx, y: vy } = vel;
        let last = performance.now();
        const step = (t: number) => {
          const dt = Math.min(40, t - last);
          last = t;
          const v = this.mapView;
          this.mapShow({ z: v.z, tx: v.tx + vx * dt, ty: v.ty + vy * dt }, false);
          const k = Math.pow(0.994, dt);
          vx *= k;
          vy *= k;
          if (Math.hypot(vx, vy) > 0.00003 && this.sheet === 'places') glide = requestAnimationFrame(step);
        };
        glide = requestAnimationFrame(step);
      }
    };
    this.sheetEl.addEventListener('pointerup', end, { signal: sig });
    this.sheetEl.addEventListener('pointercancel', end, { signal: sig });
    this.sheetEl.addEventListener('wheel', (e) => {
      const m = (e.target as Element).closest<HTMLElement>('.map');
      if (!m || this.sheet !== 'places') return;
      e.preventDefault();
      const r = m.getBoundingClientRect();
      const v = this.mapView;
      const z = Math.min(MAP_ZMAX, Math.max(1, v.z * Math.exp(-e.deltaY / 300)));
      const sx = (e.clientX - r.left) / r.width;
      const sy = (e.clientY - r.top) / r.height;
      const mx = (sx - v.tx) / v.z;
      const my = (sy - v.ty) / v.z;
      this.mapShow({ z, tx: sx - mx * z, ty: sy - my * z }, false);
    }, { passive: false, signal: sig });
  }
  /** A tap on the map itself: the building under your finger (or near it). */
  private mapTap(ev: MouseEvent, m: HTMLElement, on?: Element) {
    // (The zoomed layer: where it is on screen is where the map is, however far in.)
    const r = (m.querySelector('.map-zoom') ?? m).getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = ((ev.clientX - r.left) / r.width) * MAP_W;
    const y = ((ev.clientY - r.top) / r.height) * MAP_H;
    // (Zoomed in, a finger covers less of the map.)
    const z = this.mapView.z;
    // (A landmark's badge or its name: that building, even where the name lies over the one next door.)
    const lm = (on ?? (ev.target as Element | null))?.closest?.('[data-bld]')?.getAttribute('data-bld');
    const b = (lm ? buildingById(lm) : undefined) ?? buildingAt(x, y, Math.max(2, 6 / z));
    // (Off any building: the nearest corner, if it's close.)
    const c = b ? undefined : CORNERS.find((k) => Math.hypot(k.x - x, k.y - y) < Math.max(3, 9 / z));
    if (!b && !c) return;
    this.mapPick = b ? `bld:${b.id}` : `corner:${c!.id}`;
    this.renderSheet();
    // (A building: zoomed out, in on it, so the small ones next to it are easy to tap. A corner stays put.)
    if (b) this.mapFocus(b.x + b.w / 2, b.y + b.h / 2);
    this.sheetEl.querySelector('.map-card')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }
  /** What a building on the map is, for its card: what it's called, a line about it, and what you can do there. */
  private buildingSpot(b: Building): { name: string; small: string; icon: string; go: string; extra?: string } {
    const addr = buildingAddr(b);
    const where = `${addr} · ${DISTRICT_NAMES[b.district]}`;
    const residential = (what: string) => {
      const tried = ((this.save.state.watched ?? {}) as Record<string, number>)[b.id];
      const wait = tried && now() - tried < WATCH_AGAIN ? `Not again till ${clockText(tried + WATCH_AGAIN)}` : '';
      const why = wait || (fatigueNow(this.health) >= 70 ? 'Too tired' : '');
      return {
        name: what,
        small: `${where}. Someone lives here; you don’t know who.`,
        icon: PLACE_ICON.home,
        go: '',
        extra: `<button type="button" class="map-go" data-watch="${b.id}" ${why ? 'disabled' : ''}>Watch the place<small>${why || `About ten minutes, from a doorway across the street. Your stealth decides whether you see who lives there, or they see you.`}</small></button>`,
      };
    };
    switch (b.kind) {
      case 'house':
        return residential('A house');
      case 'rowhouse':
        return residential('A rowhouse');
      case 'apartment':
        return residential('An apartment building');
      case 'vacant':
        return { name: 'An empty house', small: `${where}. Boarded up, the door long since kicked in. Somewhere to sleep out of sight, or to hide things (if the squatters don’t find them).`, icon: PLACE_ICON.vacant, go: `data-spot="${b.id}"` };
      case 'warehouse':
        return { name: 'Riverside Storage', small: `${where}. Lock-ups by the week, ${money(LOCKUP_RENT * 100)}, cash. Behind your own padlock, nobody looks.${this.lockup?.bld === b.id ? ` Yours is paid up until ${dateText(this.lockup.until)}.` : ''}`, icon: PLACE_ICON.warehouse, go: `data-spot="${b.id}"` };
      case 'bar':
        return { name: b.name ?? 'A bar', small: `${where}. A bar: drinks by the glass, and a room to work.${this.corner.id === `bar:${b.id}` ? ' You work here now.' : ''}`, icon: PLACE_ICON.bar, go: `data-spot="${b.id}"` };
      case 'church':
        return { name: b.name ?? 'St. Agnes', small: `${where}. A pew to rest on by day, and a free meal in the basement once a day.`, icon: PLACE_ICON.church, go: `data-spot="${b.id}"` };
      case 'shelter':
        return { name: b.name ?? 'The shelter', small: `${where}. A free bed, from seven at night. They search you at the door.`, icon: PLACE_ICON.shelter, go: `data-spot="${b.id}"` };
      case 'school':
        return { name: b.name ?? 'The school', small: `${where}. A drug-free school zone: get caught selling within a block of it and the charge comes with more time.`, icon: PLACE_ICON.school, go: '' };
      case 'laundromat':
        return { name: b.name ?? 'The laundromat', small: `${where}. Washers, dryers, a change machine that eats bills. The alley behind it is where the fence works.`, icon: PLACE_ICON.laundromat, go: '' };
      case 'lot':
        return { name: 'A parking lot', small: `${where}. Meters, cars nose to tail. Somewhere for a car to sit unnoticed.`, icon: PLACE_ICON.lot, go: '' };
      case 'garage':
        return { name: 'A garage', small: `${where}. A garage on the alley, padlocked.`, icon: PLACE_ICON.building, go: '' };
      case 'tower':
        return { name: 'Offices', small: `${where}. Offices: busy by day, a guard in the lobby at night.`, icon: PLACE_ICON.building, go: '' };
      case 'shop':
        return { name: 'A shop', small: `${where}. ${['A corner store: cigarettes, lottery tickets, a cat on the counter.', 'A nail salon, a phone repair place, a takeout counter.', 'A barbershop, two chairs, a radio on.', 'A shop with its shutter half down and a FOR LEASE sign.'][Math.floor(b.cx * 7 + b.cy * 3) % 4]}`, icon: PLACE_ICON.building, go: '' };
      case 'place':
        return { name: 'A building', small: where, icon: PLACE_ICON.building, go: '' };
    }
    return { name: 'A building', small: where, icon: PLACE_ICON.building, go: '' };
  }
  /** Where to?: the map, everything you can go to on it, and the card for what you've tapped. */
  private mapSheetHtml(): string {
    type Spot = { key: string; x: number; y: number; icon: string; tone: MapMark['tone']; name: string; small: string; go: string; extra?: string; pin?: boolean; bld?: Building };
    const spots: Spot[] = [];
    const corner = this.corner;
    const feel = (d: District | 'bar') => CORNER_FEEL[d].blurb;
    for (const p of PLACES) {
      const at = p.id === 'street' ? corner : PLACE_AT[p.id];
      if (!at || HIDDEN_PLACES.has(p.id)) continue;
      const shut = !!p.hours && !isOpen(p.hours);
      const hours = p.id === 'street' ? '' : p.hours ? `<i class="${shut ? 'shut' : 'open'}">${hoursText(p.hours)}</i>` : '<i class="open">Open all hours</i>';
      const small = p.id === 'street' ? `${corner.name}. ${feel(corner.bar ? 'bar' : corner.district)}${this.nearSchool() ? ' A block from the school: get caught selling here and it’s a federal charge.' : ''}` : `${(at as { addr: string }).addr}. ${p.desc}${hours}`;
      // (The pin stands on its building, dead centre: not at the address's spot on the street.)
      const pb = p.id === 'street' ? undefined : buildingOfPlace(p.id);
      spots.push({ key: `place:${p.id}`, x: pb ? pb.cx : at.x, y: pb ? pb.cy : at.y, icon: PLACE_ICON[p.id] ?? PLACE_ICON.street, tone: shut ? 'shut' : 'place', name: p.id === 'street' ? 'Your corner' : p.name, small, go: `data-place="${p.id}"`, bld: pb });
    }
    // The other corners you could work.
    for (const c of CORNERS) {
      if (c.id === corner.id) continue;
      spots.push({ key: `corner:${c.id}`, x: c.x, y: c.y, icon: PLACE_ICON.corner, tone: 'corner', name: c.name, small: `${feel(c.district)}${this.nearSchool(c) ? ' A block from the school: get caught selling here and it’s a federal charge.' : ''}`, go: `data-corner="${c.id}"` });
    }
    for (const h of this.homes) {
      const b = h.bld ? buildingById(h.bld) : undefined;
      const at = b ? { x: b.cx, y: b.cy } : addressAt(h.addr);
      spots.push({ key: `home:${h.id}`, x: at.x, y: at.y, icon: PLACE_ICON.home, tone: 'home', name: h.addr, extra: `<button type="button" class="map-forget" data-forget="${h.id}">Forget this address</button>`, small: `${h.owner}’s place${h.hitAt ? ` · you broke in ${dueText(h.hitAt) === dueText(now()) ? 'today' : dueText(h.hitAt)}` : ''}${this.hasKeyTo(h) ? ' · you have their keys' : ''}`, go: `data-home="${h.id}"`, bld: b ?? buildingAt(at.x, at.y, 8) });
    }
    for (const c of this.myCars) {
      const h = c.home ? this.homeById(c.home) : undefined;
      const hb = h?.bld ? buildingById(h.bld) : undefined;
      const at = hb ? { x: hb.cx + 9, y: hb.cy + 9 } : h ? ((a) => ({ x: a.x + 9, y: a.y + 9 }))(addressAt(h.addr)) : addressAt(c.street.replace(/^(on|out front of) /, ''), c.id);
      const notes = [`Parked ${c.street}`, ...(reported(c, now()) ? ['reported by now'] : []), ...(c.items.length || c.cents ? ['your things in the trunk'] : [])];
      spots.push({ key: `car:${c.id}`, x: at.x, y: at.y, icon: PLACE_ICON.car, tone: 'car', name: `The ${c.color} ${c.make}`, small: notes.join(' · '), go: `data-car="${c.id}"` });
    }
    // The building you're in, and the one you've tapped (no pin: an outline).
    const bldSpot = (b: Building): Spot => ({ key: `bld:${b.id}`, x: b.cx, y: b.cy, tone: 'place', pin: false, bld: b, ...this.buildingSpot(b) });
    const inSpot = this.atSpot;
    if (inSpot) spots.push(bldSpot(inSpot));
    if (this.mapPick?.startsWith('bld:')) {
      const b = buildingById(this.mapPick.slice(4));
      // (A building with a place in it, or an address you know: that.)
      const known = b && (b.place ? spots.find((x) => x.key === `place:${b.place}`) : isHome(b) ? ((h) => h && spots.find((x) => x.key === `home:${h.id}`))(this.homeIn(b)) : undefined);
      if (known) this.mapPick = known.key;
      else if (b && b !== inSpot) spots.push(bldSpot(b));
    }
    // Where you are now.
    // (Out on the hunt with a fob: somewhere along the blocks, not at your corner.)
    const hunting = this.place === 'car' && !this.atCar && !!this.hunt;
    const hereKey = this.place === 'home' && this.atHome ? `home:${this.atHome.id}` : this.place === 'car' && this.atCar ? `car:${this.atCar.id}` : hunting ? 'hunt' : inSpot ? `bld:${inSpot.id}` : `place:${this.place === 'car' || this.place === 'home' || this.place === 'spot' ? 'street' : this.place}`;
    if (hunting) {
      spots.push({ key: 'hunt', x: corner.x + 22, y: corner.y - 30, icon: PLACE_ICON.car, tone: 'car', name: 'Walking the blocks', small: 'Pressing the fob, listening for a chirp.', go: '' });
    }
    const here = spots.find((x) => x.key === hereKey) ?? spots.find((x) => x.key === 'place:street')!;
    const picked = spots.find((x) => x.key === this.mapPick) ?? here;
    const marks: MapMark[] = spots.filter((x) => x.pin !== false || x === here).map((x) => ({ key: x.key, x: x.x, y: x.y, icon: x.icon, tone: x.tone, label: x.name, here: x === here, picked: x === picked && x !== here }));
    const isHere = picked === here;
    const far = blocksBetween(here, picked);
    const card =
      `<div class="map-card" data-tone="${picked.tone}">` +
      `<div class="map-card-head"><span class="map-card-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${picked.icon}"/></svg></span><div><b>${picked.name}</b><small>${isHere ? 'You’re here.' : far ? `${far} block${far === 1 ? '' : 's'} from you.` : 'Just around the corner.'}</small></div></div>` +
      `<p>${picked.small}</p>` +
      (isHere || !picked.go ? '' : `<button type="button" class="map-go" ${picked.go}>${picked.key === 'place:street' ? (this.corner.bar ? `Back to ${this.corner.name}` : 'Back out to your corner') : picked.tone === 'corner' ? 'Work this corner' : 'Walk there'}</button>`) +
      (isHere && picked.key === 'place:street' ? ((why) => `<button type="button" class="map-go" data-bins ${why ? 'disabled' : ''}>${this.atBar ? 'Go through the bins out back' : 'Go through the bins'}${why ? `<small>${why}</small>` : ''}</button>`)(this.binsWhy()) : '') +
      (isHere ? '' : (picked.extra ?? '')) +
      `</div>`;
    // The addresses and cars you know, as buttons too: easier to tell apart than the pins.
    const mine = spots.filter((x) => (x.tone === 'home' || x.tone === 'car') && x.key !== 'hunt');
    const list = mine.length
      ? `<p class="map-list-head">Addresses and cars you know</p><div class="map-list">${mine
          .map((x) => `<button type="button" data-mappick="${x.key}" data-tone="${x.tone}" class="${x === picked ? 'on' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${x.icon}"/></svg><span><b>${x.name}</b><small>${x === here ? 'You’re here' : `${blocksBetween(here, x) ? `${blocksBetween(here, x)} block${blocksBetween(here, x) === 1 ? '' : 's'} away` : 'Just around the corner'} · ${x.small.replace(/<[^>]+>/g, '').split(' · ')[0]}`}</small></span></button>`)
          .join('')}</div>`
      : '';
    return `${mapHtml(marks, picked.bld, this.mapView)}${this.heldNote.length ? this.noteHtml(this.arrived.length ? this.arrived.slice(0, 3) : this.heldNote.slice(-3), 'sheet-note map-arrived') : ''}${card}<p class="map-hint">Tap any building on the map, a pin, or a corner (◆)${mine.length ? ', or an address below' : ''}. Pinch, or use the zoom buttons, to look closer.</p>${list}`;
  }
  // ---------- The buildings on the map: what each one is for ----------

  /** The corner you work (saved; Grand & Ninth if you've never moved): where it is, and what part of town. */
  private get corner(): { id: string; name: string; x: number; y: number; district: District; bar?: Building } {
    const id = this.save.state.corner;
    if (typeof id === 'string' && id.startsWith('bar:')) {
      const b = buildingById(id.slice(4));
      if (b?.kind === 'bar') return { id, name: b.name ?? 'The bar', x: b.cx, y: b.cy, district: b.district, bar: b };
    }
    return cornerById(id) ?? cornerById(DEFAULT_CORNER)!;
  }
  /** The part of town your corner's in (its market, its crowd, its police). */
  private get cornerDistrict(): District {
    return this.corner.district;
  }
  /** What your corner's like: who comes by, how many, how many patrols. */
  private get cornerFeel(): CornerFeel {
    const c = this.corner;
    return c.bar ? CORNER_FEEL.bar : CORNER_FEEL[c.district];
  }
  /** Within a block of the school: a drug-free school zone. */
  private nearSchool(at: { x: number; y: number } = this.corner): boolean {
    const s = buildings().find((b) => b.kind === 'school');
    return !!s && blocksBetween(at, { x: s.cx, y: s.cy }) <= 1;
  }
  /** Over to another corner (or into a bar, to work the room). */
  private workCorner(id: string) {
    if (this.ending || this.save.state.policeStop || !this.canOpenSheet) return;
    const bar = id.startsWith('bar:') ? buildingById(id.slice(4)) : undefined;
    if (!(bar?.kind === 'bar') && !cornerById(id)) return;
    const was = this.corner.id;
    this.save.state.corner = id;
    const c = this.corner;
    const line = c.bar ? `You find a stool at the end of the bar in ${c.name}, where you can see the door and the room.` : `You walk over to ${c.name} and find a spot to stand.`;
    if (this.place !== 'street') {
      this.goTo('street', [line, CORNER_FEEL[c.bar ? 'bar' : c.district].blurb, ...(this.nearSchool() ? ['There’s a school a block away. Get caught selling here and it’s a federal charge, with more time.'] : [])]);
      return;
    }
    this.leaveSheet();
    if (was === id) return;
    this.save.state.crowd = [];
    if (this.encounter?.stage === 'seen') this.encounter = null;
    this.refresh();
    const onMap = this.sheet === 'places';
    if (onMap) this.dropArrived();
    const lines = [line, CORNER_FEEL[c.bar ? 'bar' : c.district].blurb, ...(this.nearSchool() ? ['There’s a school a block away. Get caught selling here and it’s a federal charge, with more time.'] : [])];
    this.note(lines);
    if (onMap) {
      this.arrived = lines;
      this.renderSheet();
    }
  }

  /** Working a bar's room (on the street, as far as places go, but under a roof). */
  private get atBar(): boolean {
    return this.place === 'street' && !!this.corner.bar;
  }
  /** The building you've walked into (a bar, the church, an empty house), if that's where you are. */
  private get atSpot(): Building | undefined {
    return this.place === 'spot' ? spotOf(this.save.state.spotAt) : undefined;
  }
  /** Somewhere that's yours, more or less: your own room, an empty house nobody's watching, your lock-up. */
  private get privateSpace(): boolean {
    const s = this.atSpot;
    return this.inOwnRoom || s?.kind === 'vacant' || (s?.kind === 'warehouse' && this.lockupOwned(s));
  }
  private goSpot(id: string) {
    const b = spotOf(id);
    if (!b || this.ending || this.save.state.policeStop) return;
    if (this.place === 'spot' && this.save.state.spotAt === id) return this.closeSheet();
    // (The church locks its doors at night.)
    if (b.kind === 'church' && !pewHours()) {
      this.leaveSheet();
      const onMap = this.sheet === 'places';
      if (onMap) this.dropArrived();
      const away = [`You go up the steps of ${b.name ?? 'St. Agnes'}. The doors are locked for the night. They open again at seven.`];
      this.note(away);
      if (onMap) {
        this.arrived = away;
        this.renderSheet();
      }
      return;
    }
    if (this.place === 'spot') this.place = 'street';
    this.save.state.spotAt = id;
    this.goTo('spot');
  }
  /** Walking into a building: what you see. */
  private spotArrive(b: Building): string {
    switch (b.kind) {
      case 'vacant':
        return 'You go around back and in through a window with no glass in it. Dark, and damp, and quiet.';
      case 'warehouse':
        return 'You walk through the gate to the row of roll-up doors. The man in the booth looks up from his phone.';
      case 'bar':
        return `You push into ${b.name}. Low light, a TV over the bar, a smell of beer and fryer oil.`;
      case 'church':
        return 'You go up the steps of St. Agnes and in. Cool and dim, and nearly empty.';
      case 'shelter':
        return 'You walk up to the shelter. A volunteer behind a folding table looks you over.';
      default:
        return 'You walk over.';
    }
  }

  // ----- An empty house: sleep in it, hide things in it -----
  private vacantBox(id: string): StashBox {
    const all = (this.save.state.vacant ??= {}) as Record<string, StashBox>;
    return (all[id] ??= { items: [], cents: 0, at: now() });
  }
  /** Back at the empty house: did the squatters find what you left? */
  private checkVacant(id: string): string[] {
    const s = ((this.save.state.vacant ?? {}) as Record<string, StashBox>)[id];
    if (!s) return [];
    const days = Math.max(0, (now() - s.at) / 86_400_000);
    s.at = now();
    if (!s.items.length && !s.cents) return [];
    if (Math.random() < 1 - Math.pow(1 - (s.seen ? 0.25 : 0.03), days)) {
      s.items = [];
      s.cents = 0;
      s.seen = false;
      return ['The floorboard’s been pried up and thrown in the corner. Whatever you left under it is gone. Someone’s been sleeping here.'];
    }
    return [];
  }

  // ----- A lock-up by the river: a padlocked unit, by the week -----
  private get lockup(): (StashBox & { bld: string; until: number }) | undefined {
    return this.save.state.lockup as (StashBox & { bld: string; until: number }) | undefined;
  }
  private lockupOwned(b: Building): boolean {
    const l = this.lockup;
    return !!l && l.bld === b.id && now() < l.until;
  }
  /** Back at the lock-up: rent run out past the grace days, and they've cut the lock and cleared it. */
  private checkLockup(): string[] {
    const l = this.lockup;
    if (!l) return [];
    // (Only told about it at your own unit's row; a lapsed one is cleared wherever you are.)
    const here = this.place === 'spot' && this.atSpot?.id === l.bld;
    if (now() > l.until + LOCKUP_GRACE) {
      delete this.save.state.lockup;
      if (!here) return [];
      return ['There’s a new padlock on your door, and a notice taped over it: past due, contents disposed of. The man in the booth shrugs at you.'];
    }
    return here && now() > l.until ? [`The rent on the unit ran out. They give you ${LOCKUP_GRACE / 86_400_000} days, then cut the lock.`] : [];
  }

  /** Standing at your own unit when the grace days run out: they come and cut the lock there and then. */
  private tickLockup() {
    const l = this.lockup;
    if (!l || !this.running || this.atSpot?.id !== l.bld || now() <= l.until + LOCKUP_GRACE) return;
    const lines = this.checkLockup();
    this.refresh();
    this.note(lines);
  }
  /** A button inside one of the buildings. */
  private spotAct(what: string) {
    const b = this.atSpot;
    if (!b || !this.canOpenSheet) return;
    const h = this.health;
    const inv = this.inventory;
    const c = Math.round(cashOf(inv) * 100);
    const tired = fatigueNow(h) >= 3;
    if (what === 'squat' && b.kind === 'vacant') {
      if (!tired) return this.note(['You sit on the bare mattress for a while, but you’re not tired.']);
      this.unstick();
      return this.lieDown('squat', [oneOf([`You drag a mattress into the back room, away from the windows, and lie down${/coat|jacket|puffer|parka|hoodie|windbreaker|blazer|flannel/i.test(inv.clothes[0] ?? '') ? ` in your ${lc(inv.clothes[0])}` : ''}.`, 'You find a corner upstairs, out of sight of the street, and lie down on cardboard.'])]);
    }
    if (what === 'rent' && b.kind === 'warehouse') {
      const l = this.lockup;
      if (l && l.bld !== b.id && now() <= l.until + LOCKUP_GRACE) return this.note(['“You already rent one.” He doesn’t want two of anything from you.']);
      if (c < LOCKUP_RENT * 100) return;
      const cleared = this.checkLockup();
      const paid = this.payLine(LOCKUP_RENT * 100);
      const cur = this.lockup;
      if (cur && cur.bld === b.id) cur.until = Math.max(now(), cur.until) + 7 * 86_400_000;
      else this.save.state.lockup = { bld: b.id, until: now() + 7 * 86_400_000, items: [], cents: 0, at: now() };
      this.refresh();
      this.note([...cleared.filter((x) => !/ran out/.test(x)), cur && cur.bld === b.id ? 'You pay the week. He writes it on a card.' : `You pay the week. He hands you a padlock and its key: unit ${unitNo(b)}, halfway down the row.`, paid]);
      return;
    }
    if (what.startsWith('drink:') && b.kind === 'bar') {
      const d = BAR_DRINKS.find((x) => x.id === what.slice(6));
      if (!d || c < d.cents) return;
      const paid = this.payLine(d.cents);
      soberUp(h);
      const was = drunkLevel(h.drunk ?? 0);
      useHabit(h, 'alcohol', d.std);
      h.drunk = Math.min(100, (h.drunk ?? 0) + d.drunk);
      h.drunkAt = now();
      h.stress = Math.max(0, (h.stress ?? 0) - 8);
      const lines = [d.line, paid];
      if (h.cold) lines.push('A glow spreads out from your stomach. You’re not any warmer, really.');
      const lvl = drunkLevel(h.drunk);
      if (h.drunk >= 90) {
        // (As on the street: hours go by, whoever was here is gone, and they've cleaned you up enough to throw you out.)
        this.dropEncounter();
        this.unstick();
        this.wipeBlood();
        lines.push('The room tips over. The bartender has you by the collar, and then you are outside, and then you are somewhere else.', ...passHours(h, 3));
        if (h.dead) return this.die(lines);
        h.drunk = 40;
        h.drunkAt = now();
        this.place = 'street';
        this.wasInside = this.inside;
        this.insideAt = 'street';
        lines.push('You come to in a doorway around the corner, hours later.');
      } else if (h.drunk >= 78) lines.push('The room spins. You’re close to blacking out.');
      else if (lvl > was) lines.push(['', 'You’re tipsy. The room’s friendlier.', 'You’re drunk. The bartender’s watching you now.', 'You’re wasted. He won’t serve you much more.', 'You’re blackout drunk. One more and you’re gone.'][lvl]);
      this.refresh();
      this.note(lines);
      return;
    }
    if (what === 'room' && b.kind === 'bar') return this.workCorner(`bar:${b.id}`);
    if (what === 'pew' && b.kind === 'church') {
      if (!pewHours()) return;
      if (!tired) return this.note(['You sit in a pew for a while. Nobody bothers you. You’re not tired, though.']);
      this.unstick();
      h.restEnd = nextAt(20);
      return this.lieDown('pew', [`You stretch out on a back pew, ${/coat|jacket|puffer|parka|hoodie|windbreaker|blazer|flannel/i.test(inv.clothes[0] ?? '') ? `your ${lc(inv.clothes[0])} balled under your head` : 'your arm under your head'}. An old woman lighting candles doesn’t look your way.`]);
    }
    if (what === 'meal' && b.kind === 'church') {
      const at = (this.save.state.churchMeal as number | undefined) ?? 0;
      if (now() - at < MEAL_EVERY) return;
      if (this.hungerWait) return this.note(['You’re not hungry. You just ate.']);
      this.save.state.churchMeal = now();
      h.ateAt = now();
      h.fatigue = Math.max(0, fatigueNow(h) - 6);
      h.stress = Math.max(0, (h.stress ?? 0) - 4);
      this.refresh();
      this.note([oneOf(['Down in the basement, a woman in a hairnet ladles out soup and gives you a roll. You eat at a long table with your head down. It helps.', 'Downstairs: a paper bowl of chili, bread, a cup of weak coffee. Nobody asks you anything.'])]);
      return;
    }
    if (what === 'bed' && b.kind === 'shelter') {
      if (!shelterCheckIn()) return;
      if (((this.save.state.shelterAt as number | undefined) ?? 0) >= shelterNight()) return;
      if (!tired) return this.note(['“Beds are for sleeping.” You’re not tired enough yet.']);
      // At the door: they go through your things, and keep what they don't allow.
      const banned = inv.items.filter((x) => x.kind === 'weapon' || (x.secret && x.secret !== 'empty') || x.name === 'Zip bags' || /syringe/i.test(x.name));
      inv.items = inv.items.filter((x) => !banned.includes(x));
      this.save.state.shelterAt = now();
      const lines = [banned.length ? `At the door a volunteer goes through your pockets and your bag. ${banned.length === 1 ? `The ${lc(banned[0].name)} goes` : `${list2(banned.map((x) => `the ${lc(x.name)}`))} go`} in a bin under the table. “No weapons, no drugs. House rules.” You don’t get ${banned.length === 1 ? 'it' : 'them'} back.` : 'At the door a volunteer pats you down and looks in your pockets. Nothing they don’t allow.', 'A cot in a long row of cots, a thin blanket, the lights going down at ten. Someone coughs all night.'];
      this.unstick();
      this.refresh();
      h.restEnd = nextAt(9);
      return this.lieDown('shelter', lines);
    }
  }

  /** What's inside a building, as a shop screen: its head and its list. */
  private spotHtml(b: Building, btn: (attr: string, v: string | number, label: string, no?: string | false | null) => string, li: (name: string, small: string, button: string) => string): { head: string; body: string } {
    const c = Math.round(cashOf(this.inventory) * 100);
    const tired = fatigueNow(this.health) >= 3;
    const addr = buildingAddr(b);
    const head = (name: string, blurb: string) => `<div class="shop-head"><h2>${name}</h2><p>${blurb}</p><p class="shop-hours">${addr}</p></div>`;
    if (b.kind === 'vacant')
      return {
        head: head('An empty house', 'Boarded windows, the door kicked in long ago. Mattresses, cans, a smell of damp. Nobody comes looking in here.'),
        body: `<ul class="shop-list">${li('Squat here', 'Lie down out of sight. Not a bed, but better than a doorway.', btn('spotact', 'squat', 'Lie down', !tired && 'Not tired'))}</ul>` + this.stashHtml('vac'),
      };
    if (b.kind === 'warehouse') {
      const l = this.lockup;
      const mine = this.lockupOwned(b);
      const late = !!l && l.bld === b.id && !mine && now() <= l.until + LOCKUP_GRACE;
      const elsewhere = !!l && l.bld !== b.id && now() <= l.until + LOCKUP_GRACE;
      return {
        head: head('Riverside Storage', 'A row of roll-up doors behind a chain-link fence, by the water. A man in a booth rents them by the week, cash, and doesn’t ask what’s in them.'),
        body:
          `<ul class="shop-list">` +
          (mine ? li(`Your unit, ${unitNo(b)}`, `Paid up until ${dateText(l!.until)}. Your padlock, your key. Nobody else goes in.`, '') : '') +
          li(mine || late ? 'Another week' : 'Rent a lock-up', late ? `The rent ran out. Pay within ${LOCKUP_GRACE / 86_400_000} days of it or they cut the lock.` : mine ? 'Pay ahead.' : 'A padlocked unit for a week. Police need a warrant to open it; nobody gets one for a storage unit.', btn('spotact', 'rent', money(LOCKUP_RENT * 100), (elsewhere && 'You already rent one') || (c < LOCKUP_RENT * 100 && 'Not enough cash'))) +
          `</ul>` +
          (mine ? this.stashHtml('lock') : ''),
      };
    }
    if (b.kind === 'bar')
      return {
        head: head(b.name ?? 'A bar', 'A long bar, a few booths, a pool table with a cue missing. The bartender pours without asking how your day was.'),
        body:
          `<ul class="shop-list">${BAR_DRINKS.map((d) => li(d.name, d.desc, btn('spotact', `drink:${d.id}`, money(d.cents), c < d.cents && 'Not enough cash'))).join('')}</ul>` +
          `<h3>Work the room</h3><ul class="shop-list">${li('Sell in here', this.corner.id === `bar:${b.id}` ? 'This is where you work now.' : 'Make the bar your corner: a drinking crowd, and few patrols. Your customers find you here.', btn('spotact', 'room', 'Work the room', this.corner.id === `bar:${b.id}` && 'Already here'))}</ul>`,
      };
    if (b.kind === 'church') {
      const left = MEAL_EVERY - (now() - ((this.save.state.churchMeal as number | undefined) ?? 0));
      return {
        head: head(b.name ?? 'St. Agnes', 'Stone and stained glass, rows of pews, candles by the door. Downstairs, the parish kitchen feeds whoever comes.'),
        body:
          `<ul class="shop-list">` +
          li('Rest in a pew', 'By day the church stays open. Nobody moves you on.', btn('spotact', 'pew', 'Lie down', (!pewHours() && 'Only by day') || (!tired && 'Not tired'))) +
          li('A meal downstairs', 'Free, once a day.', btn('spotact', 'meal', 'Eat', left > 0 && `Again ${clockText(now() + left)}`)) +
          `</ul>`,
      };
    }
    if (b.kind === 'shelter') {
      const last = (this.save.state.shelterAt as number | undefined) ?? 0;
      return {
        head: head(b.name ?? 'The shelter', 'A low brick building with a ramp, a buzzer and a sign: NO WEAPONS · NO DRUGS · NO ALCOHOL ON PREMISES. Beds from seven.'),
        body: `<ul class="shop-list">${li('A bed for the night', 'Free. They search you at the door and keep any weapon or drugs they find.', btn('spotact', 'bed', 'Check in', (!shelterCheckIn() && 'Beds from 7 PM') || (last >= shelterNight() && 'Once a night') || (!tired && 'Not tired')))}</ul>`,
      };
    }
    return { head: head('A building', ''), body: '' };
  }

  // ----- Watching a place: who lives there -----
  /** Settled down across the street to watch who comes and goes (real time). */
  private startWatch(b: Building) {
    if (!this.canOpenSheet || this.ending || this.save.state.policeStop || !isHome(b) || this.homeIn(b)) return;
    if (fatigueNow(this.health) >= 70) return this.note(['You’re too tired to stand in a doorway for ten minutes.']);
    const tried = ((this.save.state.watched ??= {}) as Record<string, number>)[b.id];
    if (tried && now() - tried < WATCH_AGAIN) return;
    if (this.place !== 'street') this.goTo('street');
    else this.closeSheet();
    if (this.place !== 'street') return;
    this.startWork({ kind: 'watch', since: now(), until: now() + WATCH_MS, bld: b.id }, [`You light a cigarette you don’t smoke and settle in.`]);
  }
  /** The watch, done: who lives there (if you saw), or someone saw you. */
  private endWatch(w: Work, finished: boolean): string[] {
    const b = w.bld ? buildingById(w.bld) : undefined;
    if (!b) return [];
    if (!finished) return ['You give up and walk away. You didn’t see enough.'];
    ((this.save.state.watched ??= {}) as Record<string, number>)[b.id] = now();
    train(this.stats, 'sneak', 3);
    if (Math.random() < watchOdds(this.stats.sneak.level, veryConspicuous(this.inventory))) {
      const home = homeFor(b);
      this.learnHome(home, new Set([home.id]));
      return [
        ((who, name, hr) =>
          hr >= 22 || hr < 6
            ? `A ${who} comes home late, keys out, and lets ${who === 'man' ? 'himself' : 'herself'} in. A light goes on upstairs. The name on the box by the door: ${name}.`
            : `A ${who} comes out to the mailbox and goes back in. The name on the box: ${name}.`)(home.sex === 'Male' ? 'man' : 'woman', home.owner.split(' ').slice(-1)[0].toUpperCase(), new Date(now()).getHours()),
        home.household === 'alone' ? 'Nobody else comes or goes. They live alone, by the look of it.' : 'Someone else is in there too: a voice through the window, a second shape behind the curtain.',
        ...(home.car ? [`A ${home.car} in front of it, theirs by the way they look at it.`] : []),
        `You know the address now: ${home.addr}. It’s on your map.`,
      ];
    }
    this.reportedHeat(4, anonymity(this.inventory), { sev: 2 });
    return ['A curtain twitches. Then a face at the window, and a phone held up to the glass. You walk away, not fast. Someone will call it in.'];
  }
  /** The address you know in that building, if any. */
  private homeIn(b: Building): Home | undefined {
    return this.homes.find((h) => h.bld === b.id || (!h.bld && ((a) => buildingAt(a.x, a.y, 8) === b)(addressAt(h.addr))));
  }
  /** The You sheet. */
  private renderStatsSheet(card: HTMLElement, close: string) {
    const h = this.health;
    const summary = `<p class="you-summary"><span>Blood <b>${(h.blood / 1000).toFixed(1)} L</b></span><span>Cash <b>${money(Math.round(cashOf(this.inventory) * 100))}</b></span>${this.account ? `<span>Bank <b>${money(this.account.cents)}</b></span>` : ''}<span>Character <b>#${this.world.lives}</b></span></p>`;
    card.innerHTML = `<div class="sheet-head"><h2>You</h2>${close}</div><div class="sheet-body">${this.noteHtml(this.sheetNote, 'sheet-note')}${summary}${this.policeHtml()}${this.customersHtml()}${this.statsHtml()}${this.marksHtml()}${this.recordHtml()}${this.selvesHtml()}</div>`;
  }
  /**
   * The police, at the top of the You tab: how hot you are, how often a patrol
   * stops you on a lurk right now (the same odds the lurk uses), and how long
   * till it cools to the next level down (it fades 12 an hour).
   */
  private policeHtml(): string {
    const f = this.infamy;
    const heat = f.heat;
    const lvl = heatLevel(heat);
    const { wanted: w, shows: s } = this.patrolOdds();
    const p = w + (1 - w) * s;
    const odds = p <= 0 ? 'No patrol is looking for you.' : p < 0.02 ? 'A patrol stops you rarely.' : `A patrol stops you about 1 in ${Math.max(2, Math.round(1 / p))} lurks.`;
    const floor = this.warrantFloor;
    const hours = hoursToDrop(heat);
    const when = hours < 1.5 ? 'under an hour' : hours < 36 ? `about ${Math.round(hours)} hours` : `about ${Math.round(hours / 24)} days`;
    // (Held up by a warrant: it doesn't drop below that.)
    const held = floor > 0 && heatLevel(floor) >= lvl;
    const drop = lvl && !held ? ` Drops to ${HEAT_NAMES[lvl - 1]} in ${when}.` : '';
    const c = this.case;
    const why = c?.warrant
      ? [...(c.warrantCharges ?? []).map((x) => chargeHtml(x)), ...(c.warrantFor === 'sting' ? ['The buy you ran from'] : c.warrantFor === 'escape' ? ['The escape'] : c.warrantFor === 'crime' ? [] : ['A missed court date'])]
      : [];
    const d = f.desc;
    return (
      `<section class="stat-card police-card"><h3><span>The police</span><b>${HEAT_NAMES[lvl]} (${Math.round(heat)})</b></h3>` +
      `<div class="spot-bar status-bar${lvl >= 3 ? ' harm' : ''}"><i style="width:${Math.round(Math.min(100, heat))}%"></i><span>${Math.round(heat)} / 100</span></div>` +
      `<p class="stat-how">${odds}${drop}</p>` +
      (held ? `<p class="stat-how">A warrant keeps it at ${HEAT_NAMES[heatLevel(floor)]} or above until it’s dealt with.</p>` : '') +
      (why.length ? `<p class="stat-how warrant">Wanted for:</p><ul class="wanted-list">${why.map((x) => `<li>${x}</li>`).join('')}</ul>` : '') +
      `<p class="stat-how">${this.record.arrests > 0 ? 'They know your face: there’s a booking photo.' : 'They don’t have a photo of you.'}</p>` +
      (this.infamy.lastLook && lvl ? `<p class="stat-how">${this.looksLikeDescription ? 'Your look: matches their description.' : 'Your look: changed since they had a description.'}</p>` : '') +
      (d && d.heat >= 1 ? `<p class="stat-how">They’re looking for: ${d.text.replace(/^someone/, 'someone')}${this.looksLikeStranger ? ' (that’s how you look right now)' : ''}.</p>` : '') +
      `</section>`
    );
  }
  /** Your standing as a dealer, and your regulars: who, what they buy, how happy, when you last saw them. */
  private customersHtml(): string {
    const sales = (this.save.state.sales as number) ?? 0;
    const regs = this.regulars;
    if (!sales && !regs.length) return '';
    const pts = this.standingPoints;
    const lvl = this.standing;
    const next = nextStandingAt(lvl);
    const ago = (t?: number) => {
      if (!t) return '—';
      const h = (now() - t) / 3_600_000;
      return h < 1 ? 'just now' : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;
    };
    const happy = (n = 0) => (n >= 2 ? 'Happy' : n >= 0 ? 'Fine' : 'Grumbling');
    const rows = regs
      .sort((a, b) => (b.memory.lastBuy ?? 0) - (a.memory.lastBuy ?? 0))
      .slice(0, 8)
      .map((k) => `<div><dt>${k.person.name ?? k.person.title ?? NAMES[k.person.kind]}</dt><dd>${k.memory.usual ? `${keyName(k.memory.usual)}${(k.memory.usualBags ?? 1) > 1 ? ` ×${k.memory.usualBags}` : ''}` : '—'} · ${happy(k.memory.sat)} · ${ago(k.memory.lastBuy)}</dd></div>`)
      .join('');
    return (
      `<section class="stat-card customers-card"><h3><span>Your customers</span><b>${STANDING_NAMES[lvl]}</b></h3>` +
      (Number.isFinite(next) ? `<div class="spot-bar status-bar"><i style="width:${Math.round(Math.min(100, (pts / next) * 100))}%"></i><span>${pts} / ${next}</span></div>` : '') +
      `<p class="stat-how">${sales} sold · ${regs.length} regular${regs.length === 1 ? '' : 's'}.${Number.isFinite(next) ? ` More sales and regulars make you a ${STANDING_NAMES[lvl + 1].toLowerCase()}.` : ''}</p>` +
      (rows ? `<dl class="stat-now cust-list">${rows}${regs.length > 8 ? `<div><dd>And ${regs.length - 8} more</dd></div>` : ''}</dl>` : '') +
      `</section>`
    );
  }
  /** Where the cash is on you, and how much room it's taking. */
  private cashWhereHtml(): string {
    const inv = this.inventory;
    if (!cents(inv.purse)) return '';
    const at = cashWhere(inv) ?? [];
    const fill = cashFill(inv);
    const spots = at.map((x) => `${x.spot.on.toLowerCase()} (${x.spot.name.toLowerCase()})`);
    const where = spots.length ? `In your ${spots.length > 2 ? `${spots.slice(0, -1).join(', ')} and ${spots.at(-1)}` : spots.join(' and ')}` : 'On you';
    const how = fill > 0.9 ? ' Every pocket you’ve got is stuffed with it: there’s no room for more.' : fill > 0.6 ? ' It’s getting bulky: there isn’t much room left for more.' : '';
    return `<p class="pocket-where">${where}, ${kgLabel(purseKg(inv))}.${how}</p>`;
  }
  private purseHtml(): string {
    const p = this.inventory.purse;
    const ds = [...BILLS, ...COINS].filter((d) => p[d]);
    if (!ds.length) return '';
    return ds.map((d) => `<span class="${isBill(d) ? 'bill' : 'coin'}">${isBill(d) ? `$${d / 100}` : `${d}¢`}<em>×${p[d]}</em></span>`).join('');
  }

  /** The screen for wherever you are, if it isn't the street. */
  private renderShop() {
    const place = this.place;
    const here = place !== 'street' && this.tvState.on && !(place === 'home' && this.encounter);
    this.shopEl.hidden = !here;
    this.view.classList.toggle('in-shop', here);
    if (!here) return;
    const info = placeInfo(place);
    const inv = this.inventory;
    const c = Math.round(cashOf(inv) * 100);
    const open = !info.hours || isOpen(info.hours);
    // A button that can't be pressed says why, on the button (phones never show a tooltip).
    const btn = (attr: string, v: string | number, label: string, no?: string | false | null) =>
      `<button type="button" data-${attr}="${v}" ${no ? `disabled title="${no}"` : ''}>${label}${no ? `<small>${no}</small>` : ''}</button>`;
    const li = (name: string, small: string, button: string) => `<li><div><b>${name}</b><small>${small}</small></div><span class="li-btns">${button}</span></li>`;
    let body = '';
    if (place === 'pharmacy') {
      const have = (id: MedId) => inv.items.filter((x) => x.med === id).length;
      body =
        `<ul class="shop-list">${SOLD_MEDS().map((m) => li(named({ kind: 'med', name: m.name }), `${m.desc}${have(m.id) ? ` · You have ${have(m.id)}` : ''}`, btn('buy', m.id, money(m.price * 100), c < m.price * 100 && 'Not enough cash'))).join('')}</ul>` +
        (c < Math.min(...SOLD_MEDS().map((m) => m.price)) * 100 ? `<p class="shop-broke">You can’t afford anything. Cash only.</p>` : '');
    } else if (place === 'guns') {
      body = open
        ? `<ul class="shop-list">${GUN_STOCK.map((s) => li(named(stockThing(s)), s.gun ? `${s.desc} ${hideStat(bulkOf({ kind: 'weapon', name: s.gun }))}, ${alarmStat(1)}.` : s.desc, this.stockBtns(s, c, btn))).join('')}</ul>` +
          `<p class="shop-broke">${this.ownId() ? (this.charged ? 'With a charge against you, the background check will come back denied.' : 'Your own ID, a form and a background check, and it’s yours.') : 'Nothing without your own ID: they run a background check on every buyer.'} Firing a gun is loud: someone always calls it in.</p>`
        : `<p class="shop-closed">The shutters are down and the alarm light blinks.</p>`;
    } else if (place === 'hospital') {
      const need = this.erNeeds();
      const row = (care: ErCare, name: string, what: string, needed: boolean, n = 1) =>
        li(name, what, btn('er', care, money(ER_PRICES[care] * n * 100), (!needed && 'Nothing to treat') || (c < ER_PRICES[care] * n * 100 && 'Not enough cash')));
      body =
        `<ul class="shop-list">` +
        row('stitches', 'Stitches', 'Close a cut and stop the bleeding.', need.stitches) +
        row('nose', 'Set your nose', 'Set straight, it heals properly, and sooner.', need.nose) +
        row('cast', need.cast.length > 1 ? `Casts (${need.cast.length})` : 'A cast', need.cast.length ? `Set the ${need.cast.join(' and ')}: ${need.cast.length > 1 ? 'they heal' : 'it heals'} properly, and sooner.` : 'For a broken arm or leg.', need.cast.length > 0, Math.max(1, need.cast.length)) +
        row('lung', 'Chest tube', 'For a punctured lung: lets you breathe again.', need.lung) +
        row('blood', 'Blood', 'A transfusion, when you’ve lost too much.', need.blood) +
        `</ul>` +
        `<p class="shop-broke">${this.erSeen ? 'You’ve been seen. They’ll fit you in.' : 'First you wait, unless you’re bleeding badly or can’t breathe.'} No insurance: they want cash before you leave. They can’t do anything for ribs or a concussion but tell you to rest.</p>` +
        // (Plasma donation: down the hall, in the same building.)
        `<h3>Plasma donation, down the hall</h3>${this.plasmaHtml(btn, li)}`;
    } else if (place === 'court') {
      const c = this.case;
      const metal = this.inventory.items.find((x) => x.kind === 'weapon' && !/bottle|syringe/i.test(x.name));
      body = open && metal
        ? `<p class="shop-broke">The metal detector shrieks. The deputy finds the ${lc(metal.name)} and steps in front of you. “Not in here. Get rid of it and come back.”</p>`
        : open
        ? c
          ? `<ul class="shop-list">${li(c.warrant ? 'Turn yourself in' : 'Appear for your hearing', ((all) => `${all.length ? `${all.map((x) => chargeHtml(x)).join(', ')}.` : c.warrant ? 'There’s a warrant out for you.' : ''}${c.warrant ? ' They’ll hold you overnight first.' : ` Your date: ${hearingToday(c.courtAt) ? 'today' : dateText(c.courtAt)}.`}`.trim())([...new Set([...c.charges, ...(c.warrant ? c.warrantCharges ?? [] : [])])]), btn('court', 'appear', 'Go in'))}</ul>` +
            `<p class="shop-broke">Could go any way: dropped, a fine, probation, or jail time. Your record counts against you; a good story counts for you.</p>`
          : `<p class="shop-broke">Your name isn’t on any list. Nothing for you here.</p>`
        : `<p class="shop-closed">The doors are locked.</p>`;
      body += this.jailVisitHtml(open && !metal, btn, li);
    } else if (place === 'plasma') {
      body = open ? this.plasmaHtml(btn, li) : `<p class="shop-closed">The doors are locked. Open Monday to Saturday, 7 to 7.</p>`;
    } else if (place === 'records') {
      const mine = this.ownId();
      // (Had one: losing it means a replacement.)
      if (mine) this.save.state.hadId = true;
      body = open
        ? `<ul class="shop-list">${li(!mine && this.save.state.hadId ? 'Replacement ID' : 'State ID', mine ? `You have one: ${mine.detail}.` : this.save.state.hadId ? 'Yours is gone: a new one, the same name, the same photo booth.' : 'Your name, your photo, your address (more or less).', btn('records', 'id', money(ID_FEE * 100), (mine && 'You have one') || (c < ID_FEE * 100 && 'Not enough cash')))}</ul>` +
          `<p class="shop-broke">With your own ID you can open a bank account, sell to and buy from the pawn shop, and buy alcohol, without anyone looking at you twice.</p>`
        : `<p class="shop-closed">The doors are locked.</p>`;
    } else if (place === 'liquor') {
      body = open
        ? `<ul class="shop-list">${LIQUOR_STOCK.map((s) => li(named(stockThing(s)), s.desc, this.stockBtns(s, c, btn))).join('')}</ul>` +
          `<p class="shop-broke">${this.ownId() ? 'They know your face now.' : 'They’ll want to see ID.'}</p>`
        : `<p class="shop-closed">The grille is down.</p>`;
    } else if (place === 'gas') {
      const have = (name: string) => inv.items.filter((x) => x.name === name).length;
      body =
        `<ul class="shop-list">${GAS_STOCK.map((s) => {
          const n = s.med ? inv.items.filter((x) => x.med === s.med).length : s.slot || s.drink ? 0 : have(s.name);
          return li(named(stockThing(s)), `${s.desc}${stockWarmth(s)}${n ? ` · You have ${n}` : ''}`, this.stockBtns(s, c, btn));
        }).join('')}</ul>` +
        ((cans) => (cans ? `<ul class="shop-list">${li('Cash in cans', `The machine by the ice chest takes them back: 10¢ a can. You have ${cans}.`, btn('cans', 'cash', `Cash in · ${money(cans * 10)}`))}</ul>` : ''))(this.cansCount) +
        (c < 100 ? `<p class="shop-broke">You can’t afford anything. The clerk watches you anyway.</p>` : '');
    } else if (place === 'pawn' || place === 'fence') {
      if (!open) body = `<p class="shop-closed">${place === 'pawn' ? 'The shutter is down.' : "There’s nobody back here right now."}</p>`;
      else {
        const sell = inv.items
          .map((x, i) => ({ x, i, o: (x.kind === 'phone' && this.phoneLocked(x), offer(place, x)) }))
          .map(({ x, i, o }) => li(named(x), 'cents' in o ? `${x.detail ? `${x.detail} · ` : ''}He’ll give you ${money(o.cents)}` : o.why, 'cents' in o ? btn('sell', i, `Sell ${money(o.cents)}`) : ''));
        body = `<h3>Sell</h3>` + (sell.length ? `<ul class="shop-list">${sell.join('')}</ul>` : `<p class="shop-broke">You’ve got nothing to sell.</p>`);
        if (place === 'pawn') {
          body += `<h3>For sale</h3><ul class="shop-list">${PAWN_STOCK.map((s) => li(named(stockThing(s)), s.slot === 'top' || s.slot === 'bottom' || s.slot === 'bag' ? `${s.desc} ${hidesWord(s.name)}.${stockWarmth(s)}` : s.slot === 'head' || s.slot === 'face' || s.slot === 'eyes' ? `${s.desc}${stockWarmth(s)}` : s.knife ? `${s.desc} ${hideStat(bulkOf({ kind: 'weapon', name: s.knife }))}, ${alarmStat(alarmOf({ kind: 'weapon', name: s.knife }))}.` : s.desc, this.stockBtns(s, c, btn))).join('')}</ul>`;
        }
      }
    } else if (place === 'bank') {
      const p = inv.purse;
      const coins = count(p, COINS);
      // (What would actually change: nothing to gain, the button says so before you try.)
      const upped = { ...p };
      changeUp(upped);
      const canUp = JSON.stringify(upped) !== JSON.stringify(p);
      const coinWorth = COINS.reduce((sum, d) => sum + d * (p[d] ?? 0), 0);
      const canMachine = Math.floor(coinWorth * (1 - COIN_MACHINE_FEE)) >= 100;
      const fitsBroken = (d: number) => {
        const t = { ...p };
        return breakBill(t, d) && cashFits(inv, t);
      };
      const room = roomForCents(inv, 2000) >= 2000;
      if (open) {
        body =
          `<h3>Teller</h3><ul class="shop-list">` +
          li('Change up', 'Trade small bills and coins for the biggest bills they add up to', btn('bank', 'up', 'Change', (!c && 'No cash on you') || (!canUp && 'Already in the biggest bills'))) +
          BILLS.filter((d) => p[d] && breaksInto(d))
            .map((d) => li(`Break a ${denomName(d)}`, `Into ${purseText(breaksInto(d))}`, btn('bank', `break:${d}`, 'Break', !fitsBroken(d) && 'No room for more bills')))
            .join('') +
          `</ul>`;
        // Your account (it takes your own ID).
        const acct = this.account;
        const mine = !!this.ownId();
        body +=
          `<h3>Your account</h3><ul class="shop-list">` +
          (!acct
            ? li('Open an account', mine ? 'Free. Keep your money where nobody can take it off you.' : 'You need your own ID: the City Records Office makes them.', btn('bank', 'open', 'Open', !mine && 'Need your own ID'))
            : li(`Balance: ${money(acct.cents)}`, 'Deposit what you carry; take some out when you need it.', btn('bank', 'deposit', 'Deposit all', (!c && 'No cash on you') || (!mine && 'Need your own ID'))) +
              `<li class="bank-amt"><div><b>An amount</b><small>Type it in, then deposit it or take it out.</small></div><span class="li-btns"><label class="amt"><span>$</span><input id="bank-amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" aria-label="Amount in dollars"></label>${btn('bank', 'd:amt', 'Deposit', (!c && 'No cash on you') || (!mine && 'Need your ID'))}${btn('bank', 'w:amt', 'Withdraw', (!acct.cents && 'Nothing in the account') || (!mine && 'Need your ID') || (!room && 'No room on you'))}</span></li>` +
              li('Withdraw', '$20, $100, or everything.', [2000, 10000].map((v) => btn('bank', `w:${v}`, money(v), (acct.cents < v && 'Balance too low') || (!mine && 'Need your ID') || (!room && 'No room on you'))).join('') + btn('bank', 'w:all', 'All', (!acct.cents && 'Nothing in the account') || (!mine && 'Need your ID') || (!room && 'No room on you')))) +
          `</ul>`;
      } else body = `<p class="shop-closed">The teller windows are dark.</p>`;
      body += `<h3>Lobby</h3><ul class="shop-list">${li('Coin machine', `Turns coins into bills. Keeps ${COIN_MACHINE_FEE * 100}%.`, btn('bank', 'machine', 'Use', (!coins && 'No coins') || (!canMachine && 'Not enough for a bill')))}`;
      // The cash machine: a card and its PIN (one someone gave you, if you made them).
      const cards = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => /card/.test(x.kind));
      const usable = cards.filter(({ x }) => x.pin && !x.drained);
      body += usable.length
        ? usable.map(({ x, i }) => li(named(x, `Cash machine · ${x.name}`), `${x.detail ? `${x.detail}’s card · ` : ''}PIN ${x.pin}. There’s a camera over the screen.`, btn('atm', i, 'Withdraw'))).join('')
        : li('Cash machine', ((parts) => (parts.length ? parts.join(' ') : 'Any hour. You need a card, and its PIN.'))([
            ...(cards.some(({ x }) => x.drained && !x.empty) ? ['The cards you had PINs for have been stopped.'] : []),
            ...(cards.some(({ x }) => x.drained && x.empty) ? [cards.some(({ x }) => x.drained && !x.empty) ? 'One had nothing on it anyway.' : 'The cards you had PINs for have nothing on them.'] : []),
            ...(cards.some(({ x }) => !x.drained && !x.pin && x.noPin && x.pinAsked) ? ['A credit card with no PIN is no use at a machine.'] : []),
            ...(cards.some(({ x }) => !x.drained && !x.pin && !(x.noPin && x.pinAsked)) ? ['You’ve got a card with no PIN for it. Someone would have to tell you.'] : []),
          ]), btn('atm', -1, 'Use', 'No card with a PIN'));
      body += `</ul>`;
    } else if (place === 'room') {
      // The Hotel Marlow: a room by the week.
      const r = this.room;
      const rented = this.roomRented;
      body =
        `<ul class="shop-list">` +
        (rented ? li('Your room, upstairs', `Room 14, paid up until ${dateText(r!.until)}. A bed, a lock that mostly works, a window onto the fire escape. Warm, and nobody bothers you.`, btn('room', 'sleep', 'Sleep')) : '') +
        li(rented ? 'Another week' : 'A room for a week', rented ? "Pay ahead. Fall behind and they clear it after two days." : 'Cash up front. No lease, no ID, no questions.', btn('room', 'rent', money(ROOM_RENT * 100), c < ROOM_RENT * 100 && (rented ? 'Not enough cash for another week' : 'Not enough cash'))) +
        (rented ? li('Your business', 'The table by the window: your product, the gear, the street, your customers.', btn('room', 'business', 'Open')) : '') +
        `</ul>` +
        (rented ? this.stashHtml('room') : '');
      if (rented && this.roomView === 'business') body = this.businessHtml(btn, li);
    }
    // The alley's loose brick: there whenever you are, whoever's about.
    if (place === 'fence') body += this.dezHtml(open) + this.stashHtml('stash');
    const spot = this.atSpot;
    const spotView = spot ? this.spotHtml(spot, btn, li) : undefined;
    if (spotView) body = spotView.body;
    const home = this.atHome;
    if (home) body = this.homeHtml(home, btn, li);
    const car = this.atCar;
    const hunt = car ? undefined : this.hunt;
    if (car) body = this.carHtml(car, btn, li);
    else if (hunt) body = this.huntHtml(hunt, btn, li);
    const huntKey = hunt && this.keysFor(hunt.car);
    // (A way out of anywhere: back to the street, or your corner.)
    const leave = `<button type="button" class="shop-leave" data-leave aria-label="Leave">Leave</button>`;
    const html0 =
      (home
        ? `<div class="shop-head"><h2>${home.addr}</h2><p>${home.owner}’s place, going by the ID. ${{ house: 'A house', rowhouse: 'A rowhouse', apartment: 'An apartment', room: 'A room in a rooming house' }[home.type]}${home.household === 'alone' || !home.hitAt ? '' : ', and they don’t live alone'}.</p></div>`
        : car
          ? `<div class="shop-head"><h2>The ${car.color} ${car.make}</h2><p>Parked ${car.street}. Their keys, in your hand.</p></div>`
          : huntKey
            ? `<div class="shop-head"><h2>Looking for the ${makeOf(huntKey)}</h2><p>The fob in your hand. You took it ${((m) => (m < 60 ? `${Math.max(1, m)} minute${m <= 1 ? '' : 's'} ago` : m < 48 * 60 ? `${Math.round(m / 60)} hour${Math.round(m / 60) === 1 ? '' : 's'} ago` : 'days ago'))(Math.round((now() - (huntKey.tookAt ?? huntKey.takenAt ?? now())) / 60_000))}.</p></div>`
            : spotView
              ? spotView.head
              : `<div class="shop-head"><h2>${info.name}</h2><p>${info.blurb}</p>${info.hours ? `<p class="shop-hours">${hoursText(info.hours)}.</p>` : ''}</div>`) +
      this.noteHtml(this.shopNote, 'shop-note') +
      (home || hunt ? '' : `<p class="pocket-purse">${this.purseHtml()}</p>`) +
      `<div class="shop-body">${body}</div>`;
    // Only when something changed, and keep your place in the list (buying
    // something used to jump you back to the top).
    const html = html0.replace('<div class="shop-head">', `<div class="shop-head">${leave}`);
    if (html !== this.shopHtml) {
      this.shopHtml = html;
      const same = this.shopAt === this.place;
      this.shopAt = this.place;
      const scroll = same ? this.shopEl.scrollTop : 0;
      const listScroll = same ? (this.shopEl.querySelector('.shop-body')?.scrollTop ?? 0) : 0;
      this.shopEl.innerHTML = html;
      this.shopEl.scrollTop = scroll;
      const list = this.shopEl.querySelector('.shop-body');
      if (list) list.scrollTop = listScroll;
      // (What just happened, at its newest line.)
      const sn = this.shopEl.querySelector('.shop-note');
      if (sn) sn.scrollTop = sn.scrollHeight;
    }
    // More than fits: a fade at the bottom says scroll.
    requestAnimationFrame(() => this.markShopMore());
  }
  /** A fade where there's more to scroll: the card (or, in landscape, its list column). */
  private markShopMore() {
    const more = (el: Element | null) => !!el && el.scrollTop + el.clientHeight < el.scrollHeight - 6;
    this.shopEl.classList.toggle('more', more(this.shopEl));
    const body = this.shopEl.querySelector('.shop-body');
    body?.classList.toggle('more', more(body));
    const sn = this.shopEl.querySelector('.shop-note');
    sn?.classList.toggle('more', !!sn && sn.scrollTop > 6);
  }
  private shopHtml = '';
  /** The shop the list was last drawn for (a new one opens at the top). */
  private shopAt = '';
  /** The last thing that happened in this shop / sheet, shown inside it. */
  private shopNote: string[] = [];
  private shopNoteAt = -Infinity;
  /** When you last touched the screen (what a note is a reply to). */
  private lastTap = -Infinity;
  private readonly onTap = () => (this.lastTap = performance.now());
  private sheetNote: string[] = [];
  private noteHtml(lines: string[], cls: string) {
    return lines.length ? `<div class="${cls}">${lines.map((l) => `<p>${l}</p>`).join('')}</div>` : '';
  }

  /** In a shop, or a sheet (Pockets, stats, Go) is open: the screen stays clear of what you're on. */
  get inMenu(): boolean {
    // (Lying down, inside, at work: a screen of its own to read, like a menu.)
    return (this.place !== 'street' && this.tvState.on && !(this.place === 'home' && this.encounter)) || !!this.sheet || !!document.querySelector('.lockup');
  }

  private renderSheet() {
    const card = this.sheetEl.firstElementChild as HTMLElement;
    const close = `<button type="button" class="sheet-x" data-close aria-label="Close"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg></button>`;
    if (this.sheet === 'police' && Array.isArray(this.save.state.policeResult)) {
      const res = this.save.state.policeResult as string[];
      card.innerHTML =
        `<div class="sheet-head"><h2>Police</h2></div><div class="sheet-body police">` +
        res.map((l) => `<p>${l}</p>`).join('') +
        `</div><div class="police-choice">` +
        (this.save.state.bailOffer === 'bail'
          ? ((have) =>
              `<button type="button" class="place" data-police="bail" ${have < (this.case?.bail ?? 0) * 100 ? 'disabled' : ''}><b>Pay bail: ${money((this.case?.bail ?? 0) * 100)}</b><small>${have < (this.case?.bail ?? 0) * 100 ? `You’ve only got ${money(have)}, cash and bank together` : 'Cash first, then your bank account. You get it back if you show up to court.'}</small></button>` +
              (have < (this.case?.bail ?? 0) * 100 && this.canCallDez ? `<button type="button" class="place" data-police="dez"><b>Call Dez</b><small>He posts your bail, and you owe him for it, and then some.</small></button>` : '') +
              `<button type="button" class="place" data-police="custody"><b>Wait in jail for the hearing</b><small>${Math.round(COUNTY_HOURS * 60)} real minutes in County, then the judge.</small></button>`)(Math.round(cashOf(this.inventory) * 100) + (this.account?.cents ?? 0))
          : this.save.state.bailOffer === 'custody'
            ? `<button type="button" class="place" data-police="custody"><b>Wait for the hearing</b><small>${Math.round(COUNTY_HOURS * 60)} real minutes in County, then the judge.</small></button>`
            : `<button type="button" class="place" data-police="done"><b>Go on</b><small>${this.save.state.policeArrested ? 'It’s on your record (You: Criminal record).' : 'Back to the street.'}</small></button>`) +
        `</div>`;
      return;
    }
    if (this.sheet === 'police') {
      const masked = wearing(this.inventory).masked;
      const why = Array.isArray(this.save.state.policeWhy) ? (this.save.state.policeWhy as string[]).map((l) => `<p class="police-why">${l}</p>`).join('') : '';
      card.innerHTML =
        `<div class="sheet-head"><h2>Police</h2></div><div class="sheet-body police">` +
        (this.save.state.policeStop === 'burglary' && this.save.state.policeCuffed
          ? why
          : this.save.state.policeStop === 'burglary'
          ? why + `<p>“POLICE! Show me your hands! Show me your HANDS!” Two flashlights in the hallway, and the guns under them.</p>`
          : this.save.state.policeStop === 'sting'
          ? why + `<p>“Police. Turn around. Hands behind your back.” It was a buy. They were waiting for you to make it.</p>`
          : this.save.state.policeStop === 'car' && this.save.state.carStopHow === 'trunk'
          ? why + `<p>A flashlight on you over the open trunk lid. “Step away from the car. Hands where I can see them.”</p>`
          : this.save.state.policeStop === 'car'
          ? why + `<p>A second flashlight on the other window. “Step out of the vehicle. Slowly. Hands where I can see them.”</p>`
          : this.save.state.policeKnow
          ? why + `<p>“Don’t. Hands where I can see them.” He says your name like he’s been waiting to.</p>`
          : why +
            `<p>${/patrol car/i.test(why) ? 'It pulls in beside you' : 'A patrol car pulls up beside you'}, lights off. Two of them get out. One has a hand on his belt.</p>` +
            `<p>“${masked ? 'Take that off your face. ' : ''}Hold up. Where are you headed ${partOfDay() === 'night' || partOfDay() === 'dusk' ? 'tonight' : 'today'}?”</p>`) +
        `</div><div class="police-choice">` +
        (this.save.state.policeStop === 'burglary' && this.save.state.policeCuffed
          ? `<button type="button" class="place" data-police="stay"><b>Go with them</b><small>Cuffed already. There’s nothing else to do.</small></button>`
          : this.save.state.policeStop === 'burglary'
          ? `<button type="button" class="place" data-police="stay"><b>Hands up</b><small>On your knees, on someone else’s floor. They’ve got you in the house.</small></button>`
          : this.save.state.policeStop === 'sting'
          ? `<button type="button" class="place" data-police="stay"><b>Hands behind your back</b><small>They’ve got the bag, the money, and you on camera.</small></button>`
          : this.save.state.policeStop === 'car' && this.save.state.carStopHow === 'trunk'
          ? `<button type="button" class="place" data-police="stay"><b>Step away</b><small>Do as they say. They’ll run the plate.</small></button>` + this.bribeBtn()
          : this.save.state.policeStop === 'car'
          ? `<button type="button" class="place" data-police="stay"><b>Step out</b><small>Do as they say. They’ll run the plate.</small></button>` + this.bribeBtn()
          : this.save.state.policeKnow
          ? `<button type="button" class="place" data-police="stay"><b>Go with him</b><small>He knows who you are. There’s a warrant.</small></button>`
          : `<button type="button" class="place" data-police="stay"><b>Stay calm</b><small>Let them talk. They’ll want to search you.</small></button>` +
            `<button type="button" class="place" data-police="talk"><b>Talk your way out</b><small>Speech. A good story and they move on without a search; a bad one and they look harder.</small></button>` +
            this.bribeBtn()) +
        (this.save.state.policeCuffed ? '' : `<button type="button" class="place" data-police="run"><b>Run</b><small>Agility, and your legs. If they catch you, it’ll hurt.</small></button>`) +
        `</div>`;
      return;
    }
    if (this.sheet === 'stats') {
      // (Mid-fight: you as you are now, the blood you've lost and what's broken, not as you walked in.)
      const e = this.encounter;
      const real = this.save.state.health;
      if (e && e.stage !== 'seen' && !e.result) {
        const now_ = structuredClone(this.health);
        const b = e.you;
        now_.blood = b.blood;
        now_.bleeding = b.bleeding;
        for (const p of b.broken)
          if (!now_.broken.includes(p)) {
            now_.broken.push(p);
            now_.mending[p] = MEND_HOURS[p];
          }
        if (b.concussed && now_.concussion <= 0) now_.concussion = CONCUSSION_HOURS;
        if (b.lung) now_.lung = true;
        now_.stress = b.stress ?? now_.stress;
        if (b.marks) now_.marks = b.marks;
        this.save.state.health = now_;
      }
      try {
        this.renderStatsSheet(card, close);
      } finally {
        this.save.state.health = real;
      }
      return;
    }
    if (this.sheet === 'places') {
      card.innerHTML = `<div class="sheet-head"><h2>Where to?</h2>${close}</div><div class="sheet-body places">${this.mapSheetHtml()}</div>`;
      return;
    }
    if (this.sheet === 'scav') {
      card.innerHTML = `<div class="sheet-head"><h2>${this.atBar ? 'Out back' : 'The bins'}</h2>${close}</div><div class="sheet-body scav">${this.scavHtml()}</div>`;
      // (The wheel, turned to what's picked.)
      const w = card.querySelector<HTMLElement>('.scav-wheel');
      if (w) w.scrollTop = Math.min(this.scavSel, w.children.length - 1) * WHEEL_ROW;
      return;
    }
    const inv = this.inventory;
    const h = this.health;
    const total = inv.items.reduce((t, i) => t + i.kg, 0);
    let body =
      `<div class="pocket-cash"><span>Cash</span><b>${money(Math.round(cashOf(inv) * 100))}</b></div>` +
      `<p class="pocket-purse">${this.purseHtml()}</p>` +
      this.cashWhereHtml() +
      `<p class="pocket-wear">Wearing ${[...inv.clothes, ...(inv.gear ?? [])].map((c) => c.toLowerCase()).join(', ')}. Carrying ${kgLabel(total + purseKg(inv))} of ${kgLabel(inv.maxKg ?? carryLimit(this.stats.strength.level))}${((k) => (k > 1 ? ': over your limit, so walking wears you out' : k >= TIRING_LOAD ? ': near your limit, so walking tires you' : ''))((total + purseKg(inv)) / (inv.maxKg ?? 99))}.</p><p class="pocket-wear pocket-rain">${((k, wet) => (wet ? `In the ${isSnow(this.weather.now) ? 'snow' : 'rain'}: ${k <= 0.45 ? 'you stay warm' : k <= 0.9 ? 'fairly warm' : 'you’ll get cold'}` : `If it rains: ${k <= 0.45 ? 'you’d stay warm' : k <= 0.9 ? 'fairly warm' : 'you’d get cold'}`))(coldFactor(inv), WET_AMOUNT[this.weather.now] > 0)}.</p>` +
      // What anyone looking at you can see you're carrying.
      (inv.items.some((x) => x.kind === 'weapon')
        ? ((seen) => `<p class="pocket-shows${seen.length ? ' seen' : ''}">${seen.length ? `Anyone looking can see you’re carrying: ${seen.map((x) => lc(x.name)).join(', ')}. People notice you sooner and scare easier, and the police notice too.` : 'Your weapons are out of sight.'}</p>`)(inv.items.filter((x) => x.kind === 'weapon' && showing(inv, x) >= 0.16))
        : '');
    // Your face: what's on it, and how hard you are to know.
    {
      const w = wearing(inv);
      const anon = anonymity(inv);
      const row = (name: string, small: string, btn: string) => `<li><div><b>${name}</b><small>${small}</small></div><span class="acts">${btn}</span></li>`;
      const rows: string[] = [];
      if (w.face) rows.push(row(named({ kind: 'wear', name: w.face, slot: 'face' }), w.masked ? 'Pulled up over your face' : 'Pulled down', `<button type="button" data-mask>${w.masked ? 'Pull down' : 'Pull up'}</button><button type="button" data-takeoff="face">Take off</button>`));
      if (hasHood(inv)) rows.push(row(named({ kind: 'wear', name: 'Hood', slot: 'head' }), w.hood ? 'Up' : 'Down', `<button type="button" data-hood>${w.hood ? 'Down' : 'Up'}</button>`));
      if (w.head) rows.push(row(named({ kind: 'wear', name: w.head, slot: 'head' }), 'On', `<button type="button" data-takeoff="head">Take off</button>`));
      if (w.eyes) rows.push(row(named({ kind: 'wear', name: w.eyes, slot: 'eyes' }), 'On', `<button type="button" data-takeoff="eyes">Take off</button>`));
      if (w.hands) rows.push(row(named({ kind: 'wear', name: w.hands, slot: 'hands' }), 'On: no prints', `<button type="button" data-takeoff="hands">Take off</button>`));
      // Your jacket and your bag, to take off (trousers and shoes stay on).
      const top = inv.clothes[0];
      const bag = inv.clothes[3];
      if (top && !/^t-shirt$/i.test(top))
        rows.push(row(named({ kind: 'wear', name: top, slot: 'top' }), /reversible/i.test(top) ? (w.flipped ? 'Gray side out' : 'Black side out') : 'On', `${/reversible/i.test(top) ? '<button type="button" data-flip>Flip it</button>' : ''}<button type="button" data-takeoff="top">Take off</button>`));
      if (bag) rows.push(row(named({ kind: 'wear', name: bag, slot: 'bag' }), /fanny|waist|belt bag|bum bag/i.test(bag) ? 'Round your waist' : /sling|shoulder|purse|tote|messenger/i.test(bag) ? 'Over your shoulder' : 'On your back', `<button type="button" data-takeoff="bag">Take off</button>`));
      body +=
        `<div class="spot"><h3><span>What you’ve got on</span><em>Your face: ${faceWord(anon)}</em></h3>` +
        (rows.length ? `<ul class="pocket-list">${rows.join('')}</ul>` : `<p class="pocket-empty">Nothing hides your face. Anyone who sees you will know you again.</p>`) +
        `</div>`;
    }
    // Every pocket and bag with something in it: how full, and what's there.
    // The empty ones are listed small at the end.
    // (Your cash, and which pockets it's in.)
    const cashAt = new Map((cashWhere(inv) ?? []).map((x) => [x.spot.id, x.share]));
    const allCash = Math.round(cashOf(inv) * 100);
    const empty = inv.spots.filter((sp) => !inv.items.some((x) => x.spot === sp.id) && !cashAt.has(sp.id));
    // (And what you're carrying with no pocket for it: a bag by the strap.)
    const hands: Pocket = { id: '', name: 'In your hands', on: '', fits: 'large', maxKg: 1 };
    for (const sp of [...inv.spots, hands]) {
      const xs = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => (sp === hands ? !inv.spots.some((y) => y.id === x.spot) : x.spot === sp.id));
      const share = sp === hands ? 0 : (cashAt.get(sp.id) ?? 0);
      if (!xs.length && !share) continue;
      const used = usedKg(inv, sp.id) + share * purseKg(inv);
      // (Full by weight, or full by bulk: bills take room long before they weigh much.)
      const fill = Math.min(100, 100 * Math.max(used / sp.maxKg, usedKg(inv, sp.id) / sp.maxKg + (share * mlOf(inv.purse)) / spotMl(sp)));
      body +=
        (sp === hands
          ? `<div class="spot"><h3><span>${sp.name}</span></h3>`
          : `<div class="spot"><h3><span>${sp.on} · ${sp.name}</span><em>${sp.fits} · ${hideWord(concealOf(sp, inv.clothes[0]))}</em></h3>` +
            `<div class="spot-bar"><i style="width:${fill}%"></i><span>${kgLabel(used)} / ${sp.maxKg} kg</span></div>`) +
        (share ? `<p class="pocket-empty">${share > 0.999 ? 'Your cash' : Math.round((allCash * share) / 100) >= 1 ? `About ${money(Math.round((allCash * share) / 100) * 100)} of your cash` : 'Some of your cash'}, ${BILLS.some((d) => inv.purse[d]) ? 'folded in here' : 'loose in here'}.</p>` : '') +
        (xs.length
          ? `<ul class="pocket-list">${xs
              .map(({ x, i }) => {
                const m = x.med ? medById(x.med) : null;
                const why = m?.blocked(h);
                const small = m
                  ? (why ?? m.desc)
                  : x.secret === 'cocaine' && x.known
                    ? this.packageLine(x)
                    : x.drink
                      ? x.drink === 'energy'
                        ? '160 mg of caffeine'
                        : x.drink === 'beer'
                        ? 'A can of beer'
                        : `${x.kind === 'weapon' ? 'A weapon too · ' : ''}${x.doses ? `${x.doses} swig${x.doses === 1 ? '' : 's'} left` : 'Empty'}`
                    : x.kind === 'weapon' && gunOf(x.name)
                      ? `${gunOf(x.name)!.desc} ${x.doses ?? 0} of ${gunOf(x.name)!.holds} loaded.`
                    : /^(9mm rounds|\.38 rounds|12-gauge shells)$/.test(x.name)
                      ? `${x.doses ?? 0} left`
                    : x.kind === 'weapon' && knifeOf(x.name)
                      ? `${knifeOf(x.name)!.desc} +${knifeOf(x.name)!.dmg} damage.`
                    : x.kind === 'weapon' && /syringe/i.test(x.name)
                      ? `${x.detail ?? 'A syringe'} · +${x.weapon ?? 0} damage, cuts`
                    : /^(pack of )?cigarettes$/i.test(x.name)
                      ? x.doses
                        ? `${x.detail ? `${x.detail}, ` : ''}${x.doses} left`
                        : `Empty${x.detail ? ` (${x.detail})` : ''}`
                      : /^loose cigarettes$/i.test(x.name)
                        ? `${x.doses ?? 1} loose`
                      : /^lighter$/i.test(x.name)
                        ? `<span class="fuel" title="Fuel left"><i style="width:${flameLeft(x)}%"></i></span>Fuel ${flameLeft(x)}%${flameLeft(x) <= 15 ? ', nearly dry' : ''}`
                        : /^matches$/i.test(x.name)
                          ? `${flameLeft(x)} match${flameLeft(x) === 1 ? '' : 'es'} left`
                          : x.kind === 'weapon'
                            ? x.spray
                              ? `${x.doses ?? 0} spray${x.doses === 1 ? '' : 's'} left · blinds them`
                              : `A weapon: +${x.weapon ?? 0} damage${x.cuts ? ', cuts' : ''}`
                            : x.kind === 'car keys'
                            ? `${x.detail ?? 'Car keys'} · ${x.car === 'found' ? `${((c) => (c ? `the ${c.color} car, parked ${c.street}` : x.carOf ? 'the car out front of their place' : 'the car you found'))(this.carById(x.carId))} ${now() - (x.takenAt ?? 0) < REPORTED_HOURS * 3_600_000 ? '(the fence buys cars)' : '(reported stolen by now: the fence won’t touch it)'}` : x.car === 'gone' ? "the car’s gone" : 'walk the blocks pressing it to find the car'}`
                            : /^(pack of )?cigarettes$/i.test(x.name)
                            ? `${x.detail ? `${x.detail} · ` : ''}${x.doses ?? 0} of 20`
                            : /^loose cigarettes$/i.test(x.name)
                            ? `${x.doses ?? 1} loose`
                            : x.kind === 'id' && x.card
                            ? idText((x.detail ?? '').split(',')[0], x.card)
                            : x.opens
                            ? `${x.detail ? `${x.detail} · ` : ''}${((h) => (h ? `Opens ${h.addr}${this.atHome === h ? " (you’re here)" : ''}` : 'Whose door, you’d need an address to know'))(this.homeById(x.opens))}`
                            : x.kind === 'phone'
                            ? `${x.detail ? `${x.detail} · ` : ''}${this.phoneLocked(x) ? 'Locked: you can’t get in' : this.gig.signedUp ? `${GIG_APP} app: ${money(this.gig.balance)} to cash out` : 'Unlocked'}`
                            : /card/.test(x.kind) && (x.pin || x.drained)
                            ? `${x.detail ? `${x.detail} · ` : ''}${x.drained ? (x.empty ? 'Nothing in the account' : 'Stopped') : `PIN ${x.pin} (cash machine at the bank)`}`
                            : x.detail;
                const act = (attr: string, label: string, no?: string | null) => `<button type="button" data-${attr}="${i}" ${no ? `disabled title="${no}"` : ''}>${label}${no ? `<small>${no}</small>` : ''}</button>`;
                let acts = m && m.id !== 'testkit' ? act('use', 'Use', why) : '';
                if (/^(lighter|matches)$/i.test(x.name)) acts += act('fire', 'Fire', this.fireBlocked());
                if (/^(loose |pack of )?cigarettes$/i.test(x.name)) acts += act('smoke', this.smoking ? 'Smoking' : 'Smoke', (x.doses ?? 1) <= 0 ? 'Empty' : this.smokeBlocked());
                if (x.drink) acts += act('drink', 'Drink', (x.doses ?? 0) <= 0 ? 'Empty' : !this.canOpenSheet ? 'Not now' : this.inside && !this.privateSpace && x.drink !== 'energy' ? 'Not in here' : null);
                // Food and water: someone else's, but it does you good.
                if (x.food === 'trash' || /^(lunch in a plastic tub|groceries|sandwich)$/i.test(x.name)) acts += act('eat', 'Eat', !this.canOpenSheet ? 'Not now' : this.inside && !this.privateSpace ? 'Not in here' : this.hungerWait ? 'You’re full' : null);
                if (/^(water bottle|bottle of water)$/i.test(x.name)) acts += act('water', 'Drink', !this.canOpenSheet ? 'Not now' : this.thirstWait ? 'Not thirsty' : null);
                if (x.kind === 'wear' && x.slot) acts += act('puton', 'Put on', this.canOpenSheet ? null : 'Not now');
                // A phone: the delivery app, if it's yours or unlocked.
                if (x.kind === 'phone') acts += this.phoneActs(x, i);
                // Loose ones into a pack with room in it.
                if (/^loose cigarettes$/i.test(x.name) && inv.items.some((y) => /^(pack of )?cigarettes$/i.test(y.name) && (y.doses ?? 0) < 20))
                  acts += act('pack', 'Put in pack');
                // One pack into another (a pack holds 20).
                if (/^(pack of )?cigarettes$/i.test(x.name) && (x.doses ?? 0) > 0 && inv.items.some((y) => y !== x && /^(pack of )?cigarettes$/i.test(y.name) && (y.doses ?? 0) < 20))
                  acts += act('combine', 'Into another pack');
                if (x.kind === 'id' || x.kind === 'credit card' || x.kind === 'debit card') acts += act('burn', 'Burn', this.burnBlocked());
                if (x.secret && x.secret !== 'cocaine' && x.secret !== 'empty') {
                  if (!x.known && inv.items.some((y) => y.med === 'testkit')) acts += act('test', 'Test');
                  acts += act('inject', 'Inject', this.injectBlocked());
                } else if (x.secret && !x.known) {
                  acts += act('taste', 'Taste');
                  if (inv.items.some((y) => y.med === 'testkit')) acts += act('test', 'Test');
                }
                if (x.secret === 'cocaine' && x.known && productOf(x) === 'powder') acts += act('bump', 'Bump', h.wired ? 'Already wired' : this.inside && !this.privateSpace ? 'Not in here' : null);
                // The alley's loose brick, or your room: somewhere to leave it.
                if (this.place === 'fence' || (this.place === 'room' && this.roomRented) || this.spotBoxKind || (this.atCar && x.carId !== this.atCar.id && !this.copsAtCar(this.atCar))) acts += act('stash', this.place === 'fence' ? 'Hide it' : this.spotBoxKind === 'vac' ? 'Hide it here' : this.spotBoxKind === 'lock' ? 'In the lock-up' : this.atCar ? 'In the trunk' : 'Leave it here');
                // A gun: load it from a box of its rounds.
                if (gunOf(x.name)) acts += act('load', 'Load', (x.doses ?? 0) >= gunOf(x.name)!.holds ? 'Full' : inv.items.some((y) => y.name === gunOf(x.name)!.ammo && (y.doses ?? 0) > 0) ? null : 'No ammunition');
                // Car keys: find the car (on the street), then go through it, or sleep in it.
                if (x.kind === 'car keys') {
                  if (!x.car) acts += act('findcar', 'Find the car', this.place !== 'street' || !this.canLurk ? 'Out on the street' : null);
                  else if (x.car === 'found') acts += act('gocar', 'Go to it', this.atCar && this.atCar.id === x.carId ? 'You’re there' : this.save.state.policeStop ? 'Not now' : null);
                }
                // A weapon: in your hand (out, and seen), or put away.
                if (x.kind === 'weapon' && !x.spray) {
                  if (x.hand) acts += act('putaway', 'Put away');
                  else {
                    acts += act('hold-r', 'Right hand', this.handBroken('right') ? 'Broken' : inv.items.some((y) => y.hand === 'right') ? 'Hand full' : null);
                    acts += act('hold-l', 'Left hand', this.handBroken('left') ? 'Broken' : inv.items.some((y) => y.hand === 'left') ? 'Hand full' : null);
                  }
                }
                // Into another pocket (to hide it better, or have it to hand).
                if (!x.hand) acts += act('move', 'Move', nextSpot(inv, x) ? null : 'Nowhere else');
                return (
                  `<li><div><b>${named(x)}</b><small>${small ? `${small} · ` : ''}${kgLabel(x.kg)}${x.hand && x.kind !== 'weapon' ? ` · In your ${x.hand} hand` : ''}${x.kind === 'weapon' ? ` · ${hideStat(bulkOf(x))}, ${alarmStat(alarmOf(x))} · <span class="shows${showing(inv, x) >= 0.16 ? ' seen' : ''}">${x.hand ? `In your ${x.hand} hand` : showWord(showing(inv, x))}${inBag(inv, x.spot) ? ' (a moment to get out)' : ''}</span>` : ''}</small></div>` +
                  `<span class="acts">${acts}${this.armedDrop?.item === x && performance.now() - this.armedDrop.at < 5000 ? `<button type="button" class="drop danger" data-drop="${i}" data-tone="harm" aria-label="Throw away ${x.name}: tap to confirm">Throw it away?</button>` : `<button type="button" class="drop" data-drop="${i}" aria-label="Throw away ${x.name}">Trash</button>`}</span></li>`
                );
              })
              .join('')}</ul>`
          : '') +
        `</div>`;
    }
    if (empty.length) {
      body +=
        `<h3>Empty</h3><ul class="spot-empty">` +
        empty.map((sp) => `<li><span>${sp.on} · ${sp.name}</span><em>${sp.fits}, ${sp.maxKg} kg · ${hideWord(concealOf(sp, inv.clothes[0]))}</em></li>`).join('') +
        `</ul>`;
    }
    if (!inv.spots.length) body += `<p class="pocket-empty">Nothing you’re wearing has pockets.</p>`;
    // Keep your place in the list when it's redrawn.
    const scroll = card.querySelector('.sheet-body')?.scrollTop ?? 0;
    card.innerHTML = `<div class="sheet-head"><h2>Pockets</h2>${close}</div><div class="sheet-body">${this.noteHtml(this.sheetNote, 'sheet-note')}${body}</div>`;
    card.querySelector('.sheet-body')!.scrollTop = scroll;
  }

  /** What the encounter needs to know about you to offer its options (see Encounter.flame). */
  private prime(e: Encounter) {
    this.unbag();
    const inv = this.inventory;
    // Looking for a supplier: anyone on the street might know one (not Dez's own people, not the police).
    e.askConnect = !this.connect.known && !e.enforcer && !e.deal && ['junkie', 'homeless', 'drunk', 'civilian'].includes(e.person.kind);
    // Anyone on the street can be asked for change (not Dez's man, not someone you're selling to, not a house).
    e.canBeg = !e.enforcer && !e.deal && !e.resident && !e.person.title;
    // Bags to sell (a point each), and powder not bagged up yet.
    const coke = inv.items.filter((x) => x.secret === 'cocaine' && x.known && (x.doses ?? 0) > 0);
    // What you've got, by what it is: all of it, summed (by weight; pills counted), and how good on average.
    const stock: NonNullable<Encounter['stock']> = {};
    let units = 0;
    for (const x of coke) {
      const k = keyOf(x);
      if (!k) continue;
      const n = x.doses ?? 0;
      const at = (stock[k] ??= { n: 0, q: 0 });
      at.q = Math.round((at.q * at.n + qualityOf(x) * n) / (at.n + n));
      at.n += n;
      if (x.pressed) at.pressed = true;
      units += n;
    }
    e.stock = stock;
    e.product = units;
    e.bulk = 0;
    const kind = e.person.kind as 'junkie';
    // (Sold them junk once too often: they won't buy from you again.)
    const burned = !!(e.person.known && this.people.find((x) => x.id === e.person.known && !x.memory.otherLife)?.memory.burned);
    if (burned) {
      delete e.wants;
      e.regular = false;
    } else if (e.wants == null && ['junkie', 'homeless', 'drunk', 'civilian'].includes(e.person.kind)) e.wants = wantFor(kind, e.person.age, new Date(now()).getHours(), this.market, this.cornerDistrict);
    // They ask for bags of whatever size you sell in (one, sometimes two or three).
    const zips = inv.items.filter((x) => x.name === 'Zip bags').reduce((n, x) => n + (x.doses ?? 0), 0);
    e.zips = zips;
    if (e.wants) {
      const p = keyProduct(e.wants);
      e.bagSize = this.sellSize(p);
      e.sellSizes = Object.fromEntries((Object.keys(SELL_SIZE) as Product[]).map((x) => [x, this.sellSize(x)]));
      e.wantBags ??= bagsFor(kind, !!e.regular);
      e.wantAmt = e.wantBags * e.bagSize;
      // (Bags far bigger than they'd buy: most of them can't afford it.)
      e.sizeFit = Math.min(1, (2 * requestFor(e.wants, kind, e.person.age, () => 0.5)) / Math.max(1, e.bagSize));
    }
    e.prices = {};
    for (const k of new Set([...(Object.keys(stock) as MarketKey[]), ...(e.wants ? [e.wants] : [])])) e.prices[k] = priceFactor(this.market, k, this.cornerDistrict);
    // (What you'd hand over: the weakest you've got first.)
    if (e.wants && e.wantAmt && (stock[e.wants]?.n ?? 0) >= e.wantAmt) {
      const q = this.qualityFor(e.wants, e.wantAmt);
      e.quote = { q, cents: quote(e.prices[e.wants] ?? 1, e.wants, e.bagSize ?? e.wantAmt, q, kind, this.stats.speech?.level ?? 1, this.standing) * (e.wantBags ?? 1) * 100 };
    } else delete e.quote;
    e.standing = this.standing;
    e.heat = this.infamy.heat;
    e.dealer = ((this.save.state.sales as number) ?? 0) > 0;
    // Face to face and awake, they see you as you are now (the least covered you've been is what sticks).
    if (e.facedYou && e.stage !== 'seen' && !e.them.out && !e.them.dead && !e.chase) {
      // (In their house, a face they've already seen stays seen, mask or not.)
      const anon = e.resident ? faceAnon(this.save.state.job as HomeJob | undefined, e.resident.owner, anonymity(inv)) : anonymity(inv);
      if (!e.seenAs || anon < e.seenAs.anon) e.seenAs = { anon, looked: describe(inv), clothes: lookClothes(inv) };
    }
    e.flame = !!this.flame();
    e.tiredOdds = fatigueOdds(this.health);
    // What you'd have no room for, lifted off them (tried on a copy of your pockets).
    e.liftNoRoom = e.known.pockets
      ? liftables(e)
          .filter((L) => {
            const sim = JSON.parse(JSON.stringify(inv)) as Inventory;
            return L.picks.some(([gi, li]) => {
              const l = e.person.clothes[gi]?.loot[li];
              return l && !take(sim, JSON.parse(JSON.stringify(l))).ok;
            });
          })
          .map((L) => L.key)
      : [];
    e.cardsHeld = e.holder
      ? inv.items.map((x, i) => ({ x, i })).filter(({ x }) => /card/.test(x.kind) && x.detail === e.holder && !x.pin && !x.pinAsked).map(({ x, i }) => ({ i, name: x.name }))
      : [];
    e.phonesHeld = e.phoneOf
      ? inv.items.map((x, i) => ({ x, i })).filter(({ x }) => x.kind === 'phone' && x.of === e.phoneOf && x.locked !== false && !x.unlockAsked).map(({ x, i }) => ({ i, name: x.name }))
      : [];
    // (Only while someone still has something of yours.)
    e.canAsk = !e.person.thief && this.world.thieves.some((t) => t.person.clothes.some((g) => g.loot.some((l) => l.yours)));
    // Their home: on your map already, and their keys in your pockets.
    const home = e.person.home;
    e.homeKnown = !!home && ((this.save.state.homesLearned as string[] | undefined) ?? []).includes(home.id) && !!this.homeById(home.id);
    e.keysHeld = !!home && inv.items.some((x) => x.opens === home.id);
    e.carrying = inv.items.filter((x) => x.hand && x.kind !== 'weapon').length;
    e.weapons = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => x.kind === 'weapon').map(({ x, i }) => ({ i, name: x.name, weapon: x.weapon, cuts: x.cuts, spray: x.spray, doses: x.doses, loaded: x.secret && x.secret !== 'empty' && x.secret !== 'cocaine' ? x.secret : undefined, known: x.known, hand: x.hand, ...(gunOf(x.name) ? { gun: true, ammo: inv.items.filter((y) => y.name === gunOf(x.name)!.ammo).reduce((n, y) => n + (y.doses ?? 0), 0) } : {}) }));
    e.wet = WET_AMOUNT[this.weather.now] > 0 && !this.inside;
    // How much of what you're carrying shows (a handle out of a pocket, the shape of a blade).
    e.exposed = exposure(inv);
    e.bagged = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => x.kind === 'weapon' && inBag(inv, x.spot)).map(({ i }) => i);
    e.ankle = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => x.kind === 'weapon' && /ankle/i.test(inv.spots.find((sp) => sp.id === x.spot)?.on ?? '')).map(({ i }) => i);
  }

  /** Redraws the person button and the encounter screen from the saved state. */
  private refresh() {
    // (Anything that changed what's on screen changed the game: it's saved a moment later.)
    this.onChanged?.();
    // (What's used up weighs less.)
    for (const x of this.inventory.items) reweigh(x);
    this.learnHomes();
    this.syncButtons();
    const e = this.encounter;
    this.seenEl.replaceChildren();
    this.seenEl.hidden = !(e && e.stage === 'seen');
    if (e && e.stage === 'seen') {
      const p = e.person;
      // (Only what you've found out: their build and sex wait for you to size them up or get a look.)
      const what = [e.known.build ? p.build : '', e.known.sex ? (p.sex === 'Male' ? 'man' : 'woman') : ''].filter(Boolean).join(' ');
      const crowd = this.crowd;
      // Others on the street too: one list, whoever you're watching first. Tap another to go over to them instead.
      this.seenEl.classList.toggle('list', crowd.length > 0);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seen-btn';
      btn.dataset.kind = p.kind;
      const k = document.createElement('span');
      k.className = 'seen-kind';
      k.textContent = e.resident ? 'Lives here' : (p.title ?? NAMES[p.kind]);
      const r = document.createElement('span');
      r.className = 'seen-race';
      r.textContent = crowd.length
        ? what && !e.resident && !e.enforcer && !p.title ? what.replace(/^./, (x) => x.toUpperCase()) : ''
        : ((far) => (e.resident || e.enforcer || p.title || !what ? far.replace(/^./, (x) => x.toUpperCase()) : `${what.replace(/^./, (x) => x.toUpperCase())}, ${far}`))(this.atBar ? 'across the bar' : 'across the street');
      const tap = document.createElement('span');
      tap.className = 'seen-tap';
      tap.textContent = crowd.length ? 'Watching' : 'Tap to approach';
      btn.append(k, r, tap);
      btn.onclick = () => this.act('open');
      this.seenEl.append(btn);
      crowd.forEach((b, i) => {
        const o = document.createElement('button');
        o.type = 'button';
        o.className = 'seen-btn seen-other';
        o.dataset.kind = b.e.person.kind;
        const pp = b.e.person;
        o.innerHTML = `<span class="seen-kind">${pp.title ?? NAMES[pp.kind]}</span><span class="seen-race"></span><span class="seen-tap">Passing by</span>`;
        o.onclick = () => this.approachOther(i);
        this.seenEl.append(o);
      });
    } else this.seenEl.classList.remove('list');
    this.fitStreet();
    if (e) this.prime(e);
    this.encView.render(this.tvState.on ? e : null);
    this.renderStats();
    this.renderYou(!!e && e.stage !== 'seen');
    this.view.classList.toggle('in-encounter', !!e && e.stage !== 'seen');
    this.view.classList.toggle('ending', this.ending);
    this.view.classList.toggle('note-off', !!e && e.stage !== 'seen' && (e.stage !== 'over' || this.ending));
    this.renderShop();
    if (this.sheet) this.renderSheet();
    // (In the game's own tick it's time passing, not something that happened: just looked at, not floated.)
    this.floatNumbers(!this.ticking);
  }

  /** The stats sheet: each stat, what it does for you right now, how it grows; then the rest of you. */
  private statsHtml(): string {
    const st = this.stats;
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const sign = (x: number) => `${x >= 0 ? '+' : '−'}${pct(Math.abs(x))}`;
    const now: Record<StatName, [string, string][]> = {
      sneak: [
        ['Ambushes land', sign(ambushBonus(st))],
        ['How fast you’re noticed', noticeRate(st) >= 0.995 ? 'normal' : `−${pct(1 - noticeRate(st))}`],
        ['Attention from selling and witnesses', `−${pct(Math.min(0.6, (st.sneak.level - 1) * 0.006))}`],
      ],
      strength: [
        ['Damage from your blows', `+${pct(strengthDamage(st))}`],
        ['Fear of you', `+${strengthFear(st)}`],
        ['Your carry limit', kgLabel(carryLimit(st.strength.level))],
        ['Most, weighed down', kgLabel(Math.round(carryLimit(st.strength.level) * OVERLOAD * 10) / 10)],
      ],
      unarmed: [
        ['Damage from your blows', `+${pct(unarmedDamage(st))}`],
        ['All told (with Strength)', `×${damageMult(st).toFixed(2)}`],
        ['Moves', 'Learned in each fighting style, below'],
      ],
      agility: [
        ['Your blows land', sign(accuracyBonus(st))],
        ['Their blows land', sign(-dodgeBonus(st))],
      ],
      stamina: [
        ['Stamina', `${maxStamina(st)}`],
        ['Breath back each turn', `${staminaRegen(st).toFixed(1)}`],
        ['Outrunning the police', `+${pct(runStamina(st))}`],
      ],
      weapons: [
        ['Damage with a weapon', `+${pct(weaponDamage(st))}`],
        ['Weapon blows land', sign(weaponAccuracy(st))],
        ['On you', this.inventory.items.filter((x) => x.kind === 'weapon').map((x) => x.name).join(', ') || 'Nothing. Take one off someone.'],
      ],
      intimidation: [
        ['Fear, from this stat', `+${fearBonus(st)}`],
        ...this.menaceRows(),
        ['Total, before who they are', `+${Math.round(this.menace())}`],
      ],
      toughness: [
        ['Blows rattle you toward going out', `−${pct(toughnessResist(st))}`],
        ['A lucky one knocking you out cold', `−${pct(toughnessResist(st))}`],
        ['A bone breaking', `−${pct(toughnessResist(st))}`],
      ],
      scavenging: [
        ['Useful find', `1\u00a0in\u00a0${Math.round(1 / uncommonOdds(st.scavenging.level))}`],
        ['Rare find', `1\u00a0in\u00a0${Math.round(1 / rareOdds(st.scavenging.level))}`],
        ['Spoiled food', pct(spoilOdds(st.scavenging.level))],
        ['Cut on glass, bare hands', `${(cutOdds(st.scavenging.level, false) * 100).toFixed(1)}%\u00a0a\u00a0dig`],
        ['Told to move along', `${(shooOdds(st.scavenging.level, 'flats') * 100).toFixed(1)}%\u00a0a\u00a0dig`],
      ],
      speech: [
        ['Lies that land', `+${pct(lieBonus(st))}`],
        ['Talking them into handing it over', `+${pct(persuadeBonus(st.speech.level))}`],
        ['Talking them into buying', `+${pct((st.speech.level - 1) * 0.004)}`, ],
        ['What they’ll pay', `+${pct((st.speech.level - 1) * 0.004)}`],
      ],
    };
    const how: Record<StatName, string> = {
      scavenging: 'Going through the bins. More when you find something useful, and more again for something rare.',
      speech: 'Talking your way out of things (the police, a clerk who doubts your ID, someone who catches you following them), and selling. More when the lie, or the sale, works.',
      sneak: 'Surveilling, ambushes (bum rush, sucker punch, shove), and selling without anyone noticing.',
      strength: 'Landing blows, and carrying a heavy load around (slowly).',
      unarmed: 'Landing blows, ambushes and techniques. Each new level can teach you a new move.',
      agility: 'Landing blows, and dodging theirs.',
      stamina: "Fighting until you’re exhausted.",
      toughness: 'Getting hurt, and nothing else: every blow you take, and more the worse off you are when it lands (bleeding, rattled, broken, on the floor).',
      weapons: 'Using a weapon in a fight (and pepper spray). Take them off the people who carry them.',
      intimidation: 'Mugging, threatening, making people give up, and torture. Scared people hand it over, tell the truth, and give up mid-fight.',
    };
    const rows = (xs: [string, string][]) => xs.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    // What's wrong with you comes first: each injury and what it's doing to you.
    const all = injuryEffects(this.health, this.stressNow);
    const states = all.filter((i) => i.status);
    // (Marks and scars aren't dangerous: they're shown apart, further down.)
    const hurts = all.filter((i) => !i.status && !i.mark);
    // The states you're in (stress, drink, drugs, caffeine, cold), each with its meter.
    let status = states.length
      ? `<section class="stat-card injuries status"><h3><span>Status</span><b>${states.length}</b></h3>` +
        states
          .map(
            (i) =>
              `<div class="injury"><h4>${i.name}</h4>` +
              (i.meter ? `<div class="spot-bar status-bar${/withdraw|hooked|craving|panick|stressed|stress: high|blackout|drunk/i.test(i.name) ? ' harm' : ''}"><i style="width:${Math.round(i.meter.k * 100)}%"></i><span>${i.meter.text}</span></div>` : '') +
              `<ul>${i.effects.map((x) => `<li>${x}</li>`).join('')}</ul><p class="stat-how">${i.heals}</p></div>`,
          )
          .join('') +
        `</section>`
      : '';
    // What's hurting you first (bleeding, breaks), then the states you're in.
    let html = hurts.length
      ? `<section class="stat-card injuries"><h3><span>Condition</span><b>${hurts.length}</b></h3>` +
        hurts
          .map((i) => `<div class="injury"><h4>${i.name}</h4><ul>${i.effects.map((x) => `<li>${x}</li>`).join('')}</ul><p class="stat-how">${i.heals}</p></div>`)
          .join('') +
        `</section>`
      : '';
    html += status;
    html += (Object.keys(STAT_NAMES) as StatName[])
      .map((k) => {
        const { level, xp } = st[k];
        const max = level >= MAX_LEVEL;
        const need = xpToNext(level);
        return (
          `<section class="stat-card"><h3><span>${STAT_NAMES[k]}</span><b>${level}${max ? ' · max' : ''}</b></h3>` +
          `<div class="spot-bar"><i style="width:${max ? 100 : Math.min(100, (100 * xp) / need)}%"></i><span>${max ? 'Maxed out' : `${Math.floor(xp)} / ${need} to level ${level + 1}`}</span></div>` +
          `<dl class="stat-now">${rows(now[k])}</dl><p class="stat-how">Grows by: ${how[k]}</p></section>`
        );
      })
      .join('');
    // The fighting styles: each its own level, its moves, and what's next.
    const sty = stylesOf(st);
    html +=
      `<section class="stat-card styles"><h3><span>Fighting styles</span></h3><p class="stat-how">Every blow with your body trains Unarmed; each style levels from its own moves, and its level is what teaches you its harder ones.</p>` +
      STYLES.map((k) => {
        const { level, xp } = sty[k];
        const need = xpToNext(level);
        const max = level >= MAX_LEVEL;
        const known = ALL_TECHNIQUES.filter((t) => t.style === k && t.level <= level).map((t) => t.name);
        const next = ALL_TECHNIQUES.find((t) => t.style === k && t.level > level);
        return (
          `<div class="style-row"><h4><span>${STYLE_NAMES[k]}</span><b>${level}</b></h4>` +
          `<div class="spot-bar"><i style="width:${max ? 100 : Math.min(100, (100 * xp) / need)}%"></i><span>${max ? 'Maxed out' : `${Math.floor(xp)} / ${need}`}</span></div>` +
          `<p class="stat-how">${known.length ? known.join(', ') : 'Just the basics'}.${next ? ` Next: ${next.name} at ${next.level}.` : ''} Grows by ${STYLE_HOW[k]}.</p></div>`
        );
      }).join('') +
      `</section>`;
    // The rest of you.
    const h = this.health;
    const stress = this.stressNow;
    const nerve = h.nerve ?? 0;
    const hu = this.humanity;
    const lvl = humanityLevel(hu.lost);
    html +=
      `<section class="stat-card"><h3><span>Your state</span></h3><dl class="stat-now">` +
      rows([
        ['Stress', `${Math.round(stress)} / 100${stress >= 1 ? ` (blows land ${sign(-stress / 400)}, dodging ${sign(-stress / 400)})` : ''}`],
        ['Nerve', `${Math.round(nerve)} / 100 (violence stresses you ${pct(1 - nerve / 100)} as much)`],
        ['Humanity', `${lvl?.name ?? (hu.lost ? 'Shaken' : 'Intact')} · ${hu.kills} killed`],
        ...this.dezRow(),
        ...this.extraStatRows(),
      ]) +
      `</dl><p class="stat-how">Stress builds in fights and eases with time and cigarettes. Nerve grows with every fight you live through.</p></section>`;
    return html;
  }

  /**
   * How frightening you are, before who they are comes into it: your
   * Intimidation and Strength, how far gone you are, a mask.
   */
  private menace(): number {
    const st = this.stats;
    return fearBonus(st) + strengthFear(st) + evilFear(this.humanity.lost) + (conspicuous(this.inventory) ? 6 : 0);
  }
  private menaceRows(): [string, string][] {
    const st = this.stats;
    const rows: [string, string][] = [['Fear, from your Strength', `+${strengthFear(st)}`]];
    const evil = Math.round(evilFear(this.humanity.lost));
    if (evil) rows.push(['Fear, from the look in your eyes', `+${evil}`]);
    if (conspicuous(this.inventory)) rows.push(['Fear, from the mask', '+6']);
    if (this.inventory.items.some(isBlade)) rows.push(['Fear, when you show them your blade (mugging)', '+10']);
    return rows;
  }

  /**
   * How scared of you someone is as you walk up (0..100): how frightening
   * you are, who they are (a drunk is braver, a big build braver still),
   * whether they know you and what you did to them, your reputation, and
   * how hurt you look.
   */
  private fearOf(e: Encounter): number {
    const p = e.person;
    const f = this.infamy;
    const h = this.health;
    const tough = ['Easy', 'Fair', 'Hard', 'Brutal'].indexOf(BUILDS[p.build].difficulty);
    let fear = 20 + this.menace() * personalityOf(p).cowed + { civilian: 10, junkie: 3, homeless: 0, drunk: -12 }[p.kind] - tough * 9 + personalityOf(p).fear;
    if (e.recognised) {
      const k = p.known ? this.people.find((x) => x.id === p.known) : undefined;
      if (k) fear += Math.min(25, f.rep * 0.25) + (k.memory.fear ?? 0) * 0.7 - (k.memory.beatYou ? 15 : 0);
      else fear += Math.min(30, f.rep * 0.3);
    } else fear += Math.min(8, f.rep * 0.05 * (1 - anonymity(this.inventory)));
    // They can see you're carrying.
    fear += exposure(this.inventory) * 18;
    // You look like you'd lose.
    if (h.broken.some((x) => x.endsWith('leg'))) fear -= 8;
    if (h.blood < h.maxBlood * 0.7) fear -= 8;
    return Math.max(0, Math.min(100, Math.round(fear)));
  }

  /** Dez, if you know him: how far he trusts you, and what that gets you. */
  private dezRow(): [string, string][] {
    const c = this.connect;
    if (c.cutOff) return [['Dez', 'Cut you off']];
    if (!c.known) return [];
    const t = Math.round(c.trust);
    const word = t < 0 ? 'Wary of you' : t < 30 ? 'Knows you' : t < 70 ? 'Trusts you a little' : 'Trusts you';
    return [['Dez', `${word} (${t}) · ${['', 'weed, pills, an eight-ball', 'more of it, and crystal', 'heroin and rocks, from his supplier'][this.tier]}`]];
  }
  /** More rows for the stats sheet (reputation, anonymity...). */
  private extraStatRows(): [string, string][] {
    const f = this.infamy;
    const inv = this.inventory;
    const anon = anonymity(inv);
    return [
      ['Reputation', `${repName(f.rep)} (${Math.round(f.rep)})`],
      ['Anonymity', `${Math.round(anon * 100)}%${conspicuous(inv) ? ' · masked: people notice you faster' : ''}`],
      ['People who remember you', `${this.people.filter((k) => !k.memory.otherLife).length}`],
    ];
  }

  /** Your stats in the top corner, each with progress towards its next level. */
  private renderStats() {
    this.statsEl.hidden = !this.tvState.on;
    const st = this.stats;
    this.statsEl.innerHTML = (Object.keys(STAT_NAMES) as StatName[])
      .map((k) => {
        const { level, xp } = st[k];
        const pct = level >= MAX_LEVEL ? 100 : Math.min(100, (100 * xp) / xpToNext(level));
        return `<div class="stat" data-stat="${k}"><span><em class="long">${STAT_NAMES[k]}</em><em class="short">${STAT_SHORT[k]}</em></span><b>${level}</b><i><u style="width:${pct}%"></u></i></div>`;
      })
      .join('');
  }

  /** Your blood and injuries, under your stats (when not in an encounter). */
  private renderYou(inEncounter: boolean) {
    const h = this.health;
    this.youEl.hidden = !this.tvState.on || inEncounter;
    const pct = (100 * h.blood) / h.maxBlood;
    this.youEl.innerHTML =
      `<div class="you-blood"><span>Blood</span><i><b style="width:${pct}%"></b><s style="left:${PASS_OUT * 100}%"></s></i><em>${(h.blood / 1000).toFixed(1)} L</em></div>` +
      `<div class="enc-conds">${((cs) => (cs.length > 4 ? [...cs.slice(0, 3), `+${cs.length - 3} more`] : cs))(healthConditions(h)).map((c) => `<span class="${/^\+\d+ more$/.test(c) ? 'more' : ''}">${c}</span>`).join('')}</div>` +
      `<div class="you-cash">${money(Math.round(cashOf(this.inventory) * 100))}</div>` +
      this.humanityLine();
    // Where your status ends, so a shop card starts below it (lots of injuries make it tall).
    const bottom = this.youEl.hidden ? 0 : Math.round(this.youEl.getBoundingClientRect().bottom - this.view.getBoundingClientRect().top);
    this.view.style.setProperty('--you-bottom', `${bottom}px`);
  }

  /** How far gone you are, once you've started. */
  private humanityLine() {
    const h = this.humanity;
    const lvl = humanityLevel(h.lost);
    if (!lvl && !h.kills) return '';
    const kills = h.kills ? ` · ${h.kills} dead` : '';
    return `<div class="you-humanity" data-level="${(lvl?.name ?? 'human').toLowerCase()}"><span>Humanity</span><b>${lvl?.name ?? 'Shaken'}</b><em>${kills}</em></div>`;
  }

  private stepLurk(dt: number) {
    this.timer -= dt;
    if (this.phase === 'cut') {
      // The signal drops out.
      this.jam = 1;
      if (this.timer <= 0) {
        this.phase = 'waiting';
        this.timer = 1 + Math.random() * 1.3;
        if (this.pendingLurk.length) {
          const l = this.pendingLurk;
          this.pendingLurk = [];
          this.note(l);
        }
      }
    } else if (this.phase === 'waiting') {
      // The wait: the odd flicker of interference.
      if (Math.random() < dt * 0.9) this.jam = Math.max(this.jam, 0.2 + Math.random() * 0.25);
      if (this.timer <= 0) {
        // Someone you used to be, out walking.
        this.settleSelves();
        const old = this.place === 'street' ? this.selves.find((x) => x.status === 'free' && now() - (x.metAt ?? x.at ?? 0) > 6 * 3_600_000) : undefined;
        if (old && Math.random() < 0.15) {
          old.metAt = now();
          this.phase = 'idle';
          this.jam = 0;
          this.meetSelf(old);
          return;
        }
        // Someone with your things, someone you've met, or a stranger.
        // Late with Dez's money: someone comes for it.
        const dz = this.debt;
        const sent = !!dz && now() > dz.due && Math.random() < Math.min(0.6, 0.25 + (dz.strikes ?? 0) * 0.1);
        const thief = sent ? null : maybeThief(this.world);
        const known = sent ? null : thief ? (thief.known ? (this.people.find((k) => k.id === thief.known) ?? null) : null) : comeBack(this.people);
        const person = sent ? this.enforcerFor(dz!) : (thief ?? (known ? meet(known) : makePerson(this.cornerFeel.chances)));
        const s = this.lurkState;
        s.times++;
        s.seen[person.kind]++;
        s.races[person.race]++;
        const e = newEncounter(person, this.yourBody());
        if (this.atBar) e.bar = true;
        const inv = this.inventory;
        const anon = anonymity(inv);
        e.conspicuous = conspicuous(inv);
        if (known) {
          if (!thief) applyTo(known, e.them);
          else {
            known.healedAt ??= known.at;
            heal(known);
            applyTo(known, e.them);
          }
          e.recognised = recognises(known, anon, lookClothes(inv));
          e.lookAt = { anon, clothes: lookClothes(inv).join('|') };
          e.grudge = known.memory.grudge;
          // (What an earlier you did to them, this you doesn't know.)
          e.history = known.memory.otherLife ? undefined : historyText(known);
          e.looks = [...injuriesText(known), ...marksText(known.marks)];
          e.dread = known.memory.fear ?? 0;
          e.regular = !!known.memory.customer && !!e.recognised && (known.memory.grudge ?? 0) < 30;
          // (A regular wants what they always get.)
          if (e.regular && known.memory.usual) {
            e.wants = known.memory.usual;
            if (known.memory.usualBags) e.wantBags = known.memory.usualBags;
          }
        } else if (!sent && Math.random() < Math.min(0.5, this.infamy.rep / 200) * (1 - anon)) {
          // A stranger who's heard about you, and knows your face.
          e.recognised = true;
          e.byRep = true;
          e.lookAt = { anon, clothes: lookClothes(inv).join('|') };
          e.grudge = 0;
          e.history = "You’ve never met. But they know your face: people talk.";
        }
        // How they were when it began (to tell, later, what you did this time).
        e.start = { blood: e.them.blood, broken: [...e.them.broken] };
        this.encounter = e;
        if (sent) {
          e.enforcer = true;
          this.phase = 'idle';
          this.act('ambushed');
          buzz([60, 40, 90]);
          return;
        }
        // The ones who hate you most come looking: they find you first.
        if (known && e.recognised && (e.grudge ?? 0) >= 70 && (e.dread ?? 0) < 60 && !known.broken.some((p) => /(leg|ankle)$/.test(p) || p === 'spine') && known.broken.filter((p) => /(arm|wrist|hand)$/.test(p)).length < 2 && Math.random() < 0.5) {
          // Through the normal path, so a fight that ends at once is dealt with properly.
          this.phase = 'idle';
          this.act('ambushed');
          buzz([60, 40, 90]);
          return;
        }
        this.phase = 'idle';
        // Not always alone: up to two others on the street (more by day, fewer at night and in the rain).
        this.gatherCrowd();
        // Whoever it is takes the middle of the screen: the note moves under them.
        this.noteEl.classList.add('low');
        this.refresh();
        uiGlitch(this.seenEl, 0.3);
        buzz(14);
      }
    }
  }

  /** Starts a new game from the beginning. */
  start() {
    this.running = true;
    this.view.classList.add('active');
    this.showSavedScene();
  }

  /** Rebuilds the scene exactly as it was saved, then waits paused. */
  restorePaused() {
    this.running = false;
    this.paused = true;
    this.view.classList.add('active');
    this.showSavedScene();
  }

  private showSavedScene() {
    // Loaded standing at a hiding place: it's as safe as it would have been (no reload trick).
    if (this.place === 'fence' || this.place === 'room') {
      const lost = this.place === 'fence' ? this.checkStash() : this.checkRoom();
      if (lost.length) this.timers.push(window.setTimeout(() => !this.closed && this.note(lost), 700));
    }
    if (this.place === 'spot' && this.atSpot?.kind === 'vacant') {
      const lost = this.checkVacant(this.atSpot.id);
      if (lost.length) this.timers.push(window.setTimeout(() => !this.closed && this.note(lost), 700));
    }
    // A note that was waiting for you when the game closed: still waiting.
    if (Array.isArray(this.save.state.stickyNote) && this.tvState.on && this.place === 'street' && !this.encounter) {
      const lines = this.save.state.stickyNote as string[];
      const extra = Array.isArray(this.save.state.stickyExtra) ? (this.save.state.stickyExtra as string[]) : [];
      this.timers.push(
        window.setTimeout(() => {
          if (this.closed) return;
          this.note(lines, true);
          this.noteEl.firstElementChild?.classList.add('note-title');
          if (extra.length) this.note(extra);
        }, 600),
      );
    }
    // Closed at the plasma center, or out on deliveries: you still are.
    document.getElementById('work')?.remove();
    if (this.work && !this.jail && typeof this.save.state.deathScreen !== 'string') {
      this.running = false;
      this.showWork();
    }
    // Closed while lying down: you still are.
    document.getElementById('rest')?.remove();
    if (this.health.restingSince != null && !this.jail && typeof this.save.state.deathScreen !== 'string') {
      this.running = false;
      this.showRest();
    }
    // Closed while inside: you still are (or the door opens now).
    document.getElementById('jail')?.remove();
    if (this.jail && typeof this.save.state.deathScreen !== 'string') {
      this.running = false;
      this.showJail();
    }
    // Closed on the death screen: it's still there.
    if (typeof this.save.state.deathScreen === 'string') {
      this.dead = true;
      this.running = false;
      this.showDeath(this.save.state.deathScreen);
    }
    if (this.tvState.on) {
      // The set was already on at the save point: no warm-up.
      this.powerBtn.hidden = true;
      this.tv.powerOnSettled();
      // Saved in the beat after a fight ended: finish ending it.
      const e = this.encounter;
      if (e?.stage === 'over' && e.result !== 'killed' && !e.finished) {
        const saved = e.result === 'lost' ? this.save.state.koLines : this.save.state.endLines;
        const lines = Array.isArray(saved) ? (saved as string[]) : [RESULT[e.result ?? 'left']];
        this.ending = true;
        this.timers.push(
          window.setTimeout(() => {
            this.ending = false;
            if (this.closed || this.encounter !== e) return;
            delete this.save.state.endLines;
            if (e.result === 'lost') this.knockedOut(lines);
            else this.closeEncounter(lines);
          }, 400),
        );
      }
    } else if (Array.isArray(this.save.state.koLines)) {
      // Saved while you were out cold: you still have to come to.
      this.tv.powerOff();
      this.koLines = this.save.state.koLines as string[];
      this.view.classList.add('ko-out');
      this.powerBtn.hidden = true;
      this.powerBtn.classList.remove('pressed');
      this.waitToComeRound();
    } else {
      this.tv.powerOff();
      this.powerBtn.hidden = false;
      this.powerBtn.classList.remove('pressed');
    }
    this.refresh();
    // Stopped by the police when the game was saved: they're still there.
    if ((this.save.state.policeStop || this.save.state.policeResult) && this.tvState.on) this.openSheet('police');
  }

  turnOn() {
    if (this.tvState.on || !this.running) return;
    this.powerBtn.classList.add('pressed');
    this.tvState.on = true;
    // iPhones only let a page feel the phone move once asked, from a tap.
    const DM = (globalThis as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    DM?.requestPermission?.().catch(() => {});
    // Coming to after a knockout: what happened, once the picture's back.
    const woke = this.koLines;
    this.koLines = null;
    delete this.save.state.koLines;
    if (woke) this.save.state.wokeLines = woke;
    this.view.classList.remove('ko-out');
    // (Waking up to the police: they're there the moment the picture is.)
    if (woke) this.timers.push(window.setTimeout(() => this.showWoke(), this.save.state.policeStop ? 600 : 2900));
    // (Kept in timers, so quitting straight after can't touch the next game.)
    this.timers.push(window.setTimeout(() => {
      this.powerBtn.hidden = true;
      this.tv.powerOn();
      this.refresh();
      // The picture snaps open ~0.45 s in: shake the set and buzz the phone.
      this.timers.push(window.setTimeout(() => {
        this.view.classList.remove('jolt');
        void this.view.offsetWidth;
        this.view.classList.add('jolt');
        try {
          navigator.vibrate?.([12, 40, 25]);
        } catch {
          /* not allowed here */
        }
      }, 430));
    }, 350));
  }

  /** The pause menu's up. */
  private paused = false;
  pause() {
    this.running = false;
    this.paused = true;
    // A lurk cut short by pausing just ends (the save holds no half-lurk).
    if (this.phase !== 'idle') {
      this.phase = 'idle';
      this.jam = 0;
    }
  }

  resume() {
    this.paused = false;
    if (this.dead || this.jail || this.work || this.health.restingSince != null || document.getElementById('choose')) return;
    this.running = true;
    // (Paused, or reloaded, before what happened while you were out was shown.)
    if (this.tvState.on && !this.koLines) this.showWoke();
  }
  private showWoke() {
    const woke = this.save.state.wokeLines;
    if (!this.running || this.closed || !Array.isArray(woke)) return;
    delete this.save.state.wokeLines;
    // Woken up into a police stop: what happened goes at the top of it (not in a note left for after jail).
    if (this.save.state.policeStop) {
      this.save.state.policeWhy = [...(woke as string[]), ...(Array.isArray(this.save.state.policeWhy) ? (this.save.state.policeWhy as string[]) : [])];
      if (this.tvState.on) {
        if (this.sheet === 'police') this.renderSheet();
        else this.openSheet('police');
      }
      return;
    }
    this.note(woke as string[], true);
    this.noteEl.firstElementChild?.classList.add('note-title');
  }

  /** Closes the game view (back to the menu). */
  close() {
    this.closed = true;
    for (const id of ['rest', 'jail', 'choose', 'work']) document.getElementById(id)?.remove();
    document.removeEventListener('pointerdown', this.onTap, { capture: true });
    clearTimeout(this.noteFade);
    this.koListen?.abort();
    this.koHint.remove();
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    // This game is done with: its window listeners go too, and the TV's GPU buffers.
    this.listeners.abort();
    this.tv.dispose();
    this.fx.setLow(0);
    this.hitUi.clear();
    this.view.style.transform = '';
    this.pause();
    this.view.classList.remove('active', 'jolt', 'in-encounter', 'ko-out');
    this.tv.powerOff();
    this.lurkBtn.hidden = true;
    this.seenEl.replaceChildren();
    this.seenEl.hidden = true;
    this.encView.render(null);
    this.statsEl.hidden = true;
    this.youEl.hidden = true;
    this.restBtn.hidden = true;
    this.noteEl.hidden = true;
    this.goBtn.hidden = true;
    this.bagBtn.hidden = true;
    this.youBtn.hidden = true;
    this.shopEl.hidden = true;
    this.closeSheet();
    document.getElementById('death')?.remove();
  }
  /** Closed (quit to the menu, a new game): its leftover timers do nothing. */
  private closed = false;

  setSize(width: number, height: number, pixelRatio = 1) {
    void pixelRatio;
    this.tv.setSize(width, height);
  }

  /** Debug: freeze the TV sequence at a moment (seconds), or null to resume. */
  freezeTv(t: number | null) {
    this.tv.freeze(t);
  }

  /** In the clock's tick (not something you did): see note(). */
  private ticking = false;
  update(dt: number) {
    this.ticking = true;
    try {
      this.tick(dt);
    } finally {
      this.ticking = false;
    }
  }
  private tick(dt: number) {
    // (What time does by itself, frame to frame, isn't floated: the last look moves with it.)
    if (this.nums) this.nums = this.numbers();
    // (The body first: hours spent inside or lying down heal as that, before the door opens or you get up.)
    this.healOnClock();
    this.tickCrowd();
    this.tickLockup();
    if (this.jail && !this.dead) this.tickJail();
    else if (this.health.restingSince != null && !this.dead) this.tickRest();
    else if (this.work && !this.dead) this.tickWork();
    else this.flushLater();
    if (this.running) {
      this.tickSmoke(dt);
      // Withdrawal: stress that won't settle.
      const floor = withdrawalEffects(this.health).floor;
      if (floor > (this.health.stress ?? 0)) this.health.stress = Math.min(floor, (this.health.stress ?? 0) + dt * 0.4);
      this.tickExposure(dt);
    }
    if ((this.weatherTimer -= dt) <= 0) {
      this.weatherTimer = 2;
      this.shortenOldTerms();
      this.reviewFootage();
      // (A chase left standing for a quarter of an hour, or the game closed on it: they're long gone.)
      const ch = this.encounter?.chase;
      if (ch && this.running && now() - (ch.at ?? 0) > 15 * 60_000) this.act('let-go');
      // (Someone just standing across the street for ten minutes, or the game closed on them: they've moved on.)
      const sn = this.encounter;
      if (sn?.stage === 'seen' && this.place === 'street' && !sn.resident && this.running && this.phase === 'idle' && !this.sheet && now() - sn.seenAt! > 10 * 60_000) {
        this.encounter = null;
        this.refresh();
      }
      // (A sting that's done, left sitting on its last screen: the badges come out now.)
      if (this.save.state.policeStop === 'sting' && this.running && this.sheet !== 'police' && this.encounter?.finished) this.closeEncounter([]);
      // The street market moves on; you hear about busts and big loads if you're in the business.
      const evs = tickMarket(this.market);
      if (evs.length && (this.connect.known || ((this.save.state.sales as number) ?? 0) > 0)) this.later(evs.map((ev) => EVENT_LINES[ev.kind](ev.key)));
      // Missed your court date: a warrant.
      const cs = this.case;
      this.settleSelves();
      // (A warrant already out for a crime doesn't excuse the court date: missing it is its own warrant, on top.)
      if (cs && (!cs.warrant || (cs.warrantFor === 'crime' && cs.charges.length && !cs.missedCourt)) && !this.save.state.bailOffer && !this.jail && now() > cs.courtAt) {
        cs.warrant = true;
        cs.missedCourt = true;
        delete cs.warrantFor;
        cs.bailPaid = 0;
        this.infamy.heat = Math.min(100, this.infamy.heat + 40);
        const missed = ['You missed your court date. There’s a warrant out for you now, and your bail is gone.'];
        if (this.running && this.tvState.on) this.note(missed);
        else this.later(missed);
      }
      const was = this.weather.now;
      if (updateWeather(this.weather) && this.running && this.tvState.on && this.weather.now !== was && !this.inside) {
        this.note([weatherLine(this.weather.now, was, partOfDay() !== 'day')], false, 'weather');
      }
    }
    this.tickClock();
    if (this.running) {
      this.save.playTime += dt;
      this.stepLurk(dt);
    }
    this.jam = Math.max(0, this.jam - dt * 2.2);
    this.tv.setJam(this.jam);
    this.syncButtons();
    if (this.sheet && this.sheet !== 'stats' && this.sheet !== 'police' && !this.canOpenSheet) this.closeSheet();
    if (this.running && this.noteTimer > 0 && (this.noteTimer -= dt) <= 0) {
      // A short fade, not a blink.
      this.noteEl.classList.add('fading');
      this.noteFade = window.setTimeout(() => {
        this.noteEl.hidden = true;
        this.noteEl.classList.remove('fading');
      }, 380);
    }
    this.tv.update(dt);
    // The red edge pulses when your blood is low.
    const e2 = this.encounter;
    const body = e2 && e2.stage !== 'seen' && e2.stage !== 'over' ? e2.you : this.health;
    const frac = body.blood / body.maxBlood;
    this.fx.setLow(this.tvState.on ? Math.min(1, Math.max(0, (0.82 - frac) / (0.82 - PASS_OUT))) : 0);
    this.hitUi.update(dt);
    // Bleeding from the head in a fight: blood runs down over the top of the
    // screen, into your eyes. The worse the bleeding, the faster it comes.
    const eb = this.encounter;
    if (this.running && this.tvState.on && eb && eb.stage === 'combat' && eb.you.headBleed && eb.you.bleeding > 0 && !eb.you.out) {
      if ((this.bleedClock -= dt) <= 0) {
        this.bleedClock = 3.2 - eb.you.bleeding * 0.55 + Math.random() * 1.2;
        this.fx.bleedTop(eb.you.bleeding);
      }
    } else if (this.bleedClock !== 0.6) {
      this.fx.resetBleedTop();
      this.bleedClock = 0.6;
    }
  }
  /** Seconds to the next run of blood from the top (bleeding from the head). */
  private bleedClock = 0.6;

  /** The device's time, top right (redrawn when the minute changes). */
  private tickClock() {
    const t = now();
    // (Once a second is plenty.)
    const sec = Math.floor(t / 1000);
    if (sec === this.clockSec) return;
    this.clockSec = sec;
    const s = clockText(t);
    const wx = this.weather.now;
    const key = s + wx;
    if (key === this.clockShown) return;
    this.clockShown = key;
    this.clockEl.querySelector('b')!.textContent = s;
    this.clockEl.querySelector('span')!.textContent = `${dateText(t)} · ${WEATHER_NAME[wx]}`;
    // Opening hours change with the time: waiting at the door when it opens, you
    // go in; there at closing, you're shown out.
    if (this.place !== 'street' && this.running && this.tvState.on) {
      const inside = this.inside;
      // (Just arrived, or the game just loaded here: nothing's changed yet.)
      if (this.insideAt !== this.place) {
        this.insideAt = this.place;
        this.wasInside = inside;
      } else if (inside !== this.wasInside && placeInfo(this.place).indoors) {
        this.wasInside = inside;
        const name = placeInfo(this.place).name;
        const armed = this.place === 'court' && this.inventory.items.some((x) => x.kind === 'weapon' && !/bottle|syringe/i.test(x.name));
        this.note(
          !inside
            ? ['Closing time. They show you out and lock up behind you.']
            : armed
              ? [`${name} opens. You join the line for the metal detector.`, ...this.goingIn()]
              : [`${name} opens. You go in.`, ...this.goingIn()],
        );
      }
    }
    if (this.place !== 'street') this.renderShop();
    if (this.sheet === 'places') this.renderSheet();
  }

  /** Shows the buttons that fit the moment: Lurk, Rest, the edge tabs. */
  private syncButtons() {
    // The Lurk button shows whenever you're free to lurk.
    const e = this.encounter;
    const show = this.canLurk && !(e && e.stage === 'over'); // then it's in the encounter screen
    // (While you wait, it stays, greyed.)
    const waiting = this.phase !== 'idle' && this.place === 'street' && this.running;
    if (!waiting) this.lurkBtn.classList.remove('waiting');
    const showL = show || waiting;
    let moved = false;
    if (this.lurkBtn.hidden === showL) {
      this.lurkBtn.hidden = !showL;
      this.lurkBtn.querySelector('span')!.textContent = 'Lurk';
      moved = true;
    }
    const rest = show && (isHurt(this.health) || fatigueNow(this.health) >= 10);
    if (this.restBtn.hidden === rest) {
      this.restBtn.hidden = !rest;
      moved = true;
    }
    // (Lurk or Rest came or went: the note's strip under them moves with them.)
    if (moved) this.fitStreet();
    // The very first time: what there is to do.
    if (show && !this.save.state.toldStart && this.lurkState.times - this.world.lifeStart === 0) {
      this.save.state.toldStart = true;
      this.later(['Lurk, and watch the street: someone always comes along. Go takes you places. Pockets is what you carry. You is you.']);
    }
    if (rest && !this.save.state.restTold) {
      this.save.state.restTold = true;
      this.later([`${isHurt(this.health) ? 'You’re hurt.' : fatigueNow(this.health) >= 20 ? 'You’re tired.' : 'You’re starting to tire.'} Rest: lie low and get your strength back. It takes real time, and you can get up early.`]);
    }
    // The edge tabs: whenever a drawer could be pulled in.
    const pull = (this.canOpenSheet && !this.sheet) || (this.phase !== 'idle' && this.place === 'street' && this.running && !this.sheet);
    if (this.goBtn.hidden === pull) this.goBtn.hidden = !pull;
    if (this.bagBtn.hidden === pull) this.bagBtn.hidden = !pull;
    // You (your stats): any time the TV's on and nothing's open, even mid-fight.
    const you = this.running && this.tvState.on && !this.sheet && !this.dead;
    // (Your blood and cash, and the You tab, come up with the picture, not before.)
    this.view.classList.toggle('warming', this.tvState.on && !this.tv.showingPicture);
    // (The hour on the tube: a touch darker at night, eased in.)
    const pd = partOfDay();
    const want = pd === 'night' ? 0.84 : pd === 'day' ? 1 : 0.92;
    this.dim += (want - this.dim) * 0.02;
    this.tv.setDim(this.dim);
    if (this.youBtn.hidden === you) this.youBtn.hidden = !you;
  }

  /** Writes progress to the device. Returns false if storage is unavailable. */
  saveNow(): boolean {
    void this.lurkState;
    // Remove state from earlier versions of the game.
    delete this.save.state.player;
    delete this.save.state.whisp;
    delete this.save.state.orb;
    // When you were last here, by the real clock (for time that passes while away).
    this.save.state.lastSeen = now();
    return writeSave(this.save);
  }

  /** For automated tests. */
  get debug() {
    return { cash: cashOf(this.inventory), world: this.world, tv: this.tv, phase: this.phase, lurk: this.lurkState, encounter: this.encounter, stats: this.stats, health: this.health, inventory: this.inventory, place: this.place, humanity: this.humanity };
  }
}

function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not allowed */
  }
}

/**
 * What's left in a lighter (fuel, percent) or a matchbook (matches). Ones
 * from before fuel was counted get a fair guess, fixed once used.
 */
function flameLeft(x: InvItem): number {
  if (x.doses == null) x.doses = /matches/i.test(x.name) ? 10 : 60;
  return x.doses;
}

/** Lower-case the first letter only ("the State ID", not "the state id"). */
function lc(s: string): string {
  return s.replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase());
}
/** With an article where it takes one: "a splint", "bandages", "gauze and tape". */
function withA(s: string): string {
  const n = lc(s);
  const first = n.split(',')[0].trim().split(' ').pop() ?? '';
  return /^gauze/.test(n) || (/s$/.test(first) && !/ss$/.test(first)) ? n : /^[aeiou]/.test(n) ? `an ${n}` : `a ${n}`;
}
/** Something turned up, said in a list: "a laptop", "car keys", "loose change", "a pack of cigarettes". */
function lootA(l: { kind: string; name: string }): string {
  // (No commas inside a name in a list: "rent money in an envelope".)
  const n = lc(l.name).replace(/, /g, ' ');
  // Money's money ("loose change", "bills in the junk drawer"), unless it's in something ("an envelope of cash").
  if (l.kind === 'cash' && !/^(envelope|wad|roll|jar|sock|tin|coffee can)\b/.test(n)) return n;
  // ("pack of cigarettes" goes by "pack"; "game console" by "console".)
  const w = n.split(' ');
  const head = / of /.test(n) ? w[0] : w[w.length - 1].replace(/[^a-z]/g, '');
  if (/^(cash|loose|change|folded)\b/.test(n) || /^(gauze)$/.test(n) || (/s$/.test(head) && !/ss$/.test(head))) return n;
  return /^[aeiou]/.test(n) ? `an ${n}` : `a ${n}`;
}
/** "the knife and the bottle". */
function list2(xs: string[]): string {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** What the test kit shows for what's in a syringe. */
const DRUG_TEST: Record<'heroin' | 'fentanyl' | 'meth' | 'tranq', { name: string; line: string }> = {
  heroin: { name: 'heroin', line: 'The liquid turns a deep purple: heroin.' },
  fentanyl: { name: 'fentanyl', line: 'The strip shows one line, not two. Fentanyl. A drop of this could kill you.' },
  meth: { name: 'meth', line: 'The liquid goes orange, then dark brown: methamphetamine.' },
  tranq: { name: 'tranq', line: "The liquid doesn’t change at all, but the little xylazine strip does. Tranq: an animal sedative." },
};

/** How well a pocket hides a weapon, in a word or two. */
const hideWord = (c: number) => (c >= 0.9 ? 'hides well' : c >= 0.7 ? 'hides some' : c >= 0.45 ? 'shows a bulge' : 'anything in it shows');

/** A knife or a box cutter (a bottle or a needle doesn't frighten like a blade). */
function isBlade(x: { kind: string; name: string }): boolean {
  return x.kind === 'weapon' && (/knife|box cutter/i.test(x.name) || !!knifeOf(x.name));
}

/** A court date: a weekday afternoon, at least a day off (real time). */
function courtDate(t = Date.now()): number {
  const d = new Date(t + 20 * 3_600_000);
  if (d.getHours() >= 16) d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  // (The whole of that day: you're only ever told the date, and the courthouse is open all hours.)
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Days inside: whatever you were on has long worn off, and the cigarette's out. */
function wearOff(h: Health) {
  h.cold = 0;
  h.wired = false;
  delete h.wiredBy;
  delete h.wiredUntil;
  delete h.high;
  delete h.highUntil;
  delete h.drunk;
  delete h.drunkAt;
  delete h.smokingUntil;
}

/**
 * In their hands and bleeding: they don't let you bleed out in a cell. The
 * ER first, cuffed to a gurney, and the wound closed.
 */
function custodyCare(h: Health): string[] {
  if (!h.bleeding && h.blood > h.maxBlood * 0.55) return [];
  const was = h.bleeding;
  h.bleeding = 0;
  h.blood = Math.max(h.blood, Math.round(h.maxBlood * 0.6));
  return [was ? 'They see the blood and take you to the ER first, cuffed to a gurney. A nurse closes the wound without a word to you.' : "You’re gray and shaking. They take you to the ER first, cuffed to a gurney, and someone hangs a bag of fluids."];
}

/** Your court date is today (the court sits weekdays, and the date is the afternoon it closes). */
function hearingToday(courtAt: number, t = Date.now()): boolean {
  return new Date(courtAt).toDateString() === new Date(t).toDateString();
}

/** A thing's name with its symbol, coloured by what it is (see lootIcon.ts). */
function named(x: Parameters<typeof lootMark>[0], name: string = x.name): string {
  return `<span class="loot-name" data-tone="${lootMark(x).tone}">${lootIcon(x)}${name}</span>`;
}
/** Something on a shelf, as the thing it would be in your pockets. */
function stockThing(s: { name: string; slot?: string; med?: string; knife?: string; gun?: string; ammo?: number }): Parameters<typeof lootMark>[0] {
  return { kind: s.ammo ? 'ammo' : s.gun || s.knife ? 'weapon' : s.med ? 'med' : 'misc', name: s.name, slot: s.slot, ...(s.gun || s.knife ? { weapon: 1 } : {}) };
}

/** This character's record: arrests and charges, and what came of them. */
interface CrimeRecord {
  arrests: number;
  charges: Record<string, number>;
  last?: number;
  /** Found guilty (a fine, probation, or time). */
  convictions?: number;
  /** Time served: how many sentences, how many days in all, the longest, and how many were state prison. */
  sentences?: number;
  daysServed?: number;
  longest?: number;
  prison?: number;
  /** When you were last let out. */
  lastOut?: number;
  /** Nights in a holding cell, and hours held in County waiting for court. */
  nights?: number;
  heldHours?: number;
  /** Fines paid, and what they came to. */
  fines?: number;
  finedCents?: number;
  probations?: number;
}
