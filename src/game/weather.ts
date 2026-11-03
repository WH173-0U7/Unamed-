import { now } from './clock';

/**
 * The weather, on the real clock: dry spells of one to three hours, rain
 * that lasts a quarter of an hour to over an hour, sometimes a downpour.
 * It keeps changing while the game is closed. Saved under `state.weather`.
 */
export type Weather = 'clear' | 'drizzle' | 'rain' | 'downpour';

export interface WeatherState {
  now: Weather;
  /** When this weather ends (ms, real time). */
  until: number;
}

const MIN = 60_000;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** How hard it's raining, 0..1. */
export const RAIN_AMOUNT: Record<Weather, number> = { clear: 0, drizzle: 0.3, rain: 0.65, downpour: 1 };

export const WEATHER_NAME: Record<Weather, string> = { clear: 'Dry', drizzle: 'Drizzle', rain: 'Rain', downpour: 'Downpour' };

function next(w: Weather): { now: Weather; mins: number } {
  if (w === 'clear') {
    const r = Math.random();
    const n: Weather = r < 0.45 ? 'drizzle' : r < 0.85 ? 'rain' : 'downpour';
    return { now: n, mins: n === 'downpour' ? rand(10, 30) : rand(15, 70) };
  }
  // Rain gets heavier or lighter for a while, or stops.
  const r = Math.random();
  if (r < 0.55) return { now: 'clear', mins: rand(60, 180) };
  if (w === 'drizzle') return { now: 'rain', mins: rand(10, 40) };
  if (w === 'rain') return r < 0.75 ? { now: 'drizzle', mins: rand(10, 30) } : { now: 'downpour', mins: rand(8, 25) };
  return { now: 'rain', mins: rand(10, 30) };
}

export function newWeather(): WeatherState {
  // Start dry most of the time, with the first rain not far off.
  return Math.random() < 0.7 ? { now: 'clear', until: now() + rand(8, 40) * MIN } : { now: 'drizzle', until: now() + rand(10, 30) * MIN };
}

/** Brings the weather up to the present. Returns true if it changed. */
export function updateWeather(s: WeatherState, t = now()): boolean {
  let changed = false;
  // A long time away: only the last few changes matter.
  if (t - s.until > 24 * 60 * MIN) s.until = t - 1;
  // A clock set ahead and then put right: the weather doesn't wait for it.
  if (s.until - t > 12 * 60 * MIN) s.until = t - 1;
  for (let i = 0; i < 64 && t >= s.until; i++) {
    const n = next(s.now);
    s.now = n.now;
    s.until += n.mins * MIN;
    changed = true;
  }
  return changed;
}

/** What it's like when it changes, for a note. */
export function weatherLine(w: Weather, was: Weather): string {
  if (w === 'clear') return 'The rain stops. Water drips from everything.';
  if (was === 'clear') return w === 'downpour' ? 'The sky opens. Rain hammers down.' : w === 'rain' ? 'It starts to rain.' : 'A thin drizzle starts.';
  if (w === 'downpour') return 'The rain gets heavier, a roar on the pavement.';
  return RAIN_AMOUNT[w] > RAIN_AMOUNT[was] ? 'The rain picks up.' : 'The rain eases off.';
}
