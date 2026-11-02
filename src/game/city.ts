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
