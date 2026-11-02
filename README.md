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
- **Tap the person** to choose:
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
    *Kick*, *Grapple* or *Run*, turn by turn, with a log of what happens to
    them and to you and both health bars. They may pull a weapon, pepper
    spray you, or run when losing.
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
| `src/game/person.ts` | Who you can see: types, races, builds (fight difficulty), what they carry, awareness, and the chances of each |
| `src/game/encounter.ts` | Surveil and violence: following, finding things out, being noticed, openers, turn-by-turn combat, the log |
| `src/game/stats.ts` | Your stats (sneak, strength, agility), levelling by use, and what each does |
| `src/ui/encounterView.ts` | The encounter screen: what you know about them, the log, your options |
| `src/game/tv.ts` | The CRT television, its power-on sequence, interference, and showing the picture |
| `src/core/save.ts` | Save / load / delete, with a backup copy |
| `src/core/settings.ts` | Player settings |
| `src/core/fullscreen.ts` | Keeps the game fullscreen |
| `src/core/quality.ts` | Graphics presets and adaptive resolution |
| `src/ui/menu.ts` | Main menu, pause menu, settings, confirm dialogs |
| `src/fx/film.ts` | Menu film grain, flicker, colour fringing and glitches |
| `src/fx/fullscreen.ts` | Helper for full-screen GPU shaders |
