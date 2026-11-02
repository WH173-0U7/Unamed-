/** Device detection and adaptive resolution so the game stays smooth on any phone. */

export const isMobile =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches);

export const tier = isMobile
  ? { particles: 50_000, terrainSegments: 160, blobs: 45, knots: 14, maxPixelRatio: 1.5 }
  : { particles: 120_000, terrainSegments: 256, blobs: 80, knots: 26, maxPixelRatio: 2 };

/**
 * Watches the frame rate and lowers or raises render resolution. Resolution
 * is the biggest cost on phones, so this is the main performance lever.
 */
export class AdaptiveResolution {
  private frames = 0;
  private elapsed = 0;
  fps = 60;

  constructor(
    public pixelRatio: number,
    private readonly min: number,
    private readonly max: number,
    private readonly apply: (pixelRatio: number) => void,
  ) {}

  tick(dt: number) {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < 2) return;
    this.fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;

    let next = this.pixelRatio;
    if (this.fps < 48) next = Math.max(this.min, this.pixelRatio - 0.15);
    else if (this.fps > 58) next = Math.min(this.max, this.pixelRatio + 0.1);
    if (Math.abs(next - this.pixelRatio) > 0.001) {
      this.pixelRatio = next;
      this.apply(next);
    }
  }
}
