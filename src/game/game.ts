import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { createTv } from './tv';
import { createMapView, type RouteDisplay } from './mapView';
import { Player, type PlayerSave } from './player';
import { buildingAt, isWalkable, type Building } from './city';
import { findPath, nearestWalkable, type Square } from './path';

/** Progress stored in the save file under `state.tv`. */
interface TvState {
  on: boolean;
}

/**
 * The game itself. It starts with a television in the dark and one option:
 * turn it on. Once it has warmed up, the TV shows a map of an endless city
 * grid. The player taps a spot once to see the route there, and taps it
 * again to confirm; the character then walks there by itself, square by
 * square. Each system keeps its progress in `save.state`, so it is saved at
 * every pause point automatically.
 */
export class Game {
  running = false;
  private readonly tv;
  private readonly map = createMapView();
  private readonly player: Player;
  private readonly powerBtn: HTMLButtonElement;
  private readonly cleanups: (() => void)[] = [];
  /** A route shown but not yet confirmed. */
  private planned: Square[] | null = null;
  /** The building that route leads to (if a building was tapped). */
  private plannedBuilding: Building | null = null;
  /** The building being walked to. */
  private visiting: Building | null = null;

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
    this.bindTaps();
  }

  private get tvState(): TvState {
    return (this.save.state.tv ??= { on: false }) as TvState;
  }

  /** Can the player move right now? Only once the picture is on screen. */
  private get canMove() {
    return this.running && this.tv.showingPicture;
  }

  private bindTaps() {
    // A tap = a quick press that barely moves (so a slipped finger isn't a tap).
    let start: { id: number; x: number; y: number; t: number } | null = null;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return; // e.g. the pause button
      start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const s0 = start;
      start = null;
      if (Math.hypot(e.clientX - s0.x, e.clientY - s0.y) > 14 || performance.now() - s0.t > 700) return;
      this.tap(e.clientX, e.clientY);
    };
    const cancel = () => (start = null);
    this.view.addEventListener('pointerdown', down);
    this.view.addEventListener('pointerup', up);
    this.view.addEventListener('pointercancel', cancel);
    this.cleanups.push(() => {
      this.view.removeEventListener('pointerdown', down);
      this.view.removeEventListener('pointerup', up);
      this.view.removeEventListener('pointercancel', cancel);
    });
  }

  /**
   * First tap: plan and show the route there. Tapping a building plans a
   * route to its front door and outlines it.
   * Tap the same building or destination again: confirm, and walk there.
   * Tap anywhere else: plan a new route instead (stopping if already walking).
   */
  private tap(x: number, y: number) {
    if (!this.canMove) return;
    const hit = this.map.squareAt(x, y);
    if (!hit) return;

    // Tapping a building means "go to that building": its front door.
    const building = buildingAt(hit.x + hit.fx, hit.y + hit.fy);
    const visit = building && !building.courtyard && building.door ? building : null;
    const target = visit ? visit.door! : nearestWalkable(hit.x, hit.y, hit.fx, hit.fy);

    // A tap on the planned building, its door, or right by the marker confirms.
    const dest = this.planned?.[this.planned.length - 1];
    if (
      dest &&
      ((visit && visit.id === this.plannedBuilding?.id) ||
        (target && target.x === dest.x && target.y === dest.y) ||
        Math.max(Math.abs(hit.x - dest.x), Math.abs(hit.y - dest.y)) <= 1)
    ) {
      this.player.walk(this.planned!);
      this.visiting = this.plannedBuilding;
      this.planned = null;
      this.plannedBuilding = null;
      buzz(12);
      return;
    }

    // Otherwise plan a new route, from the square the player is on (or stepping onto).
    const from = this.player.nextSquare;
    if (!target) return;
    if (target.x === from.x && target.y === from.y) {
      // Already standing there: just show it (a building's door you're at).
      this.planned = null;
      this.plannedBuilding = null;
      return;
    }
    const route = findPath(from, target);
    if (!route || !route.length) return;
    if (this.player.walking) this.player.stop();
    this.visiting = null;
    this.planned = route;
    this.plannedBuilding = visit;
    buzz(6);
  }

  /** What the map should show: a planned route, or what's left of the walk. */
  private get routeDisplay(): RouteDisplay | null {
    if (this.planned) return { squares: this.planned, confirmed: false, building: this.plannedBuilding };
    if (this.player.walking) {
      return { squares: [{ x: this.player.x, y: this.player.y }, ...this.player.route], confirmed: true, building: this.visiting };
    }
    return null;
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
    // Pausing ends any walk at the next square; the save holds where it stops.
    this.player.stop();
    this.planned = null;
    this.plannedBuilding = null;
    this.visiting = null;
  }

  resume() {
    this.running = true;
  }

  /** Closes the game view (back to the menu). */
  close() {
    this.pause();
    this.view.classList.remove('active', 'jolt');
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
    if (this.tv.isOn) this.map.draw(this.player, this.routeDisplay, dt);
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
    return { player: this.player, tv: this.tv, isWalkable, buildingAt, map: this.map, planned: this.planned, plannedBuilding: this.plannedBuilding };
  }
}

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not allowed */
  }
}
