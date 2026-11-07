# DarcVoyd

A dark, realistic street-crime game for phones. You watch the street through
an old CRT television, pick someone out, and decide what to do about them.
Everything runs on the **real clock**: time, healing, jail, rent and the
weather all keep going whether you're playing or not.

**Play in your browser:** https://wh173-0u7.github.io/Unamed-/
**Android app:** [DarcVoyd.apk](https://github.com/WH173-0U7/Unamed-/releases/download/android/DarcVoyd.apk) (download on your phone and open it)

---

## How to play

1. **Turn on** the TV, then **Lurk**: after a moment of static, someone walks by.
2. **Tap them** to watch, follow, size them up, talk, sell, or go at them.
3. Use the edge tabs: **Go** (left, the map), **Pockets** (right), **You** (bottom).
4. Rest when you're hurt or worn out. The game saves as you play.

---

## Features

### The street
- People of every kind (civilians, drunks, the homeless, junkies), each with a build, a personality, clothes and pockets.
- **Surveil** first: follow, read them, see what they carry, how aware they are. Get noticed and they run or turn on you.
- **Weather and night** on the real clock: rain soaks you, cold sets in, shops open and close.
- People **remember you**: your face, your clothes, what you did. Grudges, fear, reputation and police heat.

### Fighting
- Turn-based fights with blood, stamina, falls, knock-outs and real injuries (broken bones, a punctured lung, paralysis).
- **Five fighting styles:** Strikes, Kicks & knees, Clinch & takedowns, Ground, Locks & chokes. Each levels up from its own moves and teaches harder ones; better moves replace the basic ones.
- Ambushes, chases, weapons, torture, mugging, and searching bodies.
- **Toughness** grows only by taking a beating.
- Every injury carries over and heals on the real clock: yours and theirs.

### Your body
- Blood, bleeding, broken bones, concussion, scars, stress and the cold.
- **Fatigue** builds from fights and effort and lowers your odds at everything. **Resting takes real time**, on a countdown screen (like an energy bar).
- Drugs, drink, caffeine and cigarettes, with real-time highs, comedowns, habits and withdrawal.
- On-screen effects: blood and grime on the glass you can wipe, cracks when you're dazed, drug visuals.
- Leave in a hurry while bleeding and you won't die while you're away: you come back weak, with an hour to bandage up.

### Money and things
- Pockets and bags with real sizes and weights. **Cash takes room**: carry too much and it won't fit.
- Bills and coins, change, the bank and ATM (debit cards by the owner's income), your own ID.
- Colour-coded icons for every kind of item, everywhere.
- Clothes and face coverings you can put on and take off (they change who recognises you).

### Places
- A **map** of the city with set locations: pharmacy, gas station, liquor store, pawn shop, the fence, bank, ER, Records Office, the County Courthouse, a motel room you can rent, and Dez, who'll front you product and wants paying.
- **Dealing**: get introduced to a supplier, earn his trust for bigger amounts and better prices, bag up and sell; watch for stings and debts.
- **Break-ins**: addresses from IDs and keys, people at home, alarms, dogs, locks that get changed.
- **Cars**: find the car for a stolen fob, search it, sleep in it, get it towed.

### Police and jail
- Stops, searches, lying your way out, running, arrests and charges.
- Bail, court dates, warrants, fines, probation and sentences.
- **Jail is real time, but shorter**: a night in a cell is 1 real hour, waiting in County for a hearing half an hour, and a sentence much less than its length (a month is about 16 hours, a year about 29).
- Give up on a jailed character and they stay inside: as someone new you can **visit, bail them out or break them out** (at the transport van), then choose who to go on as.
- A full criminal record on the You tab.

### Your character
- Stats that level by use (Sneak, Strength, Unarmed, Weapons, Agility, Stamina, Toughness, Intimidation, Speech) plus the fighting styles.
- Humanity: what killing and cruelty cost you.
- Death is permanent for that character; the world (and who took your things) carries on.

### The app and saving
- **Saves automatically** a moment after anything changes.
- **Check for updates** in the menu; the Android app plays the live game, so updates arrive without a new download.
- **Phone notifications** (Android app): rested, out of jail, court today, rent due, Dez's money due.
- **Move your game** between devices (Settings → Export / Import code).
- Settings: graphics quality, lettering and button styles, film grain, glitches, static, colour fringe, sound.

---

## Develop

```bash
npm install
npm run dev      # local server (reachable from a phone on the same Wi-Fi)
npm run build    # production build into dist/
```

- **Stack:** Vite, TypeScript, three.js (shaders), plain DOM and CSS.
- **Deploy:** every push to `main` rebuilds the site (`.github/workflows/deploy.yml`).
- **Android:** Capacitor (`android/`, `capacitor.config.ts`); the APK is built by `.github/workflows/android.yml` when the app itself changes.
- **Version notes:** every update adds an entry to `src/core/changelog.ts` (shown in the game as "What's new").
- **URL options:** `?debug` (FPS and a test handle), `?pr=1` (fixed render resolution).

### Code map

| Folder | What's in it |
| --- | --- |
| `src/main.ts` | Starts everything: menu, game, saving, updates, notifications |
| `src/game/` | The game: `game.ts` (screens, places, police, jail, time), `encounter.ts` (surveil and fights), `health.ts` (your body), `people.ts` (who remembers you), `styles.ts`, `stats.ts`, `inventory.ts`, `money.ts`, `shops.ts`, `homes.ts`, `cars.ts`, `map.ts`, `weather.ts`, `legacy.ts` |
| `src/ui/` | The fight screen, menus, tap feedback |
| `src/fx/` | The TV and glass effects: film, glitches, blood, cracks, rain, snow, drug visuals, sound |
| `src/core/` | Saving, settings, version notes, updates, notifications |
| `android/` | The Android app wrapper |
