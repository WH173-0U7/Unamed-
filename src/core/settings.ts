/** Player settings, saved on the device between sessions (separate from game saves). */

export type GraphicsQuality = 'auto' | 'low' | 'medium' | 'high';

export interface Settings {
  quality: GraphicsQuality;
  showFps: boolean;
}

const KEY = 'dreamscape.settings.v2';

const defaults: Settings = {
  quality: 'auto',
  showFps: false,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
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
