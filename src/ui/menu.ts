import { uiGlitch } from '../fx/uiGlitch';
import { CHANGES, VERSION } from '../core/changelog';
import { newer } from '../core/update';
import { isMobile } from '../core/quality';
import { onSettingsChange, updateSettings, type ButtonStyle, type FontStyle, type GraphicsQuality } from '../core/settings';
import { formatAgo, formatPlayTime, type SaveData } from '../core/save';

export type Screen = 'main' | 'pause' | 'settings' | 'confirm' | 'news';

const QUALITY_NOTES: Record<GraphicsQuality, string> = {
  auto: 'Picks a resolution to suit this device.',
  low: 'Lower resolution. Best for older phones and battery life.',
  medium: 'A balance of detail and smoothness.',
  high: 'Full detail at full resolution. Needs a powerful device.',
};

export interface MenuHandlers {
  onContinue: () => void;
  onNewGame: () => void;
  onResume: () => void;
  onQuit: () => void;
  onDeleteSave: () => void;
}

const $ = (id: string) => document.getElementById(id) as HTMLElement;

/**
 * Menu screens. Sub-screens (settings, confirm) remember where they were
 * opened from so Back / Cancel returns there.
 */
export function createMenu(handlers: MenuHandlers) {
  const root = $('menu');
  const screens = new Map<Screen, HTMLElement>();
  for (const name of ['main', 'pause', 'settings', 'confirm', 'news'] as Screen[]) {
    screens.set(name, $(`screen-${name}`));
  }

  let current: Screen = 'main';
  const history: Screen[] = [];

  function show(screen: Screen, push = false) {
    if (screen !== current || !root.classList.contains('open')) uiGlitch(screens.get(screen), 0.3);
    if (push) history.push(current);
    else history.length = 0;
    current = screen;
    root.classList.add('open');
    for (const [name, el] of screens) {
      const active = name === screen;
      el.classList.toggle('active', active);
      el.toggleAttribute('inert', !active);
    }
    // Keyboard users land on the first visible control.
    if (!isMobile) {
      const first = screens.get(screen)?.querySelector<HTMLElement>('button:not([hidden]), input');
      first?.focus({ preventScroll: true });
    }
  }

  function back() {
    // (Backing out of a question: whatever asked it gets its say.)
    const cancel = current === 'confirm' ? confirmCancel : null;
    confirmCancel = null;
    show(history.pop() ?? 'main');
    cancel?.();
  }

  function hide() {
    root.classList.remove('open');
    for (const el of screens.values()) el.setAttribute('inert', '');
    (document.activeElement as HTMLElement | null)?.blur();
  }

  let confirmAction: (() => void) | null = null;
  let confirmCancel: (() => void) | null = null;
  function confirm(opts: { title: string; body: string; ok: string; onOk: () => void; onCancel?: () => void }) {
    confirmCancel = opts.onCancel ?? null;
    $('confirm-title').textContent = opts.title;
    $('confirm-body').textContent = opts.body;
    $('confirm-ok').textContent = opts.ok;
    confirmAction = opts.onOk;
    show('confirm', true);
  }
  $('confirm-ok').addEventListener('click', () => {
    const action = confirmAction;
    confirmAction = null;
    confirmCancel = null;
    back();
    action?.();
  });

  root.querySelectorAll<HTMLElement>('[data-go]').forEach((b) =>
    b.addEventListener('click', () => show(b.dataset.go as Screen, true)),
  );
  root.querySelectorAll<HTMLElement>('[data-back]').forEach((b) => b.addEventListener('click', back));
  $('btn-continue').addEventListener('click', handlers.onContinue);
  $('btn-new').addEventListener('click', handlers.onNewGame);
  $('btn-resume').addEventListener('click', handlers.onResume);
  $('btn-quit').addEventListener('click', handlers.onQuit);
  $('btn-delete-save').addEventListener('click', handlers.onDeleteSave);

  // ---------- Settings controls ----------
  const seg = $('set-quality');
  const fps = $('set-fps') as HTMLInputElement;
  seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
    b.addEventListener('click', () => updateSettings({ quality: b.dataset.v as GraphicsQuality })),
  );
  fps.addEventListener('change', () => updateSettings({ showFps: fps.checked }));
  // Film grain, glitches, static, colour fringe: sliders, tried out live.
  const sliders: [HTMLInputElement, 'grain' | 'glitch' | 'staticFx' | 'fringe'][] = [
    [$('set-grain') as HTMLInputElement, 'grain'],
    [$('set-glitch') as HTMLInputElement, 'glitch'],
    [$('set-static') as HTMLInputElement, 'staticFx'],
    [$('set-fringe') as HTMLInputElement, 'fringe'],
  ];
  for (const [el, key] of sliders) el.addEventListener('input', () => updateSettings({ [key]: Number(el.value) }));
  const snd = $('set-sound') as HTMLInputElement;
  snd.addEventListener('change', () => updateSettings({ sound: snd.checked }));
  // Lettering and buttons: tried out live, all over the game.
  const segs: [HTMLElement, 'font' | 'buttons'][] = [
    [$('set-font'), 'font'],
    [$('set-buttons'), 'buttons'],
  ];
  for (const [el, key] of segs) {
    el.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => updateSettings(key === 'font' ? { font: b.dataset.v as FontStyle } : { buttons: b.dataset.v as ButtonStyle })),
    );
  }
  const STYLE_NOTES: Record<string, string> = {
    report: 'Courier, like a police report.',
    typewriter: 'Worn typewriter keys.',
    terminal: 'The glow of an old computer screen.',
    clean: 'Plain and rounded (the old look).',
    lines: 'Just words, with a thin line under each.',
    ghost: 'No borders at all, until you touch one.',
    keyline: 'Thin, square outlines.',
    boxes: 'Rounded boxes (the old look).',
  };

  onSettingsChange((s) => {
    seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const on = b.dataset.v === s.quality;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    $('quality-note').textContent = QUALITY_NOTES[s.quality];
    fps.checked = s.showFps;
    snd.checked = s.sound;
    for (const [el, key] of sliders) {
      el.value = String(s[key]);
      const out = el.parentElement?.querySelector('output');
      if (out) out.textContent = s[key] === 0 ? 'Off' : `${s[key]}%`;
    }
    for (const [el, key] of segs) {
      el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        const on = b.dataset.v === s[key];
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      });
    }
    $('style-note').textContent = `${STYLE_NOTES[s.font]} ${STYLE_NOTES[s.buttons]}`;
    document.body.dataset.font = s.font;
    document.body.dataset.buttons = s.buttons;
  });

  // ---------- Version, and what's new ----------
  $('version').textContent = `v${VERSION} · ${CHANGES[0].date}`;
  const SEEN = 'darcvoyd.seenVersion';
  let seen: string | null = null;
  try {
    seen = localStorage.getItem(SEEN);
  } catch {
    /* no storage */
  }
  /** Fill the What's new screen: everything since `since` (or the latest few). */
  const fillNews = (since: string | null) => {
    const idx = since ? CHANGES.findIndex((r) => r.v === since) : -1;
    const all = idx > 0 ? CHANGES.slice(0, idx) : CHANGES.slice(0, since ? CHANGES.length : 3);
    // A long time away: the latest few, and a count of the rest (not thirty screens of it).
    const list = all.slice(0, 5);
    const more = all.length - list.length;
    $('news').innerHTML =
      list.map((r) => `<section><h3>v${r.v} <em>${r.date}</em></h3><ul>${r.items.map((i) => `<li>${i}</li>`).join('')}</ul></section>`).join('') +
      (more > 0 ? `<p class="news-more">…and ${more} older update${more > 1 ? 's' : ''} before that.</p>` : '');
  };
  fillNews(null);
  root.querySelectorAll<HTMLElement>('[data-go="news"]').forEach((b) => b.addEventListener('click', () => fillNews(null)));
  // Updated since you last played: say what changed (not for automated test runs).
  // (Not for someone playing for the first time: there's nothing to compare.)
  // (An older copy of the page, loaded after a newer one: nothing new to say, and it doesn't count as seen.)
  const isNewer = !seen || newer(VERSION, seen);
  if (seen && isNewer && !new URLSearchParams(location.search).has('debug')) {
    fillNews(seen);
    requestAnimationFrame(() => show('news', true));
  }
  try {
    if (isNewer) localStorage.setItem(SEEN, VERSION);
  } catch {
    /* no storage */
  }

  // ---------- Toast ----------
  const toastEl = $('toast');
  let toastTimer = 0;
  function toast(text: string, ms = 2200) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  return {
    show,
    hide,
    back,
    confirm,
    toast,
    get current() {
      return current;
    },
    /** Updates everything in the menus that describes the saved game. */
    setSaveInfo(save: SaveData | null) {
      const cont = $('btn-continue');
      cont.hidden = !save;
      const del = $('btn-delete-save') as HTMLButtonElement;
      del.disabled = !save;
      $('row-delete').classList.toggle('disabled', !save);
      if (save) {
        const text = `played ${formatPlayTime(save.playTime)} · saved ${formatAgo(save.savedAt)}`;
        $('continue-meta').textContent = text;
        $('save-info').textContent = text;
      } else {
        $('save-info').textContent = 'none yet';
      }
    },
    setPauseInfo(text: string) {
      $('pause-meta').textContent = text;
    },
  };
}
