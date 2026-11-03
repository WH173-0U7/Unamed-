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
import { uiGlitch } from '../fx/uiGlitch';
import { clockText, dateText, now } from './clock';
import { RAIN_AMOUNT, WEATHER_NAME, newWeather, updateWeather, weatherLine, type WeatherState } from './weather';
import { COLD_NAMES } from './health';
import { maybeThief, newWorld, robBody, settle, type World } from './legacy';
import { MEDS, cashOf, purseKg, wear, kgLabel, measure, medById, newInventory, noRoomWhy, stow, upgradeInventory, usedKg, type Inventory, type MedId } from './inventory';

/**
 * What's left of your humanity. Killing someone takes a lot of it; stamping
 * on someone who's already unconscious takes a little. It only goes one way:
 * cold, then cruel, then heartless, and in the end a husk, with no humanity
 * left inside. Saved under `state.humanity`.
 */
interface Humanity {
  lost: number;
  kills: number;
}
const HUMANITY: { at: number; name: string; line: string }[] = [
  { at: 10, name: 'Cold', line: 'Something in you has gone cold.' },
  { at: 30, name: 'Cruel', line: "You've started to enjoy their pain." },
  { at: 60, name: 'Heartless', line: 'You feel nothing for them. Nothing at all.' },
  { at: 100, name: 'Husk', line: "There's nothing left inside you. You're a husk." },
];
const humanityLevel = (lost: number) => HUMANITY.filter((l) => lost >= l.at).pop() ?? null;
const KILL_COST = 10;
const STOMP_HELPLESS_COST = 1;

import { COIN_MACHINE_FEE, PAWN_STOCK, PLACES, offer, placeInfo, type Place } from './shops';
import { BILLS, COINS, addTo, breakBill, breaksInto, cashLike, coinsToBills, changeUp, count, denomName, fewest, isBill, money, pay, purseText } from './money';
import { hoursText, isOpen } from './clock';
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
  /** You bled out, and the death screen is up. */
  dead = false;
  /** Called the moment you die (to save: the world goes on without you). */
  onDeath?: () => void;
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
  private readonly goBtn: HTMLButtonElement;
  private readonly bagBtn: HTMLButtonElement;
  private readonly shopEl: HTMLElement;
  private readonly sheetEl: HTMLElement;
  private sheet: 'places' | 'pockets' | null = null;
  private noteTimer = 0;
  private readonly clockEl: HTMLElement;
  private clockShown = '';
  private weatherTimer = 0;
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
    this.clockEl = view.querySelector('#clock') as HTMLElement;
    this.restBtn.onclick = () => this.rest();
    this.goBtn = view.querySelector('#go-btn') as HTMLButtonElement;
    this.bagBtn = view.querySelector('#bag-btn') as HTMLButtonElement;
    this.shopEl = view.querySelector('#shop') as HTMLElement;
    this.sheetEl = view.querySelector('#sheet') as HTMLElement;
    this.goBtn.onclick = () => this.openSheet('places');
    this.bagBtn.onclick = () => this.openSheet('pockets');
    this.edgeSwipes();
    this.sheetEl.onclick = (ev) => this.sheetClick(ev);
    this.shopEl.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.buy) this.buy(b.dataset.buy as MedId);
      else if (b.dataset.sell) this.sell(Number(b.dataset.sell));
      else if (b.dataset.stock) this.buyStock(b.dataset.stock);
      else if (b.dataset.bank) this.bank(b.dataset.bank);
    };
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

  /** What's in your pockets: cash, loot, medicine (saved). */
  private get inventory(): Inventory {
    const inv = (this.save.state.inventory ??= newInventory()) as Inventory;
    upgradeInventory(inv);
    return inv;
  }

  private get weather(): WeatherState {
    return (this.save.state.weather ??= newWeather()) as WeatherState;
  }

  /** How hard it's raining where you are (0 indoors), for the rain. */
  get rainAmount(): number {
    if (!this.tvState.on || placeInfo(this.place).indoors) return 0;
    return RAIN_AMOUNT[this.weather.now];
  }

  /**
   * Time out on the street: the rain soaks you and you get colder (a coat
   * helps, a T-shirt doesn't); dry weather lets you dry off. Returns what
   * to say, if anything.
   */
  private chill(): string | null {
    const h = this.health;
    const cold = h.cold ?? 0;
    const rain = RAIN_AMOUNT[this.weather.now];
    const top = this.inventory.clothes[0] ?? '';
    const warm = /coat|parka|puffer|leather|layered/i.test(top) ? 0.5 : /t-shirt|shirt/i.test(top) ? 1.4 : 1;
    if (rain > 0 && cold < 3 && Math.random() < rain * 0.65 * warm) {
      h.cold = cold + 1;
      return [
        '',
        `The rain soaks through your ${top.toLowerCase() || 'clothes'}. You're chilled.`,
        "You're soaked through and cold to the bone.",
        "You can't stop shivering. Your fingers won't work properly. You're freezing.",
      ][h.cold];
    }
    if (rain === 0 && cold > 0 && Math.random() < 0.35) {
      h.cold = cold - 1;
      return h.cold ? 'You dry off a little.' : "You've dried off. You're warm enough again.";
    }
    return null;
  }

  private get world(): World {
    return (this.save.state.world ??= newWorld()) as World;
  }

  private get humanity(): Humanity {
    return (this.save.state.humanity ??= { lost: 0, kills: 0 }) as Humanity;
  }

  /** Loses some humanity; returns the line to show if it got worse. */
  private loseHumanity(n: number): string | null {
    const h = this.humanity;
    const before = humanityLevel(h.lost);
    h.lost += n;
    const after = humanityLevel(h.lost);
    return after && after !== before ? `${after.line} (Humanity: ${after.name})` : null;
  }

  /** Where you are (saved). */
  private get place(): Place {
    return (this.save.state.place as Place) ?? 'street';
  }
  private set place(p: Place) {
    this.save.state.place = p;
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
    if (!this.canLurk) return;
    if (!isHurt(this.health)) {
      this.note(["You're not hurt. There's nothing to rest off."]);
      return;
    }
    this.encounter = null;
    this.wipeBlood();
    const raining = RAIN_AMOUNT[this.weather.now] > 0;
    const lines = [raining ? 'You find a doorway out of the rain and rest for a few hours.' : 'You find somewhere quiet and rest for a few hours.', ...passHours(this.health, REST_HOURS, true)];
    if (this.health.dead) return this.die(lines);
    const h = this.health;
    if (h.cold) {
      // Out of the wind you warm up a little; dry, you warm up more.
      h.cold = Math.max(0, h.cold - (raining ? 1 : 2));
      lines.push(h.cold ? `You're still ${COLD_NAMES[h.cold].toLowerCase()}, but less.` : 'You stop shivering.');
    }
    if (h.wired) {
      h.wired = false;
      lines.push('The coke wears off while you sit there. You feel hollow.');
    }
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
    // Done with whoever was there: if they had your old things, remember
    // what's left on them.
    const old = this.encounter;
    if (old && old !== e) settle(this.world, old);
    this.save.state.encounter = e ?? undefined;
  }

  /**
   * Can you lurk right now? Once the TV has warmed up, and not in the middle
   * of something with someone (you can always skip a person you haven't
   * approached).
   */
  private get canLurk() {
    const e = this.encounter;
    return this.running && this.tv.showingPicture && this.phase === 'idle' && this.place === 'street' && (!e || e.stage === 'seen' || e.stage === 'over');
  }

  /** Lurk: the signal cuts out while you wait for whoever comes. */
  lurk() {
    if (!this.canLurk) return;
    this.phase = 'cut';
    this.timer = 0.45;
    this.encounter = null;
    this.noteEl.hidden = true;
    this.wipeBlood();
    // Time passes while you wait: wounds bleed, or heal; the rain soaks you.
    const lines = passHours(this.health, LURK_HOURS);
    if (this.health.dead) return this.die(lines);
    const c = this.chill();
    if (c) lines.push(c);
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
    if (id === 'pockets') return this.openSheet('pockets');
    if (id === 'go') return this.openSheet('places');
    // Approaching someone: bring your body as it is now.
    if (e.stage === 'seen') e.you = this.yourBody();
    const wasOver = e.stage === 'over';
    const wasOut = !!e.them.out;
    const impacts = act(e, id, this.stats, this.inventory);
    const worse: string[] = [];
    // Stamping on someone who can't defend themselves.
    if (wasOut && id.startsWith('stomp')) {
      const l = this.loseHumanity(STOMP_HELPLESS_COST);
      if (l) worse.push(l);
    }
    if (!wasOver && e.stage === 'over') {
      if (e.result === 'killed') {
        this.humanity.kills++;
        const l = this.loseHumanity(KILL_COST);
        if (l) worse.push(l);
      }
      // It's done: the log is cleared (the title says how it ended), keeping
      // only what happens to you afterwards.
      e.log = afterFight(this.health, e.you, e.result!).map((text) => ({ by: 'info' as const, text }));
    }
    for (const text of worse) e.log.push({ by: 'info', text });
    if (this.health.dead) {
      if (impacts.length) this.feel(impacts);
      return this.die(e.log.map((l) => l.text));
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
        // Blood only when the blow would throw it (see Spill).
        this.fx.impact(you, im.ml, im.severe, im.spill);
        if (im.ml > 0) this.hitUi.kick(power, you);
        const wet = im.spill === 'splash' || im.spill === 'spray' || (im.spill === 'spatter' && you);
        if (wet && you && (power > 0.35 || Math.random() < 0.4)) this.hitUi.splash(im.severe ? 2 : 1, im.severe);
        if (wet && !you && im.severe && Math.random() < 0.6) this.hitUi.splash(1, false);
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

  // ---------- Places, pockets, the pharmacy ----------

  /** Free to do something else: no one in front of you but maybe a passer-by. */
  private get idle() {
    const e = this.encounter;
    return this.running && this.tv.showingPicture && this.phase === 'idle' && (!e || e.stage === 'seen');
  }

  /** Pockets and Go can be opened when idle, and once a fight is over (from its options). */
  private get canOpenSheet() {
    const e = this.encounter;
    return this.idle || (this.running && !!e && e.stage === 'over');
  }

  /**
   * You bled out. That character is gone for good: whoever finds the body
   * takes everything on it (see legacy.ts), and you go on as someone new,
   * with nothing. The world remembers.
   */
  private die(lines: string[]) {
    if (this.dead) return;
    this.dead = true;
    this.running = false;
    this.closeSheet();
    this.fx.impact(true, 900, true);
    buzz([120, 80, 200, 120, 400]);
    const h = this.humanity;
    const lvl = humanityLevel(h.lost);
    const w = this.world;
    const cash = cashOf(this.inventory);
    const lurked = this.lurkState.times - w.lifeStart;
    // The encounter you died in (its person may be the one who robs you).
    const e = this.encounter;
    if (e) settle(w, e);
    const robbed = robBody(w, this.inventory, e);
    // A new you: nothing carried over but the world.
    for (const k of ['encounter', 'stats', 'health', 'inventory', 'humanity', 'place']) delete this.save.state[k];
    w.lives++;
    w.lifeStart = this.lurkState.times;
    this.onDeath?.();
    const el = document.createElement('div');
    el.id = 'death';
    const p = (t: string) => `<p>${t}</p>`;
    el.innerHTML =
      `<h2>You bled out.</h2>` +
      `<div class="death-lines">${lines.slice(-2).map(p).join('')}</div>` +
      `<dl class="death-sum">` +
      `<div><dt>Lurked</dt><dd>${lurked}</dd></div>` +
      `<div><dt>Killed</dt><dd>${h.kills}</dd></div>` +
      `<div><dt>Humanity</dt><dd>${lvl?.name ?? (h.lost ? 'Shaken' : 'Intact')}</dd></div>` +
      `<div><dt>Cash</dt><dd>${money(Math.round(cash * 100))}</dd></div>` +
      `</dl>` +
      `<p class="death-after">${
        robbed
          ? 'Someone went through your pockets before you were cold. Whatever you had is out there now, on somebody.'
          : 'There was nothing on you worth taking.'
      }</p>` +
      `<button type="button" class="death-btn">Go on as someone new</button>`;
    el.querySelector('button')!.addEventListener('click', () => this.rebirth());
    this.view.append(el);
  }

  /** Off the death screen: a new character, same streets. */
  private rebirth() {
    document.getElementById('death')?.remove();
    this.dead = false;
    this.running = true;
    this.phase = 'idle';
    this.hitUi.clear();
    this.refresh();
    this.note(['Someone else now. Same streets. Empty pockets.']);
  }

  /**
   * Where to go slides in from the left edge, your pockets from the right:
   * put your finger on the edge (or its tab) and pull it in. Push a drawer
   * back towards its edge to put it away.
   */
  private edgeSwipes() {
    const EDGE = 44;
    type Drag = { id: number; x: number; y: number; side: 'left' | 'right'; closing: boolean };
    let drag: Drag | null = null;
    const down = (id: number, x: number, y: number, target: EventTarget | null) => {
      drag = null;
      if (!this.running) return;
      if (this.sheet) {
        // On the open drawer: a push back towards its edge closes it.
        const side = this.sheetEl.classList.contains('from-right') ? 'right' : 'left';
        drag = { id, x, y, side, closing: true };
        return;
      }
      if (!this.canOpenSheet) return;
      const tab = (target as Element | null)?.closest?.('.edge-tab');
      if (tab === this.goBtn || (!tab && x < EDGE)) drag = { id, x, y, side: 'left', closing: false };
      else if (tab === this.bagBtn || (!tab && x > innerWidth - EDGE)) drag = { id, x, y, side: 'right', closing: false };
    };
    const move = (id: number, x: number, y: number) => {
      if (!drag || drag.id !== id) return;
      const inward = (x - drag.x) * (drag.side === 'left' ? 1 : -1);
      const dy = Math.abs(y - drag.y);
      if (!drag.closing && inward > 34 && inward > dy * 1.2) {
        const side = drag.side;
        drag = null;
        this.openSheet(side === 'left' ? 'places' : 'pockets');
      } else if (drag.closing && -inward > 60 && -inward > dy * 1.2) {
        drag = null;
        this.closeSheet();
      }
    };
    const up = (id: number) => {
      if (drag?.id === id) drag = null;
    };
    const opt = { capture: true, passive: true } as const;
    addEventListener('touchstart', (e) => e.touches.length === 1 && down(e.changedTouches[0].identifier, e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.target), opt);
    addEventListener('touchmove', (e) => { for (const t of e.changedTouches) move(t.identifier, t.clientX, t.clientY); }, opt);
    addEventListener('touchend', (e) => { for (const t of e.changedTouches) up(t.identifier); }, opt);
    addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) up(t.identifier); }, opt);
    addEventListener('pointerdown', (e) => e.pointerType === 'mouse' && down(-1, e.clientX, e.clientY, e.target), opt);
    addEventListener('pointermove', (e) => e.pointerType === 'mouse' && e.buttons & 1 && move(-1, e.clientX, e.clientY), opt);
    addEventListener('pointerup', (e) => e.pointerType === 'mouse' && up(-1), opt);
  }

  private openSheet(kind: 'places' | 'pockets') {
    if (!this.canOpenSheet) return;
    this.sheet = kind;
    this.renderSheet();
    // Where to go comes in from the left, pockets from the right.
    this.sheetEl.classList.toggle('from-left', kind === 'places');
    this.sheetEl.classList.toggle('from-right', kind === 'pockets');
    this.sheetEl.hidden = false;
    uiGlitch(this.sheetEl.firstElementChild, 0.4);
    buzz(6);
  }

  private closeSheet() {
    if (this.sheet) uiGlitch(null, 0.25);
    this.sheet = null;
    this.sheetEl.hidden = true;
  }

  private sheetClick(ev: MouseEvent) {
    const t = ev.target as HTMLElement;
    if (t === this.sheetEl) return this.closeSheet(); // tapped outside the card
    const b = t.closest('button');
    if (!b) return;
    if (b.dataset.close !== undefined) this.closeSheet();
    else if (b.dataset.place) this.goTo(b.dataset.place as Place);
    else if (b.dataset.use) this.useMed(Number(b.dataset.use));
    else if (b.dataset.drop) this.drop(Number(b.dataset.drop));
    else if (b.dataset.fire) this.fire(Number(b.dataset.fire));
    else if (b.dataset.smoke) this.smoke(Number(b.dataset.smoke));
    else if (b.dataset.taste) this.identify(Number(b.dataset.taste), false);
    else if (b.dataset.test) this.identify(Number(b.dataset.test), true);
    else if (b.dataset.bump) this.bump(Number(b.dataset.bump));
  }

  /** Walk somewhere else. */
  private goTo(p: Place) {
    this.closeSheet();
    if (p === this.place) return;
    this.place = p;
    this.encounter = null;
    this.noteEl.hidden = true;
    this.wipeBlood();
    this.jam = 0.8;
    this.refresh();
    uiGlitch(p === 'street' ? this.view : this.shopEl, 0.55);
    const info = placeInfo(p);
    const lines = [
      {
        street: 'You head back out into the street.',
        pharmacy: 'You walk to the all-night pharmacy.',
        pawn: 'You walk over to the pawn shop.',
        fence: 'You slip down the alley behind the laundromat.',
        bank: 'You walk to the bank.',
      }[p],
    ];
    const h = this.health;
    // Inside and out of the weather, you warm up a little.
    if (info.indoors && h.cold) {
      h.cold--;
      lines.push(h.cold ? "It's warm inside. You thaw out a little." : "It's warm inside. You stop shivering.");
      this.refresh();
    }
    if (!info.indoors && RAIN_AMOUNT[this.weather.now] > 0) lines.push(`It's still raining (${WEATHER_NAME[this.weather.now].toLowerCase()}).`);
    this.note(lines);
    buzz(10);
  }

  /** Buy something at the pharmacy (cash only). */
  private buy(id: MedId) {
    const m = medById(id);
    const inv = this.inventory;
    if (this.place !== 'pharmacy' || cashOf(inv) < m.price) return;
    const it = stow(inv, { kind: 'med', name: m.name, med: id });
    if (!it) {
      this.note([`You've got nowhere to put ${m.name.toLowerCase()}. ${noRoomWhy(inv, measure({ kind: 'med', name: m.name, med: id }).size)}`]);
      return;
    }
    this.refresh();
    this.note([`You buy ${m.name.toLowerCase()}. ${this.payLine(m.price * 100)}`]);
    buzz(8);
  }

  /** Hands over the money for something (cents), and says how it went. */
  private payLine(price: number): string {
    const inv = this.inventory;
    const r = pay(inv.purse, price)!;
    const back = count(r.change) ? ` and get ${money(Object.entries(r.change).reduce((s, [d, n]) => s + Number(d) * n, 0))} back (${purseText(r.change)})` : '';
    return `You hand over ${purseText(r.gave)}${back}. ${money(Math.round(cashOf(inv) * 100))} left.`;
  }

  /** Sell something to the pawn shop or the fence. */
  private sell(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const place = this.place;
    if (!it || (place !== 'pawn' && place !== 'fence') || !isOpen(placeInfo(place).hours!)) return;
    const o = offer(place, it);
    if (!('cents' in o)) return;
    const lines: string[] = [];
    if (place === 'pawn') {
      // He wants to see photo ID, and he looks at it.
      const id = inv.items.find((x) => x.kind === 'id' && !/expired/i.test(x.name));
      if (!id) {
        this.note(['"I need to see some ID." He taps the sign: all sellers must show photo ID.']);
        return;
      }
      if (Math.random() < 0.2) {
        this.note([`He looks at the ${id.name.toLowerCase()}, then at you, then at it again. "That's not you." He slides it back. "Get out of my shop."`]);
        return;
      }
      lines.push(`He glances at the ${id.name.toLowerCase()} and copies the name into a book.`);
    }
    inv.items.splice(i, 1);
    // The pawn shop pays from the till; the fence peels small bills off a roll.
    const got = place === 'pawn' ? fewest(o.cents) : cashLike(o.cents, 'small');
    addTo(inv.purse, got);
    lines.push(`You sell the ${it.name.toLowerCase()} for ${money(o.cents)} (${purseText(got)}).`);
    this.refresh();
    this.note(lines);
    buzz(8);
  }

  /** Buy something second-hand at the pawn shop (and put it on, if it's clothes). */
  private buyStock(id: string) {
    const s = PAWN_STOCK.find((x) => x.id === id);
    const inv = this.inventory;
    if (!s || this.place !== 'pawn' || !isOpen(placeInfo('pawn').hours!) || cashOf(inv) < s.price) return;
    let line: string;
    if (s.slot) {
      const r = wear(inv, s.slot, s.name);
      if (!r.ok) {
        this.note([`If you swap to the ${s.name.toLowerCase()}: ${r.why}`]);
        return;
      }
      line = `You buy the ${s.name.toLowerCase()} and put it on${r.old ? `, and leave your old ${r.old.toLowerCase()} in the bin out front` : ''}.`;
    } else {
      if (!stow(inv, { kind: 'misc', name: s.name })) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, 'small')}`]);
        return;
      }
      line = `You buy the ${s.name.toLowerCase()}.`;
    }
    this.refresh();
    this.note([line, this.payLine(s.price * 100)]);
    buzz(8);
  }

  /** At the bank: change money up or down. */
  private bank(what: string) {
    const inv = this.inventory;
    const p = inv.purse;
    const teller = isOpen(placeInfo('bank').hours!);
    let line = '';
    if (what === 'machine') {
      if (!count(p, COINS)) return;
      const fee = coinsToBills(p, COIN_MACHINE_FEE);
      line = `You pour your coins into the machine. It counts them with a roar and prints a slip, minus ${money(fee)}. You have ${purseText(p)}.`;
    } else if (!teller) return;
    else if (what === 'up') {
      changeUp(p);
      line = `The teller counts it all twice and slides back ${purseText(p)}.`;
    } else if (what.startsWith('break:')) {
      const d = Number(what.slice(6));
      if (!breakBill(p, d)) return;
      line = `You hand over a ${denomName(d)} and get back ${purseText(breaksInto(d))}.`;
    }
    this.refresh();
    this.note([line]);
    buzz(8);
  }

  /** Use medicine from your pockets (by its place in the list). */
  private useMed(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it?.med) return;
    const m = medById(it.med);
    if (m.blocked(this.health)) return;
    inv.items.splice(i, 1);
    const line = m.use(this.health);
    this.refresh();
    this.note([line]);
    buzz(8);
  }

  /** Your lighter or matches, if you have any. */
  private flame() {
    return this.inventory.items.find((x) => /^(lighter|matches)$/i.test(x.name)) ?? null;
  }

  /**
   * A cigarette. It steadies your hands for a minute and does nothing good
   * for you. With a punctured lung, it comes back up red.
   */
  private smoke(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const fire = this.flame();
    if (!it || !fire) return;
    it.doses = (it.doses ?? 1) - 1;
    const h = this.health;
    const lines = [
      RAIN_AMOUNT[this.weather.now] > 0 && !placeInfo(this.place).indoors
        ? 'You hunch over a cigarette, cupping it from the rain, and get it lit on the third try.'
        : ['You light a cigarette and pull the smoke deep. Your hands stop shaking.', 'You smoke one down to the filter, watching the street.', 'The first drag burns. The second one helps.'][Math.floor(Math.random() * 3)],
    ];
    if (h.lung) {
      lines.push('Your chest seizes. You cough, and it comes up pink and frothy.');
      this.fx.impact(true, 0, false, 'cough');
    } else if (h.broken.includes('ribs')) lines.push('Every drag pulls at your broken ribs.');
    if (it.doses <= 0) {
      inv.items.splice(inv.items.indexOf(it), 1);
      lines.push('That was your last one. You crush the empty pack.');
    }
    if (/matches/i.test(fire.name) && Math.random() < 0.15) {
      inv.items.splice(inv.items.indexOf(fire), 1);
      lines.push("That was the last match.");
    }
    this.refresh();
    this.note(lines);
    buzz(6);
  }

  /** Why you can't make a fire right now, or null. */
  private fireBlocked(): string | null {
    if (this.place !== 'street') return 'Not in here';
    if (!this.canLurk) return 'Not now';
    if (this.weather.now === 'downpour') return 'Too wet';
    return null;
  }

  /**
   * Make a fire with the lighter: some paper from your pockets for kindling
   * (or whatever trash is about), in an old drum or a doorway. Warms you
   * right through. Rain makes it hard to get going.
   */
  private fire(i: number) {
    const inv = this.inventory;
    const lighter = inv.items[i];
    if (!lighter || this.fireBlocked()) return;
    this.closeSheet();
    const paper = inv.items.findIndex((x) => x.kind === 'misc' && /receipt|note|transfer|slip/i.test(x.name));
    const lines: string[] = [];
    let kindling: string;
    if (paper >= 0) {
      kindling = inv.items[paper].name.toLowerCase();
      inv.items.splice(paper, 1);
    } else if (Math.random() < 0.6) kindling = 'some cardboard from a skip';
    else {
      this.note(["You've got nothing to burn, and there's nothing dry lying around. You need some paper."]);
      return;
    }
    const catches = { clear: 1, drizzle: 0.7, rain: 0.35, downpour: 0 }[this.weather.now];
    if (Math.random() >= catches) {
      lines.push(`You try to light the ${kindling}, cupping it from the rain. It hisses and goes out.`);
    } else {
      const h = this.health;
      lines.push(`You get a fire going in an old oil drum, with the ${kindling} for kindling. You hold your hands over it until the feeling comes back.`);
      lines.push(...passHours(h, 1));
      if (h.dead) return this.die(lines);
      if (h.cold) lines.push("You're warm again, right through.");
      h.cold = 0;
    }
    // Cheap lighters don't last; a book of matches lasts less.
    const matches = /matches/i.test(lighter.name);
    if (Math.random() < (matches ? 0.3 : 0.1)) {
      inv.items.splice(inv.items.indexOf(lighter), 1);
      lines.push(matches ? 'That was the last match.' : "The lighter sputters and dies. It's empty. You toss it.");
    }
    this.refresh();
    this.note(lines);
    buzz(10);
  }

  /** Find out what the powder is: taste it, or test it with a kit. */
  private identify(i: number, kit: boolean) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it?.secret || it.known) return;
    let line: string;
    if (kit) {
      const k = inv.items.findIndex((x) => x.med === 'testkit');
      if (k < 0) return;
      inv.items.splice(k, 1);
      line = 'You tip a few grains into the vial and shake it. The liquid turns a bright, clear blue: cocaine.';
    } else {
      line = 'You rub a little on your gums. They go numb almost at once, and there\'s a bitter taste at the back of your throat. Cocaine.';
    }
    it.known = true;
    it.name = 'Baggie of cocaine';
    it.detail = undefined;
    this.refresh();
    this.note([line]);
    buzz(8);
  }

  /** A bump of coke: you're wired for the next fight (more stamina, less pain). */
  private bump(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const h = this.health;
    if (it?.secret !== 'cocaine' || !it.known || h.wired) return;
    it.doses = (it.doses ?? 1) - 1;
    h.wired = true;
    h.concussion = Math.max(0, h.concussion - 1);
    const lines = ['You do a bump off the end of a key. Your heart kicks, your teeth buzz, and everything goes sharp and bright.'];
    if (it.doses <= 0) {
      inv.items.splice(i, 1);
      lines.push("That's the last of it.");
    }
    this.refresh();
    this.note(lines);
    buzz([20, 30, 20]);
  }

  /** Get rid of something to make room. */
  private drop(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it) return;
    inv.items.splice(i, 1);
    this.refresh();
    this.note([`You drop the ${it.name.toLowerCase()}.`]);
    buzz(6);
  }

  /** Your bills and coins, as little chips: "$20 ×2". */
  private purseHtml(): string {
    const p = this.inventory.purse;
    const ds = [...BILLS, ...COINS].filter((d) => p[d]);
    if (!ds.length) return '<span class="none">Not a cent.</span>';
    return ds.map((d) => `<span class="${isBill(d) ? 'bill' : 'coin'}">${isBill(d) ? `$${d / 100}` : `${d}¢`}<em>×${p[d]}</em></span>`).join('');
  }

  /** The screen for wherever you are, if it isn't the street. */
  private renderShop() {
    const place = this.place;
    const here = place !== 'street' && this.tvState.on;
    this.shopEl.hidden = !here;
    if (!here) return;
    const info = placeInfo(place);
    const inv = this.inventory;
    const c = Math.round(cashOf(inv) * 100);
    const open = !info.hours || isOpen(info.hours);
    const btn = (attr: string, v: string | number, label: string, no?: string | false | null) => `<button type="button" data-${attr}="${v}" ${no ? `disabled title="${no}"` : ''}>${label}</button>`;
    const li = (name: string, small: string, button: string) => `<li><div><b>${name}</b><small>${small}</small></div>${button}</li>`;
    let body = '';
    if (place === 'pharmacy') {
      const have = (id: MedId) => inv.items.filter((x) => x.med === id).length;
      body =
        `<ul class="shop-list">${MEDS.map((m) => li(m.name, `${m.desc}${have(m.id) ? ` · You have ${have(m.id)}` : ''}`, btn('buy', m.id, money(m.price * 100), c < m.price * 100 && 'Not enough cash'))).join('')}</ul>` +
        (c < Math.min(...MEDS.map((m) => m.price)) * 100 ? `<p class="shop-broke">You can't afford anything. Cash only.</p>` : '');
    } else if (place === 'pawn' || place === 'fence') {
      if (!open) body = `<p class="shop-closed">${place === 'pawn' ? 'The shutter is down.' : "There's nobody back here right now."} ${hoursText(info.hours!)}.</p>`;
      else {
        const sell = inv.items
          .map((x, i) => ({ x, i, o: offer(place, x) }))
          .map(({ x, i, o }) => li(x.name, 'cents' in o ? `${x.detail ? `${x.detail} · ` : ''}He'll give you ${money(o.cents)}` : o.why, 'cents' in o ? btn('sell', i, `Sell ${money(o.cents)}`) : btn('sell', i, 'Sell', 'No')));
        body = `<h3>Sell</h3>` + (sell.length ? `<ul class="shop-list">${sell.join('')}</ul>` : `<p class="shop-broke">You've got nothing to sell.</p>`);
        if (place === 'pawn') {
          body += `<h3>For sale</h3><ul class="shop-list">${PAWN_STOCK.map((s) => li(s.name, s.desc, btn('stock', s.id, money(s.price * 100), c < s.price * 100 && 'Not enough cash'))).join('')}</ul>`;
        }
      }
    } else if (place === 'bank') {
      const p = inv.purse;
      const coins = count(p, COINS);
      if (open) {
        body =
          `<h3>Teller</h3><ul class="shop-list">` +
          li('Change up', 'Small bills and coins for the biggest bills they come to', btn('bank', 'up', 'Change', !c && 'Nothing to change')) +
          BILLS.filter((d) => p[d])
            .map((d) => li(`Break a ${denomName(d)}`, `Into ${purseText(breaksInto(d))}`, btn('bank', `break:${d}`, 'Break')))
            .join('') +
          `</ul>`;
      } else body = `<p class="shop-closed">The teller windows are dark. ${hoursText(info.hours!)}.</p>`;
      body += `<h3>Lobby</h3><ul class="shop-list">${li('Coin machine', `Turns coins into bills, any hour. Keeps ${COIN_MACHINE_FEE * 100}%.`, btn('bank', 'machine', 'Use', !coins && 'No coins'))}</ul>`;
    }
    this.shopEl.innerHTML =
      `<div class="shop-head"><h2>${info.name}</h2><p>${info.blurb}${info.hours ? ` <em>${hoursText(info.hours)}.</em>` : ''}</p></div>` +
      `<div class="shop-cash"><span>Your cash</span><b>${money(c)}</b></div>` +
      `<p class="shop-purse">${purseText(inv.purse)}</p>` +
      `<div class="shop-body">${body}</div>`;
  }

  private renderSheet() {
    const card = this.sheetEl.firstElementChild as HTMLElement;
    const close = `<button type="button" class="sheet-x" data-close aria-label="Close">×</button>`;
    if (this.sheet === 'places') {
      card.innerHTML =
        `<div class="sheet-head"><h2>Where to?</h2>${close}</div>` +
        PLACES.map(
          (p) =>
            `<button type="button" class="place ${p.id === this.place ? 'here' : ''}" data-place="${p.id}"><b>${p.name}</b><small>${p.id === this.place ? "You're here" : p.desc}${p.hours && p.id !== this.place ? `<i class="${isOpen(p.hours) ? 'open' : 'shut'}">${hoursText(p.hours)}</i>` : ''}</small></button>`,
        ).join('');
      return;
    }
    const inv = this.inventory;
    const h = this.health;
    const total = inv.items.reduce((t, i) => t + i.kg, 0);
    let body =
      `<div class="pocket-cash"><span>Cash</span><b>${money(Math.round(cashOf(inv) * 100))}</b></div>` +
      `<p class="pocket-purse">${this.purseHtml()}</p>` +
      `<p class="pocket-wear">Wearing ${inv.clothes.map((c) => c.toLowerCase()).join(', ')}. Carrying ${kgLabel(total + purseKg(inv))}.</p>`;
    // Every pocket and bag with something in it: how full, and what's there.
    // The empty ones are listed small at the end.
    const empty = inv.spots.filter((sp) => !inv.items.some((x) => x.spot === sp.id));
    for (const sp of inv.spots) {
      const xs = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => x.spot === sp.id);
      if (!xs.length) continue;
      const used = usedKg(inv, sp.id);
      const fill = Math.min(100, (100 * used) / sp.maxKg);
      body +=
        `<div class="spot"><h3><span>${sp.on} · ${sp.name}</span><em>${sp.fits}</em></h3>` +
        `<div class="spot-bar"><i style="width:${fill}%"></i><span>${kgLabel(used)} / ${sp.maxKg} kg</span></div>` +
        (xs.length
          ? `<ul class="pocket-list">${xs
              .map(({ x, i }) => {
                const m = x.med ? medById(x.med) : null;
                const why = m?.blocked(h);
                const small = m
                  ? (why ?? m.desc)
                  : x.secret && x.known
                    ? `${x.doses} bump${x.doses === 1 ? '' : 's'} left`
                    : /^cigarettes$/i.test(x.name)
                      ? `${x.detail ? `${x.detail}, ` : ''}${x.doses ?? 0} left`
                      : x.detail;
                const act = (attr: string, label: string, no?: string | null) => `<button type="button" data-${attr}="${i}" ${no ? `disabled title="${no}"` : ''}>${label}</button>`;
                let acts = m && m.id !== 'testkit' ? act('use', 'Use', why) : '';
                if (/^(lighter|matches)$/i.test(x.name)) acts += act('fire', 'Fire', this.fireBlocked());
                if (/^cigarettes$/i.test(x.name)) acts += act('smoke', 'Smoke', this.flame() ? null : 'Nothing to light it');
                if (x.secret && !x.known) {
                  acts += act('taste', 'Taste');
                  if (inv.items.some((y) => y.med === 'testkit')) acts += act('test', 'Test');
                }
                if (x.secret === 'cocaine' && x.known) acts += act('bump', 'Bump', h.wired ? 'Already wired' : null);
                return (
                  `<li><div><b>${x.name}</b><small>${small ? `${small} · ` : ''}${kgLabel(x.kg)}</small></div>` +
                  `<span class="acts">${acts}<button type="button" class="drop" data-drop="${i}" aria-label="Drop ${x.name}">Drop</button></span></li>`
                );
              })
              .join('')}</ul>`
          : '') +
        `</div>`;
    }
    if (empty.length) {
      body +=
        `<h3>Empty</h3><ul class="spot-empty">` +
        empty.map((sp) => `<li><span>${sp.on} · ${sp.name}</span><em>${sp.fits}, ${sp.maxKg} kg</em></li>`).join('') +
        `</ul>`;
    }
    if (!inv.spots.length) body += `<p class="pocket-empty">Nothing you're wearing has pockets.</p>`;
    card.innerHTML = `<div class="sheet-head"><h2>Pockets</h2>${close}</div><div class="sheet-body">${body}</div>`;
  }

  /** Redraws the person button and the encounter screen from the saved state. */
  private refresh() {
    this.syncButtons();
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
    this.renderShop();
    if (this.sheet) this.renderSheet();
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
      `<div class="enc-conds">${healthConditions(h).map((c) => `<span>${c}</span>`).join('')}</div>` +
      `<div class="you-cash">${money(Math.round(cashOf(this.inventory) * 100))}</div>` +
      this.humanityLine();
  }

  /** How far gone you are, once you've started. */
  private humanityLine() {
    const h = this.humanity;
    const lvl = humanityLevel(h.lost);
    if (!lvl && !h.kills) return '';
    const kills = h.kills ? ` · ${h.kills} dead` : '';
    return `<div class="you-humanity" data-level="${(lvl?.name ?? 'human').toLowerCase()}"><span>Humanity</span><b>${lvl?.name ?? 'Shaken'}</b><em>${kills}</em></div>`;
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
        const person = maybeThief(this.world) ?? makePerson();
        const s = this.lurkState;
        s.times++;
        s.seen[person.kind]++;
        s.races[person.race]++;
        this.encounter = newEncounter(person, this.yourBody());
        this.phase = 'idle';
        this.refresh();
        uiGlitch(this.seenEl, 0.3);
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
    this.goBtn.hidden = true;
    this.bagBtn.hidden = true;
    this.shopEl.hidden = true;
    this.closeSheet();
    this.view.querySelector('#death')?.remove();
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
    if ((this.weatherTimer -= dt) <= 0) {
      this.weatherTimer = 2;
      const was = this.weather.now;
      if (updateWeather(this.weather) && this.running && this.tvState.on && this.weather.now !== was && this.place === 'street') {
        this.note([weatherLine(this.weather.now, was)]);
      }
    }
    this.tickClock();
    if (this.running) {
      this.save.playTime += dt;
      this.stepLurk(dt);
    }
    this.jam = Math.max(0, this.jam - dt * 2.2);
    this.tv.setJam(this.jam);
    this.syncButtons();
    if (this.sheet && !this.canOpenSheet) this.closeSheet();
    if (this.noteTimer > 0 && (this.noteTimer -= dt) <= 0) this.noteEl.hidden = true;
    this.tv.update(dt);
    // The red edge pulses when your blood is low.
    const e2 = this.encounter;
    const body = e2 && e2.stage !== 'seen' && e2.stage !== 'over' ? e2.you : this.health;
    const frac = body.blood / body.maxBlood;
    this.fx.setLow(this.tvState.on ? Math.min(1, Math.max(0, (0.82 - frac) / (0.82 - PASS_OUT))) : 0);
    this.hitUi.update(dt);
  }

  /** The device's time, top right (redrawn when the minute changes). */
  private tickClock() {
    const t = now();
    const s = clockText(t);
    const wx = this.weather.now;
    const key = s + wx;
    if (key === this.clockShown) return;
    this.clockShown = key;
    this.clockEl.querySelector('b')!.textContent = s;
    this.clockEl.querySelector('span')!.textContent = `${dateText(t)} · ${WEATHER_NAME[wx]}`;
    // Opening hours change with the time.
    if (this.place !== 'street') this.renderShop();
    if (this.sheet === 'places') this.renderSheet();
  }

  /** Shows the buttons that fit the moment: Lurk, Rest, the edge tabs. */
  private syncButtons() {
    // The Lurk button shows whenever you're free to lurk.
    const e = this.encounter;
    const show = this.canLurk && !(e && e.stage === 'over'); // then it's in the encounter screen
    if (this.lurkBtn.hidden === show) {
      this.lurkBtn.hidden = !show;
      this.lurkBtn.querySelector('span')!.textContent = this.lurkState.times ? 'Lurk again' : 'Lurk';
    }
    const rest = show && isHurt(this.health);
    if (this.restBtn.hidden === rest) this.restBtn.hidden = !rest;
    // The edge tabs: whenever a drawer could be pulled in.
    const pull = this.canOpenSheet && !this.sheet;
    if (this.goBtn.hidden === pull) this.goBtn.hidden = !pull;
    if (this.bagBtn.hidden === pull) this.bagBtn.hidden = !pull;
  }

  /** Writes progress to the device. Returns false if storage is unavailable. */
  saveNow(): boolean {
    void this.lurkState;
    // Remove state from earlier versions of the game.
    delete this.save.state.player;
    delete this.save.state.whisp;
    delete this.save.state.orb;
    // When you were last here, by the real clock (for time that passes while away).
    this.save.state.lastSeen = now();
    return writeSave(this.save);
  }

  /** For automated tests. */
  get debug() {
    return { cash: cashOf(this.inventory), world: this.world, tv: this.tv, phase: this.phase, lurk: this.lurkState, encounter: this.encounter, stats: this.stats, health: this.health, inventory: this.inventory, place: this.place, humanity: this.humanity };
  }
}

function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not allowed */
  }
}
