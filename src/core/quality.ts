import type { GraphicsQuality } from './settings';

/** Device detection and graphics presets. */

export const isMobile =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches);

const dpr = Math.min(window.devicePixelRatio || 1, 2);

/** Render resolution (pixels per CSS pixel) for each graphics setting. */
export function pixelRatioFor(q: GraphicsQuality): number {
  switch (q) {
    case 'low':
      return Math.min(dpr, 0.75);
    case 'medium':
      return Math.min(dpr, 1.25);
    case 'high':
      return dpr;
    case 'auto':
    default:
      return Math.min(dpr, isMobile ? 1.5 : 2);
  }
}
