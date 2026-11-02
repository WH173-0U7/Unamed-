import { writeSave, type SaveData } from '../core/save';

/**
 * The game itself. Right now it is an empty black screen: every gameplay
 * system will be built here, and each one keeps its progress in
 * `save.state` so it is included in saves automatically.
 */
export class Game {
  running = false;

  constructor(
    readonly save: SaveData,
    private readonly view: HTMLElement,
  ) {}

  start() {
    this.running = true;
    this.view.classList.add('active');
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
    this.view.classList.remove('active');
  }

  update(dt: number) {
    if (!this.running) return;
    this.save.playTime += dt;
  }

  /** Writes progress to the device. Returns false if storage is unavailable. */
  saveNow(): boolean {
    return writeSave(this.save);
  }
}
