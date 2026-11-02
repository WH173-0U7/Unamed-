import * as THREE from 'three';
import { createFullscreenShader, glslHash } from './fullscreen';

/**
 * The hit effects layer, drawn on the GPU over everything (the TV and the
 * game's buttons and text):
 *
 * - **Blood on the screen.** Each splatter is painted as a "thickness" map:
 *   an irregular main splash, finger-like streaks ending in droplets,
 *   satellite drops, fine mist, and drips that run down over time. A shader
 *   then lights it like wet blood: deep red where thick, thin and bright at
 *   the edges, darker dried rims, and a glossy highlight from the surface
 *   bumps.
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

        // Blood: thickness, smoothed, and its slope (for the light).
        vec2 dx = vec2(uTexel.x, 0.0);
        vec2 dy = vec2(0.0, uTexel.y);
        float t = (T(uv) * 4.0 + T(uv + dx) + T(uv - dx) + T(uv + dy) + T(uv - dy)) / 8.0;
        float gx = (T(uv + dx * 2.0) - T(uv - dx * 2.0)) + 0.5 * (T(uv + dx * 4.0) - T(uv - dx * 4.0));
        float gy = (T(uv + dy * 2.0) - T(uv - dy * 2.0)) + 0.5 * (T(uv + dy * 4.0) - T(uv - dy * 4.0));
        vec3 n = normalize(vec3(-gx * 9.0, -gy * 9.0, 1.0));

        float cover = smoothstep(0.02, 0.14, t);
        // Thin films are bright and see-through; thick pools are near black-red
        // (light passing through blood loses green and blue far faster than red).
        // Fine grain inside the blood (not on its edges) so pools aren't flat.
        float grain = 0.94 + 0.12 * hash(floor(vUv * uRes));
        float depth = smoothstep(0.08, 0.85, t) * grain;
        vec3 col = vec3(0.7, 0.05, 0.05) * exp(-vec3(1.4, 3.0, 2.6) * depth * 1.6);
        // Edges dry first: a darker rim where the thickness changes fast.
        float rim = clamp(length(vec2(gx, gy)) * 5.0, 0.0, 1.0) * smoothstep(0.12, 0.3, t);
        col *= 1.0 - rim * 0.3;
        // Wet gloss: a sharp highlight from a light up and to the left.
        vec3 L = normalize(vec3(-0.45, 0.55, 0.75));
        vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
        float spec = pow(max(dot(n, H), 0.0), 90.0) * smoothstep(0.1, 0.3, t);
        float broad = pow(max(dot(n, H), 0.0), 12.0) * 0.12 * cover;
        float alpha = cover * (0.38 + 0.58 * depth) * uFade;
        vec3 blood = col * alpha + vec3(0.9, 0.35, 0.33) * broad * uFade + vec3(1.0, 0.93, 0.9) * spec * 0.7 * uFade;

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

  /** Paint a soft-edged dot of blood thickness. */
  function dot(x: number, y: number, r: number, a: number) {
    const R = Math.max(0.4, r * k);
    if (R > 1.6) {
      // Bigger drops are domed: thickest in the middle, so they catch the light.
      const g = tctx.createRadialGradient(x * k - R * 0.2, y * k - R * 0.2, 0, x * k, y * k, R);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.7, `rgba(255,255,255,${a * 0.75})`);
      g.addColorStop(1, `rgba(255,255,255,${a * 0.35})`);
      tctx.fillStyle = g;
    } else tctx.fillStyle = `rgba(255,255,255,${a})`;
    tctx.beginPath();
    tctx.arc(x * k, y * k, R, 0, Math.PI * 2);
    tctx.fill();
  }

  /**
   * One splatter at (x, y) in screen points, `size` its main radius, flying
   * in direction `dir` (radians).
   */
  function splat(x: number, y: number, size: number, dir: number, heavy: boolean) {
    const rnd = Math.random;
    const g = (s = 1) => (rnd() + rnd() + rnd() - 1.5) * s; // rough gaussian
    tctx.globalCompositeOperation = 'lighter';

    // 1. The main splash: an irregular blob, thickest in the middle.
    const n = 72;
    const harm = Array.from({ length: 7 }, (_, i) => ({ a: (0.22 / (i + 1)) * (0.5 + rnd()), p: rnd() * 6.28, k: i + 2 }));
    tctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2;
      let r = 1;
      for (const hh of harm) r += hh.a * Math.sin(hh.k * th + hh.p);
      // Bulge towards the direction of travel.
      r *= 1 + 0.35 * Math.max(0, Math.cos(th - dir));
      const px = x + Math.cos(th) * size * r;
      const py = y + Math.sin(th) * size * r;
      if (i) tctx.lineTo(px * k, py * k);
      else tctx.moveTo(px * k, py * k);
    }
    const grd = tctx.createRadialGradient(x * k, y * k, 0, x * k, y * k, size * 1.3 * k);
    grd.addColorStop(0, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.5)');
    grd.addColorStop(0.85, 'rgba(255,255,255,0.28)');
    grd.addColorStop(1, 'rgba(255,255,255,0.2)');
    tctx.fillStyle = grd;
    tctx.fill();

    // 2. Fingers: tapering streaks thrown outward, each ending in a droplet.
    const fingers = Math.round((heavy ? 9 : 5) + rnd() * 7);
    for (let i = 0; i < fingers; i++) {
      const a = dir + g(1.1);
      const len = size * (0.5 + rnd() * (heavy ? 1.9 : 1.2));
      const w0 = size * (0.1 + rnd() * 0.16);
      const sx = x + Math.cos(a) * size * 0.8;
      const sy = y + Math.sin(a) * size * 0.8;
      const ex = sx + Math.cos(a) * len;
      const ey = sy + Math.sin(a) * len;
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      tctx.fillStyle = 'rgba(255,255,255,0.3)';
      tctx.beginPath();
      tctx.moveTo((sx + nx * w0) * k, (sy + ny * w0) * k);
      tctx.quadraticCurveTo(((sx + ex) / 2 + nx * w0 * 0.3) * k, ((sy + ey) / 2 + ny * w0 * 0.3) * k, ex * k, ey * k);
      tctx.quadraticCurveTo(((sx + ex) / 2 - nx * w0 * 0.3) * k, ((sy + ey) / 2 - ny * w0 * 0.3) * k, (sx - nx * w0) * k, (sy - ny * w0) * k);
      tctx.fill();
      dot(ex + Math.cos(a) * w0 * 0.6, ey + Math.sin(a) * w0 * 0.6, w0 * (0.7 + rnd() * 0.7), 0.55);
    }

    // 3. Satellite drops: flung along the same direction, smaller further out,
    //    stretched the faster they flew.
    const drops = Math.round((heavy ? 50 : 25) + rnd() * 30);
    for (let i = 0; i < drops; i++) {
      const a = dir + g(1.3);
      const dist = size * (1.3 + Math.pow(rnd(), 1.6) * (heavy ? 5 : 3.2));
      const r = size * 0.11 * Math.pow(rnd(), 2.2) + 0.6;
      const px = x + Math.cos(a) * dist;
      const py = y + Math.sin(a) * dist;
      const stretch = 1 + (dist / size) * 0.25 * rnd();
      tctx.save();
      tctx.translate(px * k, py * k);
      tctx.rotate(a);
      tctx.scale(stretch, 1);
      tctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.35})`;
      tctx.beginPath();
      tctx.arc(0, 0, Math.max(0.4, r * k), 0, Math.PI * 2);
      tctx.fill();
      tctx.restore();
    }

    // 4. Mist: a fine spray of tiny specks.
    const mist = Math.round((heavy ? 130 : 70) + rnd() * 60);
    for (let i = 0; i < mist; i++) {
      const a = dir + g(1.4);
      const dist = size * (0.8 + Math.pow(rnd(), 1.5) * (heavy ? 5 : 3.5));
      dot(x + Math.cos(a) * dist, y + Math.sin(a) * dist, 0.4 + rnd() * 0.8, 0.18 + rnd() * 0.25);
    }

    // 5. Drips: heavy splashes run down the glass.
    const nd = heavy ? 1 + Math.floor(rnd() * 3) : rnd() < 0.4 ? 1 : 0;
    for (let i = 0; i < nd; i++) {
      drips.push({ x: x + g(size * 0.6), y: y + size * 0.6, v: 40 + rnd() * 70, r: size * (0.07 + rnd() * 0.05) + 1.5, life: 1.5 + rnd() * 3, wob: rnd() * 6 });
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
      const count = hurtYou ? 1 + (power > 0.5 ? 1 : 0) + (severe ? 1 : 0) : amount > 120 ? 1 : 0;
      for (let i = 0; i < count; i++) {
        // On the glass: mostly towards the edges and corners, flying inward.
        const ang = Math.random() * Math.PI * 2;
        const rr = 0.32 + Math.random() * 0.22;
        const x = w / 2 + Math.cos(ang) * w * rr;
        const y = h / 2 + Math.sin(ang) * h * rr;
        const dir = Math.atan2(h / 2 - y, w / 2 - x) + (Math.random() - 0.5) * 1.2;
        const size = m * (hurtYou ? 0.03 + power * 0.035 : 0.018 + power * 0.022);
        splat(x, y, size, dir, hurtYou && power > 0.4);
      }
      if (!hurtYou && amount > 0) {
        // A light spray of their blood even on smaller hits.
        const x = w * (0.2 + Math.random() * 0.6);
        const y = h * (0.2 + Math.random() * 0.6);
        const dir = Math.random() * Math.PI * 2;
        tctx.globalCompositeOperation = 'lighter';
        const n = 30 + power * 90;
        for (let i = 0; i < n; i++) {
          const a = dir + (Math.random() - 0.5) * 2;
          const d = Math.random() * m * (0.08 + power * 0.15);
          dot(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.5 + Math.random() * (1 + power * 2), 0.3 + Math.random() * 0.4);
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
            dot(d.x + Math.sin(d.y * 0.05 + d.wob) * 1.2, d.y, d.r, 0.32);
          }
          d.v *= Math.pow(0.55, dt);
          d.r *= Math.pow(0.9, dt);
          d.life -= dt;
        }
        drips = drips.filter((d) => d.life > 0 && d.r > 1 && d.v > 4 && d.y < h);
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
