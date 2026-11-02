/**
 * The people who can turn up on the street camera, and how each one moves.
 * Everyone is drawn as a jointed silhouette (legs, back, head, arms) so the
 * way they move tells you who they are: a brisk civilian, a staggering
 * drunk, a hunched junkie nodding off, someone homeless pushing a cart.
 */

export type Kind = 'homeless' | 'junkie' | 'drunk' | 'civilian';

/** How a body is held at one moment. Angles in radians, lengths in heights. */
export interface Pose {
  /** Walk cycle (radians), and how long the strides are (0 standing .. 1). */
  phase: number;
  stride: number;
  /** Whole body tilted forward. */
  lean: number;
  /** Rounded back, head pushed forward (0..1). */
  hunch: number;
  /** Head hanging down. */
  head: number;
  /** 0 standing .. 1 sitting against the wall. */
  sit: number;
  /** Extra raise for the front and back arm. */
  arm: [number, number];
  /** Extra elbow bend for the front and back arm. */
  elbow: [number, number];
}

const still = (): Pose => ({ phase: 0, stride: 0, lean: 0, hunch: 0, head: 0, sit: 0, arm: [0, 0], elbow: [0, 0] });

/** What the street tells a person about where they are. */
export interface Stage {
  /** Scene width, figure height (px), lamp and doorway positions. */
  width: number;
  H: number;
  lampX: number;
  doorX: number;
}

/** Things a person may carry. */
export interface Props {
  bottle?: boolean;
  bag?: boolean;
  hood?: boolean;
  hat?: boolean;
  cart?: { x: number; attached: boolean };
  blanket?: number; // 0..1 how far it's been pulled over
}

const smooth = (a: number, b: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * One person crossing (or settling into) the camera's view. Each kind runs
 * a little script over time: walk in, do their thing near the light, then
 * leave (or stay, for someone bedding down for the night).
 */
export class Person {
  x: number;
  dir: 1 | -1;
  pose = still();
  props: Props = {};
  /** Seconds since they appeared. */
  t = 0;
  /** True once they're clearly in view (the moment to name them). */
  revealed = false;
  /** True once they've finished (left the view, or settled down). */
  done = false;
  /** Small random jerks (junkie). */
  jitter = 0;

  private stopT = -1;
  private stopped = false;
  private readonly rnd: () => number;
  private readonly willStop: boolean;

  constructor(
    readonly kind: Kind,
    private readonly stage: Stage,
    seed: number,
  ) {
    this.rnd = mulberry(seed);
    this.dir = this.rnd() < 0.5 ? 1 : -1;
    this.willStop = this.rnd() < 0.5;
    const H = stage.H;
    this.x = this.dir === 1 ? -H * 0.6 : stage.width + H * 0.6;
    if (kind === 'civilian') {
      const r = this.rnd();
      this.props = r < 0.35 ? { bag: true } : r < 0.6 ? { hood: true } : r < 0.8 ? { hat: true } : {};
    } else if (kind === 'drunk') {
      this.props = { bottle: true, hat: this.rnd() < 0.3 };
    } else if (kind === 'junkie') {
      this.props = { hood: this.rnd() < 0.7 };
    } else {
      this.props = { hood: true, cart: { x: this.x + this.dir * H * 0.55, attached: true }, blanket: 0 };
    }
  }

  private get offscreen() {
    const m = this.stage.H * 0.9;
    return this.dir === 1 ? this.x > this.stage.width + m : this.x < -m;
  }

  /** Walk forward at `speed` (heights/s) with steps `step` heights long. */
  private walk(dt: number, speed: number, step: number) {
    const H = this.stage.H;
    this.x += this.dir * speed * H * dt;
    this.pose.phase += (speed / step) * Math.PI * dt;
  }

  /** Has the person reached a spot (passing it in their direction)? */
  private reached(x: number) {
    return this.dir === 1 ? this.x >= x : this.x <= x;
  }

  update(dt: number) {
    this.t += dt;
    const p = this.pose;
    const H = this.stage.H;
    const { lampX } = this.stage;
    // Named once they step into the lamp light (or stop, or settle).
    if (!this.revealed && (Math.abs(this.x - lampX) < H * 0.6 || this.stopT >= 0 || this.done)) this.revealed = true;

    switch (this.kind) {
      case 'civilian': {
        // Brisk and upright. Sometimes pauses under the lamp to check a phone,
        // then hurries on.
        p.lean = 0.06;
        if (!this.stopped && this.stopT < 0 && this.willStop && this.reached(lampX + this.dir * H * 0.2)) {
          this.stopT = 0;
        }
        if (this.stopT >= 0 && !this.stopped) {
          this.stopT += dt;
          p.stride = lerp(p.stride, 0, Math.min(1, dt * 8));
          p.arm[0] = smooth(0.2, 0.6, this.stopT) * 1.3 * (1 - smooth(1.6, 2.0, this.stopT));
          p.elbow[0] = p.arm[0] * 1.1;
          p.head = 0.35 * p.arm[0];
          if (this.stopT > 2.0) this.stopped = true;
        } else {
          p.stride = lerp(p.stride, 1, Math.min(1, dt * 4));
          this.walk(dt, this.stopped ? 1.05 : 0.85, 0.42);
        }
        if (this.offscreen) this.done = true;
        break;
      }

      case 'drunk': {
        // Staggers: uneven pace, swaying, the odd step back. Stops at the
        // lamp post to lean on it and take a swig.
        const sway = Math.sin(this.t * 1.7) * 0.2 + Math.sin(this.t * 3.1) * 0.06;
        if (!this.stopped && this.stopT < 0 && Math.abs(this.x - (lampX - this.dir * H * 0.28)) < H * 0.05) this.stopT = 0;
        if (this.stopT >= 0 && !this.stopped) {
          this.stopT += dt;
          p.stride = lerp(p.stride, 0, Math.min(1, dt * 5));
          p.lean = lerp(p.lean, 0.2 + sway * 0.3, Math.min(1, dt * 3)); // leaning on the post
          const swig = smooth(0.8, 1.4, this.stopT) * (1 - smooth(2.4, 3.0, this.stopT));
          p.arm[0] = 0.25 + swig * 1.75;
          p.elbow[0] = 0.6 + swig * 1.3;
          p.head = -swig * 0.55; // head tipped back
          if (this.stopT > 3.6) this.stopped = true;
        } else {
          p.stride = lerp(p.stride, 0.8, Math.min(1, dt * 3));
          p.lean = 0.1 + sway;
          p.head = 0.25 + Math.sin(this.t * 1.1) * 0.15;
          p.arm[0] = 0.25;
          p.elbow[0] = 0.6;
          const pace = 0.42 * (0.6 + 0.6 * Math.sin(this.t * 1.3)) + (Math.sin(this.t * 0.7) < -0.85 ? -0.25 : 0);
          this.walk(dt, pace, 0.3);
        }
        if (this.offscreen) this.done = true;
        break;
      }

      case 'junkie': {
        // Hunched, jerky shuffle. Stops under the lamp, scratches at an arm,
        // nods off (head sinking) and jerks awake, then shuffles away.
        p.hunch = 0.85;
        this.jitter = (this.rnd() - 0.5) * 0.06;
        if (!this.stopped && this.stopT < 0 && this.reached(lampX)) this.stopT = 0;
        if (this.stopT >= 0 && !this.stopped) {
          this.stopT += dt;
          const s = this.stopT;
          p.stride = lerp(p.stride, 0, Math.min(1, dt * 6));
          // Scratching: the back hand rubbing the front forearm.
          const scratch = smooth(0.3, 0.6, s) * (1 - smooth(2.2, 2.5, s));
          p.arm[1] = scratch * (0.9 + Math.sin(s * 22) * 0.12);
          p.elbow[1] = scratch * 1.6;
          p.arm[0] = scratch * 0.5;
          p.elbow[0] = scratch * 1.2;
          // Nodding off twice, each time jerking back up.
          const nod = (a: number) => smooth(a, a + 1.6, s) * (1 - smooth(a + 1.6, a + 1.75, s));
          const n = nod(2.6) + nod(4.6);
          p.head = 0.2 + n * 0.9;
          p.lean = 0.15 + n * 0.25 + Math.sin(s * 1.3) * 0.04;
          if (s > 6.6) this.stopped = true;
        } else {
          p.stride = lerp(p.stride, 0.45, Math.min(1, dt * 4));
          p.lean = 0.22;
          p.head = 0.25;
          p.arm = [0.35, 0.15];
          p.elbow = [1.2, 0.9]; // arms held in close
          const lurch = Math.sin(this.t * 6) > -0.2 ? 1 : 0.15;
          this.walk(dt, 0.38 * lurch, 0.22);
        }
        if (this.offscreen) this.done = true;
        break;
      }

      case 'homeless': {
        // Pushes a cart in slowly, parks it by the doorway, sits down against
        // the wall and pulls a blanket over. Stays for the night.
        const cart = this.props.cart!;
        const spot = this.stage.doorX;
        if (this.stopT < 0) {
          p.hunch = 0.55;
          p.lean = 0.32;
          p.head = 0.1;
          p.arm = [1.15, 1.15];
          p.elbow = [0.35, 0.35];
          p.stride = 0.55;
          this.walk(dt, 0.3, 0.22);
          cart.x = this.x + this.dir * H * 0.55;
          if (this.reached(spot)) this.stopT = 0;
        } else {
          this.stopT += dt;
          const s = this.stopT;
          cart.attached = false;
          const sit = smooth(0.8, 2.2, s);
          p.stride = lerp(p.stride, 0, Math.min(1, dt * 5));
          p.sit = sit;
          p.arm = [lerp(1.15, 0.2, smooth(0, 0.8, s)), lerp(1.15, 0.1, smooth(0, 0.8, s))];
          p.elbow = [lerp(0.35, 1.4, sit), lerp(0.35, 1.2, sit)];
          p.hunch = lerp(0.55, 0.7, sit);
          p.lean = lerp(0.32, -0.12, sit);
          // Breathing, and the head sinking as they settle.
          p.head = lerp(0.1, 0.55, smooth(3, 6, s)) + Math.sin(s * 1.4) * 0.03;
          this.props.blanket = smooth(2.2, 3.4, s);
          if (s > 4.2) this.done = true;
        }
        break;
      }
    }
  }
}

/** Joint positions for a pose, for drawing. */
interface Skeleton {
  hip: [number, number];
  neck: [number, number];
  back: [number, number]; // control point of the curved back
  head: [number, number];
  headR: number;
  legs: [number, number][][]; // per leg: hip, knee, foot
  arms: [number, number][][]; // per arm: shoulder, elbow, hand
}

export function skeleton(p: Pose, x: number, dir: number, ground: number, H: number, jitter = 0): Skeleton {
  const thigh = 0.25 * H;
  const shin = 0.24 * H;
  const torso = 0.3 * H;
  const headR = 0.068 * H;
  const at = (o: [number, number], ang: number, len: number): [number, number] => [
    o[0] + Math.sin(ang) * len * dir,
    o[1] + Math.cos(ang) * len,
  ];

  // Legs: angles from straight down, positive = forward.
  const legAngles = [0, 1].map((i) => {
    const ph = p.phase + i * Math.PI;
    const a = Math.sin(ph) * 0.48 * p.stride;
    const knee = (Math.max(0, Math.cos(ph)) * 0.75 * p.stride + 0.06) * (1 - p.sit);
    return [lerp(a, 1.75, p.sit), lerp(a - knee, -0.15, p.sit)] as const;
  });
  const drop = Math.max(...legAngles.map(([a, b]) => Math.cos(a) * thigh + Math.cos(b) * shin));
  const hipY = lerp(ground - drop, ground - 0.07 * H, p.sit);
  const hip: [number, number] = [x - dir * p.sit * 0.12 * H, hipY];
  const legs = legAngles.map(([a, b]) => {
    const knee = at(hip, a, thigh);
    return [hip, knee, at(knee, b, shin)];
  });

  // Back: tilted by lean, bowed by hunch.
  const tilt = p.lean + p.hunch * 0.3 + jitter;
  const neck: [number, number] = [hip[0] + Math.sin(tilt) * torso * dir, hip[1] - Math.cos(tilt) * torso];
  const mid: [number, number] = [(hip[0] + neck[0]) / 2, (hip[1] + neck[1]) / 2];
  const bow = p.hunch * 0.09 * H;
  const back: [number, number] = [mid[0] - Math.cos(tilt) * bow * dir, mid[1] - Math.sin(tilt) * bow];
  const ht = tilt + p.hunch * 0.75 + p.head + jitter * 2;
  const head: [number, number] = [neck[0] + Math.sin(ht) * (headR + 0.035 * H) * dir, neck[1] - Math.cos(ht) * (headR + 0.035 * H)];

  // Arms hang from the shoulder and swing against the legs.
  const shoulder: [number, number] = [lerp(neck[0], hip[0], 0.12), lerp(neck[1], hip[1], 0.12)];
  const arms = [0, 1].map((i) => {
    const swing = -Math.sin(p.phase + i * Math.PI) * 0.45 * p.stride;
    const a = tilt * 0.5 + swing + p.arm[i];
    const elbow = at(shoulder, a, 0.16 * H);
    return [shoulder, elbow, at(elbow, a + 0.2 + p.elbow[i], 0.15 * H)];
  });
  return { hip, neck, back, head, headR, legs, arms };
}

/** A small seeded random number generator. */
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
