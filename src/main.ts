import './style.css';
import * as THREE from 'three';
import { isMobile, pixelRatioFor } from './core/quality';
import { onSettingsChange } from './core/settings';
import { deleteSave, formatAgo, formatPlayTime, hasSave, loadSave, newSave } from './core/save';
import { createFilm } from './fx/film';
import { createMenu } from './ui/menu';
import { Game } from './game/game';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const params = new URLSearchParams(location.search);

/** How often progress is saved automatically while playing (seconds). */
const AUTOSAVE_EVERY = 30;
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

const fixedPR = params.has('pr') ? Number(params.get('pr')) : null;
let pixelRatio = 1;

function applySize() {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  film.setSize(pixelRatio);
  game?.setSize(innerWidth, innerHeight);
}
addEventListener('resize', applySize);

onSettingsChange((s) => {
  pixelRatio = fixedPR ?? pixelRatioFor(s.quality);
  applySize();
  $('fps').style.display = s.showFps || params.has('debug') ? 'block' : 'none';
});

// ---------- App state ----------
let sinceAutosave = 0;
/** The film layer is only drawn while the menu can be seen. */
let menuVisible = true;
let menuFadeTimer = 0;

const menu = createMenu({
  onContinue: () => startGame(false),
  onNewGame: () => {
    if (hasSave()) {
      menu.confirm({
        title: 'Start a new game?',
        body: 'Your saved game will be replaced. This cannot be undone.',
        ok: 'Start new game',
        onOk: () => startGame(true),
      });
    } else {
      startGame(true);
    }
  },
  onResume: resume,
  onSave: () => {
    if (save()) menu.toast('Game saved');
    updatePauseInfo();
  },
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
  sinceAutosave = 0;
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
  game = new Game(data, $('game'), renderer, { onTurnedOn: () => save() });
  game.setSize(innerWidth, innerHeight);
  if (fresh) save(); // so Continue is available straight away
  state = 'playing';
  sinceAutosave = 0;
  hideMenu();
  game.start();
  document.body.classList.add('in-game');
  if (isMobile) {
    // Some browsers lack fullscreen or don't return a promise: never let that break starting.
    try {
      const request = document.documentElement.requestFullscreen?.();
      request?.catch?.(() => {});
    } catch {
      /* fullscreen unavailable */
    }
  }
}

function pause() {
  if (state !== 'playing' || !game) return;
  state = 'paused';
  game.pause();
  document.body.classList.add('paused');
  save();
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
  save();
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
// Leaving the app pauses and saves; closing the tab saves.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
addEventListener('pagehide', () => {
  if (game) game.saveNow();
});

menu.setSaveInfo(loadSave());
showMenu('main');

if (params.has('debug')) {
  // Handle for automated testing.
  Object.assign(window, {
    __app: {
      menu,
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
    if (state === 'playing' && (sinceAutosave += dt) >= AUTOSAVE_EVERY) save();
  } else {
    renderer.clear();
  }

  if (menuVisible) film.update(dt);

  frames++;
  if ((fpsTimer += dt) > 0.5) {
    $('fps').textContent = `${Math.round(frames / fpsTimer)} fps`;
    fpsTimer = 0;
    frames = 0;
  }
});

