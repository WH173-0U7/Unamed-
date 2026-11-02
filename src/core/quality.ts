import type { GraphicsQuality } from './settings';

/** Device detection, graphics presets and adaptive resolution. */

export const isMobile =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches);

/** Maximum amounts allocated once at start-up; presets draw a fraction of these. */
export const capacity = {
  particles: 120_000,
  blobs: 80,
  knots: 26,
  terrainSegments: isMobile ? 192 : 256,
};

export interface Preset {
  /** Fraction of capacity drawn. */
  density: number;
  maxPixelRatio: number;
  bloom: number;
}

const dpr = Math.min(window.devicePixelRatio || 1, 2);

export function presetFor(q: GraphicsQuality): Preset {
  switch (q) {
    case 'low':
      return { density: 0.3, maxPixelRatio: Math.min(dpr, 0.85), bloom: 0.6 };
    case 'medium':
      return { density: 0.55, maxPixelRatio: Math.min(dpr, 1.25), bloom: 0.8 };
    case 'high':
      return { density: 1, maxPixelRatio: dpr, bloom: 0.85 };
    case 'auto':
    default:
      return isMobile
        ? { density: 0.45, maxPixelRatio: Math.min(dpr, 1.5), bloom: 0.8 }
        : { density: 1, maxPixelRatio: dpr, bloom: 0.85 };
  }
}

/**
 * Watches the frame rate and lowers or raises render resolution within
 * [min, max]. Resolution is the biggest cost on phones.
 */
export class AdaptiveResolution {
  private frames = 0;
  private elapsed = 0;
  fps = 60;

  constructor(
    public pixelRatio: number,
    private min: number,
    private max: number,
    private readonly apply: (pixelRatio: number) => void,
  ) {}

  setRange(min: number, max: number) {
    this.min = Math.min(min, max);
    this.max = max;
    const next = Math.min(this.max, Math.max(this.min, this.max));
    this.pixelRatio = next;
    this.apply(next);
  }

  tick(dt: number, adapt: boolean) {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < 2) return;
    this.fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    if (!adapt) return;

    let next = this.pixelRatio;
    if (this.fps < 48) next = Math.max(this.min, this.pixelRatio - 0.15);
    else if (this.fps > 58) next = Math.min(this.max, this.pixelRatio + 0.1);
    if (Math.abs(next - this.pixelRatio) > 0.001) {
      this.pixelRatio = next;
      this.apply(next);
    }
  }
}
