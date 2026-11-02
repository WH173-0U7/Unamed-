import * as THREE from 'three';
import { glslCommon, shared } from '../core/shared';

/** Sky dome: horizon gradient, swirling nebula, twinkling stars and an eclipsed ring-moon. */
export function createSky() {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...shared },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${glslCommon}
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 d = normalize(vDir);
        vec3 col = skyBase(d);
        float up = smoothstep(0.0, 0.35, d.y);

        // Nebula: domain-warped noise, slowly drifting.
        vec3 q = d * 2.2;
        float a = fbm(q + vec3(0.0, uTime * 0.015, 0.0));
        float b = fbm(q * 1.7 + a * 1.5 + vec3(uTime * 0.01));
        vec3 neb = palette(0.3 + b * 0.6 + a * 0.2) * pow(max(b + 0.2, 0.0), 2.2) * 0.55;
        col += neb * up;

        // Stars.
        vec3 sp = d * 220.0;
        vec3 cell = floor(sp);
        vec3 f = fract(sp) - 0.5;
        float h = hash(cell);
        float star = step(0.985, h) * (1.0 - smoothstep(0.0, 0.35, length(f)));
        star *= 0.6 + 0.4 * sin(uTime * 2.0 + h * 100.0);
        col += vec3(star) * up * 1.5;

        // Eclipsed ring-moon.
        vec3 md = normalize(vec3(-0.4, 0.35, -0.85));
        float ang = acos(clamp(dot(d, md), -1.0, 1.0));
        float ring = exp(-pow((ang - 0.16) / 0.006, 2.0));
        float disc = 1.0 - smoothstep(0.12, 0.13, ang);
        col = mix(col, palette(0.15) * 0.02, disc);
        col += palette(0.1 + uTime * 0.01) * ring * 3.0;
        col += palette(0.1) * exp(-ang * 6.0) * 0.25 * (1.0 - disc);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;

  return {
    mesh,
    update(camPos: THREE.Vector3) {
      mesh.position.copy(camPos);
    },
  };
}
