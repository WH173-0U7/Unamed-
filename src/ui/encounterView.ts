import { BUILDS, NAMES } from '../game/person';
import { CATEGORY_NAMES, PASS_OUT, conditions, distanceLabel, options, type Body, type Category, type Encounter, type Option } from '../game/encounter';

const STAGE_TITLE: Record<string, string> = {
  menu: 'What now?',
  surveil: 'What now?',
  violence: 'What now?',
  combat: 'Fight',
  helpless: 'Unconscious',
};

const RESULT: Record<string, string> = {
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

  q('.enc-actions').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.tab) {
      // Switching tabs is instant and costs nothing.
      if (tab !== b.dataset.tab) {
        tab = b.dataset.tab as Category;
        drawOptions(true);
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
    panel.innerHTML = opts.filter((o) => o.cat && o.cat === tab).map(button).join('');
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
        }
        current = e;
      }
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
      q('.enc-facts').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd class="${v ? '' : 'unknown'}">${v ?? '?'}</dd></div>`).join('');

      // Status: how close you are and how close they are to noticing, or the fight.
      const fought = e.stage === 'combat' || e.you.blood < e.you.maxBlood || e.them.blood < e.them.maxBlood;
      q('.enc-status').innerHTML = fought
        ? `<div class="enc-fighters">${fighter('You', e.you, 'you')}${fighter('Them', e.them, 'them')}</div>`
        : `<div class="enc-note">${distanceLabel(e)}</div>` + bar('Noticed', Math.min(100, Math.round(e.suspicion)), 100, 'notice');

      // New log lines.
      for (; shown < e.log.length; shown++) {
        const line = e.log[shown];
        const el = document.createElement('p');
        el.className = `by-${line.by}`;
        el.textContent = line.text;
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
        tab = e.stage === 'surveil' || e.stage === 'violence' ? e.stage : (cats[0] ?? null);
      }
      if (tab && !cats.includes(tab)) tab = cats[0] ?? null;
      drawOptions();
    },
  };
}
