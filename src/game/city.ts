/**
 * The city: an endless, procedurally generated grid of streets and blocks.
 *
 * The map is made of square tiles. A street runs along every BLOCK-th row and
 * column, so the city is a grid of blocks. Inside each block, a random choice
 * (the same every time) decides what's there:
 * - mostly buildings,
 * - sometimes an alley cutting through the middle,
 * - sometimes an open lot you can walk across.
 * Streets, alleys and lots can be walked on; buildings can't.
 */

/** A street every this many tiles: blocks are (BLOCK - 1) tiles across. */
export const BLOCK = 6;

function pcg(v: number): number {
  const state = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
}
const u = (v: number) => (v + 65536) >>> 0;
/** Random 0..1 for a block, the same every time. */
function blockRandom(bx: number, by: number, seed: number): number {
  return pcg((u(bx) + pcg((u(by) + pcg(seed)) >>> 0)) >>> 0) / 4294967295;
}
const mod = (a: number, n: number) => ((a % n) + n) % n;

export type BlockKind = 'buildings' | 'lot' | 'alley-ns' | 'alley-ew';

export function blockKind(bx: number, by: number): BlockKind {
  const h = blockRandom(bx, by, 1);
  if (h < 0.1) return 'lot';
  if (h < 0.22) return 'alley-ns';
  if (h < 0.34) return 'alley-ew';
  return 'buildings';
}

export type Tile = 'street' | 'alley' | 'lot' | 'building';

export function tileAt(x: number, y: number): Tile {
  const lx = mod(x, BLOCK);
  const ly = mod(y, BLOCK);
  if (lx === 0 || ly === 0) return 'street';
  const kind = blockKind(Math.floor(x / BLOCK), Math.floor(y / BLOCK));
  const mid = BLOCK / 2;
  if (kind === 'lot') return 'lot';
  if (kind === 'alley-ns' && lx === mid) return 'alley';
  if (kind === 'alley-ew' && ly === mid) return 'alley';
  return 'building';
}

export function isWalkable(x: number, y: number): boolean {
  return tileAt(x, y) !== 'building';
}

// ---------- Buildings inside each block ----------

/** A small box on a roof: an air-conditioning unit, vent or stair housing. */
export interface RoofThing {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One building (or an open courtyard) inside a block. Units are map squares. */
export interface Building {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** An open courtyard enclosed by the buildings around it (can't be entered). */
  courtyard: boolean;
  /** Roof brightness 0..1 and how tall it is (casts a longer shadow). */
  shade: number;
  height: number;
  /** Rows of skylights on the roof (0 = none). */
  skylights: number;
  roofThings: RoofThing[];
  /** The street or alley square in front of its door: where you stand to visit. */
  door: { x: number; y: number } | null;
  /** Which side the door is on (for drawing it). */
  doorSide: 'top' | 'bottom' | 'left' | 'right' | null;
}

export interface Tree {
  x: number;
  y: number;
  r: number;
}

export interface BlockLayout {
  kind: BlockKind;
  buildings: Building[];
  trees: Tree[];
}

/** A tiny repeatable random sequence for one block. */
function blockRng(bx: number, by: number) {
  let n = 100;
  return () => blockRandom(bx, by, n++);
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Cuts a region into building plots, like real city lots: split along the
 * longer side at a random point (on half-square steps) until plots are a
 * natural size.
 */
function subdivide(r: Rect, rnd: () => number, depth: number, out: Rect[]) {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const big = Math.max(w, h);
  if (depth >= 4 || big < 2 || (depth >= 2 && rnd() < 0.25)) {
    out.push(r);
    return;
  }
  const alongX = w > h || (w === h && rnd() < 0.5);
  const len = alongX ? w : h;
  const steps = Math.floor((len - 2) * 2); // cut positions leaving >= 1 square each side
  if (steps < 0) {
    out.push(r);
    return;
  }
  const cut = 1 + Math.floor(rnd() * (steps + 1)) * 0.5;
  if (alongX) {
    subdivide({ ...r, x1: r.x0 + cut }, rnd, depth + 1, out);
    subdivide({ ...r, x0: r.x0 + cut }, rnd, depth + 1, out);
  } else {
    subdivide({ ...r, y1: r.y0 + cut }, rnd, depth + 1, out);
    subdivide({ ...r, y0: r.y0 + cut }, rnd, depth + 1, out);
  }
}

const layoutCache = new Map<string, BlockLayout>();

/** The buildings, courtyards and trees in a block (always the same for that block). */
export function blockLayout(bx: number, by: number): BlockLayout {
  const key = `${bx},${by}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;
  if (layoutCache.size > 3000) layoutCache.clear();

  const kind = blockKind(bx, by);
  const rnd = blockRng(bx, by);
  const ox = bx * BLOCK + 1;
  const oy = by * BLOCK + 1;
  const n = BLOCK - 1; // squares across the inside of a block
  const mid = BLOCK / 2 - 1; // alley position inside the block
  const layout: BlockLayout = { kind, buildings: [], trees: [] };

  if (kind === 'lot') {
    // A small park: trees scattered over the open ground.
    const count = 3 + Math.floor(rnd() * 5);
    for (let i = 0; i < count; i++) {
      layout.trees.push({ x: ox + 0.5 + rnd() * (n - 1), y: oy + 0.5 + rnd() * (n - 1), r: 0.35 + rnd() * 0.35 });
    }
    layoutCache.set(key, layout);
    return layout;
  }

  // Regions to fill with buildings (two halves if an alley cuts through).
  const regions: Rect[] =
    kind === 'alley-ns'
      ? [
          { x0: ox, y0: oy, x1: ox + mid, y1: oy + n },
          { x0: ox + mid + 1, y0: oy, x1: ox + n, y1: oy + n },
        ]
      : kind === 'alley-ew'
        ? [
            { x0: ox, y0: oy, x1: ox + n, y1: oy + mid },
            { x0: ox, y0: oy + mid + 1, x1: ox + n, y1: oy + n },
          ]
        : [{ x0: ox, y0: oy, x1: ox + n, y1: oy + n }];

  for (const region of regions) {
    const plots: Rect[] = [];
    subdivide(region, rnd, 0, plots);
    for (const p of plots) {
      // Which edges of this plot face the street or alley around its region?
      const sides: { side: Building['doorSide']; len: number }[] = [];
      if (p.y0 === region.y0) sides.push({ side: 'top', len: p.x1 - p.x0 });
      if (p.y1 === region.y1) sides.push({ side: 'bottom', len: p.x1 - p.x0 });
      if (p.x0 === region.x0) sides.push({ side: 'left', len: p.y1 - p.y0 });
      if (p.x1 === region.x1) sides.push({ side: 'right', len: p.y1 - p.y0 });
      const courtyard = sides.length === 0;
      // The door goes on the longest street-facing side, at its middle.
      sides.sort((a, b) => b.len - a.len);
      const side = sides[0]?.side ?? null;
      const midX = Math.floor((p.x0 + p.x1) / 2 - 0.01);
      const midY = Math.floor((p.y0 + p.y1) / 2 - 0.01);
      const door =
        side === 'top'
          ? { x: midX, y: p.y0 - 1 }
          : side === 'bottom'
            ? { x: midX, y: p.y1 }
            : side === 'left'
              ? { x: p.x0 - 1, y: midY }
              : side === 'right'
                ? { x: p.x1, y: midY }
                : null;
      const w = p.x1 - p.x0;
      const h = p.y1 - p.y0;
      const things: RoofThing[] = [];
      const count = courtyard ? 0 : Math.floor(rnd() * Math.min(4, w * h * 0.6));
      for (let i = 0; i < count; i++) {
        const tw = 0.25 + rnd() * 0.35;
        const th = 0.25 + rnd() * 0.35;
        things.push({ x: p.x0 + 0.2 + rnd() * Math.max(0, w - tw - 0.4), y: p.y0 + 0.2 + rnd() * Math.max(0, h - th - 0.4), w: tw, h: th });
      }
      layout.buildings.push({
        id: `${bx},${by},${layout.buildings.length}`,
        ...p,
        courtyard,
        shade: rnd(),
        height: rnd(),
        skylights: !courtyard && w * h >= 4 && rnd() < 0.3 ? 2 + Math.floor(rnd() * 3) : 0,
        roofThings: things,
        door,
        doorSide: side,
      });
    }
  }
  layoutCache.set(key, layout);
  return layout;
}

/** The building at a point on the map (in squares, fractions allowed), if any. */
export function buildingAt(x: number, y: number): Building | null {
  const layout = blockLayout(Math.floor(x / BLOCK), Math.floor(y / BLOCK));
  for (const b of layout.buildings) if (x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) return b;
  return null;
}
