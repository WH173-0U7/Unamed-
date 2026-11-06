import './style.css';
import { installTapFeedback } from './ui/tap';
installTapFeedback();
import * as THREE from 'three';
import { pixelRatioFor } from './core/quality';
import { enforceFullscreen } from './core/fullscreen';
import { onSettingsChange } from './core/settings';
import { deleteSave, formatAgo, formatPlayTime, hasSave, loadSave, newSave, loadBackup, staleWrite } from './core/save';
import { createFilm } from './fx/film';
import { createRain } from './fx/rain';
import { createSnow } from './fx/snow';
import { createSenses } from './fx/senses';
import { createDrugs } from './fx/drugs';
import { setMuted, sound } from './fx/sound';
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

// Film grain / glitch layer over the menus; and one over the whole game.
const film = createFilm($('menu'));
const filmGame = createFilm(document.body, true);

// The glass over everything: blood, smears and grime stay on it, through
// every menu and the game, until wiped off with a finger.
const glass = createGlass({ onHint: () => menu.toast('Rub the screen with your finger to wipe the blood off', 4500) });
// Rain: falling over the picture, and running down the glass.
const rain = createRain($('rainfall') as HTMLCanvasElement, glass);
const snow = createSnow($('snowfall') as HTMLCanvasElement);
// How you see: stress (tunnel vision) and a cigarette (smoke, brighter).
const senses = createSenses();
// What you're on: each drug has its own look.
const drugs = createDrugs();
// Every button clicks (a tab ticks); a tab or option you can't press knocks.
addEventListener(
  'click',
  (ev) => {
    const b = (ev.target as Element | null)?.closest?.('button');
    if (!b) return;
    if (b.dataset.tab || b.getAttribute('role') === 'tab' || b.getAttribute('role') === 'radio') sound.tab();
    else sound.click();
    feedback(b, ev as MouseEvent);
  },
  true,
);

/**
 * What a press feels like: a ripple from where you touched, and for some
 * buttons more. Violence (attacks, stamps, torture, and their tabs) flashes
 * red with a jolt; things that are good for you (medicine, a drink, a smoke,
 * a fire, buying something) glow warm and chime softly.
 */
const GOOD = ['use', 'drink', 'smoke', 'fire', 'buy', 'stock', 'pack', 'bump'];
function feedback(b: HTMLButtonElement, ev: MouseEvent) {
  const tone = b.dataset.tone === 'harm' ? 'harm' : GOOD.some((k) => b.dataset[k] !== undefined) ? 'good' : '';
  // (In a shop or a sheet, the sound waits to see if it worked: see withFeedback.)
  if (tone === 'good' && !b.closest('#shop, #sheet')) sound.good();
  const r = b.getBoundingClientRect();
  if (r.width < 4) return;
  if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
  const wrap = document.createElement('span');
  wrap.className = `fx-ripple ${tone ? `fx-${tone}` : ''}`;
  const dot = document.createElement('i');
  const size = Math.max(r.width, r.height) * 2.2;
  const x = (ev.clientX || r.left + r.width / 2) - r.left;
  const y = (ev.clientY || r.top + r.height / 2) - r.top;
  dot.style.cssText = `width:${size}px;height:${size}px;left:${x - size / 2}px;top:${y - size / 2}px`;
  wrap.append(dot);
  b.append(wrap);
  window.setTimeout(() => wrap.remove(), 600);
  if (tone) {
    const flash = (el: HTMLElement) => {
      el.classList.remove('fb-harm', 'fb-good');
      void el.offsetWidth;
      el.classList.add(`fb-${tone}`);
      window.setTimeout(() => el.classList.remove(`fb-${tone}`), 450);
    };
    flash(b);
    // Pressing it may redraw the list (buying something): flash the new one.
    const attrs = Object.entries(b.dataset).filter(([k]) => k !== 'tone');
    window.setTimeout(() => {
      if (b.isConnected || !attrs.length) return;
      const sel = attrs.map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${CSS.escape(v ?? '')}"]`).join('');
      const again = document.querySelector<HTMLElement>(`button${sel}`);
      if (again) flash(again);
    }, 0);
  }
}
addEventListener(
  'pointerdown',
  (ev) => {
    const b = (ev.target as Element | null)?.closest?.('button');
    if (b?.disabled) sound.deny();
  },
  true,
);
// The screen changing (a tab, a drawer, a menu): the glass flickers.
addEventListener('ui-glitch', (e) => {
  const p = (e as CustomEvent<number>).detail;
  glass.pulse(p);
  filmGame.kick(p);
});

const fixedPR = params.has('pr') ? Number(params.get('pr')) : null;
let pixelRatio = 1;

function applySize() {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  film.setSize(pixelRatio);
  filmGame.setSize(pixelRatio);
  glass.setSize(innerWidth, innerHeight, pixelRatio);
  rain.resize(innerWidth, innerHeight, pixelRatio);
  snow.resize(innerWidth, innerHeight, pixelRatio);
  senses.resize(innerWidth, innerHeight);
  game?.setSize(innerWidth, innerHeight, pixelRatio);
}
addEventListener('resize', applySize);

onSettingsChange((s) => {
  setMuted(!s.sound);
  // Each effect's strength: 50 in the settings is the usual (1), 100 double.
  const lv = { grain: s.grain / 50, glitch: s.glitch / 50, static: s.staticFx / 50, fringe: s.fringe / 50 };
  film.setLevels(lv);
  filmGame.setLevels(lv);
  document.body.style.setProperty('--fk', String(lv.fringe));
  document.body.style.setProperty('--gk', String(Math.min(1.6, lv.glitch)));
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
        body: 'Your saved game will be replaced within a few seconds of starting. This cannot be undone.',
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
  if (!ok && staleWrite) {
    openedElsewhere();
    return false;
  }
  if (!ok) menu.toast("Couldn't save: storage is full or blocked");
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
  // (Never two games at once: a double tap on Continue.)
  game?.close();
  try {
    game = new Game(data, $('game'), renderer, glass);
  } catch {
    // The save won't run: the backup, if it will; otherwise say so.
    game?.close();
    game = null;
    const backup = fresh ? null : loadBackup();
    try {
      if (!backup) throw new Error('no backup');
      // (It takes over from the damaged one: its count goes on from there.)
      backup.rev = Math.max(backup.rev ?? 0, data.rev ?? 0);
      game = new Game(backup, $('game'), renderer, glass);
      menu.toast('The save was damaged: loaded the one before it');
    } catch {
      game = null;
      menu.toast("The saved game is damaged and can't be loaded");
      return;
    }
  }
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
    if (game.dead) {
      // (Closed on the death screen: it's still up, and that's where you are.)
      state = 'playing';
      hideMenu();
      return;
    }
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
  // The glass is stored once the menu is up (it takes a moment).
  window.setTimeout(() => glass.persist(), 450);
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
  // Saved as it is now (whatever finished while paused stays finished: no
  // quitting to roll it again).
  if (!game.dead) save();
  if (!game) return;
  game.close();
  game = null;
  state = 'menu';
  document.body.classList.remove('in-game', 'paused');
  menu.setSaveInfo(loadSave());
  showMenu('main');
}

/** The same game was saved from another tab: this copy is out of date. */
function openedElsewhere() {
  if (!game) return;
  game.close();
  game = null;
  state = 'menu';
  document.body.classList.remove('in-game', 'paused');
  menu.setSaveInfo(loadSave());
  showMenu('main');
  menu.toast('The game was played somewhere else. Continue to pick up from there.', 4500);
}
addEventListener('storage', (ev) => {
  if (ev.key === 'darcvoyd.save' && game) openedElsewhere();
});

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
    glass.persist(true);
  }
});
addEventListener('pagehide', () => {
  pause();
  glass.persist(true);
});

menu.setSaveInfo(loadSave());
showMenu('main');
enforceFullscreen();

// Autosave: every 15 seconds while you play, quietly, so nothing is lost if
// the phone closes the page without warning (pausing still saves too).
setInterval(() => {
  if (state === 'playing' && game && !game.dead) game.saveNow();
}, 15_000);
// Ask the browser to keep the save, rather than clear it when space is low.
navigator.storage?.persist?.().catch(() => {});

if (params.has('debug')) {
  // Handle for automated testing.
  Object.assign(window, {
    __app: {
      sound,
      menu,
      glass,
      rain,
      senses,
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

  if (menuVisible && !film.off) film.update(dt);
  // In the game (not under the menu, which has its own).
  if (game && !menuVisible && !filmGame.off) filmGame.update(dt);
  filmGame.visible(!!game && !menuVisible);
  // It only rains in a game (the weather is the save's).
  rain.setAmount(game?.rainAmount ?? 0);
  // Paused: the rain holds still under the menu (no need to draw it every frame).
  if (state !== 'paused') rain.update(dt);
  snow.setAmount(game?.snowAmount ?? 0);
  if (state !== 'paused') snow.update(dt);
  senses.setStress(game && !game.dead ? game.stressNow : 0);
  senses.setSmoking(!!game && !game.dead && game.smoking);
  senses.update(dt);
  const menuUp = !!game && !game.dead && game.inMenu;
  if (document.body.classList.contains('in-menu') !== menuUp) document.body.classList.toggle('in-menu', menuUp);
  const high = game && !game.dead ? game.drugNow : null;
  drugs.update(high?.drug ?? null, high?.k ?? 0, dt);
  glass.setAwake(game && !game.dead ? game.awakeNow : 100);
  glass.update(dt);

  frames++;
  if ((fpsTimer += dt) > 0.5) {
    $('fps').textContent = `${Math.round(frames / fpsTimer)} fps`;
    fpsTimer = 0;
    frames = 0;
  }
});

