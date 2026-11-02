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
  // Integer hash: stable on mobile GPUs, no visible patterns.
  float hash(vec2 p) {
    uvec2 q = uvec2(ivec2(floor(p)) + 32768) * uvec2(1597334673u, 3812015801u);
    uint n = (q.x ^ q.y) * 1597334673u;
    return float(n) * (1.0 / 4294967295.0);
  }
  float hash1(float x) {
    return hash(vec2(x, 17.0));
  }
  float noise1(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash1(i), hash1(i + 1.0), f * f * (3.0 - 2.0 * f));
  }
`;
