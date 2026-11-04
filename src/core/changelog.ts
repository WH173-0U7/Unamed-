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
    v: '0.64',
    date: 'Nov 4',
    items: [
      'New skill: Speech. It starts at 1 like the rest and grows by talking (faster when the lie works).',
      'Stopped by the police, you can now try to talk your way out: a good story and they leave without searching you; a bad one and they search harder, bag and all. Harder when they’re after you, with a weapon showing, a mask on, or drink in you.',
      'Following someone and they’re getting suspicious? “Act natural” to cover for yourself, or make it worse.',
      'A clerk who doesn’t think your stolen ID is you can sometimes be talked round, and Speech helps a little when you’re telling someone to hand it over.',
    ],
  },
  {
    v: '0.63',
    date: 'Nov 4',
    items: [
      'A criminal record, on the You sheet: how many times you’ve been arrested, and every charge (×how many). It belongs to this character: a new one starts clean.',
      'Real charges now: possession of stolen property, possession of a controlled substance, carrying an illegal weapon (a switchblade, a butterfly knife or a push dagger is an arrest on its own), resisting arrest if they catch you running, and assault if you’re wanted badly enough that someone picks you out.',
      'When the police stop you, what happens stays on the screen until you tap “Go on”, instead of vanishing after a few seconds.',
    ],
  },
  {
    v: '0.62',
    date: 'Nov 4',
    items: ['The gun store is closed for now: it’s off the map until guns are ready to come into the game.'],
  },
  {
    v: '0.61',
    date: 'Nov 4',
    items: [
      'New place: Ironside Firearms (10 to 7, Sundays 12 to 5). A compact 9mm pistol ($480), a .38 revolver ($420), a pump shotgun ($350), ammunition, and a holster ($35) that keeps a handgun hidden under a jacket, coat or hoodie.',
      'Like a real gun shop: your own ID only (a stolen one gets you shown the door), and a background check for every gun. If you’ve ever been charged, it comes back denied.',
      'Guns come unloaded: load them from a box of rounds in Pockets. In a fight you can shoot, reload (it takes a turn) or hit someone with it. People still miss up close; a hit bleeds badly, can break bones or puncture a lung, and to the head is usually the end.',
      'Every shot is loud and gets called in: the police heat climbs fast. A gun found on you is serious, and guns are hard to hide and alarming if seen.',
    ],
  },
  {
    v: '0.60',
    date: 'Nov 4',
    items: [
      'ER triage: lost a lot of blood, you’re taken straight in; bleeding at all, they move you up (an hour, not four). Waiting in the chair no longer counts as resting, and a cut still gets stitched (and paid for) even if it stopped bleeding while you waited.',
      'A broken nose can only be set once. Dying in the ER, nobody goes through your pockets.',
      'Reloading while you’re knocked out no longer skips coming round: the screen stays off until you shake (or tap).',
      'Fixes behind the scenes: the bank can’t be fed nonsense amounts; tapping Continue twice can’t start two games.',
    ],
  },
  {
    v: '0.59',
    date: 'Nov 4',
    items: [
      'Fight screen on small phones and in landscape: opening the card or your status no longer pushes your options off the screen (they scroll inside instead).',
      'Shops no longer cover your injuries and cash when you have a lot of them (the ER especially), in portrait or landscape.',
      'When they’re out cold, the fight says so (“They’re out cold”, not “Unconscious”) and opens on searching them.',
      'What’s new after a long time away shows the latest five updates, not thirty screens. The knockout hint is easier to read, the log no longer shows a half-cut line under its header, and opening hours read the same way for every place.',
      'Clearer bank messages (“Balance too low”, “Nothing in the account”).',
    ],
  },
  {
    v: '0.58',
    date: 'Nov 4',
    items: [
      'Every weapon now has two stats of its own, shown in Pockets and at the pawn shop: how easy it is to hide, and how much attention it draws if someone sees it. A pocket knife or pepper spray barely registers; a kitchen knife, a push dagger or a shiv is alarming even half seen.',
      'What people and the police make of you depends on both: what shows, and how frightening what shows is.',
      'New at the pawn shop: a belt sheath ($18), which keeps a knife up to a hunting knife ready on your belt, hidden under a jacket, coat or hoodie but on show under a T-shirt; and an ankle sheath ($28) for a small blade, which nobody sees, but which takes a turn to get out in a fight.',
    ],
  },
  {
    v: '0.57',
    date: 'Nov 3',
    items: [
      'Carrying weapons shows. Every pocket and bag now has a hide rating (in Pockets, next to each one): a backpack or a coat’s inside pocket hides well, a jacket some, a hoodie pouch or cargo pocket shows a bulge, trackie pockets show everything. Big blades and bottles are harder to hide than a folder or a shiv.',
      'Each weapon says how much of it shows (hidden, a slight bulge, the shape of it, plain to see), and Pockets tells you if anyone looking can see what you’re carrying.',
      'If they can: people notice you sooner while you watch them, they scare easier when you walk up, and a patrol might stop you even with no heat on you.',
      'A pat-down is your clothes: police only go through your bag if they’ve reason to. But a weapon in your bag takes a turn to dig out in a fight.',
      'New “Move” button in Pockets: put something in another pocket or bag. New weapons go where they’re best hidden. The pawn shop’s clothes and bags say how well they hide a weapon.',
    ],
  },
  {
    v: '0.56',
    date: 'Nov 3',
    items: [
      'Clothes and accessories cost what they really would. Gas station: sunglasses $20, a cap $22, a beanie $16, a ski mask $18, a bandana $8. Pawn shop (all second-hand): a coat $55, a puffer jacket $75, a hoodie $25, cargo pants $30, a backpack $35, a shoulder bag $25, a fanny pack $12, a decent used pair of sunglasses $25.',
    ],
  },
  {
    v: '0.55',
    date: 'Nov 3',
    items: [
      'Knives come in kinds now, each with its own description in your pockets: kitchen knife, steak knife, pocket knife, lockback folder, assisted-opening knife, switchblade, butterfly knife, karambit, hunting knife, serrated combat knife, straight razor, push dagger and shiv.',
      'They handle differently. Folding knives have to be opened first: a switchblade or a spring-assisted knife snaps open as you bring it up, a thumb-stud folder only if you’re practised, a pocket knife or razor takes both hands and your turn, and a butterfly knife bites clumsy fingers.',
      'Serrated blades and razors make people bleed worse; shivs and push daggers stab rather than slash; a kitchen knife has no guard, so a hard stab can slide your hand onto the blade.',
      'Who carries what fits who they are (a homeless man’s kitchen knife, a commuter’s little folder, a hard case’s karambit). The pawn shop sells a few legal ones: pocket knife, lockback, assisted-opening and hunting knife.',
    ],
  },
  {
    v: '0.54',
    date: 'Nov 3',
    items: [
      'Knocked out by a beating, you now always wake up concussed, and whoever did it may have gone through your pockets (a junkie nearly always will; most people only defending themselves won’t). What they took is on them, if you ever run into them again.',
      'A needle that hadn’t kicked in yet still does after the fight, even if you ran.',
      'Coming round: if shaking doesn’t work, a tap does after a few seconds. Shakes are easier to pick up.',
      'ER: stitches on a cut brow or lip are paid once (and a stitched brow heals to a faint line); casts are priced for what’s still broken after the wait.',
      'Fixes: typing a big amount at the bank no longer freezes the game; you no longer learn someone’s race without seeing them; the Records Office wait really takes an hour.',
    ],
  },
  {
    v: '0.53',
    date: 'Nov 3',
    items: [
      'You can smash a bottle for an edge: “Smash the bottle” in a fight. It doesn’t always break (glass is tougher than in films), and now and then it opens your hand. Broken, it cuts: +6 damage, and it makes people bleed.',
      'Drunks with a bottle sometimes smash theirs too before they come at you.',
    ],
  },
  {
    v: '0.52',
    date: 'Nov 3',
    items: [
      'New place: County General ER, open all hours. Stitches ($80) stop bleeding; they’ll set a broken nose ($60) or put a broken arm or leg in a cast ($150 each), both healing in half the time; a chest tube for a punctured lung ($250); and a transfusion when you’ve lost too much blood ($200).',
      'Self-pay, cash at the window, and first you wait 2 to 4 hours, and you keep bleeding while you sit there. Bleeding badly or unable to breathe, they take you straight in.',
      'They can’t do anything for broken ribs or a concussion except tell you to rest.',
    ],
  },
  {
    v: '0.51',
    date: 'Nov 3',
    items: [
      'Knocked out, the screen switches off like an old TV (the picture squeezes to a line, then a dot) and the cracks stay on the glass. Shake your phone to bring the power button back and come round. (On a computer, or if your phone won’t share its motion, you can tap instead.)',
      'Bleeding from the head in a fight, blood seeps in over the top of the screen and runs down, on the side the wound is on, like it’s running into your eyes. The worse the bleeding, the more of it.',
      'Blood on the glass is wetter: heavy splashes and fresh cuts can run, creeping down the screen and catching as they go.',
      'At the bank you can type in an exact amount to deposit or withdraw.',
    ],
  },
  {
    v: '0.50',
    date: 'Nov 3',
    items: [
      'You can’t tell someone’s race or sex from across the street at a glance any more. The person button only says what they are (a civilian, a drunk…).',
      'Tap them, then “Get a look at them”. From across the street you might make out a man or a woman by the walk; you usually need to get closer to see their face. It’s harder at night and in the rain.',
      'Face to face (a fight, a mugging), you see exactly who they are.',
    ],
  },
  {
    v: '0.49',
    date: 'Nov 3',
    items: [
      'Your screen cracks as you get knocked silly: a hairline or two when you’re rattled, a spreading web when you’re wobbly, and three breaks with the edges going dark when you’re about to go out. The cracks fade as you come round, and break differently every fight.',
      'Wiping blood off now smears it: one pass leaves a streaky red film, and it takes another pass or two to get it properly clean.',
    ],
  },
  {
    v: '0.48',
    date: 'Nov 3',
    items: [
      'New in fights: an Awake bar, for you and for them. Punches, kicks, stomps and clubs knock it down (blows to the head the most); when it runs out, you’re knocked out. It creeps back up between blows.',
      'Blood is only lost to real wounds now: knives, broken glass, needles, a broken nose, a split brow, a punctured lung, and whatever keeps bleeding. A punch to the ribs no longer costs you half a litre.',
      'Out cold isn’t the end of it: choked out, people come round in seconds; punched out, within a minute or so. Keep beating someone who’s already out and it can kill them, wound or no wound.',
    ],
  },
  {
    v: '0.47',
    date: 'Nov 3',
    items: ['Menus no longer scroll sideways: at the bank (and anywhere else), buttons that don’t fit beside their text drop onto a line of their own.'],
  },
  {
    v: '0.46',
    date: 'Nov 3',
    items: [
      'Realism pass. Pepper spray now blinds for the rest of the fight, not a couple of turns.',
      'Needles: almost every syringe people carry is already used and empty, and a loaded one takes a minute to kick in instead of dropping someone on the spot.',
      'A bottle is a club now, not a blade: it bruises, it doesn’t slice. Drunks carry them less.',
      'Someone knocked out by a punch comes round on their own, usually within a minute. Knocked out yourself, you wake a minute or two later (bleeding out is still hours).',
      'Painkillers ease pain and stress but no longer heal concussions. Iron tablets aren’t sold any more (they take weeks). A splint sets a break so it heals at the normal speed. Coke lasts about 40 minutes and doesn’t fix your head.',
      'Booze: a swig of whiskey or vodka hits harder than a beer, and drinking no longer warms you up (it only feels that way).',
      'Strangers can’t sense your past any more, only a little in your eyes; a blade scares them when you show it, not while it’s in your pocket.',
      'Masks are sold at the gas station now, not the pawn shop. The fence won’t touch drugs or needles. Caught with stolen cards, you get charged.',
      'Fewer movie lines from the people you fight. Beaten to death without a wound, someone doesn’t “bleed out”.',
    ],
  },
  {
    v: '0.45',
    date: 'Nov 3',
    items: ['Removed burning someone with a lighter or matches as a torture option: nobody really does that on the street.'],
  },
  {
    v: '0.44',
    date: 'Nov 3',
    items: [
      'You have a name now. Take it to the new City Records Office (weekdays 9 to 4) and they’ll make you a State ID for $30.',
      'With your own ID you can open an account at the bank: deposit your cash where nobody can mug you for it, and take out $20, $100 or the lot. (It’s gone if you die.)',
      'The pawn shop now checks ID for buying as well as selling. Your own ID always works; a stolen one might get you thrown out.',
      'New Corner Liquors (10 AM to 2 AM): beer, wine, whiskey and vodka, and they ID everyone. Booze is no longer sold at the gas station.',
      'Fights read the way you fight: every move gets better the more you use it. Clumsy at first, then ordinary, then sharp, and the log tells you when one comes naturally.',
      'Fixed: a scar on your arm said it was on your face. Passing out drunk now passes time properly. Smoother frame rate with film grain on.',
    ],
  },
  {
    v: '0.43',
    date: 'Nov 3',
    items: [
      'Caffeine: hot coffee (about 95 mg) and a new energy drink (160 mg) at the gas station, and caffeine pills (200 mg) at the pharmacy.',
      'It works like the real thing: it kicks in over about 45 minutes, and half of it leaves your body every 5 hours of real time, so cups add up.',
      'Alert, you land and dodge a little better; past about 400 mg you’re Jittery (your hands shake, you miss more, stress builds faster); past 600, your heart is racing.',
      'It has its own look: a clean, bright clarity, turning into a fine tremor when it’s too much. The You sheet shows how much is in you and when it’ll wear off.',
    ],
  },
  {
    v: '0.42',
    date: 'Nov 3',
    items: [
      'Fight screen rebuilt for small phones: the options never slide over the log any more, whatever the lettering; the log keeps its “earlier lines” count in view.',
      'When someone dies, the last blows stay in the log.',
      'Shops and Pockets show what just happened inside them (buying, testing a syringe, drinking), not hidden behind.',
      'Landscape shops use the whole height; Pockets rows with three buttons wrap neatly; greyed-out buttons say why.',
      'Smaller fixes: “ml” stays with its number, Settings fits on small phones, bigger buttons, a softer colour fringe on text, gentler drunk and tranq sway.',
    ],
  },
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
      'One Violence tab in a fight, in sections (Strikes, Weapons, On the ground, Torture); Run and Catch your breath are buttons under the options.',
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
