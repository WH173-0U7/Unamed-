/**
 * Save system. One save slot, stored on this device (browser storage).
 *
 * Each write first copies the previous save to a backup key, so if a write is
 * ever interrupted or corrupted, loading falls back to the last good save.
 */

export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  /** When this game was started (ms since 1970). */
  createdAt: number;
  /** When it was last saved (ms since 1970). */
  savedAt: number;
  /** Total time played, in seconds. */
  playTime: number;
  /**
   * The game's progress. Empty for now: each new game system stores its own
   * state under its own key here (e.g. state.player, state.world).
   */
  state: Record<string, unknown>;
}

const KEY = 'darcvoyd.save';
const BACKUP_KEY = 'darcvoyd.save.backup';
/** Keys used under the game's earlier names; still read so older saves load. */
const LEGACY_KEYS = ['unamed.save', 'unamed.save.backup', 'dreamscape.save', 'dreamscape.save.backup'];

export function newSave(): SaveData {
  const now = Date.now();
  return { version: SAVE_VERSION, createdAt: now, savedAt: now, playTime: 0, state: {} };
}

function parse(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (typeof data !== 'object' || data === null || typeof data.createdAt !== 'number') return null;
    return migrate(data);
  } catch {
    return null;
  }
}

/** Upgrades saves written by older versions of the game. */
function migrate(data: Partial<SaveData>): SaveData {
  // Version 1 is the first format; future versions add upgrade steps here.
  return {
    version: SAVE_VERSION,
    createdAt: data.createdAt ?? Date.now(),
    savedAt: data.savedAt ?? data.createdAt ?? Date.now(),
    playTime: data.playTime ?? 0,
    state: data.state ?? {},
  };
}

export function loadSave(): SaveData | null {
  try {
    for (const key of [KEY, BACKUP_KEY, ...LEGACY_KEYS]) {
      const save = parse(localStorage.getItem(key));
      if (save) return save;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadSave() !== null;
}

/** Returns false if the device refused to store it (e.g. private browsing). */
export function writeSave(data: SaveData): boolean {
  try {
    data.savedAt = Date.now();
    const write = () => {
      const previous = localStorage.getItem(KEY);
      if (previous) localStorage.setItem(BACKUP_KEY, previous);
      localStorage.setItem(KEY, JSON.stringify(data));
    };
    try {
      write();
    } catch {
      // Out of room: drop the stored picture of the screen's blood and grime
      // (it's only cosmetic) and try again.
      localStorage.removeItem('darcvoyd.glass');
      write();
    }
    return true;
  } catch {
    return false;
  }
}

export function deleteSave() {
  try {
    for (const key of [KEY, BACKUP_KEY, ...LEGACY_KEYS]) localStorage.removeItem(key);
  } catch {
    /* nothing stored */
  }
}

/** "12 min", "1 h 05 min" */
export function formatPlayTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago" */
export function formatAgo(timestamp: number): string {
  const s = Math.max(0, (Date.now() - timestamp) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
