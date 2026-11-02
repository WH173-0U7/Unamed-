import * as THREE from 'three';
import { createFullscreenShader, glslHash } from './fullscreen';

/**
 * The glass: one layer drawn on the GPU over everything (the game and every
 * menu), like the screen you're looking through. Whatever lands on it stays
 * until you wipe it off, and it is kept on the device between visits.
 *
 * - **Blood.** Each splatter is painted as a field of soft blobs (a main
 *   splash with a crown of spines, streams ending in beads, satellite drops
 *   with tails, fine mist, drips running down). A shader lights the surface
 *   where that field crosses a threshold, like a liquid with surface tension.
 *   Fresh blood is glossy and red where thin, almost black where thick. Over
 *   a couple of minutes it dries: matte, brown-maroon, darker at the rim,
 *   cracking where it's thick.
 * - **Wiping.** Drag a finger across the screen to wipe. It pushes wet blood
 *   along and lifts some of it, leaving a faint streaky smear; dried blood
 *   takes a couple more passes. The smear fades with more
 *   wiping, but your finger leaves greasy streaks.
 * - **Dirt and grime**: dust, specks and greasy haze that build up slowly
 *   and never quite come off.
 * - Also drawn here: the red border when you're hit or low on blood, and
 *   glitch tearing and static on impact.
 *
 * How it's stored: a GPU texture holds, per point, the blood thickness (R),
 * how much of that is still wet (G), the smear (B) and the grime (A).
 * New blood and dirt are painted on a 2D canvas first and added to it.
 */
export interface GlassOptions {
  /** Called the first time blood lands, if the player has never wiped. */
  onHint?: () => void;
}

const STORE_KEY = 'darcvoyd.glass';
const WIPED_KEY = 'darcvoyd.wiped';
/** Fresh blood dries over about this many seconds (time constant). */
const DRY_SECONDS = 70;

const noiseGlsl = /* glsl */ `
  float vnoise(vec2 p, float seed) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i, seed), hash(i + vec2(1.0, 0.0), seed), f.x), mix(hash(i + vec2(0.0, 1.0), seed), hash(i + vec2(1.0, 1.0), seed), f.x), f.y);
  }
`;

export function createGlass(opts: GlassOptions = {}) {
  const canvas = document.createElement('canvas');
  canvas.id = 'glass';
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false, stencil: false, depth: false });
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  const half = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
  const rtOpts = {
    type: half ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  };
  let rtA = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  let rtB = new THREE.WebGLRenderTarget(1, 1, rtOpts);

  // New blood and dirt, painted here then added on the GPU:
  // R = blood, G = wet blood, B = grime. Black = nothing.
  const pending = document.createElement('canvas');
  const pctx = pending.getContext('2d', { alpha: false })!;
  const pendingTex = new THREE.CanvasTexture(pending);
  pendingTex.minFilter = THREE.LinearFilter;
  pendingTex.magFilter = THREE.LinearFilter;
  pendingTex.generateMipmaps = false;

  // ---------- GPU passes ----------
  /** Adds what was painted, and lets wet blood dry. */
  const addPass = createFullscreenShader(
    /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tState;
      uniform sampler2D tPending;
      uniform float uUsePending;
      uniform float uDry;
      void main() {
        vec4 s = texture2D(tState, vUv);
        vec3 p = texture2D(tPending, vUv).rgb * uUsePending;
        s.r = min(s.r + p.r, 2.0);
        s.g = min((s.g + p.g) * uDry, s.r);
        s.a = min(s.a + p.b, 1.0);
        gl_FragColor = s;
      }
    `,
    { tState: { value: null }, tPending: { value: pendingTex }, uUsePending: { value: 1 }, uDry: { value: 1 } },
  );

  /** One stroke of a finger from A to B (screen points). */
  const wipePass = createFullscreenShader(
    /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tState;
      uniform vec2 uRes;
      uniform vec2 uA;
      uniform vec2 uB;
      uniform float uR;
      uniform float uSeed;
      ${glslHash}
      ${noiseGlsl}
      vec2 toUv(vec2 p) { return vec2(p.x / uRes.x, 1.0 - p.y / uRes.y); }
      void main() {
        vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
        vec4 s = texture2D(tState, vUv);
        vec2 ab = uB - uA;
        float L = max(length(ab), 0.001);
        vec2 dir = ab / L;
        float t = clamp(dot(p - uA, dir) / L, 0.0, 1.0);
        float d = length(p - (uA + ab * t));
        float w = 1.0 - smoothstep(uR * 0.55, uR, d);
        if (w <= 0.0) { gl_FragColor = s; return; }
        // Skin ridges and uneven pressure leave streaks along the stroke.
        float across = dot(p - uA, vec2(-dir.y, dir.x));
        float streak = 0.75 + 0.25 * vnoise(vec2(across * 0.32, 0.5), uSeed);
        streak *= 0.88 + 0.12 * vnoise(vec2(across * 1.7, 0.5), uSeed + 3.0);
        // Wet blood is pushed along with the finger.
        vec4 b = texture2D(tState, toUv(p - dir * min(L, uR * 0.55)));
        float wetB = clamp(b.g / max(b.r, 0.02), 0.0, 1.0);
        float drag = w * 0.3 * wetB;
        float r = mix(s.r, b.r, drag);
        float g = mix(s.g, b.g, drag);
        // Some is lifted off; dry blood hardly comes away.
        float wet = clamp(g / max(r, 0.02), 0.0, 1.0);
        float lift = w * streak * mix(0.5, 0.88, wet);
        float r2 = r * (1.0 - lift);
        float g2 = g * (1.0 - lift);
        // What came off spreads as a thin smear; the smear wipes away slowly.
        float gone = max(s.r - r2, 0.0);
        float smear = s.b * (1.0 - w * streak * 0.5) + gone * mix(0.1, 0.22, wet) * streak;
        // Dust is moved about; skin leaves a little grease, most at the edges.
        float edge = smoothstep(0.55, 0.95, d / uR);
        float grime = s.a * (1.0 - w * 0.1 * streak) + w * ((1.0 - streak) * 0.01 + edge * 0.012);
        gl_FragColor = vec4(r2, g2, min(smear, 0.9), min(grime, 1.0));
      }
    `,
    {
      tState: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uA: { value: new THREE.Vector2() },
      uB: { value: new THREE.Vector2() },
      uR: { value: 30 },
      uSeed: { value: 0 },
    },
  );

  /** Copies one texture into the state, scaling values (stretching to fit). */
  const copyPass = createFullscreenShader(
    /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tSrc;
      uniform vec4 uMul;
      void main() { gl_FragColor = texture2D(tSrc, vUv) * uMul; }
    `,
    { tSrc: { value: null }, uMul: { value: new THREE.Vector4(1, 1, 1, 1) } },
  );

  /** Draws the glass. */
  const showPass = createFullscreenShader(
    /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tState;
      uniform vec2 uTexel;
      uniform vec2 uRes;
      uniform float uTime;
      uniform float uHurt;
      uniform float uLow;
      uniform float uGlitch;
      ${glslHash}
      ${noiseGlsl}

      vec4 S(vec2 uv) { return texture2D(tState, uv); }

      // Distance to the nearest crack, for blood dried thick (cells of a
      // Voronoi pattern; cracks run along the borders between them).
      float crackDist(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float d1 = 8.0;
        float d2 = 8.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(float(x), float(y));
            vec2 o = vec2(hash(i + g, 41.0), hash(i + g, 42.0));
            float d = length(g + o - f);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
          }
        }
        return d2 - d1;
      }

      void main() {
        vec2 uv = vUv;
        float aspect = uRes.x / uRes.y;
        float frame = floor(uTime * 24.0);
        // Glitch: rows jump sideways for a moment.
        float band = floor(uv.y * 38.0);
        float tear = step(1.0 - uGlitch * 0.55, hash(vec2(band, 3.0), frame));
        uv.x += (hash(vec2(band, 7.0), frame) - 0.5) * 0.08 * tear * uGlitch;
        vec2 P = vec2(uv.x, 1.0 - uv.y) * uRes; // screen points

        vec4 s = S(uv);
        vec2 dx = vec2(uTexel.x, 0.0);
        vec2 dy = vec2(0.0, uTexel.y);
        float blotch = vnoise(P / 45.0, 7.0) * 0.6 + vnoise(P / 11.0, 8.0) * 0.4;

        // ---- Grime: a greasy haze and specks of dust and dirt.
        float gr = s.a;
        vec2 cell = floor(P / 2.5);
        float speck = step(1.0 - gr * 0.1, hash(cell, 31.0));
        float darkSpeck = step(0.5, hash(cell, 32.0));
        float haze = gr * (0.3 + 0.7 * blotch);
        float grimeA = clamp(haze * 0.32 + speck * (0.2 + 0.3 * hash(cell, 33.0)), 0.0, 0.75);
        vec3 grimeCol = mix(vec3(0.46, 0.43, 0.37), vec3(0.09, 0.07, 0.05), darkSpeck * speck);
        vec3 rgb = grimeCol * grimeA;
        float a = grimeA;

        // ---- Smear: a thin, streaky film of blood left by wiping.
        float sm = smoothstep(0.0, 0.5, s.b);
        float smA = sm * (0.42 + 0.22 * blotch);
        vec3 smCol = mix(vec3(0.5, 0.07, 0.045), vec3(0.24, 0.04, 0.03), sm);
        rgb = smCol * smA + rgb * (1.0 - smA);
        a = smA + a * (1.0 - smA);

        // ---- Blood: the surface where the field crosses a threshold.
        // Blood on glass is a thin film, not a jelly: it spreads out flat
        // with a slightly raised lip at the edge, so only the edges curve and
        // catch the light, and the colour comes from how thick the film is.
        const float THR = 0.3;
        // Real edges aren't perfectly smooth: a little fine roughness.
        float rough = (vnoise(P / 6.0, 62.0) - 0.5) * 0.035;
        float f = s.r + rough * smoothstep(0.15, 0.3, s.r) * (1.0 - smoothstep(0.3, 0.5, s.r));
        float fw = fwidth(f) * 0.9 + 0.002;
        float cover = smoothstep(THR - fw, THR + fw, f);
        float hgt = clamp((f - THR) / (1.0 - THR), 0.0, 1.0);
        // How thick the film is: rises quickly from the edge, then levels off.
        float film = smoothstep(0.0, 0.35, hgt) * 0.7 + hgt * 0.3;
        float wet = clamp(s.g / max(s.r, 0.02), 0.0, 1.0);
        float dry = 1.0 - smoothstep(0.06, 0.45, wet);
        float gx = (S(uv + dx * 1.5).r - S(uv - dx * 1.5).r) * 0.7 + (S(uv + dx * 3.0).r - S(uv - dx * 3.0).r) * 0.3;
        float gy = (S(uv + dy * 1.5).r - S(uv - dy * 1.5).r) * 0.7 + (S(uv + dy * 3.0).r - S(uv - dy * 3.0).r) * 0.3;
        // Only the edge zone is curved; the middle of a pool is flat.
        float edgeZone = 1.0 - smoothstep(0.04, 0.3, hgt);
        float bump = mix(4.0, 1.5, dry) * edgeZone;
        vec3 n = normalize(vec3(-gx * bump, -gy * bump, 1.0));

        // Wet: light passing through blood loses blue and green much faster
        // than red. Thin smears are a clear, bright red; a real pool is deep
        // crimson, close to black only where it's thickest.
        // How much blood is around this point (blurred): a small drop is thin
        // all the way across, a pool is thick. That's what sets the colour,
        // so a drop doesn't shade like a ball.
        float around = (S(uv + dx * 7.0).r + S(uv - dx * 7.0).r + S(uv + dy * 7.0).r + S(uv - dy * 7.0).r + s.r * 2.0) / 6.0;
        float thick = clamp((around - 0.2) / 0.75, 0.0, 1.0);
        float depth = 0.07 + (film * 0.3 + thick * 0.7) * (1.35 + blotch * 0.5);
        vec3 wetCol = vec3(0.78, 0.055, 0.045) * exp(-vec3(1.25, 3.4, 3.1) * depth);
        // The lip at the edge holds a little more blood: a faint darker line.
        float lip = cover * (1.0 - smoothstep(0.0, 0.05, hgt)) * smoothstep(0.0, 0.01, hgt);
        wetCol *= 1.0 - lip * 0.25;

        // Dry: brown-maroon, darker in a ring at the edge (blood dries from
        // the rim inward), and cracked where it was thick.
        vec3 dryCol = mix(vec3(0.46, 0.1, 0.06), vec3(0.2, 0.045, 0.03), smoothstep(0.0, 0.5, hgt));
        float ring = cover * (1.0 - smoothstep(0.0, 0.16, hgt));
        dryCol *= (1.0 - ring * 0.42) * (0.88 + 0.24 * blotch);
        // Fine flaking where it dried thick: a faint, irregular crack network.
        vec2 cp = P / 13.0 + vec2(vnoise(P / 20.0, 51.0), vnoise(P / 20.0, 52.0)) * 1.3;
        float crack = (1.0 - smoothstep(0.015, 0.05, crackDist(cp))) * smoothstep(0.35, 0.7, hgt);
        dryCol = mix(dryCol, vec3(0.45, 0.13, 0.09), crack * 0.28);

        vec3 col = mix(wetCol, dryCol, dry);
        // Thin film lets some of the screen through; thicker blood doesn't.
        float alpha = cover * mix(0.62, 0.97, smoothstep(0.0, 0.3, film));
        alpha = mix(alpha, cover * 0.95, dry) * (1.0 - crack * dry * 0.3);

        // Gloss: wet blood is glassy, but flat. A thin bright glint along the
        // edges that face the light, and a faint even sheen across the film.
        vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
        vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
        float nh = max(dot(n, H), 0.0);
        float glint = pow(nh, 160.0) * (1.0 - smoothstep(0.02, 0.12, hgt)) * smoothstep(0.005, 0.03, length(vec2(gx, gy)));
        float sheen = 0.03 * cover * (0.6 + 0.4 * vnoise(P / 160.0, 63.0));
        // A pool's surface isn't perfectly level: a soft, broad reflection
        // slides across the side facing the light.
        vec2 gb = vec2(S(uv + dx * 9.0).r - S(uv - dx * 9.0).r, S(uv + dy * 9.0).r - S(uv - dy * 9.0).r);
        vec3 nb = normalize(vec3(-gb * 2.2, 1.0));
        sheen += pow(max(dot(nb, H), 0.0), 40.0) * 0.22 * thick;
        float spec = (glint * 0.45 + sheen) * (1.0 - dry) + pow(nh, 12.0) * 0.03 * edgeZone * dry;

        rgb = col * alpha + rgb * (1.0 - alpha) + vec3(1.0, 0.95, 0.92) * spec * cover;
        a = alpha + a * (1.0 - alpha);

        // ---- The red border: a flash when hit, a heartbeat when blood is low.
        vec2 c = (vUv - 0.5) * vec2(aspect, 1.0);
        float edgeV = smoothstep(0.45, 1.0, length(c / vec2(max(aspect, 1.0) * 0.55, 0.62)));
        float beat = pow(0.5 + 0.5 * sin(uTime * (5.0 + uLow * 4.0)), 6.0);
        float red = edgeV * (uHurt * 0.75 + uLow * (0.35 + 0.35 * beat));
        rgb += vec3(0.45, 0.0, 0.02) * red * (1.0 - a);
        a += red * 0.9 * (1.0 - a);

        // ---- Static while glitching.
        float snow = hash(floor(vUv * uRes / 2.0), frame) * uGlitch * 0.22;
        float line = step(0.985 - uGlitch * 0.05, hash(vec2(floor(vUv.y * uRes.y / 2.0), 1.0), frame)) * uGlitch * 0.4;
        float st = (snow + line) * (1.0 - alpha);
        gl_FragColor = vec4(rgb + vec3(st), clamp(a + st, 0.0, 1.0));
      }
    `,
    {
      tState: { value: null },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uHurt: { value: 0 },
      uLow: { value: 0 },
      uGlitch: { value: 0 },
    },
  );
  showPass.material.transparent = true;

  /** Runs a pass from the current state into the other buffer, then swaps. */
  function step(pass: { material: THREE.ShaderMaterial; render(r: THREE.WebGLRenderer): void }) {
    pass.material.uniforms.tState.value = rtA.texture;
    renderer.setRenderTarget(rtB);
    pass.render(renderer);
    renderer.setRenderTarget(null);
    [rtA, rtB] = [rtB, rtA];
  }

  function copyInto(target: THREE.WebGLRenderTarget, src: THREE.Texture, mul: [number, number, number, number]) {
    copyPass.material.uniforms.tSrc.value = src;
    copyPass.material.uniforms.uMul.value.set(...mul);
    renderer.setRenderTarget(target);
    copyPass.render(renderer);
    renderer.setRenderTarget(null);
  }

  let w = 0;
  let lastPr = 0;
  let h = 0;
  /** Map resolution relative to the screen. */
  let k = 1;
  let time = 0;
  let hurt = 0;
  let glitch = 0;
  let low = 0;
  let pendingDirty = false;
  let redraw = true;
  /** Seconds since fresh blood last landed (it's drying while this is small). */
  let sinceFresh = 1e9;
  let dryClock = 0;
  let dustClock = 0;
  /** Changed since it was last stored on the device. */
  let unsaved = false;
  /** Only dried a bit since stored: kept when the app pauses or closes. */
  let driedUnsaved = false;
  let quiet = 0;
  let loaded = false;
  let hinted = false;
  const wipes: { ax: number; ay: number; bx: number; by: number; seed: number }[] = [];

  interface Drip {
    x: number;
    y: number;
    v: number;
    r: number;
    life: number;
    wob: number;
  }
  let drips: Drip[] = [];

  function clearPending() {
    pctx.globalCompositeOperation = 'source-over';
    pctx.fillStyle = '#000';
    pctx.fillRect(0, 0, pending.width, pending.height);
  }

  /**
   * A soft blob in the field: a gaussian bump of height `a` and radius `r`
   * (screen points), optionally stretched along `ang`. The visible drop is
   * where the field passes the threshold, about half the radius. `grime`
   * paints dirt instead of blood.
   */
  function stamp(x: number, y: number, r: number, a: number, stretch = 1, ang = 0, grime = false) {
    const R = Math.max(0.8, r * k);
    const c = grime ? '0,0,255' : '255,255,0';
    pctx.save();
    pctx.translate(x * k, y * k);
    if (stretch !== 1) {
      pctx.rotate(ang);
      pctx.scale(stretch, 1);
    }
    const g = pctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(${c},${a})`);
    g.addColorStop(0.25, `rgba(${c},${a * 0.84})`);
    g.addColorStop(0.5, `rgba(${c},${a * 0.5})`);
    g.addColorStop(0.75, `rgba(${c},${a * 0.19})`);
    g.addColorStop(1, `rgba(${c},0)`);
    pctx.fillStyle = g;
    pctx.beginPath();
    pctx.arc(0, 0, R, 0, Math.PI * 2);
    pctx.fill();
    pctx.restore();
  }

  function painted(fresh: boolean) {
    pendingDirty = true;
    unsaved = true;
    quiet = 0;
    if (fresh) sinceFresh = 0;
  }

  /** One splatter at (x, y): `size` is the main splash's radius, `dir` the way it was flying. */
  function splat(x: number, y: number, size: number, dir: number, heavy: boolean) {
    const rnd = Math.random;
    const g = (s = 1) => (rnd() + rnd() + rnd() - 1.5) * s; // rough gaussian
    const { cos, sin } = Math;
    pctx.globalCompositeOperation = 'lighter';

    // 1. The main splash, smeared in the direction of travel.
    stamp(x, y, size * 1.6, 0.62);
    const body = (heavy ? 12 : 8) + Math.floor(rnd() * 5);
    for (let i = 0; i < body; i++) {
      const along = g(size * 0.6) + size * 0.2;
      const across = g(size * 0.5);
      stamp(x + cos(dir) * along - sin(dir) * across, y + sin(dir) * along + cos(dir) * across, size * (0.4 + rnd() * 0.55), 0.24 + rnd() * 0.12);
    }
    // 2. A crown of short spines all round the rim, where the drop burst.
    const spines = 14 + Math.floor(rnd() * 14);
    for (let i = 0; i < spines; i++) {
      const a = rnd() * Math.PI * 2;
      // Longer on the side it was flying towards, and uneven.
      const reach = size * (0.8 + 0.3 * Math.max(0, cos(a - dir)) * rnd() + Math.pow(rnd(), 3) * 0.35);
      stamp(x + cos(a) * reach, y + sin(a) * reach, size * (0.05 + rnd() * 0.06), 0.42 + rnd() * 0.15, 1.3 + rnd() * 0.9, a);
    }
    // 3. Arms: streams thrown out, thinning, each ending in a bead (some broken off).
    const arms = (heavy ? 6 : 3) + Math.floor(rnd() * 4);
    for (let i = 0; i < arms; i++) {
      let a = dir + g(1.15);
      const len = size * (0.5 + Math.pow(rnd(), 1.6) * (heavy ? 2.0 : 1.3));
      const r0 = size * (0.18 + rnd() * 0.14);
      const r1 = size * (0.07 + rnd() * 0.05);
      let px = x + cos(a) * size * 0.7;
      let py = y + sin(a) * size * 0.7;
      const stepLen = Math.max(1.2, size * 0.07);
      const steps = Math.ceil(len / stepLen);
      const curl = g(0.012);
      const broken = rnd() < 0.35 ? 0.75 + rnd() * 0.15 : 2;
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        a += curl;
        px += cos(a) * stepLen;
        py += sin(a) * stepLen;
        if (t > broken && t < broken + 0.12) continue;
        stamp(px, py, r0 + (r1 - r0) * Math.pow(t, 0.7), 0.38);
      }
      stamp(px + cos(a) * r1, py + sin(a) * r1, size * (0.2 + rnd() * 0.18), 0.62, 1.15, a);
    }
    // 4. Satellite drops flung along the same line: smaller further out, and
    //    the faster ones stretched into teardrops, tail pointing the way they flew.
    const drops = (heavy ? 60 : 35) + Math.floor(rnd() * 30);
    for (let i = 0; i < drops; i++) {
      const a = dir + g(1.35);
      const dist = size * (1.6 + Math.pow(rnd(), 1.4) * (heavy ? 5 : 3.6));
      const r = size * (0.05 + 0.28 * Math.pow(rnd(), 2.4)) + 1.4;
      const px = x + cos(a) * dist;
      const py = y + sin(a) * dist;
      const speed = Math.min(1, dist / (size * 4));
      stamp(px, py, r, 0.6 + rnd() * 0.15, 1 + rnd() * 0.4 * speed, a);
      if (r > 3 && rnd() < 0.6) {
        const tl = r * (1.2 + speed * 1.8);
        stamp(px + cos(a) * tl * 0.6, py + sin(a) * tl * 0.6, r * 0.42, 0.48, 2.2, a);
        stamp(px + cos(a) * tl, py + sin(a) * tl, r * 0.22, 0.6);
      }
    }
    // 5. Mist.
    const mist = (heavy ? 160 : 90) + Math.floor(rnd() * 80);
    for (let i = 0; i < mist; i++) {
      const a = dir + g(1.6);
      const dist = size * (1 + Math.pow(rnd(), 1.3) * (heavy ? 5.5 : 4));
      stamp(x + cos(a) * dist, y + sin(a) * dist, 1.3 + rnd() * 2.2, 0.55 + rnd() * 0.2);
    }
    // 6. Grit from the street comes with it.
    for (let i = 0; i < 25; i++) {
      const a = rnd() * Math.PI * 2;
      const d = size * (0.5 + rnd() * 4);
      stamp(x + cos(a) * d, y + sin(a) * d, 2 + rnd() * 6, 0.12, 1, 0, true);
    }
    // 7. Drips running down from the bottom of the splash.
    const nd = heavy ? 2 + Math.floor(rnd() * 3) : 1 + (rnd() < 0.5 ? 1 : 0);
    for (let i = 0; i < nd; i++) {
      drips.push({ x: x + g(size * 0.9), y: y + size * (0.4 + rnd() * 0.5), v: 55 + rnd() * 90, r: size * (0.16 + rnd() * 0.1), life: 2 + rnd() * 4, wob: rnd() * 6 });
    }
    pctx.globalCompositeOperation = 'source-over';
    painted(true);
    maybeHint();
  }

  /** Dust settling: a few specks and faint blotches. */
  function dust(n: number, keep = true) {
    pctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      if (Math.random() < 0.15) stamp(x, y, 30 + Math.random() * 90, 0.05, 1 + Math.random(), Math.random() * 3, true);
      else stamp(x, y, 2 + Math.random() * 5, 0.1 + Math.random() * 0.2, 1, 0, true);
    }
    pctx.globalCompositeOperation = 'source-over';
    if (keep) painted(false);
    else pendingDirty = true;
  }

  /** A glass that's been around: dust, blotches and old finger streaks. */
  function seedGrime() {
    dust(260);
    pctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      // An old swipe: a curved band of grease streaks.
      let x = Math.random() * w;
      let y = Math.random() * h;
      let a = Math.random() * Math.PI * 2;
      const len = 120 + Math.random() * 260;
      for (let t = 0; t < len; t += 6) {
        a += (Math.random() - 0.5) * 0.08;
        x += Math.cos(a) * 6;
        y += Math.sin(a) * 6;
        for (let j = -3; j <= 3; j++) {
          const o = j * 7 + (Math.random() - 0.5) * 3;
          stamp(x - Math.sin(a) * o, y + Math.cos(a) * o, 5, 0.03 + Math.random() * 0.03, 2.5, a, true);
        }
      }
    }
    pctx.globalCompositeOperation = 'source-over';
  }

  function maybeHint() {
    if (hinted) return;
    hinted = true;
    try {
      if (localStorage.getItem(WIPED_KEY)) return;
    } catch {
      /* ignore */
    }
    window.setTimeout(() => opts.onHint?.(), 1600);
  }

  // ---------- Keeping it on the device ----------
  const PACK_MAX = 1000;
  const packRT = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, type: THREE.UnsignedByteType });

  /** Stores the glass on the device (PNG in local storage). */
  function persist() {
    if ((!unsaved && !driedUnsaved) || !w) return;
    unsaved = false;
    driedUnsaved = false;
    try {
      const s = Math.min(1, PACK_MAX / Math.max(rtA.width, rtA.height));
      const pw = Math.max(1, Math.round(rtA.width * s));
      const ph = Math.max(1, Math.round(rtA.height * s));
      packRT.setSize(pw, ph);
      copyInto(packRT, rtA.texture, [0.5, 0.5, 1, 1]);
      const px = new Uint8Array(pw * ph * 4);
      renderer.readRenderTargetPixels(packRT, 0, 0, pw, ph, px);
      // Opaque image, twice as tall: blood/wet/smear on top, grime below
      // (the browser would spoil values kept in the alpha channel).
      const c = document.createElement('canvas');
      c.width = pw;
      c.height = ph * 2;
      const x = c.getContext('2d')!;
      const img = x.createImageData(pw, ph * 2);
      const d = img.data;
      const n = pw * ph;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        d[o] = px[o];
        d[o + 1] = px[o + 1];
        d[o + 2] = px[o + 2];
        d[o + 3] = 255;
        const q = (n + i) * 4;
        d[q] = d[q + 1] = d[q + 2] = px[o + 3];
        d[q + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      const value = JSON.stringify({ w: pw, h: ph, png: c.toDataURL('image/png') });
      try {
        localStorage.setItem(STORE_KEY, value);
      } catch {
        // Storage full: the saved game matters more than the glass.
        localStorage.removeItem(STORE_KEY);
      }
    } catch {
      /* storage blocked: it just won't be kept */
    }
  }

  /** Loads the stored glass, or starts with a dirty one. */
  function load() {
    loaded = true;
    let stored: { w: number; h: number; png: string } | null = null;
    try {
      stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    } catch {
      stored = null;
    }
    if (!stored) {
      seedGrime();
      painted(false);
      return;
    }
    const im = new Image();
    im.onload = () => {
      const { w: pw, h: ph } = stored!;
      const c = document.createElement('canvas');
      c.width = pw;
      c.height = ph * 2;
      const x = c.getContext('2d', { willReadFrequently: true })!;
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, pw, ph * 2).data;
      const px = new Uint8Array(pw * ph * 4);
      const n = pw * ph;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        px[o] = d[o];
        px[o + 1] = d[o + 1];
        px[o + 2] = d[o + 2];
        px[o + 3] = d[(n + i) * 4];
      }
      const tex = new THREE.DataTexture(px, pw, ph, THREE.RGBAFormat, THREE.UnsignedByteType);
      tex.minFilter = tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      // Add on top of anything that landed while it was loading.
      copyInto(rtB, tex, [2, 2, 1, 1]);
      addPassFrom(rtB.texture);
      tex.dispose();
      sinceFresh = 0; // it may still be drying
      redraw = true;
    };
    im.onerror = () => {
      // Spoiled: start again with a dirty glass.
      seedGrime();
      painted(false);
    };
    im.src = stored.png;
  }

  /** state = state + another state texture. */
  const sumPass = createFullscreenShader(
    /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tState;
      uniform sampler2D tOther;
      void main() {
        vec4 s = texture2D(tState, vUv) + texture2D(tOther, vUv);
        gl_FragColor = vec4(min(s.r, 2.0), min(s.g, s.r), min(s.b, 0.9), min(s.a, 1.0));
      }
    `,
    { tState: { value: null }, tOther: { value: null } },
  );
  const spare = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  function addPassFrom(tex: THREE.Texture) {
    // `tex` lives in rtB, which step() writes into: move it aside first.
    spare.setSize(rtA.width, rtA.height);
    copyInto(spare, tex, [1, 1, 1, 1]);
    sumPass.material.uniforms.tOther.value = spare.texture;
    step(sumPass);
  }

  // ---------- Wiping with a finger ----------
  let ptr: { id: number; x: number; y: number; sx: number; sy: number; wiping: boolean; seed: number } | null = null;
  let swallowClickUntil = 0;
  addEventListener(
    'pointerdown',
    (e) => {
      // A new touch: whatever came before is over (a lost release can't
      // jam wiping), and a tap right after a wipe is a real tap.
      if (ptr && ptr.id !== e.pointerId && !e.isPrimary) return;
      swallowClickUntil = 0;
      // Dragging inside something that scrolls (the log, a list) scrolls it.
      const scroller = (e.target as Element | null)?.closest?.('.enc-log, .sheet-body, #shop, .enc-opts');
      if (scroller && scroller.scrollHeight > scroller.clientHeight + 2) {
        ptr = null;
        return;
      }
      ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, wiping: false, seed: Math.random() * 1000 };
    },
    { capture: true, passive: true },
  );
  addEventListener(
    'pointermove',
    (e) => {
      if (!ptr || e.pointerId !== ptr.id) return;
      if (e.pointerType === 'mouse' && !(e.buttons & 1)) return;
      const x = e.clientX;
      const y = e.clientY;
      if (!ptr.wiping) {
        if (Math.hypot(x - ptr.sx, y - ptr.sy) < 10) return;
        ptr.wiping = true;
        try {
          localStorage.setItem(WIPED_KEY, '1');
        } catch {
          /* ignore */
        }
        wipes.push({ ax: ptr.sx, ay: ptr.sy, bx: x, by: y, seed: ptr.seed });
      } else {
        wipes.push({ ax: ptr.x, ay: ptr.y, bx: x, by: y, seed: ptr.seed });
      }
      ptr.x = x;
      ptr.y = y;
    },
    { capture: true, passive: true },
  );
  const up = (e: PointerEvent) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    // A wipe that ends on a button shouldn't press it.
    if (ptr.wiping) swallowClickUntil = performance.now() + 400;
    ptr = null;
  };
  addEventListener('pointerup', up, { capture: true, passive: true });
  addEventListener('pointercancel', up, { capture: true, passive: true });
  addEventListener(
    'click',
    (e) => {
      if (performance.now() < swallowClickUntil) {
        swallowClickUntil = 0;
        e.stopPropagation();
        e.preventDefault();
      }
    },
    { capture: true },
  );

  return {
    setSize(width: number, height: number, pixelRatio: number) {
      const pr = Math.min(pixelRatio, 2);
      if (width === w && height === h && pr === lastPr) return;
      lastPr = pr;
      // Anything just painted goes onto the glass before it's resized.
      if (w && pendingDirty) {
        addPass.material.uniforms.uUsePending.value = 1;
        addPass.material.uniforms.uDry.value = 1;
        pendingTex.needsUpdate = true;
        step(addPass);
        pendingDirty = false;
      }
      renderer.setPixelRatio(pr);
      renderer.setSize(width, height);
      k = Math.min(1.5, 1200 / Math.max(width, height), Math.max(1, pixelRatio));
      const mw = Math.max(1, Math.round(width * k));
      const mh = Math.max(1, Math.round(height * k));
      // Keep what's on the glass, stretched to the new shape (only if the
      // map itself changes size: a sharper or blurrier screen doesn't).
      if (w && (mw !== rtA.width || mh !== rtA.height)) {
        spare.setSize(mw, mh);
        copyInto(spare, rtA.texture, [1, 1, 1, 1]);
        rtA.setSize(mw, mh);
        rtB.setSize(mw, mh);
        copyInto(rtA, spare.texture, [1, 1, 1, 1]);
      } else if (!w) {
        rtA.setSize(mw, mh);
        rtB.setSize(mw, mh);
        renderer.setRenderTarget(rtA);
        renderer.clear();
        renderer.setRenderTarget(null);
      }
      pending.width = mw;
      pending.height = mh;
      pendingTex.dispose();
      clearPending();
      pendingTex.needsUpdate = true;
      // Drips are in screen points: keep the ones still on screen.
      drips = drips.filter((d) => d.x < width && d.y < height);
      w = width;
      h = height;
      const su = showPass.material.uniforms;
      su.uTexel.value.set(1 / mw, 1 / mh);
      su.uRes.value.set(width, height);
      wipePass.material.uniforms.uRes.value.set(width, height);
      redraw = true;
      if (!loaded) load();
    },

    /**
     * A blow landed. `hurtYou`: you were hit (big splashes, red flash);
     * otherwise you hit them (their blood sprays across). `amount` is blood
     * lost (ml); `severe` a break, knockout or very heavy blow.
     */
    impact(hurtYou: boolean, amount: number, severe: boolean) {
      const power = Math.min(1, amount / 600) * (severe ? 1.3 : 1);
      glitch = Math.max(glitch, (hurtYou ? 0.55 : 0.3) + power * 0.45);
      if (hurtYou) hurt = Math.max(hurt, 0.5 + power * 0.5);
      const m = Math.min(w, h);
      const count = hurtYou ? 1 + (power > 0.45 ? 1 : 0) + (severe ? 1 : 0) : amount > 100 ? 1 : 0;
      for (let i = 0; i < count; i++) {
        // Mostly towards the edges and corners, flying inward.
        const ang = Math.random() * Math.PI * 2;
        const rr = 0.25 + Math.random() * 0.25;
        const x = w / 2 + Math.cos(ang) * w * rr;
        const y = h / 2 + Math.sin(ang) * h * rr;
        const dir = Math.atan2(h / 2 - y, w / 2 - x) + (Math.random() - 0.5) * 1.2;
        splat(x, y, m * (hurtYou ? 0.042 + power * 0.04 : 0.026 + power * 0.026), dir, hurtYou && power > 0.4);
      }
      if (!hurtYou && amount > 0) {
        // A light spray of their blood even on smaller hits.
        const x = w * (0.2 + Math.random() * 0.6);
        const y = h * (0.2 + Math.random() * 0.6);
        const dir = Math.random() * Math.PI * 2;
        pctx.globalCompositeOperation = 'lighter';
        const n = 40 + power * 110;
        for (let i = 0; i < n; i++) {
          const a = dir + (Math.random() - 0.5) * 2;
          const d = Math.pow(Math.random(), 1.3) * m * (0.12 + power * 0.22);
          stamp(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.3 + Math.pow(Math.random(), 2) * (3 + power * 7), 0.6, 1 + Math.random() * 0.4, a);
        }
        pctx.globalCompositeOperation = 'source-over';
        painted(true);
        maybeHint();
      }
    },

    /** How low your blood is (0 fine .. 1 about to pass out): a pulsing red border. */
    setLow(v: number) {
      low = v;
    },

    /** Stores the glass on the device now (when the app pauses or closes). */
    persist,

    update(dt: number) {
      time += dt;
      hurt = Math.max(0, hurt - dt * 1.4);
      glitch = Math.max(0, glitch - dt * 2.4);
      sinceFresh += dt;
      quiet += dt;
      if (!w) return;

      // Drips run down, slow, and gather into a bead where they stop.
      if (drips.length) {
        pctx.globalCompositeOperation = 'lighter';
        for (const d of drips) {
          const st = d.v * dt;
          const n = Math.max(1, Math.ceil(st / 1.5));
          for (let i = 0; i < n; i++) {
            d.y += st / n;
            stamp(d.x + Math.sin(d.y * 0.04 + d.wob) * 1.5, d.y, d.r, 0.16);
          }
          d.v *= Math.pow(0.62, dt);
          d.r *= Math.pow(0.93, dt);
          d.life -= dt;
          if (d.life <= 0 || d.v <= 6) stamp(d.x + Math.sin(d.y * 0.04 + d.wob) * 1.5, d.y + d.r * 0.3, d.r * 1.35, 0.55);
        }
        drips = drips.filter((d) => d.life > 0 && d.r > 1.5 && d.v > 6 && d.y < h);
        pctx.globalCompositeOperation = 'source-over';
        painted(true);
      }

      // Dust keeps settling, slowly.
      if ((dustClock += dt) > 25) {
        dustClock = 0;
        dust(3, false);
      }

      // Drying, a couple of times a second while there's wet blood.
      let dryF = 1;
      if (sinceFresh < DRY_SECONDS * 6 && (dryClock += dt) > 0.5) {
        dryF = Math.exp(-dryClock / DRY_SECONDS);
        dryClock = 0;
      }
      if (pendingDirty || dryF < 1) {
        pendingTex.needsUpdate = pendingDirty;
        addPass.material.uniforms.uUsePending.value = pendingDirty ? 1 : 0;
        addPass.material.uniforms.uDry.value = dryF;
        step(addPass);
        if (pendingDirty) clearPending();
        if (dryF < 1) driedUnsaved = true;
        pendingDirty = false;
        redraw = true;
      }

      // Finger strokes.
      if (wipes.length) {
        const u = wipePass.material.uniforms;
        for (const s of wipes) {
          u.uA.value.set(s.ax, s.ay);
          u.uB.value.set(s.bx, s.by);
          u.uR.value = Math.max(38, Math.min(w, h) * 0.13);
          u.uSeed.value = s.seed;
          step(wipePass);
        }
        wipes.length = 0;
        unsaved = true;
        quiet = 0;
        redraw = true;
      }

      // Kept on the device once things have settled.
      if (unsaved && quiet > 6 && !drips.length && !ptr) persist();

      const animating = hurt > 0 || glitch > 0 || low > 0;
      if (!redraw && !animating) return;
      redraw = false;
      const su = showPass.material.uniforms;
      su.tState.value = rtA.texture;
      su.uTime.value = time;
      su.uHurt.value = hurt;
      su.uLow.value = low;
      su.uGlitch.value = glitch;
      renderer.setRenderTarget(null);
      renderer.clear();
      showPass.render(renderer);
    },

    /** Current glitch strength (0..1), for shaking the rest of the screen. */
    get glitch() {
      return glitch;
    },

    /** For tests: wipe from one point to another. */
    debugWipe(ax: number, ay: number, bx: number, by: number) {
      wipes.push({ ax, ay, bx, by, seed: Math.random() * 1000 });
    },
  };
}

export type Glass = ReturnType<typeof createGlass>;
