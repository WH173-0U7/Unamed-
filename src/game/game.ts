import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { createTv } from './tv';
import { createMapView } from './mapView';
import { Player, type Direction, type PlayerSave } from './player';
import { isWalkable } from './city';

/** Progress stored in the save file under `state.tv`. */
interface TvState {
  on: boolean;
}

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

/**
 * The game itself. It starts with a television in the dark and one option:
 * turn it on. Once it has warmed up, the TV shows a map of an endless city
 * grid, and the player moves their character one square at a time with the
 * arrows. Each system keeps its progress in `save.state`, so it is saved at
 * every pause point automatically.
 */
export class Game {
  running = false;
  private readonly tv;
  private readonly map = createMapView();
  private readonly player: Player;
  private readonly powerBtn: HTMLButtonElement;
  private readonly dpad: HTMLElement;
  private readonly cleanups: (() => void)[] = [];

  constructor(
    readonly save: SaveData,
    private readonly view: HTMLElement,
    renderer: THREE.WebGLRenderer,
  ) {
    this.tv = createTv(renderer);
    this.tv.setPicture(this.map.texture);

    const saved = save.state.player as PlayerSave | undefined;
    // Start on the street corner at the centre of the city; an old save on a
    // spot that's no longer walkable goes back there too.
    this.player = new Player(saved && isWalkable(saved.x, saved.y) ? saved : undefined);

    this.powerBtn = view.querySelector('#power-btn') as HTMLButtonElement;
    this.powerBtn.onclick = () => this.turnOn();
    this.dpad = view.querySelector('#dpad') as HTMLElement;
    this.bindControls();
  }

  private get tvState(): TvState {
    return (this.save.state.tv ??= { on: false }) as TvState;
  }

  /** Can the player move right now? Only once the picture is on screen. */
  private get canMove() {
    return this.running && this.tv.showingPicture;
  }

  private bindControls() {
    // Keyboard: arrows or WASD. Holding keeps moving.
    const keyDown = (e: KeyboardEvent) => {
      const dir = KEYS[e.code];
      if (!dir || !this.canMove) return;
      e.preventDefault();
      if (!e.repeat) this.player.press(dir);
    };
    const keyUp = (e: KeyboardEvent) => {
      const dir = KEYS[e.code];
      if (dir) this.player.release(dir);
    };
    addEventListener('keydown', keyDown);
    addEventListener('keyup', keyUp);
    this.cleanups.push(() => {
      removeEventListener('keydown', keyDown);
      removeEventListener('keyup', keyUp);
    });

    // On-screen arrows. Holding keeps moving.
    for (const btn of this.dpad.querySelectorAll<HTMLButtonElement>('[data-dir]')) {
      const dir = btn.dataset.dir as Direction;
      const down = (e: PointerEvent) => {
        if (!this.canMove) return;
        e.preventDefault();
        try {
          btn.setPointerCapture(e.pointerId);
        } catch {
          /* not capturable */
        }
        btn.classList.add('down');
        this.player.press(dir);
      };
      const up = () => {
        btn.classList.remove('down');
        this.player.release(dir);
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
      this.cleanups.push(() => {
        btn.removeEventListener('pointerdown', down);
        btn.removeEventListener('pointerup', up);
        btn.removeEventListener('pointercancel', up);
        btn.removeEventListener('lostpointercapture', up);
        btn.classList.remove('down');
      });
    }
  }

  /** Starts a new game from the beginning. */
  start() {
    this.running = true;
    this.view.classList.add('active');
    this.showSavedScene();
  }

  /** Rebuilds the scene exactly as it was saved, then waits paused. */
  restorePaused() {
    this.running = false;
    this.view.classList.add('active');
    this.showSavedScene();
  }

  private showSavedScene() {
    if (this.tvState.on) {
      // The set was already on at the save point: no warm-up, straight to the map.
      this.powerBtn.hidden = true;
      this.tv.powerOnSettled();
    } else {
      this.tv.powerOff();
      this.powerBtn.hidden = false;
      this.powerBtn.classList.remove('pressed');
    }
  }

  turnOn() {
    if (this.tvState.on || !this.running) return;
    this.powerBtn.classList.add('pressed');
    this.tvState.on = true;
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
    this.player.releaseAll();
  }

  resume() {
    this.running = true;
  }

  /** Closes the game view (back to the menu). */
  close() {
    this.pause();
    this.view.classList.remove('active', 'jolt');
    this.dpad.classList.remove('show');
    this.tv.powerOff();
    for (const c of this.cleanups) c();
    this.map.dispose();
  }

  setSize(width: number, height: number, pixelRatio = 1) {
    this.tv.setSize(width, height);
    this.map.setSize(width, height, pixelRatio);
  }

  /** Debug: freeze the TV sequence at a moment (seconds), or null to resume. */
  freezeTv(t: number | null) {
    this.tv.freeze(t);
  }

  update(dt: number) {
    if (this.running) {
      this.save.playTime += dt;
      this.player.update(dt);
    }
    this.dpad.classList.toggle('show', this.tv.showingPicture);
    if (this.tv.isOn) this.map.draw(this.player);
    this.tv.update(dt);
  }

  /** Writes progress to the device. Returns false if storage is unavailable. */
  saveNow(): boolean {
    this.save.state.player = this.player.toSave();
    // Remove state from earlier versions of the game.
    delete this.save.state.whisp;
    delete this.save.state.orb;
    return writeSave(this.save);
  }

  /** For automated tests. */
  get debug() {
    return { player: this.player, tv: this.tv, isWalkable };
  }
}
