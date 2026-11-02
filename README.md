# DarcVoyd

A GPU-heavy game for mobile, being built from scratch. Right now it has a
black, film-styled menu (grain, flicker, colour fringing, glitches), settings,
a pause-based save system, and the opening of the game: an endless dark void
where a small orb of light (the Whisp, see [LORE.md](LORE.md)) appears under
the player's touch and feeds on their movement, glowing brighter and lighting
up more of its surroundings.

## Direction (planned, not built yet)

- A **2D** game where the visual effects are the focus.
- Gameplay mixes **side-scrolling** sections and **top-down** sections.
- Tone: dark and creepy, in the style of the film-grain / glitch menu and the CRT television.

## Play

**Play in your browser:** https://wh173-0u7.github.io/Unamed-/

Every push to `main` (or the development branch) rebuilds the game and
publishes it there automatically (see `.github/workflows/deploy.yml`).

- **Playing:** touch anywhere and an orb appears under your thumb. Moving your
  thumb feeds it: it glows bigger and brighter and lights up more of the dark.
  Hold your thumb away from the centre to travel that way through the void.
  Hold still and it slowly fades; lift your thumb and it dies away.
- **Fullscreen:** the game asks for fullscreen on every tap, click or key press
  whenever it isn't fullscreen. On iPhone, use Share → Add to Home Screen.
- **Pause:** top-right button, or Esc on a computer.
- **Saving:** pausing is the save point. The game saves every time you pause
  (leaving the app pauses it too), and *Continue* brings you back to that
  exact pause screen. Saves are stored on the device.

## Tech

- TypeScript + [Three.js](https://threejs.org) on WebGL2, built with Vite.
- GPU shaders draw the menu's film grain / glitch layer and the game's
  darkness: the Whisp's light and halo, smoky feedback trails, threads of light,
  and fog and rock revealed only where the light reaches.
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
| `src/game/game.ts` | The game itself: touch input, saving its state |
| `src/game/whisp.ts` | How the Whisp behaves: following, feeding, fading, threads of light |
| `src/game/darkness.ts` | Drawing the dark place, the Whisp's light and trails (GPU) |
| `src/core/save.ts` | Save / load / delete, with a backup copy |
| `src/core/settings.ts` | Player settings |
| `src/core/fullscreen.ts` | Keeps the game fullscreen |
| `src/core/quality.ts` | Graphics presets and adaptive resolution |
| `src/ui/menu.ts` | Main menu, pause menu, settings, confirm dialogs |
| `src/fx/film.ts` | Menu film grain, flicker, colour fringing and glitches |
| `src/fx/fullscreen.ts` | Helper for full-screen GPU shaders |
