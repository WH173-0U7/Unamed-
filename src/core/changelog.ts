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
    v: '2.66',
    date: 'Nov 8',
    items: [
      'Pickpocketing is much harder once someone’s onto you: the more they’ve noticed, the worse your odds (the option says so).',
      'Choking, grappling or smashing someone who’s given up counts as attacking them, the same as hitting them.',
      'A quick double-tap on Wear or Put on no longer skips the warning about leaving things behind.',
    ],
  },
  {
    v: '2.65',
    date: 'Nov 8',
    items: [
      'Escaping from prison no longer leaves a police stop on the screen that could arrest you again on the spot.',
      'Map street names and landmarks are bigger and easy to read; a few labels moved so they don’t overlap.',
      'In a fight or encounter: the fear level shows when you open the status, more of the threaten list fits on small phones, and the Search tab’s count isn’t cut off.',
      'Waking up after being knocked out, the message no longer covers the Lurk button.',
      'Two phones or two cards in the threaten list now say which is which; pickpocket options come right after Follow.',
      'Long sentences are said in years (“28 years”), not hundreds of months.',
      'Small tidy-ups: Pockets buttons line up and “In the rain” is on its own line, greyed-out buttons are easier to read, shop descriptions show in full, and shop lists don’t jiggle sideways.',
    ],
  },
  {
    v: '2.64',
    date: 'Nov 8',
    items: [
      'Your own phone, taken off you while you were out cold and got back, is still yours and unlocked (it could come back locked).',
      'A second set of keys to someone’s car finds the same car, not another one to sell.',
      'Bail you’re handed back but can’t fit in your pockets goes toward your fine, instead of you being told you can’t pay it.',
      'A tip-off about who has your things now points at someone who still has them.',
      'The rain jacket’s description matches what it does: it keeps you dry and warm in the rain.',
    ],
  },
  {
    v: '2.63',
    date: 'Nov 8',
    items: [
      'Someone with both arms broken no longer “turns out their pockets”: you go through them yourself, and they can’t hold anything back.',
      'Patting someone down no longer finds the weapon they already dropped at your feet, and people you meet again have picked theirs back up.',
      '“I know where you live.” and “Where do you live?” aren’t offered inside their own home.',
      'Getting caught pickpocketing with nothing taken no longer weighs on you like a mugging.',
      'Refusing to unlock their phone, people no longer talk about their bank account.',
    ],
  },
  {
    v: '2.62',
    date: 'Nov 8',
    items: [
      'Toughness now also makes your bones harder to break, not only harder to knock out.',
      'Stamina helps you outrun the police.',
      'Lost your ID? The Records Office makes you a replacement.',
    ],
  },
  {
    v: '2.61',
    date: 'Nov 8',
    items: [
      'Pickpocketing: follow someone close after seeing what they carry, and you can see what’s in their pockets and try to lift their wallet, phone, keys or cash. Sneak helps; if they feel it, they’ll know.',
      'An unlocked phone sells for more, and unlocking someone’s phone puts their address on your map.',
      'You can eat lunches and groceries, and drink water bottles, that you find: it takes the edge off being tired.',
    ],
  },
  {
    v: '2.60',
    date: 'Nov 8',
    items: ['A new, more realistic map: real blocks of buildings (big ones downtown, rows of houses with yards and alleys further out, parking lots), proper roads with names along them, a park with trees, the river and its bridge, and the rail line.'],
  },
  {
    v: '2.59',
    date: 'Nov 8',
    items: [
      'Found someone’s house keys? Ask them where they live. Calm, they won’t say; scared, they might, or lie (sometimes you can tell); terrified, they give it up, and it’s on your map.',
      'Fear has six levels now: Calm, Uneasy, Wary, Scared, Terrified, Broken.',
      'Know where someone lives? “I know where you live.” scares them more than any other threat.',
      'People answer your demands (the PIN, unlocking a phone, where they live, emptying their pockets) differently by how scared they are and what kind of person they are.',
      '“Seen anyone with my things?” only comes up when something of yours is still out there.',
      'New: “You didn’t see anything.” Scared enough, they swear to keep quiet, and they’re far less likely to go to the police. They still remember your face.',
    ],
  },
  {
    v: '2.58',
    date: 'Nov 8',
    items: [
      'Clothes keep you warm in the rain and snow by how warm they are: a puffer or a coat keeps the cold out, a hoodie some, a T-shirt hardly at all. A beanie or your hood up helps too.',
      'New at the pawn shop: a rain jacket, $45. Waterproof, with a hood: the best there is for staying dry.',
      'Shops show how warm each top and hat is, and Pockets tells you how you’ll do in the rain in what you’re wearing.',
      'You can make someone unlock their phone (“Unlock it.”), the one in their pocket or the one you took. Scared enough, they do; or they fake it.',
    ],
  },
  {
    v: '2.57',
    date: 'Nov 7',
    items: [
      'A police stop with four choices no longer squeezes what’s happening down to nothing: the story always has room, and the screen scrolls if it needs to.',
      'With the phone turned sideways, a long address no longer pushes “Go at them” off the bottom of a break-in screen.',
    ],
  },
  {
    v: '2.56',
    date: 'Nov 7',
    items: ['When Dez posts your bail, you get three days to pay it, even if you were already late with him: everything you owe him is due then.'],
  },
  {
    v: '2.55',
    date: 'Nov 7',
    items: [
      'Closing the game while a patrol car is coming no longer gets you out of the stop.',
      'Ducking a patrol too late no longer says they get out of the car twice.',
      'Arguing at a hearing no longer promises “half” when you were getting probation anyway.',
      'Escaping from jail no longer ends with a cellmate tipping you off on your way out.',
      'Your record’s “last let out” date is right after an escape attempt.',
      'A weapon you were holding always goes into a pocket it fits when you put it away.',
      'Bribing at a car stop no longer mentions a passenger seat; losing bail Dez posted no longer says you put it up.',
    ],
  },
  {
    v: '2.54',
    date: 'Nov 7',
    items: [
      'Sometimes you see a patrol car turn onto the block before it gets to you: duck into a doorway (Sneak helps), or stay where you are.',
      'Running from the police works more often (about half the time when you’re fresh), and Sneak helps.',
      'At a stop, you can offer them cash. Speech and how much you offer decide it; if they won’t take it, it’s a bribery charge.',
      'Can’t make bail? If Dez trusts you enough, call him: he posts it, and you owe him for it, and then some.',
      'At your hearing, Speech gives you a chance to get a charge dropped or your sentence cut.',
      'Serving a sentence, you can try to escape. Get away and there’s a warrant out for you; get caught and they add time.',
    ],
  },
  {
    v: '2.53',
    date: 'Nov 7',
    items: [
      'Waiting in County for your hearing takes half an hour now (was 5 hours), and the same for anyone you used to be who’s waiting on one.',
      'Bailing out someone you used to be gives them a court date of their own, a day or so off, not the hearing they were about to have.',
    ],
  },
  {
    v: '2.52',
    date: 'Nov 7',
    items: [
      'Long sentences are much shorter in real time: three months is about 22 hours, a year about 29, five years about a day and a half. Up to a month stays as it was.',
      'Anyone already serving a long sentence has their time cut to match.',
    ],
  },
  {
    v: '2.51',
    date: 'Nov 7',
    items: [
      'You can carry up to a quarter more than your carry limit, weighed down. Pockets tells you when you’re over it.',
      'Walking only tires you when what you carry weighs 90% of your limit or more, and more the further over you go. Below that, walking is free.',
      'The You tab shows your carry limit and the most you can manage weighed down.',
    ],
  },
  {
    v: '2.50',
    date: 'Nov 7',
    items: [
      'Jail is shorter again: a night in a holding cell is 1 real hour, and waiting in County for your hearing is 5.',
      'Sentences are shorter too: a week is about 8 hours, a month about 16, a year about 2½ days.',
      'Anyone already locked up has their time cut to match.',
    ],
  },
  {
    v: '2.49',
    date: 'Nov 7',
    items: ['Walking between places no longer tires you, unless you’re carrying a heavy load (more than half of what you can carry). That still wears you down, and builds your Strength.'],
  },
  {
    v: '2.48',
    date: 'Nov 7',
    items: [
      'Jail is much shorter. A night in a holding cell is 2 real hours (was 8), and waiting in County for your hearing is 8 (was 36).',
      'Sentences take far less real time than their length: a week is about 11 hours, a month about a day, a year about 3 days.',
      'Anyone already locked up (you or someone you used to be) has their time cut to match.',
    ],
  },
  {
    v: '2.47',
    date: 'Nov 7',
    items: [
      'Opening a pocket knife or razor no longer says it takes both hands (one free hand is enough).',
      'Shoving someone from behind no longer says “with both hands” when you’re holding something.',
      'Going back to a car that’s already been towed no longer says you walk to the car first: you walk to where it was parked.',
      'After a character is left inside, the end screen says plainly that you can visit who you were at the County Courthouse.',
    ],
  },
  {
    v: '2.46',
    date: 'Nov 7',
    items: [
      'A writing pass over all the game’s text: apostrophes and quotation marks are the same curly style everywhere.',
      'Fixed “1 rounds left”, “1 hours”, “1 cans” and similar.',
      'Spelling made consistent (paralyzed, gray, anymore).',
    ],
  },
  {
    v: '2.45',
    date: 'Nov 7',
    items: ['On a small phone turned sideways, the main menu fits on the screen (Check for updates was off the bottom), and the Export / Import panel and What’s new fit their buttons in.'],
  },
  {
    v: '2.44',
    date: 'Nov 7',
    items: [
      'The back button (and Escape) closes the Export / Import panel first, instead of changing the menu behind it.',
      'Cancelling “Replace this game?” brings the import panel back with your code still in it.',
      'Messages like “Copied” show clearly over the Export / Import panel.',
      'If a game can’t be loaded because the phone’s storage is full, it says so, and your old game is kept.',
      '“What’s new” no longer shows again for an update you’ve already seen.',
      'The Auto graphics setting describes what it actually does.',
      'Leaving the app and coming straight back no longer leaves reminders set to go off while you play.',
    ],
  },
  {
    v: '2.43',
    date: 'Nov 7',
    items: ['Stress settles much faster, minute by minute: from full panic you stop panicking in about ten minutes, and you’re only on edge after about half an hour. It’s gone within a couple of hours (faster lying down).'],
  },
  {
    v: '2.42',
    date: 'Nov 7',
    items: [
      'Blood spattered on the fight’s panels now sits under the words, so you can still read them.',
      'The rest, jail and work screens are no longer blurred over by a high: you can read them, as you can a menu.',
      'With the phone turned sideways, your status at the top left no longer runs under the Go tab.',
      'The You tab at the bottom is easier to tap.',
    ],
  },
  {
    v: '2.41',
    date: 'Nov 7',
    items: [
      'Bleeding when you left the game no longer stopped everything else healing while you were away: bones mend, your head clears and the bleeding can stop.',
      'The ER can set a broken nose again (the button always said there was nothing to treat).',
      'A broken wrist, ankle or hand no longer says the ER will cast it: casts are for arms and legs. A splint is still for any of them.',
      'A splint goes on a broken arm, leg, wrist, ankle or hand, never a collarbone.',
      'Painkillers wear off while you rest or sleep, instead of lasting the full four hours after.',
      'Very drunk, the warning no longer says one more will black you out when it won’t.',
      'High stress shows as a red bar, like panicking.',
    ],
  },
  {
    v: '2.40',
    date: 'Nov 7',
    items: [
      'With the phone turned sideways, the map is wider, so long addresses don’t break in the middle of a word.',
      '“Forget this address” is easier to tap.',
      'On a small phone turned sideways, a house still says whose it is.',
    ],
  },
  {
    v: '2.39',
    date: 'Nov 7',
    items: [
      'Cars parked along a street show where they really are on the map, not all bunched at one end of it.',
      'A car outside an address you’ve forgotten stays where it’s parked on the map.',
      'The map’s list says “Just round the corner” instead of “0 blocks away”, the same as the card.',
      'Throwing away the keys while you’re at a car now counts as walking away from it (if someone called the police, they still come).',
      'Taking someone’s car keys means their car isn’t “parked out front” at their place for a second set of keys any more.',
      'Sleeping in a car when you’re not tired and rested not long ago now says so, like the motel and the street do.',
    ],
  },
  {
    v: '2.38',
    date: 'Nov 7',
    items: ['Messages on the street could squash down to nothing and not show at all (like the one when you get out of jail). They always show now, under Lurk.'],
  },
  {
    v: '2.37',
    date: 'Nov 7',
    items: [
      'Arrested in a sting, you’re now told the twenty you took was marked.',
      'A former self broken out of the van is no longer tried again for what they were already sentenced for.',
      'Giving up on a character who’s out on bail no longer wipes their court date.',
      'Caught at the van, what you were already wanted for (and anything on you) now goes on your record too.',
      'A missed court date stays on your record when an escape warrant comes on top of it.',
      'After a stop that wasn’t an arrest, “Go on” no longer says it’s on your record.',
    ],
  },
  {
    v: '2.36',
    date: 'Nov 7',
    items: [
      'Map pins are easier to tap, especially with the phone turned sideways.',
      'Tapping a place on the map brings its “Walk there” button into view.',
      'At the bank, the amount box sits on its own line, with Deposit and Withdraw together under it.',
      'On a small phone turned sideways, a place’s name fits on one line, so what just happened there has room to show.',
    ],
  },
  {
    v: '2.35',
    date: 'Nov 7',
    items: [
      'Buying a new bag or coat to wear now warns you first if your old one would have to go in the bin: tap Wear again to go ahead, or Carry it instead.',
      'You can take off a backpack even when nothing else is big enough to hold it: you carry it in your hand. It shows in Pockets under “In your hands”.',
      'Changing clothes keeps your things in the pockets you put them in, as long as those pockets are still there.',
      'Things get lighter as you use them up: a box of rounds, a pack of cigarettes, a drink or a bottle.',
    ],
  },
  {
    v: '2.34',
    date: 'Nov 7',
    items: [
      'A Handoff delivery shift left running for ten hours now logs you off properly, instead of getting stuck on the work screen.',
      'Walking somewhere no longer hides what you found there (like a stash that’s been taken) behind an older message.',
      'Harbor Plasma no longer says they’ll keep money you had no room for: if it doesn’t fit on you, it’s gone.',
    ],
  },
  {
    v: '2.33',
    date: 'Nov 7',
    items: [
      'In Pockets, what just happened (putting something on, “won’t fit”) now shows at the top of the screen wherever you’ve scrolled to, instead of out of sight.',
      'Shops on a phone turned sideways no longer show a row of bills cut in half: your cash is in the top corner.',
    ],
  },
  {
    v: '2.32',
    date: 'Nov 7',
    items: [
      'Changing clothes no longer leaves behind a weapon you’re holding in your hand.',
      'You can’t take a weapon out into a broken hand from Pockets any more.',
      'The bag of empty cans no longer grows past what its pocket can hold or what you can carry.',
      'Swapping to a different top no longer leaves its hood already pulled up.',
      '“No room” messages now give the real reason: too heavy for any pocket, or more than you can carry, instead of just “no room left”.',
    ],
  },
  {
    v: '2.31',
    date: 'Nov 7',
    items: ['A long message on the street no longer has “Tap to dismiss” drawn over its last line: it’s the last line now, after the text.'],
  },
  {
    v: '2.30',
    date: 'Nov 6',
    items: ['The card for who you’ve seen no longer gives away their build or whether they’re a man or a woman: you find that out by sizing them up or getting a look at them.'],
  },
  {
    v: '2.29',
    date: 'Nov 6',
    items: [
      'Fatigue, eased again: exhausted to fresh in about 2 hours in a motel bed, under 3 in a car, about 3 in a doorway, 5 if you don’t rest. Fights, lurking and walking tire you a little less.',
      'Healing, quicker again: a broken arm or leg in about 7 hours (under 5 lying down), ribs in 5, a concussion in 2, a black eye in under a day; blood comes back half again as fast.',
    ],
  },
  {
    v: '2.28',
    date: 'Nov 6',
    items: [
      'You heal twice as fast: a broken arm or leg knits in about 12 hours (6 lying down), blood comes back twice as quick, a concussion clears in 3 hours, a black eye in a day and a half.',
      'Treatment pays off more: a splint gets a break healed in a third of the time it would left loose, and a cast at the ER in a quarter. A set nose, and stitches on a split lip, heal faster too.',
      'Painkillers now dull the pain for about four hours: broken bones hamper your blows half as much, broken ribs leave you less short of breath, and a concussion fogs you less. They heal nothing, and the You tab shows how long they’ve got left.',
    ],
  },
  {
    v: '2.27',
    date: 'Nov 6',
    items: [
      'Fatigue goes faster: from exhausted to fresh takes about 3 hours in a motel bed, 4 in a car, 5 in a doorway, and about 8 if you don’t rest at all (game open or closed).',
      'It builds up a little slower, too: fight moves, lurking and walking across town each tire you less.',
    ],
  },
  {
    v: '2.26',
    date: 'Nov 6',
    items: ['Resting, the plasma center and delivery shifts no longer show cell bars behind them: those are only for jail.'],
  },
  {
    v: '2.25',
    date: 'Nov 6',
    items: [
      'Speech sells: the better you talk, the more people buy, and the more they pay. Every sale you try trains it.',
      'Sneak keeps it quiet: less heat from each sale, people who turn you down are less likely to report you, you’re better at smelling a cop posing as a buyer, and witnesses are less sure what they saw. Selling with nobody else around trains it.',
      'The You tab shows what each one does for your selling.',
    ],
  },
  {
    v: '2.24',
    date: 'Nov 6',
    items: [
      'The street stays still. A message no longer pushes whoever you’ve seen, or Lurk, around to make room: messages always appear in the same place, under Lurk, and a long one scrolls there.',
      'Things fade in without the text stretching as it appears, so nothing next to them jumps.',
    ],
  },
  {
    v: '2.23',
    date: 'Nov 6',
    items: [
      'Watching and talking are separate now. While you watch someone (follow, size them up, see what they carry, read them), they don’t know you’re there, and the sneak attacks are yours.',
      'Walk up to them to talk: then you see them properly, and a Talk tab has asking for change, asking who’s selling, and selling. Face to face there’s no getting behind them: you can hit them, shove, mug or spray them, or walk off. Someone who comes over to you starts face to face.',
    ],
  },
  {
    v: '2.22',
    date: 'Nov 6',
    items: [
      'The street isn’t always empty. A lurk can turn up two or three people at once: more by day, fewer late at night and in the rain. Whoever’s in front of you is the big card; the others sit under it, and you can tap one to go over to them instead. They don’t stay: each walks on after a while.',
      'Witnesses. Start something with others on the street and they see it: more heat, someone may call it in, they may get a good look at your face, and now and then one shouts and steps in, which gives whoever you’re on a breath and some nerve back. Then they get out of there. A kill in front of people is always seen. The fight says when you’re being watched.',
      'An empty street at night is the safe time to start trouble, and the rarest. Selling in front of people draws a little more attention too.',
    ],
  },
  {
    v: '2.21',
    date: 'Nov 6',
    items: [
      'Honest money, a little at a time. Ask people on the street for change (“Spare some change?”): most walk past, some give a few coins, a drunk might give you a few dollars. Looking rough helps; someone you’ve hurt gives nothing.',
      'Go through the bins at your corner (Go: Your corner) for empty cans, and now and then something else. They fill back up over a few hours. The gas station takes the cans back at 10¢ each.',
      'Harbor Plasma, on the map: about fifty minutes in a recliner, real time, for $60 the first time and $45 after. Your own ID, twice a week at most, and you leave light-headed. Leave early and you don’t get paid.',
      'Deliveries with the Handoff app: you need a phone that’s yours or unlocked (a prepaid one at the gas station, $45; most phones you take off people are locked) and your own ID. Go online from the street, on its own real-time screen; more orders at dinnertime and in bad weather, fewer when you’re worn out. Your pay builds up in the app: cash it out to your bank account, free once a week or $2 any time.',
    ],
  },
  {
    v: '2.20',
    date: 'Nov 6',
    items: [
      'The street, polished: whoever you’ve seen fades in once and stays (it used to flash off and on), and their card says what you can see from over there (“Stocky woman, across the street”).',
      'Lurking no longer empties the screen: Lurk, Go and Pockets stay, greyed, while you wait, and the wait is a little shorter. What you feel while you wait (the cold, a craving) shows once the static clears, readable.',
      'On a small sideways screen, a message and whoever you’ve seen both fit. Police stops read in order: the car slows, then pulls in. Only the latest weather line shows.',
      'Cravings know what’s in your pockets, flurries by day come out of a white sky, and the cold doesn’t repeat itself. A first-time hint on the street, and the first time Rest shows, what it does.',
      'Night is a little darker on the tube, rain shows better, the film scratch is fainter, and the edge tabs keep clear of a phone’s notch.',
    ],
  },
  {
    v: '2.19',
    date: 'Nov 6',
    items: [
      'Dez doesn’t sell to strangers anymore: someone has to vouch for you. Ask around on the street (“Know anyone selling?”: junkies are your best bet, and some want twenty for it), or a regular customer, someone inside, or your own reputation will point you to him.',
      'Dez’s trust: buy from him, move his product quietly and pay fronts on time, and it grows. Pay late, beat up the man he sends, or get picked up holding, and it drops; too low and he’s done with you, and you need a new introduction.',
      'With his trust come better prices and bigger amounts: a quarter ounce, and at the top an ounce from his own supplier, fronted on a week.',
    ],
  },
  {
    v: '2.18',
    date: 'Nov 6',
    items: [
      'Where you rest matters: a bed in your motel room takes you from exhausted to fresh in about 6 hours, the back seat of a car about 8, a doorway about 10.',
      'Not resting at all, fatigue still wears off by itself, game open or closed: about a day from exhausted to fresh.',
    ],
  },
  {
    v: '2.17',
    date: 'Nov 6',
    items: ['Weapons in a fight: take it out first (a turn), then use it. While it’s still in your pocket, taking it out is the only option; once it’s in your hand you can use it or put it away. That goes for pepper spray too (spraying someone as you jump them is still one move).'],
  },
  {
    v: '2.16',
    date: 'Nov 6',
    items: ['The fight footer fits on the smallest phones, with its little hints (how far ahead they are) never cut off.'],
  },
  {
    v: '2.15',
    date: 'Nov 6',
    items: ['In a fight, the buttons along the bottom (Catch your breath, Run) stay on one line on small phones.'],
  },
  {
    v: '2.14',
    date: 'Nov 6',
    items: [
      'The fight screen, polished: the result (“You walked away”, “They’re out cold”) always shows, even sideways; the log never cuts a line in half and keeps room for a few lines; the end screen is just what happened and a clear Leave.',
      'Folded, the fight panel still shows stamina and whether either of you is down or dazed. Greyed-out moves say why in a readable colour. Get up and Chase stand out.',
      'Bigger buttons, tabs that stay in the same order, group headings only when there are enough moves to need them, and the list starts back at the top when the fight changes.',
    ],
  },
  {
    v: '2.13',
    date: 'Nov 6',
    items: [
      'Buying clothes: Wear or Carry. Wear moves everything you’ve got into the new clothes and puts them on; Carry puts them in your bag to put on later from Pockets.',
      'If something wouldn’t fit in what you’re putting on, it tells you first, by name, and nothing changes. Tap Wear (or Put on) again to go ahead and leave it behind. Your old clothes go in your bag if there’s room, or the bin out front.',
    ],
  },
  {
    v: '2.12',
    date: 'Nov 6',
    items: [
      'A carry limit, by Strength: 15 kg untrained, up to 50 kg. Over it, you can’t pick anything else up, and it says so. Pockets shows how close you are. Walking across town with a heavy load tires you more, and slowly builds your Strength.',
      'Fight writing, polished: locks read like locks (no punch lines after them), misses and moves vary more, nobody is “on the floor” twice, someone knocked out by a blow doesn’t react to it, and giving up a second time is short.',
      'With an arm broken, the fight says so: one-armed versions of grabs, shoves, chokes and takedowns, and moves that need both hands (breaking a neck, a choke) are greyed out.',
      'Someone in a wheelchair: your first move kicks the chair over. Stomp, not stamp. Clearer move names (Stomp on their head, Kick out their knee) and shorter weapon labels.',
    ],
  },
  {
    v: '2.11',
    date: 'Nov 6',
    items: [
      'Move your game, in Settings: Export copies your game as a code. On the other device (the Android app, or another browser), Settings, Move your game, Import: paste it in, and it’s your game there.',
    ],
  },
  {
    v: '2.10',
    date: 'Nov 6',
    items: [
      'Having to leave in a hurry won’t kill you. Bleeding while the game is closed leaves you weak, just short of passing out, but never dead. When you’re back it tells you, and you have an hour before it gets worse: time to bandage it or get to the ER.',
      'While you’re playing, bleeding works as before.',
    ],
  },
  {
    v: '2.09',
    date: 'Nov 6',
    items: [
      'The pause button is a menu button now (three lines), since nothing pauses: the clock is the real one. The menu it opens says Menu, with Back and Main menu.',
      'Coming back after time away, your body catches up once you’re back in the game, not under the menu or on a dark screen, so you see what happened (and if you bled out while you were gone, it says so).',
      'Time in jail or lying down heals at the faster rate even when the game was closed for it.',
      'Collapsing from blood loss clears whoever was across the street. Setting the phone’s clock back no longer locks Rest’s quick healing for weeks. Sleeping in a car only warms and calms you when it’s a real night’s rest.',
      'If saving ever fails (storage full), it tells you once a minute, not after every tap.',
    ],
  },
  {
    v: '2.08',
    date: 'Nov 6',
    items: [
      'A move you know no longer vanishes from the fight menu when you’re too tired for it: it greys out like the rest, until you’ve learned the move that replaces it.',
      'With your arms broken, locks and breaking someone’s neck are harder even when they’re out cold, and the moves from the floor say when your arms or legs are broken.',
    ],
  },
  {
    v: '2.07',
    date: 'Nov 6',
    items: [
      'The game saves as you play: a moment after anything changes (a new screen, a move in a fight, a purchase, lying down). You don’t need to pause to save, and closing the app, or the phone closing it for you, loses nothing.',
      'Pausing doesn’t stop anything any more either: the world, your body and every timer run on the real clock. The pause menu is just there for settings, updates and quitting.',
    ],
  },
  {
    v: '2.06',
    date: 'Nov 6',
    items: [
      'Your body runs on the real clock now, like everyone else’s: bones knit, cuts close, blood comes back, a concussion clears, and bleeding drains you, hour by hour, whether the game is open, paused or closed. Lying down or locked up, it goes faster.',
      'Rest still gives you its quick few hours of healing, but only once every four hours; after that, the rest is up to time. (Resting and getting up over and over no longer heals you for free.) Lurking no longer counts as an hour gone.',
      'Jail no longer adds hours on top of the real time you spend inside.',
      'A message waiting for you after a knockout shows under how you came to, instead of flashing past. A long message keeps its first lines when more come in.',
      'With your arms broken, the takedowns that need your hands don’t hide the kicks they replaced. A greyed-out old move no longer comes back next to its greyed-out replacement.',
      'Messages wrap instead of being cut off, the main menu scrolls on a very short screen, and Escape closes What’s new.',
    ],
  },
  {
    v: '2.05',
    date: 'Nov 6',
    items: [
      'Something that happened while you were knocked out is still there when you come to, under how you woke.',
      'Waking in a car to the tow truck or the police tells you everything that happened while you slept, too.',
      'Getting up from a rest repeats what happened as you lay down (the bleeding stopping, a bone setting), which short screens had no room to show.',
      'In a place, a line that comes in by itself (the weather, a cigarette) goes under what’s there instead of replacing it.',
      'The rest screen says where you are as it is (a doorway in the rain, a wall when it’s dry), the motel no longer promises “eight hours” before a countdown, and the fatigue word always matches its number.',
    ],
  },
  {
    v: '2.04',
    date: 'Nov 6',
    items: [
      'The fight menu only shows moves you know. Moves you haven’t learned yet no longer sit there greyed out; the You tab’s Fighting styles card still says what each style teaches next, and at what level.',
      'A better move takes over from the one it improves on once you learn it: the Uppercut replaces the Haymaker, Kick the knee in replaces the Leg kick, the Double-leg takedown replaces Trip them, Elbows from the top replace Ground and pound, and Drag them down replaces Kick their legs. The old one only comes back when the new one can’t be used (too tired for it, say).',
    ],
  },
  {
    v: '2.03',
    date: 'Nov 6',
    items: [
      'Missing your court date while lying down or locked up now tells you so when you’re back up, instead of saying nothing. Anything else that happened while you couldn’t see the screen waits for you the same way, including the moment a fight ends.',
      'Sleeping in your room or a car no longer makes highs, drink and cravings jump eight hours on top of the real time you lie there. Lying back down soon after a night’s sleep rests you, without healing you a second time.',
      'Using something from Pockets beside a body shows what happened right there again.',
      'Escape charges always reach your record: turning yourself in with an escape warrant, and getting caught running from a stop.',
      'Broken arms and fatigue count against ambushes and shooting. With both arms broken you can’t torture anyone. Worn out, catching your breath only gets you back up to what you’ve got left.',
      'Someone who bleeds out after you let them go no longer shows as still bleeding. Looting a body doesn’t tire you. A paralysed person doesn’t scream at an ankle they can’t feel.',
    ],
  },
  {
    v: '2.02',
    date: 'Nov 6',
    items: [
      'Check for updates, on the main menu and the pause menu. If there’s a newer version it offers to update you there and then, saving your game first. The button says so on its own when one is out.',
      'In the Android app it also tells you when the app itself needs a new download, and takes you to it.',
    ],
  },
  {
    v: '2.01',
    date: 'Nov 6',
    items: [
      'The Android app plays the live game, so every update reaches your phone the next time you open it, with no new download. It needs an internet connection to start.',
      'If the app itself ever needs updating, the game tells you, with where to download it.',
    ],
  },
  {
    v: '2.0',
    date: 'Nov 6',
    items: [
      'DarcVoyd is an Android app now. Download DarcVoyd.apk from the game’s GitHub page (Releases, “DarcVoyd for Android”) and install it. Every update installs over the last one.',
      'In the app, the phone tells you when things happen while the game’s closed: rested, out of jail, court today, your motel room running out, Dez’s money due, and who you were getting out or being moved in the van.',
      'In the app, the game fills the whole screen, and the phone’s back button opens the pause menu.',
    ],
  },
  {
    v: '1.99',
    date: 'Nov 6',
    items: [
      'Fatigue. Every move in a fight wears you down, and so do lurking, walking across town, working a house and running from the police. It builds up from fight to fight: Fresh, Tired, Worn out, Exhausted, Spent.',
      'Worn down, you’ve less stamina in a fight (down to 60% at the end of your rope), your blows land less, and everything you try is a little less likely to work: talking your way out, forcing a door, outrunning the police, the van. Spent, you can’t lurk at all until you lie down.',
      'Rest is real time now. Lie down in a doorway, your motel room or the back seat of a car, and a screen counts down to fresh: about 8 real hours from exhausted. Get up early if you want, with whatever you’ve got back. Healing a wound is still instant, as before. On your feet, fatigue wears off at a quarter of that speed.',
      'Fatigue has its own card on the You tab, with how long a rest will take.',
      'After a kill, a note that comes in goes into the fight log instead of over the body screen. Who you were shows as wanted if they helped with a breakout. Wording on the cell screen and give-up screen matches what you can do now.',
    ],
  },
  {
    v: '1.98',
    date: 'Nov 6',
    items: [
      'Wanted for an escape: getting stopped now books you on it, and it goes in front of a judge (it used to let you go every time, warrant and all). Escape charges show on your record.',
      'Going back to who you were keeps their name, and people who only knew the other face don’t recognise this one.',
      'A visit no longer repeats a van time that’s already gone. Hitting the van while you’re out on bail for something else costs you that bail, and an old missed-court warrant stays on the charges.',
      'A stamp on the ankle or a wrist lock breaks one limb, never two at once.',
      'Your own injuries count legs the way a fight does: both legs (or ankles) broken and you can’t get up, and the card says so.',
      'Someone in a wheelchair can’t charge at you when they spot you following them.',
    ],
  },
  {
    v: '1.97',
    date: 'Nov 6',
    items: [
      'Shops on a phone held sideways: what just happened keeps a few lines of its own, and the bottom of the list is no longer cut off.',
      'A long message on the street no longer runs off the bottom of a small screen or under the Go and Pockets tabs.',
    ],
  },
  {
    v: '1.96',
    date: 'Nov 6',
    items: [
      'Giving up in jail doesn’t erase who you were. They stay inside, on their real sentence, and the You tab lists them under “Who you were”.',
      'As someone new, go to the County Courthouse (weekdays, 9 to 4) to visit them: you’ll need your own ID. Before their hearing you can pay their bail.',
      'On a visit they tell you when the transport van moves them. Be at the loading dock then and you can try to break them out. The odds are long, and if it fails you’re arrested for aiding an escape, with no bail. If it works, you’re both wanted.',
      'Once they’re out, by bail, breakout or serving their time, you choose who you go on as. The other one stays in the world, and you may run into them on the street and take over as them again.',
      'Fixed: a note that came in after a fight ended was drawn over the end screen; it now goes into the fight log.',
    ],
  },
  {
    v: '1.95',
    date: 'Nov 6',
    items: [
      'Jail is real time now. A night in a holding cell is 8 real hours, County while you wait for the judge is 36, and a sentence is its real length in days. A cell screen shows how long is left and when you get out.',
      'You can still pause, change settings or quit while you’re inside. Close the game and come back when they let you out.',
      'If you can’t wait it out, you can give up on that life and start over as someone new. Whoever you were stays inside.',
      'Your body still mends while you’re inside, and the world keeps going without you.',
    ],
  },
  {
    v: '1.94',
    date: 'Nov 6',
    items: [
      'Jail no longer fast-forwards the world. Your room, what you owe Dez, your car and the houses you know all keep real time, so a night in a cell doesn’t cost you a room you’d paid for. Your body still heals and your habits still fade inside.',
      'Ambush moves (Kick their knee, Slam them into the wall, Choke from behind) unlock and work by their own style’s level, like every other move. A move a style just unlocked can be used straight away.',
      'Grappling someone to the ground trains Clinch & takedowns.',
      'Nobody stays standing on two broken legs. A knee or ankle kick breaks one leg, not both at once.',
      'Someone in a wheelchair can’t run when you let them go, can’t come hunting you, and isn’t on crutches. You can’t sneak up and sweep them off their feet: you just go at them.',
      'Torture: fingers on a hand that’s already broken are left alone. Twist the broken arm only shows when an arm is broken. Fingers that have healed can be broken again.',
      'Fixed: the level-up sound, getting winded twice from one punch, a limp on someone already on the floor, and two locked moves of the same style on the floor menu.',
      'The street message’s text no longer hides under “Tap to dismiss” on short screens, and the map’s Walk there button is easier to tap.',
    ],
  },
  {
    v: '1.93',
    date: 'Nov 6',
    items: [
      'The map keeps its size however many addresses you know (it used to squash flat). Walking the blocks with a fob isn’t listed as a car you know.',
      'On a short landscape screen, the card for who you’ve seen no longer sits on the Lurk button, and it keeps clear of the side tabs on a small phone.',
      'Criminal record: time held in a cell counts up in hours and days, the same way every time.',
    ],
  },
  {
    v: '1.92',
    date: 'Nov 6',
    items: [
      'A message waiting on the street goes away when you walk up to someone, instead of staying over the fight. The river’s name on the map no longer runs into the avenues.',
    ],
  },
  {
    v: '1.91',
    date: 'Nov 6',
    items: [
      'New stat, Toughness: it makes blows rattle you less and makes a lucky knockout less likely. The only way to raise it is getting hurt, and the worse off you are when a blow lands (bleeding, rattled, broken, on the floor), the more it teaches you.',
      'Torture doesn’t repeat what can’t be done again. Fingers break one at a time and you’re told which one, on which hand, one hand at a time; when all five on a hand are gone, that hand’s broken, and after all ten there’s none left. Stomping a hand breaks one hand, then the other, then that’s it. A broken arm twisted once. Moves meant to break something that’s already broken are greyed out, and stomping ribs that are broken with a lung gone is too.',
      'Messages on the street stay until you tap them away. Beside a body there’s no Lurk or Rest: you go through their pockets or walk away.',
    ],
  },
  {
    v: '1.90',
    date: 'Nov 6',
    items: [
      'Fighting is sorted the way real fighting is: Strikes (hands, elbows, head), Kicks & knees, Clinch & takedowns, Ground, and Locks & chokes, each its own section in the fight, with Weapons and Torture apart.',
      'Each style is a skill of its own, levelling from the moves you use (see Fighting styles on You). A style’s level is what teaches you its harder moves; Unarmed still rises with every blow and still drives how hard you hit. Characters from before keep everything they’d learned.',
      'Twenty new moves: a palm to the nose, a hammer-fist to the collarbone, a hook to the jaw, a throat punch, front kicks and leg kicks, stamping an ankle, kicking a knee in, a head kick, a hip throw and a double-leg takedown, breaking fingers, wrist and ankle locks, elbows from the top, an arm bar.',
      'More bones break, each with its own effect: fingers and hands (no fist, no grip: they drop what they’re holding), wrists, ankles (they can’t run on it), knees, the collarbone (one arm useless), the jaw.',
      'At the very top of Ground and Locks: a knee on the spine that can paralyse someone for life (they’re in a wheelchair if you ever see them again, and it weighs on you), and breaking someone’s neck, which kills them.',
      'A refused sale stays on the screen so you can see what was said, and an old note no longer shows over the end of a fight.',
    ],
  },
  {
    v: '1.89',
    date: 'Nov 6',
    items: [
      'Your criminal record (on You) shows what came of it all: how many times you were convicted, sentences served (and how many in state prison), total time served, your longest stretch, nights in a holding cell, fines paid, probation, and when you were last let out.',
      'Back to how it was: the button says Lurk, every time, and ordinary people are Civilians.',
    ],
  },
  {
    v: '1.88',
    date: 'Nov 6',
    items: [
      'Under the map, the addresses and cars you know are listed as buttons too, each with whose it is and how far: easier to tell apart than the little house pins. Tap one and its card comes up.',
      'Every button answers your touch now: it presses in under your finger and a ring of light spreads from where you tapped (switched off if your phone asks for less motion).',
    ],
  },
  {
    v: '1.87',
    date: 'Nov 6',
    items: [
      'Take things off: your cap, sunglasses, mask, jacket (you’re in your T-shirt) or bag, from Pockets under What you’ve got on. They go in your pockets or your bag if there’s room, and Put on puts them back. Taking your jacket off changes what witnesses remember you wearing.',
      'The bank greys out what wouldn’t do anything: changing up when you’re already in the biggest bills, breaking a bill you’ve no room for the change from, the coin machine with less than a dollar in coins, withdrawing with nowhere to put it.',
      'Running away and chasing go by who’s faster: your Agility against theirs, and both of you as you are (legs, breath, drink). Running, even when you don’t get away, trains Agility and Stamina.',
      'The cash machine says what’s wrong with each of your cards.',
    ],
  },
  {
    v: '1.86',
    date: 'Nov 6',
    items: [
      'The cash machine no longer says your cards have no PINs when you haven’t got any cards. A card the machine said was empty stays empty after a thief’s had it.',
      'Walking the blocks with a car fob, the map shows you out there, not at your corner.',
    ],
  },
  {
    v: '1.85',
    date: 'Nov 6',
    items: [
      'The map has a city on it now: buildings on every block (a few windows lit), the rail line across the top, the river with its bridge, the park with its trees and pond, the parts of town by name (Downtown, the Flats, Old Town, Southside, the Docks), a few landmarks (St. Agnes, the laundromat, the water tower, the shelter), a compass and a scale. “YOU” under your mark.',
      'Addresses you know can be taken off the map: tap one and Forget this address. It stays forgotten, even if you still have their ID.',
    ],
  },
  {
    v: '1.84',
    date: 'Nov 6',
    items: [
      'On a short landscape screen, a shop’s opening hours no longer touch its name.',
    ],
  },
  {
    v: '1.83',
    date: 'Nov 6',
    items: [
      'A shop’s name has a little more room above its description.',
    ],
  },
  {
    v: '1.82',
    date: 'Nov 6',
    items: [
      'More text kept apart: the “earlier lines” label in a fight no longer lets a line show through it, a place’s name has room above its description, and street names on the map don’t run into each other.',
    ],
  },
  {
    v: '1.81',
    date: 'Nov 6',
    items: [
      'Nothing sits on top of anything on the street screen any more: a note finds the gap (under the card, over it, under Lurk), goes smaller if it has to, and the card for who you’ve seen moves out of its way. The card never runs up under the clock.',
      'After a fight: overdosing or blacking out on the end screen counts the fight properly (and nobody who left robs your body); running out of a house says Leave, not Back to the house; the ending doesn’t repeat what the log already said; an empty card says so, not “Stopped”.',
    ],
  },
  {
    v: '1.80',
    date: 'Nov 6',
    items: [
      'Where to? is a map of the city now: five avenues, seven streets, Wexford Rd and Tanner Rd cutting across, a park and the river. Every place has its own spot on it (the pharmacy on Grand and Larkin, the alley behind the laundromat off Ninth, the hotel on Cobb…), marked with its own symbol, dimmed when it’s shut.',
      'Addresses you know sit on their own street, by house number, and cars where they’re parked. You’re the pulsing red mark. Tap anything for what it is, how far it is in blocks, its hours, and Walk there.',
      'A thief won’t give you the PIN of a card they stole off you, and once someone’s told you a card has no PIN you aren’t asked again. Cash in a coffee can is cash.',
    ],
  },
  {
    v: '1.79',
    date: 'Nov 6',
    items: [
      'What’s behind a stolen card goes by who it belonged to: someone from a nice house might have a few thousand in checking, someone scraping by twenty dollars or nothing at all. The machine gives no more than its daily limit (a few hundred), and an empty account says INSUFFICIENT FUNDS.',
      'Credit cards, the way they really are: most people never set a PIN for one, and ask for it and they’ll tell you there isn’t one. The few that have one give a cash advance, a slice of the credit line.',
      'Pocket bars fill up by bulk as well as weight (a pocket full of bills is full even if it weighs little). Coins are “loose in here”, not folded.',
    ],
  },
  {
    v: '1.78',
    date: 'Nov 6',
    items: [
      'The item symbols are everywhere now, in the same colours: Pockets, every shop (the pharmacy, the gas station, the liquor store, the pawn shop, the gun shop), what you can sell to the pawn shop and the fence, the alley stash, your room, the trunk, and the cash machine.',
      'New symbols for things you wear, in a soft teal: a jacket, trousers, a bag, a cap, a mask, sunglasses, a sheath or holster. And a coffee cup.',
    ],
  },
  {
    v: '1.77',
    date: 'Nov 6',
    items: [
      'Cash and room: change you’ve no room for, you tell them to keep; the ATM won’t take a card if you can’t carry the money (and says when some stays in the machine); the teller gives you all you can actually carry, big bills first; a buyer you’ve no room to pay you says so.',
      '“Your pockets are stuffed with cash” only when it really is the cash filling them.',
      'The mid-fight You screen shows real healing times. Ammo and medicine get their own symbols, and a syringe always shows as one.',
    ],
  },
  {
    v: '1.76',
    date: 'Nov 6',
    items: [
      'When a fight or a confrontation ends, you stay on its screen: how it ended is the last thing in the log, everything you could do is greyed out, and Leave takes you back. All of it stays in one place, not in a note on the street afterwards.',
      'Walking away from a body says nothing more on the street. (Knocked out, you still come to on the sidewalk.)',
    ],
  },
  {
    v: '1.75',
    date: 'Nov 6',
    items: [
      'Polished loot symbols: finer lines, more detail (a lit phone screen, the chip on a card, powder in the baggie, the ember on a cigarette), a faint fill on the part that matters, and a tile lit from above like an old terminal key. Money and valuables catch the light now and then.',
    ],
  },
  {
    v: '1.74',
    date: 'Nov 6',
    items: [
      'Opening You in the middle of a fight shows you as you are right then: the blood you’ve lost, the bleeding, what’s broken.',
    ],
  },
  {
    v: '1.73',
    date: 'Nov 6',
    items: [
      'The loot symbols are the game’s own now: thin line drawings in the colour of what they are, with the same red and blue fringe as the rest of the screen. A bill, a stack of coins, a phone, a key, a blade, a baggie, a torn-off receipt, and the rest.',
    ],
  },
  {
    v: '1.72',
    date: 'Nov 6',
    items: [
      'Loot is easier to read at a glance: everything you can take has a symbol and a colour. Green 💵 money, gold for what sells (phones, laptops, watches), blue 💳 cards and ID, amber 🔑 keys, red 🔪 weapons, violet 💊 drugs and medicine, grey for the rest.',
      'Searching someone, and going through a house or a car, both show it.',
    ],
  },
  {
    v: '1.71',
    date: 'Nov 6',
    items: [
      'Cash takes up room now, the way it really does. A bill weighs about a gram and takes about as much room as a folded receipt; coins are heavy. Pockets shows which pockets your money is in and how full they are.',
      'Carry enough and you run out of room: jeans and a hoodie hold a couple of thousand in small bills, a backpack tens of thousands. Big bills take far less room than small ones, and the bank will change them up.',
      'When there’s no room: you take what fits and leave the rest, the teller only counts out what you can carry, and the fence and pawn shop won’t buy if you can’t carry the money. A pocket full of cash leaves less room for everything else.',
    ],
  },
  {
    v: '1.70',
    date: 'Nov 6',
    items: [
      'Taking things: “You put the state ID (expired) in your jeans”, and the same in Take everything.',
      'Two of the same lighter in one pocket read “two lighters (43% full, in the jacket)”.',
      'Car keys a thief took off you age while you’re in jail, the same as ones you kept. Dez’s man no longer says your pockets are empty when he’s left things in them.',
    ],
  },
  {
    v: '1.69',
    date: 'Nov 6',
    items: [
      'Robbed while you were out (by a stranger or by Dez’s man): the list of what went reads properly, “a state ID (expired)” and all, and doesn’t say “come to” twice.',
    ],
  },
  {
    v: '1.68',
    date: 'Nov 6',
    items: [
      'Robbed while you were out: “Gone: your cash, three small baggies, pepper spray and a cell phone.”',
      'Your cash on a thief who got you twice adds up to one sum. Ammo reads “two boxes of 9mm rounds”.',
    ],
  },
  {
    v: '1.67',
    date: 'Nov 6',
    items: [
      'Car keys you get back off whoever robbed you are as old as the car: if it’s been reported, the fence won’t buy them.',
    ],
  },
  {
    v: '1.66',
    date: 'Nov 6',
    items: [
      'Knocked out in a house: the note from going in no longer shows on the black screen.',
      'Money added up in a search keeps its cents (“$0.70”, not “$0.7”).',
    ],
  },
  {
    v: '1.65',
    date: 'Nov 6',
    items: [
      'Search wording: “$40 of your cash” off a thief, the same sum twice added up, “two cans of pepper spray” everywhere, “You leave it” for one pack of cigarettes.',
      'Someone lying there with broken arms and legs doesn’t say the same line every turn.',
    ],
  },
  {
    v: '1.64',
    date: 'Nov 6',
    items: [
      'Car keys from a past life, whatever car they were for, don’t bring that car back.',
      'A house with police at the car out front shows the car and the patrol car, even once the keys are gone from you.',
      'An older save’s “they saw your face” in a house still counts.',
    ],
  },
  {
    v: '1.63',
    date: 'Nov 6',
    items: [
      'Someone in their house who saw your face remembers it as well as if you’d never put the mask on, not just some of the time.',
      'Small list wording fixes (“two cans of pepper spray”).',
    ],
  },
  {
    v: '1.62',
    date: 'Nov 6',
    items: [
      'Only the person in the house who actually saw your face remembers it: someone who only ever saw you masked doesn’t.',
      'No breaking in while an officer is out front walking round their car.',
      'A car fob from a past life doesn’t bring back a car that was towed long ago.',
    ],
  },
  {
    v: '1.61',
    date: 'Nov 6',
    items: [
      'Someone you slap awake doesn’t swing at you in the same moment they come round.',
      'Search lists read better: “$59 in folded bills”, “a lighter (43% full)”, “two pepper sprays”, “two sets of house keys”, “matches (20 left, in the bag)”.',
      'Someone with both arms broken gets up and lies there like it. A dropped weapon shows as on the ground by them.',
    ],
  },
  {
    v: '1.60',
    date: 'Nov 6',
    items: [
      'Someone who saw your face in their house remembers it even if you mask up and fight them.',
      'A towed car drops out of Where to?. Guilty thoughts after a fight in a house don’t have you walking away while you’re still inside.',
      'Lists read better: “a wallet with a license and $78, and a receipt”.',
    ],
  },
  {
    v: '1.59',
    date: 'Nov 6',
    items: [
      'With both arms broken, nobody pepper sprays you or turns on you with a punch after giving up, and a weapon they dropped stays on the ground, not back in their pocket.',
      'Someone who gives up doesn’t turn on you in the same moment.',
      'Fight text: “two receipts (in the bag)”, not “two receipt (in the bag)s”.',
    ],
  },
  {
    v: '1.58',
    date: 'Nov 6',
    items: [
      'A house no longer shows its car out front once it’s been towed, or says you’ve got the keys after you’ve lost them. Police at that car show from the house too.',
    ],
  },
  {
    v: '1.57',
    date: 'Nov 6',
    items: [
      'Take the spare car keys off their hook and the car is out front of the house and in Where to? straight away, not only after you’ve walked to it.',
      'A guilty thought after a fight no longer has you walking away while you’re still inside.',
    ],
  },
  {
    v: '1.56',
    date: 'Nov 6',
    items: [
      'Pulling a mask up once someone in their house has seen your face doesn’t take it back, and running doesn’t wipe out a look they got at you earlier.',
      'A car you have the spare keys to shows up out front of their house.',
      'Slapping someone awake who’s bleeding badly only works if they won’t black straight out again.',
      'Someone with both arms broken drops what they were holding and can’t swing at you.',
      'Fight text: no stumbling just before going down, no cheekbone said twice, and “three receipts” instead of “a receipt, a receipt and a receipt”.',
    ],
  },
  {
    v: '1.55',
    date: 'Nov 6',
    items: [
      'Police at a house are at the car parked out front of it, too: you can’t go through it under their noses.',
      'Walking off while someone’s in front of you in their house now says so, and whether they saw your face.',
    ],
  },
  {
    v: '1.54',
    date: 'Nov 6',
    items: [
      'Car keys from a house they know you broke into are reported wherever you’ve hidden them, and the car with them. Walking off to a car while someone’s in front of you in their house counts as running, like going anywhere else.',
    ],
  },
  {
    v: '1.53',
    date: 'Nov 6',
    items: [
      'Leave a house they know you were in (walking off while they’re in front of you counts as running) and their car is reported with the break-in, wherever you’ve put its keys.',
      'Police at the trunk: “Step away”, not “Step out”. The first time you go to a car you walk to it, not “back” to it.',
    ],
  },
  {
    v: '1.52',
    date: 'Nov 6',
    items: [
      'Someone bleeding too hard to stay awake can’t be slapped awake (the option says they’re too far gone), instead of coming to and passing out again in the same breath.',
      'A car towed while you stood at it can’t be emptied through its trunk. After time inside, the car hunt remembers how long ago you really took the keys.',
    ],
  },
  {
    v: '1.51',
    date: 'Nov 6',
    items: [
      'Looking for a car takes time: each block is a few minutes, and if it’s reported while you walk, it may be moved or towed before you find it.',
      'Throw away a car’s keys while you’re at it and you walk off. Police finding you at the open trunk say so. Waking up in a car that’s being towed happens once, not twice. The hunt screen remembers when you really took the keys.',
      'Tidier wording: “rent money in an envelope”, not “a rent money, in an envelope”; the glovebox doesn’t list its papers twice; a car someone just called in isn’t “not reported yet”.',
    ],
  },
  {
    v: '1.50',
    date: 'Nov 6',
    items: [
      'Someone already lying on the floor who passes out from blood loss doesn’t “slump to the floor” again; their eyes roll back. The same for you.',
      'Someone out cold and bleeding hard doesn’t come round only to pass out again the same moment.',
      'Cars: a towed car is gone for good, including while you’re at it or asleep in it. Car keys left in a trunk age like any others. Keys you’ve hidden keep their car on file. Throwing the fob away mid-search no longer leaves you on a dead screen.',
    ],
  },
  {
    v: '1.49',
    date: 'Nov 6',
    items: [
      'A cut brow that was stitched heals to a faint line, and the Marks card says so instead of calling it a face scar people will remember.',
    ],
  },
  {
    v: '1.48',
    date: 'Nov 6',
    items: [
      'Drunk, the whole screen sways, the buttons and text included, and every so often it lurches. Everything goes blurry, swimming in and out of focus, and gets worse the more you drink. Tranquilizers do it too, and heroin and fentanyl blur things a little.',
      'In a shop or with Pockets open it eases off so you can still read, but it doesn’t go away.',
    ],
  },
  {
    v: '1.47',
    date: 'Nov 6',
    items: [
      'Going through a room, or part of a car, shows you what’s there instead of grabbing it all. Pick what you want one thing at a time, or take everything from one place at once. Every pick-up takes a moment and makes a little noise.',
    ],
  },
  {
    v: '1.46',
    date: 'Nov 6',
    items: [
      'Car keys work differently now. “Find the car” takes you out walking the blocks, pressing the fob and listening for a chirp. Take too long and it’s been reported, moved, or towed.',
      'A car you find is its own place: go through the glovebox, the console, under the seats, the back seat and the trunk, each in turn. What’s inside fits whoever owns it. Someone may see you and call it in.',
      'Cars you have the keys to are listed in Where to?. Sleep in one, or keep things in its trunk, until it’s reported and towed.',
    ],
  },
  {
    v: '1.45',
    date: 'Nov 6',
    items: [
      'Time served counts for your body too: after months or years inside, the habit has faded and broken bones have knitted.',
      'Stolen things taken off you while you’re out cold are still stolen when you get them back: the pawn shop still knows a hot phone.',
    ],
  },
  {
    v: '1.44',
    date: 'Nov 6',
    items: [
      'Someone out cold doesn’t have their eyes “go blank for a moment”, and a punch that knocks someone out doesn’t say it only dazed them for a moment.',
      'A knife to the ribs opens the skin over them, not the bone. The Marks card names every scar, not just the one on your face.',
    ],
  },
  {
    v: '1.43',
    date: 'Nov 6',
    items: [
      'Blood splashing on the fight log no longer lets it slide sideways.',
      'A knife scar is where the cut was (ribs, chest), and the Marks card no longer says “On your face (face)”.',
      'Sentences read the way a judge says them (“19 months”, not a rounded-up “2 years”). Caught running from an upstairs flat, you get as far as the stairwell.',
    ],
  },
  {
    v: '1.42',
    date: 'Nov 6',
    items: [
      'Going straight from one address you know to another after a fight settles the first house properly: the dead stay there, and the police still come.',
      'Turned away at the pawn shop while you’re in someone’s house, you’re still in the house: the break-in isn’t over.',
      'After time inside, rooms you searched have filled up again, your rented bed lets you sleep, and “Last arrested” shows the right date.',
    ],
  },
  {
    v: '1.41',
    date: 'Nov 6',
    items: [
      'Fight text tidied: a hard punch to the head doesn’t “land” twice; ribs don’t grind before they’ve broken; nobody “barely stays standing” in the same breath as they drop.',
      'Someone shoved into a wall or standing firm against a rush isn’t knocked back a step, and a person with a broken leg no longer tries to kick you.',
    ],
  },
  {
    v: '1.40',
    date: 'Nov 6',
    items: [
      'After a long sentence, the date you broke into a place shows the year, so it doesn’t look like last week.',
      'A knife cut lands where the fight text said it did, and a heavy body blow no longer “lands” twice in one line.',
    ],
  },
  {
    v: '1.39',
    date: 'Nov 6',
    items: [
      'Walking off from a fight in someone’s house through Where to? counts the same as any other way out: a roommate you killed stays dead, and someone who ran to the neighbors still brings the police.',
    ],
  },
  {
    v: '1.38',
    date: 'Nov 6',
    items: [
      'Someone heavy who holds their ground against a bum rush, or a shove into the wall that leaves them standing, doesn’t “hit the sidewalk”. A trip says they go down hard, once.',
    ],
  },
  {
    v: '1.37',
    date: 'Nov 6',
    items: [
      'Fight text says things once: a bum rush doesn’t put them on the floor twice, a punch to the cheekbone isn’t a punch to the cheekbone twice, and a deep stab isn’t “deep into” twice.',
    ],
  },
  {
    v: '1.36',
    date: 'Nov 6',
    items: [
      'Arrested in someone’s house after a fight: they remember you from that night, heal while you’re inside, and what they told the police is the charge you just answered for, not a fresh report waiting for you when you get out.',
    ],
  },
  {
    v: '1.35',
    date: 'Nov 6',
    items: [
      'A debt that came due while you were inside shows the year it came due, so a year-old date doesn’t read like last week.',
    ],
  },
  {
    v: '1.34',
    date: 'Nov 5',
    items: [
      'Getting caught in one break-in no longer wipes what the police have on you for another (or for a killing someone saw).',
      'People heal during your time inside: an owner who had two broken legs when you went in is walking around by the time you’re out.',
      'Once Dez’s vig stops, he says so: he’s done adding to it, he wants it, or you.',
      'Time inside also fades your name on the street, and lifts a pawn-shop ban.',
    ],
  },
  {
    v: '1.33',
    date: 'Nov 5',
    items: [
      'Two small fight wording fixes: a throw doesn’t say they’re on the floor twice, and someone let go from the floor on a broken leg gets up before they limp off.',
    ],
  },
  {
    v: '1.32',
    date: 'Nov 5',
    items: [
      'Dez’s vig runs for two weeks late and then stops growing: after that he isn’t after interest, he’s after you. (No more billion-dollar debts after a stretch inside.)',
      'Old car keys in your pockets say the car’s been reported, the same as the fence does.',
      'A deadbolt is only “still shiny” for the first month. The coin machine won’t take less than a dollar’s worth, and the teller tells you when there’s nothing to change.',
      'Arrested in a house: no leftover note from inside waiting on the street when you get out.',
    ],
  },
  {
    v: '1.31',
    date: 'Nov 5',
    items: [
      'Caught trying to run out of a house: charged once for it, not again later off the same description.',
      'Nobody changes the locks on a dead man’s house when he lived alone.',
      'Time inside counts for everything, not only houses: car keys go cold, the rent at the Marlow runs out, Dez’s money comes due, and the people you hurt heal.',
      'Running from someone on the floor reads like it; running out of a house says “up the road”, once. Someone on a broken leg doesn’t back out of the room when you let them go.',
    ],
  },
  {
    v: '1.30',
    date: 'Nov 5',
    items: [
      'A car at the fence really pays in twenties now.',
      'A sale that was a sting: what happened is at the top of the police stop, not a note waiting for you when you get out.',
      'Time in jail counts for the houses you know: after a year inside, the police have long gone from the address, and the locks have long been changed.',
      'Someone coming home through a door you kicked in finds the body in the hall through the broken door, not with their keys.',
    ],
  },
  {
    v: '1.29',
    date: 'Nov 5',
    items: [
      'Beaten by someone in their house after you hurt them: it’s still assault, and the cash you took off them is still taken back.',
      'Running past the police out of a house doesn’t wipe the slate: the break-in, and any body you left, are on file the same as if you’d walked out.',
    ],
  },
  {
    v: '1.28',
    date: 'Nov 5',
    items: [
      'Someone on the floor can’t chase you down: run, and only your own legs can stop you. It no longer says “they’re on you” when they’re lying there.',
      'Someone you woke up doesn’t have a wallet in their pajama pocket. Running out of a house goes out the door, not “a block later”.',
      'Someone in bed on two broken legs tries to come at you and ends up on the floor beside it, so what happens next adds up.',
    ],
  },
  {
    v: '1.27',
    date: 'Nov 5',
    items: [
      'Knocked out in someone’s house, you come to with the police already there: no going through a room or walking out in cuffs in the second before they show up, and the note about it isn’t waiting for you after jail.',
      'Bleed out on someone’s hallway floor and nobody goes through your pockets; the police bag your things.',
      'Someone who comes home to a body in the hall says so, and their call is their own.',
      'A car at the fence pays in twenties, not a brick of fives and ones.',
    ],
  },
  {
    v: '1.26',
    date: 'Nov 5',
    items: [
      'One car per house, however you come at it: a spare left on the hook is worthless once you’ve had the car with their own keys.',
      'Cut someone in their own home and they get away: that’s still assault when the police get you there. Cash you take off them goes in the evidence bag with the rest.',
      'Die fighting someone in their house and they’re still remembered with their shoes, coat and wallet.',
      'Someone who owns the house drives the car parked out front, not some other car.',
    ],
  },
  {
    v: '1.25',
    date: 'Nov 5',
    items: [
      'Someone you woke up in their house gets their shoes, coat, wallet and keys back afterwards: meet them on the street later and they’re dressed, not barefoot in a T-shirt.',
      'Your own limp isn’t erased from the fight log when they’re the one who goes down.',
      'Someone in bed on two broken legs stays in the bed, and doesn’t say the same thing every turn.',
    ],
  },
  {
    v: '1.24',
    date: 'Nov 5',
    items: [
      'Fixed: what you took from a room in someone’s house stayed there to be taken again (and a car off the kitchen hook could be sold over and over). Once it’s in your pockets, it’s gone from the room.',
    ],
  },
  {
    v: '1.23',
    date: 'Nov 5',
    items: [
      'Someone you wake up has nothing in their pockets: the wallet, the keys and the phone are on the dresser, not on them.',
      'Fights in a house stay in the house: gunshots are deafening in the little room, people back out of the room instead of weaving down the street, and anyone who runs is out the door, not ducking into a crowd.',
      'Someone on two broken legs stays in bed screaming for help, and says so every turn instead of “their leg gives way”.',
      'A mugging reads in order: you get up close, then the knife comes out. A snatch-and-run says they run. Nobody limps a step and goes down in the same breath.',
    ],
  },
  {
    v: '1.22',
    date: 'Nov 5',
    items: [
      'Caught in a house, they take the cash you took out of it, and someone else’s house keys count as evidence. Beat up whoever lives there and that’s assault on top.',
      'After a break-in, the new camera or alarm goes in with the new locks, not the minute you leave.',
      'A dog that barks when you knock isn’t followed by “not a sound from inside”. Someone woken barefoot doesn’t kick you with a boot.',
      'What was said in the house stays in the house: no old fight note waiting for you on the street.',
      'The pawn clerk who took your ID once today doesn’t suddenly doubt it on the next sale. “A year in state prison”, not “1 years”.',
    ],
  },
  {
    v: '1.21',
    date: 'Nov 5',
    items: [
      'Walking off while someone in the house is staring at you counts as running: they saw your face.',
      'A car can only be had once, whichever set of keys you use. Kill someone’s roommate and they don’t come back; kill the owner and the locks still get changed if anyone else lives there.',
      'A new life can learn the addresses an old one knew, all over again.',
      'Fights in someone’s home read like it: no streets or gutters, no “money at home”, no walking off into the dark. Someone woken up is barefoot and without a coat; someone on two broken legs can’t get up to fight; the phone they were calling on isn’t in their pocket.',
      'Dragging someone down who keeps their feet says so, instead of describing a body blow.',
    ],
  },
  {
    v: '1.20',
    date: 'Nov 5',
    items: [
      'Cuffed on someone’s floor, there’s no Run button any more, and you only come to once.',
      'At a house, what just happened is always in view at the top, even on a small phone.',
      'Someone woken up in their own bed isn’t carrying groceries. Leaving someone out cold in their house reads like it, and you stay inside.',
      'Small fixes: no “quiet” while the alarm screams, “the envelope of cash”, “you broke in today”, and the result of a sale fits on a short landscape screen.',
    ],
  },
  {
    v: '1.19',
    date: 'Nov 5',
    items: [
      'Break-ins are harder to game. Walk away and come back, and the place remembers: a door you tried stays locked, and after an alarm or a call there’s a patrol car out front for an hour (longer if there’s a body).',
      'What you see from outside isn’t the whole truth any more: a lamp on a timer, a TV left on for the dog, a car at home while they took the bus. Knocking doesn’t tell you who’s in.',
      'Knock someone out in their house and you can keep going through it; let them go and they run for help. Kill someone in there and the police find the body: that’s homicide on top.',
      'Beaten by the person who lives there, you come to already cuffed: no running.',
      'Only traceable things count as stolen (electronics, jewelry, a car’s keys), not their painkillers or beer. Jewelry gets photographed for the police log at the pawn shop too. A car can only be stolen once: the spare on the hook is only there if the car is.',
      'IDs: a state ID isn’t a driver’s license, and nobody’s card was issued before they were sixteen. Residents talk and fight like they’re in their own home (he/she, the floor, not the sidewalk).',
      'Lots of smaller wording fixes, a rooming-house room that’s just “the room”, and a burglary sentence closer to the real thing.',
    ],
  },
  {
    v: '1.18',
    date: 'Nov 5',
    items: [
      'People’s names fit them now (no more men called Grace), and your own name could be anyone’s.',
      'IDs carry everything a real one does: date of birth, sex, height, weight, eyes, hair, address, license number, issue and expiry dates, organ donor.',
      'Take someone’s ID and you know where they live: it’s under Where to?, in Addresses you know. Walk over and look at the place: lights, a car out front, an alarm sign, a doorbell camera.',
      'Knock to see if anyone’s home, try the doors and windows, break a window or kick the door in. Their house keys let you walk straight in, until they change the locks (a day or two after the keys went missing).',
      'Inside, go through the bedroom, living room, kitchen and bathroom: cash, jewelry, laptops, car keys on the hook. Every room is time and noise. Someone asleep can wake up; someone out can come home. Then they’ve seen you: run, or fight them in their own hallway. Either way it’s home invasion, not burglary.',
      'Alarms, dogs, neighbors who call it in, and police at the door. Pawn shops log serial numbers. Stolen goods are evidence if you’re searched.',
    ],
  },
  {
    v: '1.17',
    date: 'Nov 5',
    items: [
      'With a warrant out for you, your record no longer says “Clean” and “the police have nothing on this face”: it says you’re wanted.',
      'Dez’s man is shown as Dez’s man, not as a passerby.',
    ],
  },
  {
    v: '1.16',
    date: 'Nov 5',
    items: [
      'Turning yourself in on a warrant, you’re booked like any arrest: they go through everything on you, keep the drugs, the stolen cards and the zip bags, and charge you for them. With heat on you, they may search your room too.',
      'A dismissed case doesn’t end your probation; only a conviction uses it up.',
      'Hiding cash behind the brick can be seen, like hiding anything else. Paying rent in the two days’ grace doesn’t tell you the rent ran out as you pay it.',
    ],
  },
  {
    v: '1.15',
    date: 'Nov 5',
    items: [
      'Someone who comes over to buy from you is face to face: no kicking their knee or choking them “from behind”, and they’re hard to take by surprise.',
      'They came to buy, so they mostly do. If they change their mind, they leave rather than “keep going”. Only people who know you deal come over asking.',
      'Nobody buys from someone with anything in their hand (a bat or a gun, not only a blade). Nobody on two broken legs grabs the bag and runs.',
    ],
  },
  {
    v: '1.14',
    date: 'Nov 5',
    items: [
      'Every sting you ran from is charged and goes on your record when they catch up with you, however that happens: even if you were already wanted for missing court, or got stung twice.',
      'Jump bail by running from a sting, and when they catch you there’s no bail this time.',
      'Convicted while on probation, the probation is used up: it doesn’t keep making every later arrest worse.',
    ],
  },
  {
    v: '1.13',
    date: 'Nov 5',
    items: [
      'A warrant for a sting you ran from is properly served when they catch you: you’re charged with selling, with bail and a court date, and it goes on your record. Turning yourself in for it puts it on your record too.',
      'Once that warrant is dealt with, a later missed court date counts as a missed court date again.',
      'An undercover buyer always pays with a marked twenty of their own. A break-in found as you pay your rent is mentioned.',
    ],
  },
  {
    v: '1.12',
    date: 'Nov 5',
    items: [
      'Running from a sting while out on bail costs you the bail. The warrant is for the buy you ran from, not a missed court date (no failure-to-appear charge), and the You sheet says so. The marked money is only taken if they actually take you.',
      'Dez’s man is a man, and nobody says you’ve never met him. When he catches you, he takes everything in your pockets (and keeps what’s over the debt, for the trouble). Short, he takes your phone, weapons and drugs too. Dez’s people don’t go to the police.',
      'Hurt a customer and they stop being one straight away. A new you isn’t the old one’s dealer.',
    ],
  },
  {
    v: '1.11',
    date: 'Nov 5',
    items: [
      'A sale to an undercover cop is a marked twenty, and they take it back when they cuff you. Get away from a sting on foot and they’ve got the buy on camera: a warrant goes out for you.',
      'Junkies usually have hustled up a few dollars, so they buy (and the desperate ones still grab). People you’ve met before have money on them again after a while.',
      'Word that you’re holding brings buyers over instead of scaring them off. Nobody buys from someone in a ski mask or with a knife out, and few do in broad daylight.',
      'The Hotel Marlow’s lobby isn’t your room: only a rented room lets you smoke, drink, use, bag up, mask up or burn things. You sleep there when you’re tired, not on demand.',
      'Reloading at the alley or in your room doesn’t keep a stash or room safe: it’s checked as if you’d walked in. Paying rent after they’ve cleared the room tells you so. Break-ins can take what’s under the board, not just cash.',
      'Hurt a regular and they’re not your customer any more. A sale doesn’t re-report an old fight. Booking takes the zip bags too. People who bought from you no longer push the people you’ve hurt out of the game’s memory.',
    ],
  },
  {
    v: '1.10',
    date: 'Nov 5',
    items: [
      'Dez, by the dumpsters in the alley at night. He doesn’t sell to strangers: make a sale first, and he’ll sell you an eight-ball for $180 cash (about 35 points once you bag it up).',
      'Move enough and he’ll front you one on credit: $280, due in three days. “I know where you sleep.” Pay him back in the alley, all at once or what you have.',
      'Be late and it grows by a fifth every day, he won’t sell to you, and he sends someone to find you on the street. Lose, and everything in your pockets goes to Dez. Beat them, and the next one is bigger. What you owe is on the You sheet.',
      'Carrying an eight-ball, or ten points or more however it’s bagged, counts as possession with intent.',
    ],
  },
  {
    v: '1.09',
    date: 'Nov 5',
    items: ['“Stamp” is now “stomp” everywhere, the American way, matching the rest of the game: “Stomp on their hand”, and the stomps in the fight text.'],
  },
  {
    v: '1.08',
    date: 'Nov 5',
    items: [
      'The note that waits for you stays clear of the clock and the date, and “Tap to go on” always shows at the bottom of it (a long note scrolls above it).',
      'The knockout note looks the same before and after a reload. On short landscape screens the death screen fits, button and all.',
    ],
  },
  {
    v: '1.07',
    date: 'Nov 5',
    items: [
      'Dealing. Buy zip bags at the gas station and bag up coke in Pockets, a point in each. Then ask the people you lurk on if they’re looking. Junkies buy most, drunks late at night, a civilian now and then. They pay the going rate if they have it, or whatever they’ve got. Some grab the bag and run (catch them and it’s yours again). Speech helps.',
      'Buyers remember you: a regular comes over instead of running, and asks for the same again. Every sale gets your name around, to buyers and to the police.',
      'Some of the civilians are undercover cops, more of them the hotter you are. A sale to one ends in handcuffs: selling a controlled substance. Caught with three bags or more, or bags and the zip bags to make more, it’s possession with intent to distribute.',
      'A stash: the loose brick in the alley. Hide things and cash behind it from Pockets. Someone may find it over time, much sooner if anyone saw you use it, and the man by the vents often does.',
      'The Hotel Marlow: a room by the week, $175 cash, no questions. Sleep there for eight hours, warm and safe. Leave things under the board by the radiator. You can smoke, drink and use in your own room. Fall two days behind and they clear it out. Someone might get into it. Arrested with heat on you, the police may search it too.',
      'Also fixed: dying in an indoor place with people about (not only the ER) doesn’t get your body robbed. The ER remembers it has seen you after a reload. Someone out cold can’t rob you. The cracked glass ignores a single stall.',
    ],
  },
  {
    v: '1.06',
    date: 'Nov 5',
    items: [
      'A beating past saving stays fatal: walking away straight after doesn’t let them live.',
      'Someone let go from the ground gets up before they run off, and nobody with a broken leg is “gone fast”.',
    ],
  },
  {
    v: '1.05',
    date: 'Nov 5',
    items: [
      'Sent down at your hearing while bleeding, they see to the wound before you serve your time, as they do in a cell. You no longer bleed out inside and get robbed “on the street”.',
      'Dying in the ER, the death screen says so, not that there was nothing on you worth taking.',
      'An hour by a fire moves things on like any other hours: whoever was across the street is gone, and the note that was waiting for you is put away.',
      'The cracked-glass double image now really does switch itself off on the very slowest phones.',
    ],
  },
  {
    v: '1.04',
    date: 'Nov 5',
    items: [
      'Refusing to be mugged and swinging at you, or swinging a crutch when cornered, they don’t give up in the same breath. Neither do they right after flatly refusing to give it up.',
      'A needle dose landing later fits what they’re doing: running, given up, or already on the ground. A hard knock to the head no longer pulls someone back from dying.',
      'Someone with a broken leg who you let go limps off or stays put; they don’t run. Nobody steps aside or stands over you while lying on the ground.',
      'A polished trip is a sweep until it lands. A wall slam on someone facing you isn’t “before they know you’re there”. Both on the floor, nobody “swings down” at you.',
      'With both legs broken, Get up is greyed out, and crawling away doesn’t have you standing.',
    ],
  },
  {
    v: '1.03',
    date: 'Nov 5',
    items: [
      'Someone who comes after you (an ambush, a grudge, spotting you following) no longer gives up on the very swing they started with.',
      'A knife they dropped at your feet stays on the ground: they can’t cut you with it after you hit them anyway.',
      'Someone who knows you can’t be fooled by acting natural. A sucker punch on someone watching you comes from the front, not “from behind”. “Drag them down” is an attempt until it works.',
      'Nobody stands up on two broken legs. Nobody with both arms broken jumps you. Someone let go from the ground gets up before they run.',
      'Fixed: dying to someone already carrying your things could split them into two people and lose the new things. Whoever robs your body lies low for a while too.',
      'Thrown out of the gun store for a fake ID, you’re told why. A stranger who knew you by reputation, and doesn’t once you cover up, isn’t shown as knowing you. “People who remember you” counts only people who know this you.',
      'No doing coke at a shop counter. The cracked-glass double image doesn’t switch itself off just because you went to another app and came back.',
    ],
  },
  {
    v: '1.02',
    date: 'Nov 5',
    items: [
      'The note that waits for you can’t grow up over the clock and your blood any more: a long one scrolls, and only the latest few things that happen meanwhile are added under it. It’s still there after closing and reopening the game.',
      'Chases say “They’re running” on every screen size, with how far ahead they are under the Chase button.',
      'On short landscape screens a greyed-out police choice (like bail you can’t afford) still says why, and the death screen scrolls instead of being cut off.',
      'Small wording: your court date says “today” on the day, and County’s food is only gray once.',
    ],
  },
  {
    v: '1.01',
    date: 'Nov 5',
    items: [
      'Small fight text fixes: kicking someone out cold from the ground, and letting someone go while you’re on the ground, read right. Someone knocked out after giving up is just out cold.',
    ],
  },
  {
    v: '1.00',
    date: 'Nov 5',
    items: [
      'However a fight ends (you walk off, let them go, they get away, you run), someone left bleeding badly may not make it. Slapping them awake first doesn’t save them, though awake they have a better chance of stopping it. If they die, it’s on you.',
      'Someone who’s already watching you is much harder to take by surprise or mug, and there’s no kicking their knee or choking them “from behind” when they’re facing you.',
      'Taking your mask off after someone’s already seen you no longer dodges being known by your reputation.',
      'On the ground with them out cold: no pepper spraying an unconscious face, and the punches read right. On the ground with them given up: they bolt instead of being slammed into a wall, and you can let them go from there.',
      'Cuts read as bad as the blood they let. “Pack of cigarettes” gets its “a”. People woken up after giving in don’t “come to swinging”, and nobody sways on their feet while lying down.',
      'Fixed: things robbed off you could end up on two copies of the same person, so you could take them back twice. Things taken off your body could vanish when your killer turned up again. Someone you killed could come back if you died before leaving the body.',
      'A new you no longer inherits the grudge or the fear someone had of the old you. Convicted again while on probation, there’s no deal: it’s time.',
      'Someone who just robbed you lies low for a few hours before you can run into them. “The heroin has worn off” only shows when it was still on. The note that waits for you is cleared when hours pass or you die, and isn’t added to from Pockets.',
    ],
  },
  {
    v: '0.99',
    date: 'Nov 4',
    items: [
      'Seeing double: as you’re hit toward going out and the glass cracks, each shard between the cracks bends the light its own way. What’s behind it shows twice, a faint copy shifted a few pixels and broken off sharp along the crack lines, and it gets worse the closer you are to going out.',
      'It’s a heavy effect on some phones: if it slows the game down it switches itself off, and it’s off on the Low graphics setting.',
    ],
  },
  {
    v: '0.98',
    date: 'Nov 4',
    items: [
      'When you’re done with someone, what happened stays on the screen until you move on: tap the street, lurk, rest or go somewhere. The same goes for what you find when you come to after a knockout. Anything else that happens meanwhile (the weather, a cigarette burning down) shows underneath it.',
    ],
  },
  {
    v: '0.97',
    date: 'Nov 4',
    items: [
      'A pack is now called a “Pack of cigarettes”, so it’s easy to tell from loose ones. Packs you already had are renamed.',
      'Drop is now Trash in Pockets: it’s gone for good, so the button says so.',
    ],
  },
  {
    v: '0.96',
    date: 'Nov 4',
    items: [
      'Someone you leave out cold and bleeding badly may not make it. Walk away and they can bleed out where they lie, and that’s on you.',
      'People you hurt don’t turn up again within the hour: it takes a while, longer if they ended up in the ER with a break. Someone you killed can’t come back carrying your things.',
      'When you die mid-fight, what you did to them stays on them for the next you. A new you meeting someone the old one hurt starts fresh with them.',
      'Someone holding a card they took off you no longer gives the card owner’s name as their own.',
      'Fixed: someone you drugged could keep running after passing out. The game loaded from a backup save couldn’t save. Coming back to the death screen left the pause menu half there.',
      'An overdose death after a fight says you overdosed, not that you bled out. Hours out cold from blood loss move highs and the drink on like any other hours, and what wears off while you’re gone is said.',
      'A pat-down finds their weapons and makes them drop them. Rain eases off more often than it gets heavier. “Opens Monday” names the right day across a clock change.',
    ],
  },
  {
    v: '0.95',
    date: 'Nov 4',
    items: [
      'What a victim remembers is how you looked while they could see you. Pulling a mask on after the fight doesn’t help, and taking it off after doesn’t hurt.',
      'Whether someone knows you is decided when you see them, and only checked again if you change how you look before you walk up. Covering your face also works against strangers who know you by reputation.',
      'A warrant doesn’t fade: the police keep looking until you deal with it.',
      'Caught after running from a stop, you’re still charged with what they stopped you for (the stolen car, the weapon in your hand). At booking they go through everything, bag included, and what they find is charged.',
      'Assault is only charged when someone who saw your face went to the police, not just because the police are after you. A killing someone saw, with your face showing, can get you charged with homicide, and that’s years.',
      'Probation lasts a month, and being convicted again while you’re on it makes the sentence much worse. Being released without charge no longer cools the police off.',
    ],
  },
  {
    v: '0.94',
    date: 'Nov 4',
    items: [
      'Chases: the Chase button now shows how far ahead they are, and why you can’t (a broken leg). The screen is titled “They’re running”, not “Fight”. When a chase ends because you ran out of breath, couldn’t get up, or let them go, the closing note says so.',
      'Holding a blade to someone’s eye is pure fear: it no longer makes them pass out “from the pain”. Cutting the second cheek says the other cheek.',
      'Lists of what’s on someone say “$105 in cash”, not “cash, $105”. The courthouse opening while you wait with a knife doesn’t say the detector shrieks twice.',
      'Small layout fixes: the label after moving something in Pockets stays on screen, fight buttons don’t shift the list sideways when they jolt, and on very short landscape screens the police choices show just their names so the text has room.',
    ],
  },
  {
    v: '0.93',
    date: 'Nov 4',
    items: [
      'Writing pass on fights, messages, shops, the police and court, status cards and menus. Lines that read wrong once a name or a body part was filled in are fixed (“light the some cardboard”, “A $800 fine”, “You drop a fist on them in the face”), along with clumsy joins, mixed tenses, plurals (“1 hours”) and US spelling.',
      'Blood amounts drop the extra zero (“5 L”, not “5.0 L”). The weather no longer says “a few drifting flakes” while it’s still snowing hard.',
      'With both hands full, “Pepper spray them” is greyed out and says why, instead of looking like it would work.',
    ],
  },
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
      'Fight text fixes: someone on the floor or out cold no longer “staggers” or “limps”; the hard cases only spit blood when they’re bleeding.',
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
