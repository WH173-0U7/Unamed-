/**
 * What changed in each version, newest first. Every update that goes out
 * adds an entry here (and bumps the version), and the game shows what's new
 * the first time it's opened after an update (see ui/menu.ts).
 */
export interface Release {
  v: string;
  date: string;
  items: string[];
}

export const CHANGES: Release[] = [
  {
    v: '0.41',
    date: 'Nov 3',
    items: [
      'Fight text fixes: someone on the floor or out cold no longer "staggers" or "limps"; the hard cases only spit blood when they’re bleeding.',
      'Afterwards, you only remember a name you actually saw (and on what: a license, an ID, a card).',
      'Your broken jaw takes weeks to heal, not two hours; Catch your breath respects broken ribs.',
      'Drinking warns you one drink before you black out.',
      'Small fixes: torture options that had nothing left to do are greyed out; the lurk static no longer cuts off.',
    ],
  },
  {
    v: '0.40',
    date: 'Nov 3',
    items: [
      'Version notes: the version you’re playing is on the main menu, and this list shows up whenever there’s something new (Main menu → What’s new to see it again).',
      'Fights take less room: the status box shows just the two blood bars until you tap it; the log shows the last three lines until you tap it.',
    ],
  },
  {
    v: '0.39',
    date: 'Nov 3',
    items: [
      'People talk like people: the scared beg and bargain in their own way (their rent, their kid, work in the morning); the sly try to talk their way out.',
      'The hard cases (hotheads, the proud, the hard) taunt you when they land a hit, when you miss, when you go down.',
      'It stays with you: after mugging, beating or torturing someone your character feels it (or doesn’t, the further gone you are), and stress follows.',
    ],
  },
  {
    v: '0.38',
    date: 'Nov 3',
    items: [
      'One Violence tab in a fight, in sections (Strikes, Weapons, On the ground, Torture); Run and Catch your breath are buttons under the tabs.',
      'The You sheet only closes from its top bar (or a long pull), so scrolling doesn’t put it away.',
    ],
  },
  {
    v: '0.37',
    date: 'Nov 3',
    items: [
      'Combat text says what really happened: a crunch means something broke, blood means bleeding. Many more lines, and fewer repeats.',
      'Torture’s broken fingers and hands are real injuries now.',
    ],
  },
  {
    v: '0.36',
    date: 'Nov 3',
    items: [
      'Film grain, glitches, static and a colour fringe across the whole game, with sliders for each in Settings.',
      'Buttons ripple when pressed; violence flashes red, good things glow warm.',
    ],
  },
  {
    v: '0.35',
    date: 'Nov 3',
    items: ['Sound: clicks, ticks, static when you lurk, level-up notes (Settings → Sound to mute). No sounds for hits.', 'Your stats moved to the You tab at the bottom; Lurk sits just below the middle.'],
  },
  {
    v: '0.34',
    date: 'Nov 3',
    items: [
      'Alcohol: beer and vodka at the gas station, and the last of a drunk’s bottle. Tipsy, drunk, wasted, blackout.',
      'Cigarettes come in packs or loose; put loose ones in a pack.',
      'Every drug and cigarette comes on slowly; shops and sheets stay clear of the effects.',
    ],
  },
  {
    v: '0.33',
    date: 'Nov 3',
    items: ['Each drug has its own look on the screen.', 'Syringes hold heroin, fentanyl, meth, tranq, or nothing: test them, inject them, or get stuck with one.'],
  },
  {
    v: '0.32',
    date: 'Nov 3',
    items: ['Take weapons off people and use them (knife, box cutter, bottle, syringe, pepper spray), with a Weapons stat.'],
  },
  {
    v: '0.31',
    date: 'Nov 3',
    items: ['Unarmed skill and moves, from crude to skilled, for fights, ambushes and the ground. Levels now go to 100.'],
  },
  {
    v: '0.30',
    date: 'Nov 3',
    items: ['Fear, mugging, threats and torture; personalities; the 24/7 gas station; the bank cash machine; more bad-guy titles.'],
  },
];

export const VERSION = CHANGES[0].v;
