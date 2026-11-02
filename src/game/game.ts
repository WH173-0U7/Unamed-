import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { Whisp, type View, type WhispSave } from './whisp';
import { createDarkness } from './darkness';

/** How quickly the view glides after the Whisp (higher = tighter). */
const VIEW_FOLLOW = 1.6;

/**
 * The game itself. It begins in a dark, endless void: wherever the player
 * touches, the Whisp (a small orb of light) appears and feeds on their movement.
 * Each system keeps its progress in `save.state`, so it is saved at every
 * pause point automatically.
 */
export class Game {
  running = false;
  private readonly whisp;
  private readonly darkness;
  private pointerId: number | null = null;
  /** The part of the void on screen; it glides after the Whisp. */
  private readonly view: View = { x: 0, y: 0, width: 1, height: 1 };
  private readonly listeners: [string, EventListener][] = [];

  constructor(
    readonly save: SaveData,
    private readonly el: HTMLElement,
    renderer: THREE.WebGLRenderer,
  ) {
    // Saves from before the Whisp was named stored it as `orb`.
    this.whisp = new Whisp((save.state.whisp ?? save.state.orb) as WhispSave | undefined);
    this.view.x = this.whisp.pos.x;
    this.view.y = this.whisp.pos.y;
    this.darkness = createDarkness(renderer);
    this.listen('pointerdown', this.onDown);
    this.listen('pointermove', this.onMove);
    this.listen('pointerup', this.onUp);
    this.listen('pointercancel', this.onUp);
  }

  private listen(type: string, fn: (e: PointerEvent) => void) {
    const l = fn as EventListener;
    this.el.addEventListener(type, l);
    this.listeners.push([type, l]);
  }

  private onDown = (e: PointerEvent) => {
    if (!this.running || this.pointerId !== null) return;
    if ((e.target as HTMLElement).closest('button')) return; // e.g. the pause button
    this.pointerId = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
    const firstTouch = this.whisp.presence < 0.15;
    this.whisp.down(e.clientX, e.clientY, this.view);
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
    for (const ev of events.length ? events : [e]) this.whisp.move(ev.clientX, ev.clientY);
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.whisp.up();
  };

  /** Starts a new game from the beginning. */
  start() {
    this.running = true;
    this.el.classList.add('active');
  }

  /** Rebuilds the scene as it was saved, then waits paused. */
  restorePaused() {
    this.running = false;
    this.el.classList.add('active');
  }

  pause() {
    this.running = false;
    this.pointerId = null;
    this.whisp.up();
  }

  resume() {
    this.running = true;
  }

  /** Closes the game view (back to the menu). */
  close() {
    this.pause();
    this.el.classList.remove('active');
    for (const [type, l] of this.listeners) this.el.removeEventListener(type, l);
    this.darkness.dispose();
  }

  setSize(width: number, height: number) {
    this.view.width = width;
    this.view.height = height;
    this.darkness.setSize(width, height);
  }

  update(dt: number) {
    if (this.running) {
      this.save.playTime += dt;
      this.whisp.update(dt, this.view);
      const k = 1 - Math.exp(-dt * VIEW_FOLLOW);
      this.view.x += (this.whisp.pos.x - this.view.x) * k;
      this.view.y += (this.whisp.pos.y - this.view.y) * k;
    }
    // While paused the world holds still, but keep drawing it behind the menu.
    this.darkness.render(this.whisp, this.view, this.running ? dt : 0);
  }

  /** Writes progress to the device. Returns false if storage is unavailable. */
  saveNow(): boolean {
    this.save.state.whisp = this.whisp.toSave();
    delete this.save.state.orb; // older name
    delete this.save.state.tv; // from earlier versions
    return writeSave(this.save);
  }

  /** For automated tests. */
  get debug() {
    return { whisp: this.whisp, view: this.view };
  }
}
