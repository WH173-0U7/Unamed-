import * as THREE from 'three';
import type { Spill } from '../game/encounter';
import { createFullscreenShader, glslHash } from './fullscreen';
import { drawCracks } from './cracks';
import { createCrackGhost } from './crackGhost';
import { crackShared, setShardMap } from './crackShared';
import { settings } from '../core/settings';

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

  // Cracks in the glass (how close you are to going out): drawn once per
  // fight, revealed by the shader as the level rises. See cracks.ts.
  const crackCanvas = document.createElement('canvas');
  crackCanvas.width = crackCanvas.height = 1;
  /** (A new texture each time: the canvas changes size, and a texture can't.) */
  const newCrackTex = () => {
    const t = new THREE.CanvasTexture(crackCanvas);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.premultiplyAlpha = false;
    return t;
  };
  let crackTex = newCrackTex();
  // Seeing double through the broken glass (a filter on the game view under it).
  const gameView = document.getElementById('game');
  const ghost = gameView ? createCrackGhost(gameView) : null;

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
        // (Finger ridges, and the uneven pressure of a fingertip: strong streaks.)
        float streak = 0.5 + 0.5 * vnoise(vec2(across * 0.32, 0.5), uSeed);
        streak *= 0.78 + 0.22 * vnoise(vec2(across * 1.7, 0.5), uSeed + 3.0);
        // Wet blood is pushed along with the finger.
        vec4 b = texture2D(tState, toUv(p - dir * min(L * 1.4, uR * 0.85)));
        float wetB = clamp(b.g / max(b.r, 0.02), 0.0, 1.0);
        w *= uPower;
        // (More of it goes along with the finger than comes off: it smears.)
        float drag = w * 0.68 * wetB;
        float r = mix(s.r, b.r, drag);
        float g = mix(s.g, b.g, drag);
        // Some is lifted off; dry blood hardly comes away.
        float wet = clamp(g / max(r, 0.02), 0.0, 1.0);
        float lift = w * streak * mix(0.38, 0.7, wet);
        float r2 = r * (1.0 - lift);
        float g2 = g * (1.0 - lift);
        // What came off spreads as a thin smear; the smear wipes away slowly.
        float gone = max(s.r - r2, 0.0);
        float smear = s.b * (1.0 - w * streak * 0.26) + gone * mix(0.42, 0.66, wet) * streak;
        // Dust is moved about; skin leaves a little grease, most at the edges.
        float edge = smoothstep(0.55, 0.95, d / uR);
        // Dirt comes off with a wipe or two, unevenly: the ridges of a finger
        // leave fine streaks of it behind, and some is pushed out to the sides
        // of the stroke (a clean finger leaves nothing).
        float fine = 0.5 + 0.5 * vnoise(vec2(across * 0.9, dot(p - uA, dir) * 0.05), uSeed + 7.0);
        float lift2 = w * (0.2 + 0.55 * streak * fine);
        float gb = texture2D(tState, toUv(p - dir * min(L * 1.2, uR * 0.7))).a;
        float grime = s.a * (1.0 - lift2) + edge * w * 0.16 * gb;
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
      uniform sampler2D tCrack;
      uniform float uCrack;
      uniform vec4 uImp[3];   // impact points: x, y (screen points), haze radius, when it shows
      uniform float uFull;    // 1: the full look; 0 (low quality): the lighter one
      uniform float uWet;     // 0..1: water on the glass lately
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

        // ---- Grime: real dirt on a screen. Layered smudges with soft edges,
        // thicker where fingers and cloths never quite reach (the edges and
        // corners), brown, grey or yellowish by patch, with dust and fine
        // grit in it, and a faint greasy sheen where the light catches it.
        float gr = s.a;
        vec2 ec = abs(vUv - 0.5) * 2.0;
        float rim = smoothstep(0.55, 1.0, max(ec.x, ec.y));
        float g = clamp(gr * (1.0 + rim * 0.45), 0.0, 1.0);
        float n1 = vnoise(P / 70.0, 7.0);
        float n2 = vnoise(P / 22.0, 8.0);
        float n3 = vnoise(P / 6.0, 9.0);
        float mott = n1 * 0.5 + n2 * 0.33 + n3 * 0.17;
        // Soft-edged: a smudge thins out to nothing, it doesn't stop.
        float haze = smoothstep(0.0, 0.9, g) * (0.25 + 0.75 * mott);
        // Colour by patch: road grime, grey dust, old yellowed grease.
        vec3 grimeCol = mix(vec3(0.40, 0.35, 0.28), vec3(0.42, 0.42, 0.40), n1);
        grimeCol = mix(grimeCol, vec3(0.50, 0.44, 0.27), smoothstep(0.55, 0.85, vnoise(P / 120.0, 11.0)) * 0.7);
        float grimeA = haze * 0.34;
        // Dust and grit: fine round grains everywhere it's dirty, the odd bigger speck.
        vec3 rgb = grimeCol * grimeA;
        float a = grimeA;
        vec2 cell = floor(P / 2.2);
        vec2 gc = vec2(hash(cell, 36.0), hash(cell, 37.0)) * 0.6 + 0.2;
        float gd = length(fract(P / 2.2) - gc) * 2.2;
        float grit = step(1.0 - g * 0.14, hash(cell, 31.0)) * (1.0 - smoothstep(0.35, 0.8, gd));
        float gA = grit * (0.22 + 0.25 * hash(cell, 33.0));
        rgb = vec3(0.55, 0.52, 0.46) * gA + rgb * (1.0 - gA);
        a = gA + a * (1.0 - gA);
        vec2 cell2 = floor(P / 6.0);
        vec2 sc = vec2(hash(cell2, 38.0), hash(cell2, 39.0)) * 0.5 + 0.25;
        float srad = 0.7 + hash(cell2, 40.0) * 1.4;
        float sd = length((fract(P / 6.0) - sc) * 6.0 * vec2(1.0, 0.8 + 0.4 * hash(cell2, 41.0)));
        float speck = step(1.0 - g * 0.06, hash(cell2, 34.0)) * (1.0 - smoothstep(srad * 0.45, srad, sd));
        float darkSpeck = step(0.45, hash(cell2, 32.0));
        float sA = speck * (0.4 + 0.35 * hash(cell2, 35.0));
        vec3 sCol = mix(vec3(0.62, 0.59, 0.52), vec3(0.08, 0.06, 0.05), darkSpeck);
        rgb = sCol * sA + rgb * (1.0 - sA);
        a = sA + a * (1.0 - sA);
        // A greasy sheen: the light from the top left catching the slopes of a smear.
        if (uFull > 0.5 && g > 0.02) {
          float gx = S(uv + dx * 2.0).a - S(uv - dx * 2.0).a;
          float gy = S(uv + dy * 2.0).a - S(uv - dy * 2.0).a;
          float lit = clamp(dot(normalize(vec3(-gx * 6.0, -gy * 6.0, 1.0)), normalize(vec3(-0.5, 0.6, 0.65))), 0.0, 1.0);
          float sheen = pow(lit, 18.0) * smoothstep(0.05, 0.4, g) * 0.16;
          rgb += vec3(0.85, 0.83, 0.75) * sheen;
          a = max(a, sheen);
        }
        // Water: spots that dry into faint rings, more while it's wet.
        vec2 wc = floor(P / 26.0);
        vec2 wo = vec2(hash(wc, 51.0), hash(wc, 52.0)) * 26.0;
        float wr = 3.0 + hash(wc, 53.0) * 7.0;
        float wd = length(P - wc * 26.0 - wo);
        float wring = smoothstep(wr - 1.4, wr - 0.4, wd) * (1.0 - smoothstep(wr - 0.4, wr + 0.6, wd));
        float wbody = (1.0 - smoothstep(0.0, wr, wd)) * 0.35;
        float spotOn = step(hash(wc, 54.0), 0.22 + uWet * 0.4);
        float spotA = spotOn * (wring + wbody * uWet) * (0.16 * uWet + 0.12 * smoothstep(0.05, 0.5, g));
        rgb = mix(rgb, vec3(0.7, 0.72, 0.74) * spotA, spotA);
        a = spotA + a * (1.0 - spotA);
        a = min(a, 0.72);

        // ---- Cracks: in the glass itself, under whatever's on it. Each line
        // is a bright, cold glint with a dark edge beside it (light bending
        // through the break), revealed where its threshold is under the level.
        if (uCrack > 0.002) {
          vec4 k = texture2D(tCrack, vUv);
          // Red is the crack line's strength; where it's 0, it's the body of a shard.
          float isLine = smoothstep(0.06, 0.28, k.r);
          float rev = smoothstep(k.g - 0.02, k.g + 0.01, uCrack) * k.a;
          float show = rev * isLine;
          // A pixel and a half either side, across the break: light splits
          // into a red edge on one side and a cold blue one on the other.
          vec2 ox = vec2(1.6, 0.0) / uRes;
          vec2 oy = vec2(0.0, 1.6) / uRes;
          vec4 kp = texture2D(tCrack, vUv + ox + oy);
          vec4 km = texture2D(tCrack, vUv - ox - oy);
          float lp = smoothstep(kp.g - 0.02, kp.g + 0.01, uCrack) * kp.a * smoothstep(0.06, 0.28, kp.r);
          float lm = smoothstep(km.g - 0.02, km.g + 0.01, uCrack) * km.a * smoothstep(0.06, 0.28, km.r);
          // ---- The pieces: each its own tilt, so each catches the light its own way.
          float facet = rev * (1.0 - isLine) * step(0.02, k.b);
          float tone = k.b * 2.0 - 1.0;
          float sheen = facet * (0.05 + 0.07 * uFull) * max(tone, 0.0) * (0.7 + 0.6 * vnoise(P / 60.0, 74.0));
          float shade = facet * 0.11 * max(-tone, 0.0);
          rgb = vec3(0.82, 0.88, 0.95) * sheen + rgb * (1.0 - sheen);
          a = sheen + a * (1.0 - sheen);
          rgb *= 1.0 - shade;
          a = shade + a * (1.0 - shade);
          // ---- Chromatic edges along the breaks.
          float fr = lp * (1.0 - show) * 0.32;
          float fc = lm * (1.0 - show) * 0.32;
          rgb = vec3(1.0, 0.22, 0.18) * fr + rgb * (1.0 - fr);
          a = fr + a * (1.0 - fr);
          rgb = vec3(0.2, 0.85, 1.0) * fc + rgb * (1.0 - fc);
          a = fc + a * (1.0 - fc);
          // ---- The line itself: a dark seam with a bright, cold glint down
          // its middle, brightest where the break faces the light.
          vec2 off = vec2(1.3, -1.3) / uRes;
          vec4 k2 = texture2D(tCrack, vUv + off);
          float show2 = smoothstep(k2.g - 0.02, k2.g + 0.01, uCrack) * k2.a * smoothstep(0.06, 0.28, k2.r);
          float shadow = show2 * (1.0 - show) * 0.55;
          rgb = rgb * (1.0 - shadow);
          a = shadow + a * (1.0 - shadow);
          float nz = vnoise(P / 34.0, 71.0);
          float glim = 0.55 + 0.45 * nz + 1.1 * pow(smoothstep(0.55, 0.95, vnoise(P / 18.0, 72.0)), 2.0);
          float lineA = clamp(show * (0.42 + 0.5 * k.r) * glim, 0.0, 0.92);
          rgb = vec3(0.9, 0.94, 1.0) * lineA + rgb * (1.0 - lineA);
          a = lineA + a * (1.0 - lineA);
          // Glints: the odd hard point of light on a broken edge.
          float glint = show * pow(smoothstep(0.82, 1.0, hash(floor(P / 3.0), 75.0)), 3.0) * uFull;
          rgb += vec3(1.0) * glint * 0.9;
          a = max(a, glint);
          // ---- Where it was hit: crushed white, and a milky haze around it.
          float frostA = 0.0;
          for (int i = 0; i < 3; i++) {
            vec4 im = uImp[i];
            if (im.z <= 0.0) continue;
            float on = smoothstep(im.w, im.w + 0.06, uCrack);
            float d = length(P - im.xy);
            float frost = (1.0 - smoothstep(0.0, im.z, d)) * (0.55 + 0.45 * vnoise(P / 7.0, 76.0 + float(i)));
            frostA += on * frost;
          }
          frostA = clamp(frostA, 0.0, 1.0) * (0.16 + 0.08 * uFull);
          rgb = vec3(0.78, 0.8, 0.83) * frostA + rgb * (1.0 - frostA);
          a = frostA + a * (1.0 - frostA);
          // Close to going out, the world dims at the edges.
          vec2 cv = (vUv - 0.5) * vec2(aspect, 1.0);
          float dim = smoothstep(0.55, 1.0, uCrack) * smoothstep(0.25, 0.95, length(cv / vec2(max(aspect, 1.0) * 0.6, 0.62))) * 0.55;
          rgb = rgb * (1.0 - dim);
          a = dim + a * (1.0 - dim);
        }

        // ---- Smear: a thin, streaky film of blood left by wiping.
        float sm = smoothstep(0.0, 0.32, s.b);
        // Thin, it's a see-through rusty film; thicker, a dark crimson.
        float smA = sm * (0.5 + 0.3 * blotch);
        vec3 smCol = mix(vec3(0.55, 0.13, 0.07), vec3(0.3, 0.03, 0.03), smoothstep(0.1, 0.7, s.b));
        // Where a smear ends it dries darker: a faint tide line along its edges.
        float sgx = S(uv + dx * 2.0).b - S(uv - dx * 2.0).b;
        float sgy = S(uv + dy * 2.0).b - S(uv - dy * 2.0).b;
        float tide = smoothstep(0.04, 0.16, length(vec2(sgx, sgy))) * smoothstep(0.02, 0.12, s.b);
        smCol *= 1.0 - tide * 0.45;
        smA = min(0.85, smA + tide * 0.18);
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
      tCrack: { value: crackTex },
      uCrack: { value: 0 },
      uImp: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
      uFull: { value: 1 },
      uWet: { value: 0 },
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
  /** Water on the glass lately (rain running down it), 0..1: it dries off over a minute or so. */
  let wet = 0;
  let wetShown = 0;
  let low = 0;
  /** Cracks: how far they've spread (shown), where they're heading, and whether the pattern is fresh. */
  let crack = 0;
  let crackTarget = 0;
  /** The crack level last drawn, and when the crack last moved (real clock). */
  let crackDrawn = 0;
  let crackAt = 0;
  let crackStale = true;
  let crackScale = 1;
  let pendingDirty = false;
  let redraw = true;
  /** Seconds since fresh blood last landed (it's drying while this is small). */
  let sinceFresh = 1e9;
  let dryClock = 0;
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
    /** A run that keeps going at its own pace (blood running down from the top), instead of slowing to a stop. */
    steady?: number;
    /** Sticking for a moment (a run creeps, catches, and goes again). */
    stuck?: number;
  }
  let drips: Drip[] = [];
  /** Where your head wound's blood comes in over the top edge (it keeps to the same side). */
  let topX = -1;

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
  /**
   * Wet blood heavy enough to run: from the lower edge of a splash, a few
   * runs set off down the glass, each with a bead at its head, creeping and
   * catching as they go.
   */
  function runs(x: number, y: number, size: number, n: number) {
    const rnd = Math.random;
    pctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const px = x + (rnd() - 0.5) * size * 2.2;
      const py = y + size * (0.4 + rnd() * 0.6);
      const r = Math.max(2.2, size * (0.22 + rnd() * 0.18));
      // A heavier lip where it gathers before it goes.
      stamp(px, py, r * 1.6, 0.45);
      drips.push({ x: px, y: py, v: 0, r, life: 2 + rnd() * 3.5, wob: rnd() * 6, steady: 18 + rnd() * 30, stuck: rnd() * 0.5 });
    }
    pctx.globalCompositeOperation = 'source-over';
    painted(true);
  }

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
  let reading = false;
  function persist(sync = false) {
    if ((!unsaved && !driedUnsaved) || !w) return;
    // Still reading the last one back: this one waits (unless the page is going).
    if (reading && !sync) return;
    unsaved = false;
    driedUnsaved = false;
    try {
      const s = Math.min(1, PACK_MAX / Math.max(rtA.width, rtA.height));
      const pw = Math.max(1, Math.round(rtA.width * s));
      const ph = Math.max(1, Math.round(rtA.height * s));
      packRT.setSize(pw, ph);
      copyInto(packRT, rtA.texture, [0.5, 0.5, 1, 1]);
      const px = new Uint8Array(pw * ph * 4);
      const encode = () => {
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
      };
      // Reading the picture back from the graphics card is the slow part: off
      // the main thread where the browser can (WebGL2), at once if the page is going.
      const asyncRead = (renderer as unknown as { readRenderTargetPixelsAsync?: (...a: unknown[]) => Promise<unknown> }).readRenderTargetPixelsAsync;
      if (!sync && asyncRead && renderer.capabilities.isWebGL2) {
        reading = true;
        asyncRead
          .call(renderer, packRT, 0, 0, pw, ph, px)
          .then(() => {
            try {
              encode();
            } catch {
              /* storage blocked */
            }
          })
          .catch(() => {
            unsaved = true;
          })
          .finally(() => {
            reading = false;
          });
      } else {
        renderer.readRenderTargetPixels(packRT, 0, 0, pw, ph, px);
        encode();
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
    // (A clean glass to start: dirt only comes from hitting the ground.)
    if (!stored) return;
    // Saves from when dust settled on its own: that dirt goes, once.
    let clearDirt = false;
    try {
      clearDirt = !localStorage.getItem('darcvoyd.cleanglass');
      localStorage.setItem('darcvoyd.cleanglass', '1');
    } catch {
      /* no storage */
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
        px[o + 3] = clearDirt ? 0 : d[(n + i) * 4];
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
      // Spoiled: start again with a clean glass.
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
      crackScale = Math.min(2, Math.max(1, pr));
      crackStale = true;
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
          // The heavier drops in a spatter can carry on running.
          if (rnd() < 0.3 + power * 0.3) runs(p.x + Math.cos(p.dir) * m * 0.15, p.y + Math.sin(p.dir) * m * 0.15, m * 0.03, 1 + Math.floor(rnd() * 2));
          return;
        }
        case 'cough':
          coughMist(w * (0.35 + rnd() * 0.3), h * (0.85 + rnd() * 0.1), m * (0.25 + rnd() * 0.15), hurtYou ? 1 : 0.4);
          return;
        case 'spray': {
          const p = fromEdge(0.45);
          castOff(p.x, p.y, m * (0.5 + power * 0.6), p.dir, (0.3 + power * 0.7) * near);
          if (power > 0.5) spatter(p.x, p.y, m * 0.3, p.dir, 0.5 * near);
          // A cut throws fresh, thin blood: it runs.
          if (rnd() < 0.55) runs(p.x + Math.cos(p.dir) * m * 0.25, p.y + Math.sin(p.dir) * m * 0.25, m * 0.025, 1 + Math.floor(rnd() * 3));
          return;
        }
        case 'splash': {
          const count = hurtYou ? 1 + (power > 0.55 ? 1 : 0) : 1;
          for (let i = 0; i < count; i++) {
            const p = fromEdge(0.25 + rnd() * 0.25);
            const size = m * (hurtYou ? 0.036 + power * 0.04 : 0.022 + power * 0.024);
            splat(p.x, p.y, size, p.dir, hurtYou && power > 0.4);
            // Sometimes it lands wet and heavy enough to run.
            if (rnd() < 0.4 + power * 0.3) runs(p.x, p.y, size, 1 + Math.floor(rnd() * (2 + power * 2)));
          }
          return;
        }
      }
    },

    /**
     * How awake you are (100 fine .. 0 knocked out): cracks spread across the
     * glass as it falls, and close up again as you come to.
     */
    setAwake(v: number) {
      // Slow to start (a hairline or two), then it goes.
      crackTarget = Math.pow(Math.min(1, Math.max(0, (92 - v) / 92)), 1.35);
    },

    /**
     * Bleeding from the head: blood seeps in over the top edge of the glass
     * and runs down, on the side the wound's on, like blood running into
     * your eyes. `level` is how badly (1..4).
     */
    bleedTop(level: number) {
      if (!w) return;
      const rnd = Math.random;
      if (topX < 0) topX = w * (rnd() < 0.5 ? 0.12 + rnd() * 0.25 : 0.63 + rnd() * 0.25);
      // It finds the same way down, mostly.
      topX = Math.min(w - 8, Math.max(8, topX + (rnd() - 0.5) * 18));
      const x = topX + (rnd() - 0.5) * (14 + level * 10);
      pctx.globalCompositeOperation = 'lighter';
      // Where it gathers at the edge before it runs.
      for (let i = 0; i < 3 + level; i++) stamp(x + (rnd() - 0.5) * 26, rnd() * 5 - 2, 5 + rnd() * 6 + level * 1.5, 0.3);
      pctx.globalCompositeOperation = 'source-over';
      const r = 2.6 + level * 0.9 + rnd() * 1.5;
      drips.push({ x, y: 2, v: 0, r, life: 4 + level + rnd() * 3, wob: rnd() * 6, steady: 26 + level * 9 + rnd() * 14 });
      painted(true);
    },
    /** Forget where the last head wound bled from (a new fight, a new cut). */
    resetBleedTop() {
      topX = -1;
    },

    /**
     * You hit the ground: grit and dirt on the glass, mostly low down and on
     * the side you landed, a few smudges, a scatter of specks. `power` 0..1.
     */
    dirt(power = 0.6) {
      if (!w) return;
      const rnd = Math.random;
      const side = rnd() < 0.5 ? 0.2 : 0.8;
      pctx.globalCompositeOperation = 'lighter';
      // Smudges where it pressed against the ground.
      for (let i = 0; i < 2 + Math.round(power * 3); i++) {
        const x = w * (side + (rnd() - 0.5) * 0.5);
        const y = h * (0.62 + rnd() * 0.36);
        stamp(x, y, 40 + rnd() * 70 * (0.6 + power), 0.22 + power * 0.18, 1.4 + rnd(), rnd() * 3, true);
      }
      // A greasy hand on the glass, catching yourself: a palm and four fingertips, smeared.
      if (power > 0.5 && rnd() < 0.7) {
        const hx = w * (side + (rnd() - 0.5) * 0.35);
        const hy = h * (0.5 + rnd() * 0.35);
        const s = Math.min(w, h) * (0.07 + rnd() * 0.03);
        const tilt = (rnd() - 0.5) * 0.8;
        const drag = rnd() * Math.PI * 2;
        stamp(hx, hy, s * 1.5, 0.16, 1.3, tilt, true);
        for (let f = 0; f < 4; f++) {
          const fa = tilt - Math.PI / 2 + (f - 1.5) * 0.32;
          const fx = hx + Math.cos(fa) * s * 1.9;
          const fy = hy + Math.sin(fa) * s * 1.9;
          stamp(fx, fy, s * 0.42, 0.22, 1.5, fa, true);
          // (Dragged a little as you pushed off: a short smear from each.)
          stamp(fx + Math.cos(drag) * s * 0.4, fy + Math.sin(drag) * s * 0.4, s * 0.38, 0.1, 2.2, drag, true);
        }
      }
      // Grit: specks thrown up, thickest low down.
      for (let i = 0; i < 60 + power * 160; i++) {
        const x = w * (side + (rnd() - 0.5) * 0.9);
        const y = h * (1 - Math.pow(rnd(), 1.6) * 0.75);
        stamp(x, y, 2 + rnd() * 4, 0.6 + rnd() * 0.4, 1, 0, true);
      }
      // And it collects along the edges and into the corners.
      for (let i = 0; i < 6 + power * 10; i++) {
        const along = rnd();
        const e = Math.floor(rnd() * 4);
        const x = e === 0 ? w * along : e === 1 ? w * along : e === 2 ? 0 : w;
        const y = e === 0 ? 0 : e === 1 ? h : h * along;
        stamp(x, y, 24 + rnd() * 40, 0.08 + power * 0.06, 1.8, e < 2 ? 0 : Math.PI / 2, true);
      }
      pctx.globalCompositeOperation = 'source-over';
      painted(false);
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
      wet = Math.max(0, wet - dt * 0.015);
      if (Math.abs(wet - wetShown) > 0.03) {
        wetShown = wet;
        redraw = true;
      }
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
          if (d.steady) {
            // Blood running down glass doesn't flow evenly: it creeps, catches
            // on something, and lets go again.
            if (d.stuck && (d.stuck -= dt) > 0) d.v = 0;
            else {
              d.stuck = 0;
              d.v += (d.steady - d.v) * Math.min(1, dt * 3);
              if (Math.random() < dt * 0.5) d.stuck = 0.2 + Math.random() * 0.6;
            }
            d.r *= Math.pow(0.97, dt);
          } else {
            d.v *= Math.pow(0.62, dt);
            d.r *= Math.pow(0.93, dt);
          }
          d.life -= dt;
          if (d.life <= 0 || (d.v <= 6 && !d.steady)) stamp(d.x + Math.sin(d.y * 0.04 + d.wob) * 1.5, d.y + d.r * 0.3, d.r * 1.35, 0.55);
        }
        drips = drips.filter((d) => d.life > 0 && d.r > 1.5 && (d.v > 6 || !!d.steady) && d.y < h);
        // Never more than this many running at once (the oldest stop first).
        if (drips.length > 60) drips = drips.slice(-60);
        pctx.globalCompositeOperation = 'source-over';
        painted(true);
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

      // Cracks: they spread fast when you're hit, and fade slowly as you
      // come to. A new pattern for the next time it breaks.
      if (crackTarget > 0 && crackStale && crack < 0.01 && w) {
        const { shards, impacts } = drawCracks(crackCanvas, w, h, crackScale, (Math.random() * 1e9) | 0);
        ghost?.setShards(shards, w, h);
        setShardMap(shards, w, h);
        const imp = showPass.material.uniforms.uImp.value as THREE.Vector4[];
        imp.forEach((v, i) => {
          const p = impacts[i];
          v.set(p?.x ?? 0, p?.y ?? 0, p ? Math.min(p.reach * 0.18, Math.min(w, h) * 0.16) : 0, p?.t ?? 1);
        });
        crackTex.dispose();
        crackTex = newCrackTex();
        showPass.material.uniforms.tCrack.value = crackTex;
        crackStale = false;
      }
      // (On the real clock, not the frame's: a slow phone's capped frames don't stretch the fade out.)
      const tCrack = performance.now();
      const cdt = crackAt ? Math.min(1, Math.max(0, (tCrack - crackAt) / 1000)) : dt;
      crackAt = tCrack;
      if (crack !== crackTarget) {
        const rising = crackTarget > crack;
        crack = rising ? Math.min(crackTarget, crack + cdt * 1.6) : Math.max(crackTarget, crack - cdt * 0.12);
        if (crack < 0.004 && crackTarget === 0) {
          crack = 0;
          crackStale = true;
        }
        // (Fading: redrawn only when it's visibly less, not every frame.)
        if (rising || crack === crackTarget || Math.abs(crack - crackDrawn) > 0.02) {
          crackDrawn = crack;
          redraw = true;
          crackShared.level = crack;
          ghost?.update(crack);
        }
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
      su.uCrack.value = crack;
      su.uFull.value = settings.quality === 'low' ? 0 : 1;
      su.uWet.value = wet;
      renderer.setRenderTarget(null);
      renderer.clear();
      showPass.render(renderer);
    },

    /** Water running down the glass from (ax, ay) to (bx, by): a narrow, gentle wipe. */
    wash(ax: number, ay: number, bx: number, by: number, r: number, power: number) {
      wipes.push({ ax, ay, bx, by, seed: Math.random() * 1000, r, p: power });
      wet = Math.min(1, wet + 0.08 * power);
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
