# Dreamscape (working title)

A surreal, GPU-heavy exploration game for mobile. Drift through an endless,
breathing dream world and follow the beams of light. Each orb you collect
sends a wave of light through the world and shifts its colours.

## Play

**Play in your browser:** https://wh173-0u7.github.io/Unamed-/

Every push to `main` (or the development branch) rebuilds the game and
publishes it there automatically (see `.github/workflows/deploy.yml`).

- **Phone:** left thumb = move (floating joystick), right thumb = look. Landscape works best.
- **Desktop:** WASD / arrows = move, drag = look, Space / Shift = rise / sink.

## Tech

- TypeScript + [Three.js](https://threejs.org) on WebGL2, built with Vite.
- Every visual is a custom GPU shader: the endless terrain, the sky/nebula,
  the instanced floating shapes, 50k–120k GPU particles, and orbs.
- Post-processing: bloom, chromatic aberration, vignette, film grain.
- Adaptive resolution keeps the frame rate smooth on weaker phones.
- Can later be wrapped as a native iOS / Android app (e.g. with Capacitor).

## Develop

```bash
npm install
npm run dev      # local server, also reachable from a phone on the same Wi-Fi
npm run build    # production build into dist/
```

URL options: `?debug` shows FPS, `?pr=1` fixes the render resolution, `?play` skips the intro.

## Code map

| File | What it does |
| --- | --- |
| `src/main.ts` | Sets everything up and runs the game loop |
| `src/core/shared.ts` | Shared shader code: noise, colour palette, terrain height, fog, light pulse |
| `src/core/controls.ts` | Touch joystick, look, keyboard / mouse |
| `src/core/quality.ts` | Device tiers and adaptive resolution |
| `src/world/*.ts` | Sky, terrain, floating shapes, particles, orbs |
| `src/fx/post.ts` | Post-processing effects |
