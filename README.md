# DarcVoyd

A GPU-heavy game for mobile, being built from scratch. Right now it has a
black, film-styled menu (grain, flicker, colour fringing, glitches), settings,
a pause-based save system, and the start of the game: a television in the dark
with one option, Turn on. Once it warms up there's one option: Lurk. Each
lurk, the signal cuts out while you wait, then whoever you saw appears as a
button: a civilian, a drunk, someone homeless or a junkie, each of one of the
U.S. standard race categories.

## Direction (planned, not built yet)

- A **2D** game where the visual effects are the focus.
- Gameplay mixes **side-scrolling** sections and **top-down** sections.
- Tone: dark and creepy, in the style of the film-grain / glitch menu and the CRT television.

## Play

**Play in your browser:** https://wh173-0u7.github.io/Unamed-/

Every push to `main` (or the development branch) rebuilds the game and
publishes it there automatically (see `.github/workflows/deploy.yml`).

- **Playing:** press *Turn on*, then *Lurk*. After a moment of static, who
  you saw shows up as a button (type, and race underneath). The chances each
  time: civilian 42%, drunk 24%, homeless 20%, junkie 14%. Each person's race
  is one of the 7 U.S. federal (OMB 2024) categories, equally likely (race is
  descriptive only; it changes nothing in play).
- **Tap the person**, and your options are sorted into **tabs** you can flip
  between freely (switching tabs costs nothing; only picking an option does
  anything): **Surveil | Violence** before anything happens, then in a fight
  **Attack** (punch, kick, grapple), **Violence** (stamping on their head,
  stomach or ribs, once they're down), **Search** (once they're unconscious
  or dead) and **Move** (run, get up, catch your breath, walk away). When
  things change (they fall) the tab that matters jumps to the front; once
  they're **unconscious, nothing is open until you choose**: Violence,
  Search or Move. *Leave them* / *Lurk again* / *Rest* sit below the tabs.
  Their card also shows what they're **wearing**.
- **When it's over, it's over:** walk away, let them go, lose them, get
  beaten, and the encounter screen closes; you're back on the street, and
  how it ended (and anything that happened to you after) shows as a note. A
  body stays until you've searched it and **Walk away**.
- In a fight their card folds to one line (who they are; tap it for what you
  know), the log always keeps room for a few lines, loot buttons are smaller
  and scroll, and the buttons that are always there sit in one slim row.
- Someone unconscious can't dodge, block or roll away: every blow lands.
- **Blows that land are highlighted** in the log: yours in **gold**, theirs
  on you in **red**, with the blood it cost picked out.
  - **Surveil:** *Follow* to get closer (across the street → behind them →
    right on them), then find out their **build** (which shows how hard a
    fight would be: Easy, Fair, Hard or Brutal), what they're **carrying**
    (needs you to follow first; some things are weapons), how **aware** they
    are, and whether they're **male or female**. Everything you do fills the
    *Noticed* bar, faster the more aware they are. If it fills, they run, or
    turn and fight.
  - **Violence:** *Bum rush* (can knock lighter builds down), *Sucker punch*
    (hits hardest on someone unaware), or *Shove* (most likely to land, throws
    them off balance). Getting close first helps. Then the fight: *Punch*,
    *Kick* (*Stomp* if they're down), *Grapple* (throws them down), *Run*,
    *Get up* (when you're on the floor) or *Catch your breath*, turn by turn,
    with a log of what happens to them and to you. They may pull a weapon,
    pepper spray you, or run when losing. When it's over the log is cleared;
    the title says how it ended.
- **Searching people:** once someone is unconscious (or dead), the Search
  tab lists their clothes (a top, trousers, shoes, and any backpack or
  grocery bag). Searching a garment takes a moment (they keep bleeding) and
  shows what's in it and where: **cash**, a **cell phone**, **car keys**,
  their **ID** (a driver's license with their name and age), **debit and
  credit cards** in their name, and odds and ends (**receipts** from local
  shops, **notes**, cigarettes, house keys...). Wallets turn up in a back
  pocket or inside a jacket; homeless people sometimes hide cash in a shoe.
  Take things one by one, or **Take everything**. What they carry while
  you surveil them decides what's in their pockets.
- **You wear clothes too**, random ones, like everyone else (a top,
  trousers, shoes, and maybe a backpack, shoulder bag or fanny pack), and
  **what you carry goes in their pockets**. Each pocket or bag holds only so
  much, in **kg**, and only things up to a size:
  - **Small** things (phones, keys, cards, ID, receipts, cigarettes,
    lighters, most medicine) fit in pockets: jacket pockets 0.5 kg each
    (0.4 inside), jeans front pockets 0.4, back pocket 0.3, a hoodie's front
    pocket 0.9, a shirt's chest pocket 0.2. A T-shirt has none.
  - **Medium** things (a water bottle, a notebook, headphones, a lunch tub,
    a splint) need a bag: a shoulder bag holds 5 kg, cargo pockets 1.5.
  - **Large** things (a bag of groceries) need a backpack (12 kg).
  Things go in the smallest place they fit. If there's no room, you can't
  take it, and you're told why ("too big to carry without a backpack").
  *Take everything* takes what fits and leaves the rest.
- **Pockets** (pull it in from the **right edge** of the screen, or tap its
  tab there): your cash, what you're wearing, the weight you carry, and
  every pocket and bag with how full it is and what's in it. Medicine can be
  **used** from here, and anything can be **dropped** to make room. Your cash
  also shows under your blood.
- **Weather, on the real clock.** Dry spells of one to three hours, then
  drizzle, rain or a downpour for a quarter of an hour to an hour or so; it
  keeps changing while the game is closed. The clock shows it ("Rain"), and
  you're told when it starts, picks up, eases or stops. Indoors (the
  pharmacy) it isn't raining on you.
  - **Rain on the glass:** drops land and bead up, grow and merge, and once
    heavy enough run down in fits and starts, leaving a trail of tiny beads
    and **washing a thin path through the blood and grime**. Rain streaks
    fall over the picture behind everything; in a downpour lightning
    flickers. When it stops, the drops dry up.
  - **Getting cold:** lurking in the rain soaks you: *Chilled*, *Cold*, then
    *Freezing* (a coat or puffer helps; a T-shirt makes it worse). Cold
    stiffens you (less stamina in a fight, 10% a level) and slows your body
    making blood back. Dry weather dries you off slowly; resting in a
    doorway warms you a little (more if it's dry); the pharmacy's warm
    inside.
- **A lighter makes a fire** (*Fire* in your pockets, on the street): it
  burns a receipt or note from your pockets for kindling (or cardboard, if
  there's some about), in an old oil drum. An hour by it and you're warm
  right through. Rain makes it hard to get going; a downpour puts it out.
  Cheap lighters run dry now and then.
- **A lighter (or matches) also burns evidence:** **Burn** on a stolen ID,
  credit card or debit card in your pockets holds it in the flame until the
  face or the numbers are gone, and drops what's left down a drain. Not
  indoors; in the rain it can take a few tries.
- **A small baggie of white powder** says only that. To find out what it
  is, **Taste** it (rub some on your gums) or **Test** it with a *Drug test
  kit* ($10 at the pharmacy, one use). It's cocaine. Once you know, a
  **Bump** makes you *Wired* for the next fight: a quarter more stamina,
  and a concussion hurts a little less. It wears off after the fight (or a
  rest), and leaves you hollow. A baggie holds a few bumps.
- **Autosave** every 15 seconds while you play, as well as whenever the game
  pauses (the pause button, or leaving the app). Saves live in this browser
  on this device: an in-app browser (opening the link inside a chat app) or
  a private tab can throw them away when closed, so play in your normal
  browser, or add it to your home screen.
- **A clock** in the corner shows your device's real time and date. The
  game runs on real time: future features will take real time to happen
  (waits, healing, travel), counted from your device's clock even while the
  game is closed. (The save already records when you were last there.)
- **Go** (pull it in from the **left edge**, or tap its tab) opens *Where to?*: **The street** (where
  you lurk) or the **Pharmacy**, open all night. It sells, cash only:
  *Bandages* $8 (bleeding down a level), *Gauze and tape* $15 (down two),
  *Painkillers* $6 (a concussion clears 3 hours sooner), *Splint* $22 (a
  broken arm or leg heals twice as fast) and *Iron tablets* $12 (+0.4 L of
  blood) and a *Drug test kit* $10. You can't lurk anywhere but the street;
  Go takes you back out. Where you are is saved. Every place shows its
  **opening hours, by your device's clock** ("Open until 7 PM", "Closed.
  Opens tomorrow at 10 AM"), in the Go list and inside.
  - **Lucky Star Pawn** (10 AM to 7 PM, Saturday to 5, shut Sunday) buys
    phones, headphones and chargers for about a fifth of what they're worth,
    paid from the till. By law he wants to see **photo ID** first: you have
    none of your own, so it has to be a stolen license, and one time in five
    he looks closely and throws you out. He won't touch IDs, cards, car keys
    or drugs. He sells second-hand **bags and clothes** (a backpack $25, a
    shoulder bag $14, a fanny pack $6, a coat, a puffer jacket, a hoodie,
    cargo pants) and lighters: you put them on there and then, everything
    you carry is repacked, and your old ones go in the bin (if it won't all
    fit, he tells you).
  - **The alley** behind the laundromat (8 PM to 4 AM, every night): the
    **fence** takes anything worth anything, stolen IDs and credit cards and
    car keys and coke included, no questions, for even less (a phone gets
    you about $14). He pays with crumpled small bills off a roll. It's
    outside: the rain gets you here too.
  - **First Civic Bank** (weekdays 9 to 5, Saturday 9 to 1): the teller
    **changes up** your small bills and coins into the fewest big bills, or
    **breaks** a big bill down ($100 into five 20s, $50 into two 20s and a
    10, $20 into a 10 and two 5s, $10 into a 5 and five 1s, $5 into five 1s,
    $1 into four quarters). Out of hours the **coin machine** in the lobby
    still turns coins into bills, and keeps 10%.
- **Money is real bills and coins:** $100, $50, $20, $10, $5 and $1 bills,
  and quarters, dimes, nickels and pennies. People carry it the way people
  do: wallets of mostly 20s with some smaller bills, loose change in coins, a
  homeless person's few singles folded small in a shoe. Pockets shows yours
  as notes and coins ("$20 ×2, 25¢ ×7"). **Paying** hands over exact money if
  you can, otherwise the smallest overpay, and you get change back the way a
  cashier gives it. Coins have weight (a quarter is 5.67 g) and count toward
  what you carry.
- **People remember you.** Everyone you fight and leave alive is kept, as a
  person: who they are, the state you left them in, what you did to them,
  whether they saw your face (or only what you were wearing), and how much
  they hate you for it (**grudge**). Their injuries heal on the **real
  clock**, the way they would: a broken arm is in a cast for six weeks, a
  leg for eight (on crutches), a nose taped for three, a split lip four
  days, a black eye ten, a cut brow leaves a scar, and teeth you knock out
  stay out. Lurk, and now and then it's one of them (the angrier they are,
  the more likely): their card says how they look ("Left arm in a cast · 2
  teeth missing") and what you did ("You broke their left arm and knocked
  them out. 3 days ago."), and they fight as they are, cast and all.
  - **If they know you** (your face, unless it's covered, or the clothes you
    wore that night): the angry ones come straight at you; someone on
    crutches can't run, and backs against the wall; the rest run.
  - **Vengeance:** the ones who hate you most come looking. Sometimes,
    instead of you finding them, they find you: a hand on your shoulder,
    "Remember me?", and the fight starts with them.
- **Lasting injuries, consistent descriptions:** every blow's description
  sticks. A tooth knocked out is gone (and the count goes up); a split lip
  splits *again*; a broken jaw grinds; a cut leaves a scar where it was. The
  same goes for you: your marks show with your conditions, and heal (or
  don't) with time.
- **Your face, and anonymity.** The pawn shop sells a **ski mask** (hides
  90% of your face), a **bandana** (55%), a **surgical mask** (40%), a
  **baseball cap**, a **beanie** and **sunglasses**; a hood helps too (pull
  it up in Pockets). Masks are pulled up and down in Pockets ("Your face: 90%
  hidden"). A mask hides you but draws eyes: people get wary of you faster
  while you follow them, and you pull it down before you go inside anywhere.
  What they saw of you is what they remember: masked, they only know your
  clothes, so change your coat.
- **Reputation and the police.** Every victim who saw your face talks
  (*Nobody*, *Talked about*, *Known*, *Feared*, *Notorious*); a killing
  someone saw is talked about most. With a reputation, strangers start to
  know your face, and run. Victims go to the police (most civilians, few
  junkies), and so do witnesses: **heat**. Both fade with time (real days).
  With heat on you, a lurk can turn up a **patrol car** instead: **stay
  calm** (they make you take your mask off, and search you: stolen IDs or
  cards or drugs on you, or a face that matches what they've been told, and
  you're arrested) or **run** (agility against your injuries; caught, and
  they put you on the ground first). Arrested: they keep the evidence, and
  you spend the night in a cell. Burn the evidence first.
- **Tap your stats** (top left) to see what each one does for you right now,
  in numbers ("Ambushes land +12%", "Damage ×1.24"), how far to the next
  level and how it grows; and the rest of you: stress, nerve, humanity,
  reputation, heat, how hidden your face is, how many people remember you.
- **Fear, mugging and torture.** Everyone has a fear of you (a bar in the
  fight view: Calm, Wary, Scared, Terrified). It starts from how frightening
  you are (Intimidation, Strength, how far gone you are, a mask) and who they
  are (drunks are braver, big builds braver still), whether they know you and
  what you did to them last time, and your reputation; every blow you land
  raises it. **Mug them** instead of ambushing: scared enough, they give up.
  Mid-fight, tell them to **"Give it up"**, and the terrified give up on their
  own. Someone knocked out (but not bled out) can be **slapped awake**. Once
  they've given up: make them **empty their pockets** (if they're not scared
  enough they hold the best thing back), **pat them down** to be sure,
  **threaten** them, ask **"Is that everything?"**, get the **PIN** for their
  cards (scared people tell the truth; the rest might lie), or ask who has
  your old character's things (a tip makes that person likelier to turn up).
  **Torture** (bend a finger back, stamp on a hand, the lighter, a broken arm)
  terrifies them and costs you humanity. Let them go, or hit them anyway.
  People remember being mugged and tortured, and the ones you terrified will
  hand it over next time without being asked.
- **Personalities.** Everyone is Timid, Jumpy, Calm, Sly, Proud, a Hothead
  or Hard. It changes how scared of you they start, how easily they give up,
  whether they run or swing, whether they lie to you (the Sly lie about
  PINs; the Proud and Hard hold things back), what they say when they give
  up or tell you where to go, and a little of what they carry (timid people
  carry pepper spray, hotheads blades). Follow them close and **Read them**
  (Surveil) to find out; it shows on their card as their Manner.
- **Nite Owl Gas**, open 24/7: hot coffee (warms you a level, eases stress),
  cigarettes, lighters, matches, bandages and painkillers (dearer than the
  pharmacy), caps, beanies and sunglasses. In any shop, what just happened
  shows in a strip at the bottom instead of behind the shop.
- **Levels go to 100**, and each takes longer than the last (about 15
  experience for the first, 100 around level 10, 1,200 by 50, 4,500 at the
  end). Every stat's effect is per level and sized so that
  100 is a master (e.g. Sneak +0.8% to land an ambush a level, +79% at 100).
  Saves from when levels went to 20 are scaled up (level L becomes 1 + 5×(L−1)).
- **Unarmed** is a skill of its own: most of the damage your blows do
  (+1.2% a level; Strength adds +0.4% a level, and grows more slowly), and it
  teaches you moves, crude street fighting first and skill later, spread over
  1–100 with room for more (and for upgraded versions to replace them). In a
  fight: Gut punch (5, winds them), Knee them (10), Haymaker (15, big and
  wild), Headbutt (25, hurts you too), Elbow (32, opens a cut), Uppercut (40,
  can knock them out), Trip them (50, puts them down), and a Headlock on
  someone on the floor (58, out cold with no blood). Ambushes: Shove, Bum
  rush and Sucker punch from the start, then Kick their knee (20), Slam them
  into the wall (35, head first: dazes, often puts them down) and Choke from
  behind (66). On someone who's down, besides the three stamps: Knee drop
  (12), Ground and pound (30, dazes), Wrench an arm (45, can break it); doing
  these to someone unconscious costs humanity, like stamping. When you're the
  one on the floor: Kick their legs (18) and Drag them down (36). A beginner's punches and kicks read
  like it (wild swings, clumsy kicks, up to Unarmed 10); a trained fighter's
  (40+) are short and hard. The next move you'll learn shows greyed out with
  its level, and the stats sheet lists them all.
- **Weapons you take off people.** Whatever someone carries to hurt you with
  (a knife, a box cutter, a bottle, a syringe, pepper spray) can be taken once
  they can't stop you: knocked out, dead, or given up (after they've emptied
  their pockets, they drop it at your feet). Taking it means they can't use
  it on you. In a fight each one is an attack (Slash with the knife, Swing
  the bottle, Stab with the syringe...; blades cut, so they bleed), also on
  someone who's down (costing humanity on the unconscious, like stamping).
  Pepper spray has three uses: it blinds them for a couple of turns, and can
  open a fight (Violence: Pepper spray them). A blade on you makes people
  more scared (+8 fear) and shows when you mug someone. The police take
  blades off you if they stop you; the fence buys them, the pawn shop won't.
  A new **Weapons** stat (+1.2% damage and +0.5% to land a level) grows as
  you use them.
- **What's in a junkie's syringe.** Heroin, fentanyl, meth, tranq (xylazine),
  or nothing (a used, empty one). You can't tell by looking: take it, and the
  drug test kit tells you. Stuck with a loaded one in a fight (about a third
  of the times it lands), it goes into you: heroin makes you slow and dazed
  but calm; fentanyl the same, harder, and it can put you out; meth gives you
  stamina and hits harder but sets you on edge; tranq can drop you where you
  stand. **Inject** one yourself (from Pockets): heroin takes all the stress
  away and slows you in fights for 2 hours (5% chance of an overdose that
  puts you out for hours); fentanyl the same with a 30% chance of overdose,
  and about a third of overdoses kill you; meth wires you for the next fight
  and adds 12% to your blows for 4 hours, and stress; tranq knocks you out
  for hours wherever you are. The empty syringe is still a weapon. The fence
  buys loaded ones; the police count them as evidence.
- **How each drug looks.** While you're on something, the screen shows it,
  each its own way: coke is cold and crisp (a frosty rim, a fine buzzing
  tremor); heroin is warm and slow (an amber, faded wash, a soft glow, and
  heavy eyelids that droop as you nod); fentanyl is cold and fading
  (blue-grey, drained, the dark breathing in, your eyes nearly closing now
  and then); meth is hot and electric (a red glare, red and cyan fringes, a
  fast jitter, flashes on a racing heartbeat); tranq is sick and swimming (a
  green murk, a slow sway, dark blotches drifting through, and you're groggy
  for an hour after you wake). It fades as a high wears off, and stops
  shaking and swaying if your phone is set to reduce motion.
- **Alcohol.** Beer and pints of vodka at the gas station, and whatever's left
  in a drunk's bottle when you take it off them. Each drink eases stress and
  takes the edge off the cold; you get Tipsy, Drunk, Wasted, then Blackout
  (one more and you pass out for hours). In fights you swing heavier but miss
  more and get hit more. It wears off on the real clock (20 a real hour), and
  it has its own look: a warm golden haze, the room swaying and lurching more
  the more you've had.
- **Cigarettes come in packs, or loose.** People carry a pack or a few loose
  ones. Loose ones can be put in a pack with room (up to 20); an empty pack is
  kept so you can fill it.
- **Everything comes on slowly.** Nicotine's light and sharper edges ease in
  over about twenty seconds; each drug's look comes on at its own pace
  (fentanyl fastest, tranq slowest), a new one only once the last has faded,
  and drink builds with each one.
- **Shops and sheets stay clear.** While you're in a shop, or Pockets, the
  stats or Go is open, what you're on (and the stress tunnel and smoke) fades
  back and nothing shakes; buying something keeps your place in the list.
- **You, at the bottom.** The stats no longer sit along the top: a You tab at
  the bottom of the screen (tap it, or pull up from the bottom edge, any time)
  opens your sheet: blood, cash, which character you are, your condition and
  every stat. Lurk sits just below the middle of the screen.
- **Sound.** Buttons click, tabs tick, a button you can't press knocks,
  drawers breathe, the signal crackles when you lurk, a stat going up rings
  twice (no sounds for blows or attacks), money clinks. All made on the spot; Settings → Sound turns
  it off.
- **Film, glitch, static and colour fringe everywhere.** The old-film layer
  that was only on the menus now covers the game too (coarser, cheaper): grain,
  dust, hairs and scratches, a flicker, scanlines rolling down, and now and
  then the picture breaks up into static. Every screen change and every blow
  that lands glitches it. All text carries a faint red/cyan fringe that flares
  when you're hit. **Settings** has a slider for each: Film grain, Glitches,
  Static, Colour fringe (0 is off, 50 the usual, 100 double); all at 0 turns
  the in-game film layer off entirely.
- **Buttons feel like what they do.** Every press ripples from where you
  touched. Violence (attacks, stamps, torture, and their tabs, which carry a
  faint red edge) flashes red with a jolt; things that are good for you
  (medicine, a drink, a smoke, a fire, buying something) glow warm and chime
  softly.
- **One Violence tab.** In a fight everything violent is one tab, in sections
  (Ambush, Strikes, Weapons, On the ground, Torture), next to Threaten and
  Search; moving (Run, Get up, Catch your breath, Walk away) is a row of
  buttons under the tabs, not a tab. The You sheet only closes from its top
  bar (the grab handle) or a long pull when its list is at the top, so
  scrolling it doesn't put it away.
- **People talk like people.** The scared (timid, jumpy, calm) beg, bargain
  and break in their own way, and who they are comes through: a civilian's
  rent, their kid, work in the morning, their photos; someone homeless with
  nothing else; a junkie, sick; a drunk, slurring. What they say about what
  they hand over is only about what they actually had. The sly try to talk
  their way out. The hard cases (hotheads, the proud, the hard) don't beg:
  they taunt you when they land one, when you miss, when you go down, and
  when you threaten them, and they only crack at the very end, bitterly.
- **It stays with you.** After you mug someone, beat them senseless or
  torture them, your character feels it, by how far gone they are: still
  human, your hands shake, you remember their name if you saw their ID, the
  photo of the kid in their wallet, and stress rises hard; cold, you make
  excuses; heartless, nothing; past that, you enjoy it (and it calms you).
- **Fights take less room.** The status box shows only the two blood bars
  until you tap it (then stamina, fear and conditions); the log shows the last
  three lines with a count of earlier ones, and tapping it shows everything.
- **Version notes.** The version is on the main menu; the first time the game
  opens after an update, a What's new list says what changed since you last
  played (Main menu → What's new to see it again). Every update adds to it
  (`src/core/changelog.ts`).
- **Intimidation** is a fifth stat, trained by all of the above. On small
  screens the stats along the top use short names.
- **The cash machine** at the bank works any hour: a stolen card with the PIN
  they gave you pays out once ($20–$300, more on a credit card); a lie and it
  keeps the card. The camera raises your heat unless your face is covered.
- **More titles for how far gone you are:** Cold, Callous, Cruel, Vicious,
  Heartless, Sadist, Monster, Butcher, Devil, Husk. Reputation goes on past
  Notorious to Dreaded and A legend of the street.
- **Lighters run out.** Pockets shows a fuel gauge on every lighter (and how
  many matches are left in a book). Lighting a cigarette uses a little,
  burning an ID more, keeping a fire going a lot, and the rain makes it all
  worse. Lighters you find are part used; a new one from the pawn shop is full.
- **Injuries, explained.** When you're hurt, the stats sheet opens with an
  Injuries card: every injury, exactly what it does to you ("Kicks and stomps
  land −20%", "Every move costs 1.8× the stamina"), how long it has left and
  what helps. Tapping your injuries under the blood bar opens it too.
- **Settings: Lettering and Buttons.** Lettering: *Report* (Courier, like a
  police report; the default), *Typed* (worn typewriter keys), *CRT* (an old
  terminal), *Clean* (the old rounded look). Buttons: *Lines* (just words on
  hairlines; the default), *Ghost* (no borders at all), *Keyline* (thin square
  outlines), *Boxes* (the old look). Try them in the game.
- **Stress** builds up: every round of a fight, every blow that lands on
  you, every blow you land, and most of all a kill. It's shown with your
  conditions (*On edge*, *Stressed*, *Panicking*) and it costs you: your
  blows land less often and you dodge less (up to a quarter at full stress).
  You see it too: **tunnel vision** closes in from the edges, pulsing with
  your heartbeat, and when it's bad **your sight goes** now and then, dimming
  and swimming and coming back. It eases with time (faster resting) and with
  a cigarette. **Nerve**: every fight you get through, you get a little more
  used to it, and it stresses you less; fully hardened, violence doesn't
  stress you at all.
- **Smoking takes real time:** a cigarette burns for **six minutes** (about
  what one really takes), and you can't light another till it's out. While
  it burns your stress eases, everything's a touch brighter, the edges of
  things stand out, and smoke curls up from the bottom of the screen, with a
  bigger cloud when you exhale. Not indoors. You can walk into a fight
  with it still in your mouth: it keeps you cool (stress builds 40% slower)
  until a blow to the face knocks it out in a burst of sparks, or you're
  knocked out, and then it's gone. Best smoked before, unless you want to
  look cool doing it.
- **Cigarettes** (made-up brands, a few to a nearly full pack) are on all
  sorts of people now, usually with a lighter or matches. **Smoke** one with
  a lighter or matches: it steadies your hands and does nothing good for
  you; with broken ribs every drag hurts, and with a punctured lung you
  cough it back up pink. Matches can make a fire too, but run out sooner.
- **Fights:**
  - **Blood is health.** Blows cost blood, and so does bleeding every turn.
    At 55% of your blood or less, you pass out (the mark on the blood bar).
  - **Stamina:** every move costs some; it comes back a little each turn
    (or more if you catch your breath). Tired blows miss more and hit softer;
    exhausted, you can't kick or grapple.
  - **Where blows land** (head, body, arms, legs) decides what they do:
    *dazed* (a couple of turns of missing more and being hit more),
    *concussed* (for the rest of the fight), *bleeding* (light, moderate,
    heavy, severe; blades cut), *broken bones* (nose, ribs, either arm or
    leg), or knocked to the floor.
  - **Injuries have penalties where they are:** a broken leg makes running
    away much harder (two, almost impossible), getting up harder and kicks
    miss more; a broken arm makes punches, grapples and weapon blows miss
    more; broken ribs make everything cost more stamina and slow getting it
    back.
  - **Standing or on the floor:** on the floor you hit weaker and miss more,
    can't run, and get stomped on. Same for them.
  - **When they're on the floor** your attacks become stomps, aimed at their
    **head** (most likely to knock them out), **stomach** (knocks the wind
    out of them: they lose their next move and stamina) or **ribs** (likely
    to break them; stomping broken ribs can knock them out). Someone gets
    knocked **unconscious** far more easily on the floor, concussed, dazed,
    or after losing a lot of blood, and passes out at 55% of their blood.
  - **When they're unconscious** the encounter doesn't end: they can't do
    anything any more, and you choose what happens. Keep stomping (head,
    stomach, ribs; every blow lands), catch your breath, or **Walk away**,
    which ends it. If *you* pass out, it ends.
  - **They can bleed out.** An unconscious person still loses blood (from
    bleeding, and from every stomp). When it gets low their breathing goes
    shallow; at 40% of their blood they die, and it's over ("They're dead.").
    A single blow knocks someone out; it doesn't kill them on the spot. You
    can still search the dead.
- **Feeling the hits:** every blow that lands shakes the screen, tears it
  with glitches and static, and fringes the text with colour; when you're
  the one hit the edges flash red. **Blood only when it makes sense:** a punch to the
  gut, a shove, a kick to the legs throw none; you'll feel it but not see
  it. What you see depends on the blow:
  - a face that's already bleeding, or a brow or lip splitting open: a fan of
    fine **spatter**, round up close and stretched into teardrops further out
  - a blade: a **cast-off** line of drops thrown along the arc of the swing
  - a nose breaking, a stamp on a bleeding head: a full **splash**
  - a punctured lung: blood **coughed** up in a fine, frothy mist from below
    (and again with every coughing fit)
  - an open break, a heavy blow that opens the skin: a few heavy **drops**
    that land and run.
  Your own blood lands thicker and closer than theirs. A splash is a main
  splash, streams thrown outward ending in round beads, satellite drops
  with little tails, fine mist, and drips that run down and bead where they
  stop, with a crown of short spines where the drop burst and teardrop
  drops whose tails point the way they flew. It's built as a field of soft blobs cut at a surface (so drops merge
  like real liquid) and lit on the GPU like wet blood: near black-red where
  thick, glowing red at thin edges, a dark meniscus line, light shining
  through the domes, glossy highlights. Splashes land on the panels too.
  When your blood is low, a red edge pulses like a heartbeat. The phone
  vibrates on every hit, harder when you're hurt (Android; iPhones don't
  let web pages vibrate).
- **The glass: blood, dirt and grime stay.** All of it sits on one layer
  over everything, the game and every menu, and is kept on the device
  between visits. Nothing cleans it for you: **rub a finger anywhere on
  the screen to wipe it**: over buttons, lists, anything, with as many
  fingers as you like. Wet blood gets pushed along and partly lifted,
  leaving only a faint smear. Over a couple of
  minutes blood **dries**: matte, brown-maroon, darker at the rim, finely
  cracked where it was thick, and takes a pass or two more to wipe. There's always some
  dust, specks and greasy haze, it builds up slowly, and your finger leaves
  streaks of its own. (A wipe that ends on a button doesn't press it.)
- **The screen glitches when it changes:** switching tabs, pulling a drawer
  in or out, a new stage of an encounter, a menu, walking somewhere. The
  part that changed tears and fringes for a moment and the glass flickers
  with static.
- Drawers come in from their side and go back the same way: push one
  towards its edge (or tap outside it, or the X) to put it away.
- **Your injuries carry over** from one person to the next: your blood,
  bleeding, broken bones and concussion (shown under your stats). Stamina,
  being dazed and being on the floor reset after each fight.
  - Time heals: each lurk passes about an hour, and **Rest** (shown when
    you're hurt) passes four, healing faster. Blood comes back about 140 ml
    an hour once you've stopped bleeding; bleeding eases by itself, and
    resting stops it faster. Broken bones mend: nose 8 hours, ribs 16, arms
    and legs 24. A concussion clears in 6.
  - **You can die.** Lose a fight, or bleed down to 55% between fights, and
    you're out cold for a few hours, still bleeding. If your blood falls to
    40% while you lie there, you never wake up. Light bleeding usually clots
    in time; heavy bleeding often doesn't (about a third of beatings end
    this way). **Death is final for that character:** a death screen shows
    how far they got (lurks, kills, humanity, cash), then you **go on as
    someone new**: stats back to level 1, fully healed, humanity intact,
    empty pockets. The world remembers, though. Whoever found the body went
    through it (the person who beat you, or a stranger if you dropped on your
    own) and they're out there with **your old things on them**. Nothing
    says who: lurk and now and then (about 1 in 7) it's one of them, looking
    like anyone else. Search them and you'll find it ("It was yours once").
    Whatever you don't take back stays on them; kill them and it's gone. Up
    to 8 people can be carrying things of yours at once. (The blood on the
    glass stays too.)
  - **Broken ribs** wreck your breathing: every move costs 1.8x the stamina,
    it comes back at a fifth of the speed and never past half, and you have
    coughing fits. Stamp or hit broken ribs and a rib can **puncture a
    lung** (2.4x, capped at 30%, more bleeding; it heals with the ribs).
- **Humanity** (under your blood, once you've lost some): killing someone
  costs a lot of it, stamping on someone unconscious a little. It only gets
  worse: **Cold**, then **Cruel**, then **Heartless**, then **Husk**, with no
  humanity left inside. You're told the moment it slips.
- **Gore:** every blow that lands is described: split lips and brows,
  teeth, caved-in faces, retching blood, bone through skin, deep cuts,
  worse the more blood it costs.
  - **Leave them**, or just *Lurk* again.
- **Your stats** (top left), each starting at 1 and only going up by using it
  (max 20):
  - **Sneak:** the chance your ambush (bum rush, sucker punch, shove) lands,
    rather than being blocked, dodged or countered before the fight starts;
    also how slowly you get noticed while surveilling. Goes up by surveilling
    and ambushing.
  - **Strength:** how much damage your blows do (+8% a level). Goes up by
    landing blows.
  - **Agility:** how often your blows land (+3% a level) and how often you
    dodge theirs (+2.5% a level). Goes up by landing blows and dodging.
  - **Stamina:** how much stamina you have (+6 a level) and how fast it comes
    back. Goes up by exhausting yourself (spending it when you're low).
- Tables for all of this are in `src/game/person.ts` and `src/game/stats.ts`;
  the rules are in `src/game/encounter.ts`.
- **Fullscreen:** the game asks for fullscreen on every tap, click or key press
  whenever it isn't fullscreen. On iPhone, use Share → Add to Home Screen.
- **Pause:** top-right button, or Esc on a computer.
- **Saving:** pausing is the save point. The game saves every time you pause
  (leaving the app pauses it too), and *Continue* brings you back to that
  exact pause screen. Saves are stored on the device.

## Tech

- TypeScript + [Three.js](https://threejs.org) on WebGL2, built with Vite.
- GPU shaders draw the menu's film grain / glitch layer and the CRT television
  (power-on sequence, static, scanlines, curved glass, interference).
- Can later be wrapped as a native iOS / Android app (e.g. with Capacitor).

## Develop

```bash
npm install
npm run dev      # local server, also reachable from a phone on the same Wi-Fi
npm run build    # production build into dist/
```

URL options: `?debug` shows FPS, `?pr=1` fixes the render resolution.

## Code map

| File | What it does |
| --- | --- |
| `src/main.ts` | Starts everything; switches between menu, game and pause |
| `src/game/game.ts` | The game itself: the TV, lurking, saving its state (including an encounter in progress) |
| `src/game/person.ts` | Who you can see: types, races, builds (fight difficulty), what they carry, awareness, and the chances of each; their clothes and what's in the pockets (loot) |
| `src/game/inventory.ts` | Your pockets (cash, loot, medicine) and the pharmacy's medicine |
| `src/game/encounter.ts` | Surveil and violence: following, finding things out, being noticed, ambushes, and combat (blood, stamina, injuries, falls), with the log |
| `src/game/health.ts` | Your body between fights: blood, bleeding, broken bones and concussion carrying over, and healing with time and rest |
| `src/game/stats.ts` | Your stats (sneak, strength, agility, stamina), levelling by use, and what each does |
| `src/fx/glass.ts` | The glass over everything: blood splatters that dry, wiping with a finger, smears, dirt and grime (kept on the device), plus the red border, glitch and static |
| `src/fx/hitUi.ts` | Hit effects on the interface: shaking, colour fringing, panels glitching, blood on the panels |
| `src/ui/encounterView.ts` | The encounter screen: what you know about them, the log, your options |
| `src/game/tv.ts` | The CRT television, its power-on sequence, interference, and showing the picture |
| `src/core/save.ts` | Save / load / delete, with a backup copy |
| `src/core/settings.ts` | Player settings |
| `src/core/fullscreen.ts` | Keeps the game fullscreen |
| `src/core/quality.ts` | Graphics presets and adaptive resolution |
| `src/ui/menu.ts` | Main menu, pause menu, settings, confirm dialogs |
| `src/fx/uiGlitch.ts` | The quick glitch when the screen changes |
| `src/game/people.ts` | People who remember you: their injuries healing on the real clock, grudges, recognition; reputation and heat |
| `src/game/look.ts` | Masks, caps, hoods, sunglasses: how hidden your face is |
| `src/game/money.ts` | Bills and coins: paying and change, changing up, breaking bills |
| `src/game/shops.ts` | Places, their opening hours, what the pawn shop and the fence pay, what's for sale |
| `src/game/weather.ts` | The weather on the real clock: dry spells and rain |
| `src/fx/rain.ts` | Rain falling over the picture, and drops on the glass that run and wash it |
| `src/game/clock.ts` | The device's real time (the clock, and time for future features) |
| `src/game/legacy.ts` | What outlives you: who took your things when you died, and meeting them again |
| `src/fx/film.ts` | Menu film grain, flicker, colour fringing and glitches |
| `src/fx/fullscreen.ts` | Helper for full-screen GPU shaders |
