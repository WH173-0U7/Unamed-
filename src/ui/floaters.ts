/**
 * Floating numbers: a change to one of your numbers (cash, blood, heat...)
 * rises from where that number lives, glows a moment and fades. Several at
 * once stack under each other; the same thing changing again quickly adds up
 * in the one that's already showing.
 */
export type Tone = 'good' | 'bad' | 'neutral';

export interface Float {
  /** What it's about (merges repeats): 'cash', 'heat', 'weed'... */
  stat: string;
  /** The amount (in the stat's own unit), for merging. */
  value: number;
  /** How it reads, from the amount. */
  text: (v: number) => string;
  tone: (v: number) => Tone;
  /** Where it rises from: tried in order, the first one on screen. */
  anchors: (Element | null | undefined)[];
  /** Over the start of its anchor (a number written at the left), not its middle. */
  start?: boolean;
  /** Under its anchor (a block at the top of the screen), stacking down, instead of rising over it. */
  below?: boolean;
}

type Live = { el: HTMLElement; stat: string; value: number; at: number; key: string; slot: number; float: Float };

const live: Live[] = [];
const MERGE_MS = 400;
const LIFE_MS = 1250;
const STACK = 18;
const MAX_PER_ANCHOR = 4;

const visible = (el: Element | null | undefined): el is Element => {
  if (!el || !(el as HTMLElement).isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
};

function place(l: Live, r: { left: number; top: number; width: number; bottom: number }) {
  const el = l.el;
  el.style.top = `${Math.round((l.float.below ? r.bottom + 6 : r.top) + l.slot * STACK)}px`;
  // (Centred on its anchor, but all of it on the screen.)
  const half = el.offsetWidth / 2;
  const x = l.float.start ? r.left + half : r.left + r.width / 2;
  el.style.left = `${Math.round(Math.min(innerWidth - half - 6, Math.max(half + 6, x)))}px`;
}

/** Shows one change (or adds it to the same one still showing). */
export function floatChange(f: Float) {
  const t = performance.now();
  // (The same stat again, quickly: it adds up.)
  const same = live.find((x) => x.stat === f.stat && t - x.at < MERGE_MS);
  if (same) {
    same.value += f.value;
    same.at = t;
    same.el.textContent = f.text(same.value);
    same.el.dataset.tone = f.tone(same.value);
    same.el.classList.remove('go');
    void same.el.offsetWidth;
    same.el.classList.add('go');
    return;
  }
  const a = f.anchors.find(visible);
  const key = a ? (a.id || a.className || 'a') : 'top';
  const r = a ? a.getBoundingClientRect() : { left: innerWidth / 2 - 40, top: 64, width: 80, bottom: 64 };
  const mine = live.filter((x) => x.key === key);
  // (Only so many at one spot: the oldest goes.)
  if (mine.length >= MAX_PER_ANCHOR) drop(mine[0]);
  const used = new Set(live.filter((x) => x.key === key).map((x) => x.slot));
  let slot = 0;
  while (used.has(slot)) slot++;
  const el = document.createElement('div');
  el.className = `floater${f.below ? ' down' : ''}`;
  el.dataset.tone = f.tone(f.value);
  el.textContent = f.text(f.value);
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  const l: Live = { el, stat: f.stat, value: f.value, at: t, key, slot, float: f };
  live.push(l);
  place(l, r);
  el.classList.add('go');
  el.addEventListener('animationend', () => drop(l));
  // (Belt and braces: never left behind.)
  window.setTimeout(() => drop(l), LIFE_MS + 600);
}

function drop(l: Live) {
  const i = live.indexOf(l);
  if (i >= 0) live.splice(i, 1);
  l.el.remove();
}

/** Clears them all (a new game, the menu). */
export function clearFloats() {
  for (const l of [...live]) drop(l);
}
