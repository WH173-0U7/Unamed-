import * as THREE from 'three';

/** A shader that covers the whole canvas. Used for screen-wide GPU effects. */
export function createFullscreenShader(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.Camera();

  return {
    material,
    render(renderer: THREE.WebGLRenderer) {
      renderer.render(scene, camera);
    },
  };
}

/** Shared GLSL helpers. */
export const glslHash = /* glsl */ `
  // PCG integer hash: no visible patterns, and stays exact however long the
  // game runs (frame counters go in as a separate seed, not added to coordinates).
  uint pcg(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
  }
  uint seedOf(float s) {
    return uint(mod(floor(s), 16777216.0));
  }
  /** Random 0..1 for an integer cell. */
  float hash(vec2 p) {
    uvec2 q = uvec2(ivec2(floor(p)) + 65536);
    return float(pcg(q.x + pcg(q.y))) / 4294967295.0;
  }
  /** Random 0..1 for an integer cell, different for every seed (e.g. frame number). */
  float hash(vec2 p, float seed) {
    uvec2 q = uvec2(ivec2(floor(p)) + 65536);
    return float(pcg(q.x + pcg(q.y + pcg(seedOf(seed))))) / 4294967295.0;
  }
  float hash1(float x) {
    return float(pcg(seedOf(x) + 1013904223u)) / 4294967295.0;
  }
  float noise1(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash1(i), hash1(i + 1.0), f * f * (3.0 - 2.0 * f));
  }
`;
