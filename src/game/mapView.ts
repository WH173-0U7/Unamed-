import * as THREE from 'three';
import { tileAt } from './city';
import type { Player } from './player';
import type { Square } from './path';

/** Size of one tile on screen, in points. */
export const TILE = 26;

/** What to show of a planned route. */
export interface RouteDisplay {
  /** The squares to walk through, ending at the destination. */
  squares: Square[];
  /** Waiting for the confirming tap (dashed), or being walked (solid). */
  confirmed: boolean;
}

/**
 * The TV's curved glass (must match `barrel` in tv.ts): where a point on the
 * screen actually shows the picture. Both in 0..1, y up.
 */
function throughGlass(u: number, v: number): [number, number] {
  let cx = u * 2 - 1;
  let cy = v * 2 - 1;
  const ox = Math.abs(cy) / 5.5;
  const oy = Math.abs(cx) / 4.5;
  cx += cx * ox * ox;
  cy += cy * oy * oy;
  return [cx * 0.5 + 0.5, cy * 0.5 + 0.5];
}

/**
 * Draws the city map around the player into an image the TV then shows as
 * its picture: streets, buildings, the player, and the planned route.
 */
export function createMapView() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  let width = 1;
  let height = 1;
  let scale = 1;
  let camX = 0;
  let camY = 0;
  let time = 0;

  return {
    texture,
    setSize(w: number, h: number, pixelRatio: number) {
      width = w;
      height = h;
      scale = Math.min(pixelRatio, 2);
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
    },

    /**
     * The map square under a tap at screen point (x, y), allowing for the
     * TV's curved glass. Also returns where in the square the tap landed
     * (0..1). Null if the tap is off the edge of the picture.
     */
    squareAt(x: number, y: number): { x: number; y: number; fx: number; fy: number } | null {
      const [u, v] = throughGlass(x / width, 1 - y / height);
      if (u < 0 || u > 1 || v < 0 || v > 1) return null;
      const mx = (u * width + camX) / TILE;
      const my = ((1 - v) * height + camY) / TILE;
      return { x: Math.floor(mx), y: Math.floor(my), fx: mx - Math.floor(mx), fy: my - Math.floor(my) };
    },

    draw(player: Player, route: RouteDisplay | null, dt: number) {
      time += dt;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      // The camera keeps the player in the middle of the screen.
      camX = player.drawX * TILE + TILE / 2 - width / 2;
      camY = player.drawY * TILE + TILE / 2 - height / 2;
      const x0 = Math.floor(camX / TILE) - 1;
      const y0 = Math.floor(camY / TILE) - 1;
      const x1 = Math.ceil((camX + width) / TILE) + 1;
      const y1 = Math.ceil((camY + height) / TILE) + 1;

      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const sx = tx * TILE - camX;
          const sy = ty * TILE - camY;
          const tile = tileAt(tx, ty);
          if (tile === 'building') {
            ctx.fillStyle = '#343434';
            ctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
            ctx.fillStyle = '#242424';
            ctx.fillRect(sx + 4, sy + 4, TILE - 8, TILE - 8);
          } else {
            // A faint dot in the middle of each walkable square shows the grid.
            ctx.fillStyle = tile === 'street' ? '#2a2a2a' : '#1c1c1c';
            ctx.fillRect(sx + TILE / 2 - 1.5, sy + TILE / 2 - 1.5, 3, 3);
          }
        }
      }

      const centre = (s: Square) => [s.x * TILE + TILE / 2 - camX, s.y * TILE + TILE / 2 - camY] as const;

      // The route: from the player through each square to the destination.
      if (route && route.squares.length) {
        const pts = [
          [player.drawX * TILE + TILE / 2 - camX, player.drawY * TILE + TILE / 2 - camY] as const,
          ...route.squares.map(centre),
        ];
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = route.confirmed ? '#d8d8d8' : '#9a9a9a';
        ctx.setLineDash(route.confirmed ? [] : [5, 6]);
        ctx.lineDashOffset = -time * 18; // dashes march towards the destination
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (const [px, py] of pts.slice(1)) ctx.lineTo(px, py);
        ctx.stroke();
        ctx.setLineDash([]);

        // Destination marker: a ring that pulses while waiting for confirmation.
        const [dx, dy] = pts[pts.length - 1];
        const pulse = route.confirmed ? 0 : 0.5 + 0.5 * Math.sin(time * 6);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(dx, dy, TILE * (0.42 + 0.1 * pulse), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // The player: a bright square in the middle.
      const px = width / 2 - TILE / 2;
      const py = height / 2 - TILE / 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);

      texture.needsUpdate = true;
    },

    dispose() {
      texture.dispose();
    },
  };
}
