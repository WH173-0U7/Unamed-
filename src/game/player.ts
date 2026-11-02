import type { Square } from './path';

/** Seconds to walk from one square to the next. */
export const MOVE_TIME = 0.15;

/** Progress stored in the save file under `state.player`. */
export interface PlayerSave {
  x: number;
  y: number;
}

/**
 * The character: stands on a square and walks along a route one square at a
 * time, sliding smoothly between squares.
 */
export class Player {
  /** The square it is on (or stepping onto). */
  x: number;
  y: number;
  /** Squares still to walk, in order. */
  route: Square[] = [];
  /** Called after each step (e.g. for a light haptic tick). */
  onStep: (() => void) | null = null;

  private fromX: number;
  private fromY: number;
  private t = 1;
  private stopAfterStep = false;

  constructor(save?: PlayerSave) {
    this.x = this.fromX = save?.x ?? 0;
    this.y = this.fromY = save?.y ?? 0;
  }

  toSave(): PlayerSave {
    return { x: this.x, y: this.y };
  }

  /** Is it walking (mid-step or with route left)? */
  get walking() {
    return this.t < 1 || this.route.length > 0;
  }

  /** Where it will be once the current step ends: routes are planned from here. */
  get nextSquare(): Square {
    return { x: this.x, y: this.y };
  }

  walk(route: Square[]) {
    this.route = route.slice();
    this.stopAfterStep = false;
  }

  /** Stops at the end of the current step. */
  stop() {
    this.route = [];
    this.stopAfterStep = true;
  }

  /** Where it is drawn: between squares while stepping. */
  get drawX() {
    return this.fromX + (this.x - this.fromX) * ease(this.t);
  }
  get drawY() {
    return this.fromY + (this.y - this.fromY) * ease(this.t);
  }

  update(dt: number) {
    let left = dt;
    // Loop so a long frame can't stall or slow the walk.
    while (left > 0) {
      if (this.t < 1) {
        const need = (1 - this.t) * MOVE_TIME;
        if (left < need) {
          this.t += left / MOVE_TIME;
          return;
        }
        left -= need;
        this.t = 1;
        this.onStep?.();
      }
      if (this.stopAfterStep || !this.route.length) {
        this.stopAfterStep = false;
        return;
      }
      const next = this.route.shift()!;
      this.fromX = this.x;
      this.fromY = this.y;
      this.x = next.x;
      this.y = next.y;
      this.t = 0;
    }
  }
}

function ease(t: number) {
  // Gentle ease that keeps a steady pace when walking several squares.
  return t * t * (3 - 2 * t) * 0.5 + t * 0.5;
}
