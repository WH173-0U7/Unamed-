import * as THREE from 'three';
import { dreamHeight, glslCommon, shared } from '../core/shared';

const ORB_COUNT = 6;
const COLLECT_RADIUS = 4.5;
const SHOCK_LIFE = 1.6;

const orbVertex = /* glsl */ `
  ${glslCommon}
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = bend(wp.xyz);
    vN = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
  }
`;

interface Orb {
  group: THREE.Group;
  phase: number;
}

interface Shock {
  mesh: THREE.Mesh;
  age: number;
}

/**
 * Collectible light orbs. Each has a beam of light reaching into the sky so
 * it can be found from far away. Collecting one sends a wave through the world.
 */
export function createOrbs(scene: THREE.Scene, onCollect: (pos: THREE.Vector3) => void) {
  const coreMat = new THREE.ShaderMaterial({
    uniforms: { ...shared },
    vertexShader: orbVertex,
    fragmentShader: /* glsl */ `
      ${glslCommon}
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vec3 v = normalize(uCamPos - vW);
        float fres = pow(1.0 - abs(dot(normalize(vN), v)), 2.0);
        vec3 col = mix(vec3(2.5), palette(uTime * 0.05) * 5.0, fres);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const beamMat = new THREE.ShaderMaterial({
    uniforms: { ...shared },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: orbVertex,
    fragmentShader: /* glsl */ `
      ${glslCommon}
      varying vec3 vN;
      varying vec3 vW;
      varying vec2 vUv;
      void main() {
        vec3 v = normalize(uCamPos - vW);
        float core = pow(abs(dot(normalize(vN), v)), 3.0);
        float fade = pow(1.0 - vUv.y, 1.5) * (0.4 + 0.6 * smoothstep(0.0, 0.02, vUv.y));
        float flow = 0.7 + 0.3 * sin(vUv.y * 60.0 - uTime * 6.0);
        vec3 col = palette(uTime * 0.05 + 0.1) * core * fade * flow * 1.6;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const shockMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uLife: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: orbVertex,
    fragmentShader: /* glsl */ `
      ${glslCommon}
      uniform float uLife;
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vec3 v = normalize(uCamPos - vW);
        float fres = pow(1.0 - abs(dot(normalize(vN), v)), 3.0);
        gl_FragColor = vec4(palette(uTime * 0.05) * fres * uLife * 3.0, 1.0);
      }
    `,
  });

  const coreGeo = new THREE.SphereGeometry(1.1, 32, 16);
  const beamGeo = new THREE.CylinderGeometry(0.25, 1.0, 220, 16, 1, true);
  beamGeo.translate(0, 110, 0);
  const shockGeo = new THREE.SphereGeometry(1, 32, 16);

  const orbs: Orb[] = [];
  for (let i = 0; i < ORB_COUNT; i++) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(coreGeo, coreMat);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    core.frustumCulled = false;
    beam.frustumCulled = false;
    group.add(core, beam);
    scene.add(group);
    orbs.push({ group, phase: Math.random() * Math.PI * 2 });
  }

  const shocks: Shock[] = [];
  for (let i = 0; i < 3; i++) {
    const mat = shockMat.clone();
    // Clone copies uniform values; re-link the shared ones so they stay live.
    Object.assign(mat.uniforms, shared);
    const mesh = new THREE.Mesh(shockGeo, mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    shocks.push({ mesh, age: SHOCK_LIFE });
  }

  const tmp = new THREE.Vector3();

  function place(orb: Orb, cam: THREE.Vector3, yaw: number, near: boolean) {
    const angle = yaw + (Math.random() - 0.5) * (near ? 2.4 : 1.6);
    const dist = near ? 35 + Math.random() * 90 : 80 + Math.random() * 70;
    // Camera looks down -Z at yaw 0.
    orb.group.position.set(cam.x - Math.sin(angle) * dist, 0, cam.z - Math.cos(angle) * dist);
  }

  function spawnShock(pos: THREE.Vector3) {
    const s = shocks.find((x) => x.age >= SHOCK_LIFE) ?? shocks[0];
    s.age = 0;
    s.mesh.position.copy(pos);
    s.mesh.visible = true;
  }

  return {
    reset(cam: THREE.Vector3, yaw: number) {
      for (const o of orbs) place(o, cam, yaw, true);
    },
    update(dt: number, time: number, cam: THREE.Vector3, yaw: number) {
      for (const o of orbs) {
        const p = o.group.position;
        p.y = dreamHeight(p.x, p.z, time) + 5 + Math.sin(time * 1.3 + o.phase) * 0.8;
        const s = 1 + Math.sin(time * 3 + o.phase) * 0.08;
        o.group.children[0].scale.setScalar(s);

        tmp.copy(p).sub(cam);
        if (tmp.length() < COLLECT_RADIUS) {
          spawnShock(p);
          onCollect(p.clone());
          place(o, cam, yaw, false);
        } else if (Math.hypot(tmp.x, tmp.z) > 210) {
          place(o, cam, yaw, false);
        }
      }
      for (const s of shocks) {
        if (s.age >= SHOCK_LIFE) {
          s.mesh.visible = false;
          continue;
        }
        s.age += dt;
        const k = s.age / SHOCK_LIFE;
        s.mesh.scale.setScalar(1 + Math.pow(k, 0.5) * 30);
        (s.mesh.material as THREE.ShaderMaterial).uniforms.uLife.value = 1 - k;
      }
    },
  };
}
