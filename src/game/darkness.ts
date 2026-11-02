import * as THREE from 'three';
import { createFullscreenShader, glslHash } from '../fx/fullscreen';
import { MAX_WISPS, type Orb } from './orb';

/**
 * Draws the dark place and the orb, all on the GPU:
 *
 * 1. Light layer: the orb's core and its wisps, drawn as soft points.
 * 2. Trails: each frame the previous image is faded, nudged by a slow swirl
 *    and the new light added on top, leaving smoky trails behind movement.
 * 3. Final image: fog and grit that only exist where the orb's light reaches,
 *    the orb's halo, the trails, then grain and vignette.
 */
export function createDarkness(renderer: THREE.WebGLRenderer) {
  const floatTargets =
    renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
  const targetOpts: THREE.RenderTargetOptions = {
    type: floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  };
  const lightRT = new THREE.WebGLRenderTarget(1, 1, targetOpts);
  let trailA = new THREE.WebGLRenderTarget(1, 1, targetOpts);
  let trailB = new THREE.WebGLRenderTarget(1, 1, targetOpts);

  // ---------- 1. Light layer: orb core + wisps as points ----------
  const count = MAX_WISPS + 1;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  const pointsMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        gl_PointSize = aSize * uScale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = exp(-dot(c, c) * 14.0) * vAlpha;
        gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * a, a);
      }
    `,
  });
  const points = new THREE.Points(geometry, pointsMat);
  points.frustumCulled = false;
  const lightScene = new THREE.Scene();
  lightScene.add(points);
  // Screen points, y pointing down, like touch coordinates.
  const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1);

  // ---------- 2. Trails ----------
  const feedback = createFullscreenShader(
    /* glsl */ `
      uniform sampler2D tPrev;
      uniform sampler2D tLight;
      uniform float uDecay;
      uniform float uTime;
      uniform vec2 uTexel;
      varying vec2 vUv;
      void main() {
        // A slow swirl and a slight rise, so trails curl like smoke.
        vec2 q = vUv * 5.0;
        vec2 swirl = vec2(sin(q.y * 1.7 + uTime * 0.6), cos(q.x * 1.3 - uTime * 0.5));
        vec2 uv = vUv + swirl * uTexel * 0.9 + vec2(0.0, uTexel.y * 0.5);
        // Soften a little each frame (4-tap blur) as it fades.
        vec3 prev = 0.25 * (
          texture2D(tPrev, uv + vec2(uTexel.x, 0.0)).rgb + texture2D(tPrev, uv - vec2(uTexel.x, 0.0)).rgb +
          texture2D(tPrev, uv + vec2(0.0, uTexel.y)).rgb + texture2D(tPrev, uv - vec2(0.0, uTexel.y)).rgb);
        gl_FragColor = vec4(prev * uDecay + texture2D(tLight, vUv).rgb, 1.0);
      }
    `,
    {
      tPrev: { value: null },
      tLight: { value: null },
      uDecay: { value: 0.95 },
      uTime: { value: 0 },
      uTexel: { value: new THREE.Vector2() },
    },
  );

  // ---------- 3. Final image ----------
  const final = createFullscreenShader(
    /* glsl */ `
      uniform sampler2D tTrail;
      uniform vec2 uRes;      // screen size in points
      uniform vec2 uOrb;      // orb position in points, y up
      uniform float uEnergy;
      uniform float uPresence;
      uniform float uHint;
      uniform float uTime;
      varying vec2 vUv;
      ${glslHash}

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float s = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          s += a * vnoise(p);
          p = p * 2.03 + 17.0;
          a *= 0.5;
        }
        return s;
      }

      void main() {
        vec2 p = vUv * uRes;
        float m = min(uRes.x, uRes.y);
        float e = uEnergy;
        float pr = uPresence;
        float d = length(p - uOrb);

        // How far the orb's light reaches into the dark.
        float reach = m * (0.06 + 0.45 * e);
        float light = pr * (0.3 + 0.7 * e) / (1.0 + pow(d / reach, 2.0) * 3.0);

        // The place, seen only where the light reaches: rough rock split by
        // dark cracks, with fog drifting over it.
        float rock = pow(fbm(p * 0.018), 1.6) * 1.5;
        float crack = pow(1.0 - abs(vnoise(p * 0.028 + 3.0) * 2.0 - 1.0), 10.0);
        float grit = vnoise(p * 0.4) * 0.6 + hash(p) * 0.4;
        vec3 ground = vec3(0.3, 0.32, 0.37) * (rock * (1.0 - crack * 0.75) + grit * 0.18);
        vec2 fp = p * 0.005 + vec2(uTime * 0.015, -uTime * 0.01);
        float fog = smoothstep(0.35, 0.85, fbm(fp + fbm(fp * 1.7 + uTime * 0.03) * 1.5));
        vec3 place = (ground + vec3(0.4, 0.5, 0.65) * fog * 0.55) * light;

        // The orb: a hot core and a halo that swells as it feeds. The halo's
        // colours separate slightly at the edge, like light through old glass.
        float breathe = 1.0 + 0.08 * sin(uTime * (2.0 + e * 3.0));
        float hr = (8.0 + 70.0 * e) * breathe;
        vec3 r3 = vec3(1.05, 1.0, 0.94) * hr;
        vec3 halo = exp(-d / (r3 * 0.35)) + exp(-d / r3) * 0.2;
        vec3 tint = mix(vec3(0.4, 0.75, 1.0), vec3(0.85, 0.95, 1.0), e);
        float coreR = (2.5 + 6.0 * e) * breathe;
        float core = 1.0 - smoothstep(coreR * 0.5, coreR, d);
        vec3 orb = (tint * halo * (0.5 + 1.4 * e) + vec3(1.0) * core * 1.6) * pr;

        // Before the first touch: a faint ember in the dark, breathing.
        float c = length(p - uRes * 0.5);
        float ember = exp(-c / 5.0) * (0.5 + 0.5 * sin(uTime * 1.6)) * 0.35 * uHint;

        vec3 col = place + texture2D(tTrail, vUv).rgb * vec3(0.7, 0.85, 1.0) + orb + vec3(0.6, 0.8, 1.0) * ember;
        col = 1.0 - exp(-col * 1.4); // soft highlights

        // Grain and a heavy vignette: the dark closes in at the edges.
        float frame = floor(uTime * 24.0);
        col += (hash(floor(p), frame) - 0.5) * 0.035;
        vec2 v = vUv - 0.5;
        v.x *= uRes.x / uRes.y;
        col *= 1.0 - smoothstep(0.3, 1.0, length(v)) * 0.8;
        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }
    `,
    {
      tTrail: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uOrb: { value: new THREE.Vector2() },
      uEnergy: { value: 0 },
      uPresence: { value: 0 },
      uHint: { value: 0 },
      uTime: { value: 0 },
    },
  );

  let height = 1;
  let time = 0;
  let hint = 0;
  /** Trails and light are drawn at half resolution: they're soft anyway. */
  const TRAIL_SCALE = 0.5;

  return {
    setSize(w: number, h: number) {
      height = h;
      const pr = renderer.getPixelRatio();
      const tw = Math.max(1, Math.round(w * pr * TRAIL_SCALE));
      const th = Math.max(1, Math.round(h * pr * TRAIL_SCALE));
      lightRT.setSize(tw, th);
      trailA.setSize(tw, th);
      trailB.setSize(tw, th);
      camera.right = w;
      camera.bottom = h;
      camera.updateProjectionMatrix();
      pointsMat.uniforms.uScale.value = pr * TRAIL_SCALE;
      feedback.material.uniforms.uTexel.value.set(1 / tw, 1 / th);
      final.material.uniforms.uRes.value.set(w, h);
    },

    render(orb: Orb, dt: number) {
      time += dt;
      hint += ((orb.everTouched ? 0 : 1) - hint) * (1 - Math.exp(-dt * 2));

      // 1. Light layer.
      const w = orb.wisps;
      for (let i = 0; i < MAX_WISPS; i++) {
        const j = i * 6;
        positions[i * 3] = w[j];
        positions[i * 3 + 1] = w[j + 1];
        sizes[i] = w[j + 5] * (2 + orb.energy * 2);
        alphas[i] = Math.max(0, w[j + 4]) * 0.9;
      }
      positions[MAX_WISPS * 3] = orb.pos.x;
      positions[MAX_WISPS * 3 + 1] = orb.pos.y;
      sizes[MAX_WISPS] = 10 + orb.energy * 22;
      alphas[MAX_WISPS] = orb.presence * (0.35 + orb.energy * 0.6);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aAlpha.needsUpdate = true;

      renderer.setRenderTarget(lightRT);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(lightScene, camera);

      // 2. Trails (frame-rate independent fade).
      feedback.material.uniforms.tPrev.value = trailA.texture;
      feedback.material.uniforms.tLight.value = lightRT.texture;
      feedback.material.uniforms.uDecay.value = Math.pow(0.955, dt * 60);
      feedback.material.uniforms.uTime.value = time;
      renderer.setRenderTarget(trailB);
      feedback.render(renderer);
      [trailA, trailB] = [trailB, trailA];

      // 3. Final image to the screen.
      const u = final.material.uniforms;
      u.tTrail.value = trailA.texture;
      u.uOrb.value.set(orb.pos.x, height - orb.pos.y);
      u.uEnergy.value = orb.energy;
      u.uPresence.value = orb.presence;
      u.uHint.value = hint;
      u.uTime.value = time;
      renderer.setRenderTarget(null);
      final.render(renderer);
    },

    dispose() {
      lightRT.dispose();
      trailA.dispose();
      trailB.dispose();
      geometry.dispose();
      pointsMat.dispose();
    },
  };
}
