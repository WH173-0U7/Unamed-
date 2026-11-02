import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { createTv } from './tv';

/** Who you can see when you lurk. */
export type Kind = 'homeless' | 'junkie' | 'drunk' | 'civilian';

/** Race categories: the U.S. federal standard (OMB, 2024). */
export type Race =
  | 'American Indian or Alaska Native'
  | 'Asian'
  | 'Black or African American'
  | 'Hispanic or Latino'
  | 'Middle Eastern or North African'
  | 'Native Hawaiian or Pacific Islander'
  | 'White';

/** Progress stored in the save file under `state.tv`. */
interface TvState {
  on: boolean;
}

/** Progress stored under `state.lurk`: how often you've lurked, who you've seen. */
interface LurkState {
  times: number;
  seen: Record<string, number>;
  races: Record<string, number>;
}

/** The chances of who turns up each time you lurk (out of 100). */
export const CHANCES: [Kind | 'nobody', number][] = [
  ['civilian', 34],
  ['drunk', 20],
  ['homeless', 16],
  ['junkie', 12],
  ['nobody', 18],
];

/** The chances of each race for whoever turns up (equal for now). */
export const RACE_CHANCES: [Race, number][] = [
  ['American Indian or Alaska Native', 1],
  ['Asian', 1],
  ['Black or African American', 1],
  ['Hispanic or Latino', 1],
  ['Middle Eastern or North African', 1],
  ['Native Hawaiian or Pacific Islander', 1],
  ['White', 1],
];

const NAMES: Record<Kind, string> = {
  civilian: 'Civilian',
  drunk: 'Drunk',
  homeless: 'Homeless',
  junkie: 'Junkie',
};

type Phase = 'idle' | 'cut' | 'waiting';

/**
 * The game itself. It starts with a television in the dark and one option:
 * turn it on. Once it has warmed up, there's one option: lurk. Each time you
 * lurk, the signal cuts out while you wait, then whoever you saw shows up as
 * a button: a civilian, a drunk, someone homeless or a junkie, each one of
 * the U.S. standard race categories. Or nobody at all. Each system keeps its
 * progress in `save.state`, so it is saved at every pause point automatically.
 */
export class Game {
  running = false;
  private readonly tv;
  private readonly powerBtn: HTMLButtonElement;
  private readonly lurkBtn: HTMLButtonElement;
  private readonly seenEl: HTMLElement;
  private phase: Phase = 'idle';
  private timer = 0;
  private jam = 0;

  constructor(
    readonly save: SaveData,
    private readonly view: HTMLElement,
    renderer: THREE.WebGLRenderer,
  ) {
    this.tv = createTv(renderer);
    this.powerBtn = view.querySelector('#power-btn') as HTMLButtonElement;
    this.lurkBtn = view.querySelector('#lurk-btn') as HTMLButtonElement;
    this.seenEl = view.querySelector('#seen') as HTMLElement;
    this.powerBtn.onclick = () => this.turnOn();
    this.lurkBtn.onclick = () => this.lurk();
    this.lurkBtn.hidden = true;
    this.clearSeen();
  }

  private get tvState(): TvState {
    return (this.save.state.tv ??= { on: false }) as TvState;
  }

  private get lurkState(): LurkState {
    const s = (this.save.state.lurk ??= { times: 0, seen: {}, races: {} }) as LurkState;
    s.races ??= {};
    for (const [k] of CHANCES) s.seen[k] ??= 0;
    for (const [r] of RACE_CHANCES) s.races[r] ??= 0;
    return s;
  }

  /** Can you lurk right now? Only once the TV has warmed up and nothing's happening. */
  private get canLurk() {
    return this.running && this.tv.showingPicture && this.phase === 'idle';
  }

  /** Lurk: the signal cuts out while you wait for whoever comes. */
  lurk() {
    if (!this.canLurk) return;
    this.phase = 'cut';
    this.timer = 0.45;
    this.lurkBtn.hidden = true;
    this.clearSeen();
    buzz(10);
  }

  private clearSeen() {
    this.seenEl.replaceChildren();
    this.seenEl.hidden = true;
  }

  /** Shows who you saw: a button for them (or a quiet "Nobody"). */
  private show(who: Kind | null, race: Race | null) {
    const s = this.lurkState;
    s.times++;
    s.seen[who ?? 'nobody']++;
    if (race) s.races[race]++;
    if (who && race) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seen-btn';
      btn.dataset.kind = who;
      btn.dataset.race = race;
      const k = document.createElement('span');
      k.className = 'seen-kind';
      k.textContent = NAMES[who];
      const r = document.createElement('span');
      r.className = 'seen-race';
      r.textContent = race;
      btn.append(k, r);
      btn.onclick = () => buzz(8); // what it does comes later
      this.seenEl.append(btn);
    } else {
      const n = document.createElement('div');
      n.className = 'seen-nobody';
      n.textContent = 'Nobody';
      this.seenEl.append(n);
    }
    this.seenEl.hidden = false;
    buzz(14);
  }

  private stepLurk(dt: number) {
    this.timer -= dt;
    if (this.phase === 'cut') {
      // The signal drops out.
      this.jam = 1;
      if (this.timer <= 0) {
        this.phase = 'waiting';
        this.timer = 1.2 + Math.random() * 1.6;
      }
    } else if (this.phase === 'waiting') {
      // The wait: the odd flicker of interference.
      if (Math.random() < dt * 0.9) this.jam = Math.max(this.jam, 0.2 + Math.random() * 0.25);
      if (this.timer <= 0) {
        const who = pick(CHANCES);
        this.show(who === 'nobody' ? null : who, who === 'nobody' ? null : pick(RACE_CHANCES));
        this.phase = 'idle';
      }
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
      // The set was already on at the save point: no warm-up.
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
  }

  resume() {
    this.running = true;
  }

  /** Closes the game view (back to the menu). */
  close() {
    this.pause();
    this.view.classList.remove('active', 'jolt');
    this.phase = 'idle';
    this.tv.powerOff();
    this.lurkBtn.hidden = true;
    this.clearSeen();
  }

  setSize(width: number, height: number, _pixelRatio = 1) {
    this.tv.setSize(width, height);
  }

  /** Debug: freeze the TV sequence at a moment (seconds), or null to resume. */
  freezeTv(t: number | null) {
    this.tv.freeze(t);
  }

  update(dt: number) {
    if (this.running) {
      this.save.playTime += dt;
      this.stepLurk(dt);
    }
    this.jam = Math.max(0, this.jam - dt * 2.2);
    this.tv.setJam(this.jam);
    // The Lurk button shows whenever you're free to lurk.
    const show = this.canLurk;
    if (this.lurkBtn.hidden === show) {
      this.lurkBtn.hidden = !show;
      this.lurkBtn.querySelector('span')!.textContent = this.lurkState.times ? 'Lurk again' : 'Lurk';
    }
    this.tv.update(dt);
  }

  /** Writes progress to the device. Returns false if storage is unavailable. */
  saveNow(): boolean {
    void this.lurkState;
    // Remove state from earlier versions of the game.
    delete this.save.state.player;
    delete this.save.state.whisp;
    delete this.save.state.orb;
    return writeSave(this.save);
  }

  /** For automated tests. */
  get debug() {
    return { tv: this.tv, phase: this.phase, lurk: this.lurkState };
  }
}

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not allowed */
  }
}

/** Picks one option, weighted by its chance. */
function pick<T>(table: [T, number][]): T {
  let r = Math.random() * table.reduce((n, [, c]) => n + c, 0);
  for (const [v, c] of table) if ((r -= c) < 0) return v;
  return table[table.length - 1][0];
}
