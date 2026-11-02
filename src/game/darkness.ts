import * as THREE from 'three';
import { createFullscreenShader, glslHash } from '../fx/fullscreen';
import { MAX_THREADS, type View, type Whisp } from './whisp';
import { glslCave } from './cave';

/**
 * Draws the cave and the Whisp, all on the GPU:
 *
 * 1. Light layer: the Whisp's core and its threads, drawn as soft points.
 * 2. Trails: each frame the previous image is faded, nudged by a slow swirl
 *    and the new light added on top, leaving smoky trails behind movement.
 * 3. Cave map: the tunnel network's shape around the view, worked out at a
 *    quarter of the screen's resolution (it's smooth, so that's plenty).
 * 4. Final image:
 *    - far behind everything, the living depths: slow currents, a web of
 *      veins pulsing with a heartbeat, vast shadows drifting past, all
 *      breathing in and out;
 *    - the cave walls, dark and cold, their wet edges lit only where the
 *      Whisp's light reaches them, with soft shadows cast by the rock;
 *    - cold mist in the tunnels; the Whisp's halo; trails; grain; vignette.
 *
 * Everything is placed in world positions, so the cave scrolls past as the
 * view follows the Whisp; the depths scroll slower, giving a sense of scale.
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

  // ---------- 3. Cave map ----------
  // Distance to open space for a patch of world a little larger than the
  // screen (so shadows can reach in from off-screen).
  const CAVE_SCALE = 0.25; // texels per world point
  const MARGIN = 160; // world points beyond each screen edge
  const caveRT = new THREE.WebGLRenderTarget(1, 1, targetOpts);
  const caveSize = new THREE.Vector2(1, 1);
  const caveOrigin = new THREE.Vector2(Number.NaN, 0);
  const caveMap = createFullscreenShader(
    /* glsl */ `
      uniform vec2 uOrigin;
      uniform vec2 uSize;
      uniform float uEncoded;
      varying vec2 vUv;
      ${glslHash}
      ${glslCave}
      void main() {
        vec2 world = uOrigin + vec2(vUv.x, 1.0 - vUv.y) * uSize;
        float d = caveBase(world);
        gl_FragColor = vec4(uEncoded > 0.5 ? clamp(d / 512.0 + 0.5, 0.0, 1.0) : d, 0.0, 0.0, 1.0);
      }
    `,
    {
      uOrigin: { value: caveOrigin },
      uSize: { value: caveSize },
      uEncoded: { value: floatTargets ? 0 : 1 },
    },
  );

  // ---------- 4. Final image ----------
  const final = createFullscreenShader(
    /* glsl */ `
      uniform sampler2D tTrail;
      uniform sampler2D tCave;
      uniform vec2 uCaveOrigin;
      uniform vec2 uCaveSize;
      uniform float uEncoded;
      uniform vec2 uRes;      // screen size in points
      uniform vec2 uView;     // world position at the centre of the screen (y down)
      uniform vec2 uWhispW;   // the Whisp in the world
      uniform float uEnergy;
      uniform float uPresence;
      uniform float uHint;
      uniform float uTime;
      uniform float uWorldTime;
      varying vec2 vUv;
      ${glslHash}
      ${glslCave}

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

      float caveAt(vec2 w) {
        vec2 uv = vec2((w.x - uCaveOrigin.x) / uCaveSize.x, 1.0 - (w.y - uCaveOrigin.y) / uCaveSize.y);
        float v = texture2D(tCave, uv).r;
        return uEncoded > 0.5 ? (v - 0.5) * 512.0 : v;
      }

      // Soft shadow: how much of the Whisp's light reaches this point
      // without being blocked by rock (marches through the cave map).
      float shadow(vec2 from, vec2 to) {
        vec2 dir = to - from;
        float len = length(dir);
        dir /= max(len, 0.001);
        float s = 1.0;
        float t = 3.0;
        for (int i = 0; i < 18; i++) {
          if (t >= len - 8.0) break;
          float free = -caveAt(from + dir * t);
          s = min(s, clamp(6.0 * free / t, 0.0, 1.0));
          if (s < 0.02) break;
          t += max(free, 5.0);
        }
        return s;
      }

      // The living depths behind the cave, moving on their own.
      vec3 depths(vec2 sp, float t) {
        float breath = 1.0 + 0.045 * sin(t * 0.42);
        vec2 b = (uView * 0.18 + sp) * breath;
        vec2 flow = vec2(fbm(b * 0.0012 + vec2(t * 0.02, 0.0)), fbm(b * 0.0012 + vec2(5.2, t * 0.017)));
        float cur = fbm(b * 0.002 + flow * 2.5 + t * 0.01);
        vec3 col = vec3(0.03, 0.065, 0.09) * smoothstep(0.25, 0.85, cur);

        // Veins far below, carrying a slow heartbeat outwards.
        vec2 vb = b * 0.0035 + flow * 0.6;
        float v1 = 1.0 - abs(vnoise(vb) * 2.0 - 1.0);
        float v2 = 1.0 - abs(vnoise(vb * 2.1 + 7.0) * 2.0 - 1.0);
        float vein = pow(v1, 14.0) + pow(v2, 18.0) * 0.6;
        float beat = pow(0.5 + 0.5 * sin(t * 1.15 - length(b) * 0.0015 - cur * 4.0), 6.0);
        col += vec3(0.16, 0.3, 0.48) * vein * (0.3 + 1.1 * beat);

        // Specks suspended in it, drifting on currents of their own.
        for (int i = 0; i < 2; i++) {
          float fi = float(i);
          vec2 lp = uView * (0.3 + 0.25 * fi) + sp + fi * 731.0 + flow * 60.0 + vec2(t * 6.0, t * 2.5) * (1.0 + fi);
          float cell = 38.0 + 12.0 * fi;
          vec2 id = floor(lp / cell);
          vec2 o = vec2(hash(id, 11.0 + fi), hash(id, 23.0 + fi)) * cell;
          float on = step(0.86, hash(id, 37.0 + fi));
          float r = 0.7 + 0.4 * fi;
          col += vec3(0.4, 0.55, 0.75) * on * (1.0 - smoothstep(r * 0.3, r, length(lp - id * cell - o))) * (0.07 + 0.06 * fi);
        }

        // Vast shapes passing between us and the deep, darkening it.
        float shade = smoothstep(0.3, 0.7, fbm(b * 0.0005 + vec2(t * 0.006, -t * 0.004)));
        return col * (0.35 + 0.65 * shade);
      }

      void main() {
        vec2 p = vUv * uRes;
        float m = min(uRes.x, uRes.y);
        float e = uEnergy;
        float pr = uPresence;

        // Where this pixel is in the world (y down), and where the Whisp is.
        vec2 sp = vec2(p.x - uRes.x * 0.5, uRes.y * 0.5 - p.y);
        vec2 world = uView + sp;
        vec2 toW = uWhispW - world;
        float d = length(toW);

        // Is this open cave or rock? (smooth map + fine edges + breathing)
        float cave = caveAt(world) + caveDetail(world, uWorldTime);
        float open = 1.0 - smoothstep(-1.5, 1.5, cave);

        // The Whisp's light, falling off with distance and blocked by rock.
        float reach = m * (0.08 + 0.5 * e);
        float light = pr * (0.3 + 0.7 * e) / (1.0 + pow(d / reach, 2.0) * 3.0);
        float lit = 0.0;
        vec3 rockCol = vec3(0.0);
        if (light > 0.004) {
          vec2 dir = toW / max(d, 0.001);
          // Rock is lit only at its surface: start the shadow ray just outside it.
          vec2 from = cave > 0.0 ? world + dir * (cave + 2.0) : world;
          lit = light * shadow(from, uWhispW);

          // Wet, fibrous wall surface near the edge, facing the light.
          float e1 = 2.0;
          vec2 grad = vec2(caveAt(world + vec2(e1, 0.0)) - caveAt(world - vec2(e1, 0.0)),
                           caveAt(world + vec2(0.0, e1)) - caveAt(world - vec2(0.0, e1)));
          vec2 n = grad / max(length(grad), 0.0001); // points into the rock
          float facing = clamp(dot(-n, dir), 0.0, 1.0);
          float rim = (1.0 - smoothstep(0.0, 34.0, cave)) * step(0.0, cave);
          vec2 tangent = vec2(-n.y, n.x);
          float fibres = 0.6 + 0.4 * sin(dot(world, tangent) * 0.18 + vnoise(world * 0.03) * 6.0);
          float glint = step(0.985, hash(floor(world / 2.0))) * pow(facing, 3.0);
          rockCol = vec3(0.5, 0.6, 0.72) * pow(rim, 1.5) * (0.3 + 0.9 * facing) * fibres * lit
                  + vec3(0.8, 0.9, 1.0) * glint * rim * lit * 1.5;
        }

        // Cold mist hanging in the tunnels, drifting.
        vec2 fp = world * 0.005 + vec2(uTime * 0.012, -uTime * 0.008);
        float mist = smoothstep(0.42, 0.9, fbm(fp + fbm(fp * 1.7 + uTime * 0.03) * 1.5));
        vec3 mistCol = vec3(0.35, 0.45, 0.58) * (mist * 0.55 + 0.08) * (0.03 + lit * 0.75);

        // The depths show through the open tunnels, and faintly through the walls.
        vec3 deep = depths(sp, uTime);
        vec3 col = mix(deep * 0.15, deep * (1.0 + lit * 2.5) + mistCol, open) + rockCol * (1.0 - open);

        // The Whisp: a hot core and a halo that swells as it feeds. The halo's
        // colours separate slightly at the edge, like light through old glass.
        float breathe = 1.0 + 0.08 * sin(uTime * (2.0 + e * 3.0));
        float hr = (8.0 + 70.0 * e) * breathe;
        vec3 r3 = vec3(1.05, 1.0, 0.94) * hr;
        vec3 halo = (exp(-d / (r3 * 0.35)) + exp(-d / r3) * 0.2) * mix(1.0, 0.35, 1.0 - open);
        vec3 tint = mix(vec3(0.4, 0.75, 1.0), vec3(0.85, 0.95, 1.0), e);
        float coreR = (2.5 + 6.0 * e) * breathe;
        float core = 1.0 - smoothstep(coreR * 0.5, coreR, d);
        col += (tint * halo * (0.5 + 1.4 * e) + vec3(1.0) * core * 1.6) * pr;

        // Before the first touch: a faint ember in the dark, breathing.
        float c = length(p - uRes * 0.5);
        col += vec3(0.6, 0.8, 1.0) * exp(-c / 5.0) * (0.5 + 0.5 * sin(uTime * 1.6)) * 0.35 * uHint;

        col += texture2D(tTrail, vUv).rgb * vec3(0.7, 0.85, 1.0);
        col = 1.0 - exp(-col * 1.4); // soft highlights

        // Grain and a heavy vignette: the dark closes in at the edges.
        float frame = floor(uTime * 24.0);
        col += (hash(floor(p), frame) - 0.5) * 0.03;
        vec2 v = vUv - 0.5;
        v.x *= uRes.x / uRes.y;
        col *= 1.0 - smoothstep(0.3, 1.0, length(v)) * 0.8;
        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }
    `,
    {
      tTrail: { value: null },
      tCave: { value: caveRT.texture },
      uCaveOrigin: { value: caveOrigin },
      uCaveSize: { value: caveSize },
      uEncoded: { value: floatTargets ? 0 : 1 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uView: { value: new THREE.Vector2() },
      uWhispW: { value: new THREE.Vector2() },
      uEnergy: { value: 0 },
      uPresence: { value: 0 },
      uHint: { value: 0 },
      uTime: { value: 0 },
      uWorldTime: { value: 0 },
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
      caveSize.set(w + MARGIN * 2, h + MARGIN * 2);
      caveRT.setSize(Math.ceil(caveSize.x * CAVE_SCALE), Math.ceil(caveSize.y * CAVE_SCALE));
      caveOrigin.x = Number.NaN; // force a redraw of the cave map
    },

    render(whisp: Whisp, view: View, dt: number, worldTime: number) {
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

      // 3. Cave map, redrawn only when the view has moved. Its corner snaps to
      // the map's texel grid so the walls don't shimmer as it scrolls.
      const step = 1 / CAVE_SCALE;
      const ox = Math.floor((view.x - view.width / 2 - MARGIN) / step) * step;
      const oy = Math.floor((view.y - view.height / 2 - MARGIN) / step) * step;
      if (ox !== caveOrigin.x || oy !== caveOrigin.y) {
        caveOrigin.set(ox, oy);
        renderer.setRenderTarget(caveRT);
        caveMap.render(renderer);
      }

      // 4. Final image to the screen.
      const u = final.material.uniforms;
      u.tTrail.value = trailA.texture;
      u.uWhispW.value.set(whisp.pos.x, whisp.pos.y);
      u.uView.value.set(view.x, view.y);
      u.uWorldTime.value = worldTime;
      u.uEnergy.value = whisp.energy;
      u.uPresence.value = whisp.presence;
      u.uHint.value = hint;
      u.uTime.value = time;
      renderer.setRenderTarget(null);
      final.render(renderer);
    },

    dispose() {
      lightRT.dispose();
      caveRT.dispose();
      trailA.dispose();
      trailB.dispose();
      geometry.dispose();
      pointsMat.dispose();
    },
  };
}
