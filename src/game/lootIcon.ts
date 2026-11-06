/**
 * A symbol and a colour for each kind of thing you can take, so a list of
 * loot reads at a glance: green for money, gold for what's worth selling,
 * blue for cards and ID, amber for keys, red for weapons, violet for drugs
 * and medicine, grey for the rest.
 *
 * The symbols are the game's own: thin line drawings on a 24-unit grid,
 * drawn in the colour of what they are (and given the same red/cyan fringe
 * as everything else on the screen, in CSS).
 */
export type LootTone = 'cash' | 'value' | 'card' | 'keys' | 'weapon' | 'drug' | 'wear' | 'junk';

export type LootGlyph =
  | 'cash'
  | 'coins'
  | 'gem'
  | 'phone'
  | 'laptop'
  | 'console'
  | 'watch'
  | 'ring'
  | 'wrench'
  | 'card'
  | 'id'
  | 'key'
  | 'knife'
  | 'spray'
  | 'gun'
  | 'pill'
  | 'baggie'
  | 'syringe'
  | 'bandage'
  | 'paper'
  | 'cigarette'
  | 'flame'
  | 'bottle'
  | 'bag'
  | 'plug'
  | 'ammo'
  | 'shirt'
  | 'pants'
  | 'backpack'
  | 'cap'
  | 'mask'
  | 'glasses'
  | 'sheath'
  | 'cup'
  | 'box';

export interface LootMark {
  icon: LootGlyph;
  tone: LootTone;
}

/**
 * The drawings, on a 24 × 24 grid: `line` is stroked, `tint` (if any) is a
 * faint fill under it, in the same colour, for the part your eye should
 * land on (the screen of a phone, the powder in a bag, the blade).
 */
const GLYPHS: Record<LootGlyph, { line: string; tint?: string }> = {
  // A bill: its border, the portrait oval, the corner numbers.
  cash: {
    line: 'M3 6.5h18a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5z M12 9.3a2.7 2.7 0 1 0 0 5.4a2.7 2.7 0 1 0 0-5.4 M5.5 9.5h1 M17.5 14.5h1',
    tint: 'M12 9.3a2.7 2.7 0 1 0 0 5.4a2.7 2.7 0 1 0 0-5.4',
  },
  // A short stack of coins, seen edge on.
  coins: {
    line: 'M5 8c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5-3.1 2.5-7 2.5S5 9.4 5 8z M5 8v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V8 M5 12v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4 M9 13.8v1 M12 14.4v1 M15 13.8v1',
    tint: 'M5 8c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5-3.1 2.5-7 2.5S5 9.4 5 8z',
  },
  gem: {
    line: 'M7 4h10l4 5-9 11L3 9z M3 9h18 M9.5 4L8 9l4 11 4-11-1.5-5',
    tint: 'M3 9h18l-9 11z',
  },
  // A phone: the screen lit, the speaker slot.
  phone: {
    line: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5z M6.5 5.5h11 M6.5 17.5h11 M11 4h2 M11 19.5h2',
    tint: 'M6.5 5.5h11v12h-11z',
  },
  laptop: {
    line: 'M5.5 5h13a1 1 0 0 1 1 1v9h-15V6a1 1 0 0 1 1-1z M2.5 17.5h19l-1 2.5H3.5z M10.5 17.5l.5 1h2l.5-1',
    tint: 'M6.5 6.5h11v7h-11z',
  },
  console: {
    line: 'M7.5 8.5h9a4.5 4.5 0 0 1 4.4 5.4l-.6 3a2 2 0 0 1-3.5.9L15 15.5H9l-1.8 2.3a2 2 0 0 1-3.5-.9l-.6-3a4.5 4.5 0 0 1 4.4-5.4z M8 10.5v4 M6 12.5h4 M15.5 11.5h.01 M17.5 13.5h.01 M11 5.5h2',
    tint: 'M7.5 8.5h9a4.5 4.5 0 0 1 4.4 5.4l-.6 3a2 2 0 0 1-3.5.9L15 15.5H9l-1.8 2.3a2 2 0 0 1-3.5-.9l-.6-3a4.5 4.5 0 0 1 4.4-5.4z',
  },
  // A wristwatch: the face, the hands, the strap.
  watch: {
    line: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10 M9 7.8L10 3h4l1 4.8 M9 16.2l1 4.8h4l1-4.8 M12 9.5V12l1.8 1.3 M17 11v2',
    tint: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10',
  },
  ring: {
    line: 'M12 9.5a5.75 5.75 0 1 0 0 11.5a5.75 5.75 0 1 0 0-11.5 M12 11.5a3.75 3.75 0 1 0 0 7.5a3.75 3.75 0 1 0 0-7.5 M9.5 5.5L12 2.5l2.5 3-2.5 4z',
    tint: 'M9.5 5.5L12 2.5l2.5 3-2.5 4z',
  },
  wrench: {
    line: 'M15 3.5a4.5 4.5 0 0 0-4.3 5.9L3.6 16.5a2 2 0 0 0 2.9 2.9l7.1-7.1A4.5 4.5 0 0 0 19.9 7.5l-2.8 2.8-2.5-.6-.6-2.5 2.8-2.8A4.5 4.5 0 0 0 15 3.5z M5 18h.01',
    tint: 'M15 3.5a4.5 4.5 0 0 0-4.3 5.9L3.6 16.5a2 2 0 0 0 2.9 2.9l7.1-7.1A4.5 4.5 0 0 0 19.9 7.5l-2.8 2.8-2.5-.6-.6-2.5 2.8-2.8A4.5 4.5 0 0 0 15 3.5z',
  },
  // A bank card: the magnetic stripe, the chip, the number.
  card: {
    line: 'M4.5 5.5h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z M2.5 9h19 M5.5 12.5h3v2.5h-3z M11 15.5h2.5 M15 15.5h3',
    tint: 'M2.5 9h19v2h-19z',
  },
  // An ID: the photo, the name, the number.
  id: {
    line: 'M4.5 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8.5 8.8a1.9 1.9 0 1 0 0 3.8a1.9 1.9 0 1 0 0-3.8 M5.5 16.5a3 3 0 0 1 6 0 M14 10h4.5 M14 13h4.5 M14 16h2.5',
    tint: 'M5 7.5h7v9.5H5z',
  },
  // A key: the bow with its hole, the shaft, the teeth.
  key: {
    line: 'M7.5 12a3.75 3.75 0 1 0 0 7.5a3.75 3.75 0 1 0 0-7.5 M7.5 14.75a1 1 0 1 0 0 2a1 1 0 1 0 0-2 M10.2 13.1L19.5 3.8 M16.6 6.7l2.6 2.6 M14.2 9.1l1.9 1.9',
    tint: 'M7.5 12a3.75 3.75 0 1 0 0 7.5a3.75 3.75 0 1 0 0-7.5',
  },
  // A blade with a straight spine and a curved edge, the guard, the handle.
  knife: {
    line: 'M8.5 15.5L20.5 3.5c.4 4.2-3.2 9.4-9 12.8z M6.5 13.5l4 4 M3.5 20.5l4.5-4.5',
    tint: 'M8.5 15.5L20.5 3.5c.4 4.2-3.2 9.4-9 12.8z',
  },
  // A can: the nozzle, the cap, the spray.
  spray: {
    line: 'M8.5 9h7v11.5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z M10 9V6.5h4V9 M11 6.5V4h2.5 M17 3.5h.01 M19 2.5h.01 M19 4.5h.01 M21 3.5h.01 M8.5 12.5h7 M8.5 18h7',
    tint: 'M8.5 12.5h7V18h-7z',
  },
  gun: {
    line: 'M2.5 7.5h18v4.5h-8l-1.2 3h-2.6l.6-3H7.5l-1.8 6.5H2.8L4.5 12H2.5z M20.5 9.5h1 M8.5 12l.5 2',
    tint: 'M2.5 7.5h18v4.5h-18z',
  },
  // A capsule, one half filled in.
  pill: {
    line: 'M6 18a3.5 3.5 0 0 1 0-5L13 6a3.5 3.5 0 0 1 5 5l-7 7a3.5 3.5 0 0 1-5 0z M9.5 9.5l5 5',
    tint: 'M6 18a3.5 3.5 0 0 1 0-5l3.5-3.5 5 5L11 18a3.5 3.5 0 0 1-5 0z',
  },
  // A small zip bag, powder at the bottom.
  baggie: {
    line: 'M6 7h12v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z M6 9.5h12 M7.5 4.5h9L18 7H6z M6 14.5c2-1 4 1 6 0s4-1 6 0',
    tint: 'M6 14.5c2-1 4 1 6 0s4-1 6 0v5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z',
  },
  // A syringe: the plunger, the barrel, the needle.
  syringe: {
    line: 'M17.5 2.5l4 4 M19.5 4.5l-3 3 M16.5 7.5l-9 9-2-2 9-9z M6.5 15.5l-3 5 5-3 M11 10l1.5 1.5 M9 12l1.5 1.5',
    tint: 'M14.5 5.5l2 2-5 5-2-2z',
  },
  // A first-aid cross.
  bandage: {
    line: 'M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z',
    tint: 'M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z',
  },
  // A receipt, torn off at the bottom.
  paper: {
    line: 'M6 2.5h12v19l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z M9 7h6 M9 10.5h6 M9 14h3.5 M14 14h1',
  },
  // A cigarette: the filter, the paper, the ember, the smoke.
  cigarette: {
    line: 'M2.5 12.5h18v4.5h-18z M7 12.5v4.5 M18 12.5v4.5 M19.5 9.5c0-1.6 1.6-1.7 1.6-3.3S19.5 4.6 19.5 3 M16.5 9.5c0-1 1-1.1 1-2.1',
    tint: 'M2.5 12.5H7V17H2.5z M18 12.5h2.5V17H18z',
  },
  // A flame, with its hot core.
  flame: {
    line: 'M12 21.5c-3.6 0-6-2.6-6-5.8 0-3.9 3.6-5.6 3.8-10.2 2.8 1.8 4 3.8 4.2 6 .9-.7 1.4-1.8 1.5-3 1.8 1.8 2.5 4.4 2.5 7.2 0 3.2-2.4 5.8-6 5.8z',
    tint: 'M12 19.5c-1.6 0-2.7-1.1-2.7-2.5 0-1.7 1.5-2.5 1.9-4.4 1.4 1 2.3 2.2 2.5 3.5.4-.3.7-.8.8-1.4.8 1 1.2 2 1.2 2.9 0 1.2-1.3 1.9-3.7 1.9z',
  },
  // A bottle: the neck, the label, what's left in it.
  bottle: {
    line: 'M10 2.5h4v4l2 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-11l2-3z M10 4.5h4 M8 12h8 M8 16.5h8',
    tint: 'M8 16.5h8v4a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z',
  },
  // A paper bag, the top folded over.
  bag: {
    line: 'M5 8.5h14l-1.2 12.5H6.2z M9 8.5V6.5a3 3 0 0 1 6 0v2 M5.3 11.5h13.4',
  },
  plug: {
    line: 'M9 2.5v4.5 M15 2.5v4.5 M7 7h10v3a5 5 0 0 1-10 0z M12 15v6.5',
    tint: 'M7 7h10v3a5 5 0 0 1-10 0z',
  },
  // Three rounds, standing.
  ammo: {
    line: 'M5.5 20.5V11l1.75-4.5L9 11v9.5z M10.25 20.5V11L12 6.5l1.75 4.5v9.5z M15 20.5V11l1.75-4.5L18.5 11v9.5z M5.5 17h3.5 M10.25 17h3.5 M15 17h3.5',
    tint: 'M5.5 17h3.5v3.5H5.5z M10.25 17h3.5v3.5h-3.5z M15 17h3.5v3.5H15z',
  },
  // Clothes: a jacket, open at the collar.
  shirt: {
    line: 'M8.5 3.5L4 6l-1.5 5 2.5 1V20.5h14V12l2.5-1L20 6l-4.5-2.5C15 5.5 13.6 6.5 12 6.5S9 5.5 8.5 3.5z M12 6.5v14 M9 11.5h1.5',
    tint: 'M8.5 3.5C9 5.5 10.4 6.5 12 6.5s3-1 3.5-3l-3.5 1z',
  },
  pants: {
    line: 'M6 3.5h12l1 17h-4.5L12 10l-2.5 10.5H5z M6 6.5h12 M9 6.5v2',
    tint: 'M6 3.5h12v3H6z',
  },
  backpack: {
    line: 'M8 6V5a4 4 0 0 1 8 0v1 M6.5 6h11a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-12A1.5 1.5 0 0 1 6.5 6z M8 13.5h8v4.5H8z M10 13.5v-1.5h4v1.5',
    tint: 'M8 13.5h8v4.5H8z',
  },
  // A cap: the crown and the peak.
  cap: {
    line: 'M4 15.5a8 8 0 0 1 16 0z M12 7.5V6.5 M4 15.5c-.5 1.5.5 2 2 2h12.5c1.5 0 3-.5 3.5-2z M12 7.5v8',
    tint: 'M4 15.5a8 8 0 0 1 16 0z',
  },
  // Something over your face: the eyes, the mouth.
  mask: {
    line: 'M12 3c-4 0-7 3-7 8.5S8 21 12 21s7-4 7-9.5S16 3 12 3z M8.5 9.5h2.5 M13 9.5h2.5 M10 15.5h4',
    tint: 'M12 3c-4 0-7 3-7 8.5S8 21 12 21s7-4 7-9.5S16 3 12 3z',
  },
  glasses: {
    line: 'M2.5 10.5h8.5v2.5a3 3 0 0 1-3 3h-2.5a3 3 0 0 1-3-3z M13 10.5h8.5v2.5a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3z M11 11.5h2 M2.5 10.5l1-3 M21.5 10.5l-1-3',
    tint: 'M2.5 10.5h8.5v2.5a3 3 0 0 1-3 3h-2.5a3 3 0 0 1-3-3z M13 10.5h8.5v2.5a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3z',
  },
  // A sheath or a holster on a strap.
  sheath: {
    line: 'M3 6.5h18 M3 9.5h18 M9 9.5h6v8l-3 4-3-4z M10.5 6.5V4.5h3v2',
    tint: 'M9 9.5h6v8l-3 4-3-4z',
  },
  // A paper cup, steam off the top.
  cup: {
    line: 'M6 9.5h12l-1.5 11h-9z M5.5 7h13v2.5h-13z M10 5c0-1 1-1 1-2 M13.5 5c0-1 1-1 1-2',
    tint: 'M6.6 13.5h10.8l-.9 7h-9z',
  },
  // A cardboard box, taped down the middle.
  box: {
    line: 'M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z M3.5 7.5L12 11.5l8.5-4 M12 11.5v9 M7.75 5.5l8.5 4',
    tint: 'M3.5 7.5L12 3.5l8.5 4L12 11.5z',
  },
};

const RULES: [RegExp, LootMark][] = [
  [/syringe/i, { icon: 'syringe', tone: 'drug' }],
  [/baggie|powder|eight-ball/i, { icon: 'baggie', tone: 'drug' }],
  [/painkiller|pill|tablets$|naloxone|narcan/i, { icon: 'pill', tone: 'drug' }],
  [/bandage|gauze/i, { icon: 'bandage', tone: 'drug' }],
  [/laptop/i, { icon: 'laptop', tone: 'value' }],
  [/tablet/i, { icon: 'phone', tone: 'value' }],
  [/console/i, { icon: 'console', tone: 'value' }],
  [/watch/i, { icon: 'watch', tone: 'value' }],
  [/ring|necklace|jewel|earring|bracelet|chain/i, { icon: 'ring', tone: 'value' }],
  [/drill|toolbox/i, { icon: 'wrench', tone: 'value' }],
  [/charger/i, { icon: 'plug', tone: 'junk' }],
  [/pepper spray/i, { icon: 'spray', tone: 'weapon' }],
  [/cigarette/i, { icon: 'cigarette', tone: 'junk' }],
  [/lighter|matches/i, { icon: 'flame', tone: 'junk' }],
  [/beer|whiskey|vodka|wine|bottle|pint|energy drink/i, { icon: 'bottle', tone: 'junk' }],
  [/caffeine pills/i, { icon: 'pill', tone: 'drug' }],
  [/drug test/i, { icon: 'box', tone: 'drug' }],
  [/groceries|lunch|sandwich|snack|grocery/i, { icon: 'bag', tone: 'junk' }],
  [/receipt|note|ticket|letter|paper/i, { icon: 'paper', tone: 'junk' }],
  [/keys?$/i, { icon: 'key', tone: 'keys' }],
];

const WEAR: Record<string, LootGlyph> = { top: 'shirt', bottom: 'pants', bag: 'backpack', head: 'cap', face: 'mask', eyes: 'glasses', gear: 'sheath' };

/** The mark for a thing you could take (or buy, or carry, or wear). */
export function lootMark(x: { kind: string; name: string; weapon?: number; spray?: boolean; secret?: string; slot?: string }): LootMark {
  if (x.slot && WEAR[x.slot]) return { icon: WEAR[x.slot], tone: 'wear' };
  if (x.kind === 'wear') return { icon: /backpack|bag|fanny/i.test(x.name) ? 'backpack' : /mask|bandana|balaclava/i.test(x.name) ? 'mask' : /cap|beanie|hat|hood/i.test(x.name) ? 'cap' : /glasses|shades/i.test(x.name) ? 'glasses' : /sheath|holster/i.test(x.name) ? 'sheath' : /pants|jeans|chinos|trousers/i.test(x.name) ? 'pants' : 'shirt', tone: 'wear' };
  if (/coffee|tea$/i.test(x.name)) return { icon: 'cup', tone: 'junk' };
  if (/zip bags/i.test(x.name)) return { icon: 'baggie', tone: 'drug' };
  if (x.kind === 'cash') return { icon: /change|cup holder|coins/i.test(x.name) ? 'coins' : 'cash', tone: 'cash' };
  if (x.kind === 'car keys') return { icon: 'key', tone: 'keys' };
  if (x.kind === 'credit card' || x.kind === 'debit card') return { icon: 'card', tone: 'card' };
  if (x.kind === 'id') return { icon: 'id', tone: 'card' };
  if (x.kind === 'phone') return { icon: 'phone', tone: 'value' };
  if (/syringe/i.test(x.name)) return { icon: 'syringe', tone: 'drug' };
  if (x.kind === 'ammo' || /rounds$|shells$/i.test(x.name)) return { icon: 'ammo', tone: 'weapon' };
  if (x.kind === 'med') return /bandage|gauze|splint|kit/i.test(x.name) ? { icon: 'bandage', tone: 'drug' } : { icon: 'pill', tone: 'drug' };
  if (x.secret && x.secret !== 'empty') return { icon: /syringe/i.test(x.name) ? 'syringe' : 'baggie', tone: 'drug' };
  if (x.spray) return { icon: 'spray', tone: 'weapon' };
  if (x.kind === 'weapon' || x.weapon) return { icon: /gun|pistol|revolver|rifle|shotgun|9mm|\.38/i.test(x.name) ? 'gun' : /bottle/i.test(x.name) ? 'bottle' : 'knife', tone: 'weapon' };
  for (const [re, m] of RULES) if (re.test(x.name)) return m;
  return { icon: 'box', tone: 'junk' };
}

/** A symbol as an inline SVG, drawn in the colour of its tone. */
export const glyphSvg = (g: LootGlyph, tone: LootTone) =>
  `<span class="loot-ic" data-tone="${tone}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[g].tint ? `<path class="tint" d="${GLYPHS[g].tint}" fill="currentColor" stroke="none"/>` : ''}<path d="${GLYPHS[g].line}"/></svg></span>`;

/** The mark for a thing, as HTML. */
export const lootIcon = (x: Parameters<typeof lootMark>[0]) => {
  const m = lootMark(x);
  return glyphSvg(m.icon, m.tone);
};
