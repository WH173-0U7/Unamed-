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
  **Attack** (punch, kick, grapple), **Stomp** (head, stomach, ribs, once
  they're down), **Search** (once they're unconscious or dead) and **Move**
  (run, get up, catch your breath, walk away). When things change (they
  fall, they pass out) the tab that matters jumps to the front. *Leave
  them* / *Lurk again* / *Rest* sit below the tabs. Their card also shows
  what they're **wearing**.
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
- **A clock** in the corner shows your device's real time and date. The
  game runs on real time: future features will take real time to happen
  (waits, healing, travel), counted from your device's clock even while the
  game is closed. (The save already records when you were last there.)
- **Go** (pull it in from the **left edge**, or tap its tab) opens *Where to?*: **The street** (where
  you lurk) or the **Pharmacy**, open all night. It sells, cash only:
  *Bandages* $8 (bleeding down a level), *Gauze and tape* $15 (down two),
  *Painkillers* $6 (a concussion clears 3 hours sooner), *Splint* $22 (a
  broken arm or leg heals twice as fast) and *Iron tablets* $12 (+0.4 L of
  blood). You can't lurk inside; Go takes you back out. Where you are is
  saved.
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
| `src/game/clock.ts` | The device's real time (the clock, and time for future features) |
| `src/game/legacy.ts` | What outlives you: who took your things when you died, and meeting them again |
| `src/fx/film.ts` | Menu film grain, flicker, colour fringing and glitches |
| `src/fx/fullscreen.ts` | Helper for full-screen GPU shaders |
