import * as THREE from 'three';

/**
 * Uniforms shared by every shader in the world. Each material spreads these
 * into its own uniforms, so updating one value here updates them all.
 */
export const shared = {
  uTime: { value: 0 },
  /** Palette offset: collecting orbs shifts the colour of the whole world. */
  uHue: { value: 0 },
  uCamPos: { value: new THREE.Vector3() },
  uPulseOrigin: { value: new THREE.Vector3() },
  uPulseTime: { value: -100 },
};

/**
 * CPU copy of the GLSL `dreamHeight` below. Keep the two in sync: the CPU
 * version stops the camera from sinking into the ground and places objects.
 */
export function dreamHeight(x: number, z: number, t: number): number {
  let h = 0;
  h += Math.sin(x * 0.021 + Math.sin(z * 0.013 + t * 0.05) * 2.0) * 9.0;
  h += Math.cos(z * 0.017 + Math.sin(x * 0.011 - t * 0.04) * 2.5) * 7.0;
  h += Math.sin((x + z) * 0.045 + t * 0.15) * 2.5;
  h += Math.sin(x * 0.09 - z * 0.07 + t * 0.3) * 1.0;
  return h;
}

/** GLSL helpers included at the top of every world shader. */
export const glslCommon = /* glsl */ `
uniform float uTime;
uniform float uHue;
uniform vec3 uCamPos;
uniform vec3 uPulseOrigin;
uniform float uPulseTime;

#define FOG_NEAR 35.0
#define FOG_FAR 160.0
#define BEND 0.0009

// --- 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT) ---
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 3; i++) {
    s += a * snoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

// Cosine palette (Inigo Quilez). uHue rotates every colour in the world at once.
vec3 palette(float t) {
  return vec3(0.5) + vec3(0.5) * cos(6.28318 * (t + uHue + vec3(0.0, 0.33, 0.67)));
}

// Must match dreamHeight() in shared.ts.
float dreamHeight(vec2 p, float t) {
  float h = 0.0;
  h += sin(p.x * 0.021 + sin(p.y * 0.013 + t * 0.05) * 2.0) * 9.0;
  h += cos(p.y * 0.017 + sin(p.x * 0.011 - t * 0.04) * 2.5) * 7.0;
  h += sin((p.x + p.y) * 0.045 + t * 0.15) * 2.5;
  h += sin(p.x * 0.09 - p.y * 0.07 + t * 0.3) * 1.0;
  return h;
}

// Expanding ring of light sent out when an orb is collected.
float pulseWave(vec3 wp) {
  float age = uTime - uPulseTime;
  float r = age * 38.0;
  float d = distance(wp.xz, uPulseOrigin.xz);
  float life = clamp(1.0 - age / 5.0, 0.0, 1.0);
  return exp(-pow((d - r) / 5.0, 2.0)) * life * step(0.0, age);
}

// Curves the world away from the viewer, like standing on a tiny planet.
vec3 bend(vec3 wp) {
  vec2 d = wp.xz - uCamPos.xz;
  wp.y -= dot(d, d) * BEND;
  return wp;
}

vec3 skyBase(vec3 dir) {
  float y = clamp(dir.y, 0.0, 1.0);
  vec3 horizon = palette(0.62 + uTime * 0.003) * 0.2;
  vec3 zenith = palette(0.92 + uTime * 0.003) * 0.025;
  return mix(horizon, zenith, pow(smoothstep(0.0, 0.7, y), 0.6));
}

vec3 applyFog(vec3 col, vec3 wp) {
  vec3 d = wp - uCamPos;
  float f = smoothstep(FOG_NEAR, FOG_FAR, length(d));
  return mix(col, skyBase(normalize(d)), f);
}
`;
