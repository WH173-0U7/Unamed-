/**
 * Going through the bins, one dig at a time. What turns up depends on the
 * block: office trash downtown, clothes and kitchen knives in the Flats,
 * old people's things in Old Town, tools and scrap in Southside, empties out
 * back of a bar. Mostly cans and nothing; now and then something useful; very
 * rarely something worth a little at the pawn shop (never much: $20 to $60).
 * The Scavenging skill finds more, and spots spoiled food, broken glass and
 * trouble before it happens.
 */
import type { District } from './map';
import type { Loot } from './person';

/** Where the bins are: a part of town, or out back of a bar. */
export type BinArea = District | 'bar';
export type Tier = 'common' | 'uncommon' | 'rare';

/** Something in the trash: the item, how it's found (a line), and how often (a weight within its tier). */
export interface BinFind {
  /** The item, or a handful of cans, or a little cash. */
  item?: Omit<Loot, 'where'>;
  cans?: [number, number];
  /** Cents: loose change, or what's left in a wallet. */
  cash?: [number, number];
  /** What you find it in. */
  line: string;
  w: number;
}

const FOODS: BinFind[] = [
  { item: { kind: 'misc', name: 'Half a sandwich', detail: 'Still in its wrapper', food: 'trash' }, line: 'Half a sandwich, still in its wrapper.', w: 3 },
  { item: { kind: 'misc', name: 'Cold fries', detail: 'A paper bag of them', food: 'trash' }, line: 'A paper bag of cold fries, barely touched.', w: 2 },
  { item: { kind: 'misc', name: 'Bruised apples', detail: 'Three of them, soft in places', food: 'trash' }, line: 'Three bruised apples, soft in places.', w: 2 },
  { item: { kind: 'misc', name: 'Takeout leftovers', detail: 'A foam box, half full', food: 'trash' }, line: 'A foam takeout box, half full.', w: 2 },
];
const CANS: BinFind = { cans: [1, 4], line: 'cans', w: 6 };
const CHANGE: BinFind = { cash: [5, 60], line: 'Loose change at the bottom of a bag.', w: 1.5 };
const SMOKES: BinFind = { item: { kind: 'misc', name: 'Loose cigarettes', doses: 2 }, line: 'A crushed pack with a couple of cigarettes left in it.', w: 1.5 };
const LIGHTER: BinFind = { item: { kind: 'misc', name: 'Lighter', detail: 'Someone threw it out half full', doses: 40 }, line: 'A lighter, still half full.', w: 3 };
const GLOVES: BinFind = { item: { kind: 'wear', name: 'Gloves', slot: 'hands', detail: 'Thin work gloves, a hole in one thumb' }, line: 'A pair of work gloves, a hole in one thumb.', w: 2 };
const BEANIE: BinFind = { item: { kind: 'wear', name: 'Beanie', slot: 'head', detail: 'A little stretched' }, line: 'A beanie, a little stretched.', w: 2 };
const TWENTY: BinFind = { cash: [1000, 2000], line: 'A folded bill in the pocket of a thrown-out coat.', w: 1 };

/** Every block's bins, by part of town. */
export const BIN_LOOT: Record<BinArea, Record<Tier, BinFind[]>> = {
  downtown: {
    common: [CANS, ...FOODS, { item: { kind: 'misc', name: 'Day-old bagels', detail: 'A bakery bag of them', food: 'trash' }, line: 'A bakery bag of day-old bagels, tossed at closing.', w: 3 }, CHANGE, SMOKES],
    uncommon: [
      { item: { kind: 'misc', name: 'Phone charger', detail: 'The cable’s fine' }, line: 'A phone charger, the cable still fine.', w: 3 },
      { item: { kind: 'misc', name: 'Umbrella', detail: 'One spoke bent' }, line: 'An umbrella with one bent spoke.', w: 3 },
      { item: { kind: 'misc', name: 'Headphones', detail: 'One side crackles' }, line: 'A pair of headphones. One side crackles, but they work.', w: 2 },
      { item: { kind: 'wear', name: 'Sunglasses', slot: 'eyes', detail: 'Scratched' }, line: 'Sunglasses, a little scratched.', w: 2 },
      GLOVES,
      LIGHTER,
    ],
    rare: [
      { item: { kind: 'misc', name: 'Watch', detail: 'The strap’s broken; it still runs' }, line: 'A watch with a broken strap. It still runs.', w: 2 },
      { item: { kind: 'misc', name: 'Gift card', detail: 'A little still left on it' }, line: 'A gift card in a crumpled envelope, a little still left on it.', w: 2 },
      TWENTY,
    ],
  },
  flats: {
    common: [CANS, ...FOODS, CHANGE, SMOKES],
    uncommon: [
      { item: { kind: 'wear', name: 'Hoodie', slot: 'top', detail: 'Faded, but clean enough' }, line: 'A faded hoodie, clean enough.', w: 3 },
      { item: { kind: 'wear', name: 'Windbreaker', slot: 'top', detail: 'A broken zip' }, line: 'A windbreaker with a broken zip.', w: 2 },
      GLOVES,
      BEANIE,
      LIGHTER,
      { item: { kind: 'weapon', name: 'Kitchen knife', weapon: 8, cuts: true }, line: 'A kitchen knife, wrapped in newspaper.', w: 1.5 },
      { item: { kind: 'weapon', name: 'Steak knife', weapon: 5, cuts: true }, line: 'A steak knife, loose in a bag of scraps.', w: 1.5 },
      { item: { kind: 'misc', name: 'Blanket', detail: 'Thin, but warm enough' }, line: 'A thin blanket, folded and thrown out.', w: 2 },
      { item: { kind: 'misc', name: 'Old phone', detail: 'Cracked screen, it still turns on' }, line: 'An old phone with a cracked screen. It still turns on.', w: 0.5 },
    ],
    rare: [
      { item: { kind: 'misc', name: 'Sleeping bag', detail: 'Rolled up, the zip still works' }, line: 'A rolled-up sleeping bag. The zip still works.', w: 2 },
      TWENTY,
    ],
  },
  oldtown: {
    common: [CANS, ...FOODS, CHANGE, SMOKES, { item: { kind: 'misc', name: 'Bottle of wine', drink: 'liquor', doses: 1 }, line: 'A bottle of wine with a swig left in it.', w: 1.5 }],
    uncommon: [
      { item: { kind: 'wear', name: 'Coat', slot: 'top', detail: 'Old wool, a button missing' }, line: 'An old wool coat, a button missing.', w: 2 },
      { item: { kind: 'wear', name: 'Rain jacket', slot: 'top', detail: 'A tear at the elbow' }, line: 'A rain jacket with a tear at the elbow.', w: 2 },
      { item: { kind: 'misc', name: 'Paperback books', detail: 'A stack of them, damp at the edges' }, line: 'A stack of paperback books, damp at the edges.', w: 2 },
      { item: { kind: 'wear', name: 'Neck gaiter', slot: 'face', detail: 'Fleece, faded' }, line: 'A faded fleece neck gaiter.', w: 1.5 },
      BEANIE,
      LIGHTER,
    ],
    rare: [
      { item: { kind: 'misc', name: 'Earrings', detail: 'A pair, in a little box' }, line: 'A little box with a pair of earrings in it. Someone’s going to miss these.', w: 1 },
      { item: { kind: 'misc', name: 'Class ring', detail: 'Initials worn smooth' }, line: 'A class ring at the bottom of a bag, the initials worn smooth.', w: 1 },
      { item: { kind: 'misc', name: 'Bracelet', detail: 'A thin chain one' }, line: 'A thin bracelet, tangled in a necklace of paper clips.', w: 1 },
      { cash: [500, 2000], line: 'A wallet, thrown out empty except for the cash behind the lining.', w: 2 },
    ],
  },
  southside: {
    common: [CANS, FOODS[0], FOODS[3], CHANGE, SMOKES],
    uncommon: [
      { item: { kind: 'misc', name: 'Copper wire', detail: 'A coil of it, stripped' }, line: 'A coil of stripped copper wire.', w: 3 },
      { item: { kind: 'misc', name: 'Claw hammer', detail: 'The handle’s taped' }, line: 'A claw hammer, the handle wrapped in tape.', w: 2 },
      { item: { kind: 'misc', name: 'Crowbar', detail: 'Rusty' }, line: 'A rusty crowbar under a pile of pallets.', w: 1.5 },
      { item: { kind: 'weapon', name: 'Box cutter', weapon: 5, cuts: true }, line: 'A box cutter, a blade still in it.', w: 2 },
      { item: { kind: 'misc', name: 'Bike lock', detail: 'A U-lock, with its key' }, line: 'A U-lock, its key still in it.', w: 1.5 },
      { item: { kind: 'misc', name: 'Flashlight', detail: 'Works if you hit it' }, line: 'A flashlight. It works if you hit it.', w: 2 },
      GLOVES,
    ],
    rare: [
      { item: { kind: 'misc', name: 'Cordless drill', detail: 'No charger, the battery’s dead' }, line: 'A cordless drill with a dead battery, thrown out with a broken pallet.', w: 2 },
      { item: { kind: 'misc', name: 'Duffel bag', detail: 'Canvas, one handle torn' }, line: 'A canvas duffel bag, one handle torn.', w: 2 },
      TWENTY,
    ],
  },
  bar: {
    common: [{ ...CANS, cans: [2, 6], w: 8 }, SMOKES, { item: { kind: 'misc', name: 'Pint of whiskey', drink: 'liquor', doses: 1 }, line: 'A pint of whiskey with a swig left in it.', w: 1.5 }, FOODS[1], CHANGE],
    uncommon: [LIGHTER, BEANIE, { item: { kind: 'wear', name: 'Neck gaiter', slot: 'face', detail: 'Left behind on a stool' }, line: 'A neck gaiter someone left behind.', w: 1.5 }, { item: { kind: 'misc', name: 'Umbrella', detail: 'Left in the stand' }, line: 'An umbrella from the lost-and-found box out back.', w: 2 }],
    rare: [
      { item: { kind: 'phone', name: 'Phone', detail: 'Dropped in the bar, locked', locked: true }, line: 'A phone in a bag of empties. Somebody’s had a long night. It’s locked.', w: 2 },
      TWENTY,
    ],
  },
};

/** Your Scavenging level's odds: a rare find (1 in 150 at level 1, about 1 in 60 at 100), and an uncommon one (1 in 15, up to about 1 in 9). */
export const rareOdds = (lvl: number) => 1 / 150 + ((1 / 60 - 1 / 150) * (Math.min(100, lvl) - 1)) / 99;
export const uncommonOdds = (lvl: number) => (1 / 15) * (1 + (Math.min(100, lvl) - 1) * 0.006);
/** A second find in the same dig. */
export const extraOdds = (lvl: number) => 0.06 + (Math.min(100, lvl) - 1) * 0.0015;
/** Food from the trash that's gone off (you can tell, more often, the better you are at this). */
export const spoilOdds = (lvl: number) => Math.max(0.05, 0.4 - (Math.min(100, lvl) - 1) * 0.0035);
/** Broken glass: a cut (gloves help a lot). */
export const cutOdds = (lvl: number, gloves: boolean) => Math.max(0.004, 0.045 * (gloves ? 0.3 : 1) * (1 - (Math.min(100, lvl) - 1) * 0.007));
/** Somebody yells at you to get out of their trash (more downtown, less among the warehouses). */
export const shooOdds = (lvl: number, area: BinArea) => Math.max(0.008, (area === 'downtown' ? 0.07 : area === 'southside' ? 0.03 : 0.05) * (1 - (Math.min(100, lvl) - 1) * 0.008));
/** The bins on a block: how full they get, and how fast they fill back up (an hour). */
export const BIN_MAX = 12;
export const BIN_REFILL = 2.5;
/** Someone throws a bag out while you're there. */
export const TOSS_ODDS = 0.12;

const pickW = (xs: BinFind[], r: () => number) => {
  const tot = xs.reduce((n, x) => n + x.w, 0);
  let v = r() * tot;
  for (const x of xs) if ((v -= x.w) < 0) return x;
  return xs[xs.length - 1];
};

/** One dig's luck: how full the bins are (0..BIN_MAX), your level, a bag just thrown out, and whether a rare find is still to be had today on this block. */
export function rollDig(area: BinArea, left: number, lvl: number, tossed: boolean, rareOk: boolean, r: () => number = Math.random): { tier: Tier; find: BinFind }[] {
  const full = Math.max(0, Math.min(1, left / BIN_MAX));
  const odds = Math.min(0.95, 0.2 + 0.6 * full + (tossed ? 0.3 : 0));
  if (r() >= odds) return [];
  const out: { tier: Tier; find: BinFind }[] = [];
  const once = (): void => {
    const boost = tossed ? 2 : 1;
    const t = r();
    let tier: Tier = t < rareOdds(lvl) * boost ? 'rare' : t < (rareOdds(lvl) + uncommonOdds(lvl)) * boost ? 'uncommon' : 'common';
    // (One rare find a block a day, at most: a second one's just something useful.)
    if (tier === 'rare' && (!rareOk || out.some((x) => x.tier === 'rare'))) tier = 'uncommon';
    out.push({ tier, find: pickW(BIN_LOOT[area][tier], r) });
  };
  once();
  if (r() < extraOdds(lvl) * (0.5 + full)) once();
  return out;
}

/** How the bins look now, by how much is left in them. */
export function binsLook(left: number): string {
  if (left >= 9) return 'Plenty of bags yet, most of them not opened.';
  if (left >= 5) return 'Somebody’s been through some of these already.';
  if (left >= 1) return 'Mostly wet cardboard now.';
  return 'Picked clean. Give it a few hours.';
}
