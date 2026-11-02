import { isWalkable } from './city';

export interface Square {
  x: number;
  y: number;
}

/** Give up searching beyond this many squares (keeps taps instant). */
const SEARCH_LIMIT = 20000;

/**
 * Shortest walkable route between two squares (A* search, moving up, down,
 * left and right only). Returns the squares to step onto, not including the
 * start, or null if there's no way there.
 */
export function findPath(from: Square, to: Square): Square[] | null {
  if (!isWalkable(to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];
  const key = (x: number, y: number) => `${x},${y}`;
  const h = (x: number, y: number) => Math.abs(x - to.x) + Math.abs(y - to.y);

  // A small binary heap ordered by estimated total cost.
  const heap: { x: number; y: number; f: number }[] = [];
  const push = (n: { x: number; y: number; f: number }) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= heap[i].f) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].f < heap[m].f) m = l;
        if (r < heap.length && heap[r].f < heap[m].f) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };

  const cost = new Map<string, number>([[key(from.x, from.y), 0]]);
  const came = new Map<string, string>();
  push({ x: from.x, y: from.y, f: h(from.x, from.y) });
  let explored = 0;

  while (heap.length && explored++ < SEARCH_LIMIT) {
    const cur = pop();
    if (cur.x === to.x && cur.y === to.y) {
      const path: Square[] = [];
      let k = key(to.x, to.y);
      while (k !== key(from.x, from.y)) {
        const [x, y] = k.split(',').map(Number);
        path.push({ x, y });
        k = came.get(k)!;
      }
      return path.reverse();
    }
    const g = cost.get(key(cur.x, cur.y))!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!isWalkable(nx, ny)) continue;
      const nk = key(nx, ny);
      const ng = g + 1;
      if (ng < (cost.get(nk) ?? Infinity)) {
        cost.set(nk, ng);
        came.set(nk, key(cur.x, cur.y));
        push({ x: nx, y: ny, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
}

/** The walkable square nearest to a point (for taps on buildings). */
export function nearestWalkable(x: number, y: number, fx = 0.5, fy = 0.5): Square | null {
  if (isWalkable(x, y)) return { x, y };
  let best: Square | null = null;
  let bestD = Infinity;
  for (let r = 1; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !isWalkable(x + dx, y + dy)) continue;
        // Distance from the exact tap point to that square's centre.
        const d = Math.hypot(dx + 0.5 - fx, dy + 0.5 - fy);
        if (d < bestD) {
          bestD = d;
          best = { x: x + dx, y: y + dy };
        }
      }
    }
    if (best) return best;
  }
  return null;
}
