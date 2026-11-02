import { isWalkable } from './city';

export type Direction = 'up' | 'down' | 'left' | 'right';

const STEP: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Seconds to slide from one tile to the next. */
export const MOVE_TIME = 0.14;

/** Progress stored in the save file under `state.player`. */
export interface PlayerSave {
  x: number;
  y: number;
}

/**
 * The character: stands on a tile and moves one tile at a time. While a
 * direction is held it keeps stepping; buildings block the way.
 */
export class Player {
  /** The tile it is on (or moving to). */
  x: number;
  y: number;
  /** The tile it is moving from, and how far along the slide (0..1). */
  private fromX: number;
  private fromY: number;
  private t = 1;
  /** Directions currently held, most recent last. */
  private held: Direction[] = [];
  /** A tap that hasn't been used yet (so quick taps never get lost). */
  private queued: Direction | null = null;

  constructor(save?: PlayerSave) {
    this.x = this.fromX = save?.x ?? 0;
    this.y = this.fromY = save?.y ?? 0;
  }

  toSave(): PlayerSave {
    return { x: this.x, y: this.y };
  }

  press(dir: Direction) {
    this.held = this.held.filter((d) => d !== dir);
    this.held.push(dir);
    this.queued = dir;
  }

  release(dir: Direction) {
    this.held = this.held.filter((d) => d !== dir);
  }

  releaseAll() {
    this.held = [];
    this.queued = null;
  }

  /** Where it is drawn: between tiles while sliding. */
  get drawX() {
    return this.fromX + (this.x - this.fromX) * ease(this.t);
  }
  get drawY() {
    return this.fromY + (this.y - this.fromY) * ease(this.t);
  }

  update(dt: number) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / MOVE_TIME);
      if (this.t < 1) return;
    }
    // Arrived (or standing still): take the next step if one is wanted.
    const dir = this.queued ?? this.held[this.held.length - 1];
    this.queued = null;
    if (!dir) return;
    const [dx, dy] = STEP[dir];
    if (!isWalkable(this.x + dx, this.y + dy)) return;
    this.fromX = this.x;
    this.fromY = this.y;
    this.x += dx;
    this.y += dy;
    this.t = 0;
  }
}

function ease(t: number) {
  return t * t * (3 - 2 * t);
}
