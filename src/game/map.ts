/**
 * The city, as a map: a grid of avenues (north–south) and streets (east–west),
 * two old roads cutting across, and everywhere you can go at a fixed spot on
 * it. Addresses you know sit on their own street, by house number; a car sits
 * where it was parked. Drawn the way the rest of the game is: thin lines in
 * the dark, a red/cyan fringe, the same symbols as everything else.
 */
import type { Place } from './shops';

/** The map's own grid (the SVG viewBox). Portrait, so it fits a phone. */
export const MAP_W = 300;
export const MAP_H = 420;

/** Avenues run up and down. */
const AVES: Record<string, number> = { 'Kestrel Ave': 30, 'Halsey Ave': 90, 'Grand Ave': 150, 'Fulton Ave': 210, 'Cobb Ave': 270 };
/** Streets run across. */
const STS: Record<string, number> = { 'Alder St': 40, 'Larkin St': 95, 'Pruitt St': 150, 'Ninth St': 205, 'Delmar St': 260, 'Bellamy St': 315, 'Ivy St': 370 };
/** Two old roads, on the slant: from one end to the other. */
const ROADS: Record<string, [number, number, number, number]> = { 'Wexford Rd': [0, 345, 300, 125], 'Tanner Rd': [60, 0, 300, 185] };
/** A lane and a court: short dead ends. */
const STUBS: Record<string, [number, number, number, number]> = { 'Orchard Ln': [90, 232, 150, 232], 'Sorrel Ct': [240, 95, 240, 150] };

/** Where each place is (the middle of its block, set back off the corner). */
export const PLACE_AT: Partial<Record<Place, { x: number; y: number; addr: string }>> = {
  street: { x: 150, y: 205, addr: 'Grand Ave and Ninth St' },
  pharmacy: { x: 178, y: 120, addr: 'Grand Ave and Larkin St' },
  gas: { x: 238, y: 285, addr: 'Fulton Ave and Delmar St' },
  pawn: { x: 118, y: 175, addr: 'Halsey Ave, off Pruitt St' },
  room: { x: 270, y: 178, addr: 'Cobb Ave, near Ninth St' },
  fence: { x: 62, y: 230, addr: 'Behind the laundromat, off Ninth St' },
  liquor: { x: 122, y: 285, addr: 'Grand Ave and Delmar St' },
  hospital: { x: 58, y: 66, addr: 'Kestrel Ave and Alder St' },
  guns: { x: 268, y: 340, addr: 'Cobb Ave, past Bellamy St' },
  court: { x: 122, y: 66, addr: 'Grand Ave and Alder St' },
  records: { x: 238, y: 66, addr: 'Fulton Ave and Alder St' },
  bank: { x: 238, y: 122, addr: 'Fulton Ave and Larkin St' },
  plasma: { x: 178, y: 340, addr: 'Grand Ave, past Bellamy St' },
};

/** A number from a string (the same string, the same number). */
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
};

/** Where an address is: on its street, by its number ("115 Fulton Ave, Apt 3C"). */
export function addressAt(addr: string, salt = ''): { x: number; y: number } {
  const num = Number(/^(\d+)/.exec(addr)?.[1] ?? 0);
  const t = 0.06 + 0.88 * (((num % 997) / 997 + hash(addr + salt) * 0.1) % 1);
  for (const [name, x] of Object.entries(AVES)) if (addr.includes(name)) return { x: x + (num % 2 ? 7 : -7), y: 12 + t * (MAP_H - 24) };
  for (const [name, y] of Object.entries(STS)) if (addr.includes(name)) return { x: 12 + t * (MAP_W - 24), y: y + (num % 2 ? 7 : -7) };
  for (const [name, [x1, y1, x2, y2]] of Object.entries({ ...ROADS, ...STUBS })) if (addr.includes(name)) return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t - 6 };
  // (Nowhere on the map: somewhere off a side street.)
  return { x: 20 + hash(addr) * (MAP_W - 40), y: 20 + hash(addr + 'y') * (MAP_H - 40) };
}

/** How far, in blocks (walking the grid, not as the crow flies). */
export const blocksBetween = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(0, Math.round((Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) / 57));

export interface MapMark {
  /** What tapping it picks ("place:pawn", "home:ab12", "car:cd34"). */
  key: string;
  x: number;
  y: number;
  /** Path data on a 24 × 24 grid, stroked. */
  icon: string;
  tone: 'place' | 'shut' | 'home' | 'car';
  label: string;
  here?: boolean;
  picked?: boolean;
}

/** The symbols for places. */
export const PLACE_ICON: Record<string, string> = {
  street: 'M12 21V8.5 M12 8.5c0-3 2-5 5-5 M15 3.5h4.5l-.6 2.3h-3.3z M9 21h6',
  pharmacy: 'M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z',
  gas: 'M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v15.5 M3.5 20.5h12 M5 9.5h9 M14 8.5l3.5 2.5v6a1.5 1.5 0 0 0 3 0V9.5l-2.5-2.5',
  pawn: 'M12 4.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M6.5 14a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M17.5 14a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M12 9.5V12 M8.3 14.7L12 12l3.7 2.7',
  room: 'M3 19.5v-11 M3 15h18v4.5 M7 11a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 1 0 0-3.5 M10.5 15v-3.5h7A3.5 3.5 0 0 1 21 15',
  fence: 'M3 5h18v14H3z M3 9.7h18 M3 14.3h18 M9 5v4.7 M15 5v4.7 M6 9.7v4.6 M12 9.7v4.6 M18 9.7v4.6 M9 14.3V19 M15 14.3V19',
  liquor: 'M10 2.5h4v4l2 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-11l2-3z M8 13h8 M8 16.5h8',
  hospital: 'M12 2.5a9.5 9.5 0 1 0 0 19a9.5 9.5 0 1 0 0-19 M8.5 7.5v9 M15.5 7.5v9 M8.5 12h7',
  guns: 'M2.5 7.5h18v4.5h-8l-1.2 3h-2.6l.6-3H7.5l-1.8 6.5H2.8L4.5 12H2.5z M20.5 9.5h1',
  court: 'M3 9.5L12 4l9 5.5z M5.5 9.5v8 M10 9.5v8 M14 9.5v8 M18.5 9.5v8 M3 20.5h18 M4 17.5h16',
  records: 'M6 2.5h9l3.5 3.5v15.5H6z M15 2.5V6h3.5 M9 10h6.5 M9 13.5h6.5 M9 17h4',
  bank: 'M3 9L12 4l9 5z M5 9v9 M19 9v9 M3 20.5h18 M12 10.5v7 M14 12c0-1-1-1.5-2-1.5s-2 .5-2 1.5 1 1.4 2 1.6 2 .6 2 1.6-1 1.5-2 1.5-2-.5-2-1.5',
  plasma: 'M12 3.5c3.2 4.2 5.5 7.2 5.5 10.2a5.5 5.5 0 0 1-11 0c0-3 2.3-6 5.5-10.2z M9.4 14.2a2.6 2.6 0 0 0 2.6 2.6',
  home: 'M3.5 11L12 4l8.5 7 M5.5 9.5V20h13V9.5 M10 20v-5h4v5',
  car: 'M3.5 15.5v-3l2-5h13l2 5v3 M3.5 15.5h17v3H18v-1.5H6v1.5H3.5z M6 12.5h12 M7 15.5h.01 M17 15.5h.01',
};

/** A number from two others (the same block, the same buildings, every time). */
const rnd = (a: number, b: number) => hash(`${a}:${b}`);

/**
 * What the city is made of, under the streets: the buildings on every block
 * (each its own footprint, the same every time), the park with its trees and
 * pond, the rail line across the top, the river with its bridge, and the
 * names people call the parts of town.
 */
function decorSvg(): string {
  const xs = [0, ...Object.values(AVES), MAP_W];
  const ys = [0, ...Object.values(STS), MAP_H - 24];
  const blds: string[] = [];
  const lit: string[] = [];
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + 5;
      const x1 = xs[i + 1] - 5;
      const y0 = ys[j] + 5;
      const y1 = ys[j + 1] - 5;
      if (x1 - x0 < 8 || y1 - y0 < 8) continue;
      // The park's block is the park.
      if (xs[i] === 150 && ys[j] === 205) continue;
      // Split the block into two or three buildings, one way or the other.
      const n = 1 + Math.floor(rnd(i, j) * 3);
      const across = rnd(j, i) < 0.5;
      let at = across ? x0 : y0;
      const end = across ? x1 : y1;
      for (let k = 0; k < n; k++) {
        const share = k === n - 1 ? end - at : (end - at) * (0.35 + rnd(i * 7 + k, j) * 0.3);
        const w = Math.max(4, share - 2);
        const bx = across ? at : x0;
        const by = across ? y0 : at;
        const bw = across ? w : x1 - x0;
        const bh = across ? y1 - y0 : w;
        const tone = 0.025 + rnd(i + k, j * 3) * 0.035;
        blds.push(`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.2" fill="rgba(236,235,230,${tone.toFixed(3)})"/>`);
        // A lit window or two, here and there.
        if (rnd(i * 3 + k, j * 5) < 0.45) lit.push(`<rect x="${(bx + bw * rnd(k, i + j)).toFixed(1)}" y="${(by + bh * rnd(j, k + i)).toFixed(1)}" width="1.6" height="1.6"/>`);
        at += share;
      }
    }
  // The park: grass, a path, trees, a pond.
  const trees = Array.from({ length: 9 }, (_, k) => `<circle cx="${(160 + rnd(k, 1) * 40).toFixed(1)}" cy="${(214 + rnd(k, 2) * 36).toFixed(1)}" r="${(1.6 + rnd(k, 3) * 1.4).toFixed(1)}"/>`).join('');
  const park = `<rect class="park" x="155" y="210" width="50" height="45" rx="3"/><path class="park-path" d="M155 250 Q170 236 182 238 T205 214"/><ellipse class="pond" cx="190" cy="243" rx="7" ry="4"/><g class="trees">${trees}</g>`;
  // The river, its ripples, and the bridge Grand Ave crosses it on.
  const river = `<text class="area river-name" x="120" y="414" text-anchor="middle">THE RIVER</text><path class="river" d="M0 398 C60 388 120 410 180 400 S260 392 300 404 L300 420 L0 420Z"/>` + `<path class="ripple" d="M20 409 q6 -2 12 0 M70 412 q6 -2 12 0 M120 408 q6 -2 12 0 M205 410 q6 -2 12 0 M255 413 q6 -2 12 0"/>` + `<rect class="bridge" x="143" y="392" width="14" height="22" rx="1"/>`;
  // The rail line along the top, with its ties.
  const ties = Array.from({ length: 31 }, (_, k) => `M${k * 10 + 2} 10v6`).join(' ');
  const rail = `<path class="rail" d="M0 11.5h300 M0 14.5h300"/><path class="ties" d="${ties}"/>`;
  // What the parts of town are called.
  const districts = [
    [205, 34, 'DOWNTOWN'],
    [62, 186, 'THE FLATS'],
    [236, 248, 'OLD TOWN'],
    [86, 352, 'SOUTHSIDE'],
  ]
    .map(([x, y, t]) => `<text class="district" x="${x}" y="${y}" text-anchor="middle">${t}</text>`)
    .join('');
  return `${river}${rail}<g class="blds">${blds.join('')}</g><g class="lit">${lit.join('')}</g>${park}<g class="districts">${districts}</g>`;
}
/** Over the streets: landmarks that aren't places to go, a compass, the scale. */
function overSvg(): string {
  const mark = (x: number, y: number, d: string, label: string, anchor = 'middle') =>
    `<g class="landmark"><path transform="translate(${x - 4} ${y - 4}) scale(0.34)" d="${d}"/><text x="${x}" y="${y + 9}" text-anchor="${anchor}">${label}</text></g>`;
  const marks = [
    mark(66, 128, 'M12 2.5v19 M6 8h12 M7 21.5h10', 'ST. AGNES'),
    mark(18, 223, 'M5 5h14v14H5z M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'LAUNDROMAT', 'start'),
    mark(282, 30, 'M8 21.5l2-11h4l2 11 M7 10.5h10v-4a5 5 0 0 0-10 0z', 'WATER TOWER'),
    mark(26, 292, 'M3 20h18 M5 20V9l7-5 7 5v11 M9 20v-6h6v6', 'SHELTER', 'start'),
  ].join('');
  // A compass, and how long a block is.
  const compass = `<g class="compass" transform="translate(281 64)"><circle r="8"/><path d="M0 -6.5L2 0H-2Z" class="n"/><path d="M0 6.5L2 0H-2Z"/><text y="-10" text-anchor="middle">N</text></g>`;
  const scale = `<g class="scale"><path d="M4 27h57 M4 24.5v5 M61 24.5v5"/><text x="32" y="22.5" text-anchor="middle">1 BLOCK</text></g>`;
  return `<g class="landmarks">${marks}</g>${compass}${scale}`;
}

/** The streets themselves, as SVG. */
function streetsSvg(): string {
  const lines: string[] = [];
  const labels: string[] = [];
  for (const [name, x] of Object.entries(AVES)) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${MAP_H}"/>`);
    labels.push(`<text x="${x + 3}" y="${MAP_H - 6}" transform="rotate(-90 ${x + 3} ${MAP_H - 6})">${name.toUpperCase()}</text>`);
  }
  for (const [name, y] of Object.entries(STS)) {
    lines.push(`<line x1="0" y1="${y}" x2="${MAP_W}" y2="${y}"/>`);
    labels.push(`<text x="36" y="${y - 3}">${name.toUpperCase()}</text>`);
  }
  for (const [name, [x1, y1, x2, y2]] of Object.entries(ROADS)) {
    lines.push(`<line class="road" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
    const a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    // (Along the road where nothing else is written.)
    const at = name === 'Tanner Rd' ? 0.3 : 0.62;
    const mx = x1 + (x2 - x1) * at;
    const my = y1 + (y2 - y1) * at;
    labels.push(`<text x="${mx}" y="${my - 3}" transform="rotate(${a.toFixed(1)} ${mx} ${my})">${name.toUpperCase()}</text>`);
  }
  for (const [name, [x1, y1, x2, y2]] of Object.entries(STUBS)) {
    lines.push(`<line class="stub" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
    labels.push(x1 === x2 ? `<text x="${x1 + 3}" y="${y2 - 2}" transform="rotate(-90 ${x1 + 3} ${y2 - 2})">${name.toUpperCase()}</text>` : `<text x="${x1 + 3}" y="${y1 - 3}">${name.toUpperCase()}</text>`);
  }
  return `<svg class="map-streets" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="none" aria-hidden="true">${decorSvg()}<g class="lines">${lines.join('')}</g><g class="labels">${labels.join('')}</g>${overSvg()}</svg>`;
}

/** The map, with everything on it. */
export function mapHtml(marks: MapMark[]): string {
  const pins = marks
    .map(
      (m) =>
        `<button type="button" class="map-pin${m.here ? ' here' : ''}${m.picked ? ' picked' : ''}" data-tone="${m.tone}" data-mappick="${m.key}" aria-label="${m.label}" style="left:${((100 * m.x) / MAP_W).toFixed(2)}%;top:${((100 * m.y) / MAP_H).toFixed(2)}%"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${m.icon}"/></svg>${m.here ? '<em class="map-you">YOU</em>' : ''}</button>`,
    )
    .join('');
  return `<div class="map">${streetsSvg()}${pins}</div>`;
}
