import * as THREE from 'three';
import type { Spill } from '../game/encounter';
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
  // The red edge (hit, or low on blood) is its own cheap layer, so the blood
  // doesn't have to be redrawn every frame while it pulses.
  const edge = document.createElement('div');
  edge.id = 'hurt-edge';
  document.body.appendChild(edge);
  let edgeShown = '';
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
      uniform float uPower;
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
        float w = 1.0 - smoothstep(uR * 0.4, uR, d);
        if (w <= 0.0) { gl_FragColor = s; return; }
        // Skin ridges and uneven pressure leave streaks along the stroke.
        float across = dot(p - uA, vec2(-dir.y, dir.x));
        float streak = 0.75 + 0.25 * vnoise(vec2(across * 0.32, 0.5), uSeed);
        streak *= 0.88 + 0.12 * vnoise(vec2(across * 1.7, 0.5), uSeed + 3.0);
        // Wet blood is pushed along with the finger.
        vec4 b = texture2D(tState, toUv(p - dir * min(L, uR * 0.55)));
        float wetB = clamp(b.g / max(b.r, 0.02), 0.0, 1.0);
        w *= uPower;
        float drag = w * 0.3 * wetB;
        float r = mix(s.r, b.r, drag);
        float g = mix(s.g, b.g, drag);
        // Some is lifted off; dry blood hardly comes away.
        float wet = clamp(g / max(r, 0.02), 0.0, 1.0);
        float lift = w * streak * mix(0.62, 0.9, wet);
        float r2 = r * (1.0 - lift);
        float g2 = g * (1.0 - lift);
        // What came off spreads as a thin smear; the smear wipes away slowly.
        float gone = max(s.r - r2, 0.0);
        float smear = s.b * (1.0 - w * streak * 0.65) + gone * mix(0.08, 0.18, wet) * streak;
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
      uPower: { value: 1 },
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
  /** Strokes to apply: a finger (full strength), or a running raindrop (`r`, `p`). */
  const wipes: { ax: number; ay: number; bx: number; by: number; seed: number; r?: number; p?: number }[] = [];

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
  // Each stamp is a soft round blob; drawn once per kind and copied (a
  // gradient made for every one of hundreds of drops was slow).
  const blobOf = (rgb: string) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(0.25, `rgba(${rgb},0.84)`);
    g.addColorStop(0.5, `rgba(${rgb},0.5)`);
    g.addColorStop(0.75, `rgba(${rgb},0.19)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return c;
  };
  const BLOOD_BLOB = blobOf('255,255,0');
  const GRIME_BLOB = blobOf('0,0,255');
  function stamp(x: number, y: number, r: number, a: number, stretch = 1, ang = 0, grime = false) {
    const R = Math.max(0.8, r * k);
    pctx.save();
    pctx.translate(x * k, y * k);
    if (stretch !== 1) {
      pctx.rotate(ang);
      pctx.scale(stretch, 1);
    }
    pctx.globalAlpha = Math.min(1, a);
    pctx.drawImage(grime ? GRIME_BLOB : BLOOD_BLOB, -R, -R, R * 2, R * 2);
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
    const spines = rnd() < 0.55 ? 14 + Math.floor(rnd() * 14) : 4 + Math.floor(rnd() * 5);
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

  /**
   * Impact spatter: a blow to a bleeding face flings a fan of fine droplets,
   * no pool. Round up close, stretched into teardrops further out, all
   * pointing the way they flew. (x, y) is where it came from (often just off
   * the edge of the screen).
   */
  function spatter(x: number, y: number, reach: number, dir: number, dense: number) {
    const rnd = Math.random;
    const { cos, sin } = Math;
    pctx.globalCompositeOperation = 'lighter';
    const n = Math.round(70 + dense * 160);
    for (let i = 0; i < n; i++) {
      const a = dir + (rnd() + rnd() - 1) * 0.75;
      const t = Math.pow(rnd(), 0.8);
      const d = reach * (0.15 + t * 0.95);
      // Most drops are tiny; a few are big. Smaller ones fly further.
      const r = 1.2 + Math.pow(rnd(), 2.6) * (4 + dense * 5) * (1.1 - t * 0.5);
      const px = x + cos(a) * d;
      const py = y + sin(a) * d;
      // Close in they hit square and stay round; further out they skid.
      const stretch = 1 + t * t * (0.5 + rnd() * 1.4);
      stamp(px, py, r, 0.7 + rnd() * 0.2, stretch, a);
      if (r > 2.6 && rnd() < 0.55) {
        // A tail, and maybe a little satellite beyond it.
        stamp(px + cos(a) * r * stretch * 0.9, py + sin(a) * r * stretch * 0.9, r * 0.38, 0.5, 2.4, a);
        if (rnd() < 0.4) stamp(px + cos(a) * r * stretch * 2.1, py + sin(a) * r * stretch * 2.1, r * 0.25, 0.6);
      }
    }
    // A haze of the finest droplets, thickest near the source.
    for (let i = 0; i < n * 1.4; i++) {
      const a = dir + (rnd() + rnd() - 1) * 1;
      const d = reach * Math.pow(rnd(), 1.4) * 0.9;
      stamp(x + cos(a) * d, y + sin(a) * d, 1 + rnd() * 0.8, 0.6 + rnd() * 0.25);
    }
    // A couple of the bigger drops near the source run.
    if (dense > 0.5)
      for (let i = 0; i < 1 + Math.floor(rnd() * 2); i++) {
        const a = dir + (rnd() - 0.5) * 0.8;
        const d = reach * (0.2 + rnd() * 0.3);
        drips.push({ x: x + cos(a) * d, y: y + sin(a) * d, v: 40 + rnd() * 60, r: 2.5 + rnd() * 2.5, life: 1.5 + rnd() * 2.5, wob: rnd() * 6 });
      }
    pctx.globalCompositeOperation = 'source-over';
    painted(true);
    maybeHint();
  }

  /**
   * Cast-off from a blade: a line of drops thrown off along the arc of the
   * swing, getting smaller towards the end, each stretched along the line.
   */
  function castOff(x: number, y: number, len: number, dir: number, heavy: number) {
    const rnd = Math.random;
    const { cos, sin } = Math;
    pctx.globalCompositeOperation = 'lighter';
    const bend = (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.7);
    const steps = Math.round(len / 9);
    let a = dir;
    let px = x;
    let py = y;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      a = dir + bend * t;
      px += cos(a) * 9;
      py += sin(a) * 9;
      if (rnd() < 0.25) continue; // gaps in the line
      const r = (2 + heavy * 4) * (1 - t * 0.7) * (0.6 + rnd() * 0.7);
      const off = (rnd() - 0.5) * 6;
      const qx = px - sin(a) * off;
      const qy = py + cos(a) * off;
      stamp(qx, qy, r, 0.66, 1.6 + rnd() * 1.6, a);
      if (rnd() < 0.5) stamp(qx + cos(a) * r * 2.2, qy + sin(a) * r * 2.2, r * 0.3, 0.6);
    }
    // Where the swing started, a heavier smear, and a run or two from it.
    stamp(x, y, 5 + heavy * 8, 0.55, 2.2, dir);
    for (let i = 0; i < 1 + Math.round(heavy * 2); i++) drips.push({ x: x + (rnd() - 0.5) * 10, y, v: 50 + rnd() * 70, r: 3 + heavy * 3, life: 2 + rnd() * 3, wob: rnd() * 6 });
    pctx.globalCompositeOperation = 'source-over';
    painted(true);
    maybeHint();
  }

  /**
   * Coughed up: a fine, frothy mist from low in front, thin and pinkish
   * (lots of tiny drops and some bubbles' worth of thin film).
   */
  function coughMist(x: number, y: number, reach: number, strength: number) {
    const rnd = Math.random;
    pctx.globalCompositeOperation = 'lighter';
    const n = Math.round(180 + strength * 260);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rnd() + rnd() - 1) * 1.1;
      const d = reach * Math.pow(rnd(), 0.7);
      const r = 1 + Math.pow(rnd(), 3.5) * 3.6;
      stamp(x + Math.cos(a) * d * 1.3, y + Math.sin(a) * d, r, 0.55 + rnd() * 0.3);
    }
    // Froth: a few faint, thin blotches.
    for (let i = 0; i < 6 + strength * 6; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 1.6;
      const d = reach * rnd() * 0.6;
      stamp(x + Math.cos(a) * d, y + Math.sin(a) * d, 6 + rnd() * 12, 0.14 + rnd() * 0.08);
    }
    pctx.globalCompositeOperation = 'source-over';
    painted(true);
    maybeHint();
  }

  /** A few heavy drops that land and run (an open break, a split lip). */
  function dropsOf(x: number, y: number, n: number) {
    const rnd = Math.random;
    pctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const px = x + (rnd() - 0.5) * 120;
      const py = y + (rnd() - 0.5) * 90;
      const r = 5 + rnd() * 6;
      stamp(px, py, r * 1.5, 0.62);
      stamp(px + (rnd() - 0.5) * r, py + (rnd() - 0.5) * r, r, 0.4);
      // A ring of tiny spines where it hit.
      for (let j = 0; j < 8; j++) {
        const a = rnd() * Math.PI * 2;
        stamp(px + Math.cos(a) * r * 1.5, py + Math.sin(a) * r * 1.5, r * 0.18, 0.5, 1.8, a);
      }
      if (rnd() < 0.6) drips.push({ x: px, y: py + r, v: 35 + rnd() * 50, r: r * 0.5, life: 1.5 + rnd() * 3, wob: rnd() * 6 });
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
  // (The blood is soft: half resolution keeps the save quick and small.)
  const PACK_MAX = 400;
  const packRT = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, type: THREE.UnsignedByteType });

  /** Stores the glass on the device (PNG in local storage). */
  /** Stores the glass. Off the main thread where it can be (`sync` when the page is going away). */
  function persist(sync = false) {
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
      const store = (png: string) => {
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify({ w: pw, h: ph, png }));
        } catch {
          // Storage full: the saved game matters more than the glass.
          localStorage.removeItem(STORE_KEY);
        }
      };
      // Encoding the picture is the slow part: let the browser do it in the background.
      if (sync || !c.toBlob) store(c.toDataURL('image/png'));
      else
        c.toBlob((blob) => {
          if (!blob) return;
          const r = new FileReader();
          r.onload = () => typeof r.result === 'string' && store(r.result);
          r.readAsDataURL(blob);
        }, 'image/png');
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
  // Every finger on the glass wipes, wherever it moves: over buttons, lists,
  // anything. Touches are followed with touch events (they keep coming even
  // while a list scrolls under the finger), the mouse with pointer events.
  type Finger = { x: number; y: number; sx: number; sy: number; wiping: boolean; seed: number };
  const fingers = new Map<number, Finger>();
  let swallowClickUntil = 0;
  const fingerDown = (id: number, x: number, y: number) => {
    swallowClickUntil = 0;
    fingers.set(id, { x, y, sx: x, sy: y, wiping: false, seed: Math.random() * 1000 });
  };
  const fingerMove = (id: number, x: number, y: number) => {
    const f = fingers.get(id);
    if (!f) return;
    if (!f.wiping) {
      // A few pixels of movement and it's a wipe, not a tap.
      if (Math.hypot(x - f.sx, y - f.sy) < 6) return;
      f.wiping = true;
      try {
        localStorage.setItem(WIPED_KEY, '1');
      } catch {
        /* ignore */
      }
      wipes.push({ ax: f.sx, ay: f.sy, bx: x, by: y, seed: f.seed });
    } else {
      // Long jumps (a fast swipe) are split so the stroke stays solid.
      const d = Math.hypot(x - f.x, y - f.y);
      if (d < 1.5) return;
      wipes.push({ ax: f.x, ay: f.y, bx: x, by: y, seed: f.seed });
    }
    f.x = x;
    f.y = y;
  };
  const fingerUp = (id: number) => {
    const f = fingers.get(id);
    if (!f) return;
    // A wipe that ends on a button shouldn't press it.
    if (f.wiping && Math.hypot(f.x - f.sx, f.y - f.sy) > 24) swallowClickUntil = performance.now() + 350;
    fingers.delete(id);
  };
  const opt = { capture: true, passive: true } as const;
  addEventListener('touchstart', (e) => { for (const t of e.changedTouches) fingerDown(t.identifier, t.clientX, t.clientY); }, opt);
  addEventListener('touchmove', (e) => { for (const t of e.changedTouches) fingerMove(t.identifier, t.clientX, t.clientY); }, opt);
  const touchEnd = (e: TouchEvent) => { for (const t of e.changedTouches) fingerUp(t.identifier); };
  addEventListener('touchend', touchEnd, opt);
  addEventListener('touchcancel', touchEnd, opt);
  const MOUSE = -1;
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0) fingerDown(MOUSE, e.clientX, e.clientY); }, opt);
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && e.buttons & 1) fingerMove(MOUSE, e.clientX, e.clientY); }, opt);
  addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') fingerUp(MOUSE); }, opt);
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
     * lost (ml); `severe` a break, knockout or very heavy blow; `spill` what
     * blood it throws (none for a punch to the gut).
     */
    impact(hurtYou: boolean, amount: number, severe: boolean, spill: Spill = 'splash') {
      const power = Math.min(1, amount / 600) * (severe ? 1.3 : 1);
      glitch = Math.max(glitch, (hurtYou ? 0.45 : 0.2) + power * 0.45);
      if (hurtYou && amount > 0) hurt = Math.max(hurt, 0.4 + power * 0.5);
      const m = Math.min(w, h);
      const rnd = Math.random;
      /** A point near the edge, and the direction into the screen from it. */
      const fromEdge = (inset: number) => {
        const ang = rnd() * Math.PI * 2;
        const x = w / 2 + Math.cos(ang) * w * inset;
        const y = h / 2 + Math.sin(ang) * h * inset;
        return { x, y, dir: Math.atan2(h / 2 - y, w / 2 - x) + (rnd() - 0.5) * 0.9 };
      };
      // Your own blood lands thick and close; theirs comes from further off.
      const near = hurtYou ? 1 : 0.6;
      switch (spill) {
        case 'none':
          return;
        case 'drip': {
          const p = fromEdge(0.3);
          dropsOf(p.x, p.y, Math.round((2 + rnd() * 2) * (hurtYou ? 1.4 : 1)));
          return;
        }
        case 'spatter': {
          const p = fromEdge(0.55 + rnd() * 0.15);
          spatter(p.x, p.y, m * (0.35 + power * 0.4) * near, p.dir, (0.3 + power * 0.7) * near);
          return;
        }
        case 'cough':
          coughMist(w * (0.35 + rnd() * 0.3), h * (0.85 + rnd() * 0.1), m * (0.25 + rnd() * 0.15), hurtYou ? 1 : 0.4);
          return;
        case 'spray': {
          const p = fromEdge(0.45);
          castOff(p.x, p.y, m * (0.5 + power * 0.6), p.dir, (0.3 + power * 0.7) * near);
          if (power > 0.5) spatter(p.x, p.y, m * 0.3, p.dir, 0.5 * near);
          return;
        }
        case 'splash': {
          const count = hurtYou ? 1 + (power > 0.55 ? 1 : 0) : 1;
          for (let i = 0; i < count; i++) {
            const p = fromEdge(0.25 + rnd() * 0.25);
            splat(p.x, p.y, m * (hurtYou ? 0.036 + power * 0.04 : 0.022 + power * 0.024), p.dir, hurtYou && power > 0.4);
          }
          return;
        }
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
          // A stamp every few pixels is enough for a smooth trail (every 1.5 px was hundreds a frame).
          const n = Math.max(1, Math.ceil(st / Math.max(3, d.r * 0.6)));
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
        // Never more than this many running at once (the oldest stop first).
        if (drips.length > 60) drips = drips.slice(-60);
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
          u.uR.value = s.r ?? Math.max(44, Math.min(w, h) * 0.15);
          u.uPower.value = s.p ?? 1;
          u.uSeed.value = s.seed;
          step(wipePass);
        }
        wipes.length = 0;
        unsaved = true;
        quiet = 0;
        redraw = true;
      }

      // Kept on the device once things have settled.
      if (unsaved && quiet > 6 && !drips.length && !fingers.size) persist();

      // The red edge: a flash when hit, a heartbeat when blood is low.
      const beat = Math.pow(0.5 + 0.5 * Math.sin(time * (5 + low * 4)), 6);
      const red = Math.min(1, hurt * 0.75 + low * (0.35 + 0.35 * beat));
      const op = red < 0.005 ? '0' : red.toFixed(2);
      if (op !== edgeShown) {
        edgeShown = op;
        edge.style.opacity = op;
      }
      const animating = glitch > 0;
      if (!redraw && !animating) return;
      redraw = false;
      const su = showPass.material.uniforms;
      su.tState.value = rtA.texture;
      su.uTime.value = time;
      su.uHurt.value = 0;
      su.uLow.value = 0;
      su.uGlitch.value = glitch;
      renderer.setRenderTarget(null);
      renderer.clear();
      showPass.render(renderer);
    },

    /** Water running down the glass from (ax, ay) to (bx, by): a narrow, gentle wipe. */
    wash(ax: number, ay: number, bx: number, by: number, r: number, power: number) {
      wipes.push({ ax, ay, bx, by, seed: Math.random() * 1000, r, p: power });
    },

    /** A flicker of static over everything (the screen changing). */
    pulse(power: number) {
      glitch = Math.max(glitch, power);
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
