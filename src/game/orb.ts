/**
 * The orb's behaviour (no drawing here).
 *
 * The orb lives off the player's touch: it appears wherever they touch,
 * follows their thumb, and every bit of movement feeds it energy, making it
 * glow brighter and wider. Left alone it slowly fades back to an ember.
 * Wisps of light stream from the fingertip into the orb as it feeds.
 */

/** Progress stored in the save file under `state.orb`. */
export interface OrbSave {
  energy: number;
}

export const MAX_WISPS = 600;

/** Energy the orb settles back to when it isn't being fed. */
const REST_ENERGY = 0.06;
/** How long the glow takes to fade back towards rest (seconds, time constant). */
const FADE_TIME = 9;
/** How much a full screen-diagonal of thumb movement feeds the orb. */
const FEED_RATE = 0.55;

export class Orb {
  energy: number;
  /** 0 = not there, 1 = fully present. Rises while touched, fades after release. */
  presence = 0;
  touching = false;
  /** Has the player touched the darkness yet this session? */
  everTouched = false;

  /** Where the orb is (screen points, y down). */
  readonly pos = { x: 0, y: 0 };
  /** Where the thumb is. */
  readonly finger = { x: 0, y: 0 };

  /** Wisps: x, y, vx, vy, life (0..1), size. */
  readonly wisps = new Float32Array(MAX_WISPS * 6);
  private nextWisp = 0;
  private moved = 0;
  private spawnDebt = 0;

  constructor(save?: OrbSave) {
    this.energy = clamp(save?.energy ?? REST_ENERGY, 0, 1);
  }

  toSave(): OrbSave {
    return { energy: Math.round(this.energy * 1000) / 1000 };
  }

  down(x: number, y: number) {
    this.touching = true;
    this.everTouched = true;
    // If the orb has faded out, it is born right under the thumb.
    if (this.presence < 0.15) {
      this.pos.x = x;
      this.pos.y = y;
    }
    this.finger.x = x;
    this.finger.y = y;
  }

  move(x: number, y: number) {
    if (!this.touching) return;
    this.moved += Math.hypot(x - this.finger.x, y - this.finger.y);
    this.finger.x = x;
    this.finger.y = y;
  }

  up() {
    this.touching = false;
  }

  update(dt: number, width: number, height: number) {
    const diag = Math.hypot(width, height);

    // Follow the thumb with a slight, living lag.
    const follow = 1 - Math.exp(-dt * 7);
    this.pos.x += (this.finger.x - this.pos.x) * follow;
    this.pos.y += (this.finger.y - this.pos.y) * follow;

    // Feed on movement, then slowly fade back towards an ember.
    const fed = this.moved / diag;
    this.energy = Math.min(1, this.energy + fed * FEED_RATE * (1.1 - this.energy * 0.5));
    this.energy = REST_ENERGY + (this.energy - REST_ENERGY) * Math.exp(-dt / FADE_TIME);

    // Appear quickly under the thumb; die away slowly when released.
    const target = this.touching ? 1 : 0;
    const rate = this.touching ? 5 : 0.9;
    this.presence += (target - this.presence) * (1 - Math.exp(-dt * rate));

    // Wisps: one per few points of movement, plus a trickle while held still.
    if (this.touching) {
      this.spawnDebt += this.moved / 5 + dt * 8;
      while (this.spawnDebt >= 1) {
        this.spawnDebt -= 1;
        this.spawnWisp();
      }
    }
    this.moved = 0;
    this.updateWisps(dt);
  }

  private spawnWisp() {
    const i = this.nextWisp * 6;
    this.nextWisp = (this.nextWisp + 1) % MAX_WISPS;
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 26;
    const w = this.wisps;
    w[i] = this.finger.x + Math.cos(a) * r;
    w[i + 1] = this.finger.y + Math.sin(a) * r;
    // A sideways swirl so wisps spiral in rather than fly straight.
    w[i + 2] = -Math.sin(a) * (30 + Math.random() * 50);
    w[i + 3] = Math.cos(a) * (30 + Math.random() * 50);
    w[i + 4] = 1;
    w[i + 5] = 1 + Math.random() * 2.5;
  }

  private updateWisps(dt: number) {
    const w = this.wisps;
    const damp = Math.exp(-dt * 2.2);
    const swallow = 4 + this.energy * 10;
    for (let i = 0; i < w.length; i += 6) {
      if (w[i + 4] <= 0) continue;
      const dx = this.pos.x - w[i];
      const dy = this.pos.y - w[i + 1];
      const d = Math.hypot(dx, dy) || 1;
      // Drawn towards the orb, harder the closer they get.
      const pull = 900 / (20 + d);
      w[i + 2] = (w[i + 2] + (dx / d) * pull * 60 * dt) * damp;
      w[i + 3] = (w[i + 3] + (dy / d) * pull * 60 * dt) * damp;
      w[i] += w[i + 2] * dt;
      w[i + 1] += w[i + 3] * dt;
      // Fade with age; vanish when swallowed by the orb.
      w[i + 4] -= dt * (d < swallow ? 6 : 0.45);
    }
  }
}

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}
