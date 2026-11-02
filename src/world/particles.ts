import * as THREE from 'three';
import { glslCommon, shared } from '../core/shared';

const BOX = 110;

/**
 * Tens of thousands of drifting motes of light, animated entirely on the GPU.
 * They live in a box that wraps around the camera.
 */
export function createParticles(count: number) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * BOX;
    positions[i * 3 + 1] = (Math.random() - 0.5) * BOX;
    positions[i * 3 + 2] = (Math.random() - 0.5) * BOX;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { ...shared, uBox: { value: BOX }, uScale: { value: 500 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      ${glslCommon}
      attribute float aSeed;
      uniform float uBox;
      uniform float uScale;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float s = aSeed;
        float t = uTime;
        vec3 p = position;
        p.y += t * (0.4 + fract(s * 7.13) * 1.2);
        p += vec3(sin(t * 0.21 + s * 40.0), cos(t * 0.17 + s * 31.0), sin(t * 0.13 + s * 23.0)) * 2.5;
        vec3 rel = mod(p - uCamPos + uBox * 0.5, uBox) - uBox * 0.5;
        vec3 wp = uCamPos + rel;

        float sw = snoise(wp * 0.02 + vec3(0.0, t * 0.05, 0.0));
        wp.xz += vec2(cos(sw * 6.28), sin(sw * 6.28)) * 3.0;
        float pw = pulseWave(wp);
        wp.y += pw * 5.0;

        vec4 mv = viewMatrix * vec4(bend(wp), 1.0);
        float dist = -mv.z;
        float size = (0.12 + fract(s * 13.7) * 0.25) * (1.0 + pw * 2.0);
        gl_PointSize = clamp(size * uScale / max(dist, 0.1), 1.0, 48.0);
        gl_Position = projectionMatrix * mv;

        vColor = palette(fract(s * 3.0) * 0.35 + wp.y * 0.01 + t * 0.01) * (0.8 + pw * 4.0);
        float edge = 1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(rel));
        float near = smoothstep(0.3, 2.5, dist);
        float twinkle = 0.6 + 0.4 * sin(t * (1.0 + fract(s * 5.0) * 3.0) + s * 50.0);
        vAlpha = edge * near * twinkle;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = exp(-dot(c, c) * 18.0) - 0.011;
        if (a <= 0.0) discard;
        gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    setDensity(fraction: number) {
      geometry.setDrawRange(0, Math.round(count * fraction));
    },
    /** Converts world-space size to pixels: call on resize / resolution changes. */
    setScale(pixelHeight: number, fovDeg: number) {
      material.uniforms.uScale.value = (pixelHeight * 0.5) / Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
    },
  };
}
