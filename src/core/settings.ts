/** Player settings, saved on the device between sessions (separate from game saves). */

export type GraphicsQuality = 'auto' | 'low' | 'medium' | 'high';

/** The interface's lettering (see style.css: body[data-font]). */
export type FontStyle = 'report' | 'typewriter' | 'terminal' | 'clean';
/** How buttons look (see style.css: body[data-buttons]). */
export type ButtonStyle = 'lines' | 'ghost' | 'keyline' | 'boxes';

export interface Settings {
  quality: GraphicsQuality;
  showFps: boolean;
  font: FontStyle;
  buttons: ButtonStyle;
  /** Clicks and other little sounds (off: muted). */
  sound: boolean;
  /** Changes to your numbers (cash, blood, heat…) float up from where they live. */
  floaters: boolean;
  /** How strong the film grain, glitches, static and colour fringing are (0..100; 50 is the usual). */
  grain: number;
  glitch: number;
  staticFx: number;
  fringe: number;
}

const KEY = 'darcvoyd.settings';
/** Keys used under the game's earlier names. */
const LEGACY_KEYS = ['unamed.settings', 'dreamscape.settings.v2'];

const defaults: Settings = {
  quality: 'auto',
  showFps: false,
  font: 'report',
  buttons: 'lines',
  sound: true,
  floaters: true,
  grain: 50,
  glitch: 50,
  staticFx: 50,
  fringe: 50,
};

function load(): Settings {
  try {
    const raw = [KEY, ...LEGACY_KEYS].map((k) => localStorage.getItem(k)).find((v) => v !== null) ?? null;
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

type Listener = (s: Settings) => void;
const listeners: Listener[] = [];

export const settings: Settings = load();

export function updateSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
  for (const l of listeners) l(settings);
}

export function onSettingsChange(l: Listener) {
  listeners.push(l);
  l(settings);
}
