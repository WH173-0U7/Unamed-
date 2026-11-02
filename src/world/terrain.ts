import * as THREE from 'three';
import { glslCommon, shared } from '../core/shared';

const SIZE = 400;

/**
 * Endless breathing landscape. The mesh follows the camera and the shader
 * computes the height from world position, so the ground never ends.
 */
export function createTerrain(segments: number) {
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    uniforms: { ...shared },
    vertexShader: /* glsl */ `
      ${glslCommon}
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vH;
      varying float vPulse;

      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = dreamHeight(wp.xz, uTime);
        float e = 0.8;
        float hx = dreamHeight(wp.xz + vec2(e, 0.0), uTime);
        float hz = dreamHeight(wp.xz + vec2(0.0, e), uTime);
        vNormal = normalize(vec3(h - hx, e, h - hz));

        float pw = pulseWave(vec3(wp.x, 0.0, wp.z));
        wp.y = h + pw * 2.5;
        vH = h;
        vPulse = pw;
        vWorld = bend(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${glslCommon}
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vH;
      varying float vPulse;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(uCamPos - vWorld);
        float dist = length(uCamPos - vWorld);

        float nz = snoise(vec3(vWorld.xz * 0.02, uTime * 0.04));
        vec3 base = palette(vH * 0.015 + nz * 0.25 + 0.1);
        float diff = 0.35 + 0.65 * max(dot(n, normalize(vec3(0.4, 0.8, 0.2))), 0.0);
        vec3 col = base * base * 0.3 * diff;

        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        col += palette(0.5 + vH * 0.02) * fres * 0.4;

        // Glowing contour lines that flow up the hills.
        float hl = vH * 0.6 + uTime * 0.25;
        float fw = fwidth(hl);
        float f = abs(fract(hl + 0.5) - 0.5);
        float line = 1.0 - smoothstep(fw * 0.5, fw * 1.5, f);
        float lineFade = 1.0 - smoothstep(25.0, 110.0, dist);
        col += palette(hl * 0.05 + 0.3) * line * lineFade * 1.1;

        col += palette(uTime * 0.1 + 0.2) * vPulse * 2.5;

        gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const step = SIZE / segments;

  return {
    mesh,
    update(camPos: THREE.Vector3) {
      // Snap to the grid spacing so vertices don't "swim" as we move.
      mesh.position.set(Math.round(camPos.x / step) * step, 0, Math.round(camPos.z / step) * step);
    },
  };
}
