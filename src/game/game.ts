import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { Orb, type OrbSave } from './orb';
import { createDarkness } from './darkness';

/**
 * The game itself. It begins in a very dark place: wherever the player
 * touches, a small orb of light appears and feeds on their movement.
 * Each system keeps its progress in `save.state`, so it is saved at every
 * pause point automatically.
 */
export class Game {
  running = false;
  private readonly orb: Orb;
  private readonly darkness;
  private pointerId: number | null = null;
  private width = 1;
  private height = 1;
  private readonly listeners: [string, EventListener][] = [];

  constructor(
    readonly save: SaveData,
    private readonly view: HTMLElement,
    renderer: THREE.WebGLRenderer,
  ) {
    this.orb = new Orb(save.state.orb as OrbSave | undefined);
    this.darkness = createDarkness(renderer);
    this.listen('pointerdown', this.onDown);
    this.listen('pointermove', this.onMove);
    this.listen('pointerup', this.onUp);
    this.listen('pointercancel', this.onUp);
  }

  private listen(type: string, fn: (e: PointerEvent) => void) {
    const l = fn as EventListener;
    this.view.addEventListener(type, l);
    this.listeners.push([type, l]);
  }

  private onDown = (e: PointerEvent) => {
    if (!this.running || this.pointerId !== null) return;
    if ((e.target as HTMLElement).closest('button')) return; // e.g. the pause button
    this.pointerId = e.pointerId;
    try {
      this.view.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
    const firstTouch = this.orb.presence < 0.15;
    this.orb.down(e.clientX, e.clientY);
    if (firstTouch) {
      try {
        navigator.vibrate?.(8);
      } catch {
        /* not allowed */
      }
    }
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    // Use every sample the device reported since last frame, for smooth feeding.
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) this.orb.move(ev.clientX, ev.clientY);
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.orb.up();
  };

  /** Starts a new game from the beginning. */
  start() {
    this.running = true;
    this.view.classList.add('active');
  }

  /** Rebuilds the scene as it was saved, then waits paused. */
  restorePaused() {
    this.running = false;
    this.view.classList.add('active');
  }

  pause() {
    this.running = false;
    this.pointerId = null;
    this.orb.up();
  }

  resume() {
    this.running = true;
  }

  /** Closes the game view (back to the menu). */
  close() {
    this.pause();
    this.view.classList.remove('active');
    for (const [type, l] of this.listeners) this.view.removeEventListener(type, l);
    this.darkness.dispose();
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.darkness.setSize(width, height);
  }

  update(dt: number) {
    if (this.running) {
      this.save.playTime += dt;
      this.orb.update(dt, this.width, this.height);
    }
    // While paused the world holds still, but keep drawing it behind the menu.
    this.darkness.render(this.orb, this.running ? dt : 0);
  }

  /** Writes progress to the device. Returns false if storage is unavailable. */
  saveNow(): boolean {
    this.save.state.orb = this.orb.toSave();
    delete this.save.state.tv; // from earlier versions
    return writeSave(this.save);
  }

  /** For automated tests. */
  get debug() {
    return { orb: this.orb };
  }
}
