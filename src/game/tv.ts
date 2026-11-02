import * as THREE from 'three';
import { createFullscreenShader, glslHash } from '../fx/fullscreen';

/**
 * An old CRT television filling the screen. Powering on plays the classic
 * sequence: a spark in the centre, a bright horizontal line, the picture
 * snapping open, a burst of static, then a dark, softly glowing empty screen.
 */
export function createTv(renderer: THREE.WebGLRenderer) {
  const pass = createFullscreenShader(
    /* glsl */ `
      uniform float uT;      // seconds since power on; negative = off
      uniform float uTime;   // always running
      uniform vec2 uRes;     // canvas size in pixels
      uniform float uLines;  // scanline count
      varying vec2 vUv;
      ${glslHash}

      float easeOutBack(float x) {
        float c1 = 1.70158;
        float c3 = c1 + 1.0;
        float y = x - 1.0; // (pow() of a negative number is undefined in GLSL)
        return 1.0 + c3 * y * y * y + c1 * y * y;
      }

      // Curved glass: pushes the picture outwards towards the corners.
      vec2 barrel(vec2 uv) {
        vec2 c = uv * 2.0 - 1.0;
        vec2 o = abs(c.yx) / vec2(5.5, 4.5);
        c += c * o * o;
        return c * 0.5 + 0.5;
      }

      // Brightness of the tube at a point, at time t after power on.
      float tube(vec2 uv, float t) {
        vec2 c = uv - 0.5;
        float aspect = uRes.x / uRes.y;
        float px = 1.0 / uRes.y;

        // 1. Spark: a pinpoint in the centre.
        float sparkOn = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.2, 0.45, t));
        float spark = exp(-length(c * vec2(aspect, 1.0)) * 70.0) * 4.0 * sparkOn;

        // 2. Line: stretches out sideways.  3. Open: snaps open vertically.
        float w = smoothstep(0.1, 0.38, t);
        float openK = clamp((t - 0.42) / 0.38, 0.0, 1.0);
        float h = max(mix(px * 2.5, 1.0, easeOutBack(openK)), px * 2.5);
        float hw = 0.5 * w;
        float hh = 0.5 * h;
        float inX = 1.0 - smoothstep(hw - 0.006, hw + 0.002, abs(c.x));
        float inY = 1.0 - smoothstep(hh - px * 1.5, hh + px * 1.5, abs(c.y));
        float inside = inX * inY;

        // The thin line is white-hot; brightness drains as the picture opens.
        float flash = mix(5.0, 0.0, smoothstep(0.42, 0.95, t));
        float halo = exp(-max(abs(c.y) - hh, 0.0) * 45.0) * exp(-max(abs(c.x) - hw, 0.0) * 25.0) * flash * 0.18;

        // 4. Static: a storm of snow that dies down, leaving a faint shimmer.
        float snowAmt = smoothstep(0.55, 0.75, t) * (1.0 - smoothstep(0.85, 2.8, t)) * 0.85 + 0.03;
        // Analog noise is smeared sideways along each scanline, not square.
        float frame = floor(uTime * 30.0);
        float rowS = floor(uv.y * uLines * 2.0);
        float xs = uv.x * uRes.x / 2.5;
        float n0 = hash(vec2(floor(xs), rowS), frame);
        float n1 = hash(vec2(floor(xs) + 1.0, rowS), frame);
        float snow = mix(n0, n1, smoothstep(0.0, 1.0, fract(xs)));
        snow = pow(snow, 1.6) * 1.35;

        // 5. Empty screen: the dark glow of a tube showing nothing.
        float glow = 0.05 + 0.035 * (1.0 - smoothstep(0.0, 0.7, length(c * vec2(aspect * 0.8, 1.0))));
        float bar = exp(-pow((fract(uv.y * 0.7 - uTime * 0.07) - 0.5) / 0.1, 2.0)) * 0.03;

        return (glow + snow * snowAmt + bar + flash) * inside + spark + halo;
      }

      void main() {
        if (uT < 0.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }
        float t = uT;
        vec2 uv = barrel(vUv);
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        // Losing horizontal sync while warming up: rows jump sideways.
        float shake = smoothstep(0.6, 0.8, t) * (1.0 - smoothstep(0.9, 2.2, t));
        float row = floor(uv.y * uLines);
        uv.x += (hash(vec2(row, 0.0), floor(uTime * 30.0)) - 0.5) * 0.025 * shake;
        // Degauss: the tube's magnetic field settles, warping the picture and
        // washing it with drifting rainbow blotches.
        float degauss = smoothstep(0.75, 0.95, t) * (1.0 - smoothstep(1.1, 2.6, t));
        uv.x += sin(uv.y * 18.0 + t * 35.0) * 0.004 * degauss;
        // A brief vertical roll as the picture locks in.
        uv.y = fract(uv.y + (1.0 - smoothstep(0.75, 1.6, t)) * step(0.75, t) * 0.25);

        // Colour fringing: wide while unstable, settling to a hint.
        float ca = 0.0012 + 0.014 * smoothstep(0.35, 0.6, t) * (1.0 - smoothstep(0.8, 2.6, t));
        vec3 col = vec3(tube(uv + vec2(ca, 0.0), t), tube(uv, t), tube(uv - vec2(ca, 0.0), t));
        float field = sin(uv.x * 5.0 + t * 2.3) + sin(uv.y * 4.0 - t * 1.7) + sin((uv.x + uv.y) * 3.0 + t * 3.1);
        col += (0.5 + 0.5 * cos(6.28318 * (field * 0.25 + vec3(0.0, 0.33, 0.67)))) * degauss * 0.3;
        col *= vec3(0.9, 1.0, 1.1); // cool phosphor tint
        col = 1.0 - exp(-col * 1.6);   // soft highlight roll-off, like an overdriven tube

        // Scanlines and the phosphor mask.
        col *= 0.78 + 0.22 * sin(uv.y * uLines * 6.28318);
        float m = mod(gl_FragCoord.x, 3.0);
        col *= 0.92 + 0.08 * vec3(step(m, 1.0), step(1.0, m) * step(m, 2.0), step(2.0, m));

        // Glass: the picture falls off into the bezel at the curved edges.
        vec2 e = smoothstep(0.0, 0.035, uv) * smoothstep(0.0, 0.035, 1.0 - uv);
        col *= pow(e.x * e.y, 0.7);
        vec2 v = vUv - 0.5;
        col *= 1.0 - dot(v, v) * 0.9;
        // Mains hum and power-supply sag: tiny flicker and a slow breath.
        col *= (0.97 + 0.03 * noise1(uTime * 22.0)) * (0.985 + 0.015 * sin(uTime * 0.7));
        // The tube's own light catching the curved glass: a soft reflection.
        float lit = smoothstep(0.4, 1.2, t);
        float refl = 1.0 - smoothstep(0.0, 0.5, length((vUv - vec2(0.27, 0.8)) * vec2(1.0, 1.8)));
        col += vec3(0.85, 0.9, 1.0) * refl * refl * 0.035 * lit;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    {
      uT: { value: -1 },
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uLines: { value: 240 },
    },
  );

  let time = 0;
  let onAt: number | null = null;
  /** Debug: freeze the sequence at a given moment. */
  let frozen: number | null = null;

  return {
    get isOn() {
      return onAt !== null;
    },
    /** Seconds since power on (or -1 while off). */
    get elapsed() {
      return frozen ?? (onAt === null ? -1 : time - onAt);
    },
    powerOn() {
      onAt = time;
    },
    powerOff() {
      onAt = null;
    },
    freeze(t: number | null) {
      frozen = t;
    },
    setSize(width: number, height: number) {
      pass.material.uniforms.uRes.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
      // One scanline every 3 screen points.
      pass.material.uniforms.uLines.value = Math.round(height / 3);
    },
    update(dt: number) {
      time += dt;
      pass.material.uniforms.uTime.value = time;
      pass.material.uniforms.uT.value = this.elapsed;
      pass.render(renderer);
    },
  };
}
