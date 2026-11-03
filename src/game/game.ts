import type * as THREE from 'three';
import { writeSave, type SaveData } from '../core/save';
import { createTv } from './tv';
import { BUILDS, CHANCES, RACE_CHANCES, NAMES, makePerson, personalityOf, randomName } from './person';
import { ENCOUNTER_VERSION, act, newEncounter, type Encounter } from './encounter';
import { RESULT, createEncounterView } from '../ui/encounterView';
import { STAT_NAMES, newStats, xpToNext, MAX_LEVEL, maxStamina, ambushBonus, noticeRate, damageMult, accuracyBonus, dodgeBonus, staminaRegen, fearBonus, STAT_SHORT, unarmedDamage, strengthDamage, strengthFear, weaponDamage, weaponAccuracy, type StatName, type Stats } from './stats';
import { HIGH_HOURS, LURK_HOURS, addCaffeine, caffeineNow, caffeineLevel, drunkLevel, soberUp, REST_HOURS, afterFight, bodyFrom, healthConditions, injuryEffects, isHurt, newHealth, passHours, type Health } from './health';
import { ALL_TECHNIQUES, PASS_OUT, addStress, type Impact } from './encounter';
import type { Glass } from '../fx/glass';
import { uiGlitch } from '../fx/uiGlitch';
import { guilt } from './voices';
import { sound } from '../fx/sound';
import type { DrugLook } from '../fx/drugs';
import { clockText, dateText, now, partOfDay } from './clock';
import { RAIN_AMOUNT, WEATHER_NAME, newWeather, updateWeather, weatherLine, type WeatherState } from './weather';
import { COLD_NAMES } from './health';
import { maybeThief, newWorld, robBody, settle, type World } from './legacy';
import { HEAT_NAMES, applyTo, comeBack, heal, fade, heatLevel, historyText, injuriesText, meet, newInfamy, recognises, remember, repName, type Infamy, type Known } from './people';
import { anonymity, conspicuous, describe, hasHood, lookClothes, wearing } from './look';
import { marksText } from './encounter';
import { MEDS, cashOf, purseKg, wear, kgLabel, measure, medById, newInventory, noRoomWhy, stow, upgradeInventory, usedKg, type Inventory, type InvItem, type MedId } from './inventory';

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

import { COIN_MACHINE_FEE, ER_PRICES, GAS_STOCK, ID_FEE, LIQUOR_STOCK, PAWN_STOCK, PLACES, offer, placeInfo, type ErCare, type Place } from './shops';
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
  /** "Shake your phone to come round", on the dark screen after a knockout. */
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
    this.youEl.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('.enc-conds')) this.openSheet('stats');
    }, { signal: this.listeners.signal });
    this.restBtn = view.querySelector('#rest-btn') as HTMLButtonElement;
    this.noteEl = view.querySelector('#note') as HTMLElement;
    this.clockEl = view.querySelector('#clock') as HTMLElement;
    this.restBtn.onclick = () => this.rest();
    this.goBtn = view.querySelector('#go-btn') as HTMLButtonElement;
    this.bagBtn = view.querySelector('#bag-btn') as HTMLButtonElement;
    this.youBtn = view.querySelector('#you-btn') as HTMLButtonElement;
    this.shopEl = view.querySelector('#shop') as HTMLElement;
    this.shopEl.addEventListener('scroll', () => this.shopEl.classList.toggle('more', this.shopEl.scrollTop + this.shopEl.clientHeight < this.shopEl.scrollHeight - 6), { signal: this.listeners.signal, passive: true });
    this.sheetEl = view.querySelector('#sheet') as HTMLElement;
    this.goBtn.onclick = () => this.openSheet('places');
    this.bagBtn.onclick = () => this.openSheet('pockets');
    this.youBtn.onclick = () => this.openSheet('stats');
    this.edgeSwipes();
    this.sheetEl.onclick = (ev) => this.sheetClick(ev);
    this.shopEl.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.buy) this.buy(b.dataset.buy as MedId);
      else if (b.dataset.sell) this.sell(Number(b.dataset.sell));
      else if (b.dataset.stock) this.buyStock(b.dataset.stock);
      else if (b.dataset.bank) this.bank(b.dataset.bank);
      else if (b.dataset.atm) this.atm(Number(b.dataset.atm));
      else if (b.dataset.records) this.getId();
      else if (b.dataset.er) this.er(b.dataset.er as ErCare);
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
    return f;
  }

  /**
   * After an encounter with someone who lives: they remember you (see
   * people.ts). If they saw your face they talk, and some go to the police.
   */
  private rememberThem(e: Encounter) {
    const inv = this.inventory;
    const before = e.person.known ? this.people.find((k) => k.id === e.person.known)?.memory.sawFace : false;
    const k = remember(this.people, e, { anon: anonymity(inv), looked: describe(inv), clothes: lookClothes(inv) }, { robbed: !!e.robbed, stomped: !!e.stomped, mugged: !!e.mugged, tortured: e.tortured ?? 0 });
    if (!k || k.memory.beatYou) return;
    const f = this.infamy;
    if (k.memory.sawFace && !before) f.rep += k.memory.grudge / 8;
    // Who goes to the police: most civilians, few junkies.
    const reports = { civilian: 0.7, drunk: 0.4, homeless: 0.25, junkie: 0.15 }[k.person.kind];
    if (Math.random() < reports) f.heat = Math.min(100, f.heat + (k.memory.grudge / 5) * (k.memory.sawFace ? 1 : 0.4));
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
    // In a shop, or with a sheet open, what happened shows right there (the
    // street's note would be behind it).
    if (this.sheet) {
      this.sheetNote = lines;
      this.renderSheet();
    } else if (this.place !== 'street' && this.tvState.on && !this.encounter) {
      this.shopNote = lines;
      this.renderShop();
    }
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
      settle(this.world, old);
      if (old.stage !== 'seen') this.rememberThem(old);
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
    this.noteEl.hidden = true;
    this.wipeBlood();
    // Time passes while you wait: wounds bleed, or heal; the rain soaks you.
    const lines = passHours(this.health, LURK_HOURS);
    if (this.health.dead) return this.die(lines);
    const c = this.chill();
    if (c) lines.push(c);
    // With heat on you, a patrol might stop you instead of anyone turning up.
    const heat = this.infamy.heat;
    if (heat > 5 && Math.random() < Math.min(0.3, heat / 250)) {
      this.phase = 'idle';
      this.refresh();
      this.note(lines);
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
    if (!e || !this.running) return;
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
      if (k) e.recognised = recognises(k, anonymity(inv), lookClothes(inv));
    }
    if (e.stage === 'seen') e.them.fear = this.fearOf(e);
    this.prime(e);
    const wasOver = e.stage === 'over';
    const wasOut = !!e.them.out;
    const tortured = e.tortured ?? 0;
    const mugged = !!e.mugged;
    const levelsBefore = Object.values(this.stats).reduce((n, x) => n + x.level, 0);
    const impacts = act(e, id, this.stats, this.inventory, (this.save.state.moves ??= {}) as Record<string, number>);
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
    if (wasOut && (id.startsWith('stomp') || id.startsWith('ground:') || (id.startsWith('wpn:') && !this.inventory.items[Number(id.slice(4))]?.spray))) {
      e.stomped = true;
      const l = this.loseHumanity(STOMP_HELPLESS_COST);
      if (l) worse.push(l);
    }
    if (!wasOver && e.stage === 'over') {
      if (e.result === 'killed') {
        // Killing someone: the worst of it, unless you're long past caring.
        addStress(e.you, 30);
        // Was anyone watching? A face in a window, a car going past.
        const anon = anonymity(this.inventory);
        if (Math.random() < 0.3) {
          const f = this.infamy;
          f.rep += 15 * (1 - anon * 0.7);
          f.heat = Math.min(100, f.heat + 35 * (1 - anon * 0.6));
          worse.push(anon > 0.6 ? 'Someone saw that. A face in a window, then gone. At least your face was covered.' : 'Someone saw that. A face in a window, then gone. They saw yours.');
        }
        this.humanity.kills++;
        const l = this.loseHumanity(KILL_COST);
        if (l) worse.push(l);
      }
      // It's done. The fight's log stays (a body stays to be searched, and the
      // last blows should still be there); what happens to you afterwards is
      // added, and is what the closing note says.
      // Walked away before anything happened: nothing carries over (no nerve, the coke still in you).
      const nothing = !e.fought && (e.result === 'left' || e.result === 'lost-them');
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
    for (const text of after) e.log.push({ by: 'info', text });
    if (this.health.dead) {
      if (impacts.length) this.feel(impacts);
      return this.die(after.length ? after : e.log.map((l) => l.text));
    }
    if (impacts.length) this.feel(impacts);
    else buzz(6);
    // It's over and they're gone (or you are): the screen closes, and how it
    // ended is a note. A body stays, to be searched, until you walk away.
    // Knocked out: the screen goes off, and you have to come round.
    if (!wasOver && e.stage === 'over' && e.result === 'lost') return this.knockedOut([RESULT.lost, ...after]);
    if (!wasOver && e.stage === 'over' && e.result !== 'killed') {
      return this.closeEncounter([RESULT[e.result ?? 'left'], ...after]);
    }
    this.refresh();
  }

  /** Knocked out, the screen off: what to say when you come round. */
  private koLines: string[] | null = null;
  /** Out cold: listening for a shake to bring the power button back. */
  private koListen: AbortController | null = null;

  /**
   * Knocked out: the screen switches off like an old set (picture, line,
   * dot), the cracks stay on the glass, and nothing comes back until you
   * shake the phone; then the power button, and you come round.
   */
  private knockedOut(lines: string[]) {
    this.encounter = null;
    this.koLines = lines;
    this.tvState.on = false;
    this.tv.switchOff();
    this.view.classList.add('ko-out');
    this.powerBtn.hidden = true;
    this.powerBtn.classList.remove('pressed');
    this.koHint.hidden = true;
    this.refresh();
    buzz([200, 80, 400]);
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
          const t = performance.now();
          if (d > 14) {
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
        this.koHint.textContent = heard || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'Shake your phone to come round' : 'Tap to come round';
        this.koHint.hidden = false;
        if (!heard && !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) this.koHint.onclick = comeRound;
      }, 2600),
    );
    // A phone that won't share its motion (permission refused): a tap, after a while.
    this.timers.push(
      window.setTimeout(() => {
        if (ko.signal.aborted || heard) return;
        this.koHint.textContent = 'Tap to come round';
        this.koHint.onclick = comeRound;
      }, 9000),
    );
  }

  /** Done with whoever it was: back to the street, with what happened as a note. */
  private closeEncounter(lines: string[]) {
    this.encounter = null;
    this.refresh();
    uiGlitch(this.view, 0.35);
    this.note(lines);
    this.noteEl.firstElementChild?.classList.add('note-title');
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
    return this.idle || (this.running && !!e && e.stage === 'over');
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
    if (e) settle(w, e);
    const robbed = robBody(w, this.inventory, e);
    // A new you: nothing carried over but the world.
    // (Your name, your ID and your bank account were that character's.)
    for (const k of ['encounter', 'stats', 'health', 'inventory', 'humanity', 'place', 'policeStop', 'me', 'account', 'moves']) delete this.save.state[k];
    // Nobody knows this face. The people the old you hurt are still out there
    // (and your things on some of them), but they'd be looking for someone else.
    this.world.infamy = newInfamy();
    for (const k of this.people) {
      k.memory.sawFace = false;
      k.memory.clothes = [];
    }
    w.lives++;
    w.lifeStart = this.lurkState.times;
    this.onDeath?.();
    const el = document.createElement('div');
    el.id = 'death';
    const p = (t: string) => `<p>${t}</p>`;
    el.innerHTML =
      `<h2>${title}</h2>` +
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
    // Above everything, the blood on the glass included, so it can be read.
    document.body.append(el);
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
    if (kind === 'stats' || kind === 'police' ? !this.tvState.on || this.dead : !this.canOpenSheet) return;
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

  private closeSheet() {
    this.sheetNote = [];
    if (this.sheet) uiGlitch(null, 0.25);
    this.sheet = null;
    this.sheetEl.hidden = true;
  }

  private sheetClick(ev: MouseEvent) {
    const t = ev.target as HTMLElement;
    if (this.sheet === 'police') {
      // No walking away from this one: you answer.
      const b = t.closest('button');
      if (b?.dataset.police) this.police(b.dataset.police as 'run' | 'stay');
      return;
    }
    if (t === this.sheetEl) return this.closeSheet(); // tapped outside the card
    const b = t.closest('button');
    if (!b) return;
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
    else if (b.dataset.inject) this.inject(Number(b.dataset.inject));
    else if (b.dataset.pack) this.packLoose(Number(b.dataset.pack));
    else if (b.dataset.drink) this.drink(Number(b.dataset.drink));
  }

  /** Walk somewhere else. */
  private goTo(p: Place) {
    this.shopNote = [];
    this.closeSheet();
    if (p === this.place) return;
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
        gas: 'You walk over to the gas station. The door chimes as you go in.',
        pawn: 'You walk over to the pawn shop.',
        fence: 'You slip down the alley behind the laundromat.',
        bank: 'You walk to the bank.',
        liquor: 'You walk into the liquor store. A bell jangles over the door.',
        records: 'You push through the doors of the City Records Office and take a ticket.',
        hospital: 'The ER doors hiss open. You give a name at the desk and they tell you to sit.',
      }[p],
    ];
    const h = this.health;
    this.exposure = 0;
    const w = wearing(this.inventory);
    if (info.indoors && w.masked) {
      w.masked = false;
      lines.push(`You pull the ${w.face!.toLowerCase()} down before you go in.`);
    }
    if (info.indoors && h.cold) lines.push("It's warm in here. Stay a while and you'll thaw out.");
    if (info.indoors && this.smoking) {
      delete h.smokingUntil;
      lines.push('You stub the cigarette out on the wall before you go in.');
    }
    if (!info.indoors && RAIN_AMOUNT[this.weather.now] > 0) lines.push(`It's still raining (${WEATHER_NAME[this.weather.now].toLowerCase()}).`);
    this.note(lines);
    buzz(10);
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
  private buyStock(id: string) {
    const place = this.place;
    const s = (place === 'gas' ? GAS_STOCK : place === 'liquor' ? LIQUOR_STOCK : PAWN_STOCK).find((x) => x.id === id);
    const inv = this.inventory;
    if (!s || (place !== 'pawn' && place !== 'gas' && place !== 'liquor') || (place !== 'gas' && !isOpen(placeInfo(place).hours!)) || cashOf(inv) < s.price) return;
    // The pawn shop and the liquor store want to see ID first.
    let idLine = '';
    if (place === 'pawn' || place === 'liquor') {
      const check = this.showId(place);
      if (!check) return;
      idLine = check;
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
    } else if (s.slot === 'head' || s.slot === 'face' || s.slot === 'eyes') {
      // Something for your face: worn (a mask starts pulled down; pull it up in Pockets).
      const w = wearing(inv);
      const old = w[s.slot];
      w[s.slot] = s.name;
      if (s.slot === 'face') w.masked = false;
      line = `You buy the ${lc(s.name)}${old ? ` and bin your old ${old.toLowerCase()}` : ''}.${s.slot === 'face' ? ' You keep it pulled down for now (Pockets: pull it up).' : /s$/i.test(s.name) ? ' You put them on.' : ' You put it on.'}`;
    } else if (s.slot) {
      const r = wear(inv, s.slot, s.name);
      if (!r.ok) {
        this.note([`If you swap to the ${lc(s.name)}: ${r.why}`]);
        return;
      }
      line = `You buy the ${lc(s.name)} and put it on${r.old ? `, and leave your old ${r.old.toLowerCase()} in the bin out front` : ''}.`;
    } else {
      const brand = s.id === 'cigs' ? ['Red Crest', 'Mayfair Lights', 'Dakota Menthols', 'Ridgeway Reds', 'Union Blues', 'Harbor 100s'][Math.floor(Math.random() * 6)] : undefined;
      if (!stow(inv, { kind: 'misc', name: s.name, ...(brand ? { detail: brand } : {}), ...(s.drinkType ? { drink: s.drinkType } : {}), ...(s.doses ? { doses: s.doses } : s.id === 'lighter' ? { doses: 100 } : {}) })) {
        this.note([`Nowhere to put it. ${noRoomWhy(inv, 'small')}`]);
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
    if (Math.random() < (place === 'pawn' ? 0.2 : 0.25)) {
      // It isn't you, and they can tell.
      const line = place === 'pawn' ? `He looks at the ${lc(id.name)}, then at you, then at it again. "That's not you." He slides it back. "Get out of my shop."` : `The clerk looks at the photo, then at you. "Nice try." They keep the bottle.`;
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
      stitches: h.bleeding > 0 || !!h.marks?.brow || !!h.marks?.lip,
      nose: h.broken.includes('nose') && (h.mending.nose ?? 0) > 6,
      cast: limbs,
      lung: !!h.lung,
      blood: h.blood < h.maxBlood * 0.8,
    };
  }
  /** Seen once this visit: the wait in the waiting room is over. */
  private erSeen = false;

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
    const need = this.erNeeds();
    const price = ER_PRICES[what] * (what === 'cast' ? Math.max(1, need.cast.length) : 1);
    const can = what === 'cast' ? need.cast.length > 0 : need[what];
    if (!can || cashOf(inv) * 100 < price * 100) return;
    const lines: string[] = [];
    if (!this.erSeen) {
      const urgent = h.bleeding >= 3 || h.lung;
      if (urgent) lines.push('One look at you and triage takes you straight through, past everyone waiting.');
      else {
        const wait = 2 + Math.floor(Math.random() * 3);
        lines.push(`You wait. ${wait} hours of plastic chairs, a TV nobody's watching, and a vending machine that eats your change.`);
        lines.push(...passHours(h, wait, true));
        if (h.dead) return this.die(lines, 'You died in the waiting room.');
      }
      this.erSeen = true;
      // By the time they call your name, it may not need doing.
      const now_ = this.erNeeds();
      if (what === 'cast' ? !now_.cast.length : !now_[what]) {
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
        if (h.marks?.lip) (h.markHours ??= {}).lip = Math.min(h.markHours.lip ?? 24, 12);
        lines.push(was ? 'A tired resident cleans you up, numbs it and sews you shut. The bleeding stops.' : 'They clean the cut out, glue it and tape it. It stings like hell.');
        if (h.marks?.brow) lines.push('Stitched, the cut over your eye will still scar, but less.');
        break;
      }
      case 'nose':
        h.mending.nose = Math.ceil((h.mending.nose ?? 8) / 2);
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
        lines.push('They numb your side and push a tube in between your ribs. Air hisses out, and you can breathe again. An hour on a gurney, then they let you go.');
        lines.push(...passHours(h, 1, true));
        break;
      case 'blood':
        h.blood = Math.max(h.blood, Math.round(h.maxBlood * 0.92));
        lines.push('Two bags of someone else’s blood, an hour on a drip. Colour comes back into your hands.');
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
    this.refresh();
    this.note([`An hour of waiting, a photo where you look like a suspect, and a card still warm from the printer: ${me.name}.`, paid]);
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
        const want = Number(what.slice(2));
        const have = Math.round(cashOf(inv) * 100);
        if (want > have) {
          this.note([`You've only got ${money(have)} on you.`]);
          return;
        }
        // The teller takes it in whatever you've got, and gives you change.
        const paid = this.payLine(want);
        acct.cents += want;
        line = `${paid.replace(/\s\S+ left\.$/, '')} The teller puts ${money(want)} in your account. Balance: ${money(acct.cents)}.`;
      } else {
        const want = what === 'w:all' ? acct.cents : Number(what.slice(2));
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
    const wet = RAIN_AMOUNT[this.weather.now] > 0 && !placeInfo(this.place).indoors;
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
    // A cigarette takes about six minutes to smoke, for real.
    h.smokingUntil = now() + SMOKE_MS;
    const lines = [
      RAIN_AMOUNT[this.weather.now] > 0 && !placeInfo(this.place).indoors
        ? 'You hunch over a cigarette, cupping it from the rain, and get it lit on the third try.'
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
    if (it.drink === 'energy') {
      // Caffeine, not alcohol: nothing now, sharper in half an hour, for hours.
      inv.items.splice(i, 1);
      addCaffeine(h, 160);
      const mg = caffeineNow(h, now() + 45 * 60_000);
      this.closeSheet();
      this.refresh();
      this.note([
        'You crack the can and drink it down. Sickly sweet, and fizzing.',
        mg >= 600 ? "That's a lot of caffeine in you. Your heart's going to be pounding." : mg >= 400 ? 'Your hands are going to shake.' : 'In half an hour you’ll be sharp.',
        'You crush the can and drop it.',
      ]);
      buzz(6);
      return;
    }
    soberUp(h);
    const was = drunkLevel(h.drunk ?? 0);
    const beer = it.drink === 'beer';
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
      if (this.encounter?.stage === 'seen') this.encounter = null;
      this.wipeBlood();
      lines.push(...passHours(h, 3));
      if (h.dead) return this.die(lines);
      if (h.wired) {
        h.wired = false;
        delete h.wiredBy;
        lines.push('Whatever you took wore off while you were gone.');
      }
      h.drunk = 40;
      h.drunkAt = now();
      lines.push('You come round in a doorway, hours later, with your mouth tasting of sick.');
    } else if (h.drunk >= 78 && h.drunk < 90) lines.push("The street spins. One more and you'll black out.");
    else if (now_ > was) lines.push(['', "You're tipsy. Everything's a bit funnier.", "You're drunk. The street sways when you turn your head.", "You're wasted. Your feet aren't where you left them.", "You're blackout drunk. One more and you're gone."][now_]);
    this.closeSheet();
    this.refresh();
    this.note(lines);
    buzz(6);
  }

  /** Put loose cigarettes into a pack (the fullest one with room: up to 20). */
  private packLoose(i: number) {
    const inv = this.inventory;
    const loose = inv.items[i];
    if (!loose || !/^loose cigarettes$/i.test(loose.name)) return;
    const pack = inv.items.filter((y) => /^cigarettes$/i.test(y.name) && (y.doses ?? 0) < 20).sort((a, b) => (b.doses ?? 0) - (a.doses ?? 0))[0];
    if (!pack) return;
    const n = Math.min(loose.doses ?? 1, 20 - (pack.doses ?? 0));
    pack.doses = (pack.doses ?? 0) + n;
    loose.doses = (loose.doses ?? 1) - n;
    if (loose.doses <= 0) inv.items.splice(inv.items.indexOf(loose), 1);
    this.refresh();
    this.note([`You slide ${n === 1 ? 'the cigarette' : `${n} cigarettes`} into the pack. ${pack.doses} in it now.`]);
    buzz(5);
  }

  /** Smoking now (a cigarette that hasn't burned down yet). */
  get smoking(): boolean {
    const h = this.health;
    // A clock that was set ahead, then put right: a cigarette lasts six minutes at most.
    if ((h.smokingUntil ?? 0) > now() + SMOKE_MS) h.smokingUntil = now() + SMOKE_MS;
    return (h.smokingUntil ?? 0) > now();
  }

  /** Why you can't light a cigarette now, or null. */
  private smokeBlocked(): string | null {
    if (!this.flame()) return 'Nothing to light it';
    if (placeInfo(this.place).indoors) return 'No smoking in here';
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
    const info = placeInfo(this.place);
    if (this.place === 'street' || !this.tvState.on) return;
    if ((this.exposure += dt) < 120) return;
    this.exposure = 0;
    if (info.indoors && h.cold) {
      h.cold--;
      this.note([h.cold ? 'The warmth is getting into you. You thaw out a little.' : "You've warmed up. You stop shivering."]);
      this.refresh();
    } else if (!info.indoors) {
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
  private police(choice: 'run' | 'stay') {
    const inv = this.inventory;
    const h = this.health;
    const f = this.infamy;
    const w = wearing(inv);
    this.sheet = null;
    this.sheetEl.hidden = true;
    delete this.save.state.policeStop;
    const lines: string[] = [];
    let arrested = false;
    if (choice === 'run') {
      const legs = h.broken.filter((p) => p.endsWith('leg')).length;
      const odds = 0.35 + accuracyBonus(this.stats) - legs * 0.3 - (h.cold ?? 0) * 0.05 - (h.stress ?? 0) * 0.002 - (h.blood < h.maxBlood * 0.75 ? 0.15 : 0);
      if (Math.random() < odds) {
        lines.push('You bolt. Shouts behind you, a car door, footsteps. You go over a fence and through a yard and down an alley, and when you stop, they\'re gone.');
        f.heat = Math.min(100, f.heat + 10);
      } else {
        lines.push('You bolt, and get about ten yards. One of them takes your legs out and you hit the pavement face first. A knee in your back, your arms wrenched behind you.');
        h.blood = Math.min(h.blood, Math.max(h.maxBlood * 0.6, h.blood - 350));
        h.stress = Math.min(100, (h.stress ?? 0) + 25);
        this.fx.impact(true, 350, true, 'spatter');
        arrested = true;
      }
    } else {
      if (w.masked) {
        w.masked = false;
        lines.push(`You pull the ${w.face!.toLowerCase()} down.`);
      }
      // Do you look like who they're after?
      const looks = Math.random() < (f.heat / 100) * (1 - anonymity(inv) * 0.5);
      lines.push('They pat you down and go through your pockets.');
      // Weapons get taken off you, and they remember it. (A loaded syringe is evidence instead.)
      const blades = inv.items.filter((x) => x.kind === 'weapon' && !(x.secret && x.secret !== 'empty'));
      if (blades.length) {
        inv.items = inv.items.filter((x) => !blades.includes(x));
        f.heat = Math.min(100, f.heat + 6);
        lines.push(`They find ${list2(blades.map((x) => `the ${lc(x.name)}`))} and take ${blades.length > 1 ? 'them' : 'it'}. "What's this for, then?"`);
      }
      const evidence = inv.items.filter((x) => (x.kind === 'id' && x.own !== this.world.lives) || x.kind === 'credit card' || x.kind === 'debit card' || (x.secret && x.secret !== 'empty'));
      if (evidence.length) {
        lines.push(`They find ${evidence.length === 1 ? `the ${lc(evidence[0].name)}` : `${evidence.length} things that aren't yours`}. "Whose is this?"`);
        arrested = true;
      } else if (looks) {
        lines.push('One of them looks at you a long time, then at his phone. "That\'s the one." The cuffs go on.');
        arrested = true;
      } else {
        lines.push('They find nothing. "Stay out of trouble." They get back in the car and roll away.');
        f.heat = Math.max(0, f.heat - 5);
      }
    }
    if (arrested) {
      // Whatever's stolen is taken; a night in a cell.
      const before = inv.items.length;
      inv.items = inv.items.filter((x) => !((x.kind === 'id' && x.own !== this.world.lives) || x.kind === 'credit card' || x.kind === 'debit card' || x.kind === 'weapon' || (x.secret && x.secret !== 'empty')));
      const took = before - inv.items.length;
      lines.push(`You're arrested.${took ? ` They keep ${took === 1 ? 'the evidence' : `all ${took} things that weren't yours`}.` : ''} You spend the night in a holding cell that smells of bleach and piss.${took ? ' In the morning they charge you and let you go with a court date and a sheet of paper you lose by noon.' : ' In the morning they let you go: not enough to charge you. This time.'}`);
      lines.push(...passHours(h, 8, true));
      if (h.dead) return this.die(lines);
      f.heat = Math.max(0, f.heat - 45);
      f.rep += 5;
      h.stress = Math.min(100, (h.stress ?? 0) + 15);
    }
    this.refresh();
    this.note(lines);
    buzz(arrested ? [80, 60, 120] : 12);
  }

  /** Pull your mask or hood up or down. */
  private toggleCover(what: 'mask' | 'hood') {
    const inv = this.inventory;
    const w = wearing(inv);
    if (what === 'mask' && w.face) {
      if (!w.masked && placeInfo(this.place).indoors) {
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
    if (placeInfo(this.place).indoors) return 'Not in here';
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
    const tries = { clear: 0, drizzle: 0.15, rain: 0.35, downpour: 0.6 }[this.weather.now];
    if (Math.random() < tries) {
      lines.push(`You crouch in a doorway and try to burn the ${lc(it.name)}, but the rain keeps killing the flame.`);
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
      kindling = lc(inv.items[paper].name);
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
    const od = (chance: number, deadly: number): boolean => {
      if (Math.random() >= chance) return false;
      if (Math.random() < deadly) {
        lines.push('Your breathing slows. Slower. Then it stops, and nobody comes.');
        this.die(lines, 'You overdosed.');
        return true;
      }
      lines.push('Your breathing slows to almost nothing, and the world goes out.');
      lines.push(...passHours(h, 4));
      if (h.dead) {
        this.die(lines);
        return true;
      }
      lines.push('You come round on the pavement hours later, soaked and shaking, sick to your stomach. You nearly died.');
      return true;
    };
    if (drug === 'heroin') {
      lines.push('Warmth floods up your arm and all through you. The stress melts away. Your eyelids are heavy.');
      h.stress = 0;
      h.high = 'heroin';
      h.highUntil = now() + HIGH_HOURS.heroin * 3_600_000;
      if (od(0.05, 0)) {
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
  private bump(i: number) {
    const inv = this.inventory;
    const it = inv.items[i];
    const h = this.health;
    if (it?.secret !== 'cocaine' || !it.known || h.wired) return;
    it.doses = (it.doses ?? 1) - 1;
    h.wired = true;
    h.wiredBy = 'coke';
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
    this.note([`You drop the ${lc(it.name)}.`]);
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
    } else if (place === 'hospital') {
      const need = this.erNeeds();
      const row = (care: ErCare, name: string, what: string, needed: boolean, n = 1) =>
        li(name, what, btn('er', care, money(ER_PRICES[care] * n * 100), (!needed && 'Nothing to treat') || (c < ER_PRICES[care] * n * 100 && 'Not enough cash')));
      body =
        `<ul class="shop-list">` +
        row('stitches', 'Stitches', 'Close a cut and stop the bleeding.', need.stitches) +
        row('nose', 'Set your nose', 'Straightened, it heals in half the time.', need.nose) +
        row('cast', need.cast.length > 1 ? `Casts (${need.cast.length})` : 'A cast', need.cast.length ? `Set the ${need.cast.join(' and ')}: heals in half the time.` : 'For a broken arm or leg.', need.cast.length > 0, Math.max(1, need.cast.length)) +
        row('lung', 'Chest tube', 'For a punctured lung: breathe again.', need.lung) +
        row('blood', 'Blood', 'A transfusion, when you’ve lost too much.', need.blood) +
        `</ul>` +
        `<p class="shop-broke">${this.erSeen ? 'You’ve been seen. They’ll fit you in.' : 'First you wait, unless you’re bleeding badly or can’t breathe.'} Self-pay, cash at the window. They can’t do anything for ribs or a concussion but tell you to rest.</p>`;
    } else if (place === 'records') {
      const mine = this.ownId();
      body = open
        ? `<ul class="shop-list">${li('State ID', mine ? `You have one: ${mine.detail}.` : `Your name, your photo, your address (more or less). ${money(ID_FEE * 100)}.`, btn('records', 'id', money(ID_FEE * 100), (mine && 'You have one') || (c < ID_FEE * 100 && 'Not enough cash')))}</ul>` +
          `<p class="shop-broke">With your own ID you can open a bank account, sell to and buy from the pawn shop, and buy drink, without anyone looking at you twice.</p>`
        : `<p class="shop-closed">The doors are locked. Open weekdays, 9 to 4.</p>`;
    } else if (place === 'liquor') {
      body = open
        ? `<ul class="shop-list">${LIQUOR_STOCK.map((s) => li(s.name, s.desc, btn('stock', s.id, money(s.price * 100), c < s.price * 100 && 'Not enough cash'))).join('')}</ul>` +
          `<p class="shop-broke">${this.ownId() ? 'They know your face now.' : 'They’ll want to see ID.'}</p>`
        : `<p class="shop-closed">The grille is down.</p>`;
    } else if (place === 'gas') {
      const have = (name: string) => inv.items.filter((x) => x.name === name).length;
      body =
        `<ul class="shop-list">${GAS_STOCK.map((s) => {
          const n = s.med ? inv.items.filter((x) => x.med === s.med).length : s.slot || s.drink ? 0 : have(s.name);
          return li(s.name, `${s.desc}${n ? ` · You have ${n}` : ''}`, btn('stock', s.id, money(s.price * 100), c < s.price * 100 && 'Not enough cash'));
        }).join('')}</ul>` + (c < 100 ? `<p class="shop-broke">You can't afford anything. The clerk watches you anyway.</p>` : '');
    } else if (place === 'pawn' || place === 'fence') {
      if (!open) body = `<p class="shop-closed">${place === 'pawn' ? 'The shutter is down.' : "There's nobody back here right now."}</p>`;
      else {
        const sell = inv.items
          .map((x, i) => ({ x, i, o: offer(place, x) }))
          .map(({ x, i, o }) => li(x.name, 'cents' in o ? `${x.detail ? `${x.detail} · ` : ''}He'll give you ${money(o.cents)}` : o.why, 'cents' in o ? btn('sell', i, `Sell ${money(o.cents)}`) : ''));
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
        // Your account (it takes your own ID).
        const acct = this.account;
        const mine = !!this.ownId();
        body +=
          `<h3>Your account</h3><ul class="shop-list">` +
          (!acct
            ? li('Open an account', mine ? 'Free. Keep your money where nobody can take it off you.' : 'You need your own ID: the City Records Office makes them.', btn('bank', 'open', 'Open', !mine && 'Need your own ID'))
            : li(`Balance: ${money(acct.cents)}`, 'Deposit what you carry; take some out when you need it.', btn('bank', 'deposit', 'Deposit all', (!c && 'No cash on you') || (!mine && 'Need your own ID'))) +
              `<li class="bank-amt"><div><b>An amount</b><small>Type it in, then deposit it or take it out.</small></div><span class="li-btns"><label class="amt"><span>$</span><input id="bank-amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" aria-label="Amount in dollars"></label>${btn('bank', 'd:amt', 'Deposit', (!c && 'No cash on you') || (!mine && 'Need your ID'))}${btn('bank', 'w:amt', 'Withdraw', (!acct.cents && 'Empty') || (!mine && 'Need your ID'))}</span></li>` +
              li('Withdraw', '$20, $100, or everything.', [2000, 10000].map((v) => btn('bank', `w:${v}`, money(v), (acct.cents < v && 'Not that much') || (!mine && 'Need your ID'))).join('') + btn('bank', 'w:all', 'All', (!acct.cents && 'Empty') || (!mine && 'Need your ID')))) +
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
    }
    const html =
      `<div class="shop-head"><h2>${info.name}</h2><p>${info.blurb}${info.hours ? ` <em>${hoursText(info.hours)}.</em>` : ''}</p></div>` +
      this.noteHtml(this.shopNote, 'shop-note') +
      `<p class="pocket-purse">${this.purseHtml()}</p>` +
      `<div class="shop-body">${body}</div>`;
    // Only when something changed, and keep your place in the list (buying
    // something used to jump you back to the top).
    if (html !== this.shopHtml) {
      this.shopHtml = html;
      const scroll = this.shopEl.scrollTop;
      this.shopEl.innerHTML = html;
      this.shopEl.scrollTop = scroll;
    }
    // More than fits: a fade at the bottom says scroll.
    requestAnimationFrame(() => this.shopEl.classList.toggle('more', this.shopEl.scrollTop + this.shopEl.clientHeight < this.shopEl.scrollHeight - 6));
  }
  private shopHtml = '';
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
    if (this.sheet === 'police') {
      const masked = wearing(this.inventory).masked;
      card.innerHTML =
        `<div class="sheet-head"><h2>Police</h2></div><div class="sheet-body police">` +
        `<p>A patrol car pulls up beside you, lights off. Two of them get out. One has a hand on his belt.</p>` +
        `<p>"${masked ? 'Take that off your face. ' : ''}Hold up. Where are you headed ${partOfDay() === 'night' || partOfDay() === 'dusk' ? 'tonight' : 'today'}?"</p>` +
        `<button type="button" class="place" data-police="stay"><b>Stay calm</b><small>Let them talk. They'll want to search you.</small></button>` +
        `<button type="button" class="place" data-police="run"><b>Run</b><small>Agility, and your legs. If they catch you, it'll hurt.</small></button>` +
        `</div>`;
      return;
    }
    if (this.sheet === 'stats') {
      const h = this.health;
      const summary = `<p class="you-summary"><span>Blood <b>${(h.blood / 1000).toFixed(1)} L</b></span><span>Cash <b>${money(Math.round(cashOf(this.inventory) * 100))}</b></span><span>Character <b>#${this.world.lives}</b></span></p>`;
      card.innerHTML = `<div class="sheet-head"><h2>You</h2>${close}</div><div class="sheet-body">${this.noteHtml(this.sheetNote, 'sheet-note')}${summary}${this.statsHtml()}</div>`;
      return;
    }
    if (this.sheet === 'places') {
      card.innerHTML =
        `<div class="sheet-head"><h2>Where to?</h2>${close}</div><div class="sheet-body places">` +
        PLACES.map(
          (p) =>
            `<button type="button" class="place ${p.id === this.place ? 'here' : ''}" data-place="${p.id}"><b>${p.name}</b><small>${p.id === this.place ? "You're here" : p.desc}${p.hours && p.id !== this.place ? `<i class="${isOpen(p.hours) ? 'open' : 'shut'}">${hoursText(p.hours)}</i>` : ''}</small></button>`,
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
      `<p class="pocket-wear">Wearing ${inv.clothes.map((c) => c.toLowerCase()).join(', ')}. Carrying ${kgLabel(total + purseKg(inv))}.</p>`;
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
        `<div class="spot"><h3><span>${sp.on} · ${sp.name}</span><em>${sp.fits}</em></h3>` +
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
                    : x.kind === 'weapon' && /syringe/i.test(x.name)
                      ? `${x.detail ?? 'A syringe'} · +${x.weapon ?? 0} damage, cuts`
                    : /^cigarettes$/i.test(x.name)
                      ? x.doses
                        ? `A pack${x.detail ? ` of ${x.detail}` : ''}, ${x.doses} left`
                        : `An empty pack${x.detail ? ` of ${x.detail}` : ''}`
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
                            : /card/.test(x.kind) && (x.pin || x.drained)
                            ? `${x.detail ? `${x.detail} · ` : ''}${x.drained ? 'Stopped' : `PIN ${x.pin} (cash machine at the bank)`}`
                            : x.detail;
                const act = (attr: string, label: string, no?: string | null) => `<button type="button" data-${attr}="${i}" ${no ? `disabled title="${no}"` : ''}>${label}${no ? `<small>${no}</small>` : ''}</button>`;
                let acts = m && m.id !== 'testkit' ? act('use', 'Use', why) : '';
                if (/^(lighter|matches)$/i.test(x.name)) acts += act('fire', 'Fire', this.fireBlocked());
                if (/^(loose )?cigarettes$/i.test(x.name)) acts += act('smoke', this.smoking ? 'Smoking' : 'Smoke', (x.doses ?? 1) <= 0 ? 'Empty' : this.smokeBlocked());
                if (x.drink) acts += act('drink', 'Drink', (x.doses ?? 0) <= 0 ? 'Empty' : this.canOpenSheet ? null : 'Not now');
                // Loose ones into a pack with room in it.
                if (/^loose cigarettes$/i.test(x.name) && inv.items.some((y) => /^cigarettes$/i.test(y.name) && (y.doses ?? 0) < 20))
                  acts += act('pack', 'Put in pack');
                if (x.kind === 'id' || x.kind === 'credit card' || x.kind === 'debit card') acts += act('burn', 'Burn', this.burnBlocked());
                if (x.secret && x.secret !== 'cocaine' && x.secret !== 'empty') {
                  if (!x.known && inv.items.some((y) => y.med === 'testkit')) acts += act('test', 'Test');
                  acts += act('inject', x.known ? 'Inject' : 'Inject?', this.injectBlocked());
                } else if (x.secret && !x.known) {
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
    // Keep your place in the list when it's redrawn.
    const scroll = card.querySelector('.sheet-body')?.scrollTop ?? 0;
    card.innerHTML = `<div class="sheet-head"><h2>Pockets</h2>${close}</div><div class="sheet-body">${this.noteHtml(this.sheetNote, 'sheet-note')}${body}</div>`;
    card.querySelector('.sheet-body')!.scrollTop = scroll;
  }

  /** What the encounter needs to know about you to offer its options (see Encounter.flame). */
  private prime(e: Encounter) {
    const inv = this.inventory;
    e.flame = !!this.flame();
    e.cardsHeld = e.holder
      ? inv.items.map((x, i) => ({ x, i })).filter(({ x }) => /card/.test(x.kind) && x.detail === e.holder && !x.pin).map(({ x, i }) => ({ i, name: x.name }))
      : [];
    e.canAsk = this.world.thieves.length > 0 && !e.person.thief;
    e.weapons = inv.items.map((x, i) => ({ x, i })).filter(({ x }) => x.kind === 'weapon').map(({ x, i }) => ({ i, name: x.name, weapon: x.weapon, cuts: x.cuts, spray: x.spray, doses: x.doses, loaded: x.secret && x.secret !== 'empty' && x.secret !== 'cocaine' ? x.secret : undefined, known: x.known }));
    e.wet = RAIN_AMOUNT[this.weather.now] > 0 && !placeInfo(this.place).indoors;
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
        ['Noticed while following', `${pct(noticeRate(st))} as quickly`],
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
    };
    const how: Record<StatName, string> = {
      sneak: 'Surveilling, and ambushes (bum rush, sucker punch, shove).',
      strength: 'Landing blows (slowly).',
      unarmed: 'Landing blows, ambushes and techniques. Each new level can teach you a new move.',
      agility: 'Landing blows, and dodging theirs.',
      stamina: 'Fighting yourself to exhaustion.',
      weapons: 'Using a weapon in a fight (and pepper spray). Take them off the people who carry them.',
      intimidation: 'Mugging, threatening, making people give up, and torture. Scared people hand it over, tell the truth, and give up mid-fight.',
    };
    const rows = (xs: [string, string][]) => xs.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    // What's wrong with you comes first: each injury and what it's doing to you.
    const hurts = injuryEffects(this.health);
    let html = hurts.length
      ? `<section class="stat-card injuries"><h3><span>Condition</span><b>${hurts.length}</b></h3>` +
        hurts
          .map((i) => `<div class="injury"><h4>${i.name}</h4><ul>${i.effects.map((x) => `<li>${x}</li>`).join('')}</ul><p class="stat-how">${i.heals}</p></div>`)
          .join('') +
        `</section>`
      : '';
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
    if (this.inventory.items.some(isBlade)) rows.push(['Fear, when you show them your blade', '+10']);
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
      ['People who remember you', `${this.people.length}`],
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
        const thief = maybeThief(this.world);
        const known = thief ? (thief.known ? (this.people.find((k) => k.id === thief.known) ?? null) : null) : comeBack(this.people);
        const person = thief ?? (known ? meet(known) : makePerson());
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
          e.grudge = known.memory.grudge;
          e.history = historyText(known);
          e.looks = [...injuriesText(known), ...marksText(known.marks)];
          e.dread = known.memory.fear ?? 0;
        } else if (Math.random() < Math.min(0.5, this.infamy.rep / 200) * (1 - anon)) {
          // A stranger who's heard about you, and knows your face.
          e.recognised = true;
          e.grudge = 0;
          e.history = "You've never met. But they know your face: people talk.";
        }
        // How they were when it began (to tell, later, what you did this time).
        e.start = { blood: e.them.blood, broken: [...e.them.broken] };
        this.encounter = e;
        // The ones who hate you most come looking: they find you first.
        if (known && e.recognised && (e.grudge ?? 0) >= 70 && (e.dread ?? 0) < 60 && !known.broken.some((p) => p.endsWith('leg')) && Math.random() < 0.5) {
          // Through the normal path, so a fight that ends at once is dealt with properly.
          this.phase = 'idle';
          this.act('ambushed');
          buzz([60, 40, 90]);
          return;
        }
        this.phase = 'idle';
        // Whoever it is takes the middle of the screen: the note goes.
        this.noteEl.hidden = true;
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
    // Stopped by the police when the game was saved: they're still there.
    if (this.save.state.policeStop && this.tvState.on) this.openSheet('police');
  }

  turnOn() {
    if (this.tvState.on || !this.running) return;
    this.powerBtn.classList.add('pressed');
    this.tvState.on = true;
    // iPhones only let a page feel the phone move once asked, from a tap.
    const DM = (globalThis as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    DM?.requestPermission?.().catch(() => {});
    // Coming round after a knockout: what happened, once the picture's back.
    const woke = this.koLines;
    this.koLines = null;
    this.view.classList.remove('ko-out');
    if (woke) this.timers.push(window.setTimeout(() => this.running && this.note(woke), 2900));
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
    this.running = true;
  }

  /** Closes the game view (back to the menu). */
  close() {
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
    if (this.running) {
      this.tickSmoke(dt);
      this.tickExposure(dt);
    }
    if ((this.weatherTimer -= dt) <= 0) {
      this.weatherTimer = 2;
      const was = this.weather.now;
      if (updateWeather(this.weather) && this.running && this.tvState.on && this.weather.now !== was && !placeInfo(this.place).indoors) {
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
    if (this.noteTimer > 0 && (this.noteTimer -= dt) <= 0) this.noteEl.hidden = true;
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
    } else {
      if (this.bleedClock < 0.5) this.fx.resetBleedTop();
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

/** A knife or a box cutter (a bottle or a needle doesn't frighten like a blade). */
function isBlade(x: { kind: string; name: string }): boolean {
  return x.kind === 'weapon' && /knife|box cutter/i.test(x.name);
}
