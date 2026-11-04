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

/**
 * Opening hours: for each day (0 Sunday .. 6 Saturday), [open, close] in
 * hours, or null if closed all day. A close before the open runs past
 * midnight (e.g. [20, 4]).
 */
export type Hours = ([number, number] | null)[];

export function isOpen(hours: Hours, t = now()): boolean {
  const d = new Date(t);
  const h = d.getHours() + d.getMinutes() / 60;
  const today = hours[d.getDay()];
  if (today) {
    const [a, b] = today;
    if (b > a ? h >= a && h < b : h >= a) return true;
  }
  // Still open from last night?
  const y = hours[(d.getDay() + 6) % 7];
  return !!y && y[1] < y[0] && h < y[1];
}

const hh = (h: number) => {
  const d = new Date(2000, 0, 1, Math.floor(h), Math.round((h % 1) * 60));
  return d.toLocaleTimeString([], { hour: 'numeric', minute: d.getMinutes() ? '2-digit' : undefined });
};

/** "Opens 9 AM" / "Closes 5 PM", from now. */
export function hoursText(hours: Hours, t = now()): string {
  const d = new Date(t);
  if (isOpen(hours, t)) {
    const today = hours[d.getDay()];
    const y = hours[(d.getDay() + 6) % 7];
    const h = d.getHours() + d.getMinutes() / 60;
    const close = y && y[1] < y[0] && h < y[1] ? y[1] : today![1];
    return `Open until ${hh(close)}`;
  }
  for (let i = 0; i < 8; i++) {
    const day = (d.getDay() + i) % 7;
    const o = hours[day];
    if (!o) continue;
    if (i === 0 && d.getHours() + d.getMinutes() / 60 >= o[0]) continue;
    const name = i === 0 ? '' : i === 1 ? ' tomorrow' : ` ${new Date(d.getFullYear(), d.getMonth(), d.getDate() + i).toLocaleDateString([], { weekday: 'long' })}`;
    return `Closed. Opens${name} at ${hh(o[0])}`;
  }
  return 'Closed';
}
