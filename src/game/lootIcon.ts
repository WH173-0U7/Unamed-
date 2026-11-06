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
export type LootTone = 'cash' | 'value' | 'card' | 'keys' | 'weapon' | 'drug' | 'junk';

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
  | 'box';

export interface LootMark {
  icon: LootGlyph;
  tone: LootTone;
}

/** The drawings: path data on a 24 × 24 grid, stroked, not filled. */
const GLYPHS: Record<LootGlyph, string> = {
  // A bill: the border, the portrait oval, the corner numbers.
  cash: 'M2.5 6.5h19v11h-19z M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M5.5 9.5v1 M18.5 13.5v1',
  // A short stack of coins, edge on.
  coins: 'M5 8.5c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5-3.1 2.5-7 2.5-7-1.1-7-2.5z M5 8.5v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4 M5 12.5v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4',
  gem: 'M7 4h10l4 5-9 11L3 9z M3 9h18 M9.5 4L8 9l4 11 4-11-1.5-5',
  phone: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5z M10.5 18.5h3',
  laptop: 'M5 5.5h14v9.5H5z M2.5 18h19l-1.2 2H3.7z',
  console: 'M7.5 8.5h9a4.5 4.5 0 0 1 4.4 5.4l-.6 3a2 2 0 0 1-3.5.9L15 15.5H9l-1.8 2.3a2 2 0 0 1-3.5-.9l-.6-3a4.5 4.5 0 0 1 4.4-5.4z M8 10.5v4 M6 12.5h4 M15.5 11.5h.01 M17.5 13.5h.01',
  watch: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10 M9 7.8L10 3h4l1 4.8 M9 16.2l1 4.8h4l1-4.8 M12 9.8V12l1.6 1.2',
  ring: 'M12 9a6 6 0 1 0 0 12a6 6 0 1 0 0-12 M9.5 5.5L12 2.5l2.5 3-2.5 3.5z',
  wrench: 'M15 3.5a4.5 4.5 0 0 0-4.3 5.9L3.6 16.5a2 2 0 0 0 2.9 2.9l7.1-7.1A4.5 4.5 0 0 0 19.9 7.5l-2.8 2.8-2.5-.6-.6-2.5 2.8-2.8A4.5 4.5 0 0 0 15 3.5z',
  card: 'M4.5 5.5h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z M2.5 9.5h19 M5.5 14.5h4',
  id: 'M4.5 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8.5 9a2 2 0 1 0 0 4a2 2 0 1 0 0-4 M5.5 16.5a3 3 0 0 1 6 0 M14 10h4.5 M14 13.5h3',
  // A key: the bow, the shaft, two teeth.
  key: 'M7.5 12a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7 M10 13L19.5 3.5 M16.5 6.5l2.5 2.5 M14 9l2 2',
  // A blade with a straight spine and a curved edge, the guard, the handle.
  knife: 'M8.5 15.5L20.5 3.5c.4 4.2-3.2 9.4-9 12.8z M6.5 13.5l4 4 M3.5 20.5l4.5-4.5',
  spray: 'M8.5 9h7v11.5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z M10 9V6h4v3 M12 6V3.5h3 M17.5 3.5l2-1 M17.5 5.5h2.5 M17.5 7.5l2 1 M8.5 13h7',
  gun: 'M2.5 7.5h18v4.5h-8l-1.2 3h-2.6l.6-3H7.5l-1.8 6.5H2.8L4.5 12H2.5z M20.5 9.5h1',
  pill: 'M6 18a3.5 3.5 0 0 1 0-5L13 6a3.5 3.5 0 0 1 5 5l-7 7a3.5 3.5 0 0 1-5 0z M9.5 9.5l5 5',
  // A small zip bag, folded over at the top.
  baggie: 'M6 6.5h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z M6 9.5h12 M8 4h8l2 2.5H6z M9.5 14.5h.01 M12 16.5h.01 M14.5 13.5h.01',
  syringe: 'M17.5 2.5l4 4 M19.5 4.5l-3 3 M16.5 7.5l-9 9-2-2 9-9z M7.5 16.5l-4 4 M11 10l1.5 1.5 M9 12l1.5 1.5',
  // A first-aid cross.
  bandage: 'M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z',
  // A receipt, torn off at the bottom.
  paper: 'M6 2.5h12v19l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z M9 7h6 M9 10.5h6 M9 14h3.5',
  cigarette: 'M2.5 14.5h14v3h-14z M16.5 14.5h4v3h-4 M18.5 11.5c0-1.8 2-1.8 2-3.5s-2-1.8-2-3.5',
  flame: 'M12 21.5c-3.6 0-6-2.6-6-5.8 0-3.9 3.6-5.6 3.8-10.2 2.8 1.8 4 3.8 4.2 6 .9-.7 1.4-1.8 1.5-3 1.8 1.8 2.5 4.4 2.5 7.2 0 3.2-2.4 5.8-6 5.8z',
  bottle: 'M10 2.5h4v4l2 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-11l2-3z M8 13h8',
  bag: 'M5 8.5h14l-1.2 12.5H6.2z M9 8.5V6.5a3 3 0 0 1 6 0v2',
  plug: 'M9 2.5v4.5 M15 2.5v4.5 M7 7h10v3a5 5 0 0 1-10 0z M12 15v6.5',
  box: 'M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z M3.5 7.5L12 11.5l8.5-4 M12 11.5v9',
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
  [/beer|whiskey|vodka|wine|bottle|pint/i, { icon: 'bottle', tone: 'junk' }],
  [/groceries|lunch|sandwich|snack|grocery/i, { icon: 'bag', tone: 'junk' }],
  [/receipt|note|ticket|letter|paper/i, { icon: 'paper', tone: 'junk' }],
  [/keys?$/i, { icon: 'key', tone: 'keys' }],
];

/** The mark for a thing you could take. */
export function lootMark(x: { kind: string; name: string; weapon?: number; spray?: boolean; secret?: string }): LootMark {
  if (x.kind === 'cash') return { icon: /change|cup holder|coins/i.test(x.name) ? 'coins' : 'cash', tone: 'cash' };
  if (x.kind === 'car keys') return { icon: 'key', tone: 'keys' };
  if (x.kind === 'credit card' || x.kind === 'debit card') return { icon: 'card', tone: 'card' };
  if (x.kind === 'id') return { icon: 'id', tone: 'card' };
  if (x.kind === 'phone') return { icon: 'phone', tone: 'value' };
  if (x.secret && x.secret !== 'empty') return { icon: /syringe/i.test(x.name) ? 'syringe' : 'baggie', tone: 'drug' };
  if (x.spray) return { icon: 'spray', tone: 'weapon' };
  if (x.kind === 'weapon' || x.weapon) return { icon: /gun|pistol|revolver|rifle|shotgun|9mm|\.38/i.test(x.name) ? 'gun' : /bottle/i.test(x.name) ? 'bottle' : 'knife', tone: 'weapon' };
  for (const [re, m] of RULES) if (re.test(x.name)) return m;
  return { icon: 'box', tone: 'junk' };
}

/** A symbol as an inline SVG, drawn in the colour of its tone. */
export const glyphSvg = (g: LootGlyph, tone: LootTone) =>
  `<span class="loot-ic" data-tone="${tone}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${GLYPHS[g]}"/></svg></span>`;

/** The mark for a thing, as HTML. */
export const lootIcon = (x: Parameters<typeof lootMark>[0]) => {
  const m = lootMark(x);
  return glyphSvg(m.icon, m.tone);
};
