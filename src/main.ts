import './style.css';
import * as THREE from 'three';
import { dreamHeight, shared } from './core/shared';
import { AdaptiveResolution, capacity, isMobile, presetFor } from './core/quality';
import { getBest, onSettingsChange, saveBest, settings } from './core/settings';
import { Controls } from './core/controls';
import { createSky } from './world/sky';
import { createTerrain } from './world/terrain';
import { createMonoliths } from './world/monoliths';
import { createParticles } from './world/particles';
import { createOrbs } from './world/orbs';
import { createPost } from './fx/post';
import { createMenu } from './ui/menu';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const params = new URLSearchParams(location.search);

// ---------- Renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOV = 70;
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 1200);
camera.rotation.order = 'YXZ';
camera.position.set(0, dreamHeight(0, 0, 0) + 14, 0);

// ---------- World ----------
const sky = createSky();
const terrain = createTerrain(capacity.terrainSegments);
const blobs = createMonoliths(new THREE.IcosahedronGeometry(1, 3), capacity.blobs, { minScale: 1.5, maxScale: 6 });
const knots = createMonoliths(new THREE.TorusKnotGeometry(1, 0.28, 128, 16), capacity.knots, { minScale: 3, maxScale: 8 });
const particles = createParticles(capacity.particles);
scene.add(sky.mesh, terrain.mesh, blobs.mesh, knots.mesh, particles.points);

// ---------- Game state ----------
type State = 'menu' | 'playing' | 'paused';
let state: State = 'menu';
let score = 0;
let hueTarget = 0;

function setScore(n: number) {
  score = n;
  $('score-n').textContent = String(n);
}

const orbs = createOrbs(scene, (pos) => {
  // Orbs still burst while the menu drifts past them; only gameplay counts.
  shared.uPulseOrigin.value.copy(pos);
  shared.uPulseTime.value = shared.uTime.value;
  hueTarget += 0.13;
  if (state !== 'playing') return;
  setScore(score + 1);
  saveBest(score);
  $('score').classList.remove('bump');
  void $('score').offsetWidth; // restart the CSS animation
  $('score').classList.add('bump');
  if (settings.vibration) {
    try {
      navigator.vibrate?.(30);
    } catch {
      /* vibration not allowed here */
    }
  }
});

// ---------- Post-processing & resolution ----------
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
  particles.setScale(h * pixelRatio, FOV);
}

const quality = new AdaptiveResolution(1, 0.5, 1, applySize);
addEventListener('resize', () => applySize(quality.pixelRatio));

// ---------- Controls & menus ----------
const controls = new Controls(renderer.domElement, $('joy-base'), $('joy-knob'));

let appliedQuality: string | null = null;
onSettingsChange((s) => {
  const preset = presetFor(s.quality);
  particles.setDensity(preset.density);
  blobs.setDensity(Math.max(preset.density, 0.5));
  knots.setDensity(Math.max(preset.density, 0.5));
  post.bloom.strength = preset.bloom;
  // Only reset resolution when the graphics choice actually changes.
  if (appliedQuality !== s.quality) {
    appliedQuality = s.quality;
    const max = fixedPR ?? preset.maxPixelRatio;
    quality.setRange(Math.min(0.5, max), max);
  }
  controls.sensitivity = s.sensitivity;
  controls.invertY = s.invertY;
  $('fps').style.display = s.showFps || params.has('debug') ? 'block' : 'none';
});

const menu = createMenu({ onPlay: play, onResume: resume, onQuit: quitToMenu });
menu.setBest(getBest());

$('hint').textContent = isMobile
  ? 'left thumb · move     right thumb · look'
  : 'WASD · move     drag · look     space / shift · rise / sink';

let hintTimer = 0;

function enterPlay() {
  state = 'playing';
  controls.enabled = true;
  menu.hide();
  document.body.classList.add('playing');
}

function play() {
  setScore(0);
  enterPlay();
  $('hint').classList.remove('faded');
  clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => $('hint').classList.add('faded'), 7000);
  orbs.reset(camera.position, controls.yaw);
  if (isMobile) document.documentElement.requestFullscreen?.().catch(() => {});
}

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  controls.enabled = false;
  controls.release();
  document.body.classList.remove('playing');
  menu.setPauseScore(score);
  menu.show('pause');
}

function resume() {
  enterPlay();
}

function quitToMenu() {
  saveBest(score);
  menu.setBest(getBest());
  state = 'menu';
  controls.enabled = false;
  controls.release();
  document.body.classList.remove('playing');
  menu.show('main');
}

$('pause-btn').addEventListener('click', pause);
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  if (state === 'playing') pause();
  else if (menu.current === 'settings' || menu.current === 'howto') menu.back();
  else if (state === 'paused') resume();
});
// Pause automatically when the player leaves the app.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

menu.show('main');
orbs.reset(camera.position, controls.yaw);
if (params.has('play')) play();

if (params.has('debug')) {
  // Handle for automated testing.
  Object.assign(window, { __game: { camera, controls, scene, menu } });
}

// ---------- Main loop ----------
const timer = new THREE.Timer();
timer.connect(document);
let fpsTimer = 0;

renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = (shared.uTime.value += dt);

  controls.update(dt, camera, state === 'menu');

  // Keep the camera above the (moving) ground and below the clouds.
  // On the menu it glides higher for a wider view.
  const p = camera.position;
  const inMenu = state === 'menu';
  const floor = dreamHeight(p.x, p.z, t) + (inMenu ? 9 : 2.5);
  if (p.y < floor) {
    p.y += (floor - p.y) * Math.min(1, dt * (inMenu ? 1.5 : 12));
    controls.velocity.y = Math.max(controls.velocity.y, 0);
  }
  p.y = Math.min(p.y, 90);

  shared.uCamPos.value.copy(p);
  shared.uHue.value += (hueTarget - shared.uHue.value) * (1 - Math.exp(-dt * 0.8));

  sky.update(p);
  terrain.update(p);
  orbs.update(dt, t, p, controls.yaw);

  const pulseAge = t - shared.uPulseTime.value;
  post.lens.uniforms.uTime.value = t;
  post.lens.uniforms.uPulse.value = Math.max(0, 1 - pulseAge / 1.2);

  post.composer.render(dt);
  quality.tick(dt, fixedPR === null && settings.quality === 'auto');

  if ((fpsTimer += dt) > 0.5) {
    fpsTimer = 0;
    $('fps').textContent = `${quality.fps.toFixed(0)} fps · ${quality.pixelRatio.toFixed(2)}x`;
  }
});
