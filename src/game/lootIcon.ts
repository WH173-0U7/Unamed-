/**
 * A symbol and a colour for each kind of thing you can take, so a list of
 * loot reads at a glance: green for money, gold for what's worth selling,
 * blue for cards and ID, amber for keys, red for weapons, violet for drugs
 * and medicine, grey for the rest.
 */
export type LootTone = 'cash' | 'value' | 'card' | 'keys' | 'weapon' | 'drug' | 'junk';

export interface LootMark {
  icon: string;
  tone: LootTone;
}

const RULES: [RegExp, LootMark][] = [
  [/syringe/i, { icon: '💉', tone: 'drug' }],
  [/baggie|powder|eight-ball/i, { icon: '💊', tone: 'drug' }],
  [/painkiller|pill|tablets$|naloxone|narcan/i, { icon: '💊', tone: 'drug' }],
  [/bandage|gauze/i, { icon: '🩹', tone: 'drug' }],
  [/laptop/i, { icon: '💻', tone: 'value' }],
  [/tablet/i, { icon: '📱', tone: 'value' }],
  [/console/i, { icon: '🎮', tone: 'value' }],
  [/watch/i, { icon: '⌚', tone: 'value' }],
  [/ring|necklace|jewel|earring|bracelet|chain/i, { icon: '💍', tone: 'value' }],
  [/drill|toolbox/i, { icon: '🔧', tone: 'value' }],
  [/charger/i, { icon: '🔌', tone: 'junk' }],
  [/pepper spray/i, { icon: '💨', tone: 'weapon' }],
  [/cigarette/i, { icon: '🚬', tone: 'junk' }],
  [/lighter|matches/i, { icon: '🔥', tone: 'junk' }],
  [/beer|whiskey|vodka|wine|bottle|pint/i, { icon: '🍺', tone: 'junk' }],
  [/groceries|lunch|sandwich|snack/i, { icon: '🥪', tone: 'junk' }],
  [/receipt|note|ticket|letter|paper/i, { icon: '📄', tone: 'junk' }],
  [/keys?$/i, { icon: '🔑', tone: 'keys' }],
];

/** The mark for a thing you could take. */
export function lootMark(x: { kind: string; name: string; weapon?: number; spray?: boolean; secret?: string }): LootMark {
  if (x.kind === 'cash') return { icon: '💵', tone: 'cash' };
  if (x.kind === 'car keys') return { icon: '🔑', tone: 'keys' };
  if (x.kind === 'credit card' || x.kind === 'debit card') return { icon: '💳', tone: 'card' };
  if (x.kind === 'id') return { icon: '🆔', tone: 'card' };
  if (x.kind === 'phone') return { icon: '📱', tone: 'value' };
  if (x.secret && x.secret !== 'empty') return { icon: '💊', tone: 'drug' };
  if (x.spray) return { icon: '💨', tone: 'weapon' };
  if (x.kind === 'weapon' || x.weapon) return { icon: /gun|pistol|revolver|rifle|shotgun|9mm|\.38/i.test(x.name) ? '🔫' : '🔪', tone: 'weapon' };
  for (const [re, m] of RULES) if (re.test(x.name)) return m;
  return { icon: '📦', tone: 'junk' };
}

/** The mark as HTML: a small symbol in its colour. */
export const lootIcon = (x: Parameters<typeof lootMark>[0]) => {
  const m = lootMark(x);
  return `<span class="loot-ic" data-tone="${m.tone}" aria-hidden="true">${m.icon}</span>`;
};
