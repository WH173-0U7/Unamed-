import { BUILDS, NAMES } from '../game/person';
import { distanceLabel, options, type Encounter } from '../game/encounter';

const STAGE_TITLE: Record<string, string> = {
  menu: 'What now?',
  surveil: 'Surveil',
  violence: 'Violence',
  combat: 'Fight',
};

const RESULT: Record<string, string> = {
  won: 'They are down.',
  lost: 'You were beaten.',
  'they-fled': 'They got away.',
  'you-fled': 'You got away.',
  'lost-them': 'You lost them.',
  left: 'You let them go.',
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
      <div class="enc-status"></div>
    </div>
    <div class="enc-log" role="log" aria-live="polite"></div>
    <div class="enc-actions">
      <div class="enc-title"></div>
      <div class="enc-opts"></div>
    </div>`;
  const q = (s: string) => root.querySelector(s) as HTMLElement;
  const log = q('.enc-log');
  let shown = 0;
  let current: Encounter | null = null;

  q('.enc-opts').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (b && !b.disabled) onAct(b.dataset.id!);
  });

  const bar = (label: string, hp: number, max: number, cls: string) =>
    `<div class="enc-bar ${cls}"><span>${label}</span><i><b style="width:${(100 * hp) / max}%"></b></i><em>${hp}/${max}</em></div>`;

  return {
    render(e: Encounter | null) {
      if (!e || e.stage === 'seen') {
        root.hidden = true;
        current = e;
        return;
      }
      if (e !== current) {
        log.replaceChildren();
        shown = 0;
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
      ];
      q('.enc-facts').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd class="${v ? '' : 'unknown'}">${v ?? '?'}</dd></div>`).join('');

      // Status: how close you are and how close they are to noticing, or the fight.
      const fighting = e.stage === 'combat' || (e.stage === 'over' && e.them.hp < e.them.max) || e.you.hp < e.you.max;
      q('.enc-status').innerHTML = fighting
        ? bar('You', e.you.hp, e.you.max, 'you') + bar('Them', e.them.hp, e.them.max, 'them') + (e.you.blinded ? '<div class="enc-note">Blinded</div>' : '')
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

      q('.enc-title').textContent = e.stage === 'over' ? RESULT[e.result ?? 'left'] : STAGE_TITLE[e.stage];
      q('.enc-opts').innerHTML = options(e)
        .map(
          (o) =>
            `<button type="button" data-id="${o.id}" ${o.disabled ? 'disabled' : ''} class="${o.id === 'back' ? 'enc-back' : ''}">${o.label}${o.hint ? `<small>${o.hint}</small>` : ''}</button>`,
        )
        .join('');
    },
  };
}
