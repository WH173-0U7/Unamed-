/**
 * The broken glass, shared between the glass on top (which draws the cracks)
 * and the TV picture under it (which bends through the shards). One small
 * map, drawn once per break: each shard a flat colour, red and green which
 * way it shifts the picture behind it, blue when it shows (the same reveal
 * threshold as its cracks), alpha where there's a shard at all.
 */
import type { Shard } from './crackGhost';

/** The map is coarse (flat shards with straight edges) and read with hard edges. */
const MAP_SCALE = 0.5;

export const crackShared = {
  /** The shard map (null before the first break). */
  map: null as HTMLCanvasElement | null,
  /** Bumped every time the map is redrawn. */
  version: 0,
  /** How far the cracks have spread right now (0..1). */
  level: 0,
};

/** A fresh break: the map for these shards on a view of this size (screen points). */
export function setShardMap(shards: Shard[], w: number, h: number) {
  const c = crackShared.map ?? document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * MAP_SCALE));
  c.height = Math.max(1, Math.round(h * MAP_SCALE));
  const x = c.getContext('2d')!;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, c.width, c.height);
  x.setTransform(MAP_SCALE, 0, 0, MAP_SCALE, 0, 0);
  for (const s of shards) {
    const r = Math.round(128 + Math.max(-1, Math.min(1, s.dx)) * 127);
    const g = Math.round(128 + Math.max(-1, Math.min(1, s.dy)) * 127);
    const b = Math.round(Math.min(1, Math.max(0, s.t)) * 255);
    x.fillStyle = `rgb(${r},${g},${b})`;
    x.beginPath();
    s.pts.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)));
    x.closePath();
    x.fill();
  }
  crackShared.map = c;
  crackShared.version++;
}
