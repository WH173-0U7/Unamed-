import { uiGlitch } from '../fx/uiGlitch';
import { BUILDS, NAMES } from '../game/person';
import { CATEGORY_NAMES, PASS_OUT, conditions, distanceLabel, options, type Body, type Category, type Encounter, type Option } from '../game/encounter';

const STAGE_TITLE: Record<string, string> = {
  menu: 'What now?',
  surveil: 'What now?',
  violence: 'What now?',
  combat: 'Fight',
  helpless: 'Unconscious',
};

export const RESULT: Record<string, string> = {
  won: 'They are down.',
  lost: 'You were beaten.',
  'they-fled': 'They got away.',
  'you-fled': 'You got away.',
  'lost-them': 'You lost them.',
  left: 'You let them go.',
  walked: 'You walk away.',
  killed: "They're dead.",
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

  q('.enc-actions').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.tab) {
      // Switching tabs is instant and costs nothing.
      if (tab !== b.dataset.tab) {
        tab = b.dataset.tab as Category;
        drawOptions(true);
        uiGlitch(q('.enc-opts'), 0.25);
      }
      return;
    }
    onAct(b.dataset.id!);
  });

  const button = (o: Option) =>
    `<button type="button" data-id="${o.id}" ${o.disabled ? 'disabled' : ''}>${o.label}${o.hint ? `<small>${o.hint}</small>` : ''}</button>`;

  /** The tab bar, the options under the chosen tab, and the ones always shown. */
  function drawOptions(switched = false) {
    const cats = [...new Set(opts.filter((o) => o.cat).map((o) => o.cat!))];
    const tabs = q('.enc-tabs');
    tabs.hidden = cats.length === 0;
    tabs.innerHTML = cats
      .map((c) => {
        const n = opts.filter((o) => o.cat === c && !o.disabled).length;
        return `<button type="button" role="tab" data-tab="${c}" aria-selected="${c === tab}" class="${c === tab ? 'on' : ''}">${CATEGORY_NAMES[c]}${c === 'search' && n ? `<i>${n}</i>` : ''}</button>`;
      })
      .join('');
    const panel = q('.enc-opts');
    // Loot lists get long: smaller buttons.
    panel.classList.toggle('compact', tab === 'search');
    panel.innerHTML = tab ? opts.filter((o) => o.cat && o.cat === tab).map(button).join('') : cats.length ? `<p class="enc-pick">Choose what to do.</p>` : '';
    panel.hidden = !panel.innerHTML;
    if (switched) {
      panel.classList.remove('swap');
      void panel.offsetWidth;
      panel.classList.add('swap');
    }
    const extra = q('.enc-extra');
    extra.innerHTML = opts.filter((o) => !o.cat).map(button).join('');
    extra.hidden = !extra.innerHTML;
  }

  const bar = (label: string, v: number, max: number, cls: string, value = `${Math.round(v)}/${max}`) =>
    `<div class="enc-bar ${cls}"><span>${label}</span><i><b style="width:${(100 * Math.max(0, v)) / max}%"></b>${
      cls === 'blood' ? `<s style="left:${PASS_OUT * 100}%"></s>` : ''
    }</i><em>${value}</em></div>`;
  const ml = (n: number) => `${(n / 1000).toFixed(1)} L`;
  /** Blood, stamina, and conditions (standing or on the floor, injuries). */
  const fighter = (name: string, f: Body, cls: string) =>
    `<div class="enc-fighter ${cls}"><div class="enc-name">${name}</div>` +
    bar('Blood', f.blood, f.maxBlood, 'blood', `${ml(f.blood)} / ${ml(f.maxBlood)}`) +
    bar('Stamina', f.stamina, f.maxStamina, 'stamina') +
    `<div class="enc-conds">${conditions(f)
      .map((c) => `<span class="${c === 'Standing' ? 'ok' : c === 'On the floor' ? 'floor' : ''}">${c}</span>`)
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
        if (e !== current) {
          tab = null;
          tabsKey = '';
          root.classList.remove('facts-open');
        }
        current = e;
      }
      // Something new on screen: it glitches in.
      if (root.hidden) uiGlitch(root, 0.4);
      else if (root.dataset.stage !== e.stage) uiGlitch(q('.enc-actions'), 0.3);
      root.hidden = false;
      root.dataset.stage = e.stage;
      const p = e.person;
      q('.enc-kind').textContent = NAMES[p.kind];
      q('.enc-race').textContent = p.race;

      const b = BUILDS[p.build];
      const facts: [string, string | null][] = [
        ['Sex', e.known.sex ? p.sex : null],
        ['Build', e.known.build ? `${p.build} · ${b.difficulty}` : null],
        ['Carrying', e.known.carrying ? p.carrying.map((i) => i.name).join(', ') || 'Nothing' : null],
        ['Awareness', e.known.awareness ? p.awareness : null],
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
        .map(([k, v], i) => `<div class="${i >= 4 ? 'wide' : ''}"><dt>${k}</dt><dd class="${v ? '' : 'unknown'}">${v ?? '?'}</dd></div>`)
        .join('');

      // Status: how close you are and how close they are to noticing, or the fight.
      // The fight view once there's been a fight (your own old injuries don't count).
      const fought = e.stage === 'combat' || e.stage === 'over';
      q('.enc-status').innerHTML = fought
        ? `<div class="enc-fighters">${fighter('You', e.you, 'you')}${fighter('Them', e.them, 'them')}</div>`
        : `<div class="enc-note">${distanceLabel(e)}</div>` + bar('Noticed', Math.min(100, Math.round(e.suspicion)), 100, 'notice');

      // New log lines.
      for (; shown < e.log.length; shown++) {
        const line = e.log[shown];
        const el = document.createElement('p');
        el.className = `by-${line.by}${line.hit ? ` hit-${line.hit}` : ''}`;
        // The blood it cost stands out on a hit.
        const m = line.hit ? /^(.*?)(\(−\d+ ml\))(.*)$/.exec(line.text) : null;
        if (m) {
          const b = document.createElement('b');
          b.textContent = m[2];
          el.append(m[1], b, m[3]);
        } else el.textContent = line.text;
        log.append(el);
      }
      log.scrollTop = log.scrollHeight;

      q('.enc-title').textContent =
        e.stage === 'over' ? RESULT[e.result ?? 'left'] : e.stage === 'combat' && e.them.out ? STAGE_TITLE.helpless : STAGE_TITLE[e.stage];
      opts = options(e);
      const cats = [...new Set(opts.filter((o) => o.cat).map((o) => o.cat!))];
      const key = cats.join(',');
      if (key !== tabsKey) {
        // New tabs (they fell, they're out, the fight started): show the
        // first, the one that matters most now. Otherwise stay where you were.
        tabsKey = key;
        // Someone out cold: nothing's open until you choose (violence, or
        // going through their pockets, or leaving).
        tab = e.stage === 'surveil' || e.stage === 'violence' ? e.stage : e.stage === 'combat' && e.them.out ? null : (cats[0] ?? null);
      }
      if (tab && !cats.includes(tab)) tab = e.stage === 'combat' && e.them.out ? null : (cats[0] ?? null);
      drawOptions();
    },
  };
}
