import './style.css';
import * as THREE from 'three';
import { pixelRatioFor } from './core/quality';
import { enforceFullscreen } from './core/fullscreen';
import { onSettingsChange } from './core/settings';
import { deleteSave, formatAgo, formatPlayTime, hasSave, loadSave, newSave } from './core/save';
import { createFilm } from './fx/film';
import { createRain } from './fx/rain';
import { createGlass } from './fx/glass';
import { createMenu } from './ui/menu';
import { Game } from './game/game';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const params = new URLSearchParams(location.search);

/** Length of the fade between menu and game (ms); matches #game / #menu in style.css. */
const FADE_MS = 800;

type State = 'menu' | 'playing' | 'paused';
let state: State = 'menu';
let game: Game | null = null;

// ---------- Renderers ----------
// Game screen (the TV, and later the game world).
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setClearColor(0x000000, 1);
$('screen').appendChild(renderer.domElement);

// Film grain / glitch layer over the menus.
const film = createFilm($('menu'));

// The glass over everything: blood, smears and grime stay on it, through
// every menu and the game, until wiped off with a finger.
const glass = createGlass({ onHint: () => menu.toast('Rub the screen with your finger to wipe the blood off') });
// Rain: falling over the picture, and running down the glass.
const rain = createRain($('rainfall') as HTMLCanvasElement, glass);
// The screen changing (a tab, a drawer, a menu): the glass flickers.
addEventListener('ui-glitch', (e) => glass.pulse((e as CustomEvent<number>).detail));

const fixedPR = params.has('pr') ? Number(params.get('pr')) : null;
let pixelRatio = 1;

function applySize() {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  film.setSize(pixelRatio);
  glass.setSize(innerWidth, innerHeight, pixelRatio);
  rain.resize(innerWidth, innerHeight, pixelRatio);
  game?.setSize(innerWidth, innerHeight, pixelRatio);
}
addEventListener('resize', applySize);

onSettingsChange((s) => {
  pixelRatio = fixedPR ?? pixelRatioFor(s.quality);
  applySize();
  $('fps').style.display = s.showFps || params.has('debug') ? 'block' : 'none';
});

// ---------- App state ----------
// Saving rule: pausing is the save point. Progress is written only when the
// game pauses (including when the player leaves the app), and Continue
// returns to exactly that pause screen.
/** The film layer is only drawn while the menu can be seen. */
let menuVisible = true;
let menuFadeTimer = 0;

const menu = createMenu({
  onContinue: () => startGame(false),
  onNewGame: () => {
    if (hasSave()) {
      menu.confirm({
        title: 'Start a new game?',
        body: 'Your saved game will be replaced the first time you pause. This cannot be undone.',
        ok: 'Start new game',
        onOk: () => startGame(true),
      });
    } else {
      startGame(true);
    }
  },
  onResume: resume,
  onQuit: quitToMenu,
  onDeleteSave: () => {
    if (state !== 'menu') {
      menu.toast('Quit to the main menu to delete your save');
      return;
    }
    menu.confirm({
      title: 'Delete saved game?',
      body: 'Your progress will be erased from this device. This cannot be undone.',
      ok: 'Delete',
      onOk: () => {
        deleteSave();
        menu.setSaveInfo(null);
        menu.toast('Saved game deleted');
      },
    });
  },
});

function showMenu(screen: 'main' | 'pause') {
  clearTimeout(menuFadeTimer);
  menuVisible = true;
  menu.show(screen);
}

function hideMenu() {
  menu.hide();
  clearTimeout(menuFadeTimer);
  menuFadeTimer = window.setTimeout(() => (menuVisible = false), FADE_MS);
}

function save(): boolean {
  if (!game) return false;
  const ok = game.saveNow();
  if (!ok) menu.toast("Couldn't save: this browser is blocking storage");
  return ok;
}

function updatePauseInfo() {
  if (!game) return;
  const s = game.save;
  menu.setPauseInfo(`played ${formatPlayTime(s.playTime)} · last saved ${formatAgo(s.savedAt)}`);
}

function startGame(fresh: boolean) {
  const data = fresh ? newSave() : loadSave();
  if (!data) {
    menu.toast("Couldn't load the saved game");
    menu.setSaveInfo(null);
    return;
  }
  game = new Game(data, $('game'), renderer, glass);
  // Dying saves at once: that character is gone, and you go on as someone new.
  game.onDeath = () => save();
  game.setSize(innerWidth, innerHeight, pixelRatio);
  document.body.classList.add('in-game');
  if (fresh) {
    state = 'playing';
    hideMenu();
    game.start();
  } else {
    // Continue: back to the pause screen where the game was saved.
    state = 'paused';
    game.restorePaused();
    document.body.classList.add('paused');
    updatePauseInfo();
    showMenu('pause');
  }
}

function pause() {
  if (state !== 'playing' || !game || game.dead) return;
  state = 'paused';
  game.pause();
  document.body.classList.add('paused');
  // The save point.
  if (save()) menu.toast('Progress saved');
  glass.persist();
  updatePauseInfo();
  showMenu('pause');
}

function resume() {
  if (state !== 'paused' || !game) return;
  state = 'playing';
  game.resume();
  document.body.classList.remove('paused');
  hideMenu();
}

function quitToMenu() {
  if (!game) return;
  // Already saved when the game paused; quitting changes nothing.
  game.close();
  game = null;
  state = 'menu';
  document.body.classList.remove('in-game', 'paused');
  menu.setSaveInfo(loadSave());
  showMenu('main');
}

$('pause-btn').addEventListener('click', pause);
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  if (state === 'playing') pause();
  else if (menu.current === 'settings' || menu.current === 'confirm') menu.back();
  else if (state === 'paused') resume();
});
// Leaving or closing the app pauses it, which saves.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    glass.persist();
  }
});
addEventListener('pagehide', () => {
  pause();
  glass.persist();
});

menu.setSaveInfo(loadSave());
showMenu('main');
enforceFullscreen();

if (params.has('debug')) {
  // Handle for automated testing.
  Object.assign(window, {
    __app: {
      menu,
      glass,
      rain,
      get state() {
        return state;
      },
      get game() {
        return game;
      },
    },
  });
}

// ---------- Main loop ----------
const timer = new THREE.Timer();
timer.connect(document);
let fpsTimer = 0;
let frames = 0;

renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);

  if (game) {
    game.update(dt);
  } else {
    renderer.clear();
  }

  if (menuVisible) film.update(dt);
  // It only rains in a game (the weather is the save's).
  rain.setAmount(game?.rainAmount ?? 0);
  rain.update(dt);
  glass.update(dt);

  frames++;
  if ((fpsTimer += dt) > 0.5) {
    $('fps').textContent = `${Math.round(frames / fpsTimer)} fps`;
    fpsTimer = 0;
    frames = 0;
  }
});

