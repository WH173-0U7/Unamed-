/**
 * Checking for updates (the menu's "Check for updates"): the live game says
 * what version it is in version.json (written by the build, see
 * vite.config.ts). Newer than this one, and an update fetches it now, past
 * whatever the phone has cached. In the Android app, it also says when the
 * app itself needs a new download.
 */
import { VERSION } from './changelog';
const WANT = 'darcvoyd.want';

export interface Latest {
  version: string;
  appBuild: number;
}

/** Whether version a comes after b. Versions go 2.0, 2.01 … 2.09, 2.1 (that's 2.10), 2.11: the part after the dot is hundredths. */
export function newer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  // (A second part is hundredths: 2.1 is 2.10, before 2.11.)
  const n = (p: number[], s: string) => p[0] * 10000 + (s.split('.')[1] ? Number(s.split('.')[1].padEnd(2, '0')) : 0);
  return n(pa, a) > n(pb, b);
}

/** What's on the server right now (null: offline, or it didn't answer). */
export async function latest(): Promise<Latest | null> {
  try {
    const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as Partial<Latest>;
    return typeof j.version === 'string' ? { version: j.version, appBuild: Number(j.appBuild) || 0 } : null;
  } catch {
    return null;
  }
}

/** Load that version now (the page asked for by a new address, so nothing cached stands in for it). */
export function apply(v: string) {
  try {
    localStorage.setItem(WANT, v);
  } catch {
    /* */
  }
  const u = new URL(location.href);
  u.searchParams.set('v', v);
  location.replace(u.toString());
}

/**
 * At start: an update you took is the one that loads, even if the phone's
 * cache would hand back the old page for a while. Returns true when it's
 * reloading.
 */
export function holdUpdate(): boolean {
  let want: string | null = null;
  try {
    want = localStorage.getItem(WANT);
  } catch {
    return false;
  }
  if (!want) return false;
  if (!newer(want, VERSION)) {
    try {
      localStorage.removeItem(WANT);
    } catch {
      /* */
    }
    return false;
  }
  const u = new URL(location.href);
  if (u.searchParams.get('v') === want) return false;
  u.searchParams.set('v', want);
  location.replace(u.toString());
  return true;
}
