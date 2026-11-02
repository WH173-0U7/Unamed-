# UNamed

A GPU-heavy game for mobile, being built from scratch. Right now it has a
black, film-styled menu (grain, flicker, colour fringing, glitches), settings,
a save system, and the very first moment of the game: a dark screen with one
option that switches on an old CRT television, which shows nothing yet.

## Play

**Play in your browser:** https://wh173-0u7.github.io/Unamed-/

Every push to `main` (or the development branch) rebuilds the game and
publishes it there automatically (see `.github/workflows/deploy.yml`).

- **New game / Continue:** opens the game: a black screen with one option, *Turn on*.
- **Pause:** top-right button, or Esc on a computer.
- **Saving:** automatic every 30 seconds, when pausing, and when leaving the
  app; or press *Save game* in the pause menu. Saves are stored on the device.

## Tech

- TypeScript + [Three.js](https://threejs.org) on WebGL2, built with Vite.
- GPU shaders draw the menu's film grain / glitch layer and the CRT
  television (power-on sequence, static, scanlines, curved glass).
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
| `src/game/game.ts` | The game itself: the dark room and its one option |
| `src/game/tv.ts` | The CRT television and its power-on sequence |
| `src/core/save.ts` | Save / load / delete, with a backup copy |
| `src/core/settings.ts` | Player settings |
| `src/core/quality.ts` | Graphics presets and adaptive resolution |
| `src/ui/menu.ts` | Main menu, pause menu, settings, confirm dialogs |
| `src/fx/film.ts` | Menu film grain, flicker, colour fringing and glitches |
| `src/fx/fullscreen.ts` | Helper for full-screen GPU shaders |
