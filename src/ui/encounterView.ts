import { glyphSvg } from '../game/lootIcon';
import { uiGlitch } from '../fx/uiGlitch';
import { BUILDS, NAMES, personalityOf } from '../game/person';
import { CATEGORY_NAMES, FEAR_NAMES, PASS_OUT, conditions, fearLevel, distanceLabel, options, type Body, type Category, type Encounter, type Option } from '../game/encounter';

const STAGE_TITLE: Record<string, string> = {
  menu: 'What now?',
  surveil: 'What now?',
  violence: 'What now?',
  combat: 'Fight',
  helpless: "They’re out cold",
  yielded: 'They gave up',
  down: "They’re down",
  youDown: "You’re on the floor",
};
/** The tabs always in the same order, whatever the moment (so a thumb learns where they are). */
const TAB_ORDER: Category[] = ['surveil', 'talk', 'violence', 'attack', 'stomp', 'torture', 'search', 'threaten', 'move'];

export const RESULT: Record<string, string> = {
  won: "They’re down.",
  lost: 'You were beaten.',
  'they-fled': 'They got away.',
  'you-fled': 'You got away.',
  'lost-them': 'You lost them.',
  sold: 'You made a sale.',
  left: 'You let them go.',
  walked: 'You walked away.',
  killed: "They’re dead.",
  mugged: 'You mugged them.',
};

/**
 * The encounter screen: who they are and what you know about them, a log of
 * everything that happens to them and to you, and the options you have.
 */
export function createEncounterView(root: HTMLElement, onAct: (id: string) => void) {
  root.innerHTML = `
    <div class="enc-card">
      <div class="enc-who"><span class="enc-kind"></span><span class="enc-race"></span></div>
      <div class="enc-history" hidden></div>
      <dl class="enc-facts"></dl>
    </div>
    <div class="enc-status"></div>
    <div class="enc-log" role="log" aria-live="polite"></div>
    <div class="enc-actions">
      <div class="enc-title"></div>
      <div class="enc-tabs" role="tablist"></div>
      <div class="enc-opts" role="tabpanel"></div>
      <div class="enc-opts enc-extra"></div>
    </div>`;
  const q = (s: string) => root.querySelector(s) as HTMLElement;
  const log = q('.enc-log');
  let shown = 0;
  let current: Encounter | null = null;

  /** The tab showing, and the tabs there were last time (to notice new ones). */
  let tab: Category | null = null;
  let tabsKey = '';
  let opts: Option[] = [];

  // In a fight the card folds to one line; tap it to see what you know.
  q('.enc-card').addEventListener('click', () => root.classList.toggle('facts-open'));
  // In a fight the status shows only the blood bars; tap it for the rest
  // (stamina, fear, conditions). The log shows the last few lines; tap it for
  // everything that's happened.
  q('.enc-status').addEventListener('click', () => {
    if (root.dataset.stage === 'combat' || root.dataset.stage === 'over') root.classList.toggle('status-open');
  });
  log.addEventListener('click', () => {
    root.classList.toggle('log-open');
    markOld();
    log.scrollTop = log.scrollHeight;
  });
  /**
   * Only the latest turn shows (from your last move on, at least the last
   * three lines) until the log is opened; the rest are 'earlier'.
   */
  const KEEP = 3;
  /** Where the latest turn starts. */
  let turnStart: HTMLElement | null = null;
  const markOld = () => {
    const ps = [...log.querySelectorAll<HTMLElement>('p:not(.log-more)')];
    // From the first line the latest move added (or the last three, if more).
    let from = ps.length - KEEP;
    const first = ps.findIndex((p) => p.classList.contains('turn-start'));
    if (first >= 0) from = Math.min(from, first);
    from = Math.max(0, from);
    turnStart = ps[from] ?? null;
    ps.forEach((p, i) => p.classList.toggle('old', i < from));
    let more = log.querySelector<HTMLElement>('.log-more');
    const hidden = from;
    if (!more) {
      more = document.createElement('p');
      more.className = 'log-more';
      log.prepend(more);
    }
    more.hidden = hidden === 0;
    more.textContent = root.classList.contains('log-open') ? 'Tap to show less' : `▴ ${hidden} earlier line${hidden === 1 ? '' : 's'}`;
  };
  /** The newest turn's first line at the top of the box (under the "earlier lines" bar). */
  const pinTurn = () => {
    if (root.classList.contains('log-open') || !turnStart) return;
    const more = log.querySelector<HTMLElement>('.log-more');
    const bar = more && !more.hidden ? more.getBoundingClientRect().height : 0;
    log.scrollTop += turnStart.getBoundingClientRect().top - log.getBoundingClientRect().top - bar - 2;
    // A small box and a long turn: the newest lines matter most, from the
    // start of a line (never one sliced in half at the top).
    const last = log.lastElementChild as HTMLElement | null;
    const below = last ? last.getBoundingClientRect().bottom - log.getBoundingClientRect().bottom : 0;
    if (below > 0 && last) {
      const ps = [...log.querySelectorAll<HTMLElement>('p:not(.log-more):not(.old)')];
      const room = log.clientHeight - bar - 6;
      const top = log.getBoundingClientRect().top;
      const end = last.getBoundingClientRect().bottom;
      // The earliest line from which the rest still fits.
      const from = ps.find((p) => end - p.getBoundingClientRect().top <= room) ?? last;
      log.scrollTop += from.getBoundingClientRect().top - top - bar - 4;
    }
    // (And no line half under the "earlier lines" bar: one cut in two scrolls out of sight.)
    const limit = more && !more.hidden ? more.getBoundingClientRect().bottom : log.getBoundingClientRect().top + parseFloat(getComputedStyle(log).paddingTop || '0');
    for (const p of log.querySelectorAll<HTMLElement>('p:not(.log-more):not(.old)')) {
      const r = p.getBoundingClientRect();
      if (r.bottom <= limit + 1) continue;
      if (r.top < limit - 1) log.scrollTop += r.bottom - limit + 2;
      break;
    }
  };
  // More of the log below what shows: a fade at the bottom.
  const logMore = () => log.classList.toggle('more', log.scrollTop + log.clientHeight < log.scrollHeight - 4);
  log.addEventListener('scroll', logMore);
  // Resized (the status panel opened, another tab): keep the newest turn in view.
  new ResizeObserver(() => {
    pinTurn();
    logMore();
  }).observe(log);
  q('.enc-opts:not(.enc-extra)').addEventListener('scroll', (ev) => {
    const el = ev.currentTarget as HTMLElement;
    el.classList.toggle('more', el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  });

  q('.enc-actions').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.tab) {
      // Switching tabs is instant and costs nothing.
      if (tab !== b.dataset.tab) {
        tab = b.dataset.tab as Category;
        drawOptions(true);
        uiGlitch(q('.enc-opts'), 0.15);
      }
      return;
    }
    onAct(b.dataset.id!);
  });

  /** Violence looks and feels different from everything else. */
  const HARM = new Set(['violence', 'attack', 'stomp', 'torture']);
  const button = (o: Option) =>
    `<button type="button" data-id="${o.id}" ${o.cat && HARM.has(o.cat) ? 'data-tone="harm"' : ''} ${o.tone ? `data-loot="${o.tone}"` : ''} ${o.disabled ? 'disabled' : ''}>${o.icon && o.tone ? glyphSvg(o.icon, o.tone) : ''}${o.label}${o.hint ? `<small>${o.hint}</small>` : ''}</button>`;

  /** The tab bar, the options under the chosen tab, and the ones always shown. */
  /** Which options were showing last time (a new list starts at its top). */
  let shownKey = '';
  function drawOptions(switched = false) {
    const cats = [...new Set(opts.filter((o) => o.cat).map((o) => o.cat!))].sort((a, b) => TAB_ORDER.indexOf(a) - TAB_ORDER.indexOf(b));
    const tabs = q('.enc-tabs');
    // It's over: no tabs and no greyed-out moves, just how it ended and the way on.
    const done = !!current?.finished;
    // Just the one choice of tab: no bar, it's open.
    if (cats.length === 1) tab = cats[0];
    tabs.hidden = cats.length <= 1 || done;
    tabs.innerHTML = cats
      .map((c) => {
        const n = opts.filter((o) => o.cat === c && !o.disabled).length;
        return `<button type="button" role="tab" data-tab="${c}" ${HARM.has(c) ? 'data-tone="harm"' : ''} aria-selected="${c === tab}" class="${c === tab ? 'on' : ''}">${CATEGORY_NAMES[c]}${c === 'search' && n ? `<i>${n}</i>` : ''}</button>`;
      })
      .join('');
    const panel = q('.enc-opts');
    // Loot lists get long: smaller buttons.
    panel.classList.toggle('compact', tab === 'search');
    const shown = done ? [] : tab ? opts.filter((o) => o.cat && o.cat === tab) : [];
    // Sections (Strikes, Weapons, On the ground, Torture) when there's more than
    // one, and they're worth it: a list long enough, or a group with a few moves in it.
    const groups = shown.map((o) => o.group).filter(Boolean);
    const sizes = [...new Set(groups)].map((g) => groups.filter((x) => x === g).length);
    const sections = sizes.length > 1 && (shown.length > 10 || sizes.filter((n) => n >= 2).length >= 2);
    // A long list: two columns, where there's the width.
    panel.classList.toggle('dense', shown.length >= 8);
    let lastGroup: string | undefined;
    panel.innerHTML = tab
      ? shown
          .map((o) => {
            const head = sections && o.group && o.group !== lastGroup ? `<p class="enc-group">${o.group}</p>` : '';
            lastGroup = o.group;
            return head + button(o);
          })
          .join('')
      : cats.length && !done
        ? `<p class="enc-pick">Choose what to do.</p>`
        : '';
    panel.hidden = !panel.innerHTML;
    // (A different list: from its top, not wherever the last one was scrolled to.)
    const key = `${tab}|${shown.map((o) => o.id).join()}`;
    if (key !== shownKey) {
      shownKey = key;
      panel.scrollTop = 0;
    }
    if (switched) {
      panel.classList.remove('swap');
      void panel.offsetWidth;
      panel.classList.add('swap');
    }
    // More than fits: a fade at the bottom says there's more to scroll to.
    requestAnimationFrame(() => panel.classList.toggle('more', panel.scrollHeight > panel.clientHeight + 4 && panel.scrollTop + panel.clientHeight < panel.scrollHeight - 4));
    const extra = q('.enc-extra');
    extra.innerHTML = opts.filter((o) => !o.cat && !(done && o.disabled)).map(button).join('');
    extra.hidden = !extra.innerHTML;
  }

  const bar = (label: string, v: number, max: number, cls: string, value = `${Math.round(v)}/${max}`) =>
    `<div class="enc-bar ${cls}"><span>${label}</span><i><b style="width:${(100 * Math.max(0, v)) / max}%"></b>${
      cls === 'blood' ? `<s style="left:${PASS_OUT * 100}%"></s>` : ''
    }</i><em>${value}</em></div>`;
  const ml = (n: number) => `${(n / 1000).toFixed(1)} L`;
  /** How awake someone is, in words (the bar shows the rest). */
  const awakeWord = (f: Body) => (f.dead ? 'Dead' : f.out ? 'Out cold' : (f.awake ?? 100) > 70 ? 'Clear' : (f.awake ?? 100) > 40 ? 'Rattled' : (f.awake ?? 100) > 15 ? 'Wobbly' : 'Fading');
  /** Awake, blood, stamina, and conditions (standing or on the floor, injuries). */
  const fighter = (name: string, f: Body, cls: string, extra: string[] = []) =>
    `<div class="enc-fighter ${cls}"><div class="enc-name">${name}</div>` +
    bar('Awake', f.dead ? 0 : Math.max(0, f.awake ?? 100), 100, 'awake', awakeWord(f)) +
    bar('Blood', f.blood, f.maxBlood, 'blood', `${ml(f.blood)}<span class="of"> / ${ml(f.maxBlood)}</span>`) +
    bar('Stamina', f.stamina, f.maxStamina, 'stamina') +
    (cls === 'them' && f.fear != null && !f.dead ? bar('Fear', f.fear, 100, 'fear', FEAR_NAMES[fearLevel(f.fear)]) : '') +
    `<div class="enc-conds">${((cs) => (cs.length > 4 ? [...cs.slice(0, 3), `+${cs.length - 3} more`] : cs))([...extra, ...conditions(f)])
      .map((c) => `<span class="${c === 'Standing' ? 'ok' : c === 'On the floor' ? 'floor' : /^Watched/.test(c) ? 'watched' : ''}">${c}</span>`)
      .join('')}</div></div>`;

  return {
    render(e: Encounter | null) {
      if (!e || e.stage === 'seen') {
        root.hidden = true;
        current = e;
        return;
      }
      if (e !== current || e.log.length < shown) {
        log.replaceChildren();
        shown = 0;
        root.classList.remove('log-open', 'status-open');
        if (e !== current) {
          tab = null;
          tabsKey = '';
          root.classList.remove('facts-open');
        }
        current = e;
      }
      // Something new on screen: it glitches in.
      if (root.hidden) uiGlitch(root, 0.4);
      else if (root.dataset.stage !== e.stage) uiGlitch(q('.enc-actions'), 0.15);
      root.hidden = false;
      root.dataset.stage = e.stage;
      // The moment within the fight (so the title can say it, even on a short screen).
      const state =
        e.stage === 'over' ? 'over' : e.stage !== 'combat' ? '' : e.chase ? 'chase' : e.them.out ? 'out' : e.them.yielded ? 'yielded' : e.you.down ? 'you-down' : e.them.down ? 'down' : '';
      if (state) root.dataset.state = state;
      else delete root.dataset.state;
      root.classList.toggle('chasing', !!e.chase);
      const p = e.person;
      q('.enc-kind').textContent = e.resident ? 'Lives here' : (p.title ?? NAMES[p.kind]);
      // Who they are only shows once you've had a look.
      q('.enc-race').textContent = e.known.race ? `${e.known.sex ? `${p.sex === 'Male' ? 'Man' : 'Woman'} · ` : ''}${p.race}` : e.known.sex ? (p.sex === 'Male' ? 'Man' : 'Woman') : '';

      const b = BUILDS[p.build];
      const facts: [string, string | null][] = [
        ['Sex', e.known.sex ? p.sex : null],
        ['Race', e.known.race ? p.race : null],
        ['Build', e.known.build ? `${p.build} · ${b.difficulty}` : null],
        ['Carrying', e.known.carrying ? p.carrying.map((i) => i.name).join(', ') || 'Nothing' : null],
        ['Awareness', e.known.awareness ? p.awareness : null],
        ['Manner', e.known.personality ? personalityOf(p).name : null],
        ['Wearing', (p.clothes ?? []).map((g) => g.name).join(', ') || null],
      ];
      // Someone you've met: what you did, and how they look now (casts,
      // teeth...), up top where it can't be missed (and stays in a fight).
      const hist = q('.enc-history');
      hist.hidden = !e.history && !e.looks?.length;
      hist.innerHTML =
        (e.history ? `<p><b>${e.recognised ? 'They know you.' : 'You know them.'}</b> ${e.history}</p>` : '') +
        (e.looks?.length ? `<p class="looks">${e.looks.join(' · ')}</p>` : '');
      q('.enc-facts').innerHTML = facts
        .map(([k, v], i) => `<div class="${i >= 5 ? 'wide' : ''}"><dt>${k}</dt><dd class="${v ? '' : 'unknown'}">${v ?? '?'}</dd></div>`)
        .join('');

      // Status: how close you are and how close they are to noticing, or the fight.
      // The fight view once there's been a fight (your own old injuries don't count).
      const fought = e.stage === 'combat' || e.stage === 'over';
      q('.enc-status').innerHTML = fought
        ? `<div class="enc-fighters">${fighter('You', e.you, 'you', e.watchers ? [`Watched (${e.watchers})`] : [])}${fighter('Them', e.them, 'them')}</div>`
        : `<div class="enc-note">${distanceLabel(e)}</div>` + bar('Noticed', Math.min(100, Math.round(e.suspicion)), 100, 'notice');

      // New log lines.
      if (shown < e.log.length) for (const p of log.querySelectorAll('p.turn-start')) p.classList.remove('turn-start');
      // (Drawing it all afresh, after a reload: the turn starts at your last move.)
      const turnFrom = shown === 0 ? Math.max(0, e.log.map((l) => l.by).lastIndexOf('you')) : shown;
      for (; shown < e.log.length; shown++) {
        const line = e.log[shown];
        const el = document.createElement('p');
        el.className = `by-${line.by}${line.hit ? ` hit-${line.hit}` : ''}${line.end ? ' end' : ''}${shown === turnFrom ? ' turn-start' : ''}`;
        // The blood it cost stands out on a hit.
        const m = line.hit ? /^(.*?)(\(−\d+\s?ml\))(.*)$/.exec(line.text) : null;
        if (m) {
          const b = document.createElement('b');
          b.textContent = m[2];
          el.append(m[1], b, m[3]);
        } else el.textContent = line.text;
        log.append(el);
      }
      markOld();
      // The newest turn from its first line (not its last, cut off at the top).
      log.scrollTop = log.scrollHeight;
      pinTurn();
      logMore();

      q('.enc-title').textContent =
        e.stage === 'over' ? (e.resident && e.result === 'walked' ? 'You leave them where they lie.' : RESULT[e.result ?? 'left']) : e.stage === 'combat' && e.chase ? "They’re running" : e.stage === 'combat' && e.them.out ? STAGE_TITLE.helpless : e.stage === 'combat' && e.them.yielded ? STAGE_TITLE.yielded : e.stage === 'combat' && e.you.down ? STAGE_TITLE.youDown : e.stage === 'combat' && e.them.down ? STAGE_TITLE.down : STAGE_TITLE[e.stage];
      opts = options(e);
      const cats = [...new Set(opts.filter((o) => o.cat).map((o) => o.cat!))];
      const key = cats.join(',');
      if (key !== tabsKey) {
        // New tabs (they fell, they're out, the fight started): show the
        // first, the one that matters most now. Otherwise stay where you were.
        tabsKey = key;
        // Someone out cold: nothing's open until you choose (violence, or
        // going through their pockets, or leaving).
        // Out cold: going through their pockets is what most people do next.
        tab = e.stage === 'surveil' || e.stage === 'violence' ? e.stage : e.stage === 'combat' && e.them.out ? (cats.includes('search') ? 'search' : null) : (cats[0] ?? null);
      }
      if (tab && !cats.includes(tab)) tab = e.stage === 'combat' && e.them.out ? (cats.includes('search') ? 'search' : null) : (cats[0] ?? null);
      drawOptions();
    },
  };
}
