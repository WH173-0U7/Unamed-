/**
 * The game runs on the device's real clock. What you see is your local time,
 * and things that take time (healing, waiting, travel; later) will take it
 * for real, measured from these timestamps, even while the game is closed.
 */
export const now = () => Date.now();

/** "11:42 PM" (or "23:42"), in the device's own format. */
export const clockText = (t = now()) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** "Mon 2 Nov", in the device's own format. */
export const dateText = (t = now()) => new Date(t).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

/** Night, dawn, day or dusk, by the device's clock. */
export function partOfDay(t = now()): 'night' | 'dawn' | 'day' | 'dusk' {
  const h = new Date(t).getHours();
  return h < 5 || h >= 21 ? 'night' : h < 7 ? 'dawn' : h < 18 ? 'day' : 'dusk';
}
