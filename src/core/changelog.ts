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
    v: '0.92',
    date: 'Nov 4',
    items: [
      'Writing pass on what people say and how they’re described: smoother lines, US spelling, and a few lines that didn’t fit the moment (someone who hit you first asking if you hit people for a living).',
    ],
  },
  {
    v: '0.91',
    date: 'Nov 4',
    items: [
      'Saves: the game open in a second tab can no longer write over a newer save, so it can’t undo a death or an arrest. That tab goes back to the menu, and Continue picks up from the newest save.',
      'Quitting to the menu saves first, so whatever finished while you were paused stays finished. It can’t be rolled again by quitting.',
      'Closing the app on the death screen: it’s still there next time, not skipped.',
      'A damaged save no longer fails silently: the game tries the one before it, or tells you. The backup can’t be overwritten by a broken save, or by a different game.',
    ],
  },
  {
    v: '0.90',
    date: 'Nov 4',
    items: [
      'Pepper spray: opening with it needs a free hand, and a can in your bag takes a moment to dig out (they see it coming). An empty can just hisses, for you and for them.',
      'Losing a knife or emptying a can mid-fight no longer mixes up which of your other things are out and which are still in the bag.',
      'The liquor store keeps a stolen ID they catch you with. The fence won’t pay for a card that’s been stopped, and now buys folding knives, switchblades, razors and daggers too.',
      'Passing out for hours (drink, a needle) with someone lying there: they’re gone when you come to.',
      'Small text fixes: cigarettes found in a car, a single loose cigarette, and names in the “Gone:” list after you’re robbed.',
    ],
  },
  {
    v: '0.89',
    date: 'Nov 4',
    items: [
      'Hours that go by (resting, a night in a cell, County, out cold, an overdose) now move everything on with them. A high, the meth, the drink, caffeine, a cigarette and cravings wear off, or come on, as they would. No more coming out of 36 hours in County exactly as high as you went in.',
      'Bleeding badly outside a fight is far more dangerous: heavy or severe bleeding left alone can kill you within a couple of hours. Resting and pressing on it doesn’t always stop it.',
      'If you’ve lost nearly all your blood, nobody finds you in time. When someone does find you, you wake up able to stand, not still on the edge of passing out. Lying out in the cold makes you colder.',
      'A high that ran out during a fight isn’t renewed for free at the end. Meth from a needle in a fight works the same as injecting it yourself.',
      'Overdoses: heroin can kill, fentanyl from a needle in a fight can kill, and drink or downers on top make it likelier.',
      'Caffeine pills count what’s still kicking in: you can’t swallow a whole bottle before the first ones hit. The drink card says blackout at 90, which is where it really happens.',
      'The ER takes you straight in when you’re close to passing out. Setting the phone’s clock back can’t make a high last a day.',
    ],
  },
  {
    v: '0.88',
    date: 'Nov 4',
    items: [
      'Fight text: knife work and misses against someone on the ground no longer read as if they’re standing (“you step off the line”, “they step back”). Pepper spraying someone on the ground, they curl up instead of staggering back.',
    ],
  },
  {
    v: '0.87',
    date: 'Nov 4',
    items: [
      'Chases: someone who breaks away mid-fight gets a proper head start and can lose you in traffic or a doorway. Bleeding, they slow down, but not to a crawl. Run out of breath and you have to stop. Getting up off the ground to give chase can fail.',
      'If they pass out while running, the chase ends with them down on the sidewalk. If you collapse while chasing, nobody “beat” you and nobody robs you. Blood you lose and drugs that kick in during a chase now stay with you afterwards.',
      'Someone with a broken leg limps away, and you can catch them. They don’t sprint off.',
      'When someone spots you following and gets away, the closing note says why they noticed you. Stopping a chase says you let them go.',
      'Patting someone down lists the weapons they’re carrying, too.',
      'Fixed: things robbed off you by someone already carrying your old things could vanish for good. Now they’re on that person.',
      'Messages that come in while Where to? or a police stop is open now show when it closes, not never. Mid-fight they go in the fight log. What happened while you were knocked out isn’t lost if you pause right as you come to.',
      'No more opening You during the moment after a knockout. No drinking alcohol or injecting inside shops. A new character no longer “knows” what an earlier one did to someone. Shops open at the top each time you walk in. Snow, not rain, when you try to light something in the snow.',
    ],
  },
  {
    v: '0.86',
    date: 'Nov 4',
    items: [
      'Things you can only do once now go away once you’ve done them: patting someone down, “Don’t even think about it”, “Is that everything?” and holding the blade to their eye. Cutting a cheek works twice: one each side.',
      'Patting someone down finds everything, so after it there’s no “Is that everything?”.',
      'While following someone, what you’ve already found out (their build, what they’re carrying, how aware they are, their face, what kind of person they are) drops off the list instead of sitting there greyed out.',
    ],
  },
  {
    v: '0.85',
    date: 'Nov 4',
    items: [
      'When someone runs from you (they know you, they spot you following, or they break away mid-fight), they no longer just vanish. You can chase them, or let them go.',
      'A chase is your Agility against how fast they are: their build, whether they’re drunk or high, hurt, bleeding or out of breath. You get tired too, and no one gets their breath back while running. Ahead of you, they can duck round a corner and be gone.',
      'Catch them and you drag them down or pin them against a wall, and it’s on. Running after people trains your Agility.',
    ],
  },
  {
    v: '0.84',
    date: 'Nov 4',
    items: [
      'A message while someone’s across the street now sits under their card, not on top of it, and it gets out of the way when you go up to them.',
      'Walking into a shop starts at the top of its list, not wherever you were in the last one. In landscape, what just happened shows its newest line.',
      'In the moment after a fight ends, the buttons fade out instead of sitting there doing nothing. On small phones the fight log keeps its newest line in view.',
      'Fight buttons no longer break words in half.',
      'Waiting outside the courthouse with a knife: when it opens, the metal detector stops you at the door, rather than letting you in and then turning you away.',
      'Police stops: the patrol car pulls up before you hear what they noticed, and the choices stay on screen instead of scrolling away (side by side in landscape).',
      'Small wording fixes: what you remember before a knockout, people who see you and run, and the Stress card.',
    ],
  },
  {
    v: '0.83',
    date: 'Nov 4',
    items: [
      'You can no longer walk off (or open Pockets) in the moment after a fight ends: a knockout is a knockout, and you get robbed like you should. Quitting to the menu in that moment can’t black out your next game any more.',
      'When someone gets away, the message shows how they got away once, not your own thoughts twice. Reloading or pausing right as a fight ends keeps the full message, and messages don’t fade while the game is paused.',
      'Court: you can only have your hearing on the day. Turn up early and the clerk tells you to come back then.',
      'Standing outside a locked shop in the rain gets you cold. Waiting at the door when it opens, you go in (mask down, knife away, cigarette out); at closing time they show you out.',
      'Caught asleep in a stolen car, the police tell you to step out of the vehicle, not ask where you’re walking. A night in a cell puts your cigarette out and warms you up. Turning yourself in while bleeding, they take you to the ER first.',
      'Landscape shops keep your place in the list after you buy something. “No room” says when you’d need a bag. Cash in loot lists has commas.',
    ],
  },
  {
    v: '0.82',
    date: 'Nov 4',
    items: [
      'Fight fixes: pepper spray in your bag works again (dig it out, then spray); with both hands full, weapons you’d need a hand for are greyed out instead of doing nothing; a gun at the bottom of your bag can’t be flashed in a mugging or used to pistol-whip; you can take out a second knife of the same kind.',
      'Drawing from an ankle sheath says so. Smashing, shooting or punching someone already on the ground reads like they’re on the ground.',
      'Fight text: no “they lie there” while they’re standing, no “dazed” on someone out cold, no doubled “unconscious” lines, and how bad a cut reads matches how badly it bleeds. “What are they carrying?” no longer mistakes a baggie for a bag.',
      'Knocked out by a drug, you’re under for an hour or more, not a minute. A bluff that works calms them, and the warning signs come again if they get suspicious again.',
      'More variety in the lines you see most (missed kicks, running away, letting them go, getting up), and torture lines no longer scream twice.',
    ],
  },
  {
    v: '0.81',
    date: 'Nov 4',
    items: [
      'Following someone: they give clear signs before they run (a look back, then speeding up and checking behind them: “any more and they’ll run”). The Noticed bar is what fills up.',
      'When they spot you and get away, the message says so and why (you were right on their heels, your clothes stand out, they could see what you’re carrying, they were watching for it), and it stays up long enough to read.',
      'Someone who recognises you and runs as you approach: the message says they remember you from before.',
    ],
  },
  {
    v: '0.80',
    date: 'Nov 4',
    items: [
      'Holding your phone sideways, shops use the whole screen: the place and what just happened on the left, what’s for sale on the right, so you can see twice as much at once. The clock stays visible too.',
      'Sideways in a fight, the screen moves up into the empty space at the top, so more of your options fit.',
    ],
  },
  {
    v: '0.79',
    date: 'Nov 4',
    items: [
      'Fight buttons with long labels no longer run into each other, and on small phones the fight screen gives its room to the log and your options.',
      'The fight log fades at the bottom when there’s more to read, and stays on your latest turn when the panel above it opens or closes.',
      'In You, what’s hurting you (bleeding, breaks) comes first, before stress and the rest; meters for things doing you harm are amber.',
      'Opening hours are always shown on their own line in a shop. A choice you can’t afford (bail) looks greyed out. Sheets fade at the bottom when they scroll.',
      'Money over $999 has a comma; pocket headings, the Drop button and the settings pickers are tidier on small phones; “Tap to wake up” is easier to see.',
    ],
  },
  {
    v: '0.78',
    date: 'Nov 4',
    items: [
      'The blow that ends a fight lands before the screen changes: a beat to see it, and when you’re knocked out you’re told the last thing you remember.',
      'Fights have sound now: a dull thud for every blow, a crack when something breaks, and a deep thunk when you go out.',
      'Taps meant for the fight no longer skip the death screen or start a lurk the moment a fight ends.',
      'Something happening mid-fight goes in the fight log instead of over it; with someone across the street, notes sit under them; notes fade out instead of blinking off.',
      'The fight log shows your whole last turn from its first line. When the police stop you, they say why, and what happened while you waited stays on screen.',
      'A shop button only chimes when it worked; when it didn’t, it buzzes. Knocked out on a phone that won’t share its motion, tap anywhere to wake up.',
      'Smaller things: cans and coffee are pocket-sized now (not paper), “Lurk again” starts over for a new character, and the Blood card says how much you’ve lost.',
    ],
  },
  {
    v: '0.77',
    date: 'Nov 4',
    items: [
      'More realistic injuries: a knife cuts but doesn’t break bones or concuss; legs only break from a kick or a stomp; a punch to the body winds and drops someone instead of knocking them out; a needle barely bleeds; breaking a finger or stomping a hand doesn’t cost blood.',
      '“What are they carrying?” only tells you what you can actually see. Wallets, baggies and folded knives are in their pockets.',
      'Court reads like court: you plead guilty through your lawyer, or the prosecutor drops it; probation lasts as long as the You sheet says.',
      'American English throughout (sidewalk, come to, pant leg), smoother fight text (no doubled words or spaces, one bleeding line per blow, more variety in the lines you see most), and hard cases only tell you to get up when you’re down.',
      'Knife buttons say Stab or Slash depending on the blade. Status cards read “Stress: on edge” and “Caffeine: …”.',
    ],
  },
  {
    v: '0.76',
    date: 'Nov 4',
    items: [
      'Arrested between midnight and 4 AM, your court date was sometimes the same afternoon. It’s always at least a day away now.',
      'Arrested while bleeding, the police take you to the ER first and get it closed, instead of leaving you to bleed in the cell.',
      'A closed shop is just a locked door: you don’t go in, warm up, put your knife away or stub out your cigarette.',
      'After an arrest, the bail and jail buttons stay on screen under the text, so you don’t have to scroll to find them.',
    ],
  },
  {
    v: '0.75',
    date: 'Nov 4',
    items: [
      'Bug fixes for police and court: arrested again while out on bail, the bail is revoked and you’re held; paying bail always gives you a fresh court date; a warrant still counts if you run and get caught; turning yourself in goes on your record.',
      'When the police don’t look in your bag, they really don’t. Caught asleep in a stolen car, you’re arrested. The courthouse metal detector turns you away with a weapon on you.',
      'Fights: a disarm always takes what’s actually in your hand, and only from someone able to; a folding knife opens when you take it out; you can’t take out a weapon with both hands full; a smashed bottle stays in your hand; “Act natural” works again.',
      'Fight text: no stepping and feinting while you’re on the floor, no screams from someone out cold, and a missed knife swing no longer reads as a missed punch. Knocked out by a drug isn’t a concussion.',
    ],
  },
  {
    v: '0.74',
    date: 'Nov 4',
    items: [
      'Getting charged means a court case now. After the night in the cell, bail is set by the charges and your record: pay it (cash, then your bank) and walk out with a court date, or wait in County for the hearing.',
      'New place: the County Courthouse, weekdays 9 to 4. Show up and the judge decides: dropped, a fine, probation, or days in jail. Your record counts against you; Speech counts for you. You get your bail back for showing up.',
      'Miss your date and there’s a warrant: your bail is gone, the police are hotter on you, and any stop ends in cuffs. Turn yourself in at the courthouse to clear it.',
      'On probation, any new charge means no bail: you’re held in County. Your case, court date and warrant show under Criminal record in You.',
    ],
  },
  {
    v: '0.73',
    date: 'Nov 4',
    items: [
      'Car keys are good for something now. On the street, “Find the car” in Pockets: press the fob and, if it’s parked nearby, the car chirps and flashes.',
      'Then you can go through it (the glovebox, the console, the back seat: loose change, cash, a laptop, a knife, smokes; sometimes the alarm goes off), sleep in it (warm, dry and out of sight), or sell it to the fence for a few hundred dollars.',
      'But owners report a stolen car fast: after about three hours it’s gone or the plate is hot, the fence won’t touch it, and sleeping in a reported car can end with a baton tapping on the window.',
    ],
  },
  {
    v: '0.72',
    date: 'Nov 4',
    items: [
      'Addiction. Cigarettes, drink, caffeine, heroin and fentanyl, meth and coke, and tranquilizers all build a habit as you use them (it fades slowly if you stay off). The You sheet shows how hooked you are on each.',
      'Hooked and without it, withdrawal comes on its own real clock: a couple of hours for nicotine, the best part of a day for meth or coke. Each is its own thing: irritable for a smoke, a headache off caffeine, the shakes off drink, dope sick off heroin (weak, aching, sick), the crash off stimulants. It makes you worse in a fight and keeps your stress from settling.',
      'Off drink or downers when you’re badly hooked, you can have a seizure on the street.',
      'Using again ends it at once and hooks you deeper; or ride it out over a day or a few. Withdrawal has its own look: the colour drains to a sick grey-green, a cold sweat at the edges of your sight, and a fine tremor.',
    ],
  },
  {
    v: '0.71',
    date: 'Nov 4',
    items: [
      'Weapons can be held: in Pockets, “Right hand” or “Left hand” takes one out, and “Put away” puts it back. In a fight you can take one out or put it away (each takes a turn), and using a weapon puts it in your hand. Your left hand is clumsier with it.',
      'A knife in your hand changes things: “Give it up” works better and says so, threats land harder, and torture offers holding it to their eye or cutting their cheek. Mugging with a blade, you take it out and show it. But a hard case might grab your wrist and take it off you.',
      'Everyone can see what’s in your hand. You put it away before you walk into a shop, and if the police stop you holding it, that’s an arrest for brandishing a weapon, no talking your way out.',
      'Stamping on someone’s hand is only offered when they’re already on the floor.',
    ],
  },
  {
    v: '0.70',
    date: 'Nov 4',
    items: [
      'Snow, in winter (on your device’s calendar: most likely December to February): flurries, snow and heavy snow. Flakes drift down over the street at different depths, now and then one lands on the glass as a little crystal and melts into a drop, and in heavy snow frost creeps in from the corners. Snow chills you faster than rain, and makes a fire harder to get going.',
      'The screen starts clean: dust no longer settles on it by itself. Dirt and grit only land on it when you hit the ground (in a fight, or tackled by the police), and a wipe or two takes it off. The old dust is cleared once.',
      'Scars, missing teeth and bruises aren’t warnings any more: they’ve moved to a quiet, greyed “Marks and scars” card on the You sheet, and off the red list under your blood bar.',
      'Cigarettes can be moved from one pack into another (“Into another pack”), up to the 20 a pack really holds. Pockets shows each pack as “12 of 20”.',
    ],
  },
  {
    v: '0.69',
    date: 'Nov 4',
    items: [
      'Tapping a button in a shop or in Pockets now shows what it did: the row glows, and a label floats up from the button (“+ Cigarettes −$9”, “→ Inside pocket”, “+$20 in the bank”, “Dropped”). The Pockets tab bounces when you’ve got something new, and your cash pulses when it changes.',
      'If a tap did nothing (no room, can’t be done), the button gives a short shake instead, and the note says why.',
    ],
  },
  {
    v: '0.68',
    date: 'Nov 4',
    items: [
      'The You sheet now has a Status section at the top: every state you’re in gets its own card and meter, with what it’s doing to you and when it wears off. Stress (on edge, stressed, panicking), drink, a high, being wired, caffeine, cold, and a cigarette burning.',
      'Injuries stay in their own Condition section underneath. Fixed two out-of-date cards: painkillers don’t clear a concussion, and being wired wears off on its own clock.',
    ],
  },
  {
    v: '0.67',
    date: 'Nov 4',
    items: ['Shops won’t sell you what you’ve already got: clothes and a bag you’re wearing, a cap, mask or shades you’ve got on, a sheath, or a knife of that kind say “Wearing it” or “You have one”. Things that get used up (smokes, drink, coffee, medicine) you can always buy more of.'],
  },
  {
    v: '0.66',
    date: 'Nov 4',
    items: [
      'Wiping blood smears it properly now: more of it is pushed along with your finger (it piles up where the wipe ends), it leaves a rusty film with the streaks of your fingertips in it, and it takes a few passes to get clean.',
      'Smears look more like the real thing: see-through and rust-coloured where thin, dark crimson where thick, with a darker tide line where the edges dry.',
    ],
  },
  {
    v: '0.65',
    date: 'Nov 4',
    items: ['Hitting someone who’s out cold no longer has them gasping, spitting, coughing, clutching, curling up or covering up. Their body reacts (blood at the lips, vomit running from the mouth, a tooth falling from a slack jaw); they don’t.'],
  },
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
      'A criminal record, on the You sheet: how many times you’ve been arrested, and every charge (and how many times). It belongs to this character: a new one starts clean.',
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
      'Reloading while you’re knocked out no longer skips coming to: the screen stays off until you shake (or tap).',
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
      'Carrying weapons shows. Every pocket and bag now has a hide rating (in Pockets, next to each one): a backpack or a coat’s inside pocket hides well, a jacket some, a hoodie pouch or cargo pocket shows a bulge, track pants pockets show everything. Big blades and bottles are harder to hide than a folder or a shiv.',
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
      'Coming to: if shaking doesn’t work, a tap does after a few seconds. Shakes are easier to pick up.',
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
      'Knocked out, the screen switches off like an old TV (the picture squeezes to a line, then a dot) and the cracks stay on the glass. Shake your phone to bring the power button back and come to. (On a computer, or if your phone won’t share its motion, you can tap instead.)',
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
      'Your screen cracks as you get knocked silly: a hairline or two when you’re rattled, a spreading web when you’re wobbly, and three breaks with the edges going dark when you’re about to go out. The cracks fade as you come to, and break differently every fight.',
      'Wiping blood off now smears it: one pass leaves a streaky red film, and it takes another pass or two to get it properly clean.',
    ],
  },
  {
    v: '0.48',
    date: 'Nov 3',
    items: [
      'New in fights: an Awake bar, for you and for them. Punches, kicks, stomps and clubs knock it down (blows to the head the most); when it runs out, you’re knocked out. It creeps back up between blows.',
      'Blood is only lost to real wounds now: knives, broken glass, needles, a broken nose, a split brow, a punctured lung, and whatever keeps bleeding. A punch to the ribs no longer costs you half a litre.',
      'Out cold isn’t the end of it: choked out, people come to in seconds; punched out, within a minute or so. Keep beating someone who’s already out and it can kill them, wound or no wound.',
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
      'Someone knocked out by a punch comes to on their own, usually within a minute. Knocked out yourself, you wake a minute or two later (bleeding out is still hours).',
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
