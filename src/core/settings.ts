/** Player settings, saved on the device between sessions. */

export type GraphicsQuality = 'auto' | 'low' | 'medium' | 'high';

export interface Settings {
  quality: GraphicsQuality;
  /** Look sensitivity multiplier, 0.3 – 2. */
  sensitivity: number;
  invertY: boolean;
  vibration: boolean;
  showFps: boolean;
}

const KEY = 'dreamscape.settings.v1';
const BEST_KEY = 'dreamscape.best.v1';

const defaults: Settings = {
  quality: 'auto',
  sensitivity: 1,
  invertY: false,
  vibration: true,
  showFps: false,
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode etc.): settings just won't persist */
  }
}

function load(): Settings {
  try {
    const raw = read(KEY);
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
  write(KEY, JSON.stringify(settings));
  for (const l of listeners) l(settings);
}

export function onSettingsChange(l: Listener) {
  listeners.push(l);
  l(settings);
}

export function getBest(): number {
  return Number(read(BEST_KEY)) || 0;
}

export function saveBest(score: number) {
  if (score > getBest()) write(BEST_KEY, String(score));
}
