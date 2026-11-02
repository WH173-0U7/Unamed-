import './style.css';
import * as THREE from 'three';
import { dreamHeight, shared } from './core/shared';
import { AdaptiveResolution, isMobile, tier } from './core/quality';
import { Controls } from './core/controls';
import { createSky } from './world/sky';
import { createTerrain } from './world/terrain';
import { createMonoliths } from './world/monoliths';
import { createParticles } from './world/particles';
import { createOrbs } from './world/orbs';
import { createPost } from './fx/post';

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
camera.position.set(0, dreamHeight(0, 0, 0) + 10, 0);

// ---------- World ----------
const sky = createSky();
const terrain = createTerrain(tier.terrainSegments);
const blobs = createMonoliths(new THREE.IcosahedronGeometry(1, 3), tier.blobs, { minScale: 1.5, maxScale: 6 });
const knots = createMonoliths(new THREE.TorusKnotGeometry(1, 0.28, 128, 16), tier.knots, { minScale: 3, maxScale: 8 });
const particles = createParticles(tier.particles);
scene.add(sky.mesh, terrain.mesh, blobs.mesh, knots.mesh, particles.points);

let score = 0;
let hueTarget = 0;
const orbs = createOrbs(scene, (pos) => {
  score++;
  $('score-n').textContent = String(score);
  $('score').classList.remove('bump');
  void $('score').offsetWidth; // restart the CSS animation
  $('score').classList.add('bump');
  shared.uPulseOrigin.value.copy(pos);
  shared.uPulseTime.value = shared.uTime.value;
  hueTarget += 0.13;
  try {
    navigator.vibrate?.(30);
  } catch {
    /* vibration not allowed here */
  }
});

// ---------- Post-processing & resolution ----------
const post = createPost(renderer, scene, camera);
const maxPR = Math.min(devicePixelRatio || 1, tier.maxPixelRatio);
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

const quality = new AdaptiveResolution(fixedPR ?? maxPR, 0.5, fixedPR ?? maxPR, applySize);
applySize(quality.pixelRatio);
addEventListener('resize', () => applySize(quality.pixelRatio));

// ---------- Controls & UI ----------
const controls = new Controls(renderer.domElement, $('joy-base'), $('joy-knob'));
let started = false;

$('hint').textContent = isMobile
  ? 'left thumb · move     right thumb · look'
  : 'WASD · move     drag · look     space / shift · rise / sink';

function start() {
  if (started) return;
  started = true;
  controls.enabled = true;
  $('intro').classList.add('hidden');
  $('hud').classList.add('visible');
  setTimeout(() => $('hint').classList.add('faded'), 7000);
  if (isMobile) document.documentElement.requestFullscreen?.().catch(() => {});
}
$('intro').addEventListener('click', start);
addEventListener('keydown', (e) => {
  if (e.code === 'Enter' || e.code === 'Space') start();
});
if (params.has('play')) start();

const showFps = params.has('debug');
if (showFps) {
  $('fps').style.display = 'block';
  // Handle for automated testing.
  Object.assign(window, { __game: { camera, controls, orbs: scene } });
}

orbs.reset(camera.position, controls.yaw);

// ---------- Main loop ----------
const timer = new THREE.Timer();
timer.connect(document);
let fpsTimer = 0;

renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = (shared.uTime.value += dt);

  controls.update(dt, camera, !started);

  // Keep the camera above the (moving) ground and below the clouds.
  const p = camera.position;
  const floor = dreamHeight(p.x, p.z, t) + 2.5;
  if (p.y < floor) {
    p.y += (floor - p.y) * Math.min(1, dt * 12);
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
  if (fixedPR === null) quality.tick(dt);

  if (showFps && (fpsTimer += dt) > 0.5) {
    fpsTimer = 0;
    $('fps').textContent = `${quality.fps.toFixed(0)} fps · ${quality.pixelRatio.toFixed(2)}x`;
  }
});
