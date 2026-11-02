import * as THREE from 'three';
import { createFullscreenShader, glslHash } from '../fx/fullscreen';
import { MAX_THREADS, type View, type Whisp } from './whisp';

/**
 * Draws the dark place and the Whisp, all on the GPU:
 *
 * 1. Light layer: the Whisp's core and its threads, drawn as soft points.
 * 2. Trails: each frame the previous image is faded, nudged by a slow swirl
 *    and the new light added on top, leaving smoky trails behind movement.
 * 3. Final image: the void (rock islands over a bottomless abyss, with
 *    faint specks drifting at several depths), seen only where the Whisp's
 *    light reaches, plus the Whisp's halo, the trails, grain and vignette.
 *
 * Everything is placed in world positions, so the void scrolls past as the
 * view follows the Whisp; deeper layers scroll slower, giving depth.
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

  // ---------- 1. Light layer: whisp core + threads as points ----------
  const count = MAX_THREADS + 1;
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
      uniform vec2 uShift;   // how far the view moved this frame, in texture units
      varying vec2 vUv;
      void main() {
        // A slow swirl and a slight rise, so trails curl like smoke.
        vec2 q = vUv * 5.0;
        vec2 swirl = vec2(sin(q.y * 1.7 + uTime * 0.6), cos(q.x * 1.3 - uTime * 0.5));
        // Trails stay where they were left in the void while the view moves.
        vec2 uv = vUv + uShift + swirl * uTexel * 0.9 + vec2(0.0, uTexel.y * 0.5);
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
      uShift: { value: new THREE.Vector2() },
    },
  );

  // ---------- 3. Final image ----------
  const final = createFullscreenShader(
    /* glsl */ `
      uniform sampler2D tTrail;
      uniform vec2 uRes;      // screen size in points
      uniform vec2 uWhisp;    // the Whisp on screen, in points, y up
      uniform vec2 uView;     // world position at the centre of the screen (y down)
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
        float d = length(p - uWhisp);

        // How far the Whisp's light reaches into the dark.
        float reach = m * (0.06 + 0.45 * e);
        float light = pr * (0.3 + 0.7 * e) / (1.0 + pow(d / reach, 2.0) * 3.0);

        // Where this pixel is in the void (world points, y down).
        vec2 sp = vec2(p.x - uRes.x * 0.5, uRes.y * 0.5 - p.y);
        vec2 world = uView + sp;

        // Islands of rock hanging over the abyss; everything else is the drop.
        float shape = fbm(world * 0.0022 + 40.0) + 0.12 * fbm(world * 0.02);
        float island = smoothstep(0.5, 0.56, shape);
        // Near the edge the rock falls away into shadow, with a lit lip.
        float lip = smoothstep(0.5, 0.53, shape) * (1.0 - smoothstep(0.53, 0.6, shape));
        float rock = pow(fbm(world * 0.018), 1.6) * 1.5;
        float crack = pow(1.0 - abs(vnoise(world * 0.028 + 3.0) * 2.0 - 1.0), 10.0);
        float grit = vnoise(world * 0.4) * 0.6 + hash(world) * 0.4;
        float edgeShade = smoothstep(0.5, 0.7, shape);
        vec3 ground = vec3(0.3, 0.32, 0.37) * (rock * (1.0 - crack * 0.75) + grit * 0.18) * (0.35 + 0.65 * edgeShade)
                    + vec3(0.5, 0.6, 0.75) * lip * 0.35;

        // The abyss: specks drifting at three depths. Deeper ones scroll
        // slower and are fainter, so the drop feels bottomless.
        vec3 deep = vec3(0.0);
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float depth = 0.12 + fi * 0.22;              // how much this layer moves with the view
          vec2 lp = uView * depth + sp + fi * 731.0;
          lp += vec2(sin(uTime * 0.05 + fi), cos(uTime * 0.04 + fi * 2.0)) * 20.0;
          float cell = 34.0 + fi * 10.0;
          vec2 id = floor(lp / cell);
          vec2 o = vec2(hash(id, 11.0 + fi), hash(id, 23.0 + fi)) * cell;
          float on = step(0.86, hash(id, 37.0 + fi));
          float r = 0.6 + fi * 0.35;
          float twinkle = 0.6 + 0.4 * sin(uTime * (0.7 + hash(id, 5.0) * 1.5) + hash(id, 9.0) * 6.28);
          deep += vec3(0.55, 0.65, 0.85) * on * (1.0 - smoothstep(r * 0.3, r, length(lp - id * cell - o)))
                * (0.09 + 0.08 * fi) * twinkle;
        }
        // Faint mist far below, barely moving.
        float mist = fbm(uView * 0.05 * 0.004 + sp * 0.003 + uTime * 0.01);
        deep += vec3(0.08, 0.1, 0.16) * smoothstep(0.45, 0.8, mist) * 0.5;

        // Fog drifting over everything at the Whisp's own depth.
        vec2 fp = world * 0.005 + vec2(uTime * 0.015, -uTime * 0.01);
        float fog = smoothstep(0.35, 0.85, fbm(fp + fbm(fp * 1.7 + uTime * 0.03) * 1.5));

        // The light reveals rock and fog; the abyss stays mostly dark, its
        // specks just visible, a little more so near the Whisp.
        vec3 place = mix(deep * (0.55 + light * 1.5), ground * light, island)
                   + vec3(0.4, 0.5, 0.65) * fog * 0.55 * light * (0.4 + 0.6 * island);

        // The Whisp: a hot core and a halo that swells as it feeds. The halo's
        // colours separate slightly at the edge, like light through old glass.
        float breathe = 1.0 + 0.08 * sin(uTime * (2.0 + e * 3.0));
        float hr = (8.0 + 70.0 * e) * breathe;
        vec3 r3 = vec3(1.05, 1.0, 0.94) * hr;
        vec3 halo = exp(-d / (r3 * 0.35)) + exp(-d / r3) * 0.2;
        vec3 tint = mix(vec3(0.4, 0.75, 1.0), vec3(0.85, 0.95, 1.0), e);
        float coreR = (2.5 + 6.0 * e) * breathe;
        float core = 1.0 - smoothstep(coreR * 0.5, coreR, d);
        vec3 whisp = (tint * halo * (0.5 + 1.4 * e) + vec3(1.0) * core * 1.6) * pr;

        // Before the first touch: a faint ember in the dark, breathing.
        float c = length(p - uRes * 0.5);
        float ember = exp(-c / 5.0) * (0.5 + 0.5 * sin(uTime * 1.6)) * 0.35 * uHint;

        vec3 col = place + texture2D(tTrail, vUv).rgb * vec3(0.7, 0.85, 1.0) + whisp + vec3(0.6, 0.8, 1.0) * ember;
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
      uWhisp: { value: new THREE.Vector2() },
      uView: { value: new THREE.Vector2() },
      uEnergy: { value: 0 },
      uPresence: { value: 0 },
      uHint: { value: 0 },
      uTime: { value: 0 },
    },
  );

  const lastView = { x: Number.NaN, y: 0 };
  let time = 0;
  let hint = 0;
  /** Trails and light are drawn at half resolution: they're soft anyway. */
  const TRAIL_SCALE = 0.5;

  return {
    setSize(w: number, h: number) {
      const pr = renderer.getPixelRatio();
      const tw = Math.max(1, Math.round(w * pr * TRAIL_SCALE));
      const th = Math.max(1, Math.round(h * pr * TRAIL_SCALE));
      lightRT.setSize(tw, th);
      trailA.setSize(tw, th);
      trailB.setSize(tw, th);
      pointsMat.uniforms.uScale.value = pr * TRAIL_SCALE;
      feedback.material.uniforms.uTexel.value.set(1 / tw, 1 / th);
      final.material.uniforms.uRes.value.set(w, h);
    },

    render(whisp: Whisp, view: View, dt: number) {
      time += dt;
      hint += ((whisp.everTouched ? 0 : 1) - hint) * (1 - Math.exp(-dt * 2));

      // 1. Light layer.
      const w = whisp.threads;
      for (let i = 0; i < MAX_THREADS; i++) {
        const j = i * 6;
        positions[i * 3] = w[j];
        positions[i * 3 + 1] = w[j + 1];
        sizes[i] = w[j + 5] * (2 + whisp.energy * 2);
        alphas[i] = Math.max(0, w[j + 4]) * 0.9;
      }
      positions[MAX_THREADS * 3] = whisp.pos.x;
      positions[MAX_THREADS * 3 + 1] = whisp.pos.y;
      sizes[MAX_THREADS] = 10 + whisp.energy * 22;
      alphas[MAX_THREADS] = whisp.presence * (0.35 + whisp.energy * 0.6);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aAlpha.needsUpdate = true;

      // The light layer is drawn in world positions, through the view.
      camera.left = view.x - view.width / 2;
      camera.right = view.x + view.width / 2;
      camera.top = view.y - view.height / 2;
      camera.bottom = view.y + view.height / 2;
      camera.updateProjectionMatrix();

      renderer.setRenderTarget(lightRT);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(lightScene, camera);

      // 2. Trails (frame-rate independent fade).
      feedback.material.uniforms.tPrev.value = trailA.texture;
      feedback.material.uniforms.tLight.value = lightRT.texture;
      feedback.material.uniforms.uDecay.value = Math.pow(0.955, dt * 60);
      feedback.material.uniforms.uTime.value = time;
      if (Number.isNaN(lastView.x)) {
        lastView.x = view.x; // first frame: nothing to shift yet
        lastView.y = view.y;
      }
      feedback.material.uniforms.uShift.value.set((view.x - lastView.x) / view.width, -(view.y - lastView.y) / view.height);
      lastView.x = view.x;
      lastView.y = view.y;
      renderer.setRenderTarget(trailB);
      feedback.render(renderer);
      [trailA, trailB] = [trailB, trailA];

      // 3. Final image to the screen.
      const u = final.material.uniforms;
      u.tTrail.value = trailA.texture;
      u.uWhisp.value.set(whisp.pos.x - view.x + view.width / 2, view.height / 2 - (whisp.pos.y - view.y));
      u.uView.value.set(view.x, view.y);
      u.uEnergy.value = whisp.energy;
      u.uPresence.value = whisp.presence;
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
