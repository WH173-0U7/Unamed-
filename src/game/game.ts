import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { createTv } from './tv';
import { CHANCES, RACE_CHANCES, NAMES, makePerson } from './person';
import { ENCOUNTER_VERSION, act, newEncounter, type Encounter } from './encounter';
import { createEncounterView } from '../ui/encounterView';
import { STAT_NAMES, newStats, xpToNext, MAX_LEVEL, maxStamina, type StatName, type Stats } from './stats';
import { LURK_HOURS, REST_HOURS, afterFight, bodyFrom, healthConditions, isHurt, newHealth, passHours, type Health } from './health';
import { PASS_OUT, type Impact } from './encounter';
import type { Glass } from '../fx/glass';
import { createHitUi } from '../fx/hitUi';

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
  private readonly hitUi;
  private readonly timers: number[] = [];
  private readonly statsEl: HTMLElement;
  private readonly youEl: HTMLElement;
  private readonly restBtn: HTMLButtonElement;
  private readonly noteEl: HTMLElement;
  private noteTimer = 0;
  private phase: Phase = 'idle';
  private timer = 0;
  private jam = 0;

  constructor(
    readonly save: SaveData,
    private readonly view: HTMLElement,
    renderer: THREE.WebGLRenderer,
    private readonly fx: Glass,
  ) {
    this.tv = createTv(renderer);
    this.powerBtn = view.querySelector('#power-btn') as HTMLButtonElement;
    this.lurkBtn = view.querySelector('#lurk-btn') as HTMLButtonElement;
    this.seenEl = view.querySelector('#seen') as HTMLElement;
    this.statsEl = view.querySelector('#stats') as HTMLElement;
    this.youEl = view.querySelector('#you-status') as HTMLElement;
    this.restBtn = view.querySelector('#rest-btn') as HTMLButtonElement;
    this.noteEl = view.querySelector('#note') as HTMLElement;
    this.restBtn.onclick = () => this.rest();
    this.restBtn.hidden = true;
    this.hitUi = createHitUi(view);
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

  /** Your body between fights: blood and injuries carry over (saved). */
  private get health(): Health {
    return (this.save.state.health ??= newHealth()) as Health;
  }

  /** Your body as it is now, ready for a fight. */
  private yourBody() {
    return bodyFrom(this.health, maxStamina(this.stats));
  }

  /** A few lines shown in the middle of the screen for a while. */
  private note(lines: string[]) {
    if (!lines.length) return;
    this.noteEl.replaceChildren(...lines.map((l) => Object.assign(document.createElement('p'), { textContent: l })));
    this.noteEl.hidden = false;
    this.noteEl.style.animation = 'none';
    void this.noteEl.offsetWidth;
    this.noteEl.style.animation = '';
    this.noteTimer = 3 + lines.length * 1.2;
  }

  /** Rest: several hours pass, and you heal. */
  rest() {
    if (!this.canLurk || !isHurt(this.health)) return;
    this.encounter = null;
    this.wipeBlood();
    const lines = ['You find somewhere quiet and rest for a few hours.', ...passHours(this.health, REST_HOURS, true)];
    this.refresh();
    this.note(lines);
    buzz(8);
  }

  /** The person you saw last, and what's happened with them (saved). */
  private get encounter(): Encounter | null {
    const e = this.save.state.encounter as Encounter | undefined;
    // An encounter saved by an older version of the game can't be continued.
    if (e && e.version !== ENCOUNTER_VERSION) {
      delete this.save.state.encounter;
      return null;
    }
    return e ?? null;
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
    this.noteEl.hidden = true;
    this.wipeBlood();
    // Time passes while you wait: wounds bleed, or heal.
    const lines = passHours(this.health, LURK_HOURS);
    this.refresh();
    this.lurkBtn.hidden = true;
    this.restBtn.hidden = true;
    if (lines.some((l) => l.includes('collapse'))) {
      // Collapsed from blood loss: nobody this time.
      this.phase = 'idle';
      this.note(lines);
      return;
    }
    this.note(lines);
    buzz(10);
  }

  /** An option picked in the encounter (or 'open' from the person button). */
  private act(id: string) {
    const e = this.encounter;
    if (!e || !this.running) return;
    if (id === 'lurk') return this.lurk();
    if (id === 'rest') return this.rest();
    // Approaching someone: bring your body as it is now.
    if (e.stage === 'seen') e.you = this.yourBody();
    const wasOver = e.stage === 'over';
    const impacts = act(e, id, this.stats);
    if (!wasOver && e.stage === 'over') {
      for (const text of afterFight(this.health, e.you, e.result!)) e.log.push({ by: 'info', text });
    }
    if (impacts.length) this.feel(impacts);
    else buzz(6);
    this.refresh();
  }

  /**
   * Blows landing, felt on the screen and in the hand: glitches, static,
   * shaking, colour fringing, blood on the glass and the panels, a red edge
   * when you're the one hit, and vibration. One after another, a beat apart.
   */
  private feel(impacts: Impact[]) {
    impacts.forEach((im, i) => {
      const t = window.setTimeout(() => {
        const you = im.target === 'you';
        const power = Math.min(1, im.ml / 600) * (im.severe ? 1.3 : 1);
        this.fx.impact(you, im.ml, im.severe);
        this.hitUi.kick(power, you);
        if (you && (power > 0.35 || Math.random() < 0.4)) this.hitUi.splash(im.severe ? 2 : 1, im.severe);
        if (!you && im.severe && Math.random() < 0.6) this.hitUi.splash(1, false);
        this.jam = Math.max(this.jam, (you ? 0.45 : 0.25) + power * 0.4);
        if (you) buzz(im.severe ? [70, 40, 110] : [35 + Math.round(power * 30), 25, 45]);
        else buzz(im.severe ? [25, 35, 45] : [14 + Math.round(power * 16)]);
      }, i * 280);
      this.timers.push(t);
    });
  }

  /**
   * Clean the blood off the panels (they're put away). The blood on the
   * screen itself stays until you wipe it off with your finger.
   */
  private wipeBlood() {
    this.hitUi.clear();
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
    this.renderYou(!!e && e.stage !== 'seen');
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

  /** Your blood and injuries, under your stats (when not in an encounter). */
  private renderYou(inEncounter: boolean) {
    const h = this.health;
    this.youEl.hidden = !this.tvState.on || inEncounter;
    const pct = (100 * h.blood) / h.maxBlood;
    this.youEl.innerHTML =
      `<div class="you-blood"><span>Blood</span><i><b style="width:${pct}%"></b><s style="left:${PASS_OUT * 100}%"></s></i><em>${(h.blood / 1000).toFixed(1)} L</em></div>` +
      `<div class="enc-conds">${healthConditions(h).map((c) => `<span>${c}</span>`).join('')}</div>`;
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
        this.encounter = newEncounter(person, this.yourBody());
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
      this.refresh();
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
    for (const t of this.timers) clearTimeout(t);
    this.fx.setLow(0);
    this.hitUi.clear();
    this.view.style.transform = '';
    this.pause();
    this.view.classList.remove('active', 'jolt', 'in-encounter');
    this.tv.powerOff();
    this.lurkBtn.hidden = true;
    this.seenEl.replaceChildren();
    this.seenEl.hidden = true;
    this.encView.render(null);
    this.statsEl.hidden = true;
    this.youEl.hidden = true;
    this.restBtn.hidden = true;
    this.noteEl.hidden = true;
  }

  setSize(width: number, height: number, pixelRatio = 1) {
    void pixelRatio;
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
    const rest = show && isHurt(this.health);
    if (this.restBtn.hidden === rest) this.restBtn.hidden = !rest;
    if (this.noteTimer > 0 && (this.noteTimer -= dt) <= 0) this.noteEl.hidden = true;
    this.tv.update(dt);
    // The red edge pulses when your blood is low.
    const e2 = this.encounter;
    const body = e2 && e2.stage !== 'seen' ? e2.you : this.health;
    const frac = body.blood / body.maxBlood;
    this.fx.setLow(this.tvState.on ? Math.min(1, Math.max(0, (0.82 - frac) / (0.82 - PASS_OUT))) : 0);
    this.hitUi.update(dt);
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
    return { tv: this.tv, phase: this.phase, lurk: this.lurkState, encounter: this.encounter, stats: this.stats, health: this.health };
  }
}

function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not allowed */
  }
}
