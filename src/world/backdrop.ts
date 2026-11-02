import * as THREE from 'three';
import { dreamHeight, shared } from '../core/shared';
import { capacity } from '../core/quality';
import { createSky } from './sky';
import { createTerrain } from './terrain';
import { createMonoliths } from './monoliths';
import { createParticles } from './particles';

/**
 * The animated dream world shown behind the menus. The camera drifts on its
 * own; nothing here is interactive.
 */
export function createBackdrop(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const sky = createSky();
  const terrain = createTerrain(capacity.terrainSegments);
  const blobs = createMonoliths(new THREE.IcosahedronGeometry(1, 3), capacity.blobs, { minScale: 1.5, maxScale: 6 });
  const knots = createMonoliths(new THREE.TorusKnotGeometry(1, 0.28, 128, 16), capacity.knots, { minScale: 3, maxScale: 8 });
  const particles = createParticles(capacity.particles);
  scene.add(sky.mesh, terrain.mesh, blobs.mesh, knots.mesh, particles.points);

  let yaw = 0;
  const pitch = -0.08;
  camera.rotation.order = 'YXZ';
  camera.position.set(0, dreamHeight(0, 0, 0) + 14, 0);

  return {
    particles,
    setDensity(fraction: number) {
      particles.setDensity(fraction);
      blobs.setDensity(Math.max(fraction, 0.5));
      knots.setDensity(Math.max(fraction, 0.5));
    },
    update(dt: number) {
      const t = shared.uTime.value;
      yaw += dt * 0.04;
      const p = camera.position;
      p.x -= Math.sin(yaw) * 5.5 * dt;
      p.z -= Math.cos(yaw) * 5.5 * dt;
      // Glide smoothly over the hills.
      const target = dreamHeight(p.x, p.z, t) + 12;
      p.y += (target - p.y) * Math.min(1, dt * 0.8);
      camera.rotation.set(pitch, yaw, Math.sin(t * 0.2) * 0.03, 'YXZ');

      shared.uCamPos.value.copy(p);
      sky.update(p);
      terrain.update(p);
    },
  };
}
