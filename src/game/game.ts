import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { createTv } from './tv';
import { CHANCES, RACE_CHANCES, NAMES, makePerson } from './person';
import { act, newEncounter, type Encounter } from './encounter';
import { createEncounterView } from '../ui/encounterView';
import { STAT_NAMES, newStats, xpToNext, MAX_LEVEL, type StatName, type Stats } from './stats';

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

type Phase = 'idle' | 'cut' | 'waiting';

/**
 * The game itself. It starts with a television in the dark and one option:
 * turn it on. Once it has warmed up, there's one option: lurk. Each time you
 * lurk, the signal cuts out while you wait, then whoever you saw shows up as
 * a button (a civilian, a drunk, someone homeless or a junkie, with a race
 * from the U.S. standard categories). Tap them to choose: violence or
 * surveil (see encounter.ts). Each system keeps its progress in
 * `save.state`, so it is saved at every pause point automatically, including
 * an encounter in progress.
 */
export class Game {
  running = false;
  private readonly tv;
  private readonly powerBtn: HTMLButtonElement;
  private readonly lurkBtn: HTMLButtonElement;
  private readonly seenEl: HTMLElement;
  private readonly encView;
  private readonly statsEl: HTMLElement;
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
    this.statsEl = view.querySelector('#stats') as HTMLElement;
    this.encView = createEncounterView(view.querySelector('#enc') as HTMLElement, (id) => this.act(id));
    this.powerBtn.onclick = () => this.turnOn();
    this.lurkBtn.onclick = () => this.lurk();
    this.lurkBtn.hidden = true;
    this.refresh();
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

  /** Your stats: sneak, strength, agility (saved). */
  private get stats(): Stats {
    const s = (this.save.state.stats ??= newStats()) as Stats;
    const fresh = newStats();
    for (const k of Object.keys(fresh) as StatName[]) s[k] ??= fresh[k];
    return s;
  }

  /** The person you saw last, and what's happened with them (saved). */
  private get encounter(): Encounter | null {
    return (this.save.state.encounter as Encounter | undefined) ?? null;
  }
  private set encounter(e: Encounter | null) {
    this.save.state.encounter = e ?? undefined;
  }

  /**
   * Can you lurk right now? Once the TV has warmed up, and not in the middle
   * of something with someone (you can always skip a person you haven't
   * approached).
   */
  private get canLurk() {
    const e = this.encounter;
    return this.running && this.tv.showingPicture && this.phase === 'idle' && (!e || e.stage === 'seen' || e.stage === 'over');
  }

  /** Lurk: the signal cuts out while you wait for whoever comes. */
  lurk() {
    if (!this.canLurk) return;
    this.phase = 'cut';
    this.timer = 0.45;
    this.encounter = null;
    this.refresh();
    this.lurkBtn.hidden = true;
    buzz(10);
  }

  /** An option picked in the encounter (or 'open' from the person button). */
  private act(id: string) {
    const e = this.encounter;
    if (!e || !this.running) return;
    if (id === 'lurk') return this.lurk();
    act(e, id, this.stats);
    buzz(e.stage === 'combat' ? 14 : 6);
    this.refresh();
  }

  /** Redraws the person button and the encounter screen from the saved state. */
  private refresh() {
    const e = this.encounter;
    this.seenEl.replaceChildren();
    this.seenEl.hidden = !(e && e.stage === 'seen');
    if (e && e.stage === 'seen') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seen-btn';
      btn.dataset.kind = e.person.kind;
      btn.dataset.race = e.person.race;
      const k = document.createElement('span');
      k.className = 'seen-kind';
      k.textContent = NAMES[e.person.kind];
      const r = document.createElement('span');
      r.className = 'seen-race';
      r.textContent = e.person.race;
      btn.append(k, r);
      btn.onclick = () => this.act('open');
      this.seenEl.append(btn);
    }
    this.encView.render(this.tvState.on ? e : null);
    this.renderStats();
    this.view.classList.toggle('in-encounter', !!e && e.stage !== 'seen');
  }

  /** Your stats in the top corner, each with progress towards its next level. */
  private renderStats() {
    this.statsEl.hidden = !this.tvState.on;
    const st = this.stats;
    this.statsEl.innerHTML = (Object.keys(STAT_NAMES) as StatName[])
      .map((k) => {
        const { level, xp } = st[k];
        const pct = level >= MAX_LEVEL ? 100 : (100 * xp) / xpToNext(level);
        return `<div class="stat" data-stat="${k}"><span>${STAT_NAMES[k]}</span><b>${level}</b><i><u style="width:${pct}%"></u></i></div>`;
      })
      .join('');
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
        const person = makePerson();
        const s = this.lurkState;
        s.times++;
        s.seen[person.kind]++;
        s.races[person.race]++;
        this.encounter = newEncounter(person);
        this.phase = 'idle';
        this.refresh();
        buzz(14);
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
    this.refresh();
  }

  turnOn() {
    if (this.tvState.on || !this.running) return;
    this.powerBtn.classList.add('pressed');
    this.tvState.on = true;
    window.setTimeout(() => {
      this.powerBtn.hidden = true;
      this.tv.powerOn();
      this.renderStats();
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
    // A lurk cut short by pausing just ends (the save holds no half-lurk).
    if (this.phase !== 'idle') {
      this.phase = 'idle';
      this.jam = 0;
    }
  }

  resume() {
    this.running = true;
  }

  /** Closes the game view (back to the menu). */
  close() {
    this.pause();
    this.view.classList.remove('active', 'jolt', 'in-encounter');
    this.tv.powerOff();
    this.lurkBtn.hidden = true;
    this.seenEl.replaceChildren();
    this.seenEl.hidden = true;
    this.encView.render(null);
    this.statsEl.hidden = true;
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
    const e = this.encounter;
    const show = this.canLurk && !(e && e.stage === 'over'); // then it's in the encounter screen
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
    return { tv: this.tv, phase: this.phase, lurk: this.lurkState, encounter: this.encounter, stats: this.stats };
  }
}

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not allowed */
  }
}
