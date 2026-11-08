import { glyphSvg } from '../game/lootIcon';
import { uiGlitch } from '../fx/uiGlitch';
import { BUILDS, NAMES, personalityOf } from '../game/person';
import { CATEGORY_NAMES, FEAR_TIER_NAMES, PASS_OUT, conditions, fearTier, distanceLabel, options, type Body, type Category, type Encounter, type Option } from '../game/encounter';

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
      <div class="enc-next" hidden></div>
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
  // The whole log, newest at the bottom: it scrolls, and each move brings the newest line into view.
  const toNewest = () => {
    log.scrollTop = log.scrollHeight;
  };
  // More of the log below what shows: a fade at the bottom.
  const logMore = () => log.classList.toggle('more', log.scrollTop + log.clientHeight < log.scrollHeight - 4);
  log.addEventListener('scroll', logMore);
  // Resized (the status panel opened, another tab): keep the newest turn in view.
  new ResizeObserver(() => {
    toNewest();
    logMore();
  }).observe(log);
  q('.enc-opts:not(.enc-extra)').addEventListener('scroll', (ev) => {
    const el = ev.currentTarget as HTMLElement;
    el.classList.toggle('more', el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  });

  q('.enc-actions').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b || b.disabled) return;
    // A thing in their pockets with questions to ask about it: its own little row, open or shut.
    if (b.dataset.expand) {
      expanded = expanded === b.dataset.expand ? null : b.dataset.expand;
      drawOptions();
      return;
    }
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
  const attr = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  /**
   * A hint as a few short tags ("Sneak", "a turn", "Their phone") rather than
   * a sentence: its pieces, where they're short; else its first short clause.
   * (The whole hint stays on the button, for a long press or a screen reader.)
   */
  const chips = (hint: string): string[] => {
    const parts = hint
      .split(/\s+·\s+|:\s+|(?<=[.!?])\s+|;\s+/)
      .map((x) => x.trim().replace(/[.]$/, ''))
      .filter(Boolean);
    const short = parts.filter((x) => x.length <= 34).slice(0, 3);
    if (short.length) return short;
    const first = parts[0] ?? hint;
    const cut = first.slice(0, 34);
    return [first.length > 34 ? `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 12)).replace(/[,\s]+$/, '')}…` : first];
  };
  /** (Where a thing is in their pockets reads as it is: no tags.) */
  const small = (o: Option) => (!o.hint ? '' : o.id.startsWith('take') ? `<small>${o.hint}</small>` : `<small class="chips">${chips(o.hint).map((c) => `<span>${c}</span>`).join('')}</small>`);
  const button = (o: Option, extra = '') =>
    `<button type="button" data-id="${o.id}" ${o.cat && HARM.has(o.cat) ? 'data-tone="harm"' : ''} ${o.tone ? `data-loot="${o.tone}"` : ''} ${o.disabled ? 'disabled' : ''} ${o.hint ? `title="${attr(o.hint)}" aria-label="${attr(`${o.label}. ${o.hint}`)}"` : ''} ${extra}>${o.icon && o.tone ? glyphSvg(o.icon, o.tone) : ''}${o.label}${small(o)}</button>`;
  /** Which thing in their pockets has its row open ("gi:li|its name": a list that shifts doesn't open the wrong one). */
  let expanded: string | null = null;

  /**
   * What makes sense next, from how things stand: a few of the options
   * already there, up top (the same buttons, nothing new).
   */
  const nextIds = (e: Encounter, all: Option[]): string[] => {
    const can = (id: string) => all.some((o) => o.id === id && !o.disabled);
    const first = (f: (o: Option) => boolean) => all.find((o) => !o.disabled && f(o))?.id;
    const out: (string | undefined)[] = [];
    if (e.stage === 'combat' || e.stage === 'over') {
      if (e.you.stamina < e.you.maxStamina * 0.25 && !e.them.yielded && !e.them.out) out.push(first((o) => o.id === 'breathe'));
      if (e.them.yielded && !e.them.out) {
        if (can('empty')) out.push('empty');
        else if (!e.person.clothes.some((g) => g.searched) && can('patdown')) out.push('patdown');
      }
      if ((e.them.out || e.them.dead) && !e.chase) out.push(first((o) => o.id.startsWith('search:')));
      if (can('take-all')) out.push('take-all');
      if (e.them.down && !e.them.out && !e.them.dead && !e.them.yielded && !e.chase) out.push(first((o) => o.id.startsWith('stomp') || o.id.startsWith('ground:') || o.id.startsWith('floor:')));
    } else if (e.stage === 'surveil' && (e.distance ?? 0) < 2 && can('follow')) out.push('follow');
    return [...new Set(out.filter((x): x is string => !!x))].slice(0, 3);
  };

  /** The tab bar, the options under the chosen tab, and the ones always shown. */
  /** Which options were showing last time (a new list starts at its top). */
  let shownKey = '';
  function drawOptions(switched = false) {
    // Demands about one thing in their pockets go with that thing (in Search);
    // about what you took off them already, under "What you took".
    const takes = new Set(opts.filter((o) => o.id.startsWith('take:')).map((o) => o.id.slice(5)));
    const asks = new Map<string, Option[]>();
    const tookOnes: Option[] = [];
    const listed: Option[] = [];
    for (const o of opts) {
      if (o.item && takes.has(o.item)) asks.set(o.item, [...(asks.get(o.item) ?? []), o]);
      else if (o.took || o.item) tookOnes.push(o);
      else listed.push(o);
    }
    const hasSearch = listed.some((o) => o.cat === 'search');
    const tookCat: Category = hasSearch ? 'search' : 'threaten';
    const all = [...tookOnes.map((o) => ({ ...o, cat: tookCat })), ...listed];
    const cats = [...new Set(all.filter((o) => o.cat).map((o) => o.cat!))].sort((a, b) => TAB_ORDER.indexOf(a) - TAB_ORDER.indexOf(b));
    const tabs = q('.enc-tabs');
    // It's over: no tabs and no greyed-out moves, just how it ended and the way on.
    const done = !!current?.finished;
    // Just the one choice of tab: no bar, it's open.
    if (cats.length === 1) tab = cats[0];
    if (tab && !cats.includes(tab)) tab = cats[0] ?? null;
    tabs.hidden = cats.length <= 1 || done;
    tabs.innerHTML = cats
      .map((c) => {
        const n = all.filter((o) => o.cat === c && !o.disabled).length;
        return `<button type="button" role="tab" data-tab="${c}" ${HARM.has(c) ? 'data-tone="harm"' : ''} aria-selected="${c === tab}" class="${c === tab ? 'on' : ''}">${CATEGORY_NAMES[c]}${c === 'search' && n ? `<i>${n}</i>` : ''}</button>`;
      })
      .join('');
    // What makes sense next (unless it's right there in the open tab already).
    const next = q('.enc-next');
    const inTab = new Set((tab ? all.filter((o) => o.cat === tab) : []).map((o) => o.id));
    const ids = !done && current ? nextIds(current, opts).filter((id) => !inTab.has(id)) : [];
    next.innerHTML = ids.length ? `<span>Next</span>${ids.map((id) => opts.find((o) => o.id === id)!).map((o) => button({ ...o, hint: undefined })).join('')}` : '';
    next.hidden = !ids.length;
    const panel = q('.enc-opts');
    // Loot lists get long: smaller buttons.
    panel.classList.toggle('compact', tab === 'search');
    const shown = done ? [] : tab ? all.filter((o) => o.cat && o.cat === tab) : [];
    // (The open row: still the same thing, or shut.)
    if (expanded && !shown.some((o) => o.id.startsWith('take:') && `${o.id.slice(5)}|${o.label}` === expanded && asks.has(o.id.slice(5)))) expanded = null;
    // Sections (Strikes, Weapons, On the ground, Torture) when there's more than
    // one, and they're worth it: a list long enough, or a group with a few moves in it.
    const groups = shown.map((o) => o.group).filter(Boolean);
    const sizes = [...new Set(groups)].map((g) => groups.filter((x) => x === g).length);
    const sections = sizes.length > 1 && (shown.length > 10 || sizes.filter((n) => n >= 2).length >= 2);
    // A long list: two columns, where there's the width.
    panel.classList.toggle('dense', shown.length >= 8);
    // (Words to say and things to do read as lines: on a narrow phone, one to a row. Fight moves stay two up.)
    panel.classList.toggle('long-labels', !!tab && !HARM.has(tab));
    let lastGroup: string | undefined;
    const tookShown = shown.filter((o) => tookOnes.some((t) => t.id === o.id));
    const rest = shown.filter((o) => !tookOnes.some((t) => t.id === o.id));
    const item = (o: Option) => {
      const key = o.id.startsWith('take:') ? o.id.slice(5) : '';
      const qs = key ? asks.get(key) : undefined;
      if (!qs?.length) return button(o);
      const open = expanded === `${key}|${o.label}`;
      const head = button({ ...o, hint: o.hint ? `${o.hint} · ${qs.length === 1 ? '1 question' : `${qs.length} questions`}` : undefined }, `data-expand="${attr(`${key}|${o.label}`)}" aria-expanded="${open}" class="has-asks${open ? ' open' : ''}"`);
      return open ? `${head}<div class="enc-sub">${button({ ...o, label: 'Take it', hint: undefined, icon: undefined })}${qs.map((x) => button({ ...x, hint: undefined })).join('')}</div>` : head;
    };
    panel.innerHTML = tab
      ? (tookShown.length ? `<p class="enc-group">What you took</p>${tookShown.map((o) => button({ ...o, hint: o.took ?? o.hint })).join('')}${rest.length ? '<p class="enc-group">On them</p>' : ''}` : '') +
        rest
          .map((o) => {
            const head = sections && o.group && o.group !== lastGroup ? `<p class="enc-group">${o.group}</p>` : '';
            lastGroup = o.group;
            return head + item(o);
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
    extra.innerHTML = opts.filter((o) => !o.cat && !(done && o.disabled)).map((o) => button(o)).join('');
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
    (cls === 'them' && f.fear != null && !f.dead ? bar('Fear', f.fear, 100, 'fear', FEAR_TIER_NAMES[fearTier(f.fear)]) : '') +
    `<div class="enc-conds">${((cs) => (cs.length > 4 ? [...cs.slice(0, 3), `+${cs.length - 3} more`] : cs))([...extra, ...conditions(f)])
      .map((c) => `<span class="${c === 'Standing' ? 'ok' : c === 'On the floor' ? 'floor' : /^Watched/.test(c) ? 'watched' : ''}">${c}</span>`)
      .join('')}</div></div>`;

  return {
    render(e: Encounter | null) {
      if (!e || e.stage === 'seen') {
        root.hidden = true;
        // (Nothing drawn for them: the next one shown starts clean, log, tab and card.)
        current = null;
        return;
      }
      if (e !== current || e.log.length < shown) {
        log.replaceChildren();
        shown = 0;
        root.classList.remove('status-open');
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
      for (; shown < e.log.length; shown++) {
        const line = e.log[shown];
        const el = document.createElement('p');
        el.className = `by-${line.by}${line.hit ? ` hit-${line.hit}` : ''}${line.end ? ' end' : ''}`;
        // The blood it cost stands out on a hit.
        const m = line.hit ? /^(.*?)(\(−\d+\s?ml\))(.*)$/.exec(line.text) : null;
        if (m) {
          const b = document.createElement('b');
          b.textContent = m[2];
          el.append(m[1], b, m[3]);
        } else el.textContent = line.text;
        log.append(el);
      }
      // The newest line in view.
      toNewest();
      requestAnimationFrame(toNewest);
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
