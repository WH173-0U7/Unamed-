# Dreamscape (working title)

A GPU-heavy game for mobile, being built from scratch. Right now it has the
menus, settings and a save system; starting a game opens an empty black
screen where the game will be built.

## Play

**Play in your browser:** https://wh173-0u7.github.io/Unamed-/

Every push to `main` (or the development branch) rebuilds the game and
publishes it there automatically (see `.github/workflows/deploy.yml`).

- **New game / Continue:** opens the game (currently a black screen).
- **Pause:** top-right button, or Esc on a computer.
- **Saving:** automatic every 30 seconds, when pausing, and when leaving the
  app; or press *Save game* in the pause menu. Saves are stored on the device.

## Tech

- TypeScript + [Three.js](https://threejs.org) on WebGL2, built with Vite.
- The menu background is a live GPU-shader world (terrain, sky, floating
  shapes, particles, bloom), with adaptive resolution for weaker phones.
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
| `src/game/game.ts` | The game itself (empty for now) |
| `src/core/save.ts` | Save / load / delete, with a backup copy |
| `src/core/settings.ts` | Player settings |
| `src/core/quality.ts` | Graphics presets and adaptive resolution |
| `src/ui/menu.ts` | Main menu, pause menu, settings, confirm dialogs |
| `src/world/*.ts` | The animated menu background |
| `src/fx/post.ts` | Post-processing effects |
