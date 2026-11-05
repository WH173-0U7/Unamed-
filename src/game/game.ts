import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { createTv } from './tv';
import { BUILDS, CHANCES, RACE_CHANCES, NAMES, makePerson, personalityOf, randomName, type Loot } from './person';
import { ENCOUNTER_VERSION, act, newEncounter, type Encounter } from './encounter';
import { RESULT, createEncounterView } from '../ui/encounterView';
import { STAT_NAMES, lieBonus, persuadeBonus, train, newStats, xpToNext, MAX_LEVEL, maxStamina, ambushBonus, noticeRate, damageMult, accuracyBonus, dodgeBonus, staminaRegen, fearBonus, STAT_SHORT, unarmedDamage, strengthDamage, strengthFear, weaponDamage, weaponAccuracy, type StatName, type Stats } from './stats';
import { clampClock, cravingLine, useHabit, withdrawalEffects, HIGH_HOURS, LURK_HOURS, addCaffeine, caffeineNow, caffeineLevel, drunkLevel, soberUp, REST_HOURS, afterFight, bodyFrom, healthConditions, injuryEffects, isHurt, newHealth, passHours, type Health } from './health';
import { ALL_TECHNIQUES, PASS_OUT, addStress, type Impact } from './encounter';
import type { Glass } from '../fx/glass';
import { uiGlitch } from '../fx/uiGlitch';
import { guilt } from './voices';
import { sound } from '../fx/sound';
import type { DrugLook } from '../fx/drugs';
import { clockText, dateText, now, partOfDay } from './clock';
import { COLD_AMOUNT, RAIN_AMOUNT, SNOW_AMOUNT, WEATHER_NAME, WET_AMOUNT, isSnow, newWeather, updateWeather, weatherLine, type WeatherState } from './weather';
import { COLD_NAMES } from './health';
import { maybeThief, newWorld, robBody, robKnockedOut, settle, type World } from './legacy';
import { isBrute } from './voices';
import { knifeOf } from './knives';
import { gunOf } from './guns';
import { HEAT_NAMES, applyTo, comeBack, heal, fade, heatLevel, historyText, injuriesText, meet, newInfamy, recognises, remember, repName, type Infamy, type Known } from './people';
import { anonymity, conspicuous, describe, hasHood, lookClothes, wearing } from './look';
import { marksText } from './encounter';
import { MEDS, take, freeHand, alarmOf, alarmStat, bulkOf, concealOf, exposure, hideStat, spotsFor, hidesWord, inBag, nextSpot, showWord, showing, cashOf, purseKg, wear, kgLabel, measure, medById, newInventory, noRoomWhy, stow, upgradeInventory, usedKg, type Inventory, type InvItem, type MedId } from './inventory';

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
  { at: 20, name: 'Callous', line: "Their pain doesn't reach you the way it did." },
  { at: 32, name: 'Cruel', line: "You've started to enjoy their pain." },
  { at: 46, name: 'Vicious', line: 'You hurt people more than you need to now. You know it.' },
  { at: 62, name: 'Heartless', line: 'You feel nothing for them. Nothing at all.' },
  { at: 80, name: 'Sadist', line: 'You take your time with them now. You like the begging.' },
  { at: 100, name: 'Monster', line: 'People cross the street when they see you coming. They are right to.' },
  { at: 125, name: 'Butcher', line: "You've stopped counting what you've done." },
  { at: 155, name: 'Devil', line: "When they talk about you on the street, they don't use your name." },
  { at: 190, name: 'Husk', line: "There's nothing left inside you. You're a husk." },
];
/** How evil you are shows: people are more scared of you, the further gone you are. */
// Someone far gone carries it in how they look at you, a little (strangers can't
// know what you've done, only see it in your eyes).
/** One of these, at random. */
const oneOf = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
/** What the pharmacy sells (iron tablets aren't: they do nothing in a hurry). */
const SOLD_MEDS = () => MEDS.filter((m) => m.id !== 'iron');
const evilFear = (lost: number) => Math.min(15, lost * 0.1);
const humanityLevel = (lost: number) => HUMANITY.filter((l) => lost >= l.at).pop() ?? null;
const KILL_COST = 10;
/** A cigarette, start to finish (real time), and how much stress it takes away. */
const SMOKE_MS = 6 * 60_000;
const SMOKE_EASE = 35;
const STOMP_HELPLESS_COST = 1;
/** Each time you torture someone; robbing someone who's given up costs a little. */
const TORTURE_COST = 3;
const MUG_COST = 0.5;

import { chargeOf, COIN_MACHINE_FEE, ER_PRICES, ROOM_RENT, DEZ_CASH, DEZ_FRONT, GAS_STOCK, GUN_STOCK, HIDDEN_PLACES, ID_FEE, LIQUOR_STOCK, PAWN_STOCK, PLACES, offer, placeInfo, type ErCare, type Place } from './shops';
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
  /** "Shake your phone to wake up", on the dark screen after a knockout. */
  private readonly koHint: HTMLParagraphElement;
  private readonly lurkBtn: HTMLButtonElement;
  private readonly seenEl: HTMLElement;
  private readonly encView;
  private readonly hitUi;
  private readonly timers: number[] = [];
  private readonly listeners = new AbortController();
  /** Real seconds spent where you are, for warming up or getting cold. */
  private exposure = 0;
  private readonly statsEl: HTMLElement;
  private readonly youEl: HTMLElement;
  private readonly restBtn: HTMLButtonElement;
  private readonly noteEl: HTMLElement;
  private readonly goBtn: HTMLButtonElement;
  private readonly bagBtn: HTMLButtonElement;
  private readonly youBtn: HTMLButtonElement;
  private readonly shopEl: HTMLElement;
  private readonly sheetEl: HTMLElement;
  private sheet: 'places' | 'pockets' | 'stats' | 'police' | null = null;
  private noteTimer = 0;
  private readonly clockEl: HTMLElement;
  private clockShown = '';
  private clockSec = 0;
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
    this.koHint = document.createElement('p');
    this.koHint.id = 'ko-hint';
    this.koHint.hidden = true;
    this.powerBtn.after(this.koHint);
    this.lurkBtn = view.querySelector('#lurk-btn') as HTMLButtonElement;
    this.seenEl = view.querySelector('#seen') as HTMLElement;
    this.statsEl = view.querySelector('#stats') as HTMLElement;
    this.statsEl.onclick = () => this.openSheet('stats');
    this.youEl = view.querySelector('#you-status') as HTMLElement;
    // Tapping your injuries shows what they do.
    // A tap on the street (not on a button or a panel) puts away the note that waits for you.
    view.addEventListener(
      'click',
      (ev) => {
        if (!this.noteSticky || performance.now() < this.tapsFrom) return;
        if ((ev.target as HTMLElement).closest('button, a, input, #sheet, #shop, #enc, #seen, #stats, #you-status')) return;
        this.dismissNote();
      },
      { signal: this.listeners.signal },
    );
    this.youEl.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('.enc-conds')) this.openSheet('stats');
    }, { signal: this.listeners.signal });
    this.restBtn = view.querySelector('#rest-btn') as HTMLButtonElement;
    this.noteEl = view.querySelector('#note') as HTMLElement;
    this.clockEl = view.querySelector('#clock') as HTMLElement;
    this.restBtn.onclick = () => performance.now() >= this.tapsFrom && this.rest();
    this.goBtn = view.querySelector('#go-btn') as HTMLButtonElement;
    this.bagBtn = view.querySelector('#bag-btn') as HTMLButtonElement;
    this.youBtn = view.querySelector('#you-btn') as HTMLButtonElement;
    this.shopEl = view.querySelector('#shop') as HTMLElement;
    this.shopEl.addEventListener('scroll', () => this.markShopMore(), { signal: this.listeners.signal, passive: true, capture: true });
    this.sheetEl = view.querySelector('#sheet') as HTMLElement;
    // A sheet with more below than shows: a fade at the bottom edge.
    {
      const mark = () => {
        for (const b of this.sheetEl.querySelectorAll<HTMLElement>('.sheet-body')) b.classList.toggle('more', b.scrollTop + b.clientHeight < b.scrollHeight - 4);
      };
      this.sheetEl.addEventListener('scroll', mark, { capture: true, signal: this.listeners.signal });
      const mo = new MutationObserver(() => requestAnimationFrame(mark));
      mo.observe(this.sheetEl, { childList: true, subtree: true });
      this.listeners.signal.addEventListener('abort', () => mo.disconnect());
    }
    this.goBtn.onclick = () => this.openSheet('places');
    this.bagBtn.onclick = () => this.openSheet('pockets');
    this.youBtn.onclick = () => this.openSheet('stats');
    this.edgeSwipes();
    this.sheetEl.onclick = (ev) => this.sheetClick(ev);
    this.shopEl.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest('button');
      if (!b || b.disabled) return;
      this.withFeedback(b, () => this.shopAction(b));
    };
    this.restBtn.hidden = true;
    this.hitUi = createHitUi(view);
    this.encView = createEncounterView(view.querySelector('#enc') as HTMLElement, (id) => this.act(id));
    this.powerBtn.onclick = () => this.turnOn();
    this.lurkBtn.onclick = () => performance.now() >= this.tapsFrom && this.lurk();
    this.lurkBtn.hidden = true;
    this.refresh();
  }

  /** A shop button: what it does. */
  private shopAction(b: HTMLButtonElement) {
      if (b.dataset.buy) this.buy(b.dataset.buy as MedId);
      else if (b.dataset.sell) this.sell(Number(b.dataset.sell));
      else if (b.dataset.stock) this.buyStock(b.dataset.stock);
      else if (b.dataset.bank) this.bank(b.dataset.bank);
      else if (b.dataset.atm) this.atm(Number(b.dataset.atm));
      else if (b.dataset.records) this.getId();
      else if (b.dataset.er) this.er(b.dataset.er as ErCare);
      else if (b.dataset.court) this.appear();
      else if (b.dataset.room) this.roomAct(b.dataset.room);
      else if (b.dataset.dez) this.dez(b.dataset.dez);
      else if (b.dataset.unstash) this.unstash(b.dataset.unstash);
      else if (b.dataset.cash) this.stashCash(b.dataset.cash);
  }

  /** What you're carrying and holding, to see whether a tap did anything. */
  private snapshot() {
    const inv = this.inventory;
    return {
      cents: Math.round(cashOf(inv) * 100),
      bank: (this.account?.cents ?? 0),
      items: inv.items.length,
      key: JSON.stringify([inv.items.map((x) => [x.name, x.spot, x.doses ?? null]), inv.clothes, inv.gear ?? [], wearing(inv), this.health.bleeding, this.health.broken, this.health.splinted ?? [], Math.round(this.health.blood)]),
    };
  }

  /**
   * A tap's result, shown where you tapped: if it did something, the row
   * flashes and a label floats up from the button (what you got, what it
   * cost, where it went), and the Pockets tab bounces when you gain
   * something; if it did nothing, the button gives a short shake.
   */
  private withFeedback(b: HTMLButtonElement, run: () => void) {
    const before = this.snapshot();
    const rect = b.getBoundingClientRect();
    const attr = Object.keys(b.dataset)[0];
    const sel = attr ? `[data-${attr.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${CSS.escape(b.dataset[attr] ?? '')}"]` : '';
    const label = b.closest('li')?.querySelector('b')?.textContent ?? '';
    run();
    const after = this.snapshot();
    const now = (sel && (this.shopEl.querySelector(sel) ?? this.sheetEl.querySelector(sel))) as HTMLElement | null;
    if (before.key === after.key && before.cents === after.cents && before.bank === after.bank) {
      // Nothing happened (the note says why).
      const el = now ?? b;
      el.classList.remove('did-no');
      void el.offsetWidth;
      el.classList.add('did-no');
      sound.deny();
      buzz([8, 40, 8]);
      return;
    }
    // It worked: the good sound (unless money moved, which has its own).
    if (after.cents === before.cents && after.bank === before.bank) sound.good();
    const row = (now ?? b).closest('li');
    if (row) {
      row.classList.remove('did-ok');
      void (row as HTMLElement).offsetWidth;
      row.classList.add('did-ok');
    }
    // What changed, in a word or two.
    const bits: string[] = [];
    const dc = after.cents - before.cents;
    const db = after.bank - before.bank;
    if (after.items > before.items && label) bits.push(`+ ${label}`);
    else if (attr === 'move') {
      const it = this.inventory.items[Number(b.dataset.move)];
      const sp = it && this.inventory.spots.find((x) => x.id === it.spot);
      if (sp) bits.push(`→ ${sp.name}`);
    } else if (attr === 'load') bits.push('Loaded');
    else if (attr === 'drop' || after.items < before.items) bits.push(attr === 'drop' ? 'Trashed' : attr === 'use' ? 'Used' : '');
    if (db) bits.push(`${db > 0 ? '+' : '−'}${money(Math.abs(db))} in the bank`);
    else if (dc) bits.push(`${dc > 0 ? '+' : '−'}${money(Math.abs(dc))}`);
    const text = bits.filter(Boolean).join('  ');
    if (text) {
      const f = document.createElement('div');
      f.className = `float-label${db > 0 ? ' gain' : db < 0 || dc < 0 ? ' cost' : dc > 0 ? ' gain' : ''}`;
      f.textContent = text;
      // Over the button as it is now (the list may have moved).
      const at = now?.isConnected ? now.getBoundingClientRect() : rect;
      f.style.top = `${at.top}px`;
      document.body.append(f);
      // (Centred on the button, but all of it on the screen.)
      const half = f.offsetWidth / 2;
      f.style.left = `${Math.min(innerWidth - half - 8, Math.max(half + 8, at.left + at.width / 2))}px`;
      window.setTimeout(() => f.remove(), 1300);
    }
    // Something new on you: the Pockets tab bounces.
    if (after.items > before.items) {
      this.bagBtn.classList.remove('bump');
      void this.bagBtn.offsetWidth;
      this.bagBtn.classList.add('bump');
    }
    // The cash on you changed: it pulses.
    if (dc) {
      for (const el of document.querySelectorAll<HTMLElement>('.you-cash, .pocket-cash b')) {
        el.classList.remove('pulse');
        void el.offsetWidth;
        el.classList.add('pulse');
      }
    }
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
    // From before Unarmed: the fighting you'd done counts (Strength used to be it).
    if (!s.unarmed && s.strength) s.unarmed = { level: s.strength.level, xp: 0 };
    // From when levels went to 20: the same skill is five times the level now.
    if (!this.save.state.statScale) {
      for (const k of Object.keys(s) as StatName[]) if (s[k]) s[k] = { level: Math.min(MAX_LEVEL, 1 + (s[k].level - 1) * 5), xp: 0 };
      this.save.state.statScale = 100;
    }
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
    if (!this.tvState.on || this.inside) return 0;
    return RAIN_AMOUNT[this.weather.now];
  }
  /** How hard it's snowing where you are (0 indoors), for the snow. */
  get snowAmount(): number {
    if (!this.tvState.on || this.inside) return 0;
    return SNOW_AMOUNT[this.weather.now];
  }

  /**
   * Time out on the street: the rain soaks you and you get colder (a coat
   * helps, a T-shirt doesn't); dry weather lets you dry off. Returns what
   * to say, if anything.
   */
  private chill(): string | null {
    const h = this.health;
    const cold = h.cold ?? 0;
    const rain = COLD_AMOUNT[this.weather.now];
    const snowing = isSnow(this.weather.now);
    const top = this.inventory.clothes[0] ?? '';
    const warm = /coat|parka|puffer|leather|layered/i.test(top) ? 0.5 : /t-shirt|shirt/i.test(top) ? 1.4 : 1;
    if (rain > 0 && cold < 3 && Math.random() < rain * 0.65 * warm) {
      h.cold = cold + 1;
      return [
        '',
        snowing ? `Snow melts into your ${top.toLowerCase() || 'clothes'} and the cold gets in. You're chilled.` : `The rain soaks through your ${top.toLowerCase() || 'clothes'}. You're chilled.`,
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
    const w = (this.save.state.world ??= newWorld()) as World;
    w.people ??= [];
    return w;
  }

  private get people(): Known[] {
    return this.world.people!;
  }

  /** Your reputation and heat, faded up to now. */
  private get infamy(): Infamy {
    const f = (this.world.infamy ??= newInfamy());
    fade(f);
    // (A warrant doesn't fade: your name's in the system until it's dealt with.)
    if (this.case?.warrant) f.heat = Math.max(f.heat, 35);
    return f;
  }

  /**
   * After an encounter with someone who lives: they remember you (see
   * people.ts). If they saw your face they talk, and some go to the police.
   */
  private rememberThem(e: Encounter) {
    const inv = this.inventory;
    if (e.them.dead && e.person.known) this.world.thieves = this.world.thieves.filter((t) => t.person.known !== e.person.known);
    const before = e.person.known ? this.people.find((k) => k.id === e.person.known)?.memory.sawFace : false;
    const k = remember(this.people, e, e.seenAs ?? { anon: anonymity(inv), looked: describe(inv), clothes: lookClothes(inv) }, { robbed: !!e.robbed, stomped: !!e.stomped, mugged: !!e.mugged, tortured: e.tortured ?? 0 });
    if (!k || k.memory.beatYou) return;
    const f = this.infamy;
    if (k.memory.sawFace && !before) f.rep += k.memory.grudge / 8;
    // Who goes to the police: most civilians, few junkies.
    const reports = { civilian: 0.7, drunk: 0.4, homeless: 0.25, junkie: 0.15 }[k.person.kind];
    if (e.result !== 'sold' && !e.enforcer && Math.random() < reports) {
      f.heat = Math.min(100, f.heat + (k.memory.grudge / 5) * (k.memory.sawFace ? 1 : 0.4));
      if (k.memory.sawFace && e.fought) f.reports = (f.reports ?? 0) + 1;
    }
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
    const p = (this.save.state.place as Place) ?? 'street';
    // (Saved inside a place that's hidden now: you're back outside.)
    return HIDDEN_PLACES.has(p) ? 'street' : p;
  }
  private set place(p: Place) {
    this.save.state.place = p;
  }

  /** Your body as it is now, ready for a fight. */
  private yourBody() {
    return bodyFrom(this.health, maxStamina(this.stats));
  }

  /** A few lines shown in the middle of the screen for a while. */
  private note(lines: string[], sticky = false) {
    if (!lines.length) return;
    // Mid-fight, it goes in the fight's log (not over the top of it).
    const fight = this.encounter;
    if (fight && fight.stage !== 'seen' && fight.stage !== 'over' && this.tvState.on) {
      for (const text of lines) fight.log.push({ by: 'info', text });
      this.refresh();
      return;
    }
    // In a shop, or with a sheet open, what happened shows right there (the
    // street's note would be behind it).
    if (this.sheet === 'stats' || this.sheet === 'pockets') {
      this.sheetNote = lines;
      this.renderSheet();
      // (A note waiting on the street stays as it was.)
      if (this.noteSticky && !this.noteEl.hidden) return;
    } else if (this.sheet) {
      // (Places and the police have no room for it: it waits until they close.)
      this.heldNote = [...this.heldNote, ...lines];
      return;
    }
    if (this.place !== 'street' && this.tvState.on && !this.encounter) {
      this.shopNote = lines;
      this.renderShop();
    }
    const p = (l: string) => Object.assign(document.createElement('p'), { textContent: l });
    // What happened with someone stays up until you move on: anything else
    // that comes in meanwhile (the weather, a cigarette burning down) goes under it.
    if (!sticky && this.noteSticky && !this.noteEl.hidden) {
      this.noteEl.querySelector('.note-tap')?.before(...lines.map(p));
      // (Only the latest few of those: what happened with them stays on top.)
      const extra = [...this.noteEl.querySelectorAll('p:not(.note-tap):not(.note-head)')];
      for (const el of extra.slice(0, Math.max(0, extra.length - 3))) el.remove();
      this.save.state.stickyExtra = [...((this.save.state.stickyExtra as string[] | undefined) ?? []), ...lines].slice(-3);
      return;
    }
    this.noteSticky = sticky;
    if (sticky) this.save.state.stickyNote = [...lines];
    else delete this.save.state.stickyNote;
    delete this.save.state.stickyExtra;
    this.noteEl.classList.toggle('sticky', sticky);
    this.noteEl.replaceChildren(...lines.map((l) => (sticky ? Object.assign(p(l), { className: 'note-head' }) : p(l))), ...(sticky ? [Object.assign(p('Tap to go on'), { className: 'note-tap' })] : []));
    this.noteEl.hidden = false;
    clearTimeout(this.noteFade);
    this.noteEl.classList.remove('fading');
    // Someone across the street: under their card, not on it.
    const low = this.encounter?.stage === 'seen';
    this.noteEl.classList.toggle('low', low);
    // (Below the card and Lurk, whichever is lower.)
    const top = low ? Math.max(...[this.seenEl.querySelector('button'), this.lurkBtn.hidden ? null : this.lurkBtn].map((x) => x?.getBoundingClientRect().bottom ?? 0)) : 0;
    const vr = this.view.getBoundingClientRect();
    this.noteEl.style.top = top ? `${Math.round(top - vr.top + 8)}px` : '';
    this.noteEl.style.animation = 'none';
    void this.noteEl.offsetWidth;
    this.noteEl.style.animation = '';
    this.noteTimer = sticky ? 0 : 3 + lines.length * 1.2;
  }
  /** The note that waits for you (see note): up until you tap, lurk, rest or go somewhere. */
  private noteSticky = false;
  private dismissNote() {
    if (!this.noteSticky) return;
    this.unstick();
    this.noteTimer = 0.01;
  }
  /** No longer waiting (and not brought back on a reload). */
  private unstick() {
    this.noteSticky = false;
    this.noteEl.classList.remove('sticky');
    delete this.save.state.stickyNote;
    delete this.save.state.stickyExtra;
  }

  /** Rest: several hours pass, and you heal. */
  rest() {
    if (!this.canLurk) return;
    this.unstick();
    if (!isHurt(this.health)) {
      this.note(["You're not hurt. There's nothing to rest off."]);
      return;
    }
    this.encounter = null;
    this.wipeBlood();
    const raining = WET_AMOUNT[this.weather.now] > 0;
    const lines = [raining ? `You find a doorway out of the ${isSnow(this.weather.now) ? 'snow' : 'rain'} and rest for a few hours.` : 'You find somewhere quiet and rest for a few hours.', ...passHours(this.health, REST_HOURS, true)];
    if (this.health.dead) return this.die(lines);
    const h = this.health;
    if (h.cold) {
      // Out of the wind you warm up a little; dry, you warm up more.
      h.cold = Math.max(0, h.cold - (raining ? 1 : 2));
      lines.push(h.cold ? `You're still ${COLD_NAMES[h.cold].toLowerCase()}, but less.` : 'You stop shivering.');
    }
    if (h.wired && h.wiredUntil == null) {
      h.wired = false;
      lines.push(h.wiredBy === 'meth' ? 'The meth wears off while you sit there. Your skin crawls, and you feel hollow.' : 'The coke wears off while you sit there. You feel hollow.');
      delete h.wiredBy;
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
    if (old && old !== e) {
      if (old.enforcer && old.result !== 'lost' && this.debt) this.debt.strikes = (this.debt.strikes ?? 0) + 1;
      // (Remembered first: the thief record then knows who they are, and the two stay one person.)
      if (old.stage !== 'seen') this.rememberThem(old);
      settle(this.world, old);
    }
    this.save.state.encounter = e ?? undefined;
  }

  /**
   * Can you lurk right now? Once the TV has warmed up, and not in the middle
   * of something with someone (you can always skip a person you haven't
   * approached).
   */
  private get canLurk() {
    const e = this.encounter;
    // (Not while the police have you stopped.)
    return this.running && this.tv.showingPicture && this.phase === 'idle' && this.place === 'street' && !this.save.state.policeStop && (!e || e.stage === 'seen' || e.stage === 'over');
  }

  /** Lurk: the signal cuts out while you wait for whoever comes. */
  lurk() {
    if (!this.canLurk) return;
    this.phase = 'cut';
    sound.static();
    this.timer = 0.45;
    this.encounter = null;
    this.unstick();
    this.noteEl.hidden = true;
    this.wipeBlood();
    // Time passes while you wait: wounds bleed, or heal; the rain soaks you.
    const lines = passHours(this.health, LURK_HOURS, false, false);
    // Withdrawal: the craving, and (off drink or downers, badly) a seizure.
    {
      const wd = withdrawalEffects(this.health);
      if (wd.worst && wd.worst.sev > 0.15 && Math.random() < 0.3) lines.push(cravingLine(wd.worst.k));
      if (wd.seizure > 0 && Math.random() < wd.seizure) {
        lines.push('Your jaw locks, your arms jerk, and the street tilts away. When you come to, you\'re on the sidewalk, your tongue bitten, your whole body aching. A seizure.');
        lines.push(...passHours(this.health, 1));
        this.health.stress = Math.min(100, (this.health.stress ?? 0) + 25);
        this.health.concussion = Math.max(this.health.concussion, 2);
        this.fx.dirt(0.7);
      }
    }
    if (this.health.dead) return this.die(lines);
    const c = this.chill();
    if (c) lines.push(c);
    // With heat on you, a patrol might stop you instead of anyone turning up.
    const heat = this.infamy.heat;
    // A patrol stops you if they're looking for you, or if they can see what you're carrying.
    const shows = exposure(this.inventory);
    const wanted = heat > 5 && Math.random() < Math.min(0.3, heat / 250);
    if (wanted || (shows > 0.15 && Math.random() < shows * 0.08)) {
      this.phase = 'idle';
      this.refresh();
      // What happened while you waited, and why they've stopped: at the top of the stop.
      this.save.state.policeWhy = [
        ...lines,
        wanted
          ? oneOf(['The one in the passenger seat looks from you to his phone, and back.', "They slow as they pass, and the brake lights come on. They've had a description."])
          : oneOf(['One of them is looking at your pocket, at what shows.', 'His eyes go to the shape under your clothes and stay there.']),
      ];
      this.save.state.policeStop = true;
      this.openSheet('police');
      buzz([30, 30, 30]);
      return;
    }
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
    if (!e || !this.running || this.ending) return;
    if ((id === 'lurk' || id === 'rest') && performance.now() < this.tapsFrom) return;
    if (id === 'lurk') return this.lurk();
    if (id === 'rest') return this.rest();
    if (id === 'pockets') return this.openSheet('pockets');
    if (id === 'go') return this.openSheet('places');
    if (id === 'leave-body') return this.closeEncounter(['You leave the body where it lies, and walk.']);
    // Approaching someone: bring your body as it is now (and lose the cigarette).
    if (e.stage === 'seen' && id === 'ambushed') e.you = this.yourBody();
    else if (e.stage === 'seen') {
      e.you = this.yourBody();
      if (e.you.smoking && id !== 'leave') e.log.push({ by: 'info', text: 'You walk over with the cigarette still burning between your lips.' });
      // Whether they know you depends on how you look as you walk up.
      const inv = this.inventory;
      e.conspicuous = conspicuous(inv);
      const k = e.person.known ? this.people.find((x) => x.id === e.person.known) : undefined;
      const anon = anonymity(inv);
      const clothes = lookClothes(inv).join('|');
      const was = e.lookAt;
      if (!was || was.anon !== anon || was.clothes !== clothes) {
        if (k) e.recognised = recognises(k, anon, lookClothes(inv));
        // (Known from what people say: more covered up now, less chance.)
        else if (e.byRep && was && anon > was.anon) {
          e.recognised = Math.random() < (1 - anon) / Math.max(0.05, 1 - was.anon);
          if (!e.recognised) {
            delete e.byRep;
            delete e.history;
            e.grudge = 0;
          }
        }
        // (Uncovered now, a stranger who's heard about you may know your face after all.)
        else if (!e.byRep && !e.recognised && was && anon < was.anon && Math.random() < Math.min(0.5, this.infamy.rep / 200) * (1 - anon) - Math.min(0.5, this.infamy.rep / 200) * (1 - was.anon)) {
          e.recognised = true;
          e.byRep = true;
          e.grudge = 0;
          e.history = "You've never met. But they know your face: people talk.";
        }
        e.lookAt = { anon, clothes };
      }
    }
    if (e.stage === 'seen') e.them.fear = this.fearOf(e);
    this.prime(e);
    const wasOver = e.stage === 'over';
    const wasOut = !!e.them.out;
    const tortured = e.tortured ?? 0;
    const mugged = !!e.mugged;
    const levelsBefore = Object.values(this.stats).reduce((n, x) => n + x.level, 0);
    const shotsBefore = e.shots ?? 0;
    const downBefore = !!e.you?.down;
    const logFrom = e.log.length;
    const impacts = act(e, id, this.stats, this.inventory, (this.save.state.moves ??= {}) as Record<string, number>);
    this.settleDeal(e);
    // Down on the sidewalk: dirt on the glass.
    if (!downBefore && e.you?.down) this.fx.dirt(e.you.out ? 0.9 : 0.6);
    // Gunshots get called in.
    if ((e.shots ?? 0) > shotsBefore) this.infamy.heat = Math.min(100, this.infamy.heat + 18 * ((e.shots ?? 0) - shotsBefore));
    if (Object.values(this.stats).reduce((n, x) => n + x.level, 0) > levelsBefore) sound.levelUp();
    // Knocked out of your mouth (or you're out cold): the cigarette's gone.
    if (!wasOver && this.smoking && e.you && (e.you.smoking === false || e.you.out || e.result === 'lost')) {
      delete this.health.smokingUntil;
      e.you.smoking = false;
    }
    const worse: string[] = [];
    let after: string[] = [];
    // Torturing someone; robbing someone who'd given up.
    if ((e.tortured ?? 0) > tortured) {
      const l = this.loseHumanity(TORTURE_COST * ((e.tortured ?? 0) - tortured));
      if (l) worse.push(l);
    }
    if (e.mugged && !mugged) {
      const l = this.loseHumanity(MUG_COST);
      if (l) worse.push(l);
    }
    // A tip-off about your old things.
    if (e.tip === 'thief' && this.world.thieves.length) {
      this.world.lead = this.world.thieves[Math.floor(Math.random() * this.world.thieves.length)].id;
      delete e.tip;
    }
    // Stamping on someone who can't defend themselves.
    if (wasOut && impacts.some((x) => x.target === 'them') && (id.startsWith('stomp') || id.startsWith('ground:') || id.startsWith('whip:') || id.startsWith('wpn:'))) {
      e.stomped = true;
      const l = this.loseHumanity(STOMP_HELPLESS_COST);
      if (l) worse.push(l);
    }
    if (!wasOver && e.stage === 'over') {
      if (e.result === 'killed' || (e.result !== 'lost' && e.them.dead)) {
        // Killing someone (or leaving them to bleed out): the worst of it, unless you're long past caring.
        addStress(e.you, 30);
        // Was anyone watching? A face in a window, a car going past.
        const anon = anonymity(this.inventory);
        if (Math.random() < 0.3) {
          const f = this.infamy;
          f.rep += 15 * (1 - anon * 0.7);
          f.heat = Math.min(100, f.heat + 35 * (1 - anon * 0.6));
          if (anon <= 0.6) f.killsSeen = (f.killsSeen ?? 0) + 1;
          worse.push(
            e.result !== 'killed'
              ? anon > 0.6
                ? 'Someone saw you with them before they died. Your face was covered.'
                : 'Someone saw you with them before they died. They saw your face.'
              : anon > 0.6
                ? 'Someone saw that. A face in a window, then gone. At least your face was covered.'
                : 'Someone saw that. A face in a window, then gone. They saw yours.',
          );
        }
        this.humanity.kills++;
        const l = this.loseHumanity(KILL_COST);
        if (l) worse.push(l);
      }
      // It's done. The fight's log stays (a body stays to be searched, and the
      // last blows should still be there); what happens to you afterwards is
      // added, and is what the closing note says.
      // Walked away before anything happened: nothing carries over (no nerve, the coke still in you).
      const nothing = !e.fought && !e.chased && (e.result === 'left' || e.result === 'lost-them' || e.result === 'sold');
      after = nothing ? [] : afterFight(this.health, e.you, e.result!);
      // How it sits with you: what you did to them, and who they were.
      if (e.result !== 'lost' && e.result !== 'killed') {
        const start = e.start?.blood ?? e.them.maxBlood;
        const beat = e.them.out || e.them.blood < start - e.them.maxBlood * 0.25 || e.them.broken.length > (e.start?.broken.length ?? 0);
        const what = (e.tortured ?? 0) > 0 ? 'torture' : e.mugged || (e.robbed && e.result === 'mugged') ? 'mug' : beat ? 'beat' : null;
        if (what) {
          const g = guilt(e, what, this.humanity.lost);
          after.push(...g.lines);
          const h = this.health;
          h.stress = Math.max(0, Math.min(100, (h.stress ?? 0) + g.stress));
        }
      }
    }
    after.push(...worse);
    /** (Where the fight's own lines end, before what happens to you after.) */
    const fightTo = e.log.length;
    for (const text of after) e.log.push({ by: 'info', text });
    // What finished you: the last thing they did.
    const lastHit = ([...e.log].reverse().find((l) => l.by === 'them' && l.hit === 'you') ?? [...e.log].reverse().find((l) => l.by === 'them'))?.text;
    const hitText = lastHit?.replace(/(\s*(You're out cold|You're concussed|You're bleeding[^.]*|You're winded|Something cracks[^.]*)\.)+\s*$/, '');
    const remember = hitText && !e.you.drugOut && e.result === 'lost' ? [`The last thing you remember: ${hitText[0].toLowerCase()}${hitText.slice(1)}`] : [];
    if (this.health.dead) {
      if (impacts.length) this.feel(impacts);
      return this.die(after.length ? [...remember, ...after] : e.log.map((l) => l.text), after.some((l) => /Then it stops, and nobody comes/.test(l)) ? 'You overdosed.' : undefined);
    }
    if (impacts.length) this.feel(impacts);
    else buzz(6);
    // It's over and they're gone (or you are): the screen closes, and how it
    // ended is a note. A body stays, to be searched, until you walk away.
    // Knocked out: the screen goes off, and you have to come to.
    // (A beat first, so the blow that ended it lands, and you can read it.)
    if (!wasOver && e.stage === 'over' && e.result !== 'killed') {
      const ko = e.result === 'lost';
      // They got away (or walked off): say how, and why, not just that they're gone.
      const how = e.result === 'lost-them' || e.result === 'they-fled' ? [...e.log.slice(logFrom, fightTo).filter((l) => l.by !== 'you' && !/ went up to \d+\.$/.test(l.text)).map((l) => l.text).slice(-2), ...(e.chaseEnd ? [e.chaseEnd] : []), ...(e.whyRan ? [e.whyRan] : [])].filter((x, i, a) => a.indexOf(x) === i) : [];
      const lines = ko && e.chaseOut ? ['You collapsed.', ...after] : ko ? [RESULT.lost, ...remember, ...after] : [e.deal?.kind === 'sting' ? 'It was a setup.' : RESULT[e.result ?? 'left'], ...how, ...after];
      // (Saved now: a reload in the beat still ends it properly.)
      if (ko) this.save.state.koLines = lines;
      else this.save.state.endLines = lines;
      this.ending = true;
      this.closeSheet();
      this.refresh();
      this.timers.push(
        window.setTimeout(() => {
          this.ending = false;
          if (this.closed || this.encounter !== e) return;
          delete this.save.state.endLines;
          if (ko) this.knockedOut(lines);
          else this.closeEncounter(lines);
        }, impacts.length ? 1100 : e.result === 'left' || e.result === 'walked' ? 700 : 1800),
      );
      return;
    }
    // A body on the ground: a moment before Lurk and Rest take a tap.
    if (!wasOver && e.stage === 'over') {
      this.tapsFrom = performance.now() + 800;
    }
    this.refresh();
  }

  private noteFade = 0;
  /** A fight just ended: a beat to see it land before the screen changes. */
  private ending = false;
  /** Taps on Lurk and Rest count from here (not straight through from a fight). */
  private tapsFrom = 0;
  /** Knocked out, the screen off: what to say when you come to. */
  private koLines: string[] | null = null;
  /** Out cold: listening for a shake to bring the power button back. */
  private koListen: AbortController | null = null;

  /**
   * Knocked out: the screen switches off like an old set (picture, line,
   * dot), the cracks stay on the glass, and nothing comes back until you
   * shake the phone; then the power button, and you come to.
   */
  private knockedOut(lines: string[]) {
    this.closeSheet();
    this.heldNote = [];
    // While you lay there, they may have gone through your pockets.
    const beaten = this.encounter;
    if (beaten?.enforcer) {
      const dz = this.debt;
      const inv = this.inventory;
      const c = Math.round(cashOf(inv) * 100);
      const owed = dz?.owed ?? 0;
      if (dz && c) {
        dz.owed = Math.max(0, dz.owed - c);
        inv.purse = {};
      }
      // Short, and they take what's worth taking too (that's for the trouble).
      const took = dz && dz.owed ? inv.items.filter((x) => x.kind === 'phone' || x.kind === 'weapon' || (x.secret && x.secret !== 'empty')) : [];
      inv.items = inv.items.filter((x) => !took.includes(x));
      const gone = [...(c ? [money(c)] : []), ...took.map((x) => lc(x.name))];
      lines = [
        ...lines,
        gone.length ? `When you come to, your pockets are empty. Gone to Dez: ${gone.join(', ')}.` : 'When you come to, they\'ve been through your pockets and found nothing.',
        dz && dz.owed ? `You still owe ${money(dz.owed)}.` : c > owed ? "That's the debt paid. Dez's man kept the rest, for the trouble." : "That's the debt paid.",
      ];
      if (dz && !dz.owed) delete this.save.state.debt;
    } else if (beaten && !beaten.chaseOut && !beaten.them.out) {
      const robbed = robKnockedOut(this.world, this.inventory, beaten, isBrute(beaten.person.personality));
      if (robbed) lines = [...lines, robbed];
    }
    this.encounter = null;
    this.koLines = lines;
    // (Saved too: a reload while you're out doesn't skip coming to.)
    this.save.state.koLines = lines;
    this.tvState.on = false;
    this.tv.switchOff();
    sound.thunk();
    this.view.classList.add('ko-out');
    this.powerBtn.hidden = true;
    this.powerBtn.classList.remove('pressed');
    this.koHint.hidden = true;
    this.refresh();
    buzz([200, 80, 400]);
    this.waitToComeRound();
  }

  /** Out cold, the screen off: the hint, then a shake (or a tap) brings the power button back. */
  private waitToComeRound() {
    this.koListen?.abort();
    const ko = (this.koListen = new AbortController());
    const comeRound = () => {
      if (ko.signal.aborted) return;
      ko.abort();
      this.koListen = null;
      this.koHint.hidden = true;
      this.powerBtn.hidden = false;
      buzz(20);
    };
    // A shake: two hard jolts within a moment.
    let last: { x: number; y: number; z: number } | null = null;
    let jolts: number[] = [];
    let heard = false;
    addEventListener(
      'devicemotion',
      (ev) => {
        const a = ev.accelerationIncludingGravity;
        if (!a || a.x == null || a.y == null || a.z == null) return;
        heard = true;
        const p = { x: a.x, y: a.y, z: a.z };
        if (last) {
          const d = Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z);
          // A jolt: a big change, or a lot more (or less) than gravity alone.
          const off = Math.abs(Math.hypot(p.x, p.y, p.z) - 9.81);
          const t = performance.now();
          if (d > 9 || off > 7) {
            jolts = jolts.filter((j) => t - j < 900);
            jolts.push(t);
            if (jolts.length >= 2 && !this.koHint.hidden) comeRound();
          }
        }
        last = p;
      },
      { signal: ko.signal },
    );
    // After the dot has faded: the hint. With no motion sensor (a computer),
    // a tap does it instead.
    this.timers.push(
      window.setTimeout(() => {
        if (ko.signal.aborted) return;
        // No motion heard yet (a computer, or a phone keeping it to itself): a tap.
        this.koHint.textContent = heard ? 'Shake your phone to wake up' : 'Tap to wake up';
        this.koHint.hidden = false;
        if (!heard) this.koHint.onclick = comeRound;
        // Anywhere on the screen, not just the words.
        this.view.addEventListener('click', () => !heard && comeRound(), { signal: ko.signal });
      }, 2600),
    );
    // A phone that won't share its motion (permission refused): a tap, after a while.
    this.timers.push(
      window.setTimeout(() => {
        if (ko.signal.aborted) return;
        // (Shaking not working, or the phone's lying flat: a tap does it too.)
        this.koHint.textContent = heard ? 'Shake your phone (or tap) to wake up' : 'Tap to wake up';
        this.koHint.onclick = comeRound;
        this.view.addEventListener('click', comeRound, { signal: ko.signal });
      }, 9000),
    );
  }

  /** Done with whoever it was: back to the street, with what happened as a note. */
  private closeEncounter(lines: string[]) {
    this.encounter = null;
    this.tapsFrom = performance.now() + 800;
    this.refresh();
    uiGlitch(this.view, 0.35);
    this.note(lines, true);
    this.noteEl.firstElementChild?.classList.add('note-title');
    if (this.save.state.policeStop === 'sting') {
      this.save.state.policeWhy = ['The buyer has a badge out now. So do the two coming up behind you.'];
      this.openSheet('police');
    }
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
        sound.hit(Math.max(0.15, power), im.severe);
        if (im.ml > 0) this.hitUi.kick(power, you);
        // The picture breaks up a little with every blow (more when it's you).
        if (im.ml > 0) dispatchEvent(new CustomEvent('ui-glitch', { detail: (you ? 0.3 : 0.15) + power * 0.5 }));
        const wet = im.spill === 'splash' || im.spill === 'spray' || (im.spill === 'spatter' && you);
        if (wet && you && (power > 0.35 || Math.random() < 0.4)) this.hitUi.splash(im.severe ? 2 : 1, im.severe);
        if (wet && !you && im.severe && Math.random() < 0.6) this.hitUi.splash(1, false);
        this.jam = Math.max(this.jam, (you ? 0.45 : 0.25) + power * 0.4);
        if (you) buzz(im.severe ? [70, 40, 110] : [35 + Math.round(power * 30), 25, 45]);
        else buzz(im.severe ? [25, 35, 45] : [14 + Math.round(power * 16)]);
      }, i * 280);
      this.timers.push(t);
      if (this.timers.length > 40) this.timers.splice(0, this.timers.length - 40);
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
    return !this.ending && (this.idle || (this.running && !!e && e.stage === 'over'));
  }

  /**
   * You bled out. That character is gone for good: whoever finds the body
   * takes everything on it (see legacy.ts), and you go on as someone new,
   * with nothing. The world remembers.
   */
  private die(lines: string[], title = 'You bled out.') {
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
    if (e && e.stage !== 'seen') this.rememberThem(e);
    if (e) settle(w, e);
    // (Dying in the ER, nobody goes through your pockets.)
    const inEr = this.place === 'hospital';
    const indoors = this.inside;
    const robbed = indoors ? false : robBody(w, this.inventory, e);
    // (Whoever has your things now: their thief record and what you remember of them are one person.)
    const tid = e?.person.thief;
    const th = tid ? w.thieves.find((t) => t.id === tid) : undefined;
    if (e && th && e.person.known) {
      th.person.known = e.person.known;
      const k = this.people.find((x) => x.id === e.person.known);
      if (k) k.person = JSON.parse(JSON.stringify(th.person));
    }
    // (The old life's note doesn't wait for the new one.)
    this.unstick();
    this.noteEl.hidden = true;
    // A new you: nothing carried over but the world.
    // (Your name, your ID and your bank account were that character's.)
    for (const k of ['encounter', 'stats', 'health', 'inventory', 'humanity', 'place', 'policeStop', 'me', 'account', 'moves', 'koLines', 'record', 'policeResult', 'case', 'probationUntil', 'bailOffer', 'pawnBan', 'policeWhy', 'endLines', 'wokeLines', 'stash', 'room', 'sales', 'erSeen', 'debt', 'stingCash']) delete this.save.state[k];
    // Nobody knows this face. The people the old you hurt are still out there
    // (and your things on some of them), but they'd be looking for someone else.
    this.world.infamy = newInfamy();
    for (const k of this.people) {
      k.memory.sawFace = false;
      k.memory.clothes = [];
      k.memory.otherLife = true;
    }
    w.lives++;
    w.lifeStart = this.lurkState.times;
    const p = (t: string) => `<p>${t}</p>`;
    const html =
      `<h2>${title}</h2>` +
      `<div class="death-lines">${lines.slice(-3).map(p).join('')}</div>` +
      `<dl class="death-sum">` +
      `<div><dt>Lurked</dt><dd>${lurked}</dd></div>` +
      `<div><dt>Killed</dt><dd>${h.kills}</dd></div>` +
      `<div><dt>Humanity</dt><dd>${lvl?.name ?? (h.lost ? 'Shaken' : 'Intact')}</dd></div>` +
      `<div><dt>Cash</dt><dd>${money(Math.round(cash * 100))}</dd></div>` +
      `</dl>` +
      `<p class="death-after">${
        robbed
          ? 'Someone went through your pockets before you were cold. Whatever you had is out there now, on somebody.'
          : indoors && !inEr
            ? 'Somebody called it in. What you had on you went into a plastic bag with your name on it, and nobody comes for it.'
            : inEr
            ? 'You died in the hospital. What you had on you goes into a plastic bag with your name on it, and nobody comes for it.'
            : 'There was nothing on you worth taking.'
      }</p>` +
      `<button type="button" class="death-btn">Go on as someone new</button>`;
    // (Saved with it: closing the app on this screen still shows it next time.)
    this.save.state.deathScreen = html;
    this.onDeath?.();
    this.showDeath(html);
  }
  private showDeath(html: string) {
    document.getElementById('death')?.remove();
    const el = document.createElement('div');
    el.id = 'death';
    el.innerHTML = html;
    // (Not before it's faded in: a tap meant for the fight mustn't skip this.)
    const shownAt = performance.now();
    el.querySelector('button')?.addEventListener('click', () => performance.now() - shownAt > 2500 && this.rebirth());
    // Above everything, the blood on the glass included, so it can be read.
    document.body.append(el);
  }

  /** Off the death screen: a new character, same streets. */
  private rebirth() {
    document.getElementById('death')?.remove();
    delete this.save.state.deathScreen;
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
    type Drag = { id: number; x: number; y: number; side: 'left' | 'right' | 'bottom'; closing: boolean; grip?: boolean; atTop?: boolean };
    let drag: Drag | null = null;
    const down = (id: number, x: number, y: number, target: EventTarget | null) => {
      drag = null;
      if (!this.running) return;
      if (this.sheet === 'police') return;
      if (this.sheet) {
        // On the open drawer: a push back towards its edge closes it.
        const side = this.sheetEl.classList.contains('from-right') ? 'right' : this.sheetEl.classList.contains('from-bottom') ? 'bottom' : 'left';
        // Only from its top bar (the grab handle), or a big pull once its list is
        // scrolled all the way up: scrolling the list shouldn't close it.
        const card = this.sheetEl.firstElementChild as HTMLElement;
        const top = card.getBoundingClientRect().top;
        const grip = !!(target as Element | null)?.closest?.('.sheet-head') || y < top + 56;
        const rect = card.getBoundingClientRect();
        const atTop = (card.querySelector('.sheet-body')?.scrollTop ?? 0) <= 2 && y < rect.top + rect.height / 3;
        drag = { id, x, y, side, closing: true, grip, atTop };
        return;
      }
      const tab = (target as Element | null)?.closest?.('.edge-tab');
      // Up from the bottom: you (any time, like the stats used to be).
      if (tab === this.youBtn || (!tab && y > innerHeight - EDGE && Math.abs(x - innerWidth / 2) < innerWidth * 0.3 && !this.youBtn.hidden)) {
        drag = { id, x, y, side: 'bottom', closing: false };
        return;
      }
      if (!this.canOpenSheet) return;
      if (tab === this.goBtn || (!tab && x < EDGE)) drag = { id, x, y, side: 'left', closing: false };
      else if (tab === this.bagBtn || (!tab && x > innerWidth - EDGE)) drag = { id, x, y, side: 'right', closing: false };
    };
    const move = (id: number, x: number, y: number) => {
      if (!drag || drag.id !== id) return;
      if (drag.side === 'bottom') {
        const up = drag.y - y;
        const dx = Math.abs(x - drag.x);
        if (!drag.closing && up > 34 && up > dx * 1.2) {
          drag = null;
          this.openSheet('stats');
        } else if (drag.closing && ((drag.grip && -up > 50) || (drag.atTop && -up > 200)) && -up > dx * 1.5) {
          drag = null;
          this.closeSheet();
        }
        return;
      }
      const inward = (x - drag.x) * (drag.side === 'left' ? 1 : -1);
      const dy = Math.abs(y - drag.y);
      if (!drag.closing && inward > 34 && inward > dy * 1.2) {
        const side = drag.side;
        drag = null;
        this.openSheet(side === 'left' ? 'places' : 'pockets');
      } else if (drag.closing && -inward > 90 && -inward > dy * 1.5) {
        drag = null;
        this.closeSheet();
      }
    };
    const up = (id: number) => {
      if (drag?.id === id) drag = null;
    };
    const opt = { capture: true, passive: true, signal: this.listeners.signal } as const;
    addEventListener('touchstart', (e) => e.touches.length === 1 && down(e.changedTouches[0].identifier, e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.target), opt);
    addEventListener('touchmove', (e) => { for (const t of e.changedTouches) move(t.identifier, t.clientX, t.clientY); }, opt);
    addEventListener('touchend', (e) => { for (const t of e.changedTouches) up(t.identifier); }, opt);
    addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) up(t.identifier); }, opt);
    addEventListener('pointerdown', (e) => e.pointerType === 'mouse' && down(-1, e.clientX, e.clientY, e.target), opt);
    addEventListener('pointermove', (e) => e.pointerType === 'mouse' && e.buttons & 1 && move(-1, e.clientX, e.clientY), opt);
    addEventListener('pointerup', (e) => e.pointerType === 'mouse' && up(-1), opt);
  }

  private openSheet(kind: 'places' | 'pockets' | 'stats' | 'police') {
    // Stopped by the police: nothing else opens over that.
    if (this.sheet === 'police' && kind !== 'police') return;
    // Your stats can be looked at any time, even mid-fight; the police don't ask.
    if (kind === 'stats' || kind === 'police' ? !this.tvState.on || this.dead || this.ending : !this.canOpenSheet) return;
    this.sheet = kind;
    this.renderSheet();
    // Where to go comes in from the left, pockets from the right.
    this.sheetEl.classList.toggle('from-left', kind === 'places');
    this.sheetEl.classList.toggle('from-right', kind === 'pockets');
    this.sheetEl.classList.toggle('from-bottom', kind === 'stats');
    this.sheetEl.hidden = false;
    sound.whoosh();
    uiGlitch(this.sheetEl.firstElementChild, 0.4);
    buzz(6);
  }

  /** What happened while Places or the police were open, shown when they close. */
  private heldNote: string[] = [];
  private closeSheet() {
    this.sheetNote = [];
    if (this.sheet) uiGlitch(null, 0.25);
    this.sheet = null;
    this.sheetEl.hidden = true;
    const held = this.heldNote;
    this.heldNote = [];
    if (held.length && !this.closed && this.tvState.on) requestAnimationFrame(() => !this.closed && this.note(held));
  }

  private sheetClick(ev: MouseEvent) {
    const t = ev.target as HTMLElement;
    if (this.sheet === 'police') {
      // No walking away from this one: you answer.
      const b = t.closest('button');
      if (b?.dataset.police === 'bail' && !b.hasAttribute('disabled')) this.payBail();
      else if (b?.dataset.police === 'custody') this.heldForCourt();
      else if (b?.dataset.police === 'done') {
        delete this.save.state.policeResult;
        this.closeSheet();
        this.refresh();
      } else if (b?.dataset.police && !this.save.state.policeResult) this.police(b.dataset.police as 'run' | 'stay' | 'talk');
      return;
    }
    if (t === this.sheetEl) return this.closeSheet(); // tapped outside the card
    const b = t.closest('button');
    if (!b) return;
    // (Pockets: a tap that does something shows it.)
    if (this.sheet === 'pockets' && !b.disabled && b.dataset.close === undefined) {
      this.withFeedback(b, () => this.sheetAction(b));
      return;
    }
    this.sheetAction(b);
  }

  /** A sheet button: what it does. */
  private sheetAction(b: HTMLButtonElement) {
    if (b.dataset.close !== undefined) this.closeSheet();
    else if (b.dataset.place) this.goTo(b.dataset.place as Place);
    else if (b.dataset.use) this.useMed(Number(b.dataset.use));
    else if (b.dataset.drop) this.drop(Number(b.dataset.drop));
    else if (b.dataset.fire) this.fire(Number(b.dataset.fire));
    else if (b.dataset.smoke) this.smoke(Number(b.dataset.smoke));
    else if (b.dataset.burn) this.burn(Number(b.dataset.burn));
    else if (b.dataset.mask !== undefined) this.toggleCover('mask');
    else if (b.dataset.hood !== undefined) this.toggleCover('hood');
    else if (b.dataset.taste) this.identify(Number(b.dataset.taste), false);
    else if (b.dataset.test) this.identify(Number(b.dataset.test), true);
    else if (b.dataset.bump) this.bump(Number(b.dataset.bump));
    else if (b.dataset.bagup) this.bagUp(Number(b.dataset.bagup));
    else if (b.dataset.stash) this.stashItem(Number(b.dataset.stash));
    else if (b.dataset.inject) this.inject(Number(b.dataset.inject));
    else if (b.dataset.pack) this.packLoose(Number(b.dataset.pack));
    else if (b.dataset.move) this.moveItem(Number(b.dataset.move));
    else if (b.dataset.combine) this.combinePack(Number(b.dataset.combine));
    else if (b.dataset.findcar) this.findCar(Number(b.dataset.findcar));
    else if (b.dataset.searchcar) this.searchCar(Number(b.dataset.searchcar));
    else if (b.dataset.sleepcar) this.sleepInCar(Number(b.dataset.sleepcar));
    else if (b.dataset.holdR) this.hold(Number(b.dataset.holdR), 'right');
    else if (b.dataset.holdL) this.hold(Number(b.dataset.holdL), 'left');
    else if (b.dataset.putaway) this.putAway(Number(b.dataset.putaway));
    else if (b.dataset.load) this.loadGun(Number(b.dataset.load));
    else if (b.dataset.drink) this.drink(Number(b.dataset.drink));
  }

  /** Walk somewhere else. */
  private goTo(p: Place) {
    if (this.ending) return;
    this.shopNote = [];
    this.closeSheet();
    if (p === this.place || HIDDEN_PLACES.has(p)) return;
    this.shopAt = '';
    // A new trip to the ER is a new wait.
    this.erSeen = false;
    // Thrown out of the pawn shop: he won't let you back in for a while.
    if (((this.save.state.pawnBan as number) ?? 0) > now() + 30 * 60_000) this.save.state.pawnBan = now() + 30 * 60_000;
    if (p === 'pawn' && ((this.save.state.pawnBan as number) ?? 0) > now()) {
      this.note(['He sees you through the glass and shakes his head. The door stays locked.']);
      return;
    }
    this.place = p;
    this.encounter = null;
    this.unstick();
    this.noteEl.hidden = true;
    this.wipeBlood();
    this.jam = 0.8;
    this.refresh();
    uiGlitch(p === 'street' ? this.view : this.shopEl, 0.55);
    const info = placeInfo(p);
    const inside = this.inside;
    const lines = [
      !inside && info.indoors ? `You get to the ${info.name}. The doors are locked.` : {
        street: 'You head back out into the street.',
        pharmacy: 'You walk to the all-night pharmacy.',
        gas: 'You walk over to the gas station. The door chimes as you go in.',
        pawn: 'You walk over to the pawn shop.',
        fence: 'You slip down the alley behind the laundromat.',
        bank: 'You walk to the bank.',
        liquor: 'You walk into the liquor store. A bell jangles over the door.',
        records: 'You push through the doors of the City Records Office and take a ticket.',
        hospital: 'The ER doors hiss open. You give a name at the desk and they tell you to sit.',
        guns: 'A buzzer sounds as you push the door. The man behind the counter looks up, and keeps looking.',
        court: 'A deputy at the door watches you put your keys and phone in a plastic tray for the metal detector.',
        room: 'You climb the stairs to the Hotel Marlow. The man in the cage looks up, then down again.',
      }[p] ?? '',
    ];
    this.exposure = 0;
    this.wasInside = inside;
    this.insideAt = p;
    if (inside && !(p === 'room' && this.roomRented)) lines.push(...this.goingIn());
    // Whether your hiding places are as you left them.
    if (p === 'fence') lines.push(...this.checkStash());
    if (p === 'room') lines.push(...this.checkRoom());
    if (!inside && WET_AMOUNT[this.weather.now] > 0) lines.push(`It's still ${isSnow(this.weather.now) ? 'snowing' : 'raining'} (${WEATHER_NAME[this.weather.now].toLowerCase()}).`);
    this.note(lines);
    buzz(10);
  }

  /** Whether you were inside the place you're at (it can open or close around you). */
  private wasInside = false;
  private insideAt: Place | null = null;
  /** Through the door: the mask down, the knife away, the cigarette out. */
  private goingIn(): string[] {
    const lines: string[] = [];
    const h = this.health;
    const w = wearing(this.inventory);
    if (w.masked) {
      w.masked = false;
      lines.push(`You pull the ${w.face!.toLowerCase()} down before you go in.`);
    }
    if (h.cold) lines.push("It's warm in here. Stay a while and you'll thaw out.");
    const inHand = this.inventory.items.filter((x) => x.hand);
    if (inHand.length) {
      for (const x of inHand) delete x.hand;
      lines.push(`You put the ${inHand.map((x) => lc(x.name)).join(' and the ')} away before you go in.`);
    }
    if (this.smoking) {
      delete h.smokingUntil;
      lines.push('You stub the cigarette out on the wall before you go in.');
    }
    return lines;
  }

  /** Buy something at the pharmacy (cash only). */
  private buy(id: MedId) {
    if (id === 'iron') return;
    const m = medById(id);
    const inv = this.inventory;
    if (this.place !== 'pharmacy' || cashOf(inv) < m.price) return;
    const it = stow(inv, { kind: 'med', name: m.name, med: id });
    if (!it) {
      this.note([`You've got nowhere to put ${withA(m.name)}. ${noRoomWhy(inv, measure({ kind: 'med', name: m.name, med: id }).size)}`]);
      return;
    }
    const paid = this.payLine(m.price * 100);
    this.refresh();
    this.note([`You buy ${withA(m.name)}. ${paid}`]);
    buzz(8);
  }

  /** Hands over the money for something (cents), and says how it went. */
  private payLine(price: number): string {
    sound.coin();
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
      const check = this.showId('pawn');
      if (!check) return;
      lines.push(check);
    }
    inv.items.splice(i, 1);
    // The pawn shop pays from the till; the fence peels small bills off a roll.
    const got = place === 'pawn' ? fewest(o.cents) : cashLike(o.cents, 'small');
    addTo(inv.purse, got);
    sound.coin();
    lines.push(`You sell the ${lc(it.name)} for ${money(o.cents)} (${purseText(got)}).`);
    this.refresh();
    this.note(lines);
    buzz(8);
  }

  /** Buy something at the pawn shop or the gas station (and put it on, if it's clothes). */
  /**
   * Why you wouldn't buy this, because you've already got it: clothes and a
   * bag you're wearing, a cap or mask or shades you've got on, a sheath or
   * holster, a knife or gun of that kind. (Things that get used up, you can
   * always buy more of.)
   */
  private ownsWhy(s: { name: string; slot?: string; knife?: string; gun?: string }): string | null {
    const inv = this.inventory;
    if (s.slot === 'top' || s.slot === 'bottom' || s.slot === 'bag') return inv.clothes.includes(s.name) ? 'Wearing it' : null;
    if (s.slot === 'head' || s.slot === 'face' || s.slot === 'eyes') return wearing(inv)[s.slot] === s.name ? 'Wearing it' : null;
    if (s.slot === 'gear') return (inv.gear ?? []).includes(s.name) ? 'You have one' : null;
    const w = s.knife ?? s.gun;
    if (w) return inv.items.some((x) => x.kind === 'weapon' && x.name === w) ? 'You have one' : null;
    return null;
  }

  private buyStock(id: string) {
    const place = this.place;
    const s = (place === 'gas' ? GAS_STOCK : place === 'liquor' ? LIQUOR_STOCK : place === 'guns' ? GUN_STOCK : PAWN_STOCK).find((x) => x.id === id);
    const inv = this.inventory;
    if (s && this.ownsWhy(s)) return;
    if (!s || (place !== 'pawn' && place !== 'gas' && place !== 'liquor' && place !== 'guns') || (place !== 'gas' && !isOpen(placeInfo(place).hours!)) || cashOf(inv) < s.price) return;
    // The pawn shop and the liquor store want to see ID first.
    let idLine = '';
    if (place === 'pawn' || place === 'liquor') {
      const check = this.showId(place);
      if (!check) return;
      idLine = check;
    }
    // A gun: your own ID, a form, and a background check (ammunition and a holster just want ID).
    if (place === 'guns') {
      const mine = this.ownId();
      if (!mine) {
        const fake = inv.items.some((x) => x.kind === 'id');
        if (fake) this.goTo('street');
        this.note([fake ? 'He looks at the ID, then at you. "That\'s not you." He slides it back and doesn\'t take his eyes off you until you\'re out the door.' : '"ID first. Your own. Everybody gets the background check."']);
        return;
      }
      if (s.gun) {
        if (this.charged) {
          this.note(['You fill in the form, and he phones it through. It doesn\'t take long. "Denied." He doesn\'t say why. He doesn\'t need to: you\'ve been charged with something.']);
          return;
        }
        idLine = `You fill in the federal form and he phones your ${lc(mine.name)} through for the background check. Twenty minutes of waiting, then: "Proceed."`;
      } else idLine = `He checks your ${lc(mine.name)}.`;
    }
    let line: string;
    if (s.drink) {
      // Hot coffee, drunk standing at the counter.
      const h = this.health;
      const was = h.cold ?? 0;
      h.cold = Math.max(0, was - 1);
      h.stress = Math.max(0, (h.stress ?? 0) - 6);
      addCaffeine(h, 95);
      line = `You buy a coffee and drink it at the counter, too hot to taste. ${was ? (h.cold ? "Some of the cold goes out of you." : "You're warm again.") : 'Your hands steady a little.'}`;
    } else if (s.med) {
      const m = medById(s.med);
      if (!stow(inv, { kind: 'med', name: m.name, med: s.med })) {
        this.note([`You've got nowhere to put ${withA(m.name)}. ${noRoomWhy(inv, measure({ kind: 'med', name: m.name, med: s.med }).size)}`]);
        return;
      }
      line = `You buy ${withA(m.name)} from behind the counter.`;
    } else if (s.gun && gunOf(s.gun)) {
      const gn = gunOf(s.gun)!;
      // (Sold unloaded.)
      if (!stow(inv, { kind: 'weapon', name: gn.name, weapon: gn.club, doses: 0 })) {
        this.note([`Nowhere to carry it. ${noRoomWhy(inv, measure({ kind: 'weapon', name: gn.name }).size)}`]);
        return;
      }
      line = `He hands it over across the counter, unloaded, in a cardboard box. ${gn.desc}`;
    } else if (s.ammo) {
      if (!stow(inv, { kind: 'misc', name: s.name, doses: s.ammo })) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, measure({ kind: 'misc', name: s.name }).size)}`]);
        return;
      }
      line = `A box of ${s.ammo} ${s.name.replace(/ rounds$/, ' rounds').toLowerCase()}, heavier than it looks.`;
    } else if (s.knife && knifeOf(s.knife)) {
      const k = knifeOf(s.knife)!;
      if (!stow(inv, { kind: 'weapon', name: k.name, weapon: k.dmg, cuts: true })) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, measure({ kind: 'weapon', name: k.name }).size)}`]);
        return;
      }
      line = `He unlocks the case and slides the ${lc(k.name)} across. ${k.desc}`;
    } else if (s.slot === 'gear') {
      // Worn under your clothes, for a blade.
      if ((inv.gear ?? []).includes(s.name)) {
        this.note([`You've already got ${withA(lc(s.name))}.`]);
        return;
      }
      (inv.gear ??= []).push(s.name);
      inv.spots = spotsFor(inv.clothes, inv.gear);
      line = `You buy the ${lc(s.name)} and strap it on${s.id === 'anklesheath' ? ', under your pant leg' : ''}. Move ${s.id === 'holster' ? 'a handgun' : 'a knife'} into it from Pockets.`;
    } else if (s.slot === 'head' || s.slot === 'face' || s.slot === 'eyes') {
      // Something for your face: worn (a mask starts pulled down; pull it up in Pockets).
      const w = wearing(inv);
      const old = w[s.slot];
      w[s.slot] = s.name;
      if (s.slot === 'face') w.masked = false;
      line = `You buy the ${lc(s.name)}${old ? ` and toss your old ${old.toLowerCase()}` : ''}.${s.slot === 'face' ? ' You keep it pulled down for now (Pockets: pull it up).' : /s$/i.test(s.name) ? ' You put them on.' : ' You put it on.'}`;
    } else if (s.slot) {
      const r = wear(inv, s.slot, s.name);
      if (!r.ok) {
        this.note([`If you swap to the ${lc(s.name)}, ${lc(r.why)}`]);
        return;
      }
      line = `You buy the ${lc(s.name)} and put it on${r.old ? `, and leave your old ${r.old.toLowerCase()} in the bin out front` : ''}.`;
    } else {
      const brand = s.id === 'cigs' ? ['Red Crest', 'Mayfair Lights', 'Dakota Menthols', 'Ridgeway Reds', 'Union Blues', 'Harbor 100s'][Math.floor(Math.random() * 6)] : undefined;
      if (!stow(inv, { kind: 'misc', name: s.name, ...(brand ? { detail: brand } : {}), ...(s.drinkType ? { drink: s.drinkType } : {}), ...(s.doses ? { doses: s.doses } : s.id === 'lighter' ? { doses: 100 } : {}) })) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, measure({ kind: 'misc', name: s.name }).size)}`]);
        return;
      }
      line = s.id === 'energy' ? 'You buy an energy drink.' : s.id === 'beer' ? 'You buy a can of beer.' : s.id === 'vodka' ? 'You buy a pint of vodka in a paper bag.' : s.id === 'whiskey' ? 'You buy a pint of whiskey in a paper bag.' : s.id === 'wine' ? 'You buy a bottle of cheap red.' : s.id === 'cigs' ? `You buy a pack of ${brand}.` : s.id === 'matches' ? 'You buy a book of matches.' : `You buy the ${lc(s.name)}.`;
    }
    const paid = this.payLine(s.price * 100);
    this.refresh();
    this.note([...(idLine ? [idLine] : []), line, paid]);
    buzz(8);
  }

  /** Who you are, this time round: a name (for your ID), and an age. */
  private get me(): { name: string; age: number } {
    return (this.save.state.me ??= { name: randomName(), age: 22 + Math.floor(Math.random() * 25) }) as { name: string; age: number };
  }
  /** Your bank account, once you've opened one (this character's). */
  private get account(): { cents: number } | undefined {
    return this.save.state.account as { cents: number } | undefined;
  }
  /** Your own ID, if you have it on you. */
  private ownId(): InvItem | undefined {
    return this.inventory.items.find((x) => x.kind === 'id' && x.own === this.world.lives);
  }
  /**
   * Showing ID at the pawn shop or the liquor store: your own is fine; a
   * stolen one might not look like you (thrown out); none, and no sale.
   * Returns the line to show, or null if it went wrong (and says so).
   */
  private showId(place: 'pawn' | 'liquor'): string | null {
    const inv = this.inventory;
    const mine = this.ownId();
    if (mine) return place === 'pawn' ? `He glances at your ${lc(mine.name)} and copies the name into a book.` : 'The clerk glances at your ID and nods.';
    const id = inv.items.find((x) => x.kind === 'id' && !/expired/i.test(x.name));
    if (!id) {
      this.note([place === 'pawn' ? '"I need to see some ID." He taps the sign: all customers must show photo ID.' : '"ID?" You haven\'t got any. "Then no."']);
      return null;
    }
    // It isn't you, and they can tell... unless you talk them round.
    const doubt = Math.random() < (place === 'pawn' ? 0.2 : 0.25);
    if (doubt && Math.random() < 0.15 + lieBonus(this.stats) * 0.8) {
      train(this.stats, 'speech', 5);
      return `${place === 'pawn' ? 'He looks' : 'The clerk looks'} at the photo, then at you, frowning. "Lost a lot of weight since then," you say, and laugh, and ${place === 'pawn' ? 'he lets' : 'they let'} it go.`;
    }
    if (doubt) train(this.stats, 'speech', 1);
    if (doubt) {
      // It isn't you, and they can tell.
      const line = place === 'pawn' ? `He looks at the ${lc(id.name)}, then at you, then at it again. "That's not you." He slides it back. "Get out of my shop."` : `The clerk looks at the photo, then at you. "Nice try." They keep the bottle, and the ID goes in a drawer under the counter.`;
      if (place === 'liquor') inv.items.splice(inv.items.indexOf(id), 1);
      if (place === 'pawn') {
        this.save.state.pawnBan = now() + 30 * 60_000;
        this.goTo('street');
        this.note([line, 'You end up back on the street.']);
      } else this.note([line]);
      return null;
    }
    return place === 'pawn' ? `He glances at the ${lc(id.name)} and copies the name into a book.` : `The clerk squints at the ${lc(id.name)}, and lets it go.`;
  }
  /** What the ER can do for you right now (and for which limbs). */
  private erNeeds() {
    const h = this.health;
    const limbs = h.broken.filter((p) => /arm|leg/.test(p) && !h.splinted?.includes(p));
    return {
      stitches: h.bleeding > 0 || (!!h.marks?.brow && !h.stitched?.brow) || (!!h.marks?.lip && !h.stitched?.lip),
      nose: h.broken.includes('nose') && !h.noseSet && (h.mending.nose ?? 0) > 6,
      cast: limbs,
      lung: !!h.lung,
      blood: h.blood < h.maxBlood * 0.8,
    };
  }
  /** Seen once this visit: the wait in the waiting room is over. */
  /** Seen by triage on this trip to the ER (kept in the save: a reload doesn't put you back in the queue). */
  private get erSeen(): boolean {
    return !!this.save.state.erSeen;
  }
  private set erSeen(v: boolean) {
    if (v) this.save.state.erSeen = true;
    else delete this.save.state.erSeen;
  }

  /**
   * The ER. They treat what you can't: stitches, setting a nose, a cast, a
   * chest tube, blood. Self-pay at the window. First the wait (unless you're
   * bleeding badly or can't breathe: then they take you straight in), and
   * the wait is real: you keep bleeding while you sit there.
   */
  private er(what: ErCare) {
    if (this.place !== 'hospital') return;
    const h = this.health;
    const inv = this.inventory;
    let need = this.erNeeds();
    let price = ER_PRICES[what] * (what === 'cast' ? Math.max(1, need.cast.length) : 1);
    const can = what === 'cast' ? need.cast.length > 0 : need[what];
    if (!can || cashOf(inv) * 100 < price * 100) return;
    const lines: string[] = [];
    const hadCut = h.bleeding > 0;
    if (!this.erSeen) {
      // Triage: bleeding badly, can't breathe, or white as a sheet, you go straight in;
      // bleeding at all, they move you up the list.
      const urgent = h.bleeding >= 3 || h.lung || h.blood < h.maxBlood * (PASS_OUT + 0.1);
      if (urgent) lines.push('One look at you and triage takes you straight through, past everyone waiting.');
      else {
        const wait = h.bleeding >= 2 ? 1 : 2 + Math.floor(Math.random() * 3);
        lines.push(wait === 1 ? 'Triage moves you up the list. Still an hour in a plastic chair, pressing a wad of paper towels to the wound.' : `You wait. ${wait} hours of plastic chairs, a TV nobody's watching, and a vending machine that eats your change.`);
        // (Sitting up in a chair, not lying down resting.)
        lines.push(...passHours(h, wait, false));
        if (h.dead) return this.die(lines, 'You died in the waiting room.');
      }
      this.erSeen = true;
      // By the time they call your name, it may not need doing (a cut that's
      // stopped bleeding still gets closed, though).
      need = this.erNeeds();
      if (what === 'stitches' && hadCut) need.stitches = true;
      price = ER_PRICES[what] * (what === 'cast' ? Math.max(1, need.cast.length) : 1);
      if (what === 'cast' ? !need.cast.length : !need[what]) {
        lines.push('By the time they call your name, there’s nothing they need to do. They send you home.');
        this.refresh();
        this.note(lines);
        return;
      }
    }
    switch (what) {
      case 'stitches': {
        const was = h.bleeding;
        h.bleeding = 0;
        if (h.marks?.brow) (h.stitched ??= {}).brow = true;
        if (h.marks?.lip) {
          (h.stitched ??= {}).lip = true;
          (h.markHours ??= {}).lip = Math.min(h.markHours.lip ?? 24, 12);
        }
        lines.push(was ? 'A tired resident cleans you up, numbs it and sews you shut. The bleeding stops.' : 'They clean the cut out, glue it and tape it. It stings like hell.');
        if (h.marks?.brow) lines.push('Stitched, the cut over your eye will heal to a faint line.');
        break;
      }
      case 'nose':
        h.mending.nose = Math.ceil((h.mending.nose ?? 8) / 2);
        h.noseSet = true;
        lines.push('A doctor puts both thumbs on your nose and pushes it straight. You see white. Packing, tape, and a sheet of instructions.');
        break;
      case 'cast':
        for (const p of need.cast) {
          h.mending[p] = Math.ceil((h.mending[p] ?? 24) / 2);
          (h.splinted ??= []).push(p);
        }
        lines.push(`An X-ray, then they set the ${need.cast.join(' and the ')} and put ${need.cast.length > 1 ? 'them' : 'it'} in a cast. ${need.cast.some((p) => p.endsWith('leg')) ? 'They give you crutches and a lecture.' : 'They give you a sling.'}`);
        break;
      case 'lung':
        h.lung = false;
        lines.push('They numb your side and push a tube in between your ribs. Air hisses out, and you can breathe again. A few hours on a gurney in the hall, then you sign yourself out against advice.');
        lines.push(...passHours(h, 1, true));
        break;
      case 'blood':
        h.blood = Math.max(h.blood, Math.round(h.maxBlood * 0.92));
        lines.push('Two bags of someone else’s blood, an hour on a drip. Color comes back into your hands.');
        lines.push(...passHours(h, 1, true));
        break;
    }
    if (h.dead) return this.die(lines);
    lines.push(this.payLine(price * 100).replace(/^You hand over/, 'At the window you hand over'));
    this.refresh();
    this.note(lines);
    buzz(8);
  }

  /** At the Records Office: your own State ID, in your name. */
  private getId() {
    const inv = this.inventory;
    if (this.place !== 'records' || !isOpen(placeInfo('records').hours!) || this.ownId() || cashOf(inv) < ID_FEE) return;
    const me = this.me;
    const it = stow(inv, { kind: 'id', name: 'State ID', detail: `${me.name}, ${me.age}`, own: this.world.lives });
    if (!it) {
      this.note([`Nowhere to put it. ${noRoomWhy(inv, 'small')}`]);
      return;
    }
    const paid = this.payLine(ID_FEE * 100);
    const waited = passHours(this.health, 1);
    if (this.health.dead) return this.die(waited);
    this.refresh();
    this.note([...waited, `An hour of waiting, a photo where you look like a suspect, and a card still warm from the printer: ${me.name}.`, paid]);
    buzz(8);
  }

  /** At the bank: change money up or down. */
  private bank(what: string) {
    const inv = this.inventory;
    const p = inv.purse;
    if (this.place !== 'bank') return;
    const teller = isOpen(placeInfo('bank').hours!);
    let line = '';
    // Your account: opening it, and using it, take your own ID.
    // A typed amount (in dollars, to the cent).
    if (what.endsWith(':amt')) {
      const v = Number((document.getElementById('bank-amt') as HTMLInputElement | null)?.value ?? '');
      const cents = Math.round(v * 100);
      if (!Number.isFinite(cents) || cents <= 0) {
        this.note(['Type in how much first.']);
        return;
      }
      what = `${what[0]}:${cents}`;
    }
    if (what === 'open' || what === 'deposit' || what.startsWith('w:') || what.startsWith('d:')) {
      if (!teller) return;
      const mine = this.ownId();
      if (!mine) {
        this.note(['"I\'ll need to see your ID." Your own. The City Records Office can make you one.']);
        return;
      }
      const acct = this.account;
      if (what === 'open') {
        if (acct) return;
        this.save.state.account = { cents: 0 };
        line = `The teller checks your ${lc(mine.name)}, types for a long time, and slides a form across. "You're all set, ${this.me.name.split(' ')[0]}."`;
      } else if (!acct) return;
      else if (what === 'deposit') {
        const c = Math.round(cashOf(inv) * 100);
        if (!c) return;
        acct.cents += c;
        inv.purse = {};
        sound.coin();
        line = `You hand over everything: ${money(c)}. Your balance is ${money(acct.cents)}.`;
      } else if (what.startsWith('d:')) {
        const want = Math.round(Number(what.slice(2)));
        if (!Number.isFinite(want) || want <= 0) return;
        const have = Math.round(cashOf(inv) * 100);
        if (want > have) {
          this.note([`You've only got ${money(have)} on you.`]);
          return;
        }
        // You hand it all over; the teller counts it, keeps what you said,
        // and gives the rest back in as few bills as it'll go.
        inv.purse = {};
        addTo(inv.purse, fewest(have - want));
        acct.cents += want;
        sound.coin();
        line = `The teller counts your cash, puts ${money(want)} in your account and hands back ${money(have - want)}. Balance: ${money(acct.cents)}.`;
      } else {
        const want = what === 'w:all' ? acct.cents : Math.round(Number(what.slice(2)));
      if (!Number.isFinite(want) || want <= 0) return;
        const c = Math.min(acct.cents, want);
        if (c <= 0) return;
        acct.cents -= c;
        addTo(p, fewest(c));
        sound.coin();
        line = `The teller counts out ${money(c)}. ${money(acct.cents)} left in your account.`;
      }
      this.refresh();
      this.note([line]);
      buzz(8);
      return;
    }
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

  /**
   * A stolen card and the PIN they gave you. If they lied, the machine keeps
   * the card. If not, it pays out, once: by morning the card is stopped.
   * The camera sees whoever's using it.
   */
  private atm(i: number) {
    const inv = this.inventory;
    const card = inv.items[i];
    if (this.place !== 'bank' || !card || !/card/.test(card.kind) || !card.pin || card.drained) return;
    const anon = anonymity(inv);
    const f = this.infamy;
    const lines: string[] = [];
    lines.push(anon >= 0.5 ? 'You keep your face down, away from the camera, and push the card in.' : 'You push the card in. The little camera over the screen watches you.');
    if (!card.pinOk) {
      inv.items.splice(i, 1);
      lines.push(`You type ${card.pin}. WRONG PIN. You try again. On the third try the machine swallows the card. They lied to you.`);
      f.heat = Math.min(100, f.heat + 4 * (1 - anon));
    } else {
      const credit = card.kind === 'credit card';
      const twenties = credit ? 2 + Math.floor(Math.random() * 19) : 1 + Math.floor(Math.random() * 15);
      addTo(inv.purse, { 2000: twenties });
      card.drained = true;
      lines.push(`You type ${card.pin}. It works. You take out ${money(twenties * 2000)}${credit ? ' on a cash advance' : ', all that was in there'}, in twenties.`);
      lines.push("By morning they'll have stopped the card.");
      f.heat = Math.min(100, f.heat + 10 * (1 - anon));
    }
    this.refresh();
    this.note(lines);
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
   * Uses the flame: a lighter burns fuel (a quick light a little, keeping it
   * lit for a fire a lot), a matchbook loses matches (more in the rain).
   * Returns a line if it's run out (and it's thrown away).
   */
  private useFlame(fire: InvItem, use: 'light' | 'burn' | 'fire'): string | null {
    const inv = this.inventory;
    const wet = WET_AMOUNT[this.weather.now] > 0 && !this.inside;
    const matches = /matches/i.test(fire.name);
    const left = flameLeft(fire);
    if (matches) {
      const n = { light: 1, burn: 2, fire: 3 }[use] + (wet ? 1 : 0);
      fire.doses = Math.max(0, left - n);
    } else {
      const pct = { light: 2, burn: 5, fire: 10 }[use] * (wet ? 1.5 : 1) * (0.7 + Math.random() * 0.6);
      fire.doses = Math.max(0, Math.round(left - pct));
    }
    if (fire.doses > 0) return null;
    inv.items.splice(inv.items.indexOf(fire), 1);
    return matches ? 'That was the last match. You drop the empty book.' : "The lighter sputters and dies. It's out of fuel. You toss it.";
  }

  /**
   * A cigarette. It steadies your hands for a minute and does nothing good
   * for you. With a punctured lung, it comes back up red.
   */
  private smoke(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const fire = this.flame();
    if (!it || !fire || this.smokeBlocked() || (it.doses ?? 1) <= 0) return;
    it.doses = (it.doses ?? 1) - 1;
    const h = this.health;
    useHabit(h, 'nicotine', 4);
    // A cigarette takes about six minutes to smoke, for real.
    h.smokingUntil = now() + SMOKE_MS;
    const lines = [
      WET_AMOUNT[this.weather.now] > 0 && !this.inside
        ? `You hunch over a cigarette, cupping it from the ${isSnow(this.weather.now) ? 'snow' : 'rain'}, and get it lit on the third try.`
        : ['You light a cigarette and pull the smoke deep. Your hands stop shaking.', 'You light up and lean back, watching the street.', 'The first drag burns. The second one helps.'][Math.floor(Math.random() * 3)],
    ];
    if (h.lung) {
      lines.push('Your chest seizes. You cough, and it comes up pink and frothy.');
      this.fx.impact(true, 0, false, 'cough');
    } else if (h.broken.includes('ribs')) lines.push('Every drag pulls at your broken ribs.');
    if (it.doses <= 0) {
      if (/^loose/i.test(it.name)) {
        inv.items.splice(inv.items.indexOf(it), 1);
        lines.push('That was your last loose one.');
      } else {
        // Keep the empty pack: loose ones can go in it.
        it.doses = 0;
        lines.push("That was the last one in the pack. You keep the empty pack.");
      }
    }
    const out = this.useFlame(fire, 'light');
    if (out) lines.push(out);
    this.refresh();
    this.note(lines);
    buzz(6);
  }

  /** What you're on right now, for how the screen looks (fx/drugs.ts), and how strongly. */
  /**
   * How awake you are, for the cracks on the glass: in a fight, your Awake
   * bar (knocked out, nothing left); otherwise fine, or a little less while
   * you're concussed.
   */
  get awakeNow(): number {
    // Out cold, the screen off: the cracks stay.
    if (this.koLines) return 4;
    const e = this.encounter;
    if (e && (e.stage === 'combat' || e.stage === 'over') && this.tvState.on) return e.you.out ? 0 : (e.you.awake ?? 100);
    return this.health.concussion > 0 ? 82 : 100;
  }

  get drugNow(): { drug: DrugLook | null; k: number } {
    const e = this.encounter;
    if (e && e.stage === 'combat' && e.you.high) return { drug: e.you.high, k: 1 };
    const h = this.health;
    // Coke (or meth's edge) wears off on the clock, fight or no fight.
    if (h.wired) {
      h.wiredUntil ??= now() + 40 * 60_000;
      if (now() > h.wiredUntil && !(e && e.stage === 'combat')) {
        h.wired = false;
        delete h.wiredBy;
        delete h.wiredUntil;
      }
    }
    const left = (h.highUntil ?? 0) - now();
    // Wearing off over its last ten minutes.
    if (h.high && left > 0) return { drug: h.high, k: Math.min(1, 0.25 + left / 800_000) };
    if (h.wired) return { drug: 'cocaine', k: 1 };
    // Drunk: the more you've had, the more it shows.
    if (e && e.stage === 'combat' && (e.you.drunk ?? 0) >= 10) return { drug: 'drunk', k: Math.min(1, (e.you.drunk ?? 0) / 75) };
    soberUp(h);
    if ((h.drunk ?? 0) >= 10) return { drug: 'drunk', k: Math.min(1, (h.drunk ?? 0) / 75) };
    // Withdrawal: sick and grey, a tremor.
    const wdl = withdrawalEffects(h).worst;
    if (wdl && wdl.sev > 0.15) return { drug: 'withdrawal', k: Math.min(1, wdl.sev) };
    // Caffeine: a clean clarity, which turns into a tremor when it's too much.
    const mg = e && e.stage === 'combat' ? (e.you.caffeine ?? 0) : caffeineNow(h);
    if (caffeineLevel(mg)) return mg >= 400 ? { drug: 'jitters', k: Math.min(1, (mg - 300) / 300) } : { drug: 'caffeine', k: Math.min(1, mg / 200) };
    return { drug: null, k: 0 };
  }

  /**
   * A drink. Beer is a can's worth; liquor a swig. It eases stress and takes
   * the edge off the cold, and makes you worse in a fight. Too much and you
   * black out where you are.
   */
  private drink(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const h = this.health;
    if (!it?.drink || (it.doses ?? 0) <= 0 || !this.canOpenSheet) return;
    if (this.inside && !this.inOwnRoom && it.drink !== 'energy') {
      this.note(['Not in here. Someone behind the counter is already watching you.']);
      return;
    }
    if (it.drink === 'energy') {
      // Caffeine, not alcohol: nothing now, sharper in half an hour, for hours.
      inv.items.splice(i, 1);
      addCaffeine(h, 160);
      const mg = caffeineNow(h, now() + 45 * 60_000);
      this.closeSheet();
      this.refresh();
      this.note([
        'You crack the can and drink it down. Sickly sweet, and fizzing.',
        mg >= 600 ? "That's a lot of caffeine in you. Your heart's going to be pounding." : mg >= 400 ? 'Your hands are going to shake.' : "In half an hour you'll be sharp.",
        'You crush the can and drop it.',
      ]);
      buzz(6);
      return;
    }
    soberUp(h);
    const was = drunkLevel(h.drunk ?? 0);
    const beer = it.drink === 'beer';
    useHabit(h, 'alcohol', beer || /wine/i.test(it.name) ? 2 : 3);
    it.doses = (it.doses ?? 1) - 1;
    // About one standard drink in a can or a swig of wine; a swig of whiskey or
    // vodka from the bottle is nearer one and a half.
    h.drunk = Math.min(100, (h.drunk ?? 0) + (beer || /wine/i.test(it.name) ? 10 : 14));
    h.drunkAt = now();
    h.stress = Math.max(0, (h.stress ?? 0) - 8);
    const lines = [beer ? 'You crack the can and drink it down. Cold, and a little sour.' : 'You take a long pull from the bottle. It burns all the way down.'];
    // It feels like warmth, but it opens up your skin and you lose heat faster.
    if (h.cold) lines.push("A glow spreads out from your stomach. You're not any warmer, really: you just can't feel the cold as much.");
    if ((it.doses ?? 0) <= 0) {
      if (beer || /vodka|whiskey|wine/i.test(it.name)) {
        inv.items.splice(inv.items.indexOf(it), 1);
        lines.push(beer ? 'You crush the can and drop it.' : 'That was the last of it. You leave the bottle in a doorway.');
      } else lines.push("That's the last of it. The bottle's empty.");
    }
    const now_ = drunkLevel(h.drunk);
    if (h.drunk >= 90) {
      lines.push('The street tips over. You sit down hard, and then you are somewhere else entirely.');
      // Hours go by, as with resting: whoever you were watching is long gone.
      if (this.encounter?.stage === 'seen' || this.encounter?.stage === 'over') this.encounter = null;
      this.unstick();
      this.wipeBlood();
      lines.push(...passHours(h, 3));
      if (h.dead) return this.die(lines);
      // (Old saves, with no end time on it.)
      if (h.wired && h.wiredUntil == null) {
        h.wired = false;
        delete h.wiredBy;
        lines.push('Whatever you took wore off while you were gone.');
      }
      h.drunk = 40;
      h.drunkAt = now();
      lines.push('You come to in a doorway, hours later, with your mouth tasting of sick.');
    } else if (h.drunk >= 78 && h.drunk < 90) lines.push("The street spins. One more and you'll black out.");
    else if (now_ > was) lines.push(['', "You're tipsy. Everything's a bit funnier.", "You're drunk. The street sways when you turn your head.", "You're wasted. Your feet aren't where you left them.", "You're blackout drunk. One more and you're gone."][now_]);
    this.closeSheet();
    this.refresh();
    this.note(lines);
    buzz(6);
  }

  /** Loads a gun from a box of its rounds. */
  private loadGun(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const gn = gunOf(it?.name);
    if (!it || !gn) return;
    const box = inv.items.find((y) => y.name === gn.ammo && (y.doses ?? 0) > 0);
    const n = Math.min(gn.holds - (it.doses ?? 0), box?.doses ?? 0);
    if (!box || n <= 0) return;
    it.doses = (it.doses ?? 0) + n;
    box.doses = (box.doses ?? 0) - n;
    if (box.doses <= 0) inv.items.splice(inv.items.indexOf(box), 1);
    this.refresh();
    this.note([`You load ${n} round${n > 1 ? 's' : ''} into the ${lc(gn.name)}. ${it.doses} in it now.`]);
    buzz(6);
  }

  /** Into the next pocket or bag it fits (to hide it, or have it to hand). */
  private moveItem(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it || !this.canOpenSheet) return;
    const to = nextSpot(inv, it);
    if (!to) return;
    it.spot = to.id;
    const where = `${to.on.toLowerCase()}, ${to.name.toLowerCase()}`;
    const v = showing(inv, it);
    this.refresh();
    this.note([`You put the ${lc(it.name)} in your ${where}.${it.kind === 'weapon' ? ` ${v < 0.06 ? 'Nobody would know it was there.' : v < 0.16 ? 'It makes a slight bulge.' : v < 0.35 ? 'You can see the shape of it.' : 'Anyone can see it.'}${inBag(inv, it.spot) ? ' It’ll take a moment to get out.' : ''}` : ''}`]);
    buzz(5);
  }

  /** Put loose cigarettes into a pack (the fullest one with room: up to 20). */
  private packLoose(i: number) {
    const inv = this.inventory;
    const loose = inv.items[i];
    if (!loose || !/^loose cigarettes$/i.test(loose.name)) return;
    const pack = inv.items.filter((y) => /^(pack of )?cigarettes$/i.test(y.name) && (y.doses ?? 0) < 20).sort((a, b) => (b.doses ?? 0) - (a.doses ?? 0))[0];
    if (!pack) return;
    const n = Math.min(loose.doses ?? 1, 20 - (pack.doses ?? 0));
    pack.doses = (pack.doses ?? 0) + n;
    loose.doses = (loose.doses ?? 1) - n;
    if (loose.doses <= 0) inv.items.splice(inv.items.indexOf(loose), 1);
    this.refresh();
    this.note([`You slide ${n === 1 ? 'the cigarette' : `${n} cigarettes`} into the pack. ${pack.doses} in it now.`]);
    buzz(5);
  }

  /** Car keys: walk the block pressing the fob, and see what chirps. */
  private findCar(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it || it.kind !== 'car keys' || it.car || this.place !== 'street' || !this.canLurk) return;
    const make = (it.detail ?? 'car').replace(/ key fob$/i, '');
    const hours = (now() - (it.takenAt ?? 0)) / 3_600_000;
    if (hours > 3) {
      it.car = 'gone';
      this.note([`You walk the block pressing the fob. Nothing. By now the ${make} has been reported, towed, or driven home on the spare key.`]);
    } else if (Math.random() < 0.7) {
      it.car = 'found';
      this.note([`Somewhere down the block a ${make} chirps and flashes its lights. There it is.`, 'You can go through it or sleep in it. The fence knows someone who buys cars.']);
    } else {
      it.car = 'gone';
      this.note([`You walk three blocks pressing the fob. Nothing answers. Wherever the ${make} is parked, it isn't near here.`]);
    }
    this.refresh();
    buzz(6);
  }
  /** Through the glovebox, the console, the back seat. The alarm might go. */
  private searchCar(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it || it.car !== 'found' || it.carSearched || this.place !== 'street' || !this.canLurk) return;
    it.carSearched = true;
    const lines: string[] = ['You let yourself in and go through it: the glovebox, the console, under the seats.'];
    if (Math.random() < 0.2) {
      this.infamy.heat = Math.min(100, this.infamy.heat + 8);
      lines.push('The alarm goes off, whooping down the street. Lights come on in a window. You grab what you can.');
    }
    const r = Math.random;
    const table: Loot[] = [
      { kind: 'cash', name: 'Change from the cup holder', cash: Math.round((1 + r() * 6) * 4) / 4, where: 'cup holder' },
      { kind: 'cash', name: 'Cash in the glovebox', cash: Math.round(5 + r() * 55), where: 'glovebox' },
      { kind: 'misc', name: 'Laptop', detail: 'In a bag on the back seat', where: 'back seat' },
      { kind: 'misc', name: 'Phone charger', where: 'console' },
      { kind: 'misc', name: 'Pack of cigarettes', doses: 6 + Math.floor(r() * 10), where: 'door pocket' },
      { kind: 'misc', name: 'Painkillers', med: 'painkillers', where: 'glovebox' },
      { kind: 'weapon', name: 'Pocket knife', weapon: 4, cuts: true, where: 'glovebox' },
      { kind: 'misc', name: 'Parking tickets', detail: 'A wad of them, unpaid', where: 'sun visor' },
    ];
    const n = 1 + Math.floor(r() * 3);
    const picks = [...table].sort(() => r() - 0.5).slice(0, n);
    for (const l of picks) lines.push(take(inv, l).text);
    this.refresh();
    this.note(lines);
    buzz(8);
  }
  /** A night in a car: warm, dry, out of sight (until the owner's reported it). */
  private sleepInCar(i: number) {
    this.unstick();
    const inv = this.inventory;
    const it = inv.items[i];
    const h = this.health;
    if (!it || it.car !== 'found' || this.place !== 'street' || !this.canLurk) return;
    this.encounter = null;
    const lines = ['You climb into the back seat, lock the doors and curl up. The windows fog over.', ...passHours(h, REST_HOURS, true)];
    if (h.dead) return this.die(lines);
    h.cold = 0;
    h.stress = Math.max(0, (h.stress ?? 0) - 15);
    lines.push('You wake stiff and cold-footed, but dry.');
    // Reported by now: someone's been looking for it.
    const hours = (now() - (it.takenAt ?? 0)) / 3_600_000;
    if (hours > 3 && Math.random() < 0.4) {
      lines.push('A flashlight on the glass. Someone is tapping on the window with a baton.');
      this.infamy.heat = Math.min(100, this.infamy.heat + 10);
      it.car = 'gone';
      this.refresh();
      this.save.state.policeWhy = lines;
      this.save.state.policeStop = 'car';
      this.openSheet('police');
      return;
    }
    this.refresh();
    this.note(lines);
    buzz(8);
  }

  /** A weapon into your hand: out, ready, and seen by everyone. */
  private hold(i: number, hand: 'left' | 'right') {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it || it.kind !== 'weapon' || inv.items.some((y) => y.hand === hand)) return;
    if (this.inside) {
      this.note(['Not in here.']);
      return;
    }
    it.hand = hand;
    this.refresh();
    this.note([`You take out the ${lc(it.name)} and hold it in your ${hand} hand. Anyone who looks can see it.`]);
    buzz(6);
  }
  /** A weapon back where it's kept. */
  private putAway(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    if (!it?.hand) return;
    delete it.hand;
    const sp = inv.spots.find((s) => s.id === it.spot);
    this.refresh();
    this.note([`You put the ${lc(it.name)} away${sp ? ` (${sp.on.toLowerCase()}, ${sp.name.toLowerCase()})` : ''}.`]);
    buzz(5);
  }

  /** Cigarettes from one pack into another (the fullest with room; a pack holds 20). */
  private combinePack(i: number) {
    const inv = this.inventory;
    const from = inv.items[i];
    if (!from || !/^(pack of )?cigarettes$/i.test(from.name) || (from.doses ?? 0) <= 0) return;
    const to = inv.items.filter((y) => y !== from && /^(pack of )?cigarettes$/i.test(y.name) && (y.doses ?? 0) < 20).sort((a, b) => (b.doses ?? 0) - (a.doses ?? 0))[0];
    if (!to) return;
    const n = Math.min(from.doses ?? 0, 20 - (to.doses ?? 0));
    to.doses = (to.doses ?? 0) + n;
    from.doses = (from.doses ?? 0) - n;
    this.refresh();
    this.note([`You move ${n === 1 ? 'a cigarette' : `${n} cigarettes`} across. That pack has ${to.doses} now${from.doses ? `; ${from.doses} left in this one` : ', and this one’s empty'}.`]);
    buzz(5);
  }

  /** Smoking now (a cigarette that hasn't burned down yet). */
  get smoking(): boolean {
    const h = this.health;
    // A clock that was set ahead, then put right: a cigarette lasts six minutes at most.
    if ((h.smokingUntil ?? 0) > now() + SMOKE_MS) h.smokingUntil = now() + SMOKE_MS;
    clampClock(h);
    return (h.smokingUntil ?? 0) > now();
  }

  /** Why you can't light a cigarette now, or null. */
  private smokeBlocked(): string | null {
    if (!this.flame()) return 'Nothing to light it';
    if (this.inside && !this.inOwnRoom) return 'No smoking in here';
    if (this.smoking) return `Still smoking (${Math.ceil(((this.health.smokingUntil ?? 0) - now()) / 60000)} min left)`;
    if (!this.canOpenSheet) return 'Not now';
    return null;
  }

  /** How stressed you are right now (in a fight, the fight's). */
  get stressNow(): number {
    const e = this.encounter;
    if (!this.tvState.on) return 0;
    return (e && e.stage !== 'seen' && e.stage !== 'over' ? e.you.stress : this.health.stress) ?? 0;
  }

  /**
   * Time spent somewhere besides lurking (real time): indoors you thaw out,
   * a level every couple of minutes; out in the alley in the rain, you get
   * colder. (On the street, lurking does it.)
   */
  private tickExposure(dt: number) {
    const h = this.health;
    if (this.place === 'street' || !this.tvState.on) return;
    if ((this.exposure += dt) < 120) return;
    this.exposure = 0;
    if (this.inside && h.cold) {
      h.cold--;
      this.note([h.cold ? 'The warmth is getting into you. You thaw out a little.' : "You've warmed up. You stop shivering."]);
      this.refresh();
    } else if (!this.inside) {
      const c = this.chill();
      if (c) {
        this.note([c]);
        this.refresh();
      }
    }
  }

  /** While a cigarette burns, stress eases; when it's done, you flick it away. */
  private tickSmoke(dt: number) {
    const h = this.health;
    if (!h.smokingUntil) return;
    if (this.smoking) {
      // It eases the stress you're carrying: in a fight, the fight's.
      const e = this.encounter;
      const fighting = e && e.stage !== 'seen' && e.stage !== 'over' ? e.you : null;
      const f = fighting ?? h;
      if (f.stress) f.stress = Math.max(0, f.stress - (dt * SMOKE_EASE) / (SMOKE_MS / 1000));
      return;
    }
    delete h.smokingUntil;
    const e = this.encounter;
    if (e?.you) e.you.smoking = false;
    if (this.running && this.tvState.on) this.note(['The cigarette burns down to the filter. You flick it away.']);
    this.refresh();
  }

  /**
   * The police stop you (see lurk). Stay calm: they look at you and search
   * you; anything stolen on you, or a face that matches what they've been
   * told, and you're arrested. Run: agility against your injuries; get
   * caught and they put you on the ground first.
   */
  private police(choice: 'run' | 'stay' | 'talk') {
    const inv = this.inventory;
    const h = this.health;
    const f = this.infamy;
    const w = wearing(inv);
    const carStop = this.save.state.policeStop === 'car';
    const sting = this.save.state.policeStop === 'sting';
    delete this.save.state.policeStop;
    delete this.save.state.policeWhy;
    const lines: string[] = [];
    let arrested = false;
    /** What they charge you with, if it comes to that. */
    const charges: string[] = [];
    /** You lied to them and they didn't buy it: they look harder. */
    let lied = false;
    // Talking your way out: a story, a calm face. Harder the hotter you are,
    // and with a weapon showing or a mask on.
    // A warrant out for you: they run your name, and that's that.
    const pending = this.case;
    if (pending?.warrant && choice !== 'run') {
      lines.push('One of them runs your name on the radio. A pause. "There\'s a warrant out for you. Turn around."');
      arrested = true;
      if (pending.warrantFor !== 'sting') charges.push('Failure to appear');
    }
    // A buy that was a setup: arrested, the marked money goes back in an evidence bag.
    const takeMarked = () => {
      const marked = Math.min(Math.round(cashOf(inv) * 100), (this.save.state.stingCash as number) ?? 0);
      if (marked) pay(inv.purse, marked);
      delete this.save.state.stingCash;
    };
    if (sting && choice !== 'run') {
      takeMarked();
      lines.push('The cuffs go on. The twenty you took is marked; the bag is already in an evidence envelope.');
      arrested = true;
      charges.push('Selling a controlled substance');
    }
    // Asleep in a stolen car: they've run the plate.
    if (carStop && choice !== 'run') {
      lines.push('They run the plate while you blink at the flashlight. It comes back stolen. "Out of the car. Slowly."');
      arrested = true;
      charges.push('Possession of stolen property');
      inv.items = inv.items.filter((x) => !(x.kind === 'car keys' && x.car));
    }
    // A weapon in your hand when they pull up: that's the whole stop.
    const brandished = inv.items.find((x) => x.kind === 'weapon' && x.hand);
    if (brandished && choice !== 'run') {
      lines.push(`"Drop it! DROP THE ${brandished.name.toUpperCase()}!" Two guns on you. You drop it. They put you face down on the sidewalk.`);
      arrested = true;
      charges.push('Brandishing a weapon');
    }
    const talk = () => {
      const odds = Math.max(0.03, Math.min(0.9, 0.3 + lieBonus(this.stats) - f.heat / 150 - exposure(inv) * 0.6 - (w.masked ? 0.15 : 0) - ((h.drunk ?? 0) >= 40 ? 0.15 : 0)));
      if (Math.random() < odds) {
        lines.push(oneOf(['You tell them you\'re walking home from a late shift, and keep your voice bored. They look at each other. "Alright. Get going."', 'You give them a name, a street, a reason, all of it easy. One of them almost smiles. "Get home."', 'You apologize for nothing in particular and ask them for directions. They point the way, and drive off.']));
        f.heat = Math.max(0, f.heat - 3);
        const up = train(this.stats, 'speech', 6);
        if (up) lines.push(`Speech went up to ${up}.`);
        return true;
      }
      lines.push(oneOf(['You start on a story. Halfway through, you hear how it sounds. So do they.', 'You talk too fast. "Uh-huh. Turn around, hands on the car."']));
      lied = true;
      train(this.stats, 'speech', 2);
      return false;
    };
    if (choice === 'run') {
      const legs = h.broken.filter((p) => p.endsWith('leg')).length;
      const odds = 0.35 + accuracyBonus(this.stats) - legs * 0.3 - (h.cold ?? 0) * 0.05 - (h.stress ?? 0) * 0.002 - (h.blood < h.maxBlood * 0.75 ? 0.15 : 0);
      if (Math.random() < odds) {
        lines.push('You bolt. Shouts behind you, a car door, footsteps. You go over a fence and through a yard and down an alley, and when you stop, they\'re gone.');
        f.heat = Math.min(100, f.heat + 10);
        // They had the buy on camera: a warrant goes out for you.
        if (sting) {
          f.heat = Math.min(100, f.heat + 25);
          const c = this.case ?? { charges: [], bail: 0, courtAt: now() };
          if (!c.charges.includes('Selling a controlled substance')) c.charges = [...c.charges, 'Selling a controlled substance'];
          // (Already wanted for missing court, that stays the reason; otherwise it's the buy.)
          if (!c.warrant) c.warrantFor = 'sting';
          c.warrant = true;
          lines.push("They've got the buy on camera. There'll be a warrant out for you by morning.");
          if (c.bailPaid) {
            lines.push(`You were out on bail. Not any more: the ${money(c.bailPaid)} is gone.`);
            c.bailPaid = 0;
          }
          this.save.state.case = c;
          delete this.save.state.stingCash;
        }
      } else {
        lines.push('You bolt, and get about ten yards. One of them takes your legs out and you hit the sidewalk face first. A knee in your back, your arms wrenched behind you.');
        h.blood = Math.min(h.blood, Math.max(h.maxBlood * 0.6, h.blood - 350));
        h.stress = Math.min(100, (h.stress ?? 0) + 25);
        this.fx.impact(true, 350, true, 'spatter');
        this.fx.dirt(0.8);
        arrested = true;
        charges.push('Resisting arrest');
        // (What they stopped you for still stands.)
        if (carStop) {
          charges.push('Possession of stolen property');
          inv.items = inv.items.filter((x) => !(x.kind === 'car keys' && x.car));
        }
        if (brandished) charges.push('Brandishing a weapon');
        if (sting) {
          charges.push('Selling a controlled substance');
          takeMarked();
        }
      }
    } else if (brandished || arrested || sting) {
      // (Nothing to talk about.)
    } else if (choice === 'talk' && talk()) {
      // Talked your way out: no search.
    } else {
      if (w.masked) {
        w.masked = false;
        lines.push(`You pull the ${w.face!.toLowerCase()} down.`);
      }
      // Do you look like who they're after?
      const looks = Math.random() < (f.heat / 100) * (1 - anonymity(inv) * 0.5) + (lied ? 0.12 : 0);
      lines.push('They pat you down and go through your pockets.');
      // Weapons get taken off you, and they remember it. (A loaded syringe is evidence instead.)
      // A pat-down is your clothes. Your bag, only if they've reason to.
      const bagSearched = looks || lied || f.heat > 40 || Math.random() < 0.35;
      if (!bagSearched && inv.items.some((x) => inBag(inv, x.spot))) lines.push("They don't look in your bag.");
      const blades = inv.items.filter((x) => x.kind === 'weapon' && !(x.secret && x.secret !== 'empty') && (bagSearched || !inBag(inv, x.spot)));
      // A switchblade, a butterfly knife, a push dagger: illegal to carry, and that's an arrest.
      const banned = blades.filter((x) => /switchblade|butterfly|push dagger/i.test(x.name));
      if (banned.length) {
        arrested = true;
        charges.push('Carrying an illegal weapon');
      }
      if (blades.length) {
        inv.items = inv.items.filter((x) => !blades.includes(x));
        f.heat = Math.min(100, f.heat + 6);
        lines.push(`They find ${list2(blades.map((x) => `the ${lc(x.name)}`))} and take ${blades.length > 1 ? 'them' : 'it'}. "${blades.length > 1 ? 'What are these' : "What's this"} for?"`);
        // A gun on you: that's serious.
        if (blades.some((x) => gunOf(x.name))) {
          f.heat = Math.min(100, f.heat + 15);
          lines.push('The gun changes everything: one of them keeps a hand on his holster the whole time.');
        }
      }
      const evidence = inv.items.filter((x) => ((x.kind === 'id' && x.own !== this.world.lives) || x.kind === 'credit card' || x.kind === 'debit card' || (x.secret && x.secret !== 'empty')) && (bagSearched || !inBag(inv, x.spot)));
      if (evidence.length) {
        lines.push(`They find ${evidence.length === 1 ? `the ${lc(evidence[0].name)}` : `${evidence.length} things that aren't yours`}. "${evidence.length === 1 ? 'Whose is this' : 'Whose are these'}?"`);
        arrested = true;
        if (evidence.some((x) => x.kind !== 'misc' && !(x.secret && x.secret !== 'empty'))) charges.push('Possession of stolen property');
        if (evidence.some((x) => x.secret && x.secret !== 'empty')) charges.push(this.intent() ? 'Possession with intent to distribute' : 'Possession of a controlled substance');
      }
      if (looks) {
        lines.push('One of them looks at you a long time, then at his phone. "That\'s the one." The cuffs go on.');
        arrested = true;
        // Someone who saw your face went to them: picked out of a line-up.
        if ((f.killsSeen ?? 0) > 0 && f.heat > 60) {
          charges.push('Homicide');
          f.killsSeen = 0;
        } else if ((f.reports ?? 0) > 0 && f.heat > 60) {
          charges.push('Assault');
          f.reports = 0;
        }
      } else if (!evidence.length && !banned.length) {
        lines.push('They find nothing. "Stay out of trouble." They get back in the car and roll away.');
        f.heat = Math.max(0, f.heat - 5);
      }
    }
    if (arrested && pending?.warrant && pending.warrantFor !== 'sting' && !charges.includes('Failure to appear')) {
      lines.push('At the station they run your name. There\'s a warrant out for you, too.');
      charges.push('Failure to appear');
    }
    if (arrested) {
      // Booking: everything on you, bag and all. What's stolen or illegal is charged.
      if (!charges.includes('Possession of stolen property') && inv.items.some((x) => (x.kind === 'id' && x.own !== this.world.lives) || x.kind === 'credit card' || x.kind === 'debit card')) charges.push('Possession of stolen property');
      if (!charges.some((x) => /controlled substance|intent to distribute/.test(x)) && inv.items.some((x) => x.secret && x.secret !== 'empty')) charges.push(this.intent() ? 'Possession with intent to distribute' : 'Possession of a controlled substance');
      // With heat on you and a room rented, they get the address from the desk clerk.
      lines.push(...this.searchRoom(charges, f.heat));
      if (!charges.includes('Carrying an illegal weapon') && inv.items.some((x) => x.kind === 'weapon' && /switchblade|butterfly|push dagger/i.test(x.name))) charges.push('Carrying an illegal weapon');
      // Whatever's stolen is taken; a night in a cell.
      const before = inv.items.length;
      inv.items = inv.items.filter((x) => !((x.kind === 'id' && x.own !== this.world.lives) || x.kind === 'credit card' || x.kind === 'debit card' || x.kind === 'weapon' || (x.secret && x.secret !== 'empty') || x.name === 'Zip bags'));
      const took = before - inv.items.length;
      // It goes on your record: every arrest, and every charge.
      const rec = this.record;
      rec.arrests++;
      for (const c of charges) rec.charges[c] = (rec.charges[c] ?? 0) + 1;
      rec.last = now();
      lines.push(`You're arrested.${took ? ` They keep ${took === 1 ? 'the evidence' : `${took === 2 ? 'both' : `all ${took}`} things they took off you`}.` : ''}`);
      lines.push(...custodyCare(h));
      delete h.smokingUntil;
      lines.push('You spend the night in a holding cell that smells of bleach and piss.', ...passHours(h, 8, true));
      h.cold = 0;
      if (h.dead) return this.die(lines);
      if (charges.length) {
        // A case against you: bail, and a court date.
        const c = this.case ?? { charges: [], bail: 0, courtAt: 0 };
        c.charges = [...c.charges, ...charges];
        const priors = Math.max(0, rec.arrests - 1);
        // Arrested again while out on bail: it's revoked, and the money's gone.
        const revoked = !!c.bailPaid;
        if (revoked) {
          lines.push(`You were already out on bail. It's revoked: the ${money(c.bailPaid!)} you put up is gone.`);
          c.bailPaid = 0;
        }
        const noBail = revoked || c.charges.some((x) => chargeOf(x).bail === 0) || now() < ((this.save.state.probationUntil as number) ?? 0);
        c.bail = noBail ? 0 : Math.round(c.charges.reduce((n, x) => n + chargeOf(x).bail, 0) * (1 + priors * 0.5));
        c.courtAt = courtDate();
        c.warrant = false;
        this.save.state.case = c;
        lines.push(`In the morning you're charged: ${charges.map((x) => x.toLowerCase()).join(', ')}.`);
        if (noBail) {
          lines.push(revoked ? 'No bail this time. You\'re held until your hearing.' : now() < ((this.save.state.probationUntil as number) ?? 0) ? 'You were on probation. The judge doesn\'t even look up: no bail. You\'re held for your hearing.' : 'No bail. You\'re held until your hearing.');
          this.save.state.bailOffer = 'custody';
        } else {
          lines.push(`Bail is set at ${money(c.bail * 100)}. Pay it and you walk out today with a court date, and get it back when you show up. Or wait in jail for the hearing.`);
          this.save.state.bailOffer = 'bail';
        }
      } else lines.push('In the morning they let you go: not enough to charge you. This time.');
      if (charges.length) f.heat = Math.max(0, f.heat - 45);
      f.rep += 5;
      h.stress = Math.min(100, (h.stress ?? 0) + 15);
    }
    // What happened stays on the screen until you've read it.
    this.save.state.policeResult = lines;
    this.refresh();
    this.renderSheet();
    buzz(arrested ? [80, 60, 120] : 12);
  }

  /** Actually indoors: in a place that's open (outside a locked door, you're on the street). */
  private get inside(): boolean {
    const info = placeInfo(this.place);
    return info.indoors && (!info.hours || isOpen(info.hours));
  }
  /** A case against you: the charges, bail, and when your court date is. */
  private get case(): { charges: string[]; bail: number; courtAt: number; warrant?: boolean; warrantFor?: 'sting'; bailPaid?: number } | undefined {
    return this.save.state.case as { charges: string[]; bail: number; courtAt: number; warrant?: boolean; warrantFor?: 'sting'; bailPaid?: number } | undefined;
  }
  /** Paying bail: cash first, then the bank. You're out, with a court date. */
  private payBail() {
    const c = this.case;
    if (!c || this.save.state.bailOffer !== 'bail') return;
    const inv = this.inventory;
    const want = c.bail * 100;
    const cash = Math.round(cashOf(inv) * 100);
    const acct = this.account;
    if (cash + (acct?.cents ?? 0) < want) return;
    const fromCash = Math.min(cash, want);
    if (fromCash) {
      inv.purse = {};
      addTo(inv.purse, fewest(cash - fromCash));
    }
    if (want > fromCash && acct) acct.cents -= want - fromCash;
    c.bailPaid = want;
    c.courtAt = courtDate();
    delete this.save.state.bailOffer;
    this.save.state.policeResult = [
      `You pay the ${money(want)}${want > fromCash ? ' (some of it from your bank account)' : ''} and sign where they tell you to.`,
      `Your court date: ${dateText(c.courtAt)}, at the County Courthouse (weekdays, 9 to 4). Show up and you get the bail back. Don't, and there'll be a warrant out for you.`,
    ];
    sound.coin();
    this.refresh();
    this.renderSheet();
  }
  /** No bail (or you wouldn't pay it): County until the hearing, then the judge. */
  private heldForCourt() {
    const c = this.case;
    if (!c) return;
    const h = this.health;
    delete this.save.state.bailOffer;
    const lines = [...custodyCare(h), 'A day and a half in County: a bunk, a toilet with no seat, and the noise that never stops.', ...passHours(h, 36, true)];
    if (h.dead) return this.die(lines);
    h.stress = Math.min(100, (h.stress ?? 0) + 20);
    lines.push(...this.verdict(true));
    if (h.dead) return this.die(lines);
    wearOff(h);
    this.save.state.policeResult = lines;
    this.refresh();
    this.renderSheet();
  }
  /**
   * Before the judge: dropped, a fine, probation, or jail time, by the
   * charges, your record and how well you talk. Clears the case.
   */
  private verdict(inCustody: boolean): string[] {
    const c = this.case;
    if (!c) return [];
    const f = this.infamy;
    const rec = this.record;
    const priors = Math.max(0, rec.arrests - 1);
    // Convicted again while on probation: the old sentence comes back on top.
    const onProbation = now() < ((this.save.state.probationUntil as number) ?? 0);
    const sev = c.charges.reduce((n, x) => n + chargeOf(x).sev, 0) + (onProbation ? 4 : 0);
    const lines: string[] = [`Your case is called: ${c.charges.map((x) => x.toLowerCase()).join(', ')}. A public defender you've never met reads your file in the hallway.`];
    // Talking to the judge.
    const talk = lieBonus(this.stats);
    train(this.stats, 'speech', 4);
    // Your bail back, for turning up.
    if (c.bailPaid && !inCustody) {
      addTo(this.inventory.purse, fewest(c.bailPaid));
      lines.push(`You get your ${money(c.bailPaid)} bail back.`);
    }
    delete this.save.state.case;
    if (Math.random() < Math.max(0.03, Math.min(0.6, 0.38 - sev * 0.04 + talk * 0.5 - priors * 0.06))) {
      lines.push('The evidence is thin and the prosecutor lets it go. "Dismissed." You\'re out the door before anyone changes their mind.');
      f.heat = Math.max(0, f.heat - 20);
      return lines;
    }
    if (sev <= 3 && !onProbation) {
      const fine = Math.round(c.charges.reduce((n, x) => n + chargeOf(x).fine, 0) * (1 + priors * 0.25));
      const have = Math.round(cashOf(this.inventory) * 100) + (this.account?.cents ?? 0);
      if (have >= fine * 100) {
        let left = fine * 100;
        const cash = Math.round(cashOf(this.inventory) * 100);
        const fromCash = Math.min(cash, left);
        this.inventory.purse = {};
        addTo(this.inventory.purse, fewest(cash - fromCash));
        left -= fromCash;
        if (left && this.account) this.account.cents -= left;
        lines.push(`Your lawyer takes the deal: you plead guilty. ${/^\$(8|1[18](,|$))/.test(money(fine * 100)) ? 'An' : 'A'} ${money(fine * 100)} fine, paid at the window on the way out.`);
        f.heat = Math.max(0, f.heat - 30);
        return lines;
      }
      const days = Math.max(2, Math.round(fine / 100));
      lines.push(`You plead guilty. ${/^\$(8|1[18](,|$))/.test(money(fine * 100)) ? 'An' : 'A'} ${money(fine * 100)} fine you can't pay, so it's ${days} days instead.`);
      return [...lines, ...this.serve(days)];
    }
    if (sev <= 6 && !onProbation) {
      this.save.state.probationUntil = now() + 30 * 24 * 3_600_000;
      lines.push('Your lawyer takes the deal: you plead guilty and get probation. Get charged with anything while you\'re on it and you\'re held with no bail.');
      f.heat = Math.max(0, f.heat - 30);
      return lines;
    }
    const days = Math.round(c.charges.reduce((n, x) => n + chargeOf(x).days, 0) * (1 + priors * 0.3));
    lines.push(days >= 365 ? `Found guilty. ${Math.round(days / 365)} years in state prison.` : `Found guilty. ${days} days in County.`);
    return [...lines, ...this.serve(days)];
  }
  /** Time inside: you heal, you get harder, and you come out with nothing new. */
  private serve(days: number): string[] {
    const h = this.health;
    // (They don't let you bleed out inside: the wound's seen to first.)
    const lines = [...custodyCare(h), `You serve ${days >= 365 ? `${Math.round(days / 365)} years` : `your ${days} days`}. The food is gray, the nights are loud, and you learn who not to look at.`, ...passHours(h, Math.min(days * 24, 96), true)];
    if (h.dead) return lines;
    h.stress = Math.min(100, (h.stress ?? 0) + 25);
    h.nerve = Math.min(100, (h.nerve ?? 0) + 5);
    this.infamy.heat = 0;
    wearOff(h);
    lines.push('They give you back what you came in with, in a plastic bag, and open the door.');
    return lines;
  }
  /** At the courthouse: appear for your hearing (turning up late, with a warrant, they hold you). */
  private appear() {
    const c = this.case;
    if (this.place !== 'court' || !c || !isOpen(placeInfo('court').hours!) || this.inventory.items.some((x) => x.kind === 'weapon' && !/bottle|syringe/i.test(x.name))) return;
    if (!c.warrant && !hearingToday(c.courtAt)) {
      this.note([`The clerk finds your name. "Your hearing's ${dateText(c.courtAt)}. Come back then."`]);
      return;
    }
    const lines: string[] = [];
    if (c.warrant) {
      lines.push('You give your name at the desk. The clerk looks at her screen, then at the deputy. You\'re cuffed in the hall: there\'s a warrant out for you.');
      const fta = c.warrantFor !== 'sting';
      if (fta) c.charges.push('Failure to appear');
      c.warrant = false;
      delete c.warrantFor;
      const rec = this.record;
      rec.arrests++;
      if (fta) rec.charges['Failure to appear'] = (rec.charges['Failure to appear'] ?? 0) + 1;
      rec.last = now();
      lines.push(...this.passCell());
      if (this.health.dead) return this.die(lines);
    }
    lines.push(...this.verdict(false));
    if (this.health.dead) return this.die(lines);
    this.refresh();
    this.note(lines);
    buzz(10);
  }
  /** A night held after turning yourself in. */
  private passCell(): string[] {
    const lines = [...custodyCare(this.health), 'You spend the night in a holding cell.', ...passHours(this.health, 8, true)];
    this.health.cold = 0;
    delete this.health.smokingUntil;
    return lines;
  }

  /** Your criminal record (this character's): arrests, and what for. */
  private get record(): { arrests: number; charges: Record<string, number>; last?: number } {
    const r = this.save.state.record;
    // (Older saves: just "charged once".)
    if (r === true) this.save.state.record = { arrests: 1, charges: { 'Possession of stolen property': 1 } };
    else if (!r || typeof r !== 'object') this.save.state.record = { arrests: 0, charges: {} };
    return this.save.state.record as { arrests: number; charges: Record<string, number>; last?: number };
  }
  /** Ever been charged with anything (the gun store's background check sees it). */
  private get charged(): boolean {
    return Object.values(this.record.charges).some((n) => n > 0);
  }
  /** Marks on you (scars, teeth, bruises): nothing dangerous, so set apart and greyed. */
  private marksHtml(): string {
    const ms = injuryEffects(this.health).filter((i) => i.mark);
    if (!ms.length) return '';
    return (
      `<section class="stat-card marks"><h3><span>Marks and scars</span><b>${ms.length}</b></h3>` +
      ms.map((i) => `<div class="mark"><h4>${i.name}</h4><p class="stat-how">${i.effects.join(' ')} ${i.heals}</p></div>`).join('') +
      `</section>`
    );
  }

  /** The record, for the You sheet. */
  private recordHtml(): string {
    const r = this.record;
    const rows = Object.entries(r.charges).filter(([, n]) => n > 0);
    return (
      `<section class="stat-card record"><h3><span>Criminal record</span><b>${r.arrests ? `${r.arrests} arrest${r.arrests > 1 ? 's' : ''}` : 'Clean'}</b></h3>` +
      (this.case ? `<p class="record-case${this.case.warrant ? ' warrant' : ''}">${this.case.warrant ? `WARRANT out for you: ${this.case.warrantFor === 'sting' ? 'the buy you ran from' : 'missed court'}. Any stop is an arrest. Turn yourself in at the County Courthouse to end it.` : `Court date: ${dateText(this.case.courtAt)}, County Courthouse (weekdays, 9 to 4). Charges: ${this.case.charges.map((x) => x.toLowerCase()).join(', ')}.${this.case.bailPaid ? ` Bail paid: ${money(this.case.bailPaid)} (back when you show up).` : ''}`}</p>` : '') +
      ((d) => (d ? `<p class="record-case${now() > d.due ? ' warrant' : ''}">You owe Dez ${money(d.owed)}${now() > d.due ? `. You're late (it was due ${dateText(d.due)}), it grows every day, and he's sending someone.` : `, due ${dateText(d.due)} ${clockText(d.due)}. In the alley, at night.`}</p>` : ''))(this.debt) +
      (now() < ((this.save.state.probationUntil as number) ?? 0) ? `<p class="record-case">On probation until ${dateText(this.save.state.probationUntil as number)} ${clockText(this.save.state.probationUntil as number)}: get charged with anything and you're held, no bail.</p>` : '') +
      (r.arrests
        ? (rows.length ? `<ul class="record-list">${rows.map(([c, n]) => `<li><span>${c}</span><b>×${n}</b></li>`).join('')}</ul>` : '') +
          `<p class="record-note">${rows.length ? 'Each charge means a court date.' : 'Held, and let go without charge.'}${r.last ? ` Last arrested ${dateText(r.last)}.` : ''}</p>`
        : `<p class="record-note">No arrests. The police have nothing on this face.</p>`) +
      `</section>`
    );
  }

  /** Pull your mask or hood up or down. */
  private toggleCover(what: 'mask' | 'hood') {
    const inv = this.inventory;
    const w = wearing(inv);
    if (what === 'mask' && w.face) {
      if (!w.masked && this.inside && !this.inOwnRoom) {
        this.note([`Not in here. You'd be thrown out, or worse.`]);
        return;
      }
      w.masked = !w.masked;
      this.note([w.masked ? `You pull the ${w.face.toLowerCase()} up over your face.` : `You pull the ${w.face.toLowerCase()} down.`]);
    } else if (what === 'hood' && hasHood(inv)) {
      w.hood = !w.hood;
      this.note([w.hood ? 'You pull your hood up.' : 'You push your hood back.']);
    }
    const e = this.encounter;
    if (e) e.conspicuous = conspicuous(inv);
    this.refresh();
    buzz(5);
  }

  /** Why you can't burn something right now, or null. */
  private burnBlocked(): string | null {
    if (!this.flame()) return 'Nothing to light it';
    if (this.inside && !this.inOwnRoom) return 'Not in here';
    return null;
  }

  /**
   * Burn the evidence: a stolen ID or card, held in the lighter's flame until
   * the name's gone. Plastic curls and stinks. Rain makes it fiddly; in a
   * downpour it can take a few goes.
   */
  private burn(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const fire = this.flame();
    if (!it || !fire || this.burnBlocked()) return;
    const lines: string[] = [];
    const tries = { clear: 0, drizzle: 0.15, rain: 0.35, downpour: 0.6, flurries: 0.1, snow: 0.25, heavysnow: 0.45 }[this.weather.now];
    if (Math.random() < tries) {
      lines.push(`You crouch in a doorway and try to burn the ${lc(it.name)}, but the ${isSnow(this.weather.now) ? 'snow' : 'rain'} keeps killing the flame.`);
    } else {
      inv.items.splice(i, 1);
      const whose = it.detail ? it.detail.split(',')[0] : null;
      lines.push(
        it.kind === 'id'
          ? `You hold the ${lc(it.name)} over the flame. The plastic bubbles and blackens, and ${whose ? `${whose}'s face` : 'the face'} curls away to nothing. You drop what's left down a drain.`
          : `You hold the ${lc(it.name)} in the flame until the chip pops and the numbers melt into a black, stinking lump. You flick it into the gutter.`,
      );
    }
    const out = this.useFlame(fire, 'burn');
    if (out) lines.push(out);
    this.refresh();
    this.note(lines);
    buzz(8);
  }

  /** Why you can't make a fire right now, or null. */
  private fireBlocked(): string | null {
    if (this.place !== 'street') return 'Not in here';
    if (!this.canLurk) return 'Not now';
    if (this.weather.now === 'downpour' || this.weather.now === 'heavysnow') return 'Too wet';
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
      kindling = `the ${lc(inv.items[paper].name)}`;
      inv.items.splice(paper, 1);
    } else if (Math.random() < 0.6) kindling = 'some cardboard from a dumpster';
    else {
      this.note(["You've got nothing to burn, and there's nothing dry lying around. You need some paper."]);
      return;
    }
    const catches = { clear: 1, drizzle: 0.7, rain: 0.35, downpour: 0, flurries: 0.8, snow: 0.5, heavysnow: 0 }[this.weather.now];
    if (Math.random() >= catches) {
      lines.push(`You try to light ${kindling}, cupping it from the ${isSnow(this.weather.now) ? 'snow' : 'rain'}. It hisses and goes out.`);
    } else {
      const h = this.health;
      // (An hour by the fire: whoever was across the street is gone, and the moment's passed.)
      if (this.encounter?.stage === 'seen' || this.encounter?.stage === 'over') this.encounter = null;
      this.unstick();
      lines.push(`You get a fire going in an old oil drum, with ${kindling} for kindling. You hold your hands over it until the feeling comes back.`);
      lines.push(...passHours(h, 1));
      if (h.dead) return this.die(lines);
      if (h.cold) lines.push("You're warm again, right through.");
      h.cold = 0;
    }
    // Keeping a flame going long enough to catch takes a lot of fuel.
    const out = this.useFlame(lighter, 'fire');
    if (out) lines.push(out);
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
    if (it.secret !== 'cocaine') {
      // A syringe: only the kit can tell you.
      const k = inv.items.findIndex((x) => x.med === 'testkit');
      if (!kit || k < 0 || it.secret === 'empty') return;
      inv.items.splice(k, 1);
      const what = DRUG_TEST[it.secret];
      it.known = true;
      it.name = `Syringe of ${what.name}`;
      it.detail = what.name[0].toUpperCase() + what.name.slice(1);
      this.refresh();
      this.note([`You squeeze a drop from the needle into the vial and shake it. ${what.line}`]);
      buzz(8);
      return;
    }
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

  /** Why you can't inject right now, or null. */
  private injectBlocked(): string | null {
    if (!this.canOpenSheet) return 'Not now';
    if (this.inside && !this.inOwnRoom) return 'Not in here';
    const h = this.health;
    if (h.high && (h.highUntil ?? 0) > now()) return 'Still high';
    return null;
  }

  /**
   * Shooting up whatever's in the syringe (you may not know what it is).
   * Heroin: calm, no stress, slow in the next fights for a couple of hours,
   * and a small chance of overdose. Fentanyl: the same, far stronger, and an
   * overdose that can kill. Meth: wired for the next fight, harder hitting,
   * and on edge. Tranq: you're out for hours, wherever you are.
   */
  private inject(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const h = this.health;
    if (!it?.secret || it.secret === 'cocaine' || it.secret === 'empty' || this.injectBlocked()) return;
    const drug = it.secret;
    const knew = it.known;
    this.closeSheet();
    // The syringe is spent: still a needle, still sharp.
    it.secret = 'empty';
    it.known = true;
    it.name = 'Syringe';
    it.detail = 'Empty. Used.';
    const lines: string[] = [knew ? `You find a vein and push the ${DRUG_TEST[drug].name} in.` : 'You find a vein and push the plunger, not knowing what goes in.'];
    useHabit(h, drug === 'meth' ? 'stimulants' : drug === 'tranq' ? 'sedatives' : 'opioids', drug === 'fentanyl' ? 20 : drug === 'heroin' ? 15 : drug === 'meth' ? 12 : 10);
    const onTranq = h.high === 'tranq' && (h.highUntil ?? 0) > now();
    const od = (chance: number, deadly: number): boolean => {
      // Drink or a downer on top, and the odds get worse.
      const mix = 1 + (h.drunk ?? 0) / 60 + (onTranq ? 0.6 : 0);
      if (Math.random() >= chance * mix) return false;
      deadly = Math.min(0.9, deadly * mix);
      if (Math.random() < deadly) {
        lines.push('Your breathing slows. Slower. Then it stops, and nobody comes.');
        this.die(lines, 'You overdosed.');
        return true;
      }
      lines.push('Your breathing slows to almost nothing, and the world goes out.');
      // (Hours out: whoever was lying here is long gone.)
      if (this.encounter?.stage === 'seen' || this.encounter?.stage === 'over') this.encounter = null;
      this.unstick();
      lines.push(...passHours(h, 4));
      if (h.dead) {
        this.die(lines);
        return true;
      }
      lines.push('You come to on the sidewalk hours later, soaked in sweat and shaking, sick to your stomach. You nearly died.');
      return true;
    };
    if (drug === 'heroin') {
      lines.push('Warmth floods up your arm and all through you. The stress melts away. Your eyelids are heavy.');
      h.stress = 0;
      h.high = 'heroin';
      h.highUntil = now() + HIGH_HOURS.heroin * 3_600_000;
      if (od(0.05, 0.12)) {
        if (h.dead) return;
      }
    } else if (drug === 'fentanyl') {
      lines.push('It hits like a wall, all at once. Nothing hurts. Nothing matters. It is very hard to breathe.');
      h.stress = 0;
      h.high = 'fentanyl';
      h.highUntil = now() + HIGH_HOURS.fentanyl * 3_600_000;
      if (od(0.3, 0.35) && h.dead) return;
      if (this.health.dead) return;
    } else if (drug === 'meth') {
      lines.push('Your heart slams. Your jaw locks tight. Everything is fast and bright and loud, and you could fight anyone.');
      h.wired = true;
      h.wiredBy = 'meth';
      h.wiredUntil = now() + HIGH_HOURS.meth * 3_600_000;
      h.high = 'meth';
      h.highUntil = now() + HIGH_HOURS.meth * 3_600_000;
      h.stress = Math.min(100, (h.stress ?? 0) + 15);
    } else {
      lines.push("A heavy, sick drowsiness pulls you down before you can get the needle out. You're out where you sit.");
      // (Hours out: whoever was lying here is long gone.)
      if (this.encounter?.stage === 'seen' || this.encounter?.stage === 'over') this.encounter = null;
      this.unstick();
      lines.push(...passHours(h, 4));
      if (h.dead) return this.die(lines);
      lines.push('You wake hours later, your skin crawling, with no idea how long you were gone.');
      // Groggy for a while after.
      h.high = 'tranq';
      h.highUntil = now() + HIGH_HOURS.tranq * 3_600_000;
    }
    if (!knew) lines.push(`It was ${DRUG_TEST[drug].name}.`);
    if (this.dead) return;
    this.refresh();
    this.note(lines);
    buzz([20, 40, 20]);
  }

  /** A bump of coke: you're wired for the next fight (more stamina, less pain). */
  /** Carrying like a dealer: several bags, or bags and the zip bags to make more. */
  private intent(items = this.inventory.items): boolean {
    const coke = items.filter((x) => x.secret === 'cocaine');
    const bags = coke.length;
    const doses = coke.reduce((n, x) => n + (x.doses ?? 0), 0);
    return bags >= 3 || doses >= 10 || (bags > 0 && items.some((x) => x.name === 'Zip bags'));
  }

  /** A deal, settled: the bag out of your pocket, their money into yours (or the police). */
  private settleDeal(e: Encounter) {
    const d = e.deal;
    if (!d || d.done) return;
    d.done = true;
    const f = this.infamy;
    if (d.kind === 'no') {
      if (d.reported) f.heat = Math.min(100, f.heat + 6);
      return;
    }
    const inv = this.inventory;
    const bag = inv.items.find((x) => x.secret === 'cocaine' && x.known && x.doses === 1);
    if (!bag) return;
    inv.items.splice(inv.items.indexOf(bag), 1);
    if (d.kind === 'snatched') {
      // In their fist as they run: catch them, and it's yours again.
      e.person.clothes[0]?.loot.push({ kind: 'misc', name: 'Small baggie', detail: 'Yours: they snatched it', secret: 'cocaine', known: true, doses: 1, where: 'clenched in their fist', yours: true });
      return;
    }
    // Their money, out of their pockets and into yours.
    let need = d.price;
    let got = 0;
    for (const g of e.person.clothes)
      for (const l of [...g.loot]) {
        if (need <= 0 || l.kind !== 'cash') continue;
        const have = Math.round((l.cash ?? 0) * 100);
        const take = Math.min(have, need);
        need -= take;
        got += take;
        const left = have - take;
        if (left > 0) {
          l.cash = left / 100;
          l.purse = fewest(left);
        } else g.loot.splice(g.loot.indexOf(l), 1);
      }
    addTo(inv.purse, fewest(got));
    if (d.kind === 'sting') {
      this.save.state.policeStop = 'sting';
      this.save.state.stingCash = got;
      return;
    }
    // Word gets around: to buyers, and to the police.
    f.rep += 1;
    f.heat = Math.min(100, f.heat + 2);
    this.save.state.sales = ((this.save.state.sales as number) ?? 0) + 1;
  }

  /** Splitting powder into little bags to sell, a point in each. */
  private bagUp(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const zip = inv.items.find((y) => y.name === 'Zip bags' && (y.doses ?? 0) > 0);
    if (!it || it.secret !== 'cocaine' || !it.known || (it.doses ?? 0) < 2 || !zip || !this.canOpenSheet) return;
    if (this.inside && !this.inOwnRoom) {
      this.note(['Not in here. Not with someone behind the counter watching.']);
      return;
    }
    const n = Math.min(it.doses ?? 0, zip.doses ?? 0);
    let made = 0;
    for (let k = 0; k < n; k++) {
      if (!stow(inv, { kind: 'misc', name: 'Small baggie', detail: 'A point, bagged to sell', secret: 'cocaine', known: true, doses: 1 })) break;
      made++;
    }
    it.doses = (it.doses ?? 0) - made;
    zip.doses = (zip.doses ?? 0) - made;
    inv.items = inv.items.filter((x) => (x !== it || (it.doses ?? 0) > 0) && (x !== zip || (zip.doses ?? 0) > 0));
    this.refresh();
    this.note([
      made
        ? `${this.place === 'room' ? 'At the little table by the window' : 'Hunched in a doorway'}, you tip it out and split it into ${made} little bag${made === 1 ? '' : 's'}, a point in each.${made < n ? ' You run out of room for the rest.' : ''}`
        : "You've got nowhere to put the bags.",
    ]);
  }

  /**
   * What you owe Dez, if anything: how much, when it was due, and how often
   * you've beaten the people he sent. Late, it grows a fifth a day (the vig).
   */
  private get debt(): { owed: number; due: number; vigAt?: number; strikes?: number } | undefined {
    const d = this.save.state.debt as { owed: number; due: number; vigAt?: number; strikes?: number } | undefined;
    if (!d) return undefined;
    const t = now();
    if (t > d.due) {
      const from = Math.max(d.due, d.vigAt ?? d.due);
      const days = Math.floor((t - from) / 86_400_000);
      if (days > 0) {
        d.owed = Math.round(d.owed * Math.pow(1.2, days));
        d.vigAt = from + days * 86_400_000;
      }
    }
    return d;
  }

  /** Who Dez sends: big, calm, and carrying. Bigger each time you send one back. */
  private enforcerFor(d: { strikes?: number }): import('./person').Person {
    const p = makePerson();
    p.kind = 'civilian';
    p.sex = 'Male';
    p.personality = 'hard';
    p.build = (d.strikes ?? 0) >= 1 ? 'Muscular' : 'Stocky';
    p.awareness = 'Alert';
    p.carrying = [...p.carrying.filter((x) => !x.weapon && !x.spray), { name: 'Lockback folder', weapon: 5, cuts: true }];
    return p;
  }

  /** Dez, by the dumpsters at night: an eight-ball for cash, or fronted on credit. */
  private dezHtml(open: boolean): string {
    if (!open) return '';
    const btn = (attr: string, v: string, label: string, no?: string | false) => `<button type="button" data-${attr}="${v}" ${no ? `disabled title="${no}"` : ''}>${label}${no ? `<small>${no}</small>` : ''}</button>`;
    const li = (name: string, small: string, button: string) => `<li><div><b>${name}</b><small>${small}</small></div><span class="li-btns">${button}</span></li>`;
    const c = Math.round(cashOf(this.inventory) * 100);
    const sales = (this.save.state.sales as number) ?? 0;
    const d = this.debt;
    const late = !!d && now() > d.due;
    const stranger = sales < 1 && !d;
    let rows = '';
    if (d)
      rows += li('What you owe Dez', `${money(d.owed)}, ${late ? `late: it was due ${dateText(d.due)}, and it grows a fifth every day.` : `due ${dateText(d.due)}.`}`, btn('dez', 'pay', c >= d.owed ? 'Pay it all' : 'Pay what you have', !c && 'No cash'));
    rows += li('An eight-ball', 'Three and a half grams. Bag it up and it comes to about 35 points. Cash.', btn('dez', 'cash', money(DEZ_CASH * 100), (stranger && '"I don\'t know you."') || (late && '"Not till you pay me."') || (c < DEZ_CASH * 100 && 'Not enough cash')));
    rows += li('Fronted', `He gives it to you now, you pay him ${money(DEZ_FRONT * 100)} in three days. Don't be late.`, btn('dez', 'front', 'Front me', (sales < 5 && '"Move some first. Then we talk."') || (!!d && '"You owe me already."')));
    return `<p class="shop-sub">Dez, by the dumpsters</p><ul class="shop-list">${rows}</ul>`;
  }

  /** Buying from Dez, or paying him back. */
  private dez(what: string) {
    if (this.place !== 'fence' || !isOpen(placeInfo('fence').hours!)) return;
    const inv = this.inventory;
    const c = Math.round(cashOf(inv) * 100);
    const d = this.debt;
    const sales = (this.save.state.sales as number) ?? 0;
    const late = !!d && now() > d.due;
    const ball = () => stow(inv, { kind: 'misc', name: 'Eight-ball', detail: 'Rocky powder in the knotted corner of a sandwich bag', secret: 'cocaine', known: true, doses: 35 });
    if (what === 'pay' && d && c) {
      const amount = Math.min(c, d.owed);
      const paid = this.payLine(amount);
      d.owed -= amount;
      const done = d.owed <= 0;
      if (done) delete this.save.state.debt;
      this.refresh();
      this.note([done ? 'Dez counts it twice, slowly, and puts it away. "We\'re good."' : `Dez takes it without counting. "That's a start. ${money(d.owed)} to go."`, paid]);
      return;
    }
    if (what === 'cash' && !late && (sales >= 1 || d) && c >= DEZ_CASH * 100) {
      if (!ball()) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, 'small')}`]);
        return;
      }
      const paid = this.payLine(DEZ_CASH * 100);
      this.refresh();
      this.note(['Dez looks up and down the alley, then presses something small and hard into your hand. "Don\'t open it here."', paid]);
      return;
    }
    if (what === 'front' && sales >= 5 && !d) {
      if (!ball()) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, 'small')}`]);
        return;
      }
      this.save.state.debt = { owed: DEZ_FRONT * 100, due: now() + 3 * 86_400_000, strikes: 0 };
      this.refresh();
      this.note([`Dez puts it in your hand and doesn't let go straight away. "${money(DEZ_FRONT * 100)}. Three days. I know where you sleep."`]);
    }
  }

  /** The loose brick in the alley: what's behind it. */
  private get stash(): { items: InvItem[]; cents: number; at: number; seen?: boolean } {
    return (this.save.state.stash ??= { items: [], cents: 0, at: now() }) as { items: InvItem[]; cents: number; at: number; seen?: boolean };
  }
  /** Your room at the Hotel Marlow (if you've rented one): paid until when, and what you left in it. */
  private get room(): { until: number; items: InvItem[]; cents: number; at: number } | undefined {
    return this.save.state.room as { until: number; items: InvItem[]; cents: number; at: number } | undefined;
  }
  /** In your own room (rented, and you're in it): smoke, drink, use, mask up, burn things. */
  private get inOwnRoom(): boolean {
    return this.place === 'room' && this.roomRented;
  }
  private get roomRented(): boolean {
    const r = this.room;
    return !!r && now() < r.until;
  }

  /** Back at the alley: has someone found it? (More likely if someone saw you.) */
  private checkStash(): string[] {
    const s = this.save.state.stash as { items: InvItem[]; cents: number; at: number; seen?: boolean } | undefined;
    if (!s) return [];
    const days = Math.max(0, (now() - s.at) / 86_400_000);
    s.at = now();
    if (!s.items.length && !s.cents) return [];
    if (Math.random() < 1 - Math.pow(1 - (s.seen ? 0.3 : 0.04), days)) {
      s.items = [];
      s.cents = 0;
      s.seen = false;
      return ['The loose brick is lying in the gravel. Behind it, nothing. Someone found your stash.'];
    }
    return [];
  }

  /** Back at the room: rent run out (they clear it), or someone's been in. */
  private checkRoom(): string[] {
    const r = this.room;
    if (!r) return [];
    const t = now();
    if (t > r.until + 2 * 86_400_000) {
      delete this.save.state.room;
      return ["Your key doesn't turn. The man in the cage doesn't look up: the rent ran out, so they cleared the room. Whatever you left is in a dumpster, or in someone's pocket."];
    }
    const days = Math.max(0, (t - r.at) / 86_400_000);
    r.at = t;
    if ((r.cents || r.items.length) && Math.random() < 1 - Math.pow(0.985, days)) {
      const took = r.items.filter((x) => (x.secret && x.secret !== 'empty') || x.kind === 'phone' || x.kind === 'weapon');
      r.items = r.items.filter((x) => !took.includes(x));
      const had = r.cents;
      r.cents = 0;
      if (had || took.length) return ["The lock's been scratched up. Someone's been in: " + [had ? 'the cash under the mattress' : '', took.length ? `what was under the board` : ''].filter(Boolean).join(' and ') + ' is gone.'];
    }
    return t > r.until ? ['The rent ran out. They hold the room two days, then clear it.'] : [];
  }

  /** The room: rent it, pay ahead, or sleep. */
  private roomAct(what: string) {
    if (this.place !== 'room') return;
    const inv = this.inventory;
    const h = this.health;
    if (what === 'rent') {
      if (Math.round(cashOf(inv) * 100) < ROOM_RENT * 100) return;
      const cleared = this.checkRoom();
      if (cleared.length && !this.room) {
        this.note(cleared);
        return;
      }
      const paid = this.payLine(ROOM_RENT * 100);
      const r = this.room;
      const t = now();
      if (r && t <= r.until + 2 * 86_400_000) r.until = Math.max(t, r.until) + 7 * 86_400_000;
      else this.save.state.room = { until: t + 7 * 86_400_000, items: [], cents: 0, at: t };
      this.refresh();
      this.note([r ? 'You push the week through the slot. He writes it in a book without looking up.' : 'You push the cash through the slot. A key on a plastic tag comes back: room 14, up two flights.', paid]);
      return;
    }
    if (what === 'sleep' && this.roomRented) {
      const r = this.room!;
      if (now() - ((r as { slept?: number }).slept ?? 0) < 4 * 3_600_000) {
        this.note(["You lie down, but you're not tired. You stare at the water stain on the ceiling until you give up."]);
        return;
      }
      (r as { slept?: number }).slept = now();
      this.unstick();
      const was = h.cold ?? 0;
      const lines = ['You lock the door, wedge the chair under the handle, and sleep. Eight hours. Nobody comes.', ...passHours(h, 8, true)];
      if (h.dead) return this.die(lines);
      h.cold = 0;
      h.stress = Math.max(0, (h.stress ?? 0) - 30);
      if (was) lines.push('You wake up warm, for once.');
      this.refresh();
      this.note(lines);
    }
  }

  /** Leaving something behind the brick, or in your room. */
  private stashItem(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const where = this.place === 'fence' ? this.stash : this.place === 'room' && this.roomRented ? this.room : undefined;
    if (!it || !where || !this.canOpenSheet) return;
    inv.items.splice(i, 1);
    delete it.hand;
    where.items.push(it);
    const lines = [this.place === 'fence' ? `You work the loose brick out, push the ${lc(it.name)} into the gap, and fit the brick back.` : `You leave the ${lc(it.name)} in your room, under the loose board by the radiator.`];
    // In the alley someone may see you do it (the man by the vents, a face in a window).
    if (this.place === 'fence') {
      const s = this.stash;
      const open = isOpen(placeInfo('fence').hours!);
      if (!s.seen && Math.random() < 0.06 + this.infamy.heat / 300 + (open ? 0.12 : 0)) {
        s.seen = true;
        lines.push(open ? 'The man by the vents is looking your way. He looks away when you look back.' : 'You feel eyes on you. When you turn, the end of the alley is empty.');
      }
    }
    this.refresh();
    this.note(lines);
  }

  /** Taking something back out of the stash or the room: "stash:3", "room:0". */
  private unstash(v: string) {
    const [kind, n] = v.split(':');
    const where = kind === 'stash' && this.place === 'fence' ? this.stash : kind === 'room' && this.place === 'room' && this.roomRented ? this.room : undefined;
    const it = where?.items[Number(n)];
    if (!where || !it) return;
    const { spot: _spot, size: _size, kg: _kg, ...rest } = it;
    void _spot;
    void _size;
    void _kg;
    const got = stow(this.inventory, rest);
    if (!got) {
      this.note([`No room for the ${lc(it.name)}. ${noRoomWhy(this.inventory, measure(it).size)}`]);
      return;
    }
    where.items.splice(Number(n), 1);
    this.refresh();
    this.note([`You take the ${lc(it.name)}.`]);
  }

  /** All your cash in, or all of it back out: "stash:in", "room:out". */
  private stashCash(v: string) {
    const [kind, dir] = v.split(':');
    const where = kind === 'stash' && this.place === 'fence' ? this.stash : kind === 'room' && this.place === 'room' && this.roomRented ? this.room : undefined;
    if (!where) return;
    const inv = this.inventory;
    if (dir === 'in') {
      const c = Math.round(cashOf(inv) * 100);
      if (!c) return;
      where.cents += c;
      inv.purse = {};
      this.refresh();
      this.note([`You leave ${money(c)}, rolled tight, ${kind === 'stash' ? 'behind the brick' : 'under the mattress'}.`]);
    } else if (where.cents) {
      addTo(inv.purse, fewest(where.cents));
      this.note([`You take the ${money(where.cents)}.`]);
      where.cents = 0;
      this.refresh();
    }
  }

  /** Arrested with heat on you: they get your room from the desk clerk, and search it. */
  private searchRoom(charges: string[], heat: number): string[] {
    const r = this.room;
    if (!r || now() > r.until + 2 * 86_400_000 || heat < 50 || Math.random() >= 0.35) return [];
    const lines = ['The desk clerk at the Hotel Marlow gives them your room. They search it too.'];
    const found = r.items.filter((x) => (x.secret && x.secret !== 'empty') || (x.kind === 'id' && x.own !== this.world.lives) || /card/.test(x.kind) || x.name === 'Zip bags');
    if (found.length) {
      lines.push(`They find what you'd hidden under the board by the radiator.`);
      if (found.some((x) => x.secret && x.secret !== 'empty') && !charges.some((x) => /controlled substance|intent to distribute/.test(x))) charges.push(this.intent(found) ? 'Possession with intent to distribute' : 'Possession of a controlled substance');
      if (found.some((x) => x.kind === 'id' || /card/.test(x.kind)) && !charges.includes('Possession of stolen property')) charges.push('Possession of stolen property');
      r.items = r.items.filter((x) => !found.includes(x));
    }
    if (r.cents) {
      lines.push(`The ${money(r.cents)} under the mattress goes into an evidence bag: proceeds, they call it.`);
      r.cents = 0;
    }
    return lines;
  }

  /** A hiding place, in a shop body: what's in it, and taking it back. */
  private stashHtml(kind: 'stash' | 'room'): string {
    const where = kind === 'stash' ? this.save.state.stash as { items: InvItem[]; cents: number } | undefined : this.room;
    const items = where?.items ?? [];
    const cents = where?.cents ?? 0;
    const c = Math.round(cashOf(this.inventory) * 100);
    const btn = (attr: string, v: string, label: string, no?: string | false) => `<button type="button" data-${attr}="${v}" ${no ? `disabled title="${no}"` : ''}>${label}${no ? `<small>${no}</small>` : ''}</button>`;
    const li = (name: string, small: string, button: string) => `<li><div><b>${name}</b><small>${small}</small></div><span class="li-btns">${button}</span></li>`;
    return (
      `<p class="shop-sub">${kind === 'stash' ? 'Behind the loose brick, low in the wall by the dumpster' : 'Under the loose board by the radiator'}</p>` +
      `<ul class="shop-list">` +
      items.map((x, i) => li(x.name, x.detail ?? '', btn('unstash', `${kind}:${i}`, 'Take'))).join('') +
      li('Cash', cents ? `${money(cents)} hidden here.` : 'None hidden here.', btn('cash', `${kind}:in`, 'Leave yours', !c && 'No cash') + btn('cash', `${kind}:out`, 'Take it', !cents && 'Nothing there')) +
      `</ul>` +
      (items.length ? '' : `<p class="shop-broke">Nothing ${kind === 'stash' ? 'behind it' : 'left here'}. Leave things from Pockets (“${kind === 'stash' ? 'Hide it' : 'Leave it here'}”).</p>`)
    );
  }

  private bump(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const h = this.health;
    if (it?.secret !== 'cocaine' || !it.known || h.wired) return;
    if (this.inside && !this.inOwnRoom) {
      this.note(['Not in here. Someone behind the counter is already watching you.']);
      return;
    }
    it.doses = (it.doses ?? 1) - 1;
    h.wired = true;
    h.wiredBy = 'coke';
    useHabit(h, 'stimulants', 6);
    // A bump lasts about forty minutes.
    h.wiredUntil = now() + 40 * 60_000;
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
    this.note([`You throw the ${lc(it.name)} away.`]);
    buzz(6);
  }

  /** Your bills and coins, as little chips: "$20 ×2". */
  private purseHtml(): string {
    const p = this.inventory.purse;
    const ds = [...BILLS, ...COINS].filter((d) => p[d]);
    if (!ds.length) return '';
    return ds.map((d) => `<span class="${isBill(d) ? 'bill' : 'coin'}">${isBill(d) ? `$${d / 100}` : `${d}¢`}<em>×${p[d]}</em></span>`).join('');
  }

  /** The screen for wherever you are, if it isn't the street. */
  private renderShop() {
    const place = this.place;
    const here = place !== 'street' && this.tvState.on;
    this.shopEl.hidden = !here;
    this.view.classList.toggle('in-shop', here);
    if (!here) return;
    const info = placeInfo(place);
    const inv = this.inventory;
    const c = Math.round(cashOf(inv) * 100);
    const open = !info.hours || isOpen(info.hours);
    // A button that can't be pressed says why, on the button (phones never show a tooltip).
    const btn = (attr: string, v: string | number, label: string, no?: string | false | null) =>
      `<button type="button" data-${attr}="${v}" ${no ? `disabled title="${no}"` : ''}>${label}${no ? `<small>${no}</small>` : ''}</button>`;
    const li = (name: string, small: string, button: string) => `<li><div><b>${name}</b><small>${small}</small></div><span class="li-btns">${button}</span></li>`;
    let body = '';
    if (place === 'pharmacy') {
      const have = (id: MedId) => inv.items.filter((x) => x.med === id).length;
      body =
        `<ul class="shop-list">${SOLD_MEDS().map((m) => li(m.name, `${m.desc}${have(m.id) ? ` · You have ${have(m.id)}` : ''}`, btn('buy', m.id, money(m.price * 100), c < m.price * 100 && 'Not enough cash'))).join('')}</ul>` +
        (c < Math.min(...SOLD_MEDS().map((m) => m.price)) * 100 ? `<p class="shop-broke">You can't afford anything. Cash only.</p>` : '');
    } else if (place === 'guns') {
      body = open
        ? `<ul class="shop-list">${GUN_STOCK.map((s) => li(s.name, s.gun ? `${s.desc} ${hideStat(bulkOf({ kind: 'weapon', name: s.gun }))}, ${alarmStat(1)}.` : s.desc, btn('stock', s.id, money(s.price * 100), this.ownsWhy(s) || (c < s.price * 100 && 'Not enough cash')))).join('')}</ul>` +
          `<p class="shop-broke">${this.ownId() ? (this.charged ? 'With a charge against you, the background check will come back denied.' : 'Your own ID, a form and a background check, and it’s yours.') : 'Nothing without your own ID: they run a background check on every buyer.'} Firing a gun is loud: someone always calls it in.</p>`
        : `<p class="shop-closed">The shutters are down and the alarm light blinks.</p>`;
    } else if (place === 'hospital') {
      const need = this.erNeeds();
      const row = (care: ErCare, name: string, what: string, needed: boolean, n = 1) =>
        li(name, what, btn('er', care, money(ER_PRICES[care] * n * 100), (!needed && 'Nothing to treat') || (c < ER_PRICES[care] * n * 100 && 'Not enough cash')));
      body =
        `<ul class="shop-list">` +
        row('stitches', 'Stitches', 'Close a cut and stop the bleeding.', need.stitches) +
        row('nose', 'Set your nose', 'Set straight, it heals properly, and sooner.', need.nose) +
        row('cast', need.cast.length > 1 ? `Casts (${need.cast.length})` : 'A cast', need.cast.length ? `Set the ${need.cast.join(' and ')}: ${need.cast.length > 1 ? 'they heal' : 'it heals'} properly, and sooner.` : 'For a broken arm or leg.', need.cast.length > 0, Math.max(1, need.cast.length)) +
        row('lung', 'Chest tube', 'For a punctured lung: lets you breathe again.', need.lung) +
        row('blood', 'Blood', 'A transfusion, when you’ve lost too much.', need.blood) +
        `</ul>` +
        `<p class="shop-broke">${this.erSeen ? 'You’ve been seen. They’ll fit you in.' : 'First you wait, unless you’re bleeding badly or can’t breathe.'} No insurance: they want cash before you leave. They can’t do anything for ribs or a concussion but tell you to rest.</p>`;
    } else if (place === 'court') {
      const c = this.case;
      const metal = this.inventory.items.find((x) => x.kind === 'weapon' && !/bottle|syringe/i.test(x.name));
      body = open && metal
        ? `<p class="shop-broke">The metal detector shrieks. The deputy finds the ${lc(metal.name)} and steps in front of you. "Not in here. Get rid of it and come back."</p>`
        : open
        ? c
          ? `<ul class="shop-list">${li(c.warrant ? 'Turn yourself in' : 'Appear for your hearing', `${c.charges.map((x) => x.toLowerCase()).join(', ')}.${c.warrant ? ' There’s a warrant: they’ll hold you overnight first.' : ` Your date: ${hearingToday(c.courtAt) ? 'today' : dateText(c.courtAt)}.`}`, btn('court', 'appear', 'Go in'))}</ul>` +
            `<p class="shop-broke">Could go any way: dropped, a fine, probation, or jail time. Your record counts against you; a good story counts for you.</p>`
          : `<p class="shop-broke">Your name isn't on any list. Nothing for you here.</p>`
        : `<p class="shop-closed">The doors are locked. Open weekdays, 9 to 4.</p>`;
    } else if (place === 'records') {
      const mine = this.ownId();
      body = open
        ? `<ul class="shop-list">${li('State ID', mine ? `You have one: ${mine.detail}.` : 'Your name, your photo, your address (more or less).', btn('records', 'id', money(ID_FEE * 100), (mine && 'You have one') || (c < ID_FEE * 100 && 'Not enough cash')))}</ul>` +
          `<p class="shop-broke">With your own ID you can open a bank account, sell to and buy from the pawn shop, and buy alcohol, without anyone looking at you twice.</p>`
        : `<p class="shop-closed">The doors are locked. Open weekdays, 9 to 4.</p>`;
    } else if (place === 'liquor') {
      body = open
        ? `<ul class="shop-list">${LIQUOR_STOCK.map((s) => li(s.name, s.desc, btn('stock', s.id, money(s.price * 100), this.ownsWhy(s) || (c < s.price * 100 && 'Not enough cash')))).join('')}</ul>` +
          `<p class="shop-broke">${this.ownId() ? 'They know your face now.' : 'They’ll want to see ID.'}</p>`
        : `<p class="shop-closed">The grille is down.</p>`;
    } else if (place === 'gas') {
      const have = (name: string) => inv.items.filter((x) => x.name === name).length;
      body =
        `<ul class="shop-list">${GAS_STOCK.map((s) => {
          const n = s.med ? inv.items.filter((x) => x.med === s.med).length : s.slot || s.drink ? 0 : have(s.name);
          return li(s.name, `${s.desc}${n ? ` · You have ${n}` : ''}`, btn('stock', s.id, money(s.price * 100), this.ownsWhy(s) || (c < s.price * 100 && 'Not enough cash')));
        }).join('')}</ul>` + (c < 100 ? `<p class="shop-broke">You can't afford anything. The clerk watches you anyway.</p>` : '');
    } else if (place === 'pawn' || place === 'fence') {
      if (!open) body = `<p class="shop-closed">${place === 'pawn' ? 'The shutter is down.' : "There's nobody back here right now."}</p>`;
      else {
        const sell = inv.items
          .map((x, i) => ({ x, i, o: offer(place, x) }))
          .map(({ x, i, o }) => li(x.name, 'cents' in o ? `${x.detail ? `${x.detail} · ` : ''}He'll give you ${money(o.cents)}` : o.why, 'cents' in o ? btn('sell', i, `Sell ${money(o.cents)}`) : ''));
        body = `<h3>Sell</h3>` + (sell.length ? `<ul class="shop-list">${sell.join('')}</ul>` : `<p class="shop-broke">You've got nothing to sell.</p>`);
        if (place === 'pawn') {
          body += `<h3>For sale</h3><ul class="shop-list">${PAWN_STOCK.map((s) => li(s.name, s.slot === 'top' || s.slot === 'bottom' || s.slot === 'bag' ? `${s.desc} ${hidesWord(s.name)}.` : s.knife ? `${s.desc} ${hideStat(bulkOf({ kind: 'weapon', name: s.knife }))}, ${alarmStat(alarmOf({ kind: 'weapon', name: s.knife }))}.` : s.desc, btn('stock', s.id, money(s.price * 100), this.ownsWhy(s) || (c < s.price * 100 && 'Not enough cash')))).join('')}</ul>`;
        }
      }
    } else if (place === 'bank') {
      const p = inv.purse;
      const coins = count(p, COINS);
      if (open) {
        body =
          `<h3>Teller</h3><ul class="shop-list">` +
          li('Change up', 'Trade small bills and coins for the biggest bills they add up to', btn('bank', 'up', 'Change', !c && 'Nothing to change')) +
          BILLS.filter((d) => p[d])
            .map((d) => li(`Break a ${denomName(d)}`, `Into ${purseText(breaksInto(d))}`, btn('bank', `break:${d}`, 'Break')))
            .join('') +
          `</ul>`;
        // Your account (it takes your own ID).
        const acct = this.account;
        const mine = !!this.ownId();
        body +=
          `<h3>Your account</h3><ul class="shop-list">` +
          (!acct
            ? li('Open an account', mine ? 'Free. Keep your money where nobody can take it off you.' : 'You need your own ID: the City Records Office makes them.', btn('bank', 'open', 'Open', !mine && 'Need your own ID'))
            : li(`Balance: ${money(acct.cents)}`, 'Deposit what you carry; take some out when you need it.', btn('bank', 'deposit', 'Deposit all', (!c && 'No cash on you') || (!mine && 'Need your own ID'))) +
              `<li class="bank-amt"><div><b>An amount</b><small>Type it in, then deposit it or take it out.</small></div><span class="li-btns"><label class="amt"><span>$</span><input id="bank-amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" aria-label="Amount in dollars"></label>${btn('bank', 'd:amt', 'Deposit', (!c && 'No cash on you') || (!mine && 'Need your ID'))}${btn('bank', 'w:amt', 'Withdraw', (!acct.cents && 'Nothing in the account') || (!mine && 'Need your ID'))}</span></li>` +
              li('Withdraw', '$20, $100, or everything.', [2000, 10000].map((v) => btn('bank', `w:${v}`, money(v), (acct.cents < v && 'Balance too low') || (!mine && 'Need your ID'))).join('') + btn('bank', 'w:all', 'All', (!acct.cents && 'Nothing in the account') || (!mine && 'Need your ID')))) +
          `</ul>`;
      } else body = `<p class="shop-closed">The teller windows are dark.</p>`;
      body += `<h3>Lobby</h3><ul class="shop-list">${li('Coin machine', `Turns coins into bills, any hour. Keeps ${COIN_MACHINE_FEE * 100}%.`, btn('bank', 'machine', 'Use', !coins && 'No coins'))}`;
      // The cash machine: a card and its PIN (one someone gave you, if you made them).
      const cards = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => /card/.test(x.kind));
      const usable = cards.filter(({ x }) => x.pin && !x.drained);
      body += usable.length
        ? usable.map(({ x, i }) => li(`Cash machine · ${x.name}`, `${x.detail ? `${x.detail}'s card · ` : ''}PIN ${x.pin}. There's a camera over the screen.`, btn('atm', i, 'Withdraw'))).join('')
        : li('Cash machine', cards.some(({ x }) => x.drained) && !cards.some(({ x }) => !x.drained && !x.pin) ? "The cards you had PINs for have been stopped." : cards.length ? "You've got cards, but no PIN for them. Someone would have to tell you." : 'Any hour. You need a card, and its PIN.', btn('atm', -1, 'Use', 'No card with a PIN'));
      body += `</ul>`;
    } else if (place === 'room') {
      // The Hotel Marlow: a room by the week.
      const r = this.room;
      const rented = this.roomRented;
      body =
        `<ul class="shop-list">` +
        (rented ? li('Your room, upstairs', `Room 14, paid up until ${dateText(r!.until)}. A bed, a lock that mostly works, a window onto the fire escape. Warm, and nobody bothers you.`, btn('room', 'sleep', 'Sleep')) : '') +
        li(rented ? 'Another week' : 'A room for a week', rented ? "Pay ahead. Fall behind and they clear it after two days." : 'Cash up front. No lease, no ID, no questions.', btn('room', 'rent', money(ROOM_RENT * 100), c < ROOM_RENT * 100 && 'Not enough cash')) +
        `</ul>` +
        (rented ? this.stashHtml('room') : '');
    }
    // The alley's loose brick: there whenever you are, whoever's about.
    if (place === 'fence') body += this.dezHtml(open) + this.stashHtml('stash');
    const html =
      `<div class="shop-head"><h2>${info.name}</h2><p>${info.blurb}</p>${info.hours ? `<p class="shop-hours">${hoursText(info.hours)}.</p>` : ''}</div>` +
      this.noteHtml(this.shopNote, 'shop-note') +
      `<p class="pocket-purse">${this.purseHtml()}</p>` +
      `<div class="shop-body">${body}</div>`;
    // Only when something changed, and keep your place in the list (buying
    // something used to jump you back to the top).
    if (html !== this.shopHtml) {
      this.shopHtml = html;
      const same = this.shopAt === this.place;
      this.shopAt = this.place;
      const scroll = same ? this.shopEl.scrollTop : 0;
      const listScroll = same ? (this.shopEl.querySelector('.shop-body')?.scrollTop ?? 0) : 0;
      this.shopEl.innerHTML = html;
      this.shopEl.scrollTop = scroll;
      const list = this.shopEl.querySelector('.shop-body');
      if (list) list.scrollTop = listScroll;
      // (What just happened, at its newest line.)
      const sn = this.shopEl.querySelector('.shop-note');
      if (sn) sn.scrollTop = sn.scrollHeight;
    }
    // More than fits: a fade at the bottom says scroll.
    requestAnimationFrame(() => this.markShopMore());
  }
  /** A fade where there's more to scroll: the card (or, in landscape, its list column). */
  private markShopMore() {
    const more = (el: Element | null) => !!el && el.scrollTop + el.clientHeight < el.scrollHeight - 6;
    this.shopEl.classList.toggle('more', more(this.shopEl));
    const body = this.shopEl.querySelector('.shop-body');
    body?.classList.toggle('more', more(body));
    const sn = this.shopEl.querySelector('.shop-note');
    sn?.classList.toggle('more', !!sn && sn.scrollTop > 6);
  }
  private shopHtml = '';
  /** The shop the list was last drawn for (a new one opens at the top). */
  private shopAt = '';
  /** The last thing that happened in this shop / sheet, shown inside it. */
  private shopNote: string[] = [];
  private sheetNote: string[] = [];
  private noteHtml(lines: string[], cls: string) {
    return lines.length ? `<div class="${cls}">${lines.map((l) => `<p>${l}</p>`).join('')}</div>` : '';
  }

  /** In a shop, or a sheet (Pockets, stats, Go) is open: the screen stays clear of what you're on. */
  get inMenu(): boolean {
    return (this.place !== 'street' && this.tvState.on) || !!this.sheet;
  }

  private renderSheet() {
    const card = this.sheetEl.firstElementChild as HTMLElement;
    const close = `<button type="button" class="sheet-x" data-close aria-label="Close"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg></button>`;
    if (this.sheet === 'police' && Array.isArray(this.save.state.policeResult)) {
      const res = this.save.state.policeResult as string[];
      card.innerHTML =
        `<div class="sheet-head"><h2>Police</h2></div><div class="sheet-body police">` +
        res.map((l) => `<p>${l}</p>`).join('') +
        `</div><div class="police-choice">` +
        (this.save.state.bailOffer === 'bail'
          ? ((have) =>
              `<button type="button" class="place" data-police="bail" ${have < (this.case?.bail ?? 0) * 100 ? 'disabled' : ''}><b>Pay bail: ${money((this.case?.bail ?? 0) * 100)}</b><small>${have < (this.case?.bail ?? 0) * 100 ? `You've only got ${money(have)}, cash and bank together` : 'Cash first, then your bank account. You get it back if you show up to court.'}</small></button>` +
              `<button type="button" class="place" data-police="custody"><b>Wait in jail for the hearing</b><small>A day and a half in County, then the judge.</small></button>`)(Math.round(cashOf(this.inventory) * 100) + (this.account?.cents ?? 0))
          : this.save.state.bailOffer === 'custody'
            ? `<button type="button" class="place" data-police="custody"><b>Wait for the hearing</b><small>A day and a half in County, then the judge.</small></button>`
            : `<button type="button" class="place" data-police="done"><b>Go on</b><small>${this.record.arrests ? 'It’s on your record (You: Criminal record).' : 'Back to the street.'}</small></button>`) +
        `</div>`;
      return;
    }
    if (this.sheet === 'police') {
      const masked = wearing(this.inventory).masked;
      const why = Array.isArray(this.save.state.policeWhy) ? (this.save.state.policeWhy as string[]).map((l) => `<p class="police-why">${l}</p>`).join('') : '';
      card.innerHTML =
        `<div class="sheet-head"><h2>Police</h2></div><div class="sheet-body police">` +
        (this.save.state.policeStop === 'sting'
          ? why + `<p>"Police. Turn around. Hands behind your back." It was a buy. They were waiting for you to make it.</p>`
          : this.save.state.policeStop === 'car'
          ? why + `<p>A second flashlight on the other window. "Step out of the vehicle. Slowly. Hands where I can see them."</p>`
          : `<p>A patrol car pulls up beside you, lights off. Two of them get out. One has a hand on his belt.</p>` +
            why +
            `<p>"${masked ? 'Take that off your face. ' : ''}Hold up. Where are you headed ${partOfDay() === 'night' || partOfDay() === 'dusk' ? 'tonight' : 'today'}?"</p>`) +
        `</div><div class="police-choice">` +
        (this.save.state.policeStop === 'sting'
          ? `<button type="button" class="place" data-police="stay"><b>Hands behind your back</b><small>They've got the bag, the money, and you on camera.</small></button>`
          : this.save.state.policeStop === 'car'
          ? `<button type="button" class="place" data-police="stay"><b>Step out</b><small>Do as they say. They've run the plate.</small></button>`
          : `<button type="button" class="place" data-police="stay"><b>Stay calm</b><small>Let them talk. They'll want to search you.</small></button>` +
            `<button type="button" class="place" data-police="talk"><b>Talk your way out</b><small>Speech. A good story and they move on without a search; a bad one and they look harder.</small></button>`) +
        `<button type="button" class="place" data-police="run"><b>Run</b><small>Agility, and your legs. If they catch you, it'll hurt.</small></button>` +
        `</div>`;
      return;
    }
    if (this.sheet === 'stats') {
      const h = this.health;
      const summary = `<p class="you-summary"><span>Blood <b>${(h.blood / 1000).toFixed(1)} L</b></span><span>Cash <b>${money(Math.round(cashOf(this.inventory) * 100))}</b></span><span>Character <b>#${this.world.lives}</b></span></p>`;
      card.innerHTML = `<div class="sheet-head"><h2>You</h2>${close}</div><div class="sheet-body">${this.noteHtml(this.sheetNote, 'sheet-note')}${summary}${this.statsHtml()}${this.marksHtml()}${this.recordHtml()}</div>`;
      return;
    }
    if (this.sheet === 'places') {
      card.innerHTML =
        `<div class="sheet-head"><h2>Where to?</h2>${close}</div><div class="sheet-body places">` +
        PLACES.filter((p) => !HIDDEN_PLACES.has(p.id)).map(
          (p) =>
            `<button type="button" class="place ${p.id === this.place ? 'here' : ''}" data-place="${p.id}"><b>${p.name}</b><small>${p.id === this.place ? "You're here" : p.desc}${p.id !== this.place && p.id !== 'street' ? (p.hours ? `<i class="${isOpen(p.hours) ? 'open' : 'shut'}">${hoursText(p.hours)}</i>` : '<i class="open">Open all hours</i>') : ''}</small></button>`,
        ).join('') +
        `</div>`;
      return;
    }
    const inv = this.inventory;
    const h = this.health;
    const total = inv.items.reduce((t, i) => t + i.kg, 0);
    let body =
      `<div class="pocket-cash"><span>Cash</span><b>${money(Math.round(cashOf(inv) * 100))}</b></div>` +
      `<p class="pocket-purse">${this.purseHtml()}</p>` +
      `<p class="pocket-wear">Wearing ${[...inv.clothes, ...(inv.gear ?? [])].map((c) => c.toLowerCase()).join(', ')}. Carrying ${kgLabel(total + purseKg(inv))}.</p>` +
      // What anyone looking at you can see you're carrying.
      (inv.items.some((x) => x.kind === 'weapon')
        ? ((seen) => `<p class="pocket-shows${seen.length ? ' seen' : ''}">${seen.length ? `Anyone looking can see you're carrying: ${seen.map((x) => lc(x.name)).join(', ')}. People notice you sooner and scare easier, and the police notice too.` : 'Your weapons are out of sight.'}</p>`)(inv.items.filter((x) => x.kind === 'weapon' && showing(inv, x) >= 0.16))
        : '');
    // Your face: what's on it, and how hard you are to know.
    {
      const w = wearing(inv);
      const anon = anonymity(inv);
      const row = (name: string, small: string, btn: string) => `<li><div><b>${name}</b><small>${small}</small></div><span class="acts">${btn}</span></li>`;
      const rows: string[] = [];
      if (w.face) rows.push(row(w.face, w.masked ? 'Pulled up over your face' : 'Pulled down', `<button type="button" data-mask>${w.masked ? 'Pull down' : 'Pull up'}</button>`));
      if (hasHood(inv)) rows.push(row('Hood', w.hood ? 'Up' : 'Down', `<button type="button" data-hood>${w.hood ? 'Down' : 'Up'}</button>`));
      if (w.head) rows.push(row(w.head, 'On', ''));
      if (w.eyes) rows.push(row(w.eyes, 'On', ''));
      body +=
        `<div class="spot"><h3><span>Your face</span><em>${Math.round(anon * 100)}% hidden</em></h3>` +
        (rows.length ? `<ul class="pocket-list">${rows.join('')}</ul>` : `<p class="pocket-empty">Nothing hides your face. Anyone who sees you will know you again.</p>`) +
        `</div>`;
    }
    // Every pocket and bag with something in it: how full, and what's there.
    // The empty ones are listed small at the end.
    const empty = inv.spots.filter((sp) => !inv.items.some((x) => x.spot === sp.id));
    for (const sp of inv.spots) {
      const xs = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => x.spot === sp.id);
      if (!xs.length) continue;
      const used = usedKg(inv, sp.id);
      const fill = Math.min(100, (100 * used) / sp.maxKg);
      body +=
        `<div class="spot"><h3><span>${sp.on} · ${sp.name}</span><em>${sp.fits} · ${hideWord(concealOf(sp, inv.clothes[0]))}</em></h3>` +
        `<div class="spot-bar"><i style="width:${fill}%"></i><span>${kgLabel(used)} / ${sp.maxKg} kg</span></div>` +
        (xs.length
          ? `<ul class="pocket-list">${xs
              .map(({ x, i }) => {
                const m = x.med ? medById(x.med) : null;
                const why = m?.blocked(h);
                const small = m
                  ? (why ?? m.desc)
                  : x.secret === 'cocaine' && x.known
                    ? `${x.doses} bump${x.doses === 1 ? '' : 's'} left`
                    : x.drink
                      ? x.drink === 'energy'
                        ? '160 mg of caffeine'
                        : x.drink === 'beer'
                        ? 'A can of beer'
                        : `${x.kind === 'weapon' ? 'A weapon too · ' : ''}${x.doses ? `${x.doses} swig${x.doses === 1 ? '' : 's'} left` : 'Empty'}`
                    : x.kind === 'weapon' && gunOf(x.name)
                      ? `${gunOf(x.name)!.desc} ${x.doses ?? 0} of ${gunOf(x.name)!.holds} loaded.`
                    : /^(9mm rounds|\.38 rounds|12-gauge shells)$/.test(x.name)
                      ? `${x.doses ?? 0} left`
                    : x.kind === 'weapon' && knifeOf(x.name)
                      ? `${knifeOf(x.name)!.desc} +${knifeOf(x.name)!.dmg} damage.`
                    : x.kind === 'weapon' && /syringe/i.test(x.name)
                      ? `${x.detail ?? 'A syringe'} · +${x.weapon ?? 0} damage, cuts`
                    : /^(pack of )?cigarettes$/i.test(x.name)
                      ? x.doses
                        ? `${x.detail ? `${x.detail}, ` : ''}${x.doses} left`
                        : `Empty${x.detail ? ` (${x.detail})` : ''}`
                      : /^loose cigarettes$/i.test(x.name)
                        ? `${x.doses ?? 1} loose`
                      : /^lighter$/i.test(x.name)
                        ? `<span class="fuel" title="Fuel left"><i style="width:${flameLeft(x)}%"></i></span>Fuel ${flameLeft(x)}%${flameLeft(x) <= 15 ? ', nearly dry' : ''}`
                        : /^matches$/i.test(x.name)
                          ? `${flameLeft(x)} match${flameLeft(x) === 1 ? '' : 'es'} left`
                          : x.kind === 'weapon'
                            ? x.spray
                              ? `${x.doses ?? 0} spray${x.doses === 1 ? '' : 's'} left · blinds them`
                              : `A weapon: +${x.weapon ?? 0} damage${x.cuts ? ', cuts' : ''}`
                            : x.kind === 'car keys'
                            ? `${x.detail ?? 'Car keys'} · ${x.car === 'found' ? `the car's parked nearby${x.carSearched ? ', searched' : ''} (the fence buys cars)` : x.car === 'gone' ? "the car's gone" : 'press it on the street to find the car'}`
                            : /^(pack of )?cigarettes$/i.test(x.name)
                            ? `${x.detail ? `${x.detail} · ` : ''}${x.doses ?? 0} of 20`
                            : /^loose cigarettes$/i.test(x.name)
                            ? `${x.doses ?? 1} loose`
                            : /card/.test(x.kind) && (x.pin || x.drained)
                            ? `${x.detail ? `${x.detail} · ` : ''}${x.drained ? 'Stopped' : `PIN ${x.pin} (cash machine at the bank)`}`
                            : x.detail;
                const act = (attr: string, label: string, no?: string | null) => `<button type="button" data-${attr}="${i}" ${no ? `disabled title="${no}"` : ''}>${label}${no ? `<small>${no}</small>` : ''}</button>`;
                let acts = m && m.id !== 'testkit' ? act('use', 'Use', why) : '';
                if (/^(lighter|matches)$/i.test(x.name)) acts += act('fire', 'Fire', this.fireBlocked());
                if (/^(loose |pack of )?cigarettes$/i.test(x.name)) acts += act('smoke', this.smoking ? 'Smoking' : 'Smoke', (x.doses ?? 1) <= 0 ? 'Empty' : this.smokeBlocked());
                if (x.drink) acts += act('drink', 'Drink', (x.doses ?? 0) <= 0 ? 'Empty' : this.canOpenSheet ? null : 'Not now');
                // Loose ones into a pack with room in it.
                if (/^loose cigarettes$/i.test(x.name) && inv.items.some((y) => /^(pack of )?cigarettes$/i.test(y.name) && (y.doses ?? 0) < 20))
                  acts += act('pack', 'Put in pack');
                // One pack into another (a pack holds 20).
                if (/^(pack of )?cigarettes$/i.test(x.name) && (x.doses ?? 0) > 0 && inv.items.some((y) => y !== x && /^(pack of )?cigarettes$/i.test(y.name) && (y.doses ?? 0) < 20))
                  acts += act('combine', 'Into another pack');
                if (x.kind === 'id' || x.kind === 'credit card' || x.kind === 'debit card') acts += act('burn', 'Burn', this.burnBlocked());
                if (x.secret && x.secret !== 'cocaine' && x.secret !== 'empty') {
                  if (!x.known && inv.items.some((y) => y.med === 'testkit')) acts += act('test', 'Test');
                  acts += act('inject', 'Inject', this.injectBlocked());
                } else if (x.secret && !x.known) {
                  acts += act('taste', 'Taste');
                  if (inv.items.some((y) => y.med === 'testkit')) acts += act('test', 'Test');
                }
                if (x.secret === 'cocaine' && x.known) acts += act('bump', 'Bump', h.wired ? 'Already wired' : null);
                if (x.secret === 'cocaine' && x.known && (x.doses ?? 0) >= 2)
                  acts += act('bagup', 'Bag it up', !inv.items.some((y) => y.name === 'Zip bags' && (y.doses ?? 0) > 0) ? 'No zip bags' : this.inside && !this.inOwnRoom ? 'Not in here' : null);
                // The alley's loose brick, or your room: somewhere to leave it.
                if (this.place === 'fence' || (this.place === 'room' && this.roomRented)) acts += act('stash', this.place === 'fence' ? 'Hide it' : 'Leave it here');
                // A gun: load it from a box of its rounds.
                if (gunOf(x.name)) acts += act('load', 'Load', (x.doses ?? 0) >= gunOf(x.name)!.holds ? 'Full' : inv.items.some((y) => y.name === gunOf(x.name)!.ammo && (y.doses ?? 0) > 0) ? null : 'No ammunition');
                // Car keys: find the car (on the street), then go through it, or sleep in it.
                if (x.kind === 'car keys') {
                  if (!x.car) acts += act('findcar', 'Find the car', this.place !== 'street' || !this.canLurk ? 'Out on the street' : null);
                  else if (x.car === 'found') {
                    acts += act('searchcar', 'Search it', x.carSearched ? 'Done' : this.place !== 'street' || !this.canLurk ? 'Out on the street' : null);
                    acts += act('sleepcar', 'Sleep in it', this.place !== 'street' || !this.canLurk ? 'Out on the street' : null);
                  }
                }
                // A weapon: in your hand (out, and seen), or put away.
                if (x.kind === 'weapon' && !x.spray) {
                  if (x.hand) acts += act('putaway', 'Put away');
                  else {
                    const fh = freeHand(inv);
                    acts += act('hold-r', 'Right hand', fh === null || inv.items.some((y) => y.hand === 'right') ? 'Hand full' : null);
                    acts += act('hold-l', 'Left hand', inv.items.some((y) => y.hand === 'left') ? 'Hand full' : null);
                  }
                }
                // Into another pocket (to hide it better, or have it to hand).
                if (!x.hand) acts += act('move', 'Move', nextSpot(inv, x) ? null : 'Nowhere else');
                return (
                  `<li><div><b>${x.name}</b><small>${small ? `${small} · ` : ''}${kgLabel(x.kg)}${x.kind === 'weapon' ? ` · ${hideStat(bulkOf(x))}, ${alarmStat(alarmOf(x))} · <span class="shows${showing(inv, x) >= 0.16 ? ' seen' : ''}">${x.hand ? `In your ${x.hand} hand` : showWord(showing(inv, x))}${inBag(inv, x.spot) ? ' (a moment to get out)' : ''}</span>` : ''}</small></div>` +
                  `<span class="acts">${acts}<button type="button" class="drop" data-drop="${i}" aria-label="Throw away ${x.name}">Trash</button></span></li>`
                );
              })
              .join('')}</ul>`
          : '') +
        `</div>`;
    }
    if (empty.length) {
      body +=
        `<h3>Empty</h3><ul class="spot-empty">` +
        empty.map((sp) => `<li><span>${sp.on} · ${sp.name}</span><em>${sp.fits}, ${sp.maxKg} kg · ${hideWord(concealOf(sp, inv.clothes[0]))}</em></li>`).join('') +
        `</ul>`;
    }
    if (!inv.spots.length) body += `<p class="pocket-empty">Nothing you're wearing has pockets.</p>`;
    // Keep your place in the list when it's redrawn.
    const scroll = card.querySelector('.sheet-body')?.scrollTop ?? 0;
    card.innerHTML = `<div class="sheet-head"><h2>Pockets</h2>${close}</div><div class="sheet-body">${this.noteHtml(this.sheetNote, 'sheet-note')}${body}</div>`;
    card.querySelector('.sheet-body')!.scrollTop = scroll;
  }

  /** What the encounter needs to know about you to offer its options (see Encounter.flame). */
  private prime(e: Encounter) {
    const inv = this.inventory;
    // Bags to sell (a point each), and powder not bagged up yet.
    const coke = inv.items.filter((x) => x.secret === 'cocaine' && x.known && (x.doses ?? 0) > 0);
    e.product = coke.filter((x) => x.doses === 1).length;
    e.bulk = coke.filter((x) => (x.doses ?? 0) > 1).reduce((n, x) => n + (x.doses ?? 0), 0);
    e.heat = this.infamy.heat;
    // Face to face and awake, they see you as you are now (the least covered you've been is what sticks).
    if (e.facedYou && e.stage !== 'seen' && !e.them.out && !e.them.dead && !e.chase) {
      const anon = anonymity(inv);
      if (!e.seenAs || anon < e.seenAs.anon) e.seenAs = { anon, looked: describe(inv), clothes: lookClothes(inv) };
    }
    e.flame = !!this.flame();
    e.cardsHeld = e.holder
      ? inv.items.map((x, i) => ({ x, i })).filter(({ x }) => /card/.test(x.kind) && x.detail === e.holder && !x.pin).map(({ x, i }) => ({ i, name: x.name }))
      : [];
    e.canAsk = this.world.thieves.length > 0 && !e.person.thief;
    e.weapons = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => x.kind === 'weapon').map(({ x, i }) => ({ i, name: x.name, weapon: x.weapon, cuts: x.cuts, spray: x.spray, doses: x.doses, loaded: x.secret && x.secret !== 'empty' && x.secret !== 'cocaine' ? x.secret : undefined, known: x.known, hand: x.hand, ...(gunOf(x.name) ? { gun: true, ammo: inv.items.filter((y) => y.name === gunOf(x.name)!.ammo).reduce((n, y) => n + (y.doses ?? 0), 0) } : {}) }));
    e.wet = WET_AMOUNT[this.weather.now] > 0 && !this.inside;
    // How much of what you're carrying shows (a handle out of a pocket, the shape of a blade).
    e.exposed = exposure(inv);
    e.bagged = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => x.kind === 'weapon' && inBag(inv, x.spot)).map(({ i }) => i);
    e.ankle = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => x.kind === 'weapon' && /ankle/i.test(inv.spots.find((sp) => sp.id === x.spot)?.on ?? '')).map(({ i }) => i);
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
      const k = document.createElement('span');
      k.className = 'seen-kind';
      k.textContent = NAMES[e.person.kind];
      const r = document.createElement('span');
      r.className = 'seen-race';
      // From here you can't make out who they are, only what.
      r.textContent = 'Across the street';
      const tap = document.createElement('span');
      tap.className = 'seen-tap';
      tap.textContent = 'Tap to approach';
      btn.append(k, r, tap);
      btn.onclick = () => this.act('open');
      this.seenEl.append(btn);
    }
    if (e) this.prime(e);
    this.encView.render(this.tvState.on ? e : null);
    this.renderStats();
    this.renderYou(!!e && e.stage !== 'seen');
    this.view.classList.toggle('in-encounter', !!e && e.stage !== 'seen');
    this.view.classList.toggle('ending', this.ending);
    this.view.classList.toggle('note-off', !!e && e.stage !== 'seen' && (e.stage !== 'over' || this.ending));
    this.renderShop();
    if (this.sheet) this.renderSheet();
  }

  /** The stats sheet: each stat, what it does for you right now, how it grows; then the rest of you. */
  private statsHtml(): string {
    const st = this.stats;
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const sign = (x: number) => `${x >= 0 ? '+' : '−'}${pct(Math.abs(x))}`;
    const now: Record<StatName, [string, string][]> = {
      sneak: [
        ['Ambushes land', sign(ambushBonus(st))],
        ['How fast you’re noticed', noticeRate(st) >= 0.995 ? 'normal' : `−${pct(1 - noticeRate(st))}`],
      ],
      strength: [
        ['Damage from your blows', `+${pct(strengthDamage(st))}`],
        ['Fear of you', `+${strengthFear(st)}`],
      ],
      unarmed: [
        ['Damage from your blows', `+${pct(unarmedDamage(st))}`],
        ['All told (with Strength)', `×${damageMult(st).toFixed(2)}`],
        ['Techniques', ALL_TECHNIQUES.filter((t) => t.level <= st.unarmed.level).map((t) => t.name).join(', ') || 'Just the basics'],
        ...((): [string, string][] => {
          const next = ALL_TECHNIQUES.find((t) => t.level > st.unarmed.level);
          return next ? [['Next', `${next.name} (${next.where}) at level ${next.level}`]] : [];
        })(),
      ],
      agility: [
        ['Your blows land', sign(accuracyBonus(st))],
        ['Their blows land', sign(-dodgeBonus(st))],
      ],
      stamina: [
        ['Stamina', `${maxStamina(st)}`],
        ['Breath back each turn', `${staminaRegen(st).toFixed(1)}`],
      ],
      weapons: [
        ['Damage with a weapon', `+${pct(weaponDamage(st))}`],
        ['Weapon blows land', sign(weaponAccuracy(st))],
        ['On you', this.inventory.items.filter((x) => x.kind === 'weapon').map((x) => x.name).join(', ') || 'Nothing. Take one off someone.'],
      ],
      intimidation: [
        ['Fear, from this stat', `+${fearBonus(st)}`],
        ...this.menaceRows(),
        ['Total, before who they are', `+${Math.round(this.menace())}`],
      ],
      speech: [
        ['Lies that land', `+${pct(lieBonus(st))}`],
        ['Talking them into handing it over', `+${pct(persuadeBonus(st.speech.level))}`],
      ],
    };
    const how: Record<StatName, string> = {
      speech: 'Talking your way out of things: the police, a clerk who doubts your ID, someone who catches you following them. More when the lie works.',
      sneak: 'Surveilling, and ambushes (bum rush, sucker punch, shove).',
      strength: 'Landing blows (slowly).',
      unarmed: 'Landing blows, ambushes and techniques. Each new level can teach you a new move.',
      agility: 'Landing blows, and dodging theirs.',
      stamina: "Fighting until you're exhausted.",
      weapons: 'Using a weapon in a fight (and pepper spray). Take them off the people who carry them.',
      intimidation: 'Mugging, threatening, making people give up, and torture. Scared people hand it over, tell the truth, and give up mid-fight.',
    };
    const rows = (xs: [string, string][]) => xs.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    // What's wrong with you comes first: each injury and what it's doing to you.
    const all = injuryEffects(this.health, this.stressNow);
    const states = all.filter((i) => i.status);
    // (Marks and scars aren't dangerous: they're shown apart, further down.)
    const hurts = all.filter((i) => !i.status && !i.mark);
    // The states you're in (stress, drink, drugs, caffeine, cold), each with its meter.
    let status = states.length
      ? `<section class="stat-card injuries status"><h3><span>Status</span><b>${states.length}</b></h3>` +
        states
          .map(
            (i) =>
              `<div class="injury"><h4>${i.name}</h4>` +
              (i.meter ? `<div class="spot-bar status-bar${/withdraw|hooked|craving|panick|stressed|blackout|drunk/i.test(i.name) ? ' harm' : ''}"><i style="width:${Math.round(i.meter.k * 100)}%"></i><span>${i.meter.text}</span></div>` : '') +
              `<ul>${i.effects.map((x) => `<li>${x}</li>`).join('')}</ul><p class="stat-how">${i.heals}</p></div>`,
          )
          .join('') +
        `</section>`
      : '';
    // What's hurting you first (bleeding, breaks), then the states you're in.
    let html = hurts.length
      ? `<section class="stat-card injuries"><h3><span>Condition</span><b>${hurts.length}</b></h3>` +
        hurts
          .map((i) => `<div class="injury"><h4>${i.name}</h4><ul>${i.effects.map((x) => `<li>${x}</li>`).join('')}</ul><p class="stat-how">${i.heals}</p></div>`)
          .join('') +
        `</section>`
      : '';
    html += status;
    html += (Object.keys(STAT_NAMES) as StatName[])
      .map((k) => {
        const { level, xp } = st[k];
        const max = level >= MAX_LEVEL;
        const need = xpToNext(level);
        return (
          `<section class="stat-card"><h3><span>${STAT_NAMES[k]}</span><b>${level}${max ? ' · max' : ''}</b></h3>` +
          `<div class="spot-bar"><i style="width:${max ? 100 : (100 * xp) / need}%"></i><span>${max ? 'Maxed out' : `${Math.floor(xp)} / ${need} to level ${level + 1}`}</span></div>` +
          `<dl class="stat-now">${rows(now[k])}</dl><p class="stat-how">Grows by: ${how[k]}</p></section>`
        );
      })
      .join('');
    // The rest of you.
    const h = this.health;
    const stress = this.stressNow;
    const nerve = h.nerve ?? 0;
    const hu = this.humanity;
    const lvl = humanityLevel(hu.lost);
    html +=
      `<section class="stat-card"><h3><span>Your state</span></h3><dl class="stat-now">` +
      rows([
        ['Stress', `${Math.round(stress)} / 100${stress >= 1 ? ` (blows land ${sign(-stress / 400)}, dodging ${sign(-stress / 400)})` : ''}`],
        ['Nerve', `${Math.round(nerve)} / 100 (violence stresses you ${pct(1 - nerve / 100)} as much)`],
        ['Humanity', `${lvl?.name ?? (hu.lost ? 'Shaken' : 'Intact')} · ${hu.kills} killed`],
        ...this.extraStatRows(),
      ]) +
      `</dl><p class="stat-how">Stress builds in fights and eases with time and cigarettes. Nerve grows with every fight you live through.</p></section>`;
    return html;
  }

  /**
   * How frightening you are, before who they are comes into it: your
   * Intimidation and Strength, how far gone you are, a mask.
   */
  private menace(): number {
    const st = this.stats;
    return fearBonus(st) + strengthFear(st) + evilFear(this.humanity.lost) + (conspicuous(this.inventory) ? 6 : 0);
  }
  private menaceRows(): [string, string][] {
    const st = this.stats;
    const rows: [string, string][] = [['Fear, from your Strength', `+${strengthFear(st)}`]];
    const evil = Math.round(evilFear(this.humanity.lost));
    if (evil) rows.push(['Fear, from the look in your eyes', `+${evil}`]);
    if (conspicuous(this.inventory)) rows.push(['Fear, from the mask', '+6']);
    if (this.inventory.items.some(isBlade)) rows.push(['Fear, when you show them your blade (mugging)', '+10']);
    return rows;
  }

  /**
   * How scared of you someone is as you walk up (0..100): how frightening
   * you are, who they are (a drunk is braver, a big build braver still),
   * whether they know you and what you did to them, your reputation, and
   * how hurt you look.
   */
  private fearOf(e: Encounter): number {
    const p = e.person;
    const f = this.infamy;
    const h = this.health;
    const tough = ['Easy', 'Fair', 'Hard', 'Brutal'].indexOf(BUILDS[p.build].difficulty);
    let fear = 20 + this.menace() * personalityOf(p).cowed + { civilian: 10, junkie: 3, homeless: 0, drunk: -12 }[p.kind] - tough * 9 + personalityOf(p).fear;
    if (e.recognised) {
      const k = p.known ? this.people.find((x) => x.id === p.known) : undefined;
      if (k) fear += Math.min(25, f.rep * 0.25) + (k.memory.fear ?? 0) * 0.7 - (k.memory.beatYou ? 15 : 0);
      else fear += Math.min(30, f.rep * 0.3);
    } else fear += Math.min(8, f.rep * 0.05 * (1 - anonymity(this.inventory)));
    // They can see you're carrying.
    fear += exposure(this.inventory) * 18;
    // You look like you'd lose.
    if (h.broken.some((x) => x.endsWith('leg'))) fear -= 8;
    if (h.blood < h.maxBlood * 0.7) fear -= 8;
    return Math.max(0, Math.min(100, Math.round(fear)));
  }

  /** More rows for the stats sheet (reputation, anonymity...). */
  private extraStatRows(): [string, string][] {
    const f = this.infamy;
    const inv = this.inventory;
    const anon = anonymity(inv);
    return [
      ['Reputation', `${repName(f.rep)} (${Math.round(f.rep)})`],
      ['Police', HEAT_NAMES[heatLevel(f.heat)]],
      ['Anonymity', `${Math.round(anon * 100)}%${conspicuous(inv) ? ' · masked: people notice you faster' : ''}`],
      ['People who remember you', `${this.people.filter((k) => !k.memory.otherLife).length}`],
    ];
  }

  /** Your stats in the top corner, each with progress towards its next level. */
  private renderStats() {
    this.statsEl.hidden = !this.tvState.on;
    const st = this.stats;
    this.statsEl.innerHTML = (Object.keys(STAT_NAMES) as StatName[])
      .map((k) => {
        const { level, xp } = st[k];
        const pct = level >= MAX_LEVEL ? 100 : (100 * xp) / xpToNext(level);
        return `<div class="stat" data-stat="${k}"><span><em class="long">${STAT_NAMES[k]}</em><em class="short">${STAT_SHORT[k]}</em></span><b>${level}</b><i><u style="width:${pct}%"></u></i></div>`;
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
      `<div class="enc-conds">${((cs) => (cs.length > 4 ? [...cs.slice(0, 3), `+${cs.length - 3} more`] : cs))(healthConditions(h)).map((c) => `<span class="${/^\+\d+ more$/.test(c) ? 'more' : ''}">${c}</span>`).join('')}</div>` +
      `<div class="you-cash">${money(Math.round(cashOf(this.inventory) * 100))}</div>` +
      this.humanityLine();
    // Where your status ends, so a shop card starts below it (lots of injuries make it tall).
    const bottom = this.youEl.hidden ? 0 : Math.round(this.youEl.getBoundingClientRect().bottom - this.view.getBoundingClientRect().top);
    this.view.style.setProperty('--you-bottom', `${bottom}px`);
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
        // Someone with your things, someone you've met, or a stranger.
        // Late with Dez's money: someone comes for it.
        const dz = this.debt;
        const sent = !!dz && now() > dz.due && Math.random() < Math.min(0.6, 0.25 + (dz.strikes ?? 0) * 0.1);
        const thief = sent ? null : maybeThief(this.world);
        const known = sent ? null : thief ? (thief.known ? (this.people.find((k) => k.id === thief.known) ?? null) : null) : comeBack(this.people);
        const person = sent ? this.enforcerFor(dz!) : (thief ?? (known ? meet(known) : makePerson()));
        const s = this.lurkState;
        s.times++;
        s.seen[person.kind]++;
        s.races[person.race]++;
        const e = newEncounter(person, this.yourBody());
        const inv = this.inventory;
        const anon = anonymity(inv);
        e.conspicuous = conspicuous(inv);
        if (known) {
          if (!thief) applyTo(known, e.them);
          else {
            known.healedAt ??= known.at;
            heal(known);
            applyTo(known, e.them);
          }
          e.recognised = recognises(known, anon, lookClothes(inv));
          e.lookAt = { anon, clothes: lookClothes(inv).join('|') };
          e.grudge = known.memory.grudge;
          // (What an earlier you did to them, this you doesn't know.)
          e.history = known.memory.otherLife ? undefined : historyText(known);
          e.looks = [...injuriesText(known), ...marksText(known.marks)];
          e.dread = known.memory.fear ?? 0;
          e.regular = !!known.memory.customer && !!e.recognised && (known.memory.grudge ?? 0) < 30;
        } else if (!sent && Math.random() < Math.min(0.5, this.infamy.rep / 200) * (1 - anon)) {
          // A stranger who's heard about you, and knows your face.
          e.recognised = true;
          e.byRep = true;
          e.lookAt = { anon, clothes: lookClothes(inv).join('|') };
          e.grudge = 0;
          e.history = "You've never met. But they know your face: people talk.";
        }
        // How they were when it began (to tell, later, what you did this time).
        e.start = { blood: e.them.blood, broken: [...e.them.broken] };
        this.encounter = e;
        if (sent) {
          e.enforcer = true;
          this.phase = 'idle';
          this.act('ambushed');
          buzz([60, 40, 90]);
          return;
        }
        // The ones who hate you most come looking: they find you first.
        if (known && e.recognised && (e.grudge ?? 0) >= 70 && (e.dread ?? 0) < 60 && !known.broken.some((p) => p.endsWith('leg')) && known.broken.filter((p) => p.endsWith('arm')).length < 2 && Math.random() < 0.5) {
          // Through the normal path, so a fight that ends at once is dealt with properly.
          this.phase = 'idle';
          this.act('ambushed');
          buzz([60, 40, 90]);
          return;
        }
        this.phase = 'idle';
        // Whoever it is takes the middle of the screen: the note moves under them.
        this.noteEl.classList.add('low');
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
    // Loaded standing at a hiding place: it's as safe as it would have been (no reload trick).
    if (this.place === 'fence' || this.place === 'room') {
      const lost = this.place === 'fence' ? this.checkStash() : this.checkRoom();
      if (lost.length) this.timers.push(window.setTimeout(() => !this.closed && this.note(lost), 700));
    }
    // A note that was waiting for you when the game closed: still waiting.
    if (Array.isArray(this.save.state.stickyNote) && this.tvState.on && this.place === 'street' && !this.encounter) {
      const lines = this.save.state.stickyNote as string[];
      const extra = Array.isArray(this.save.state.stickyExtra) ? (this.save.state.stickyExtra as string[]) : [];
      this.timers.push(
        window.setTimeout(() => {
          if (this.closed) return;
          this.note(lines, true);
          this.noteEl.firstElementChild?.classList.add('note-title');
          if (extra.length) this.note(extra);
        }, 600),
      );
    }
    // Closed on the death screen: it's still there.
    if (typeof this.save.state.deathScreen === 'string') {
      this.dead = true;
      this.running = false;
      this.showDeath(this.save.state.deathScreen);
    }
    if (this.tvState.on) {
      // The set was already on at the save point: no warm-up.
      this.powerBtn.hidden = true;
      this.tv.powerOnSettled();
      // Saved in the beat after a fight ended: finish ending it.
      const e = this.encounter;
      if (e?.stage === 'over' && e.result !== 'killed') {
        const saved = e.result === 'lost' ? this.save.state.koLines : this.save.state.endLines;
        const lines = Array.isArray(saved) ? (saved as string[]) : [RESULT[e.result ?? 'left']];
        this.ending = true;
        this.timers.push(
          window.setTimeout(() => {
            this.ending = false;
            if (this.closed || this.encounter !== e) return;
            delete this.save.state.endLines;
            if (e.result === 'lost') this.knockedOut(lines);
            else this.closeEncounter(lines);
          }, 400),
        );
      }
    } else if (Array.isArray(this.save.state.koLines)) {
      // Saved while you were out cold: you still have to come to.
      this.tv.powerOff();
      this.koLines = this.save.state.koLines as string[];
      this.view.classList.add('ko-out');
      this.powerBtn.hidden = true;
      this.powerBtn.classList.remove('pressed');
      this.waitToComeRound();
    } else {
      this.tv.powerOff();
      this.powerBtn.hidden = false;
      this.powerBtn.classList.remove('pressed');
    }
    this.refresh();
    // Stopped by the police when the game was saved: they're still there.
    if ((this.save.state.policeStop || this.save.state.policeResult) && this.tvState.on) this.openSheet('police');
  }

  turnOn() {
    if (this.tvState.on || !this.running) return;
    this.powerBtn.classList.add('pressed');
    this.tvState.on = true;
    // iPhones only let a page feel the phone move once asked, from a tap.
    const DM = (globalThis as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    DM?.requestPermission?.().catch(() => {});
    // Coming to after a knockout: what happened, once the picture's back.
    const woke = this.koLines;
    this.koLines = null;
    delete this.save.state.koLines;
    if (woke) this.save.state.wokeLines = woke;
    this.view.classList.remove('ko-out');
    if (woke) this.timers.push(window.setTimeout(() => this.showWoke(), 2900));
    // (Kept in timers, so quitting straight after can't touch the next game.)
    this.timers.push(window.setTimeout(() => {
      this.powerBtn.hidden = true;
      this.tv.powerOn();
      this.refresh();
      // The picture snaps open ~0.45 s in: shake the set and buzz the phone.
      this.timers.push(window.setTimeout(() => {
        this.view.classList.remove('jolt');
        void this.view.offsetWidth;
        this.view.classList.add('jolt');
        try {
          navigator.vibrate?.([12, 40, 25]);
        } catch {
          /* not allowed here */
        }
      }, 430));
    }, 350));
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
    if (this.dead) return;
    this.running = true;
    // (Paused, or reloaded, before what happened while you were out was shown.)
    if (this.tvState.on && !this.koLines) this.showWoke();
  }
  private showWoke() {
    const woke = this.save.state.wokeLines;
    if (!this.running || this.closed || !Array.isArray(woke)) return;
    delete this.save.state.wokeLines;
    this.note(woke as string[], true);
    this.noteEl.firstElementChild?.classList.add('note-title');
  }

  /** Closes the game view (back to the menu). */
  close() {
    this.closed = true;
    clearTimeout(this.noteFade);
    this.koListen?.abort();
    this.koHint.remove();
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    // This game is done with: its window listeners go too, and the TV's GPU buffers.
    this.listeners.abort();
    this.tv.dispose();
    this.fx.setLow(0);
    this.hitUi.clear();
    this.view.style.transform = '';
    this.pause();
    this.view.classList.remove('active', 'jolt', 'in-encounter', 'ko-out');
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
    this.youBtn.hidden = true;
    this.shopEl.hidden = true;
    this.closeSheet();
    document.getElementById('death')?.remove();
  }
  /** Closed (quit to the menu, a new game): its leftover timers do nothing. */
  private closed = false;

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
      this.tickSmoke(dt);
      // Withdrawal: stress that won't settle.
      const floor = withdrawalEffects(this.health).floor;
      if (floor > (this.health.stress ?? 0)) this.health.stress = Math.min(floor, (this.health.stress ?? 0) + dt * 0.4);
      this.tickExposure(dt);
    }
    if ((this.weatherTimer -= dt) <= 0) {
      this.weatherTimer = 2;
      // Missed your court date: a warrant.
      const cs = this.case;
      if (cs && !cs.warrant && !this.save.state.bailOffer && now() > cs.courtAt) {
        cs.warrant = true;
        cs.bailPaid = 0;
        this.infamy.heat = Math.min(100, this.infamy.heat + 40);
        if (this.running && this.tvState.on) this.note(['You missed your court date. There\'s a warrant out for you now, and your bail is gone.']);
      }
      const was = this.weather.now;
      if (updateWeather(this.weather) && this.running && this.tvState.on && this.weather.now !== was && !this.inside) {
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
    if (this.sheet && this.sheet !== 'stats' && this.sheet !== 'police' && !this.canOpenSheet) this.closeSheet();
    if (this.running && this.noteTimer > 0 && (this.noteTimer -= dt) <= 0) {
      // A short fade, not a blink.
      this.noteEl.classList.add('fading');
      this.noteFade = window.setTimeout(() => {
        this.noteEl.hidden = true;
        this.noteEl.classList.remove('fading');
      }, 380);
    }
    this.tv.update(dt);
    // The red edge pulses when your blood is low.
    const e2 = this.encounter;
    const body = e2 && e2.stage !== 'seen' && e2.stage !== 'over' ? e2.you : this.health;
    const frac = body.blood / body.maxBlood;
    this.fx.setLow(this.tvState.on ? Math.min(1, Math.max(0, (0.82 - frac) / (0.82 - PASS_OUT))) : 0);
    this.hitUi.update(dt);
    // Bleeding from the head in a fight: blood runs down over the top of the
    // screen, into your eyes. The worse the bleeding, the faster it comes.
    const eb = this.encounter;
    if (this.running && this.tvState.on && eb && eb.stage === 'combat' && eb.you.headBleed && eb.you.bleeding > 0 && !eb.you.out) {
      if ((this.bleedClock -= dt) <= 0) {
        this.bleedClock = 3.2 - eb.you.bleeding * 0.55 + Math.random() * 1.2;
        this.fx.bleedTop(eb.you.bleeding);
      }
    } else if (this.bleedClock !== 0.6) {
      this.fx.resetBleedTop();
      this.bleedClock = 0.6;
    }
  }
  /** Seconds to the next run of blood from the top (bleeding from the head). */
  private bleedClock = 0.6;

  /** The device's time, top right (redrawn when the minute changes). */
  private tickClock() {
    const t = now();
    // (Once a second is plenty.)
    const sec = Math.floor(t / 1000);
    if (sec === this.clockSec) return;
    this.clockSec = sec;
    const s = clockText(t);
    const wx = this.weather.now;
    const key = s + wx;
    if (key === this.clockShown) return;
    this.clockShown = key;
    this.clockEl.querySelector('b')!.textContent = s;
    this.clockEl.querySelector('span')!.textContent = `${dateText(t)} · ${WEATHER_NAME[wx]}`;
    // Opening hours change with the time: waiting at the door when it opens, you
    // go in; there at closing, you're shown out.
    if (this.place !== 'street' && this.running && this.tvState.on) {
      const inside = this.inside;
      // (Just arrived, or the game just loaded here: nothing's changed yet.)
      if (this.insideAt !== this.place) {
        this.insideAt = this.place;
        this.wasInside = inside;
      } else if (inside !== this.wasInside && placeInfo(this.place).indoors) {
        this.wasInside = inside;
        const name = placeInfo(this.place).name;
        const armed = this.place === 'court' && this.inventory.items.some((x) => x.kind === 'weapon' && !/bottle|syringe/i.test(x.name));
        this.note(
          !inside
            ? ['Closing time. They show you out and lock up behind you.']
            : armed
              ? [`${name} opens. You join the line for the metal detector.`, ...this.goingIn()]
              : [`${name} opens. You go in.`, ...this.goingIn()],
        );
      }
    }
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
      this.lurkBtn.querySelector('span')!.textContent = this.lurkState.times > this.world.lifeStart ? 'Lurk again' : 'Lurk';
    }
    const rest = show && isHurt(this.health);
    if (this.restBtn.hidden === rest) this.restBtn.hidden = !rest;
    // The edge tabs: whenever a drawer could be pulled in.
    const pull = this.canOpenSheet && !this.sheet;
    if (this.goBtn.hidden === pull) this.goBtn.hidden = !pull;
    if (this.bagBtn.hidden === pull) this.bagBtn.hidden = !pull;
    // You (your stats): any time the TV's on and nothing's open, even mid-fight.
    const you = this.running && this.tvState.on && !this.sheet && !this.dead;
    if (this.youBtn.hidden === you) this.youBtn.hidden = !you;
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

/**
 * What's left in a lighter (fuel, percent) or a matchbook (matches). Ones
 * from before fuel was counted get a fair guess, fixed once used.
 */
function flameLeft(x: InvItem): number {
  if (x.doses == null) x.doses = /matches/i.test(x.name) ? 10 : 60;
  return x.doses;
}

/** Lower-case the first letter only ("the State ID", not "the state id"). */
function lc(s: string): string {
  return s.replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase());
}
/** With an article where it takes one: "a splint", "bandages", "gauze and tape". */
function withA(s: string): string {
  const n = lc(s);
  const first = n.split(',')[0].trim().split(' ').pop() ?? '';
  return /^gauze/.test(n) || (/s$/.test(first) && !/ss$/.test(first)) ? n : /^[aeiou]/.test(n) ? `an ${n}` : `a ${n}`;
}
/** "the knife and the bottle". */
function list2(xs: string[]): string {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** What the test kit shows for what's in a syringe. */
const DRUG_TEST: Record<'heroin' | 'fentanyl' | 'meth' | 'tranq', { name: string; line: string }> = {
  heroin: { name: 'heroin', line: 'The liquid turns a deep purple: heroin.' },
  fentanyl: { name: 'fentanyl', line: 'The strip shows one line, not two. Fentanyl. A drop of this could kill you.' },
  meth: { name: 'meth', line: 'The liquid goes orange, then dark brown: methamphetamine.' },
  tranq: { name: 'tranq', line: "The liquid doesn't change at all, but the little xylazine strip does. Tranq: an animal sedative." },
};

/** How well a pocket hides a weapon, in a word or two. */
const hideWord = (c: number) => (c >= 0.9 ? 'hides well' : c >= 0.7 ? 'hides some' : c >= 0.45 ? 'shows a bulge' : 'anything in it shows');

/** A knife or a box cutter (a bottle or a needle doesn't frighten like a blade). */
function isBlade(x: { kind: string; name: string }): boolean {
  return x.kind === 'weapon' && (/knife|box cutter/i.test(x.name) || !!knifeOf(x.name));
}

/** A court date: a weekday afternoon, at least a day off (real time). */
function courtDate(t = Date.now()): number {
  const d = new Date(t + 20 * 3_600_000);
  if (d.getHours() >= 16) d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(16, 0, 0, 0);
  return d.getTime();
}

/** Days inside: whatever you were on has long worn off, and the cigarette's out. */
function wearOff(h: Health) {
  h.cold = 0;
  h.wired = false;
  delete h.wiredBy;
  delete h.wiredUntil;
  delete h.high;
  delete h.highUntil;
  delete h.drunk;
  delete h.drunkAt;
  delete h.smokingUntil;
}

/**
 * In their hands and bleeding: they don't let you bleed out in a cell. The
 * ER first, cuffed to a gurney, and the wound closed.
 */
function custodyCare(h: Health): string[] {
  if (!h.bleeding && h.blood > h.maxBlood * 0.55) return [];
  const was = h.bleeding;
  h.bleeding = 0;
  h.blood = Math.max(h.blood, Math.round(h.maxBlood * 0.6));
  return [was ? 'They see the blood and take you to the ER first, cuffed to a gurney. A nurse closes the wound without a word to you.' : "You're grey and shaking. They take you to the ER first, cuffed to a gurney, and someone hangs a bag of fluids."];
}

/** Your court date is today (the court sits weekdays, and the date is the afternoon it closes). */
function hearingToday(courtAt: number, t = Date.now()): boolean {
  return new Date(courtAt).toDateString() === new Date(t).toDateString();
}
