/**
 * The cave: an endless, procedurally generated network of chambers and
 * tunnels, like the inside of a nervous system.
 *
 * The world is divided into square cells. Each cell holds one chamber (a
 * "nerve cell") at a random spot, with a random size. Chambers are joined by
 * tunnels:
 * - every chamber links to its right or lower neighbour (chosen at random),
 *   which guarantees the whole network is connected;
 * - some get extra links (right, down, diagonal), making loops;
 * - each chamber also grows two thin dead-end branches ("dendrites").
 * The shapes are then warped by noise so nothing looks straight or regular.
 *
 * `caveDistance` returns how far a point is from open space: negative inside
 * tunnels and chambers, positive inside rock. The exact same maths runs on
 * the GPU (to draw the cave) and here on the CPU (so the Whisp can't pass
 * through walls). Keep `caveDistance` and `glslCave` in sync.
 */

/** Size of one cell of the network, in world points. */
export const CELL = 560;

// ---------- Hash and noise (identical to the GLSL in fx/fullscreen.ts) ----------

function pcg(v: number): number {
  const state = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
}
const U32 = 4294967295;
const cellU = (v: number) => (Math.floor(v) + 65536) >>> 0;

function hash2(x: number, y: number): number {
  return pcg((cellU(x) + pcg(cellU(y))) >>> 0) / U32;
}
function hashS(x: number, y: number, seed: number): number {
  const s = (Math.floor(seed) % 16777216 + 16777216) % 16777216;
  return pcg((cellU(x) + pcg((cellU(y) + pcg(s)) >>> 0)) >>> 0) / U32;
}
function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// ---------- The network ----------

function nodeX(cx: number, cy: number) {
  return (cx + 0.5 + (hashS(cx, cy, 1) - 0.5) * 0.6) * CELL;
}
function nodeY(cx: number, cy: number) {
  return (cy + 0.5 + (hashS(cx, cy, 2) - 0.5) * 0.6) * CELL;
}
function nodeR(cx: number, cy: number) {
  const h = hashS(cx, cy, 3);
  return hashS(cx, cy, 4) > 0.86 ? 140 + 70 * hashS(cx, cy, 5) : 38 + 80 * h * h;
}
function seg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const t = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * t, pay - bay * t);
}

/** Distance to open space before roughness and breathing (smooth part). */
export function baseDistance(px: number, py: number): number {
  const qx = px + (vnoise(px * 0.006, py * 0.006) - 0.5) * 90;
  const qy = py + (vnoise(px * 0.006 + 19, py * 0.006 + 19) - 0.5) * 90;
  const c0x = Math.floor(qx / CELL);
  const c0y = Math.floor(qy / CELL);
  let d = 1e5;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = c0x + i;
      const cy = c0y + j;
      const ax = nodeX(cx, cy);
      const ay = nodeY(cx, cy);
      const r = nodeR(cx, cy);
      d = Math.min(d, Math.hypot(qx - ax, qy - ay) - r);
      const right = hashS(cx, cy, 10) < 0.5;
      if (right || hashS(cx, cy, 11) < 0.3)
        d = Math.min(d, seg(qx, qy, ax, ay, nodeX(cx + 1, cy), nodeY(cx + 1, cy)) - (16 + 22 * hashS(cx, cy, 20)));
      if (!right || hashS(cx, cy, 12) < 0.3)
        d = Math.min(d, seg(qx, qy, ax, ay, nodeX(cx, cy + 1), nodeY(cx, cy + 1)) - (16 + 22 * hashS(cx, cy, 21)));
      if (hashS(cx, cy, 13) < 0.15)
        d = Math.min(d, seg(qx, qy, ax, ay, nodeX(cx + 1, cy + 1), nodeY(cx + 1, cy + 1)) - (14 + 16 * hashS(cx, cy, 22)));
      if (hashS(cx, cy, 14) < 0.12)
        d = Math.min(d, seg(qx, qy, ax, ay, nodeX(cx + 1, cy - 1), nodeY(cx + 1, cy - 1)) - (14 + 16 * hashS(cx, cy, 23)));
      for (let k = 0; k < 2; k++) {
        const ang = hashS(cx, cy, 30 + k) * 6.2832;
        const len = r + 110 + 160 * hashS(cx, cy, 32 + k);
        d = Math.min(d, seg(qx, qy, ax, ay, ax + Math.cos(ang) * len, ay + Math.sin(ang) * len) - (10 + 8 * hashS(cx, cy, 34 + k)));
      }
    }
  }
  return d;
}

/** Fine detail added on top: rough edges, and the walls breathing in waves. */
function detail(px: number, py: number, t: number): number {
  return (vnoise(px * 0.05, py * 0.05) - 0.5) * 10 - Math.sin(t * 0.9 + (px + py) * 0.002) * 4;
}

/** Negative = open space, positive = rock. Roughly the distance in points. */
export function caveDistance(px: number, py: number, t: number): number {
  return baseDistance(px, py) + detail(px, py, t);
}

/** Centre of the chamber in a given cell. */
export function chamberCentre(cx: number, cy: number) {
  return { x: nodeX(cx, cy), y: nodeY(cx, cy) };
}

/** Where a new game begins: open space in the chamber nearest the world origin. */
export function startPoint() {
  const c = chamberCentre(0, 0);
  return nearestOpen(c.x, c.y, 20, 0);
}

/**
 * Moves a point out of the rock into open space with at least `radius` of
 * clearance, sliding along the wall. Returns the corrected point.
 */
export function pushOut(x: number, y: number, radius: number, t: number) {
  for (let i = 0; i < 10; i++) {
    const d = caveDistance(x, y, t) + radius;
    if (d <= 0) return { x, y, ok: true };
    const e = 1.5;
    const gx = caveDistance(x + e, y, t) - caveDistance(x - e, y, t);
    const gy = caveDistance(x, y + e, t) - caveDistance(x, y - e, t);
    const g = Math.hypot(gx, gy) || 1;
    x -= (gx / g) * (d + 0.5);
    y -= (gy / g) * (d + 0.5);
  }
  return { x, y, ok: caveDistance(x, y, t) + radius <= 0 };
}

/** Is there open space here, with `radius` of clearance? */
export function isOpen(x: number, y: number, radius: number, t: number) {
  return caveDistance(x, y, t) + radius <= 0;
}

/** Finds open space for something lost inside rock (e.g. an old save). */
export function nearestOpen(x: number, y: number, radius: number, t: number) {
  const p = pushOut(x, y, radius, t);
  if (isOpen(p.x, p.y, radius, t)) return p;
  // Still stuck: search outwards in rings until open space turns up.
  for (let r = 10; r < CELL; r += 10) {
    for (let a = 0; a < 16; a++) {
      const qx = x + Math.cos((a / 16) * Math.PI * 2) * r;
      const qy = y + Math.sin((a / 16) * Math.PI * 2) * r;
      if (isOpen(qx, qy, radius, t)) return pushOut(qx, qy, radius + 4, t);
    }
  }
  return { x, y };
}

/** GLSL for the GPU. Needs `glslHash` included before it. */
export const glslCave = /* glsl */ `
  #define CELL ${CELL.toFixed(1)}

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  vec2 nodePos(vec2 c) {
    return (c + 0.5 + (vec2(hash(c, 1.0), hash(c, 2.0)) - 0.5) * 0.6) * CELL;
  }
  float nodeR(vec2 c) {
    float h = hash(c, 3.0);
    return hash(c, 4.0) > 0.86 ? 140.0 + 70.0 * hash(c, 5.0) : 38.0 + 80.0 * h * h;
  }
  float seg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * t);
  }

  float caveBase(vec2 p) {
    vec2 q = p + (vec2(vnoise(p * 0.006), vnoise(p * 0.006 + 19.0)) - 0.5) * 90.0;
    vec2 c0 = floor(q / CELL);
    float d = 1e5;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 c = c0 + vec2(float(i), float(j));
        vec2 a = nodePos(c);
        float r = nodeR(c);
        d = min(d, length(q - a) - r);
        bool right = hash(c, 10.0) < 0.5;
        if (right || hash(c, 11.0) < 0.3) d = min(d, seg(q, a, nodePos(c + vec2(1.0, 0.0))) - (16.0 + 22.0 * hash(c, 20.0)));
        if (!right || hash(c, 12.0) < 0.3) d = min(d, seg(q, a, nodePos(c + vec2(0.0, 1.0))) - (16.0 + 22.0 * hash(c, 21.0)));
        if (hash(c, 13.0) < 0.15) d = min(d, seg(q, a, nodePos(c + vec2(1.0, 1.0))) - (14.0 + 16.0 * hash(c, 22.0)));
        if (hash(c, 14.0) < 0.12) d = min(d, seg(q, a, nodePos(c + vec2(1.0, -1.0))) - (14.0 + 16.0 * hash(c, 23.0)));
        for (int k = 0; k < 2; k++) {
          float fk = float(k);
          float ang = hash(c, 30.0 + fk) * 6.2832;
          float len = r + 110.0 + 160.0 * hash(c, 32.0 + fk);
          d = min(d, seg(q, a, a + vec2(cos(ang), sin(ang)) * len) - (10.0 + 8.0 * hash(c, 34.0 + fk)));
        }
      }
    }
    return d;
  }

  float caveDetail(vec2 p, float t) {
    return (vnoise(p * 0.05) - 0.5) * 10.0 - sin(t * 0.9 + (p.x + p.y) * 0.002) * 4.0;
  }
`;
