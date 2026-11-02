import * as THREE from 'three';
import { createFullscreenShader, glslHash } from './fullscreen';

/**
 * The hit effects layer, drawn on the GPU over everything (the TV and the
 * game's buttons and text):
 *
 * - **Blood on the screen.** Each splatter is painted as a field of soft
 *   overlapping blobs: a main splash, streams thrown outward ending in round
 *   beads, satellite drops with little tails, fine mist, and drips that run
 *   down and gather into a bead where they stop. A shader takes the surface
 *   where the field crosses a threshold (so drops merge smoothly, like real
 *   liquid) and lights it like wet blood: nearly black-red where thick,
 *   glowing red at thin edges, a dark meniscus line, light shining through
 *   the domes, and sharp glossy highlights.
 * - **A red border** that flashes when you're hit, and stays (pulsing like a
 *   heartbeat) when you've lost a lot of blood.
 * - **Glitch bands and static** tearing across the screen on impact.
 */
export function createBloodFx(host: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.id = 'blood-fx';
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false, stencil: false, depth: false });
  renderer.setClearColor(0x000000, 0);

  // The thickness map, painted with Canvas 2D (white = thick blood).
  const thick = document.createElement('canvas');
  const tctx = thick.getContext('2d')!;
  const texture = new THREE.CanvasTexture(thick);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const pass = createFullscreenShader(
    /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tThick;
      uniform vec2 uTexel;     // one texel of the thickness map
      uniform vec2 uRes;       // screen size (px)
      uniform float uTime;
      uniform float uHurt;     // 0..1 red flash from being hit
      uniform float uLow;      // 0..1 how low your blood is
      uniform float uGlitch;   // 0..1 glitch tearing
      uniform float uFade;     // 0..1 overall opacity (wiping clean)
      ${glslHash}

      float T(vec2 uv) { return texture2D(tThick, uv).r; }

      void main() {
        vec2 uv = vUv;
        float aspect = uRes.x / uRes.y;

        // Glitch: rows of the image jump sideways for a moment.
        float band = floor(uv.y * 38.0);
        float frame = floor(uTime * 24.0);
        float tear = step(1.0 - uGlitch * 0.55, hash(vec2(band, 3.0), frame));
        uv.x += (hash(vec2(band, 7.0), frame) - 0.5) * 0.08 * tear * uGlitch;

        // Blood is a smooth field of overlapping soft blobs; its surface is
        // where the field crosses a threshold (like surface tension: nearby
        // drops merge with smooth necks, streaks end in round beads).
        const float THR = 0.3;
        vec2 dx = vec2(uTexel.x, 0.0);
        vec2 dy = vec2(0.0, uTexel.y);
        // Lightly smoothed (the field is stored in 8 bits).
        float f = (T(uv) * 4.0 + T(uv + dx) + T(uv - dx) + T(uv + dy) + T(uv - dy)) / 8.0;
        float fw = fwidth(f) * 0.9 + 0.004;
        float cover = smoothstep(THR - fw, THR + fw, f);
        // Height above the surface line: domed drops, flat-topped pools.
        float hgt = clamp((f - THR) / (1.0 - THR), 0.0, 1.0);
        float gx = (T(uv + dx * 2.0) - T(uv - dx * 2.0)) * 0.6 + (T(uv + dx * 3.5) - T(uv - dx * 3.5)) * 0.4;
        float gy = (T(uv + dy * 2.0) - T(uv - dy * 2.0)) * 0.6 + (T(uv + dy * 3.5) - T(uv - dy * 3.5)) * 0.4;
        float slope = length(vec2(gx, gy));
        vec3 n = normalize(vec3(-gx * 8.0, -gy * 8.0, 1.0));

        // Colour: light passing through blood loses blue and green much faster
        // than red, so thin edges glow red and thick pools go almost black.
        // Pools aren't perfectly even: slow variation in how thick they are.
        vec2 q = vUv * uRes / 90.0;
        vec2 qi = floor(q);
        vec2 qf = q - qi;
        qf = qf * qf * (3.0 - 2.0 * qf);
        float pn = mix(mix(hash(qi, 9.0), hash(qi + vec2(1.0, 0.0), 9.0), qf.x), mix(hash(qi + vec2(0.0, 1.0), 9.0), hash(qi + vec2(1.0, 1.0), 9.0), qf.x), qf.y);
        float depth = 0.12 + hgt * (1.05 + pn * 0.45);
        vec3 col = vec3(0.8, 0.07, 0.06) * exp(-vec3(1.05, 3.2, 2.8) * depth);
        // The meniscus: a thin darker line right at the edge of every drop.
        float edgeBand = cover * (1.0 - smoothstep(0.0, 0.07, hgt));
        col *= 1.0 - edgeBand * 0.4;
        // Light from up and to the left.
        vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
        vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
        float nh = max(dot(n, H), 0.0);
        // Only on the curved parts of the surface (not flat pools, not noise).
        float curved = smoothstep(0.012, 0.045, slope) * smoothstep(0.02, 0.15, hgt);
        float spec = (pow(nh, 140.0) * 1.1 + pow(nh, 24.0) * 0.12) * curved;
        // Light shining through the far side of a dome: a red glow inside the edge.
        float through = pow(max(dot(n.xy, -L.xy), 0.0), 1.5) * (1.0 - smoothstep(0.05, 0.5, hgt)) * cover;
        col += vec3(0.55, 0.04, 0.03) * through * 0.6;
        // A faint reflection of the room in the wet surface.
        float env = smoothstep(0.2, 0.9, n.y * 0.5 + 0.5) * 0.05 * cover;
        float alpha = cover * (0.8 + 0.18 * smoothstep(0.0, 0.25, hgt)) * uFade;
        vec3 blood = (col + env) * alpha + vec3(1.0, 0.94, 0.9) * spec * uFade * cover;

        // The red border: a flash when hit, a heartbeat when blood is low.
        vec2 c = (vUv - 0.5) * vec2(aspect, 1.0);
        float edge = smoothstep(0.45, 1.0, length(c / vec2(max(aspect, 1.0) * 0.55, 0.62)));
        float beat = pow(0.5 + 0.5 * sin(uTime * (5.0 + uLow * 4.0)), 6.0);
        float red = edge * (uHurt * 0.75 + uLow * (0.35 + 0.35 * beat));
        vec3 vign = vec3(0.45, 0.0, 0.02) * red;
        float vignA = red * 0.9;

        // Static: torn bright lines and snow while glitching.
        float snow = hash(floor(vUv * uRes / 2.0), frame) * uGlitch * 0.22;
        float line = step(0.985 - uGlitch * 0.05, hash(vec2(floor(vUv.y * uRes.y / 2.0), 1.0), frame)) * uGlitch * 0.4;
        float st = (snow + line) * (1.0 - alpha);

        // Blood over the border, static over both (premultiplied alpha).
        vec3 rgb = blood + vign * (1.0 - alpha) + vec3(st);
        float a = alpha + vignA * (1.0 - alpha) + st;
        gl_FragColor = vec4(rgb, clamp(a, 0.0, 1.0));
      }
    `,
    {
      tThick: { value: texture },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uHurt: { value: 0 },
      uLow: { value: 0 },
      uGlitch: { value: 0 },
      uFade: { value: 1 },
    },
  );
  pass.material.transparent = true;
  pass.material.blending = THREE.NoBlending;
  const u = pass.material.uniforms;

  let w = 1;
  let h = 1;
  /** Thickness map resolution relative to the screen. */
  let k = 0.5;
  let time = 0;
  let hurt = 0;
  let glitch = 0;
  let low = 0;
  let wiping = 0;
  let dirty = false;
  let any = false;
  let idle = false;
  interface Drip {
    x: number;
    y: number;
    v: number;
    r: number;
    life: number;
    wob: number;
  }
  let drips: Drip[] = [];

  /**
   * One soft blob of blood in the field: a gaussian bump of height `a` and
   * radius `r` (screen points), optionally stretched along `ang`. The visible
   * drop is where the field passes the threshold, about half the radius.
   */
  function stamp(x: number, y: number, r: number, a: number, stretch = 1, ang = 0) {
    const R = Math.max(0.8, r * k);
    tctx.save();
    tctx.translate(x * k, y * k);
    if (stretch !== 1) {
      tctx.rotate(ang);
      tctx.scale(stretch, 1);
    }
    const g = tctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.25, `rgba(255,255,255,${a * 0.84})`);
    g.addColorStop(0.5, `rgba(255,255,255,${a * 0.5})`);
    g.addColorStop(0.75, `rgba(255,255,255,${a * 0.19})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    tctx.fillStyle = g;
    tctx.beginPath();
    tctx.arc(0, 0, R, 0, Math.PI * 2);
    tctx.fill();
    tctx.restore();
  }

  /**
   * One splatter at (x, y) in screen points: `size` is the main splash's
   * radius, `dir` the direction it was flying (radians).
   */
  function splat(x: number, y: number, size: number, dir: number, heavy: boolean) {
    const rnd = Math.random;
    const g = (s = 1) => (rnd() + rnd() + rnd() - 1.5) * s; // rough gaussian
    const cos = Math.cos;
    const sin = Math.sin;
    tctx.globalCompositeOperation = 'lighter';

    // 1. The main splash: a cluster of blobs, smeared in the direction of travel.
    stamp(x, y, size * 1.6, 0.62);
    const body = (heavy ? 12 : 8) + Math.floor(rnd() * 5);
    for (let i = 0; i < body; i++) {
      const along = g(size * 0.6) + size * 0.2;
      const across = g(size * 0.5);
      const px = x + cos(dir) * along - sin(dir) * across;
      const py = y + sin(dir) * along + cos(dir) * across;
      stamp(px, py, size * (0.4 + rnd() * 0.55), 0.24 + rnd() * 0.12);
    }

    // 2. Arms: streams thrown out of the splash, thinning as they go, each
    //    ending in a round bead (sometimes broken off into a separate drop).
    const arms = (heavy ? 11 : 7) + Math.floor(rnd() * 6);
    for (let i = 0; i < arms; i++) {
      let a = dir + g(1.15);
      const len = size * (0.8 + Math.pow(rnd(), 0.9) * (heavy ? 2.6 : 1.9));
      const r0 = size * (0.24 + rnd() * 0.18);
      const r1 = size * (0.08 + rnd() * 0.05);
      let px = x + cos(a) * size * 0.7;
      let py = y + sin(a) * size * 0.7;
      const stepLen = Math.max(1.2, size * 0.07);
      const steps = Math.ceil(len / stepLen);
      const curl = g(0.012);
      const broken = rnd() < 0.35 ? 0.75 + rnd() * 0.15 : 2;
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        if (t > broken && t < broken + 0.12) {
          px += cos(a) * stepLen;
          py += sin(a) * stepLen;
          continue;
        }
        a += curl;
        px += cos(a) * stepLen;
        py += sin(a) * stepLen;
        stamp(px, py, r0 + (r1 - r0) * Math.pow(t, 0.7), 0.38);
      }
      // The bead at the end: blood gathers into a ball.
      stamp(px + cos(a) * r1, py + sin(a) * r1, size * (0.2 + rnd() * 0.18), 0.62, 1.15, a);
    }

    // 3. Satellite drops: flung along the same line, smaller the further they
    //    went, stretched by their speed, some with a little tail behind them.
    const drops = (heavy ? 60 : 35) + Math.floor(rnd() * 30);
    for (let i = 0; i < drops; i++) {
      const a = dir + g(1.35);
      const dist = size * (1.6 + Math.pow(rnd(), 1.4) * (heavy ? 5 : 3.6));
      const r = size * (0.05 + 0.28 * Math.pow(rnd(), 2.4)) + 1.4;
      const px = x + cos(a) * dist;
      const py = y + sin(a) * dist;
      const stretch = 1 + rnd() * 0.5 * Math.min(1, dist / (size * 4));
      stamp(px, py, r, 0.6 + rnd() * 0.15, stretch, a);
      if (r > 4 && rnd() < 0.5) stamp(px - cos(a) * r * 0.9, py - sin(a) * r * 0.9, r * 0.45, 0.5, 1.6, a);
    }

    // 4. Mist: a fine spray of tiny droplets.
    const mist = (heavy ? 160 : 90) + Math.floor(rnd() * 80);
    for (let i = 0; i < mist; i++) {
      const a = dir + g(1.6);
      const dist = size * (1 + Math.pow(rnd(), 1.3) * (heavy ? 5.5 : 4));
      stamp(x + cos(a) * dist, y + sin(a) * dist, 1.3 + rnd() * 2.2, 0.55 + rnd() * 0.2);
    }

    // 5. Drips: heavy blood runs down the glass from the bottom of the splash.
    const nd = heavy ? 2 + Math.floor(rnd() * 3) : 1 + (rnd() < 0.5 ? 1 : 0);
    for (let i = 0; i < nd; i++) {
      drips.push({
        x: x + g(size * 0.9),
        y: y + size * (0.4 + rnd() * 0.5),
        v: 55 + rnd() * 90,
        r: size * (0.16 + rnd() * 0.1),
        life: 2 + rnd() * 4,
        wob: rnd() * 6,
      });
    }
    tctx.globalCompositeOperation = 'source-over';
    dirty = true;
    any = true;
  }

  return {
    setSize(width: number, height: number, pixelRatio: number) {
      w = width;
      h = height;
      renderer.setPixelRatio(Math.min(pixelRatio, 2));
      renderer.setSize(width, height);
      // A resize clears the blood (the map is redrawn at the new size).
      k = Math.min(2, 1400 / Math.max(width, height), Math.max(1, pixelRatio));
      thick.width = Math.max(1, Math.round(width * k));
      thick.height = Math.max(1, Math.round(height * k));
      u.uTexel.value.set(1 / thick.width, 1 / thick.height);
      u.uRes.value.set(width, height);
      drips = [];
      dirty = true;
    },

    /**
     * React to a blow. `hurtYou`: you were hit (big splashes on the glass, red
     * flash); otherwise you hit them (their blood sprays across). `amount` is
     * blood lost (ml); `severe` a break, knockout or very heavy blow.
     */
    impact(hurtYou: boolean, amount: number, severe: boolean) {
      const power = Math.min(1, amount / 600) * (severe ? 1.3 : 1);
      glitch = Math.max(glitch, (hurtYou ? 0.55 : 0.3) + power * 0.45);
      if (hurtYou) hurt = Math.max(hurt, 0.5 + power * 0.5);
      const m = Math.min(w, h);
      const count = hurtYou ? 1 + (power > 0.45 ? 1 : 0) + (severe ? 1 : 0) : amount > 100 ? 1 : 0;
      for (let i = 0; i < count; i++) {
        // On the glass: mostly towards the edges and corners, flying inward.
        const ang = Math.random() * Math.PI * 2;
        const rr = 0.25 + Math.random() * 0.25;
        const x = w / 2 + Math.cos(ang) * w * rr;
        const y = h / 2 + Math.sin(ang) * h * rr;
        const dir = Math.atan2(h / 2 - y, w / 2 - x) + (Math.random() - 0.5) * 1.2;
        const size = m * (hurtYou ? 0.042 + power * 0.04 : 0.026 + power * 0.026);
        splat(x, y, size, dir, hurtYou && power > 0.4);
      }
      if (!hurtYou && amount > 0) {
        // A light spray of their blood even on smaller hits.
        const x = w * (0.2 + Math.random() * 0.6);
        const y = h * (0.2 + Math.random() * 0.6);
        const dir = Math.random() * Math.PI * 2;
        tctx.globalCompositeOperation = 'lighter';
        const n = 40 + power * 110;
        for (let i = 0; i < n; i++) {
          const a = dir + (Math.random() - 0.5) * 2;
          const d = Math.pow(Math.random(), 1.3) * m * (0.12 + power * 0.22);
          stamp(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.3 + Math.pow(Math.random(), 2) * (3 + power * 7), 0.6, 1 + Math.random() * 0.4, a);
        }
        tctx.globalCompositeOperation = 'source-over';
        dirty = true;
        any = true;
      }
    },

    /** How low your blood is (0 fine .. 1 about to pass out): a pulsing red border. */
    setLow(v: number) {
      low = v;
    },

    /** Wipes the blood off the screen (fades out). */
    wipe() {
      if (any) wiping = 1;
    },

    update(dt: number) {
      time += dt;
      hurt = Math.max(0, hurt - dt * 1.4);
      glitch = Math.max(0, glitch - dt * 2.4);
      if (wiping > 0) {
        wiping -= dt / 1.4;
        if (wiping <= 0) {
          wiping = 0;
          tctx.clearRect(0, 0, thick.width, thick.height);
          drips = [];
          any = false;
          dirty = true;
        }
      }
      // Drips run down, slow, and dry up.
      if (drips.length) {
        tctx.globalCompositeOperation = 'lighter';
        for (const d of drips) {
          const step = d.v * dt;
          const steps = Math.max(1, Math.ceil(step / 1.5));
          for (let i = 0; i < steps; i++) {
            d.y += step / steps;
            stamp(d.x + Math.sin(d.y * 0.04 + d.wob) * 1.5, d.y, d.r, 0.16);
          }
          d.v *= Math.pow(0.62, dt);
          d.r *= Math.pow(0.93, dt);
          d.life -= dt;
          // Where it stops, a bead of blood gathers.
          if (d.life <= 0 || d.v <= 6) stamp(d.x + Math.sin(d.y * 0.04 + d.wob) * 1.5, d.y + d.r * 0.3, d.r * 1.35, 0.55);
        }
        drips = drips.filter((d) => d.life > 0 && d.r > 1.5 && d.v > 6 && d.y < h);
        tctx.globalCompositeOperation = 'source-over';
        dirty = true;
      }
      if (dirty) {
        texture.needsUpdate = true;
        dirty = false;
      }
      u.uTime.value = time;
      u.uHurt.value = hurt;
      u.uLow.value = low;
      u.uGlitch.value = glitch;
      u.uFade.value = wiping > 0 ? wiping : 1;
      // Nothing to show: clear once, then skip the work.
      if (!any && hurt === 0 && glitch === 0 && low === 0) {
        if (!idle) renderer.clear();
        idle = true;
        return;
      }
      idle = false;
      pass.render(renderer);
    },

    dispose() {
      renderer.dispose();
      texture.dispose();
      canvas.remove();
    },

    /** Current glitch strength (0..1), for shaking the rest of the screen. */
    get glitch() {
      return glitch;
    },
  };
}
