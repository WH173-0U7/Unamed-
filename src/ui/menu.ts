import { isMobile } from '../core/quality';
import { onSettingsChange, updateSettings, type GraphicsQuality } from '../core/settings';

export type Screen = 'main' | 'pause' | 'settings' | 'howto';

const QUALITY_NOTES: Record<GraphicsQuality, string> = {
  auto: 'Adjusts resolution on the fly to keep the dream smooth.',
  low: 'Fewer particles and lower resolution. Best for older phones and battery life.',
  medium: 'A balance of detail and smoothness.',
  high: 'Full detail at full resolution. Needs a powerful device.',
};

/**
 * Menu screens over the live world. Sub-screens (settings, how to play)
 * remember where they were opened from so Back returns there.
 */
export function createMenu(handlers: { onPlay: () => void; onResume: () => void; onQuit: () => void }) {
  const root = document.getElementById('menu') as HTMLElement;
  const screens = new Map<Screen, HTMLElement>();
  for (const name of ['main', 'pause', 'settings', 'howto'] as Screen[]) {
    screens.set(name, document.getElementById(`screen-${name}`) as HTMLElement);
  }

  document.body.classList.add(isMobile ? 'is-touch' : 'is-desk');

  let current: Screen = 'main';
  const history: Screen[] = [];

  function show(screen: Screen, push = false) {
    if (push) history.push(current);
    else history.length = 0;
    current = screen;
    root.classList.add('open');
    for (const [name, el] of screens) {
      const active = name === screen;
      el.classList.toggle('active', active);
      el.toggleAttribute('inert', !active);
    }
    // Keyboard users land on the first control.
    const first = screens.get(screen)?.querySelector<HTMLElement>('button, input');
    if (!isMobile) first?.focus({ preventScroll: true });
  }

  function back() {
    show(history.pop() ?? 'main');
  }

  function hide() {
    root.classList.remove('open');
    for (const el of screens.values()) el.setAttribute('inert', '');
    (document.activeElement as HTMLElement | null)?.blur();
  }

  root.querySelectorAll<HTMLElement>('[data-go]').forEach((b) =>
    b.addEventListener('click', () => show(b.dataset.go as Screen, true)),
  );
  root.querySelectorAll<HTMLElement>('[data-back]').forEach((b) => b.addEventListener('click', back));
  document.getElementById('btn-play')!.addEventListener('click', handlers.onPlay);
  document.getElementById('btn-resume')!.addEventListener('click', handlers.onResume);
  document.getElementById('btn-quit')!.addEventListener('click', handlers.onQuit);

  // ---------- Settings controls ----------
  const seg = document.getElementById('set-quality')!;
  const note = document.getElementById('quality-note')!;
  const sens = document.getElementById('set-sens') as HTMLInputElement;
  const sensOut = document.getElementById('sens-out')!;
  const invert = document.getElementById('set-invert') as HTMLInputElement;
  const vibration = document.getElementById('set-vibration') as HTMLInputElement;
  const fps = document.getElementById('set-fps') as HTMLInputElement;

  seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
    b.addEventListener('click', () => updateSettings({ quality: b.dataset.v as GraphicsQuality })),
  );
  sens.addEventListener('input', () => updateSettings({ sensitivity: Number(sens.value) }));
  invert.addEventListener('change', () => updateSettings({ invertY: invert.checked }));
  vibration.addEventListener('change', () => updateSettings({ vibration: vibration.checked }));
  fps.addEventListener('change', () => updateSettings({ showFps: fps.checked }));

  if (!('vibrate' in navigator)) {
    vibration.disabled = true;
    vibration.closest('.row')?.classList.add('disabled');
  }

  onSettingsChange((s) => {
    seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const on = b.dataset.v === s.quality;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    note.textContent = QUALITY_NOTES[s.quality];
    sens.value = String(s.sensitivity);
    sensOut.textContent = `${s.sensitivity.toFixed(1)}×`;
    invert.checked = s.invertY;
    vibration.checked = s.vibration && !vibration.disabled;
    fps.checked = s.showFps;
  });

  return {
    show,
    hide,
    back,
    get current() {
      return current;
    },
    get isOpen() {
      return root.classList.contains('open');
    },
    setBest(n: number) {
      document.getElementById('best-n')!.textContent = String(n);
    },
    setPauseScore(n: number) {
      document.getElementById('pause-n')!.textContent = String(n);
    },
  };
}
