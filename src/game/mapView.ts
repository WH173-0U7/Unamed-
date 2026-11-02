import * as THREE from 'three';
import { tileAt } from './city';
import type { Player } from './player';

/** Size of one tile on screen, in points. */
export const TILE = 26;

/**
 * Draws the city map around the player into an image the TV then shows as
 * its picture. Plain on purpose for now: streets, buildings and the player.
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

  return {
    texture,
    setSize(w: number, h: number, pixelRatio: number) {
      width = w;
      height = h;
      scale = Math.min(pixelRatio, 2);
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
    },

    draw(player: Player) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      // The camera keeps the player in the middle of the screen.
      const camX = player.drawX * TILE + TILE / 2 - width / 2;
      const camY = player.drawY * TILE + TILE / 2 - height / 2;
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
