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
  time: civilian 42%, drunk 24%, homeless 20%, junkie 14%. Each
  person's race is one of the 7 U.S. federal (OMB 2024) categories, equally
  likely. Both tables are `CHANCES` and `RACE_CHANCES` in `src/game/game.ts`.
  The buttons don't do anything yet. The game keeps count of who you've seen.
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
| `src/game/game.ts` | The game itself: the TV, lurking, the chances of who you see (and their race), saving its state |
| `src/game/tv.ts` | The CRT television, its power-on sequence, interference, and showing the picture |
| `src/core/save.ts` | Save / load / delete, with a backup copy |
| `src/core/settings.ts` | Player settings |
| `src/core/fullscreen.ts` | Keeps the game fullscreen |
| `src/core/quality.ts` | Graphics presets and adaptive resolution |
| `src/ui/menu.ts` | Main menu, pause menu, settings, confirm dialogs |
| `src/fx/film.ts` | Menu film grain, flicker, colour fringing and glitches |
| `src/fx/fullscreen.ts` | Helper for full-screen GPU shaders |
