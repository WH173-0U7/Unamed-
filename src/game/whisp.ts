/**
 * The Whisp's behaviour (no drawing here).
 *
 * The Whisp lives off the player's touch: it appears wherever they touch,
 * follows their thumb, and every bit of movement feeds it energy, making it
 * glow brighter and wider. Left alone it slowly fades back to an ember.
 * Threads of light stream from the fingertip into the Whisp as it feeds.
 *
 * It travels through an endless void: positions here are world positions
 * (points, y down). The view follows the Whisp, so holding the thumb away
 * from the centre of the screen keeps it travelling that way.
 */

/** What part of the world the screen shows: its centre and size, in points. */
export interface View {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Progress stored in the save file under `state.whisp`. */
export interface WhispSave {
  energy: number;
  /** Where it is in the void. */
  x?: number;
  y?: number;
}

export const MAX_THREADS = 600;

/** Energy the Whisp settles back to when it isn't being fed. */
const REST_ENERGY = 0.06;
/** How long the glow takes to fade back towards rest (seconds, time constant). */
const FADE_TIME = 9;
/** How much a full screen-diagonal of thumb movement feeds the Whisp. */
const FEED_RATE = 0.55;

export class Whisp {
  energy: number;
  /** 0 = not there, 1 = fully present. Rises while touched, fades after release. */
  presence = 0;
  touching = false;
  /** Has the player touched the darkness yet this session? */
  everTouched = false;

  /** Where the Whisp is in the void. */
  readonly pos = { x: 0, y: 0 };
  /** The point in the void under the thumb. */
  readonly finger = { x: 0, y: 0 };
  /** Where the thumb is on the screen. */
  private readonly screen = { x: 0, y: 0 };

  /** Threads: x, y, vx, vy, life (0..1), size. */
  readonly threads = new Float32Array(MAX_THREADS * 6);
  private nextThread = 0;
  private moved = 0;
  private spawnDebt = 0;

  constructor(save?: WhispSave) {
    this.energy = clamp(save?.energy ?? REST_ENERGY, 0, 1);
    this.pos.x = this.finger.x = save?.x ?? 0;
    this.pos.y = this.finger.y = save?.y ?? 0;
  }

  toSave(): WhispSave {
    const r = (v: number, k: number) => Math.round(v * k) / k;
    return { energy: r(this.energy, 1000), x: r(this.pos.x, 10), y: r(this.pos.y, 10) };
  }

  /** Thumb touches the screen at (x, y). */
  down(x: number, y: number, view: View) {
    this.touching = true;
    this.everTouched = true;
    this.screen.x = x;
    this.screen.y = y;
    this.aim(view);
    // If the Whisp has faded out, it is born right under the thumb.
    if (this.presence < 0.15) {
      this.pos.x = this.finger.x;
      this.pos.y = this.finger.y;
    }
  }

  /** Thumb moves on the screen. Movement is what feeds the Whisp. */
  move(x: number, y: number) {
    if (!this.touching) return;
    this.moved += Math.hypot(x - this.screen.x, y - this.screen.y);
    this.screen.x = x;
    this.screen.y = y;
  }

  /** The point in the void currently under the thumb. */
  private aim(view: View) {
    this.finger.x = view.x + this.screen.x - view.width / 2;
    this.finger.y = view.y + this.screen.y - view.height / 2;
  }

  up() {
    this.touching = false;
  }

  update(dt: number, view: View) {
    const diag = Math.hypot(view.width, view.height);

    // Follow the thumb with a slight, living lag. As the view glides after the
    // Whisp, the point under a still thumb keeps moving: that is travelling.
    if (this.touching) {
      this.aim(view);
      const follow = 1 - Math.exp(-dt * 7);
      this.pos.x += (this.finger.x - this.pos.x) * follow;
      this.pos.y += (this.finger.y - this.pos.y) * follow;
    }

    // Feed on movement, then slowly fade back towards an ember.
    const fed = this.moved / diag;
    this.energy = Math.min(1, this.energy + fed * FEED_RATE * (1.1 - this.energy * 0.5));
    this.energy = REST_ENERGY + (this.energy - REST_ENERGY) * Math.exp(-dt / FADE_TIME);

    // Appear quickly under the thumb; die away slowly when released.
    const target = this.touching ? 1 : 0;
    const rate = this.touching ? 5 : 0.9;
    this.presence += (target - this.presence) * (1 - Math.exp(-dt * rate));

    // Threads: one per few points of movement, plus a trickle while held still.
    if (this.touching) {
      this.spawnDebt += this.moved / 5 + dt * 8;
      while (this.spawnDebt >= 1) {
        this.spawnDebt -= 1;
        this.spawnThread();
      }
    }
    this.moved = 0;
    this.updateThreads(dt);
  }

  private spawnThread() {
    const i = this.nextThread * 6;
    this.nextThread = (this.nextThread + 1) % MAX_THREADS;
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 26;
    const w = this.threads;
    w[i] = this.finger.x + Math.cos(a) * r;
    w[i + 1] = this.finger.y + Math.sin(a) * r;
    // A sideways swirl so threads spiral in rather than fly straight.
    w[i + 2] = -Math.sin(a) * (30 + Math.random() * 50);
    w[i + 3] = Math.cos(a) * (30 + Math.random() * 50);
    w[i + 4] = 1;
    w[i + 5] = 1 + Math.random() * 2.5;
  }

  private updateThreads(dt: number) {
    const w = this.threads;
    const damp = Math.exp(-dt * 2.2);
    const swallow = 4 + this.energy * 10;
    for (let i = 0; i < w.length; i += 6) {
      if (w[i + 4] <= 0) continue;
      const dx = this.pos.x - w[i];
      const dy = this.pos.y - w[i + 1];
      const d = Math.hypot(dx, dy) || 1;
      // Drawn towards the Whisp, harder the closer they get.
      const pull = 900 / (20 + d);
      w[i + 2] = (w[i + 2] + (dx / d) * pull * 60 * dt) * damp;
      w[i + 3] = (w[i + 3] + (dy / d) * pull * 60 * dt) * damp;
      w[i] += w[i + 2] * dt;
      w[i + 1] += w[i + 3] * dt;
      // Fade with age; vanish when swallowed by the Whisp.
      w[i + 4] -= dt * (d < swallow ? 6 : 0.45);
    }
  }
}

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}
