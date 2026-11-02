import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { createTv } from './tv';

/** Progress stored in the save file under `state.tv`. */
interface TvState {
  on: boolean;
}

/**
 * The game itself. For now it is a dark room with a television and a single
 * option: turn it on. Each system keeps its progress in `save.state` so it is
 * included in saves automatically.
 */
export class Game {
  running = false;
  private readonly tv;
  private readonly powerBtn: HTMLButtonElement;
  private onAfterPower: (() => void) | null = null;

  constructor(
    readonly save: SaveData,
    private readonly view: HTMLElement,
    renderer: THREE.WebGLRenderer,
    /** onTurnedOn: called when the player switches the TV on (to save). */
    opts: { onTurnedOn?: () => void } = {},
  ) {
    this.tv = createTv(renderer);
    this.powerBtn = view.querySelector('#power-btn') as HTMLButtonElement;
    this.onAfterPower = opts.onTurnedOn ?? null;
    this.powerBtn.onclick = () => this.turnOn();
  }

  private get tvState(): TvState {
    const s = (this.save.state.tv ??= { on: false }) as TvState;
    return s;
  }

  start() {
    this.running = true;
    this.view.classList.add('active');
    if (this.tvState.on) {
      // The set was on when you left: it powers back up as you return.
      this.powerBtn.hidden = true;
      window.setTimeout(() => this.tv.powerOn(), 700);
    } else {
      this.powerBtn.hidden = false;
      this.powerBtn.classList.remove('pressed');
    }
  }

  turnOn() {
    if (this.tvState.on || !this.running) return;
    this.powerBtn.classList.add('pressed');
    this.tvState.on = true;
    this.onAfterPower?.(); // save straight away, so progress is never lost
    window.setTimeout(() => {
      this.powerBtn.hidden = true;
      this.tv.powerOn();
      // The picture snaps open ~0.45 s in: shake the set and buzz the phone.
      window.setTimeout(() => {
        this.view.classList.remove('jolt');
        void this.view.offsetWidth;
        this.view.classList.add('jolt');
        try {
          navigator.vibrate?.([12, 40, 25]);
        } catch {
          /* not allowed here */
        }
      }, 430);
    }, 350);
  }

  pause() {
    this.running = false;
  }

  resume() {
    this.running = true;
  }

  /** Closes the game view (back to the menu). */
  close() {
    this.running = false;
    this.view.classList.remove('active', 'jolt');
    this.tv.powerOff();
  }

  setSize(width: number, height: number) {
    this.tv.setSize(width, height);
  }

  /** Debug: freeze the TV sequence at a moment (seconds), or null to resume. */
  freezeTv(t: number | null) {
    this.tv.freeze(t);
  }

  update(dt: number) {
    if (this.running) this.save.playTime += dt;
    this.tv.update(dt);
  }

  /** Writes progress to the device. Returns false if storage is unavailable. */
  saveNow(): boolean {
    return writeSave(this.save);
  }
}
