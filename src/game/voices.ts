import type { Encounter } from './encounter';
import type { Kind, Personality } from './person';

/** A line from a fight on the street, as it reads in someone's house. */
export const indoors = (text: string) =>
  text
    .replace(/\bthe sidewalk\b/g, 'the floor')
    .replace(/\bThe sidewalk\b/g, 'The floor')
    .replace(/\bwalk off into the dark\b/g, 'walk out')
    .replace(/\boff into the dark\b/g, 'out of the room')
    .replace(/\bthe street swims\b/g, 'the room swims')
    .replace(/\bThe street tips\b/g, 'The room tips')
    .replace(/\bdown the street\b/g, 'out the door')
    .replace(/\bThey walk off\b/g, 'They back out of the room')
    .replace(/\bThey walk away\b/g, 'They back away')
    .replace(/\bsomewhere in the dark\b/g, 'somewhere in the house')
    .replace(/deafening between the buildings/g, 'deafening in the little room')
    .replace(/a boom that rolls down the street/g, 'a boom that shakes the windows')
    .replace(/They dart across the traffic, horns blaring, and you lose them\./g, 'They’re out the front door and across the street, and you lose them.')
    .replace(/They duck into a crowd, and you can't see them anymore\./g, 'They’re out of the house and into the dark, and you can’t see them anymore.')
    .replace(/Feet pounding the floor\./g, 'Feet pounding down the steps.')
    .replace(/\bcut through a parking lot\b/g, 'go out the back')
    .replace(/\bin the gutter\b/g, 'on their floor')
    .replace(/\bthe end of the street\b/g, 'the door')
    .replace(/\binto an alley\b/g, 'out the door')
    .replace(/\bdown a side street\b/g, 'out the back');


/**
 * What people say and do, in their own voice. The scared (timid, jumpy,
 * calm) are people with lives: rent, kids, a job in the morning, the little
 * they've got; they beg, bargain, break. The sly talk. The hard cases
 * (hotheads, the proud, the hard) taunt you, insult you, and only crack at
 * the very end, bitterly. What they say depends on who they are (a civilian,
 * a drunk, someone homeless, a junkie) and how scared they are.
 *
 * Every function returns candidate lines; the encounter picks one it hasn't
 * used lately.
 */
export type Moment =
  | 'giveUp'
  | 'giveUpDown'
  | 'refuse'
  | 'refuseMug'
  | 'beg'
  | 'emptied'
  | 'caught'
  | 'allThere'
  | 'holdingOut'
  | 'pinTruth'
  | 'pinLie'
  | 'pinRefuse'
  | 'torture'
  | 'letGo'
  | 'hitByYou'
  | 'hitYou'
  | 'youMiss'
  | 'youDown'
  | 'menaced'
  | 'woken';

type Group = 'victim' | 'sly' | 'hothead' | 'proud' | 'hard';
const groupOf = (p?: Personality): Group => (p === 'sly' ? 'sly' : p === 'hothead' || p === 'proud' || p === 'hard' ? p : 'victim');
/** The hard cases: they don't beg, they taunt. */
export const isBrute = (p?: Personality) => p === 'hothead' || p === 'proud' || p === 'hard';

/** A detail that makes them a person: whose name was on the card, what was in the wallet. */
function life(e: Encounter) {
  // Only what you'd know: what you saw going through their things (or what
  // they'd tell you themselves, like their name, when they beg).
  const seen = e.person.clothes.filter((g) => g.searched).flatMap((g) => g.loot);
  const loot = e.person.clothes.flatMap((g) => g.loot);
  // What they've just handed over (not what they're hiding).
  const shown = loot.filter((l) => !l.hidden);
  return {
    name: e.holder?.split(' ')[0],
    sawName: seen.some((l) => l.kind === 'id' || /card/.test(l.kind)),
    // What the name was on (a license, an expired state ID, a debit card).
    nameOn: seen.find((l) => l.kind === 'id' || /card/.test(l.kind))?.name.toLowerCase().replace(/^state id(, expired)?/, (_, x) => (x ? 'expired state ID' : 'state ID')).replace(/^driver's/, "driver's"),
    kid: shown.some((l) => /photo of a kid/i.test(l.detail ?? '')),
    sawKid: seen.some((l) => /photo of a kid/i.test(l.detail ?? '')),
    wallet: shown.some((l) => l.where === 'wallet'),
    cash: shown.some((l) => l.kind === 'cash'),
    id: loot.some((l) => l.kind === 'id'),
    phone: shown.some((l) => l.kind === 'phone'),
    rent: loot.some((l) => /rent is late/i.test(l.detail ?? '')),
    insulin: loot.some((l) => /insulin/i.test(l.detail ?? '')),
  };
}

const RESIDENT_BEG = ['"This is my home. Please. Just take it and go."', '"I don\'t want to die in my own house. Please."', '"Take whatever you want. Just get out. Please."', '"I won\'t call anyone. I swear I won\'t."'];
const KIND: Record<Kind, { beg: string[]; emptied: string[]; letGo: string[]; giveUp: string[] }> = {
  civilian: {
    beg: [
      '"I have work in the morning. Please. I just want to go home."',
      '"Someone\'s waiting up for me. Please don\'t."',
      '"I won\'t call anyone. I swear I won\'t call anyone."',
      '"I don\'t want to die out here. Please."',
    ],
    emptied: ['"That\'s everything. Please."', 'They hold it all out with both hands, like an offering.'],
    letGo: ['They back away a few steps, then turn and run, and you hear them start to cry.', 'They walk off fast, one hand over their mouth, not looking back.'],
    giveUp: ['"Okay! Okay! Take it. Please don\'t hurt me."', '"Here. Here, take it all. I don\'t want any trouble."'],
  },
  drunk: {
    beg: [
      "\"C'mon, man. C'mon. I didn't do nothin' to you.\"",
      '"Jus\'... jus\' leave me alone, alright? Please."',
      'They sway on their feet, trying to focus on you, close to tears.',
    ],
    emptied: ["\"S'all I got. Swear t'God, that's all I got.\"", 'They fumble it all out, dropping half of it.'],
    letGo: ['They stumble off into the dark, muttering, nearly falling twice.', 'They weave away down the street, crying the way drunks cry, loud and broken.'],
    giveUp: ['"Alright, alright. Easy. Take it."', '"Okay, you win, you win. Jus\' don\'t hit me again."'],
  },
  homeless: {
    beg: [
      '"That\'s all I\'ve got in the world. Please."',
      '"I haven\'t eaten since yesterday. Please don\'t take it."',
      '"I don\'t have anything. Look at me. I don\'t have anything."',
      '"Please. It\'s cold. I need my coat."',
    ],
    emptied: ['"That\'s all of it. That\'s everything I have."', 'They lay it out on the sidewalk: a few coins, the scraps of a life.'],
    letGo: ['They gather their things and shuffle away without a word.', "They sit down where they are, against the wall, and don't move."],
    giveUp: ['"Take it. Take it. I don\'t care anymore."', '"Okay. Okay. Just don\'t hurt me."'],
  },
  junkie: {
    beg: [
      '"Man, I\'m sick, I\'m so sick, please, I just need to get well."',
      '"Please, I\'ll do anything, I\'ll get you more, just let me go."',
      "\"Don't, don't, don't. Please.\"",
    ],
    emptied: ["\"That's it, that's it, I swear, I got nothin' else.\"", 'Their hands shake so badly they can barely hold it out.'],
    letGo: ['They scramble away, scratching at their arms, and vanish into an alley.', 'They run, and you hear them retching somewhere in the dark.'],
    giveUp: ['"Okay, okay, okay! Take it! Just don\'t!"', '"Alright, man, alright, it\'s yours."'],
  },
};

const BRUTE: Record<'hothead' | 'proud' | 'hard', Partial<Record<Moment, string[]>>> = {
  hothead: {
    refuse: ['"You want it? Come and take it, you little shit!"', '"Fuck off!"', 'They spit at your feet. "Try it."'],
    refuseMug: ['"WHAT did you say to me?" They come at you swinging.', '"Wrong guy, asshole." They\'re already swinging.'],
    hitYou: ['"How\'d that feel, huh? HOW\'D THAT FEEL?"', '"That\'s what you get!"', 'They laugh, breathing hard. "Come on!"'],
    youMiss: ['They laugh at you, breathing hard.', '"You hit like you talk."', '"Is that it? Is that all you got?"'],
    youDown: ['"Stay down, bitch! Stay down!"', '"Get up! I\'m not done with you!"', 'They stand over you, laughing. "Look at you."', '"Who\'s the big man now?"'],
    hitByYou: ['"Lucky. That was lucky."', 'They spit blood and grin. "Do it again."', '"That all you got?"'],
    giveUp: ['"Fine! FINE! Take it, you piece of shit!"', 'They\'re shaking with rage, not fear. Or not only fear. "Take it, then."'],
    emptied: ['"Choke on it."', 'They throw it at your feet. "There. Happy?"'],
    beg: ['"You\'re dead. You hear me? You\'re dead."', 'They glare at you, breathing through their teeth.'],
    letGo: ['"I\'ll find you. I swear to God I\'ll find you."', 'They walk off slowly, looking back, memorizing you.'],
    torture: ['They scream curses at you, then just scream.', '"I\'ll kill you! I\'LL KILL YOU!"'],
    menaced: ['"Yeah? Yeah? You and whose army?"', 'They laugh in your face, but their eyes say otherwise.'],
    woken: ['They come to snarling, too weak to swing.', '"Get off me! Get the fuck off me!"'],
  },
  proud: {
    refuse: ['"No."', '"From you? Never."', '"Get away from me."'],
    refuseMug: ['"I don\'t think so." They square up, offended more than afraid.', '"Out of my way." They shove past you, and then they turn.'],
    hitYou: ['"Pathetic."', '"You do this for a living?"'],
    youMiss: ['"Embarrassing."', "They don't even flinch."],
    youDown: ['"Stay there. It suits you."', '"Stay the fuck down."', 'They look down at you like something on their shoe.'],
    hitByYou: ["They touch their face and look at the blood like it's an insult.", 'They wipe their mouth and stare at you, furious.'],
    giveUp: ['They look at the ground. It costs them. "...Fine. Take it."', 'Their jaw works. "Fine," they spit. "Take it."'],
    emptied: ["They hand it over without looking at you, as if you don't exist.", '"I hope it\'s worth it to you."'],
    beg: ["They won't look at you. They won't give you that.", '"Get it over with."'],
    letGo: ["They walk away straight-backed, and only start shaking when they think you can't see.", '"You\'ll regret this."'],
    torture: ["They bite down on it and won't scream, until they do.", '"Animal. You\'re an animal."'],
    menaced: ['"Spare me the speech."', 'They hold your eye and say nothing at all.'],
    woken: ['They come to and stare at you with pure contempt.', '"Get your hands off me."'],
  },
  hard: {
    refuse: ['They don\'t even blink. "Make me."', 'They spit on the ground. "Come and take it."', '"I\'ve been hit by better than you."'],
    refuseMug: ['"You picked the wrong night." They\'re already moving.', 'They smile, slow. "Go on, then."'],
    hitYou: ['"You should\'ve stayed home."', '"That all you got?"'],
    youMiss: ['"Slow."', "They step aside like they've done it a thousand times."],
    youDown: ['"Stay down."', '"Get up."', 'They roll their neck. "Get up. We\'re not done."', 'They stand over you, breathing hard, waiting to see if you get up.'],
    hitByYou: ['They take it and keep coming.', 'They nod, like you\'ve told them something. "Okay."'],
    giveUp: ['They look at you for a long moment. "You win this one." It doesn\'t sound like a surrender.', 'They spit blood and nod once. "Take it."'],
    emptied: ['"Spend it quick."', "They hand it over like they're paying a bill."],
    beg: ['They say nothing. They just watch you.', '"You\'ll remember my face. I\'ll remember yours."'],
    letGo: ["They walk away without hurrying. That's worse.", '"See you around."'],
    torture: ['They grunt through it, white-faced, eyes on yours the whole time.', '"That all?" Their voice cracks on it.'],
    menaced: ['"I\'ve heard that before."', 'Nothing. Not a flicker.'],
    woken: ['Their eyes open and find yours at once, clear and cold.', 'Their fists clench before their eyes are even open. Then they see you, and go still.'],
  },
};

const SLY: Partial<Record<Moment, string[]>> = {
  refuse: ['"No. Walk away."', 'They laugh. "You\'ll have to do better than that."', '"Let\'s not do anything we\'ll both regret."'],
  giveUp: ['They put their hands up and smile like it\'s nothing. "Sure, friend. Let\'s be reasonable."', '"Hey. Hey. No need for any of that. We can work something out."'],
  emptied: ['"There. All yours. No hard feelings, right?"', 'They hand it over a little too smoothly.'],
  beg: ['"You don\'t want this kind of heat. Trust me."', '"I\'ve got money at home. I can get you more."', '"We can both walk away from this."'],
  caught: ['"Worth a try, right?" They shrug, but their smile is gone.', '"Oh, that. I forgot about that."'],
  holdingOut: ['"That\'s everything, I swear." They\'re a very good liar.', '"Would I lie to you?"'],
  pinLie: ['They say it easily. Too easily?', '"That\'s it. Promise."'],
  letGo: ['"Pleasure doing business." They\'re gone fast.', "They walk off whistling, and you can't tell if it's an act."],
  torture: ['"Okay! Okay! Let\'s talk about this!" No more smiles.', 'The charm goes out of them all at once.'],
  menaced: ['"Easy, easy. I\'m cooperating here."'],
  hitYou: ['"Nothing personal."'],
  youMiss: ['"Ooh. Close."'],
};

const VICTIM: Partial<Record<Moment, string[]>> = {
  giveUpDown: [
    'They curl up on the ground with their arms over their head. "Stop! Please! Take it, take whatever you want!"',
    '"Okay! Okay!" they sob from the ground. "I give up. Just take it."',
    'They hold up a shaking hand from the sidewalk. "Please. Please. Enough."',
  ],
  refuse: ['"N-no. No. Leave me alone!" Their voice cracks, but they don\'t give it up.', 'They clutch their pockets and shake their head, over and over.', '"Get away from me!"'],
  refuseMug: ['"No. No!" They panic and lash out at you.', 'They freeze, then shove you and try to fight.'],
  caught: ['"I\'m sorry, I\'m sorry, I just— I need that one."', 'They start to cry. "Please. Not that. Please."'],
  allThere: ['"That\'s all of it, I swear. I swear!"', '"There\'s nothing else, I promise, look, look—" They turn their pockets inside out.'],
  holdingOut: ['"That\'s everything." They can\'t quite meet your eye.', '"That\'s all, that\'s all." They say it too fast.'],
  pinTruth: ["They're too scared to lie.", "They're crying as they say it."],
  pinLie: ['They say it fast.', 'Their eyes flick away as they say it.'],
  pinRefuse: ['They press their lips together and shake their head, terrified.', '"I can\'t... please, it\'s all I have in the bank."'],
  torture: [
    '"Stop! Please! I\'ll do anything!"',
    "They're sobbing now, and can't stop.",
    '"Please. Please. Why are you doing this?"',
    "They make a sound you'll hear later, trying to sleep.",
    '"Mom," they say, to no one. "Mom."',
  ],
  hitByYou: ['"Stop! Please, stop!"', '"Why are you doing this?"', 'They cover their head with their arms.', '"Help! Somebody help!" Nobody comes.'],
  menaced: ['They nod, fast, over and over.', '"I won\'t. I won\'t. I promise."', "They flinch as if you'd hit them."],
  woken: ["They come to, see you over them, and start to beg before their eyes are even focused.", 'Their eyes open. They see you, and they start to cry.'],
};

/** Candidate lines for a moment (empty: nothing to say). */
/** What they say or do, without lines for standing up when they're on the ground. */
export function voice(e: Encounter, m: Moment): string[] {
  let xs = voiceAll(e, m);
  // In their own home: no offers to go home for more money, no streets to look down.
  if (e.resident) {
    const ys = xs.filter((x) => !/money at home|Pleasure doing business/i.test(x)).map(indoors);
    xs = ys.length ? ys : xs.map(indoors);
  }
  const legs = e.them.broken.filter((p) => p.endsWith('leg')).length;
  // (A broken leg: nobody runs off on it.)
  const moves = /\b(run|runs|ran|scramble|scrambles|weave|weaves|stumble|stumbles|shuffle|shuffles|walk|walks|bolt|gone|vanish|back(s)? (away|out))\b/i;
  if (m === 'letGo' && legs) {
    const ys = xs.filter((x) => !moves.test(x) && !(e.them.down && /sit down/i.test(x)));
    return ys.length ? ys : [legs >= 2 ? (e.them.down ? 'They stay where they are, on the ground, and watch you go.' : 'They lean on their crutches and don\'t move until you\'re gone.') : e.them.down ? 'They drag themselves up on the good leg and limp away, looking back the whole way.' : 'They limp away as fast as the leg will let them, looking back the whole way.'];
  }
  if (!e.them.down) return xs;
  xs = xs.filter(Boolean);
  // (Let go from the ground: they get up before they go anywhere.)
  if (m === 'letGo') {
    const ys = xs.filter((x) => !moves.test(x) && !/sit down|on their feet/i.test(x));
    return ys.length ? ys : ['They scramble to their feet and run, and don\'t look back.'];
  }
  const ys = xs.filter((x) => !/on their feet|back(s)? away|walk(s)? (off|away)|step(s)? (back|aside)|stand(s)? over|look(s)? down at you/i.test(x));
  return ys.length ? ys : xs;
}
function voiceAll(e: Encounter, m: Moment): string[] {
  const p = e.person.personality;
  const g = groupOf(p);
  // In their own home, nobody begs to be let go home.
  const kind = e.resident ? { ...KIND[e.person.kind], beg: RESIDENT_BEG } : KIND[e.person.kind];
  const L = life(e);
  const fear = e.them.fear ?? 0;
  // (No blood in what they do unless they're actually bleeding.)
  const noBlood = (xs: string[]) => {
    const ys = e.them.bleeding > 0 ? xs : xs.filter((x) => !/blood/i.test(x));
    // (On the ground, nobody sways on their feet or backs away.)
    const zs = e.them.down ? ys.filter((x) => !/on their feet|back(s)? away|walk(s)? (off|away)|step (back|aside)|stand(s)? over|look(s)? down at you/i.test(x)) : ys;
    return zs.length ? zs : ys;
  };
  if (g === 'hothead' || g === 'proud' || g === 'hard') {
    // Scared enough, even the hard ones break (but they break bitter).
    if (m === 'beg' && fear >= 85) return noBlood([...(BRUTE[g].beg ?? []), ...kind.beg.slice(0, 1)]);
    return noBlood(BRUTE[g][m] ?? (m === 'giveUpDown' ? (BRUTE[g].giveUp ?? []) : m === 'letGo' ? kind.letGo : []));
  }
  if (g === 'sly') {
    if (m === 'beg' && fear >= 75) return [...kind.beg];
    return SLY[m] ?? VICTIM[m] ?? [];
  }
  // The scared: who they are comes through.
  switch (m) {
    case 'giveUp':
      return [
        ...kind.giveUp,
        ...(p === 'timid'
          ? ['They start crying before you\'ve finished. "Take it. Take it all."']
          : p === 'jumpy'
            ? ['"Alright, alright, alright!" Their hands fly up. Their eyes go everywhere.']
            : ['They breathe out and nod. "Alright. You win. Take it."']),
      ];
    case 'beg': {
      const extra: string[] = [];
      if (L.kid) extra.push('"I have a little girl. Please. She\'s six."', '"Please. My kid. I\'m all she\'s got."');
      if (L.rent) extra.push('"That\'s my rent. They\'ll put us out. Please."');
      if (L.insulin) extra.push('"I need the money for my insulin. Please, I need it."');
      if (L.name) extra.push(`"My name's ${L.name}. Please. My name's ${L.name}."`);
      if (fear < 50) extra.push('They watch you, breathing hard.', 'Their eyes keep going to the end of the street.');
      else extra.push('"Please," they keep saying. "Please, please."', "They're shaking so hard their teeth chatter.", "They won't look at you.");
      return [...kind.beg, ...extra];
    }
    case 'emptied': {
      // Only about what they actually had on them.
      const extra: string[] = [];
      if (L.wallet) extra.push('They hold the wallet out with both hands, like an offering.');
      if (L.cash && e.person.kind === 'civilian') extra.push('"That\'s everything. That\'s my whole paycheck."');
      if (L.id && e.person.kind === 'civilian') extra.push('"Please, can I keep my license? I need it for work."');
      if (L.phone) extra.push('"Please, my phone, it\'s got all my photos on it."');
      if (L.kid) extra.push('"Please, not the photo. You can have the rest. Not the photo."');
      return [...kind.emptied, ...extra];
    }
    case 'letGo':
      return kind.letGo;
    default:
      return VICTIM[m] ?? [];
  }
}

/**
 * How it sits with you afterwards, by how far gone you are (humanity lost):
 * still human, it's awful (and it costs you, in stress); cold, you make
 * excuses; heartless, nothing; past that, you enjoy it. `what`: 'mug',
 * 'beat' (left them broken), 'torture'. Returns lines and the stress it
 * adds (or takes away).
 */
export function guilt(e: Encounter, what: 'mug' | 'beat' | 'torture', lost: number): { lines: string[]; stress: number } {
  const L = life(e);
  const victim = !isBrute(e.person.personality);
  const who = L.name && L.sawName ? `${L.name}. It said so on the ${L.nameOn ?? 'card'}.` : e.person.kind === 'homeless' ? 'Someone with nothing.' : 'A person. Just a person.';
  if (lost >= 80) {
    return {
      lines: [what === 'torture' ? 'You replay their screaming as you walk away, and smile.' : 'You feel good. Better than you have in days.'],
      stress: -6,
    };
  }
  if (lost >= 62)
    return {
      lines: [oneOf(['You feel nothing at all.', 'Nothing. Not even the memory of feeling something.'])],
      stress: 0,
    };
  if (lost >= 32) {
    return {
      lines: [oneOf(["You feel almost nothing. That's what scares you, when you let it.", 'Somewhere, far off, something in you flinches. You ignore it.'])],
      stress: 2,
    };
  }
  if (lost >= 10) {
    return {
      lines: [
        oneOf([
          'You tell yourself they had it coming. You almost believe it.',
          "You tell yourself it's just how it is out here. Everyone does it.",
          "You don't let yourself look at them again.",
        ]),
      ],
      stress: victim ? 6 : 3,
    };
  }
  // Still human: it lands. (What you'd remember, from how it went.)
  const bled = (e.start?.blood ?? e.them.maxBlood) - e.them.blood > 150;
  const fled = e.result === 'they-fled' || e.result === 'you-fled';
  const beatLines = fled
    ? ['You can still feel every blow in your knuckles.', 'You keep seeing their face as you hit it.']
    : [...(bled ? ["You look at your knuckles. The blood on them isn't yours."] : []), "They were someone's kid. You left them lying there.", 'You keep seeing them lying there, not moving.'];
  const lines =
    what === 'torture'
      ? ["Your hands won't stop shaking. You can still feel it: the give, the sound they made.", `${who}`, 'You throw up in the gutter as you walk away.']
      : what === 'mug'
        ? [
            oneOf(['Your hands are shaking. You stuff them in your pockets, around their money.', 'You can still see their face. The way they looked at you.']),
            ...(L.sawKid ? ['There was a photo of a kid in their pocket. You try not to think about it.'] : L.name && L.sawName ? [who] : []),
          ]
        : [
            oneOf(beatLines),
            ...(L.name && L.sawName ? [who] : []),
          ];
  return { lines, stress: victim ? 14 : 7 };
}

const oneOf = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
