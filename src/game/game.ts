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
import { maybeThief, newWorld, robBody, settle, type World } from './legacy';
import { MEDS, dollars, medById, newInventory, type Inventory, type InvItem, type MedId } from './inventory';

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

/** Where you can go from the Go menu. */
type Place = 'street' | 'pharmacy';
const PLACES: { id: Place; name: string; desc: string }[] = [
  { id: 'street', name: 'The street', desc: 'Lurk in the dark and watch who comes by.' },
  { id: 'pharmacy', name: 'Pharmacy', desc: 'Open all night. Bandages, painkillers, splints.' },
];
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
    this.goBtn = view.querySelector('#go-btn') as HTMLButtonElement;
    this.bagBtn = view.querySelector('#bag-btn') as HTMLButtonElement;
    this.shopEl = view.querySelector('#shop') as HTMLElement;
    this.sheetEl = view.querySelector('#sheet') as HTMLElement;
    this.goBtn.onclick = () => this.openSheet('places');
    this.bagBtn.onclick = () => this.openSheet('pockets');
    this.sheetEl.onclick = (ev) => this.sheetClick(ev);
    this.shopEl.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest('button');
      if (b?.dataset.buy) this.buy(b.dataset.buy as MedId);
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
    return (this.save.state.inventory ??= newInventory()) as Inventory;
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
    const lines = ['You find somewhere quiet and rest for a few hours.', ...passHours(this.health, REST_HOURS, true)];
    if (this.health.dead) return this.die(lines);
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
    // Time passes while you wait: wounds bleed, or heal.
    const lines = passHours(this.health, LURK_HOURS);
    if (this.health.dead) return this.die(lines);
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
    const cash = this.inventory.cash;
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
      `<div><dt>Cash</dt><dd>${dollars(cash)}</dd></div>` +
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

  private openSheet(kind: 'places' | 'pockets') {
    if (!this.canOpenSheet) return;
    this.sheet = kind;
    this.renderSheet();
    this.sheetEl.hidden = false;
    buzz(6);
  }

  private closeSheet() {
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
    else if (b.dataset.use) this.useMed(b.dataset.use as MedId);
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
    this.note([p === 'pharmacy' ? 'You walk to the all-night pharmacy.' : 'You head back out into the street.']);
    buzz(10);
  }

  /** Buy something at the pharmacy (cash only). */
  private buy(id: MedId) {
    const m = medById(id);
    const inv = this.inventory;
    if (this.place !== 'pharmacy' || inv.cash < m.price) return;
    inv.cash = Math.round((inv.cash - m.price) * 100) / 100;
    inv.items.push({ kind: 'med', name: m.name, med: id });
    this.refresh();
    this.note([`You buy ${m.name.toLowerCase()}. ${dollars(inv.cash)} left.`]);
    buzz(8);
  }

  /** Use medicine from your pockets. */
  private useMed(id: MedId) {
    const m = medById(id);
    const inv = this.inventory;
    const i = inv.items.findIndex((x) => x.med === id);
    if (i < 0 || m.blocked(this.health)) return;
    inv.items.splice(i, 1);
    const line = m.use(this.health);
    this.refresh();
    this.note([line]);
    buzz(8);
  }

  private renderShop() {
    const here = this.place === 'pharmacy' && this.tvState.on;
    this.shopEl.hidden = !here;
    if (!here) return;
    const inv = this.inventory;
    const have = (id: MedId) => inv.items.filter((x) => x.med === id).length;
    this.shopEl.innerHTML =
      `<div class="shop-head"><h2>Pharmacy</h2><p>Open all night. A fluorescent hum, and a bored clerk behind the plexiglass.</p></div>` +
      `<div class="shop-cash"><span>Your cash</span><b>${dollars(inv.cash)}</b></div>` +
      `<ul class="shop-list">${MEDS.map(
        (m) =>
          `<li><div><b>${m.name}</b><small>${m.desc}${have(m.id) ? ` · You have ${have(m.id)}` : ''}</small></div>` +
          `<button type="button" data-buy="${m.id}" ${inv.cash < m.price ? 'disabled' : ''}>${dollars(m.price)}</button></li>`,
      ).join('')}</ul>` +
      (inv.cash < Math.min(...MEDS.map((m) => m.price)) ? `<p class="shop-broke">You can't afford anything. Cash only.</p>` : '');
  }

  private renderSheet() {
    const card = this.sheetEl.firstElementChild as HTMLElement;
    const close = `<button type="button" class="sheet-x" data-close aria-label="Close">×</button>`;
    if (this.sheet === 'places') {
      card.innerHTML =
        `<div class="sheet-head"><h2>Where to?</h2>${close}</div>` +
        PLACES.map(
          (p) =>
            `<button type="button" class="place ${p.id === this.place ? 'here' : ''}" data-place="${p.id}"><b>${p.name}</b><small>${p.id === this.place ? "You're here" : p.desc}</small></button>`,
        ).join('');
      return;
    }
    const inv = this.inventory;
    const h = this.health;
    const groups: [string, (x: InvItem) => boolean][] = [
      ['Phones', (x) => x.kind === 'phone'],
      ['Car keys', (x) => x.kind === 'car keys'],
      ['IDs and cards', (x) => x.kind === 'id' || x.kind === 'credit card' || x.kind === 'debit card'],
      ['Other', (x) => x.kind === 'misc'],
    ];
    const meds = MEDS.map((m) => ({ m, n: inv.items.filter((x) => x.med === m.id).length })).filter((x) => x.n);
    let body = `<div class="pocket-cash"><span>Cash</span><b>${dollars(inv.cash)}</b></div>`;
    if (meds.length) {
      body +=
        `<h3>Medicine</h3><ul class="pocket-list">` +
        meds
          .map(({ m, n }) => {
            const why = m.blocked(h);
            return `<li><div><b>${m.name}${n > 1 ? ` ×${n}` : ''}</b><small>${why ?? m.desc}</small></div><button type="button" data-use="${m.id}" ${why ? 'disabled' : ''}>Use</button></li>`;
          })
          .join('') +
        `</ul>`;
    }
    for (const [name, test] of groups) {
      const xs = inv.items.filter(test);
      if (!xs.length) continue;
      body += `<h3>${name}</h3><ul class="pocket-list">${xs.map((x) => `<li><div><b>${x.name}</b>${x.detail ? `<small>${x.detail}</small>` : ''}</div></li>`).join('')}</ul>`;
    }
    if (!inv.items.length && !inv.cash) body += `<p class="pocket-empty">Nothing but lint.</p>`;
    card.innerHTML = `<div class="sheet-head"><h2>Pockets</h2>${close}</div><div class="sheet-body">${body}</div>`;
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
      `<div class="you-cash">${dollars(this.inventory.cash)}</div>` +
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
    const idle = this.idle;
    if (this.goBtn.hidden === idle) this.goBtn.hidden = !idle;
    if (this.bagBtn.hidden === idle) this.bagBtn.hidden = !idle;
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
    return { world: this.world, tv: this.tv, phase: this.phase, lurk: this.lurkState, encounter: this.encounter, stats: this.stats, health: this.health, inventory: this.inventory, place: this.place, humanity: this.humanity };
  }
}

function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not allowed */
  }
}
