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
      uniform vec2 uRes;
      varying vec2 vUv;
      ${glslHash}

      void main() {
        vec2 uv = vUv;
        vec2 px = uv * uRes;
        // Film runs at 24 frames per second: grain and dust change per frame.
        float frame = floor(uTime * 24.0);

        // Grain: grey speckles that both lighten and darken.
        float g = hash(floor(px / 1.5) + frame * vec2(1013.0, 7919.0));
        vec3 col = vec3(g);
        float a = 0.13;

        // Dust: rare specks, some bright, some dark.
        vec2 dustCell = floor(px / 3.0);
        float d = hash(dustCell + frame * vec2(4099.0, 211.0));
        if (d > 0.9993) {
          col = vec3(step(0.5, hash(dustCell + frame * 31.0)));
          a = 0.55;
        }

        // Scratch: a thin vertical line that wanders, now and then.
        float sc = hash1(floor(uTime * 3.0));
        if (sc > 0.55) {
          float x = hash1(floor(uTime * 3.0) + 7.0) + sin(uTime * 2.0) * 0.01;
          float line = 1.0 - smoothstep(0.0, 1.2, abs(px.x - x * uRes.x));
          col = mix(col, vec3(0.9), line);
          a = mix(a, 0.35, line);
        }

        // Glitch bands: torn rows of red/cyan noise during glitch bursts.
        float row = floor(uv.y * 38.0 + floor(uTime * 15.0) * 3.0);
        float band = step(1.0 - uGlitch * 0.22, hash1(row));
        if (band > 0.0) {
          float streak = hash(vec2(floor(px.x / (8.0 + 30.0 * hash1(row))), row * 97.0 + frame));
          col = vec3(streak * 1.2, 0.15, 0.25);
          if (hash1(row + 3.0) > 0.5) col = vec3(0.1, streak, streak * 1.1);
          a = 0.35 * uGlitch;
        }

        // Vignette and flicker: darken the edges and pulse slightly.
        vec2 c = uv - 0.5;
        c.x *= uRes.x / uRes.y;
        float vig = smoothstep(0.6, 1.3, length(c));
        float flicker = 0.05 * noise1(uTime * 18.0) + uGlitch * 0.12 * hash1(frame);
        float dark = clamp(vig * 0.85 + flicker, 0.0, 1.0);
        // Darkness goes over the grain: blend black on top.
        col = col * a * (1.0 - dark);
        a = a + dark * (1.0 - a);
        gl_FragColor = vec4(col, a);
      }
    `,
    {
      uTime: { value: 0 },
      uGlitch: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
    },
  );

  const root = document.documentElement;
  const title = container.querySelector<HTMLElement>('.title');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let time = 0;
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
      root.style.setProperty('--ca', `${ca.toFixed(2)}px`);
      root.style.setProperty('--jx', bursting ? `${rand(-5, 5).toFixed(1)}px` : '0px');
      root.style.setProperty('--skew', bursting ? `${rand(-2, 2).toFixed(2)}deg` : '0deg');
      setSlice(1, bursting && Math.random() < 0.8);
      setSlice(2, bursting && Math.random() < 0.6);

      pass.material.uniforms.uTime.value = time;
      pass.material.uniforms.uGlitch.value = glitch;
      pass.render(renderer);
    },
  };
}
