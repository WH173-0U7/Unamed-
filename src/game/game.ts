import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { createTv } from './tv';
import { createStreet } from './street';
import type { Kind } from './people';

/** Progress stored in the save file under `state.tv`. */
interface TvState {
  on: boolean;
}

/** Progress stored under `state.lurk`: how often you've lurked, who you've seen. */
interface LurkState {
  times: number;
  seen: Record<Kind | 'nobody', number>;
}

/** The chances of who turns up each time you lurk (out of 100). */
export const CHANCES: [Kind | 'nobody', number][] = [
  ['civilian', 34],
  ['drunk', 20],
  ['homeless', 16],
  ['junkie', 12],
  ['nobody', 18],
];

const NAMES: Record<Kind | 'nobody', string> = {
  civilian: 'A civilian',
  drunk: 'A drunk',
  homeless: 'Someone homeless',
  junkie: 'A junkie',
  nobody: 'Nobody',
};

const LINES: Record<Kind | 'nobody', string[]> = {
  civilian: ['Walking home. They never look up.', 'Hurrying through the light.', 'Just passing through.'],
  drunk: ['Talking to nobody, bottle in hand.', 'Staggering from one light to the next.', 'Holding on to the lamp post for a while.'],
  homeless: ['Settling into the doorway for the night.', 'Everything they own, in a cart.', 'Pulling the blanket up against the cold.'],
  junkie: ['Scratching at an arm, nodding off.', 'Under the lamp, somewhere else entirely.', 'Jerking awake, then sinking again.'],
  nobody: ['Only the hum of the street lamp.', 'The street stays empty.', 'Something moved. Then nothing.'],
};

type Phase = 'idle' | 'cut' | 'waiting' | 'watching';

/**
 * The game itself. It starts with a television in the dark and one option:
 * turn it on. Once it has warmed up, the TV shows a security camera on a
 * night street, and one option: lurk. Each time you lurk, the signal cuts to
 * another camera and you wait to see who comes by: a civilian, a drunk,
 * someone homeless, a junkie, or nobody at all. Each system keeps its
 * progress in `save.state`, so it is saved at every pause point automatically.
 */
export class Game {
  running = false;
  private readonly tv;
  private readonly street = createStreet();
  private readonly powerBtn: HTMLButtonElement;
  private readonly lurkBtn: HTMLButtonElement;
  private readonly seenEl: HTMLElement;
  private phase: Phase = 'idle';
  private timer = 0;
  private jam = 0;
  /** Who is coming this time (null: nobody). */
  private coming: Kind | null = null;
  private named = false;

  constructor(
    readonly save: SaveData,
    private readonly view: HTMLElement,
    renderer: THREE.WebGLRenderer,
  ) {
    this.tv = createTv(renderer);
    this.tv.setPicture(this.street.texture);
    this.powerBtn = view.querySelector('#power-btn') as HTMLButtonElement;
    this.lurkBtn = view.querySelector('#lurk-btn') as HTMLButtonElement;
    this.seenEl = view.querySelector('#seen') as HTMLElement;
    this.powerBtn.onclick = () => this.turnOn();
    this.lurkBtn.onclick = () => this.lurk();
    this.lurkBtn.hidden = true;
    this.seenEl.hidden = true;
  }

  private get tvState(): TvState {
    return (this.save.state.tv ??= { on: false }) as TvState;
  }

  private get lurkState(): LurkState {
    const s = (this.save.state.lurk ??= { times: 0, seen: {} }) as LurkState;
    for (const [k] of CHANCES) s.seen[k] ??= 0;
    return s;
  }

  /** Can you lurk right now? Only once the picture is on screen and nothing's happening. */
  private get canLurk() {
    return this.running && this.tv.showingPicture && this.phase === 'idle';
  }

  /** Lurk: cut to a camera and wait for whoever comes. `who` forces it (tests). */
  lurk(who?: Kind | null) {
    if (!this.canLurk) return;
    this.coming = who !== undefined ? who : roll();
    this.phase = 'cut';
    this.timer = 0.45;
    this.named = false;
    this.lurkBtn.hidden = true;
    this.seenEl.hidden = true;
    buzz(10);
  }

  /** Shows who was seen, in the caption at the top. */
  private name(who: Kind | 'nobody') {
    if (this.named) return;
    this.named = true;
    const lines = LINES[who];
    (this.seenEl.querySelector('.seen-kind') as HTMLElement).textContent = NAMES[who];
    (this.seenEl.querySelector('.seen-kind') as HTMLElement).dataset.text = NAMES[who];
    (this.seenEl.querySelector('.seen-line') as HTMLElement).textContent = lines[Math.floor(Math.random() * lines.length)];
    this.seenEl.hidden = false;
    this.lurkState.seen[who]++;
    this.lurkState.times++;
  }

  private stepLurk(dt: number) {
    this.timer -= dt;
    switch (this.phase) {
      case 'cut':
        // The signal drops out while it switches cameras.
        this.jam = 1;
        if (this.timer <= 0) {
          this.street.newCamera();
          this.phase = 'waiting';
          this.timer = this.coming ? 1.4 + Math.random() * 2.2 : 4 + Math.random() * 2;
        }
        break;
      case 'waiting':
        // The wait: the odd flicker of interference.
        if (Math.random() < dt * 0.7) this.jam = Math.max(this.jam, 0.18 + Math.random() * 0.2);
        if (this.timer <= 0) {
          if (this.coming) {
            this.street.spawn(this.coming);
            this.phase = 'watching';
            this.timer = 40; // safety: never watch forever
          } else {
            this.name('nobody');
            this.phase = 'idle';
          }
        }
        break;
      case 'watching': {
        const p = this.street.person;
        if (p?.revealed) this.name(p.kind);
        if (!p || this.timer <= 0) {
          if (this.coming) this.name(this.coming);
          this.phase = 'idle';
        }
        break;
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
      // The set was already on at the save point: no warm-up, straight to the street camera.
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
    // Everything on the street holds still until you come back.
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
    this.seenEl.hidden = true;
    this.street.dispose();
  }

  setSize(width: number, height: number, pixelRatio = 1) {
    this.tv.setSize(width, height);
    this.street.setSize(width, height, pixelRatio);
  }

  /** Debug: freeze the TV sequence at a moment (seconds), or null to resume. */
  freezeTv(t: number | null) {
    this.tv.freeze(t);
  }

  update(dt: number) {
    if (this.running) {
      this.save.playTime += dt;
      this.stepLurk(dt);
      this.street.step(dt);
    }
    this.jam = Math.max(0, this.jam - dt * 2.2);
    this.tv.setJam(this.jam);
    // The Lurk button shows whenever you're free to lurk.
    const show = this.canLurk;
    if (this.lurkBtn.hidden === show) {
      this.lurkBtn.hidden = !show;
      this.lurkBtn.querySelector('span')!.textContent = this.lurkState.times ? 'Lurk again' : 'Lurk';
    }
    if (this.tv.isOn) this.street.draw(dt);
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
    return { tv: this.tv, street: this.street, phase: this.phase, lurk: this.lurkState };
  }
}

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not allowed */
  }
}

/** Picks who comes, by the chances above. */
function roll(): Kind | null {
  let r = Math.random() * CHANCES.reduce((n, [, c]) => n + c, 0);
  for (const [who, c] of CHANCES) {
    if ((r -= c) < 0) return who === 'nobody' ? null : who;
  }
  return null;
}
