import { uiGlitch } from '../fx/uiGlitch';
import { isMobile } from '../core/quality';
import { onSettingsChange, updateSettings, type GraphicsQuality } from '../core/settings';
import { formatAgo, formatPlayTime, type SaveData } from '../core/save';

export type Screen = 'main' | 'pause' | 'settings' | 'confirm';

const QUALITY_NOTES: Record<GraphicsQuality, string> = {
  auto: 'Adjusts resolution on the fly to keep things smooth.',
  low: 'Fewer particles and lower resolution. Best for older phones and battery life.',
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
  for (const name of ['main', 'pause', 'settings', 'confirm'] as Screen[]) {
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
    show(history.pop() ?? 'main');
  }

  function hide() {
    root.classList.remove('open');
    for (const el of screens.values()) el.setAttribute('inert', '');
    (document.activeElement as HTMLElement | null)?.blur();
  }

  let confirmAction: (() => void) | null = null;
  function confirm(opts: { title: string; body: string; ok: string; onOk: () => void }) {
    $('confirm-title').textContent = opts.title;
    $('confirm-body').textContent = opts.body;
    $('confirm-ok').textContent = opts.ok;
    confirmAction = opts.onOk;
    show('confirm', true);
  }
  $('confirm-ok').addEventListener('click', () => {
    const action = confirmAction;
    confirmAction = null;
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

  onSettingsChange((s) => {
    seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const on = b.dataset.v === s.quality;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    $('quality-note').textContent = QUALITY_NOTES[s.quality];
    fps.checked = s.showFps;
  });

  // ---------- Toast ----------
  const toastEl = $('toast');
  let toastTimer = 0;
  function toast(text: string) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2200);
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
