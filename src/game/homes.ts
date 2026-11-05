import type { Build, Kind, Loot, Race, Sex } from './person';

/**
 * Who people are on paper (a name that fits them, an ID with everything an
 * ID has on it) and where they live: the address on the license, and what's
 * behind its front door.
 */

// ---------- Names ----------

/** First names, by sex and (loosely) by background; a fair few cross over. */
const FIRST: Record<Race, { Male: string[]; Female: string[] }> = {
  'American Indian or Alaska Native': { Male: ['Dakota', 'Tyler', 'Cody', 'Wyatt', 'Joseph', 'Chayton', 'Elijah', 'Travis'], Female: ['Winona', 'Tallulah', 'Shawna', 'Cheyenne', 'Dakota', 'Autumn', 'Leah', 'Marie'] },
  Asian: { Male: ['Wei', 'Kenji', 'Minh', 'Daniel', 'Hiro', 'Jun', 'Arjun', 'Kevin', 'Sanjay', 'Tuan'], Female: ['Mei', 'Priya', 'Yuna', 'Linh', 'Grace', 'Aiko', 'Ananya', 'Jasmine', 'Hana', 'Ji-woo'] },
  'Black or African American': { Male: ['Marcus', 'Tyrone', 'Darnell', 'Andre', 'Jamal', 'DeShawn', 'Malik', 'Terrence', 'Isaiah', 'Curtis'], Female: ['Keisha', 'Tamika', 'Imani', 'Aaliyah', 'Ebony', 'Latoya', 'Monique', 'Jasmine', 'Brianna', 'Denise'] },
  'Hispanic or Latino': { Male: ['Luis', 'Diego', 'Carlos', 'Miguel', 'José', 'Alejandro', 'Hector', 'Javier', 'Angel', 'Ruben'], Female: ['Maria', 'Ana', 'Gabriela', 'Lucia', 'Rosa', 'Valeria', 'Daniela', 'Carmen', 'Yesenia', 'Marisol'] },
  'Middle Eastern or North African': { Male: ['Omar', 'Karim', 'Youssef', 'Tariq', 'Sami', 'Hassan', 'Rami', 'Ali'], Female: ['Fatima', 'Aisha', 'Nadia', 'Leila', 'Yasmin', 'Rania', 'Mariam', 'Dina'] },
  'Native Hawaiian or Pacific Islander': { Male: ['Kai', 'Keoni', 'Makoa', 'Ikaika', 'Sione', 'Tevita', 'Koa', 'Manu'], Female: ['Leilani', 'Malia', 'Kalena', 'Noelani', 'Mele', 'Lani', 'Ana', 'Kiana'] },
  White: { Male: ['James', 'Ryan', 'Daniel', 'Joseph', 'Kyle', 'Brian', 'Travis', 'Matthew', 'Scott', 'Dale'], Female: ['Hannah', 'Grace', 'Emily', 'Megan', 'Sarah', 'Ashley', 'Kelly', 'Rachel', 'Brittany', 'Donna'] },
};
const LAST: Record<Race, string[]> = {
  'American Indian or Alaska Native': ['Begay', 'Yazzie', 'Tsosie', 'Benally', 'Redcloud', 'Locklear', 'Harjo', 'Whitehorse'],
  Asian: ['Chen', 'Nguyen', 'Kim', 'Patel', 'Tran', 'Wong', 'Park', 'Tanaka', 'Singh', 'Le'],
  'Black or African American': ['Johnson', 'Williams', 'Jackson', 'Brown', 'Okafor', 'Washington', 'Harris', 'Robinson', 'Davis', 'Moore'],
  'Hispanic or Latino': ['Lopez', 'Garcia', 'Rivera', 'Silva', 'Martinez', 'Hernandez', 'Torres', 'Ramirez', 'Flores', 'Morales'],
  'Middle Eastern or North African': ['Haddad', 'Mansour', 'Khalil', 'Nasser', 'Saleh', 'Aziz', 'Hamdan', 'Farah'],
  'Native Hawaiian or Pacific Islander': ['Kealoha', 'Kahale', 'Fifita', 'Tupou', 'Akana', 'Mahoe', 'Palakiko', 'Vaifale'],
  White: ['Smith', 'Miller', 'Murphy', 'Davis', 'Anderson', 'Kowalski', 'Novak', 'Walsh', 'Becker', 'Sullivan'],
};
/** For you: a name that could be anyone's. */
const ANYONE = ['Jordan', 'Alex', 'Casey', 'Riley', 'Taylor', 'Morgan', 'Jamie', 'Sam', 'Devon', 'Quinn', 'Avery', 'Robin'];

const any = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const RACES = Object.keys(LAST) as Race[];

/** A name that fits who they are (mostly: people's names don't always match their faces). */
export function nameFor(sex: Sex, race: Race): string {
  const r1 = Math.random() < 0.8 ? race : any(RACES);
  const r2 = Math.random() < 0.85 ? race : any(RACES);
  return `${any(FIRST[r1][sex])} ${any(LAST[r2])}`;
}
/** Your name, when you start as someone new. */
export const yourName = () => `${any(ANYONE)} ${any(LAST[any(RACES)])}`;

// ---------- The ID ----------

/** Everything printed on a license or a state ID. */
export interface IdCard {
  /** Date of birth, MM/DD/YYYY. */
  dob: string;
  sex: 'M' | 'F';
  /** 5'10" */
  ht: string;
  /** 180 lb */
  wt: string;
  eyes: string;
  hair: string;
  /** The address it was issued to. */
  addr: string;
  /** The license or ID number. */
  no: string;
  iss: string;
  exp: string;
  /** A driver's license (class C), not just a state ID. */
  dl: boolean;
  donor: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const mdY = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
const BASE_IN = { Male: 69.5, Female: 64 };
const BASE_LB = { Male: 180, Female: 150 };
const BUILD_LB: Record<Build, number> = { Skinny: 0.8, Average: 1, Stocky: 1.12, Athletic: 1.02, Heavyset: 1.35, Muscular: 1.18, Frail: 0.75 };

/** An ID that matches the person holding it (more or less: people round their weight down). */
export function idCard(o: { sex: Sex; race: Race; build: Build; age: number; addr: string; dl: boolean; expired?: boolean }): IdCard {
  const t = new Date();
  const born = new Date(t.getFullYear() - o.age, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28));
  if (born > new Date(t.getFullYear() - o.age, t.getMonth(), t.getDate())) born.setFullYear(born.getFullYear() - 1);
  // Renewed every eight years, on the birthday.
  const exp = new Date(t.getFullYear() + (o.expired ? -1 - Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 7)), born.getMonth(), born.getDate());
  // (Nobody's first card is from before they were sixteen.)
  const first = new Date(born.getFullYear() + 16, born.getMonth(), born.getDate() + Math.floor(Math.random() * 200));
  let iss = new Date(exp.getFullYear() - 8, exp.getMonth(), exp.getDate() - 20 - Math.floor(Math.random() * 300));
  if (iss < first) iss = first > t ? t : first;
  const inches = Math.round(BASE_IN[o.sex] + (Math.random() + Math.random() + Math.random() - 1.5) * 4);
  const lb = Math.round((BASE_LB[o.sex] * (BUILD_LB[o.build] ?? 1) * (inches / BASE_IN[o.sex]) * (0.92 + Math.random() * 0.12)) / 5) * 5;
  const light = o.race === 'White' ? Math.random() : 1;
  const eyes = light < 0.3 ? 'BLU' : light < 0.42 ? 'GRN' : light < 0.55 ? 'HAZ' : 'BRN';
  const grey = o.age > 50 && Math.random() < (o.age - 45) / 30;
  const hair = grey ? 'GRY' : o.race === 'White' ? any(['BRO', 'BRO', 'BLN', 'BLK', 'RED']) : o.race === 'Hispanic or Latino' || o.race === 'Middle Eastern or North African' ? any(['BLK', 'BRO']) : 'BLK';
  const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
  return {
    dob: mdY(born),
    sex: o.sex === 'Male' ? 'M' : 'F',
    ht: `${Math.floor(inches / 12)}'${pad(inches % 12)}"`,
    wt: `${lb} lb`,
    eyes,
    hair,
    addr: o.addr,
    no: o.dl ? `D${digits(3)}-${digits(4)}-${digits(4)}` : `S${digits(8)}`,
    iss: mdY(iss),
    exp: mdY(exp),
    dl: o.dl,
    donor: Math.random() < 0.45,
  };
}

/** What's on the card, as you'd read it. */
export function idText(name: string, c: IdCard): string {
  return [`${name}`, `DOB ${c.dob}`, `Sex ${c.sex}`, `Ht ${c.ht}`, `Wt ${c.wt}`, `Eyes ${c.eyes}`, `Hair ${c.hair}`, c.addr, `${c.dl ? 'DL' : 'ID'} ${c.no}${c.dl ? ' · Class C' : ''}`, `Iss ${c.iss}`, `Exp ${c.exp}`, ...(c.donor ? ['Organ donor'] : [])].join(' · ');
}

// ---------- Homes ----------

export type HomeType = 'house' | 'rowhouse' | 'apartment' | 'room';
export type RoomId = 'bedroom' | 'living' | 'kitchen' | 'bathroom' | 'closet';

export interface Home {
  id: string;
  /** "1427 Alder St, Apt 3B" */
  addr: string;
  type: HomeType;
  /** Which floor the door's on (1: the ground). */
  floor: number;
  /** Whose it is. */
  owner: string;
  sex: Sex;
  kind: Kind;
  /** Who else lives there. */
  household: 'alone' | 'partner' | 'family' | 'roommate';
  /** When they're out: at work in the day, at work at night, or mostly home. */
  works: 'days' | 'nights' | 'home';
  dog?: 'small' | 'big';
  /** An alarm system; a sign saying there is one (not always the same thing); a doorbell camera. */
  alarm: boolean;
  sign: boolean;
  cam: boolean;
  /** How much they have (0.3 next to nothing .. 1.6 comfortable). */
  wealth: number;
  /** A car out front. */
  car: string | null;
  /** For the odds that stay put for an hour or two (who's home). */
  seed: number;
  // ---- What's happened (kept on the address you know) ----
  /** The locks get changed from here on (their keys went missing). */
  lockAt?: number;
  /** When it was broken into, and how often. */
  hitAt?: number;
  hits?: number;
  /** What's left in each room you've been through, and when. */
  left?: Partial<Record<RoomId, Loot[]>>;
  looked?: Partial<Record<RoomId, number>>;
  /** You've heard the dog / seen the alarm panel. */
  dogKnown?: boolean;
  /** The owner's dead (nobody's coming home), from when. */
  deadAt?: number;
  /** Someone in there has seen your face at the door. */
  sawYou?: boolean;
  /** Since the break-in: a new deadbolt, a camera. */
  fixedAt?: number;
  /** When you last knocked, tried the doors, or woke someone (those stick for a while). */
  knockedAt?: number;
  triedAt?: number;
  wokeAt?: number;
  /** The police are there (after an alarm, a call, a body), until when. */
  scene?: { until: number; body?: boolean };
}

const STREETS = ['Alder St', 'Kestrel Ave', 'Larkin St', 'Halsey Ave', 'Pruitt St', 'Ninth St', 'Cobb Ave', 'Delmar St', 'Wexford Rd', 'Orchard Ln', 'Bellamy St', 'Fulton Ave', 'Sorrel Ct', 'Grand Ave', 'Ivy St', 'Tanner Rd'];
const CARS = ['Toyota', 'Honda', 'Ford', 'Chevy', 'Nissan', 'Hyundai', 'Dodge', 'Subaru', 'Kia'];

/** Where someone lives. The homeless have nowhere; the rest, something to go home to. */
export function makeHome(o: { name: string; sex: Sex; kind: Kind; age: number }): Home | null {
  const r = Math.random;
  if (o.kind === 'homeless') return null;
  const type: HomeType =
    o.kind === 'junkie' ? (r() < 0.6 ? 'room' : 'apartment') : o.kind === 'drunk' ? (r() < 0.55 ? 'apartment' : r() < 0.5 ? 'rowhouse' : 'house') : r() < 0.5 ? 'apartment' : r() < 0.35 ? 'rowhouse' : 'house';
  const floor = type === 'apartment' ? 1 + Math.floor(r() * 5) : type === 'room' ? 1 + Math.floor(r() * 3) : 1;
  const num = type === 'house' ? 100 + Math.floor(r() * 4900) : 10 + Math.floor(r() * 990);
  const unit = type === 'apartment' ? `, Apt ${floor}${'ABCDEF'[Math.floor(r() * 6)]}` : type === 'room' ? `, Rm ${floor}${pad(1 + Math.floor(r() * 18))}` : '';
  const wealth = o.kind === 'civilian' ? 0.6 + r() * 1 : o.kind === 'drunk' ? 0.4 + r() * 0.6 : 0.2 + r() * 0.3;
  const household = o.kind === 'junkie' ? (r() < 0.3 ? 'roommate' : 'alone') : (['alone', 'alone', 'partner', 'family', 'roommate'] as const)[Math.floor(r() * 5)];
  const works = o.kind === 'civilian' ? (o.age > 64 ? 'home' : r() < 0.78 ? 'days' : 'nights') : o.kind === 'drunk' ? (r() < 0.5 ? 'home' : 'days') : 'home';
  const big = type === 'house' || type === 'rowhouse';
  const alarm = big ? r() < 0.25 + (wealth - 0.6) * 0.3 : r() < 0.06;
  return {
    id: `h${Date.now().toString(36)}${Math.floor(r() * 1e6).toString(36)}`,
    addr: `${num} ${any(STREETS)}${unit}`,
    type,
    floor,
    owner: o.name,
    sex: o.sex,
    kind: o.kind,
    household,
    works,
    dog: r() < (big ? 0.38 : type === 'apartment' ? 0.15 : 0.05) ? (r() < (big ? 0.5 : 0.25) ? 'big' : 'small') : undefined,
    alarm,
    // (Some put the sign up and never pay for the alarm.)
    sign: alarm ? r() < 0.8 : big && r() < 0.12,
    cam: big ? r() < 0.3 + (wealth - 0.6) * 0.3 : false,
    wealth,
    car: big && o.kind !== 'junkie' && r() < 0.8 ? any(CARS) : null,
    seed: Math.floor(r() * 1e9),
  };
}

/** A number in 0..1 that stays the same for this home for a couple of hours. */
export function steady(h: Home, t: number, salt: number): number {
  let x = (h.seed ^ Math.floor(t / 7_200_000) * 2654435761 ^ salt * 40503) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489909) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export type Presence = 'out' | 'awake' | 'asleep';

/** One person's day: at work, up, or in bed. */
function day(works: Home['works'], t: number, r: number): Presence {
  const d = new Date(t);
  const h = d.getHours();
  const weekday = d.getDay() > 0 && d.getDay() < 6;
  if (works === 'days') {
    if (weekday && h >= 8 && h < 18) return r < 0.9 ? 'out' : 'awake';
    if (h >= 23 || h < 6) return r < 0.88 ? 'asleep' : r < 0.95 ? 'awake' : 'out';
    return r < 0.3 ? 'out' : 'awake';
  }
  if (works === 'nights') {
    if (h >= 21 || h < 7) return weekday || r < 0.6 ? 'out' : 'awake';
    if (h >= 8 && h < 15) return r < 0.85 ? 'asleep' : 'awake';
    return r < 0.25 ? 'out' : 'awake';
  }
  if (h >= 23 || h < 7) return r < 0.9 ? 'asleep' : 'awake';
  return r < 0.3 ? 'out' : 'awake';
}

/**
 * Who's in, right now: the owner (unless you've just left them somewhere,
 * or they're dead) and whoever lives with them. The worst of the two counts.
 */
export function whoIsIn(h: Home, t: number, ownerAway: boolean): { owner: Presence; other: Presence | null } {
  const owner: Presence = h.deadAt || ownerAway ? 'out' : day(h.works, t, steady(h, t, 1));
  // A partner or family keeps their own hours; a family usually means someone's home.
  let other: Presence | null = null;
  if (h.household !== 'alone') {
    const r = steady(h, t, 2);
    const works = h.household === 'family' ? (r < 0.45 ? 'home' : 'days') : r < 0.5 ? h.works : 'days';
    other = day(works, t, steady(h, t, 3));
    // (After a death in the house, the others are often away for a while.)
    if (h.deadAt && t - h.deadAt < 3 * 86_400_000 && steady(h, t, 4) < 0.6) other = 'out';
  }
  return { owner, other };
}
export const anyoneIn = (w: { owner: Presence; other: Presence | null }): Presence =>
  w.owner === 'awake' || w.other === 'awake' ? 'awake' : w.owner === 'asleep' || w.other === 'asleep' ? 'asleep' : 'out';

/** The rooms you can go through. */
export function roomsOf(h: Home): RoomId[] {
  return h.type === 'room' ? ['bedroom', 'closet'] : ['bedroom', 'living', 'kitchen', 'bathroom'];
}
/** What a room's called (a rooming house is one room). */
export const roomName = (h: Home, r: RoomId) => (h.type === 'room' && r === 'bedroom' ? 'The room' : ROOM_NAME[r]);
/** Going through it. */
export const ROOM_SEARCH: Record<RoomId, string> = {
  bedroom: 'You go through the dresser and the nightstand, drawer by drawer, and lift the mattress.',
  living: 'You go through the living room: the couch, the shelves, the TV stand.',
  kitchen: 'You go through the kitchen, drawer by drawer, cupboard by cupboard.',
  bathroom: 'You open the medicine cabinet, and the cupboard under the sink.',
  closet: 'You go through the coat on the hook, the box on the shelf, the shoes.',
};
export const ROOM_NAME: Record<RoomId, string> = {
  bedroom: 'The bedroom',
  living: 'The living room',
  kitchen: 'The kitchen',
  bathroom: 'The bathroom',
  closet: 'The closet and the shelf',
};
export const ROOM_DESC: Record<RoomId, string> = {
  bedroom: 'The dresser, the nightstand, under the mattress: where people keep cash and jewelry.',
  living: 'A laptop, a tablet, a games console. The TV’s too big to carry.',
  kitchen: 'The junk drawer, the jar on top of the fridge, keys on a hook by the door.',
  bathroom: 'The medicine cabinet.',
  closet: 'A coat on a hook, a box on the shelf, shoes.',
};

const JEWELRY = ['Gold chain', 'Wedding ring', 'Watch', 'Earrings', 'Class ring', 'Bracelet'];

/**
 * What's in a room, the first time you go through it. What could be traced
 * (electronics, jewelry, a car's keys) is stolen goods (hot); cash and a
 * packet of painkillers aren't anybody's in particular.
 */
export function roomLoot(h: Home, room: RoomId, carHere: boolean): Loot[] {
  const r = Math.random;
  const w = h.wealth * (h.hits ? 0.35 : 1);
  const out: Loot[] = [];
  const add = (l: Omit<Loot, 'where' | 'hot'>, where: string) => out.push({ ...l, where, ...(l.kind === 'phone' || l.kind === 'car keys' || /^(laptop|tablet|games console|gold chain|wedding ring|watch|earrings|class ring|bracelet)$/i.test(l.name) ? { hot: true } : {}) });
  const bills = (a: number, b: number) => Math.max(1, Math.round((a + r() * (b - a)) * w));
  if (room === 'bedroom') {
    if (r() < 0.55) add({ kind: 'cash', name: any(['Cash in a sock', 'Cash under the mattress', 'Envelope of cash']), cash: bills(20, 380) }, any(['dresser', 'under the mattress', 'nightstand']));
    const n = r() < 0.65 * w ? 1 + Math.floor(r() * (w > 1 ? 3 : 2)) : 0;
    for (const j of [...JEWELRY].sort(() => r() - 0.5).slice(0, n)) add({ kind: 'misc', name: j, detail: jewelDetail(j) }, 'jewelry box');
    if (r() < 0.25) add({ kind: 'misc', name: 'Painkillers', med: 'painkillers' }, 'nightstand');
    if (r() < 0.2) add({ kind: 'phone', name: 'Old phone', detail: 'An older phone in a drawer, the battery dead' }, 'nightstand drawer');
  } else if (room === 'living') {
    if (r() < 0.5 * Math.min(1.2, w)) add({ kind: 'misc', name: 'Laptop', detail: 'On the couch, a sticker on the lid' }, 'couch');
    if (r() < 0.35 * w) add({ kind: 'misc', name: 'Tablet', detail: h.household === 'family' ? 'In a cover, a kid’s game on the screen' : 'In a cover, a crack across one corner' }, 'coffee table');
    if (r() < 0.4 * w) add({ kind: 'misc', name: 'Games console', detail: 'Under the TV, controllers and all' }, 'TV stand');
    if (r() < 0.3) add({ kind: 'cash', name: 'Loose change', cash: Math.round((1 + r() * 7) * 4) / 4 }, 'a bowl by the door');
  } else if (room === 'kitchen') {
    if (r() < 0.4) add({ kind: 'cash', name: any(['Cash in a coffee can', 'Rent money, in an envelope', 'Bills in the junk drawer']), cash: bills(15, 240) }, any(['top of the fridge', 'junk drawer', 'cupboard']));
    // The spare, on the hook: and the car out front, if it's there.
    if (h.car && carHere && r() < 0.7) add({ kind: 'car keys', name: 'Car keys', detail: `${h.car} key fob`, car: 'found', takenAt: Date.now(), carOf: h.id }, 'hook by the door');
    if (r() < 0.8) add(r() < 0.6 ? { kind: 'weapon', name: 'Kitchen knife', weapon: 8, cuts: true } : { kind: 'weapon', name: 'Steak knife', weapon: 5, cuts: true }, 'knife block');
    if (r() < 0.4) add({ kind: 'misc', name: 'Beer', drink: 'beer', doses: 1 }, 'fridge');
  } else if (room === 'bathroom') {
    if (r() < 0.6) add({ kind: 'misc', name: 'Painkillers', med: 'painkillers' }, 'medicine cabinet');
    if (r() < 0.45) add({ kind: 'misc', name: 'Bandages', med: 'bandages' }, 'under the sink');
    if (r() < 0.15) add({ kind: 'misc', name: 'Gauze', med: 'gauze' }, 'under the sink');
  } else {
    if (r() < 0.45) add({ kind: 'cash', name: 'Cash in a shoebox', cash: bills(10, 120) }, 'shelf');
    if (r() < 0.3) add({ kind: 'misc', name: any(['Watch', 'Gold chain']), detail: 'In a sock at the back of the shelf' }, 'shelf');
    if (r() < 0.4) add({ kind: 'misc', name: 'Pack of cigarettes', doses: 4 + Math.floor(r() * 14) }, 'coat pocket');
    if (r() < 0.25) add({ kind: 'misc', name: 'Small baggie', detail: 'Some kind of white powder', secret: 'cocaine', doses: 1 + Math.floor(r() * 3) }, 'coat pocket');
  }
  return out;
}
function jewelDetail(j: string): string {
  return (
    {
      'Gold chain': 'Heavy for its size. Real, by the clasp',
      'Wedding ring': 'A plain gold band, worn thin on one side',
      Watch: 'A steel watch with a scratched face',
      Earrings: 'A pair of small diamond studs, in a little box',
      'Class ring': 'Gold, with a red stone and a year on it',
      Bracelet: 'A thin gold bracelet',
    } as Record<string, string>
  )[j];
}
