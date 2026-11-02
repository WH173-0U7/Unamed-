import * as THREE from 'three';
import { glslCommon, shared } from '../core/shared';

const CELL = 340;

/**
 * Floating, twisting, breathing shapes. One draw call per set (GPU
 * instancing); positions wrap around the camera so the field never runs out.
 */
export function createMonoliths(base: THREE.BufferGeometry, count: number, opts: { minScale: number; maxScale: number }) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute('position', base.getAttribute('position'));
  geometry.setAttribute('normal', base.getAttribute('normal'));
  geometry.instanceCount = count;

  const offsets = new Float32Array(count * 4);
  const seeds = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    offsets[i * 4 + 0] = (Math.random() - 0.5) * CELL;
    offsets[i * 4 + 1] = 6 + Math.random() * 30;
    offsets[i * 4 + 2] = (Math.random() - 0.5) * CELL;
    offsets[i * 4 + 3] = opts.minScale + Math.random() * (opts.maxScale - opts.minScale);
    seeds[i * 2 + 0] = Math.random();
    seeds[i * 2 + 1] = 0.8 + Math.random() * 2.2;
  }
  geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 4));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 2));

  const material = new THREE.ShaderMaterial({
    uniforms: { ...shared, uCell: { value: CELL } },
    vertexShader: /* glsl */ `
      ${glslCommon}
      attribute vec4 aOffset;
      attribute vec2 aSeed;
      uniform float uCell;
      varying vec3 vN;
      varying vec3 vW;
      varying float vSeed;
      varying float vNoise;
      varying float vPulse;

      void main() {
        float t = uTime;
        float s = aSeed.x;
        vec2 rel = mod(aOffset.xz - uCamPos.xz + uCell * 0.5, uCell) - uCell * 0.5;
        vec2 cxz = uCamPos.xz + rel;
        vec3 c = vec3(cxz.x, dreamHeight(cxz, t) + aOffset.y + sin(t * 0.3 + s * 6.28) * 2.0, cxz.y);

        vec3 p = position;
        float n = snoise(normal * 1.2 + vec3(t * 0.15 + s * 10.0));
        vNoise = n;
        p += normal * n * 0.3;
        p.y *= aSeed.y;

        float a = p.y * 0.25 * sin(t * 0.2 + s * 10.0) + t * 0.2 * (s - 0.5);
        mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
        p.xz = R * p.xz;
        vec3 nn = normal;
        nn.xz = R * nn.xz;

        vec3 wp = c + p * aOffset.w;
        float pw = pulseWave(wp);
        wp.y += pw * 3.0;
        wp = bend(wp);

        vW = wp;
        vN = normalize(nn);
        vSeed = s;
        vPulse = pw;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${glslCommon}
      varying vec3 vN;
      varying vec3 vW;
      varying float vSeed;
      varying float vNoise;
      varying float vPulse;

      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(uCamPos - vW);
        float fres = pow(1.0 - abs(dot(n, v)), 2.5);
        vec3 c1 = palette(vSeed * 0.5 + vNoise * 0.3 + uTime * 0.02);
        float bands = 0.5 + 0.5 * sin(vNoise * 12.0 + uTime * 1.5 + vW.y * 0.5);
        vec3 col = c1 * 0.04 + c1 * bands * bands * 0.18;
        col += palette(vSeed * 0.5 + 0.3) * fres * 1.6;
        col += vec3(1.0) * vPulse * 1.5;
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh };
}
