/**
 * Fighting styles: what you've practised, by the kind of fighting it is.
 * Each one levels up from the moves of its own kind, and its level is what
 * unlocks that kind's harder moves (and helps them land). Unarmed is still
 * your fighting as a whole: every blow with your body trains it, whatever
 * the style, and it still drives how hard you hit, how long you last, and
 * getting up.
 *
 * - **Strikes:** with your hands, elbows and head (boxing, street punching).
 * - **Kicks & knees:** legs (Muay Thai, kickboxing).
 * - **Clinch & takedowns:** grabbing, throwing, tripping, putting them on the
 *   floor (wrestling, judo).
 * - **Ground:** on top of someone who's down: ground and pound, stomps.
 * - **Locks & chokes:** joints bent the wrong way, bones broken on purpose,
 *   strangles (jiu-jitsu, and worse).
 */
import { MAX_LEVEL, xpToNext, type Stats } from './stats';

export type Style = 'strikes' | 'kicks' | 'clinch' | 'ground' | 'locks';
export const STYLES: Style[] = ['strikes', 'kicks', 'clinch', 'ground', 'locks'];
export const STYLE_NAMES: Record<Style, string> = {
  strikes: 'Strikes',
  kicks: 'Kicks & knees',
  clinch: 'Clinch & takedowns',
  ground: 'Ground',
  locks: 'Locks & chokes',
};
export const STYLE_HOW: Record<Style, string> = {
  strikes: 'punching, elbows, headbutts',
  kicks: 'kicking and kneeing',
  clinch: 'grabbing, shoving, tripping and throwing',
  ground: 'stomping and fighting on top of someone who’s down',
  locks: 'joint locks, breaks and chokes',
};

export interface StyleStat {
  level: number;
  xp: number;
}
type WithStyles = Stats & { styles?: Partial<Record<Style, StyleStat>> };

/**
 * Your styles (made the first time they're needed: from before there were
 * styles, everything you'd learned in a fight you've still got).
 */
export function stylesOf(stats: Stats): Record<Style, StyleStat> {
  const s = stats as WithStyles;
  const from = Math.max(1, stats.unarmed?.level ?? 1);
  s.styles ??= Object.fromEntries(STYLES.map((k) => [k, { level: from, xp: 0 }])) as Record<Style, StyleStat>;
  for (const k of STYLES) s.styles[k] ??= { level: 1, xp: 0 };
  return s.styles as Record<Style, StyleStat>;
}
/** New stats start with every style at 1 (not from your Unarmed). */
export function freshStyles(stats: Stats) {
  (stats as WithStyles).styles = Object.fromEntries(STYLES.map((k) => [k, { level: 1, xp: 0 }])) as Record<Style, StyleStat>;
}
export const styleLevel = (stats: Stats, k: Style) => stylesOf(stats)[k].level;

/** Practice in a style. Returns the new level if it went up. */
export function trainStyle(stats: Stats, k: Style, xp: number): number | null {
  const st = stylesOf(stats)[k];
  if (st.level >= MAX_LEVEL) return null;
  st.xp += xp;
  let up: number | null = null;
  while (st.level < MAX_LEVEL && st.xp >= xpToNext(st.level)) {
    st.xp -= xpToNext(st.level);
    st.level++;
    up = st.level;
  }
  return up;
}
