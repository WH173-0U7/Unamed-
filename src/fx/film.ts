import * as THREE from 'three';
import { createFullscreenShader, glslHash } from './fullscreen';

/**
 * Old-film look for the menus.
 *
 * - A transparent GPU layer on top of the menu draws grain, flicker, dust,
 *   scratches, vignette and torn glitch bands.
 * - The menu text itself gets chromatic aberration (red / cyan fringes) and
 *   sliced glitches through CSS variables driven from here, since browser
 *   text can't be fed through a shader directly.
 */
export function createFilm(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.id = 'film';
  container.appendChild(renderer.domElement);

  const pass = createFullscreenShader(
    /* glsl */ `
      uniform float uTime;
      uniform float uGlitch;
      uniform vec2 uRes;     // canvas size in device pixels
      uniform float uScale;  // device pixels per screen point
      varying vec2 vUv;
      ${glslHash}

      // Soft round speck of radius r (in points) at a random spot inside a cell.
      float speck(vec2 p, vec2 cell, float cellSize, float seed, out float tone) {
        vec2 o = vec2(hash(cell, seed + 1.0), hash(cell, seed + 2.0)) * cellSize;
        float r = mix(0.5, 2.4, pow(hash(cell, seed + 3.0), 2.0));
        tone = step(0.7, hash(cell, seed + 4.0)); // mostly dark, some bright
        return 1.0 - smoothstep(r * 0.4, r, length(p - (cell * cellSize + o)));
      }

      void main() {
        vec2 p = vUv * uRes / uScale;      // position in screen points
        vec2 res = uRes / uScale;
        float frame = floor(uTime * 24.0); // film runs at 24 frames per second

        // Grain: three samples averaged (bell-shaped, like silver grain) plus
        // a coarser clump layer. Lightens and darkens around mid-grey.
        float fine = (hash(p, frame * 3.0) + hash(p, frame * 3.0 + 1.0) + hash(p, frame * 3.0 + 2.0)) / 3.0;
        float clump = hash(p / 2.5, frame + 7.0);
        float g = mix(fine, clump, 0.3) - 0.5;
        float a = abs(g) * 0.42;
        vec3 col = vec3(step(0.0, g));

        // Dust: soft specks of different sizes, a different handful every frame.
        float cellSize = 26.0;
        vec2 cell = floor(p / cellSize);
        if (hash(cell, frame * 5.0) > 0.9965) {
          float tone;
          float d = speck(p, cell, cellSize, frame * 5.0, tone);
          col = mix(col, vec3(tone), d);
          a = mix(a, 0.75, d);
        }

        // Hair: a curled fibre caught in the gate for a single frame, rarely.
        if (hash1(frame * 13.0) > 0.975) {
          vec2 c0 = vec2(hash1(frame * 13.0 + 1.0), hash1(frame * 13.0 + 2.0)) * res;
          float len = 25.0 + 60.0 * hash1(frame * 13.0 + 3.0);
          vec2 q = p - c0;
          float dev = sin(q.y * 0.07 + hash1(frame) * 6.0) * 7.0 + q.y * q.y * 0.002;
          float hair = (1.0 - smoothstep(0.35, 1.0, abs(q.x - dev))) * step(abs(q.y), len * 0.5);
          col = mix(col, vec3(0.0), hair);
          a = mix(a, 0.8, hair);
        }

        // Scratches: long vertical lines that stay for a few seconds and wander.
        for (int i = 0; i < 2; i++) {
          float fi = float(i);
          float era = floor(uTime * 0.4 + fi * 0.5);
          if (hash1(era * 7.0 + fi * 101.0) > 0.45) {
            float x = hash1(era * 7.0 + fi * 101.0 + 1.0) * res.x
              + sin(uTime * (1.3 + fi)) * 3.0 + (hash1(frame + fi * 9.0) - 0.5) * 0.8;
            float flick = step(0.15, hash1(frame * 3.0 + fi)); // drops out now and then
            float line = (1.0 - smoothstep(0.3, 0.9, abs(p.x - x))) * flick;
            col = mix(col, vec3(0.85), line);
            a = mix(a, 0.28, line);
          }
        }

        // Glitch bands: torn rows of red / cyan streaks during bursts.
        float row = floor(vUv.y * 38.0);
        float tear = floor(uTime * 15.0);
        if (hash(vec2(row, 0.0), tear) > 1.0 - uGlitch * 0.22) {
          float w = 8.0 + 30.0 * hash(vec2(row, 1.0), tear);
          float streak = hash(vec2(floor(p.x / w), row), frame);
          col = hash(vec2(row, 2.0), tear) > 0.5 ? vec3(streak * 1.2, 0.12, 0.22) : vec3(0.08, streak, streak * 1.1);
          a = 0.35 * uGlitch;
        }

        // Lens vignette and exposure flicker: darken the edges, pulse slightly.
        vec2 c = vUv - 0.5;
        c.x *= uRes.x / uRes.y;
        float vig = smoothstep(0.55, 1.3, length(c));
        float flicker = 0.045 * noise1(uTime * 14.0) + uGlitch * 0.1 * hash1(frame);
        float dark = clamp(vig * 0.8 + flicker, 0.0, 1.0);
        col *= a * (1.0 - dark);
        a = a + dark * (1.0 - a);
        gl_FragColor = vec4(col, a);
      }
    `,
    {
      uTime: { value: 0 },
      uGlitch: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uScale: { value: 1 },
    },
  );

  // The menu's own variables (only its text uses them): setting them on the
  // whole document restyled everything every frame.
  const root = container;
  const last: Record<string, string> = {};
  const setVar = (k: string, v: string) => {
    if (last[k] === v) return;
    last[k] = v;
    root.style.setProperty(k, v);
  };
  const title = container.querySelector<HTMLElement>('.title');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let time = 0;
  let filmFrame = -1;
  let weave = 0;
  let glitch = 0;
  let burstEnd = 0;
  let burstPower = 0;
  let nextBurst = 1.5;
  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  function setSize(pixelRatio: number) {
    // Grain looks right at roughly one speck per screen point; no need for more.
    const pr = Math.min(pixelRatio, 1.5);
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth, innerHeight);
    pass.material.uniforms.uRes.value.set(innerWidth * pr, innerHeight * pr);
    pass.material.uniforms.uScale.value = pr;
  }

  function setSlice(n: number, on: boolean) {
    if (!title) return;
    if (!on) {
      title.style.setProperty(`--s${n}-h`, '0%');
      return;
    }
    title.style.setProperty(`--s${n}-t`, `${rand(0, 85).toFixed(1)}%`);
    title.style.setProperty(`--s${n}-h`, `${rand(4, 22).toFixed(1)}%`);
    title.style.setProperty(`--s${n}-x`, `${rand(-14, 14).toFixed(1)}px`);
  }

  return {
    setSize,
    /** Call every frame while the menu is visible. */
    update(dt: number) {
      time += dt;

      // Random glitch bursts every few seconds.
      if (!reduceMotion && time > nextBurst) {
        burstPower = rand(0.4, 1);
        burstEnd = time + rand(0.08, 0.35);
        nextBurst = time + rand(1.8, 6);
      }
      const bursting = time < burstEnd;
      glitch = bursting ? burstPower * rand(0.5, 1) : glitch * Math.exp(-dt * 18);

      // Chromatic aberration on the menu text: always a little, a lot in bursts.
      const ca = 0.9 + 0.35 * Math.sin(time * 2.3) + glitch * rand(3, 7);
      setVar('--ca', `${ca.toFixed(1)}px`);
      setVar('--jx', bursting ? `${rand(-5, 5).toFixed(1)}px` : '0px');
      // Gate weave: the projected frame drifts a fraction of a point, once per film frame.
      const f = Math.floor(time * 24);
      if (f !== filmFrame && !reduceMotion) {
        filmFrame = f;
        weave = weave * 0.6 + rand(-0.5, 0.5);
        setVar('--gy', `${(bursting && Math.random() < 0.3 ? rand(-6, 6) : weave).toFixed(2)}px`);
      }
      setVar('--skew', bursting ? `${rand(-2, 2).toFixed(2)}deg` : '0deg');
      setSlice(1, bursting && Math.random() < 0.8);
      setSlice(2, bursting && Math.random() < 0.6);

      pass.material.uniforms.uTime.value = time;
      pass.material.uniforms.uGlitch.value = glitch;
      pass.render(renderer);
    },
  };
}
