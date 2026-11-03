/**
 * Practice: every move you make gets better the more you make it. Each move
 * keeps a count of how many times you've tried it, and that count, plus your
 * Unarmed (or Weapons) level, decides how it reads in the fight log:
 *
 * - **Clumsy** (0): you don't really know how to do this yet, and it shows.
 * - **Practiced** (1): you've done it enough times; it's ordinary.
 * - **Polished** (2): it's yours now: fast, tight, economical.
 *
 * Only the words change here; how hard and how often it lands is still the
 * stats' business.
 */

export type Tier = 0 | 1 | 2;

/** How practiced a move is: its uses count most, your level helps. */
export function tierOf(uses: number, level: number): Tier {
  const score = uses + level * 0.5;
  return score >= 45 ? 2 : score >= 10 ? 1 : 0;
}

/** What to call a move when it gets better ("Your kicks are ..."). */
export const MOVE_NAMES: Record<string, string> = {
  punch: 'punches',
  kick: 'kicks',
  stomp: 'stomps',
  'wpn:blade': 'knife work',
  'wpn:blunt': 'swings',
  'wpn:bottle': 'bottle swings',
  'wpn:broken': 'broken-bottle work',
  'wpn:needle': 'needle jabs',
  'tech:body': 'gut punches',
  'tech:knee': 'knees',
  'tech:hook': 'haymakers',
  'tech:headbutt': 'headbutts',
  'tech:elbow': 'elbows',
  'tech:uppercut': 'uppercuts',
  'tech:sweep': 'trips',
  'ground:kneedrop': 'knee drops',
  'ground:pound': 'ground and pound',
  'ground:arm': 'arm locks',
  'floor:legs': 'kicks from the floor',
  'floor:pull': 'takedowns from the floor',
  sucker: 'sucker punches',
  bumrush: 'bum rushes',
  shove: 'shoves',
  kneecap: 'knee kicks',
  slam: 'wall slams',
  'rear-choke': 'chokes',
};

/** Said once, when a move moves up a tier. */
export function tierUpLine(key: string, t: Tier): string {
  const n = MOVE_NAMES[key] ?? 'moves';
  const plural = !/work|pound/.test(n);
  return t === 1
    ? `Your ${n} ${plural ? 'are' : 'is'} starting to come naturally.`
    : `Your ${n} ${plural ? 'have' : 'has'} gotten sharp: you don't have to think about ${plural ? 'them' : 'it'} any more.`;
}

/** Your punch, landing. `where` is "in the ribs"; `into` is "into their ribs". */
export function punchText(t: Tier, where: string, into: string): string[] {
  if (t === 0)
    return [
      `You swing wild and catch them ${where}.`,
      `You throw a sloppy punch and it lands ${where}.`,
      `You flail at them and connect ${where}.`,
      `You throw everything into a clumsy swing; it lands ${where}.`,
      `Your fist comes round in a big, slow arc and lands ${where}. Your knuckles sting.`,
      `You shut your eyes as you swing, and it lands ${where}.`,
    ];
  if (t === 1)
    return [
      `You punch them ${where}.`,
      `You catch them ${where} with a right.`,
      `You land a fist ${where}.`,
      `You drive a punch ${into}.`,
      `A left from you lands ${where}.`,
      `You step in and hit them ${where}.`,
    ];
  return [
    `You snap a punch ${into}.`,
    `You punch them ${where}, short and hard.`,
    `You slip inside and drive a fist ${into}.`,
    `A tight punch, ${where}.`,
    `You feint high and put the real one ${into}.`,
    `Jab, then the right, ${where}. You're back out before they can answer.`,
    `You turn your hips into it and the punch lands ${where}.`,
  ];
}

/** Your kick, landing. */
export function kickText(t: Tier, where: string, into: string): string[] {
  if (t === 0)
    return [
      `You lash out with a clumsy kick and catch them ${where}.`,
      `You kick out, off balance, and catch them ${where}.`,
      `You swing a wild kick; it connects ${where}.`,
      `You hop, flail a leg, and somehow catch them ${where}.`,
    ];
  if (t === 1)
    return [`You kick them ${where}.`, `You drive a boot ${into}.`, `You plant a kick ${where}.`, `You catch them with a kick ${where}.`];
  return [
    `You turn on your standing foot and whip a kick ${into}.`,
    `A short, fast kick, ${where}, and your foot is back down.`,
    `You check them with your shin ${where}, balanced the whole time.`,
    `You step and snap a kick ${into}.`,
  ];
}

/** Your stomp, landing. */
export function stompText(t: Tier, loc: 'head' | 'stomach' | 'body'): string[] {
  const part = loc === 'head' ? 'head' : loc === 'stomach' ? 'stomach' : 'ribs';
  if (t === 0)
    return loc === 'head'
      ? ['You stamp down on their head, half losing your balance.', 'You bring your foot down on their head, awkwardly.']
      : [`You stomp down on their ${part}, nearly tripping over them.`, `You stamp at their ${part}; it lands, more or less.`];
  if (t === 1)
    return loc === 'head'
      ? ['You stomp on their head.', 'You bring your heel down on their head.', 'You stamp down on their face.']
      : loc === 'stomach'
        ? ['You stomp down on their stomach.', 'You drive your heel into their gut.']
        : ['You stomp down on their ribs.', 'You drop your heel into their side.', 'You stamp on their chest.'];
  return loc === 'head'
    ? ['You plant your feet and bring your heel down on their head, all your weight behind it.', 'One clean stamp, right on their head.']
    : [`You set yourself and drive your heel straight down into their ${part}.`, `A heavy, measured stamp to the ${part}.`];
}

/** Your weapon, landing. `w` is its name (lower case). */
export function weaponText(t: Tier, kind: 'blade' | 'blunt' | 'bottle' | 'broken' | 'needle', w: string, where: string, into: string): string[] {
  if (kind === 'broken')
    return t === 0
      ? [`You jab the broken bottle at them, wild, and the glass catches them ${where}.`, `You swipe the jagged neck at them; it catches them ${where}.`]
      : t === 1
        ? [`You jab the broken bottle at them and the glass catches them ${where}.`, `You slash at them with the jagged neck, ${where}.`, `You push the broken bottle ${into}.`]
        : [`You keep the jagged neck low and drive it ${into}, then twist it out.`, `A feint, then the broken glass, ${where}.`];
  if (kind === 'bottle')
    return t === 0
      ? [`You swing the bottle blindly and it bounces off them ${where}.`, `You flail with the bottle; it thumps them ${where}.`]
      : t === 1
        ? [`You swing the bottle at them and it thumps them ${where}.`, `You club them with the bottle, ${where}.`, `You swing the bottle hard; it catches them ${where}.`]
        : [`You hold the bottle by the neck and swing it hard ${into}.`, `A short, heavy swing of the bottle, ${where}.`];
  if (kind === 'needle')
    return t === 0
      ? [`You stab clumsily with the syringe and stick them ${where}.`]
      : t === 1
        ? [`You jab the syringe at them and stick them ${where}.`, `You stab the needle ${into}.`]
        : [`You slip the needle in ${where}, quick as a nurse.`, `One fast jab ${into}.`];
  if (kind === 'blade')
    return t === 0
      ? [`You wave the ${w} at them and it catches them ${where}.`, `You stab wildly with the ${w}; it catches them ${where}.`, `You slash at them, eyes half shut, and the ${w} catches them ${where}.`]
      : t === 1
        ? [`You slash at them with the ${w} and catch them ${where}.`, `The ${w} flashes, and catches them ${where}.`, `You cut at them with the ${w}, ${where}.`, `You lunge with the ${w} and open them up ${where}.`]
        : [
            `You keep the ${w} low and close, and flick it out ${where}.`,
            `A feint, then the ${w}, ${where}. You're back out of reach before they feel it.`,
            `You step off the line and slice them ${where}.`,
          ];
  return t === 0
    ? [`You swing the ${w} wildly and it hits them ${where}.`, `You flail with the ${w}; it catches them ${where}.`]
    : t === 1
      ? [`You hit them with the ${w} ${where}.`, `You swing the ${w} ${into}.`]
      : [`You choke up on the ${w} and drive it ${into}.`, `A short, tight swing of the ${w}, ${where}.`, `You let them come and meet them with the ${w}, ${where}.`];
}

/** The learned moves: [clumsy, polished] (practiced uses the move's own line). */
export const TECH_TEXT: Record<string, [string[], string[]]> = {
  'tech:body': [
    ['You jab a fist at their stomach; it lands, mostly.', 'You throw a fist low, at their gut.'],
    ['You dip and hook a fist up under their ribs, into their gut.', 'You bury a short, nasty punch in their gut.'],
  ],
  'tech:knee': [
    ['You grab at their jacket and bring your knee up; it lands somewhere around their ribs.', 'You hang onto their jacket and knee them, awkwardly.'],
    ['You pull them down by the collar onto a rising knee.', 'You clinch them tight and drive your knee into their ribs, twice.'],
  ],
  'tech:hook': [
    ['You wind up from somewhere behind you and throw it, everything you have, at their head.', 'You throw a huge, telegraphed swing at their head.'],
    ['You sit down into a looping right and throw it through their head.', 'You set it up with a feint, and then the haymaker comes.'],
  ],
  'tech:headbutt': [
    ['You grab their collar and lunge your head at their face; you see stars too.', 'You smash your forehead forward, eyes shut.'],
    ['You yank them in by the collar and snap your forehead into their nose.', 'Short and vicious: the top of your head, into their face.'],
  ],
  'tech:elbow': [
    ['You swing your elbow at their face, too far out.', 'You flap an elbow at their face.'],
    ['You turn your shoulder over and slice an elbow across their face.', 'A tight elbow, chopping down across their face.'],
  ],
  'tech:uppercut': [
    ['You dip down and come up under their chin, more shove than punch.', 'You swing up at their chin, telegraphing it.'],
    ['You drop your shoulder and drive the uppercut straight up through their chin.', 'You slip their guard and come up under their chin, short and sharp.'],
  ],
  'tech:sweep': [
    ['You fumble a foot behind their ankle and push.', 'You hook at their ankle and shove, hoping.'],
    ['You catch their weight on the wrong foot and sweep it out.', 'A hook behind the ankle, a hand on the chest, and their feet are gone.'],
  ],
  'ground:kneedrop': [
    ['You drop onto their chest, knee first, and almost miss.', 'You fall onto them, knee first.'],
    ['You drop your knee into their chest, all your weight behind it, and stay balanced.', 'You pick your spot and drop, knee first, onto their chest.'],
  ],
  'ground:pound': [
    ['You straddle them and swing down at their face, wild.', 'You sit on them and flail punches down at their face.'],
    ['You pin their hips and rain short, hard punches down into their face.', 'You post a hand on their chest and punch down, again and again, into their face.'],
  ],
  'ground:arm': [
    ['You grab their wrist and pull at their arm, not really sure how this goes.', 'You wrestle their arm back, awkwardly.'],
    ['You trap their wrist, set your hips, and bend the arm back against the elbow.', 'You lock the arm out across your thigh and lean on it.'],
  ],
  'floor:legs': [
    ['From the floor, you kick blindly at their legs.', 'You flail your feet at their ankles.'],
    ['From the floor, you hook one ankle and kick the knee with the other foot.', 'From your back, you scissor their legs out from under them.'],
  ],
  'floor:pull': [
    ['You grab at their legs and pull, hard.', 'You hug their legs and yank.'],
    ['You catch an ankle, drive your shoulder into their knee, and they come down with you.', 'You trap their heel and roll into their shin; down they come.'],
  ],
};

/** The ambushes, landing: [clumsy, practiced, polished]. */
export const AMBUSH_TEXT: Record<string, [string[], string[], string[]]> = {
  sucker: [
    ['You come up behind them and swing, wild, at the side of their head.', 'You rush the last few steps and throw a big, ugly swing at their head from behind.'],
    ['You sucker punch them from behind, on the side of the head.'],
    ['Three quiet steps, and you put a short, perfect punch behind their ear.', 'You time it to their step, and your fist catches the side of their head from behind.'],
  ],
  bumrush: [['You run at them, head down, and crash into them.'], ['You bum rush them.'], ['You close the gap fast and low, shoulder first, and drive right through them.']],
  shove: [['You shove them, hard, with both hands.'], ['You shove them hard.'], ['You catch them mid-step and shove, right when their weight is wrong.']],
  kneecap: [
    ['You come up behind them and kick at the back of their knee as hard as you can.'],
    ['You come up behind them and kick the back of their knee as hard as you can.'],
    ['You stamp down through the back of their knee, quick and quiet.'],
  ],
  slam: [
    ['You grab them by the neck and shove their face at the wall.'],
    ['You grab them by the back of the neck and drive their face into the wall.'],
    ['One hand on the back of their neck, and you bounce their face off the wall before they know you are there.'],
  ],
  'rear-choke': [
    ['You come up behind them and get an arm round their throat, more or less.'],
    ['You come up behind them and lock an arm round their throat.'],
    ['You slide an arm round their throat from behind and lock it in, tight and patient.'],
  ],
};

/** Missing, by how good you are: you swing at air, or they just read it. */
export function missText(t: Tier, kind: 'punch' | 'kick' | 'weapon' | 'stomp' | 'tech'): string[] {
  if (t === 0)
    return kind === 'kick'
      ? ['You swing a leg at them and miss by a mile.']
      : kind === 'stomp'
        ? ['You stamp down and hit the pavement. They rolled away.']
        : ['You swing and nearly fall over.', 'You miss, wildly.', 'You telegraph it from a mile away. They step back.'];
  if (t === 2)
    return kind === 'stomp'
      ? ['You stamp down; they roll just clear.']
      : ['It was a good one; they were just a little faster.', 'They read it, barely.', 'They slip it by an inch.'];
  return kind === 'kick' ? ['You miss the kick.'] : kind === 'stomp' ? ['You stomp down, but they roll away from it.'] : ['They slip the punch.', 'You miss.', 'Your punch glances off.'];
}
