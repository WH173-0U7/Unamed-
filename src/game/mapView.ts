import * as THREE from 'three';
import { BLOCK, blockLayout, type Building } from './city';
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
  /** The building being visited, if the destination is a building's door. */
  building: Building | null;
}

const grey = (v: number) => {
  const c = Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c},${c},${c})`;
};

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
 * its picture, seen from above: streets with lane markings, sidewalks,
 * blocks of individual buildings (roofs, parapets, rooftop units, skylights,
 * shadows), courtyards, small parks, the player and the planned route.
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

      const T = TILE;
      const X = (mx: number) => mx * T - camX;
      const Y = (my: number) => my * T - camY;

      // Streets: dark asphalt with dashed centre lines.
      ctx.fillStyle = '#0c0c0c';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#363636';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      for (let gx = Math.floor(x0 / BLOCK) * BLOCK; gx <= x1; gx += BLOCK) {
        ctx.moveTo(X(gx + 0.5), 0);
        ctx.lineTo(X(gx + 0.5), height);
      }
      for (let gy = Math.floor(y0 / BLOCK) * BLOCK; gy <= y1; gy += BLOCK) {
        ctx.moveTo(0, Y(gy + 0.5));
        ctx.lineTo(width, Y(gy + 0.5));
      }
      ctx.stroke();
      ctx.setLineDash([]);

      const bx0 = Math.floor(x0 / BLOCK);
      const by0 = Math.floor(y0 / BLOCK);
      const bx1 = Math.floor(x1 / BLOCK);
      const by1 = Math.floor(y1 / BLOCK);
      for (let by = by0; by <= by1; by++) {
        for (let bx = bx0; bx <= bx1; bx++) {
          const ox = bx * BLOCK + 1;
          const oy = by * BLOCK + 1;
          const n = BLOCK - 1;
          const layout = blockLayout(bx, by);
          // Sidewalk: a pale curb all round the block.
          ctx.fillStyle = '#2b2b2b';
          ctx.fillRect(X(ox) - 3, Y(oy) - 3, n * T + 6, n * T + 6);
          // Ground inside the block (shows in alleys, courtyards and parks).
          ctx.fillStyle = layout.kind === 'lot' ? '#151515' : '#101010';
          ctx.fillRect(X(ox), Y(oy), n * T, n * T);

          if (layout.kind === 'lot') {
            // A small park: a path across it and trees.
            ctx.strokeStyle = '#242424';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(X(ox), Y(oy + n / 2));
            ctx.quadraticCurveTo(X(ox + n / 2), Y(oy + n * 0.2), X(ox + n), Y(oy + n / 2));
            ctx.stroke();
            for (const t of layout.trees) {
              ctx.fillStyle = '#060606';
              ctx.beginPath();
              ctx.arc(X(t.x) + 2, Y(t.y) + 2, t.r * T, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#3c3c3c';
              ctx.beginPath();
              ctx.arc(X(t.x), Y(t.y), t.r * T, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#4c4c4c';
              ctx.beginPath();
              ctx.arc(X(t.x) - t.r * T * 0.3, Y(t.y) - t.r * T * 0.3, t.r * T * 0.45, 0, Math.PI * 2);
              ctx.fill();
            }
            continue;
          }

          // Shadows first, so they fall across the ground and lower roofs.
          ctx.fillStyle = '#050505';
          for (const b of layout.buildings) {
            if (b.courtyard) continue;
            const d = 2 + b.height * 5;
            ctx.fillRect(X(b.x0) + d, Y(b.y0) + d, (b.x1 - b.x0) * T - 1, (b.y1 - b.y0) * T - 1);
          }
          for (const b of layout.buildings) drawBuilding(b);
        }
      }

      function drawBuilding(b: Building) {
        const x = X(b.x0) + 0.75;
        const y = Y(b.y0) + 0.75;
        const w = (b.x1 - b.x0) * T - 1.5;
        const h = (b.y1 - b.y0) * T - 1.5;
        if (b.courtyard) {
          ctx.fillStyle = '#121212';
          ctx.fillRect(x, y, w, h);
          return;
        }
        const roof = 34 + b.shade * 34 + b.height * 10;
        ctx.fillStyle = grey(roof);
        ctx.fillRect(x, y, w, h);
        // Parapet: a raised lip around the roof edge.
        ctx.strokeStyle = grey(roof + 18);
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
        // Skylights: rows of glass strips.
        if (b.skylights) {
          ctx.fillStyle = grey(roof - 16);
          const rows = b.skylights;
          for (let i = 0; i < rows; i++) {
            const sy = y + 6 + ((h - 12) * (i + 0.5)) / rows - 1.5;
            ctx.fillRect(x + 7, sy, w - 14, 3);
          }
        }
        // Rooftop units, each with a little shadow.
        for (const t of b.roofThings) {
          ctx.fillStyle = grey(roof - 22);
          ctx.fillRect(X(t.x) + 1.5, Y(t.y) + 1.5, t.w * T, t.h * T);
          ctx.fillStyle = grey(roof + 26);
          ctx.fillRect(X(t.x), Y(t.y), t.w * T, t.h * T);
        }
        // The front door: a bright notch on the street-facing side.
        if (b.door) {
          ctx.fillStyle = '#8a8a8a';
          const cx = X(b.door.x + 0.5);
          const cy = Y(b.door.y + 0.5);
          if (b.doorSide === 'top') ctx.fillRect(cx - 3, y - 1, 6, 3);
          else if (b.doorSide === 'bottom') ctx.fillRect(cx - 3, y + h - 2, 6, 3);
          else if (b.doorSide === 'left') ctx.fillRect(x - 1, cy - 3, 3, 6);
          else ctx.fillRect(x + w - 2, cy - 3, 3, 6);
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

        // The building being visited: outlined.
        if (route.building) {
          const b = route.building;
          ctx.strokeStyle = route.confirmed ? '#bdbdbd' : '#ffffff';
          ctx.lineWidth = 2;
          ctx.setLineDash(route.confirmed ? [] : [4, 4]);
          ctx.strokeRect(X(b.x0) + 1, Y(b.y0) + 1, (b.x1 - b.x0) * T - 2, (b.y1 - b.y0) * T - 2);
          ctx.setLineDash([]);
        }

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
