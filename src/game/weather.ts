import { now } from './clock';

/**
 * The weather, on the real clock: dry spells of one to three hours, rain
 * that lasts a quarter of an hour to over an hour, sometimes a downpour.
 * It keeps changing while the game is closed. Saved under `state.weather`.
 */
export type Weather = 'clear' | 'drizzle' | 'rain' | 'downpour' | 'flurries' | 'snow' | 'heavysnow';

const SNOWS: Weather[] = ['flurries', 'snow', 'heavysnow'];
export const isSnow = (w: Weather) => SNOWS.includes(w);

export interface WeatherState {
  now: Weather;
  /** When this weather ends (ms, real time). */
  until: number;
}

const MIN = 60_000;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** How hard it's raining, 0..1. */
export const RAIN_AMOUNT: Record<Weather, number> = { clear: 0, drizzle: 0.3, rain: 0.65, downpour: 1, flurries: 0, snow: 0, heavysnow: 0 };
/** How hard it's snowing, 0..1. */
export const SNOW_AMOUNT: Record<Weather, number> = { clear: 0, drizzle: 0, rain: 0, downpour: 0, flurries: 0.3, snow: 0.65, heavysnow: 1 };
/** How wet it gets you, 0..1 (snow melts on you, but slower than rain soaks). */
export const WET_AMOUNT: Record<Weather, number> = { clear: 0, drizzle: 0.3, rain: 0.65, downpour: 1, flurries: 0.15, snow: 0.35, heavysnow: 0.55 };
/** How much it chills you on top of that (snow is colder than rain). */
export const COLD_AMOUNT: Record<Weather, number> = { clear: 0, drizzle: 0.3, rain: 0.65, downpour: 1, flurries: 0.45, snow: 0.8, heavysnow: 1.15 };

/** How likely it is to come down as snow (on the real calendar: winter only). */
function snowChance(t = now()): number {
  const m = new Date(t).getMonth();
  return m === 11 || m === 0 || m === 1 ? 0.55 : m === 10 || m === 2 ? 0.25 : 0;
}

export const WEATHER_NAME: Record<Weather, string> = { clear: 'Dry', drizzle: 'Drizzle', rain: 'Rain', downpour: 'Downpour', flurries: 'Flurries', snow: 'Snow', heavysnow: 'Heavy snow' };

function next(w: Weather): { now: Weather; mins: number } {
  if (w === 'clear') {
    const r = Math.random();
    if (Math.random() < snowChance()) {
      const n: Weather = r < 0.45 ? 'flurries' : r < 0.85 ? 'snow' : 'heavysnow';
      return { now: n, mins: n === 'heavysnow' ? rand(15, 45) : rand(20, 80) };
    }
    const n: Weather = r < 0.45 ? 'drizzle' : r < 0.85 ? 'rain' : 'downpour';
    return { now: n, mins: n === 'downpour' ? rand(10, 30) : rand(15, 70) };
  }
  // Rain gets heavier or lighter for a while, or stops.
  const r = Math.random();
  if (r < 0.55) return { now: 'clear', mins: rand(60, 180) };
  if (w === 'drizzle') return { now: 'rain', mins: rand(10, 40) };
  if (w === 'flurries') return { now: 'snow', mins: rand(15, 45) };
  const r2 = Math.random();
  if (w === 'snow') return r2 < 0.75 ? { now: 'flurries', mins: rand(10, 30) } : { now: 'heavysnow', mins: rand(10, 30) };
  if (w === 'heavysnow') return { now: 'snow', mins: rand(15, 40) };
  if (w === 'rain') return r2 < 0.75 ? { now: 'drizzle', mins: rand(10, 30) } : { now: 'downpour', mins: rand(8, 25) };
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
  if (w === 'clear') return isSnow(was) ? 'The snow stops. Everything is quiet, and grey slush lines the gutters.' : 'The rain stops. Water drips from everything.';
  if (isSnow(w) && !isSnow(was)) return w === 'heavysnow' ? 'Snow comes down thick and fast, and the street goes white.' : w === 'snow' ? 'It starts to snow.' : 'A few flakes drift down out of the dark.';
  if (isSnow(w)) return SNOW_AMOUNT[w] > SNOW_AMOUNT[was] ? (w === 'heavysnow' ? 'The snow thickens until you can barely see the end of the street.' : 'The snow comes down harder.') : w === 'flurries' ? 'The snow eases to a few drifting flakes.' : 'The snow eases off.';
  if (was === 'clear') return w === 'downpour' ? 'The sky opens. Rain hammers down.' : w === 'rain' ? 'It starts to rain.' : 'A thin drizzle starts.';
  if (w === 'downpour') return 'The rain gets heavier, a roar on the sidewalk.';
  return RAIN_AMOUNT[w] > RAIN_AMOUNT[was] ? 'The rain picks up.' : 'The rain eases off.';
}
