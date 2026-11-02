import './style.css';
import * as THREE from 'three';
import { shared } from './core/shared';
import { AdaptiveResolution, isMobile, presetFor } from './core/quality';
import { onSettingsChange, settings } from './core/settings';
import { deleteSave, formatAgo, formatPlayTime, hasSave, loadSave, newSave } from './core/save';
import { createBackdrop } from './world/backdrop';
import { createPost } from './fx/post';
import { createMenu } from './ui/menu';
import { Game } from './game/game';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const params = new URLSearchParams(location.search);

/** How often progress is saved automatically while playing (seconds). */
const AUTOSAVE_EVERY = 30;
/** Length of the fade between menu and game (ms); matches #game in style.css. */
const FADE_MS = 800;

// ---------- Renderer & menu backdrop ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOV = 70;
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 1200);
const backdrop = createBackdrop(scene, camera);
const post = createPost(renderer, scene, camera);
const fixedPR = params.has('pr') ? Number(params.get('pr')) : null;

function applySize(pixelRatio: number) {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h);
  post.setSize(w, h, pixelRatio);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  backdrop.particles.setScale(h * pixelRatio, FOV);
}

const resolution = new AdaptiveResolution(1, 0.5, 1, applySize);
addEventListener('resize', () => applySize(resolution.pixelRatio));

let appliedQuality: string | null = null;
onSettingsChange((s) => {
  const preset = presetFor(s.quality);
  backdrop.setDensity(preset.density);
  post.bloom.strength = preset.bloom;
  if (appliedQuality !== s.quality) {
    appliedQuality = s.quality;
    const max = fixedPR ?? preset.maxPixelRatio;
    resolution.setRange(Math.min(0.5, max), max);
  }
  $('fps').style.display = s.showFps || params.has('debug') ? 'block' : 'none';
});

// ---------- App state ----------
type State = 'menu' | 'playing' | 'paused';
let state: State = 'menu';
let game: Game | null = null;
let sinceAutosave = 0;
/** The backdrop is only drawn while it can be seen. */
let backdropVisible = true;
let fadeTimer = 0;

const menu = createMenu({
  onContinue: continueGame,
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
  game = new Game(data, $('game'));
  if (fresh) save(); // so Continue is available straight away
  state = 'playing';
  sinceAutosave = 0;
  menu.hide();
  game.start();
  document.body.classList.add('in-game');

  // Stop drawing the menu world once the screen has faded to black.
  clearTimeout(fadeTimer);
  fadeTimer = window.setTimeout(() => {
    if (state !== 'menu') backdropVisible = false;
  }, FADE_MS + 100);

  if (isMobile) document.documentElement.requestFullscreen?.().catch(() => {});
}

function continueGame() {
  startGame(false);
}

function pause() {
  if (state !== 'playing' || !game) return;
  state = 'paused';
  game.pause();
  document.body.classList.add('paused');
  save();
  updatePauseInfo();
  menu.show('pause');
}

function resume() {
  if (state !== 'paused' || !game) return;
  state = 'playing';
  game.resume();
  document.body.classList.remove('paused');
  menu.hide();
}

function quitToMenu() {
  if (!game) return;
  save();
  game.close();
  game = null;
  state = 'menu';
  clearTimeout(fadeTimer);
  backdropVisible = true;
  document.body.classList.remove('in-game', 'paused');
  menu.setSaveInfo(loadSave());
  menu.show('main');
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
menu.show('main');

if (params.has('debug')) {
  // Handle for automated testing.
  Object.assign(window, { __app: { menu, get state() { return state; }, get game() { return game; } } });
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
  }

  if (backdropVisible) {
    shared.uTime.value += dt;
    backdrop.update(dt);
    post.lens.uniforms.uTime.value = shared.uTime.value;
    post.composer.render(dt);
    resolution.tick(dt, fixedPR === null && settings.quality === 'auto');
  }

  frames++;
  if ((fpsTimer += dt) > 0.5) {
    $('fps').textContent = `${Math.round(frames / fpsTimer)} fps`;
    fpsTimer = 0;
    frames = 0;
  }
});
