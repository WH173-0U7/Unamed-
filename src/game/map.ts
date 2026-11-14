/**
 * The city, as a map: a grid of avenues (north–south) and streets (east–west),
 * two old roads cutting across, and everywhere you can go at a fixed spot on
 * it. Addresses you know sit on their own street, by house number; a car sits
 * where it was parked. Drawn like a city plan at night: blocks and the
 * buildings on them, the roads over them, the names along the roads.
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
  fence: { x: 71, y: 230, addr: 'Behind the laundromat, off Ninth St' },
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
  // (No house number, "on Fulton Ave": anywhere along it, not bunched at one end.)
  const t = 0.06 + 0.88 * (num ? ((num % 997) / 997 + hash(addr + salt) * 0.1) % 1 : hash(addr + salt));
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
  tone: 'place' | 'shut' | 'home' | 'car' | 'corner';
  label: string;
  here?: boolean;
  picked?: boolean;
}

/** The symbols for places. */
export const PLACE_ICON: Record<string, string> = {
  // (One set: a 24 grid, outlines only, everything centred on 12,12 and kept inside 3..21.)
  street: 'M6.75 21h7 M10.25 21V7.5 M10.25 7.5c0-2.2 1.6-4 4-4h.5 M13.25 3.5h4.5l-.75 2.75h-3z',
  pharmacy: 'M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z',
  gas: 'M5 20.5V5.5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15 M3.5 20.5h12 M7.5 7h4v3.5h-4z M14 10h2a1.5 1.5 0 0 1 1.5 1.5v4.5a1.5 1.5 0 0 0 3 0V8L18 5.5',
  pawn: 'M12 4a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M6.5 14.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M17.5 14.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M12 9v3 M8.3 15.2L12 12l3.7 3.2',
  room: 'M3 17.5v-11 M3 13h18v4.5 M7 9a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 1 0 0-3.5 M10.5 13V9.5h7A3.5 3.5 0 0 1 21 13',
  fence: 'M3 6h18v12H3z M3 10h18 M3 14h18 M9 6v4 M15 6v4 M6 10v4 M12 10v4 M18 10v4 M9 14v4 M15 14v4',
  liquor: 'M10 3h4v3.5l2 3V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9.5l2-3z M8 13h8 M8 16.5h8',
  hospital: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M9 8v8 M15 8v8 M9 12h6',
  guns: 'M2.5 6.5h18V11h-8l-1.2 3h-2.6l.6-3H7.5l-1.8 6.5H2.8L4.5 11H2.5z M20.5 8.5h1',
  court: 'M12 3.5v17 M8 20.5h8 M5 7h14 M5 7l-2.5 6a2.5 2.5 0 0 0 5 0z M19 7l-2.5 6a2.5 2.5 0 0 0 5 0z',
  records: 'M5.5 3h9l4 4v14h-13z M14.5 3v4h4 M8.5 10.5h7 M8.5 14h7 M8.5 17.5h4.5',
  bank: 'M3 9.5L12 4.5l9 5z M3 20h18 M5 17.5h14 M6 9.5v8 M10 9.5v8 M14 9.5v8 M18 9.5v8',
  plasma: 'M12 4c3.2 4.2 5.5 7.2 5.5 10.2a5.5 5.5 0 0 1-11 0c0-3 2.3-6 5.5-10.2z M9.4 14.7a2.6 2.6 0 0 0 2.6 2.6',
  home: 'M3.5 11L12 4l8.5 7 M5.5 9.5V20h13V9.5 M10 20v-5h4v5',
  car: 'M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11 M3.5 17v-4.5A1.5 1.5 0 0 1 5 11h14a1.5 1.5 0 0 1 1.5 1.5V17z M5.5 17v2 M18.5 17v2 M7 14h1.5 M15.5 14H17',
  corner: 'M12 21v-9 M12 3.5v2 M5 5.5h11l3 2.5-3 2.5H5z M8.5 21h7',
  building: 'M5 21V5.5L12 3l7 2.5V21 M3 21h18 M9 8h.01 M15 8h.01 M9 12h.01 M15 12h.01 M10.5 21v-4.5h3V21',
  bar: 'M5 4h14l-7 8z M12 12v8 M8 20h8 M7.5 6.5h9',
  church: 'M12 3v4.5 M10 5h4 M5 21V12l7-4.5 7 4.5v9 M3 21h18 M10 21v-4a2 2 0 0 1 4 0v4',
  shelter: 'M3 20h18 M5 20V9l7-5 7 5v11 M9 20v-6h6v6',
  vacant: 'M4 20.5V9l8-6 8 6v11.5 M3 20.5h18 M8 11l3 3 M11 11l-3 3 M13 15l3 3 M16 15l-3 3',
  warehouse: 'M3 20.5V9l9-5 9 5v11.5 M3 20.5h18 M7 20.5v-8h10v8 M7 15h10 M7 17.75h10',
  school: 'M2.5 9.5L12 5l9.5 4.5L12 14z M7 11.5V16c0 1.5 2.5 3 5 3s5-1.5 5-3v-4.5 M21.5 9.5v5',
  lot: 'M4 4h16v16H4z M9.5 16.5v-9h3.2a2.7 2.7 0 0 1 0 5.4H9.5',
  laundromat: 'M5 3h14v18H5z M5 7h14 M12 10a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M8 5h.01',
  tower: 'M8 21l1.5-9.5h5L16 21 M7 11.5h10v-4a5 5 0 0 0-10 0z M9.5 16h5',
};

/** A number from two others (the same block, the same buildings, every time). */
const rnd = (a: number, b: number) => hash(`${a}:${b}`);

/** How wide each kind of road is drawn (map units). */
const AVE_W = 8;
const ST_W = 6;
const ROAD_W = 5.5;
const STUB_W = 3.6;
/** Where the river starts, at the bottom. */
const RIVER_Y = MAP_H - 24;
/** Distance from a point to a road's centre line. */
const distTo = (px: number, py: number, [x1, y1, x2, y2]: [number, number, number, number]) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};
const SLANTS = Object.values(ROADS);
/** How near a road's centre line comes to a building's edge (0: it runs through it). */
const roadToRect = (r: [number, number, number, number], x: number, y: number, w: number, h: number) => {
  const [x1, y1, x2, y2] = r;
  const inside = (px: number, py: number) => px >= x && px <= x + w && py >= y && py <= y + h;
  // (Crosses an edge, or starts inside: it runs through.)
  const cross = (ax: number, ay: number, bx: number, by: number) => {
    const d = (x2 - x1) * (by - ay) - (y2 - y1) * (bx - ax);
    if (!d) return false;
    const t = ((ax - x1) * (by - ay) - (ay - y1) * (bx - ax)) / d;
    const u = ((ax - x1) * (y2 - y1) - (ay - y1) * (x2 - x1)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  const c: [number, number][] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  if (inside(x1, y1) || inside(x2, y2) || c.some((p, k) => cross(p[0], p[1], c[(k + 1) % 4][0], c[(k + 1) % 4][1]))) return 0;
  const toRect = (px: number, py: number) => Math.hypot(Math.max(x - px, 0, px - x - w), Math.max(y - py, 0, py - y - h));
  return Math.min(...c.map(([px, py]) => distTo(px, py, r)), toRect(x1, y1), toRect(x2, y2));
};
/** Clear of the slanted roads and the lane and court (nothing built on a road). */
const clear = (x: number, y: number, w: number, h: number) =>
  SLANTS.every((r) => roadToRect(r, x, y, w, h) > ROAD_W / 2 + 0.8) && Object.values(STUBS).every((r) => roadToRect(r, x, y, w, h) > STUB_W / 2 + 0.6);
const f1 = (n: number) => n.toFixed(1);

/** What part of town a block is in (the district names on the map). */
export function districtOf(cx: number, cy: number): District {
  if (cy < 150 && cx > 120) return 'downtown';
  if (cy >= 260) return 'southside';
  if (cx >= 150) return 'oldtown';
  return 'flats';
}

/** What a building on the map is (every one of them is something). */
export type BuildingKind =
  | 'house'
  | 'rowhouse'
  | 'apartment'
  | 'tower'
  | 'shop'
  | 'garage'
  | 'lot'
  | 'place'
  | 'bar'
  | 'church'
  | 'shelter'
  | 'laundromat'
  | 'school'
  | 'vacant'
  | 'warehouse';
export type District = 'downtown' | 'flats' | 'oldtown' | 'southside';
export interface Building {
  /** From where it stands ("b123-88"): the same building, every time. */
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  district: District;
  kind: BuildingKind;
  /** A place you can go to (the pharmacy, the pawn shop): it's in this building. */
  place?: Place;
  /** Its name, if it has one ("The Blue Lantern"). */
  name?: string;
  /** Its grey, on the map. */
  fill: string;
  /** Its footprint, when it isn't a plain rectangle (an L, a notch, a courtyard, a corner cut along a slanted road): corners in order, clockwise. Always inside x, y, w, h, and never over its centre. */
  shape?: [number, number][];
}
/** Somewhere to stand and sell: a corner. */
export interface Corner {
  id: string;
  name: string;
  x: number;
  y: number;
  district: District;
}
/** The corners you can work (two or three in each part of town). Grand & Ninth, by the park, is where you start. */
export const CORNERS: Corner[] = [
  { id: 'grand-ninth', name: 'Grand & Ninth', x: 150, y: 205, district: 'flats' },
  { id: 'halsey-pruitt', name: 'Halsey & Pruitt', x: 90, y: 150, district: 'flats' },
  { id: 'kestrel-delmar', name: 'Kestrel & Delmar', x: 30, y: 260, district: 'flats' },
  { id: 'fulton-larkin', name: 'Fulton & Larkin', x: 210, y: 95, district: 'downtown' },
  { id: 'cobb-larkin', name: 'Cobb & Larkin', x: 270, y: 95, district: 'downtown' },
  { id: 'fulton-ninth', name: 'Fulton & Ninth', x: 210, y: 205, district: 'oldtown' },
  { id: 'cobb-delmar', name: 'Cobb & Delmar', x: 270, y: 260, district: 'oldtown' },
  { id: 'halsey-bellamy', name: 'Halsey & Bellamy', x: 90, y: 315, district: 'southside' },
  { id: 'fulton-bellamy', name: 'Fulton & Bellamy', x: 210, y: 315, district: 'southside' },
  { id: 'grand-ivy', name: 'Grand & Ivy', x: 150, y: 370, district: 'southside' },
];
export const DEFAULT_CORNER = 'grand-ninth';
export const cornerById = (id: unknown) => CORNERS.find((c) => c.id === id);

/** Where the special buildings stand: the nearest building to each point is that one. */
const BARS: [number, number, string][] = [
  [172, 92, 'The Blue Lantern'],
  [258, 128, 'Low Tide'],
  [228, 175, 'The Anchor Room'],
  [252, 236, 'Rosie’s'],
];
const LANDMARK_AT: [number, number, BuildingKind, string][] = [
  [66, 128, 'church', 'St. Agnes'],
  [18, 223, 'laundromat', 'Suds & Duds Laundromat'],
  [26, 292, 'shelter', 'Harbor Light Shelter'],
  [58, 342, 'school', 'Delmar Elementary'],
];

/** The ground plan: every block, and every building and lot on it. Worked out once. */
let plan: { blocks: string[]; lots: Building[]; blds: Building[] } | null = null;
function layout() {
  if (plan) return plan;
  const xs = [0, ...Object.values(AVES), MAP_W];
  const ys = [0, ...Object.values(STS), RIVER_Y];
  const halfX = (x: number) => (x === 0 || x === MAP_W ? 0 : AVE_W / 2);
  const halfY = (y: number) => (y === 0 || y === RIVER_Y ? 0 : ST_W / 2);
  const blocks: string[] = [];
  const blds: Building[] = [];
  const lots: Building[] = [];
  const ids = new Set<string>();
  const make = (x: number, y: number, w: number, h: number, kind: BuildingKind, fill: string): Building => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    let id = `b${Math.round(cx)}-${Math.round(cy)}`;
    for (let n = 2; ids.has(id); n++) id = `b${Math.round(cx)}-${Math.round(cy)}-${n}`;
    ids.add(id);
    return { id, x, y, w, h, cx, cy, district: districtOf(cx, cy), kind, fill };
  };
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      // The block, out to the curb (a sidewalk all round, rounded at the corners).
      const bx0 = xs[i] + halfX(xs[i]) + 0.6;
      const bx1 = xs[i + 1] - halfX(xs[i + 1]) - 0.6;
      const by0 = Math.max(ys[j] + halfY(ys[j]) + 0.6, j === 0 ? 19 : 0);
      const by1 = ys[j + 1] - halfY(ys[j + 1]) - 0.6;
      if (bx1 - bx0 < 6 || by1 - by0 < 6) continue;
      blocks.push(`<rect x="${f1(bx0)}" y="${f1(by0)}" width="${f1(bx1 - bx0)}" height="${f1(by1 - by0)}" rx="2.2"/>`);
      // Inside the sidewalk: the lots.
      const x0 = bx0 + 1.8;
      const x1 = bx1 - 1.8;
      const y0 = by0 + 1.8;
      const y1 = by1 - 1.8;
      const w = x1 - x0;
      const h = y1 - y0;
      // The park's block is the park.
      if (xs[i] === 150 && ys[j] === 205) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const d = districtOf(cx, cy);
      const r = rnd(i * 13 + 1, j * 7 + 2);
      const tone = (k: number) => {
        const t = rnd(i * 31 + k, j * 17 + k);
        const g = Math.round(d === 'downtown' ? 46 + t * 24 : 36 + t * 26);
        return `rgb(${g},${g},${g + 3})`;
      };
      const bld = (x: number, y: number, bw: number, bh: number, k: number, kind: BuildingKind) => {
        if (bw < 1.6 || bh < 1.6 || !clear(x, y, bw, bh)) return;
        blds.push(make(x, y, bw, bh, kind, tone(k)));
      };
      // A parking lot, now and then (not downtown's every block).
      // (Not where a road cuts through: then it's built on, round the road.)
      const lw = w * (0.45 + rnd(i, j + 9) * 0.3);
      const lx = rnd(j, i + 3) < 0.5 ? x0 : x1 - lw;
      if (r < (d === 'downtown' ? 0.12 : 0.1) && w > 20 && clear(lx, y0, lw, h)) {
        lots.push(make(lx, y0, lw, h, 'lot', 'url(#m-stalls)'));
        // The rest of the block: a couple of buildings.
        const ox = lx === x0 ? x0 + lw + 1 : x0;
        const ow = w - lw - 1;
        bld(ox, y0, ow, h * 0.45, 1, 'shop');
        bld(ox, y0 + h * 0.55, ow, h * 0.45, 2, d === 'downtown' ? 'tower' : 'apartment');
        continue;
      }
      if (d === 'downtown') {
        // Big footprints: towers and office blocks, two or three to a block, a plaza between.
        const n = 2 + Math.floor(rnd(i + 5, j) * 2);
        let at = x0;
        for (let k = 0; k < n; k++) {
          const bw = k === n - 1 ? x1 - at : (w / n) * (0.8 + rnd(k, i + j) * 0.4);
          const top = y0 + (rnd(k + 3, j) < 0.3 ? h * 0.12 : 0);
          const bot = y1 - (rnd(k + 4, i) < 0.3 ? h * 0.15 : 0);
          const u = rnd(k + 7, i * 3 + j);
          const kind = u < 0.5 ? 'tower' : u < 0.8 ? 'shop' : 'apartment';
          // (A road through it: two smaller buildings, either side of the road, where they fit.)
          if (clear(at, top, bw - 1.4, bot - top)) bld(at, top, bw - 1.4, bot - top, k, kind);
          else
            for (const [py, ph] of [[top, (bot - top) * 0.3], [top + (bot - top) * 0.35, (bot - top) * 0.3], [top + (bot - top) * 0.7, (bot - top) * 0.3]])
              for (const [px, pw] of bw - 1.4 < 14 ? [[at, bw - 1.4]] : [[at, (bw - 1.4) * 0.48], [at + (bw - 1.4) * 0.52, (bw - 1.4) * 0.48]]) bld(px, py, pw, ph, k + Math.round(py), kind);
          at += bw;
        }
        continue;
      }
      // Row houses along both street fronts: narrow lots, varied depths, yards behind, an alley down the middle.
      const alley = h > 22;
      const depthMax = alley ? (h - 3) / 2 : h;
      const unit = d === 'southside' ? 5.2 : d === 'flats' ? 6.2 : 7.4;
      for (const side of alley ? [0, 1] : [0]) {
        let at = x0;
        let k = side * 50;
        while (at < x1 - 2) {
          const lw = Math.min(x1 - at, unit * (0.75 + rnd(k + i * 3, j + side) * 0.6));
          k++;
          // An empty lot, sometimes.
          if (rnd(k, i * 5 + j + side) < 0.07) {
            at += lw;
            continue;
          }
          const depth = depthMax * (0.45 + rnd(i + k, j * 3 + side) * 0.45);
          const y = side === 0 ? y0 : y1 - depth;
          // (On the corner, a corner shop now and then; a deep one, flats over the top; out in Old Town, a house of its own.)
          const corner = at === x0 || at + lw >= x1 - 0.01;
          const u = rnd(k * 7 + 3, i * 11 + j + side);
          const kind: BuildingKind = corner && u < 0.3 ? 'shop' : depth > 13 && u > 0.75 ? 'apartment' : d === 'oldtown' && lw > 7.6 ? 'house' : 'rowhouse';
          bld(at + 0.3, y, lw - 0.6, depth, k, kind);
          // A shed or garage out back, sometimes, on the alley.
          if (alley && rnd(k * 3, i + j) < 0.18) {
            const sd = 2.4;
            bld(at + lw * 0.2, side === 0 ? y0 + depthMax - sd : y1 - depthMax, lw * 0.6, sd, k + 99, 'garage');
          }
          at += lw;
        }
      }
    }
  // What's in them: the places you can go, a church, bars, a shelter, a school; down by the river, warehouses; here and there, one standing empty.
  const plain = (b: Building) => (b.kind === 'house' || b.kind === 'rowhouse' || b.kind === 'apartment' || b.kind === 'tower' || b.kind === 'shop') && b.w * b.h >= 14;
  const nearest = (x: number, y: number) => {
    let best: Building | undefined;
    let bd = Infinity;
    for (const b of blds) {
      if (!plain(b)) continue;
      const d = Math.hypot(b.cx - x, b.cy - y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  };
  for (const [p, at] of Object.entries(PLACE_AT) as [Place, { x: number; y: number }][]) {
    if (p === 'street') continue;
    const b = nearest(at.x, at.y);
    if (b) {
      b.kind = 'place';
      b.place = p;
    }
  }
  for (const [x, y, kind, name] of LANDMARK_AT) {
    const b = nearest(x, y);
    if (b) {
      b.kind = kind;
      b.name = name;
    }
  }
  for (const [x, y, name] of BARS) {
    const b = nearest(x, y);
    if (b) {
      b.kind = 'bar';
      b.name = name;
    }
  }
  // (The bottom row of blocks, between Ivy St and the river: the old industrial edge.)
  const edge = blds.filter((b) => plain(b) && b.cy > 372).sort((a, b) => b.w * b.h - a.w * a.h);
  edge.slice(0, 5).forEach((b) => (b.kind = 'warehouse'));
  const VACANT: Record<District, number> = { southside: 0.08, flats: 0.05, oldtown: 0.025, downtown: 0 };
  for (const b of blds) if ((b.kind === 'house' || b.kind === 'rowhouse') && hash(`${b.id}:empty`) < VACANT[b.district]) b.kind = 'vacant';
  for (const b of blds) b.shape = shapeOf(b);
  plan = { blocks, lots, blds };
  return plan;
}

/**
 * Not every building's a box: some are an L, a T, a U round a courtyard, or a
 * box with a corner notched out; the ones on a slanted road have the corner
 * cut along it. The big ones most often, row houses seldom (a row should read
 * as a row). Decided by the building's id, so it's the same every time. The
 * cuts never reach the middle, so its pin always stands on it.
 */
/** A well-mixed 0..1 from a string (for shapes only: the plain hash clusters on near-identical ids). */
const mix = (str: string) => {
  let h = Math.round(hash(str) * 4294967295) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
};
function shapeOf(b: Building): [number, number][] | undefined {
  const { x, y, w, h } = b;
  if (w < 3.2 || h < 3.2) return undefined;
  const u = mix(`${b.id}:shape`);
  const v = mix(`${b.id}:shape2`);
  // Clockwise from the top left, a cut corner made of the points given.
  const box = (k: number, cut: [number, number][]) => {
    const c: [number, number][] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    return [...c.slice(0, k), ...cut, ...c.slice(k + 1)];
  };
  const row = b.kind === 'rowhouse' || b.kind === 'garage' || b.kind === 'vacant';
  // (A row house only right on the road; anything bigger, if it's near.)
  const nearRoad = SLANTS.find((r) => roadToRect(r, x, y, w, h) < ROAD_W / 2 + (row ? 2.4 : 5.5));
  // On a slanted road: the corner nearest it, cut parallel to it (a row house, less often).
  if (nearRoad && w > 4 && h > 4 && u < (row ? 0.6 : 0.85)) {
    const [x1, y1, x2, y2] = nearRoad;
    const corners: [number, number][] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    // (Only the corners a cut along this road can run across: top right or bottom left on a road running down to the right.)
    const down = (x2 - x1) * (y2 - y1) > 0;
    let k = -1;
    let best = Infinity;
    corners.forEach(([px, py], i) => {
      if (down ? i % 2 === 0 : i % 2 === 1) return;
      const d = distTo(px, py, nearRoad);
      if (d < best) {
        best = d;
        k = i;
      }
    });
    if (k < 0) return undefined;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = Math.abs((x2 - x1) / len);
    const uy = Math.abs((y2 - y1) / len);
    const t = Math.min((0.46 * w) / ux, (0.46 * h) / uy);
    const a = t * ux; // along the top or bottom
    const c = t * uy; // along the side
    const [px, py] = corners[k];
    const sx = k === 0 || k === 3 ? 1 : -1;
    const sy = k === 0 || k === 1 ? 1 : -1;
    // (Clockwise: the point on the edge coming in, then the one going out.)
    const pts: [number, number][] = k === 0 || k === 2 ? [[px, py + sy * c], [px + sx * a, py]] : [[px + sx * a, py], [px, py + sy * c]];
    return box(k, pts);
  }
  const area = w * h;
  const big = (area > 70 && !row) || b.kind === 'warehouse' || b.kind === 'school' || b.kind === 'church' || b.kind === 'shelter' || b.kind === 'tower';
  const odds = b.kind === 'school' || b.kind === 'church' || b.kind === 'shelter' || b.kind === 'warehouse' ? 0.95 : big ? 0.65 : row ? 0.13 : area > 28 ? 0.4 : 0.15;
  if (u >= odds) return undefined;
  const corner = Math.floor(v * 4);
  const [cx0, cy0, cx1, cy1] = [x, y, x + w, y + h];
  const pick = mix(`${b.id}:kind`);
  // A courtyard, open on one side (big ones only).
  if (big && w > 9 && h > 9 && pick < 0.25) {
    const cw = w * 0.36;
    const cd = h * 0.34;
    const ax = x + (w - cw) / 2;
    return corner % 2
      ? [[cx0, cy0], [ax, cy0], [ax, cy0 + cd], [ax + cw, cy0 + cd], [ax + cw, cy0], [cx1, cy0], [cx1, cy1], [cx0, cy1]]
      : [[cx0, cy0], [cx1, cy0], [cx1, cy1], [ax + cw, cy1], [ax + cw, cy1 - cd], [ax, cy1 - cd], [ax, cy1], [cx0, cy1]];
  }
  // A T: both corners off one long side.
  if (w > 7 && pick < 0.45) {
    const cw = w * 0.28;
    const cd = h * 0.38;
    return corner % 2
      ? [[cx0 + cw, cy0], [cx1 - cw, cy0], [cx1 - cw, cy0 + cd], [cx1, cy0 + cd], [cx1, cy1], [cx0, cy1], [cx0, cy0 + cd], [cx0 + cw, cy0 + cd]]
      : [[cx0, cy0], [cx1, cy0], [cx1, cy1 - cd], [cx1 - cw, cy1 - cd], [cx1 - cw, cy1], [cx0 + cw, cy1], [cx0 + cw, cy1 - cd], [cx0, cy1 - cd]];
  }
  // An L (a big bite out of a corner), or a small notch.
  const f = pick < 0.75 ? 0.4 : 0.24;
  const cw = w * f;
  const cd = h * f;
  const c: [number, number][] = [[cx0, cy0], [cx1, cy0], [cx1, cy1], [cx0, cy1]];
  const [px, py] = c[corner];
  const sx = corner === 0 || corner === 3 ? 1 : -1;
  const sy = corner === 0 || corner === 1 ? 1 : -1;
  const pts: [number, number][] = corner === 0 || corner === 2
    ? [[px, py + sy * cd], [px + sx * cw, py + sy * cd], [px + sx * cw, py]]
    : [[px + sx * cw, py], [px + sx * cw, py + sy * cd], [px, py + sy * cd]];
  return box(corner, pts);
}
/** A building's footprint as SVG path data. */
export const shapePath = (b: Building, grow = 0): string => {
  if (!b.shape) return `M${f1(b.x - grow)} ${f1(b.y - grow)}h${f1(b.w + grow * 2)}v${f1(b.h + grow * 2)}h${f1(-(b.w + grow * 2))}z`;
  // (Grown outward from its middle: near enough, for an outline.)
  const pts = grow ? b.shape.map(([px, py]) => [px + Math.sign(px - b.cx) * grow, py + Math.sign(py - b.cy) * grow]) : b.shape;
  return `M${pts.map(([px, py]) => `${f1(px)} ${f1(py)}`).join('L')}z`;
};
/** Inside its footprint. */
const inShape = (pts: [number, number][], x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
/** How far a point is from a footprint's edge. */
const toShape = (pts: [number, number][], x: number, y: number) => Math.min(...pts.map(([ax, ay], i) => distTo(x, y, [ax, ay, pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1]])));

/** Every building on the map, and every parking lot. */
export const buildings = (): Building[] => {
  const p = layout();
  return [...p.blds, ...p.lots];
};
let byId: Map<string, Building> | null = null;
export const buildingById = (id: unknown): Building | undefined => {
  byId ??= new Map(buildings().map((b) => [b.id, b]));
  return typeof id === 'string' ? byId.get(id) : undefined;
};
/** The building a place is in. */
export const buildingOfPlace = (p: Place) => buildings().find((b) => b.place === p);

/** A grid over the map, so a tap only looks at the buildings near it. */
const CELL = 10;
let grid: Map<number, Building[]> | null = null;
function gridOf() {
  if (grid) return grid;
  grid = new Map();
  for (const b of buildings())
    for (let gx = Math.floor((b.x - 6) / CELL); gx <= Math.floor((b.x + b.w + 6) / CELL); gx++)
      for (let gy = Math.floor((b.y - 6) / CELL); gy <= Math.floor((b.y + b.h + 6) / CELL); gy++) {
        const k = gx * 1000 + gy;
        const list = grid.get(k);
        if (list) list.push(b);
        else grid.set(k, [b]);
      }
  return grid;
}
/** What's at that spot on the map: the building it's on, or (a near miss) the nearest one within reach. */
export function buildingAt(x: number, y: number, reach = 5): Building | undefined {
  const list = gridOf().get(Math.floor(x / CELL) * 1000 + Math.floor(y / CELL)) ?? [];
  let best: Building | undefined;
  let bd = Infinity;
  for (const b of list) {
    // (Inside it: the smallest one you're inside wins, a shed over the lot it's on.)
    const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
    const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
    // (Not a box: inside its outline, or how far from it.)
    const off = b.shape && !dx && !dy && !inShape(b.shape, x, y) ? toShape(b.shape, x, y) : 0;
    const d = off || Math.hypot(dx, dy) + (dx || dy ? 0 : -1000 + (b.w * b.h) / 1e4);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best && bd <= reach ? best : undefined;
}

/** Its address: the number on the door, on the street it faces (the same spot addressAt puts that address at). */
const addrCache = new Map<string, string>();
export function buildingAddr(b: Building, unit = ''): string {
  const key = `${b.id}|${unit}`;
  const had = addrCache.get(key);
  if (had) return had;
  // The streets it could face, nearest first; the first whose number lands on this building is the one.
  const fronts = [
    ...Object.entries(STS).map(([name, y]) => ({ name, odd: b.cy > y, ave: false, d: Math.min(Math.abs(b.y - y), Math.abs(b.y + b.h - y)) })),
    ...Object.entries(AVES).map(([name, x]) => ({ name, odd: b.cx > x, ave: true, d: Math.min(Math.abs(b.x - x), Math.abs(b.x + b.w - x)) })),
  ]
    .sort((p, q) => p.d - q.d)
    .slice(0, 3);
  let out = '';
  let outD = Infinity;
  for (const f of fronts) {
    let best = '';
    let bd = Infinity;
    for (let n = f.odd ? 1 : 2; n < 2000; n += 2) {
      const a = `${n} ${f.name}${unit}`;
      const at = addressAt(a);
      // (On the building, and as near its middle along the street as the numbers go.)
      const off = Math.hypot(Math.max(b.x - at.x, 0, at.x - b.x - b.w), Math.max(b.y - at.y, 0, at.y - b.y - b.h));
      const d = off * 10 + (f.ave ? Math.abs(at.y - b.cy) : Math.abs(at.x - b.cx));
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    const at = addressAt(best);
    if (buildingAt(at.x, at.y) === b) {
      out = best;
      break;
    }
    if (bd + f.d < outD) {
      outD = bd + f.d;
      out = best;
    }
  }
  // (No number on its streets lands on it: a building set back, round the side. It takes the nearest number
  // with a letter, its own, so it's never the same address as the building that number does land on.
  // The salt is chosen so that, on this map, no two buildings end up with the same address.)
  if (!(buildingAt(addressAt(out).x, addressAt(out).y) === b)) out = out.replace(/^(\d+)/, `$1${'ABCDEFGHJK'[Math.floor(hash(`${b.id}|side`) * 10)]}`);
  addrCache.set(key, out);
  return out;
}

/**
 * Under the streets: the ground, the blocks with their sidewalks, and what's
 * built on them (row houses along the street, yards behind, an alley; bigger
 * buildings downtown; a parking lot or an empty lot here and there), the park,
 * the rail line across the top and the river along the bottom. The same every time.
 */
function decorSvg(): string {
  const { blocks, lots, blds } = layout();
  const rect = (b: Building) => `<rect x="${f1(b.x)}" y="${f1(b.y)}" width="${f1(b.w)}" height="${f1(b.h)}" fill="${b.fill}"/>`;
  // A building: a box, or its own outline.
  const foot = (b: Building) => (b.shape ? `<path d="${shapePath(b)}" fill="${b.fill}"/>` : rect(b));
  // The lit edges, where the light comes from (up and to the left), a hair inside: one path for them all.
  const lit = blds
    .map((b) => {
      const pts = b.shape ?? [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
      return pts
        .map(([ax, ay], i) => {
          const [bx, by] = pts[(i + 1) % pts.length];
          const len = Math.hypot(bx - ax, by - ay);
          if (len < 0.8) return '';
          // (Clockwise, on a screen: the outward side is to the left of the way the edge runs.)
          const nx = (by - ay) / len;
          const ny = -(bx - ax) / len;
          if (nx * -0.6 + ny * -0.8 <= 0.2) return '';
          const k = 0.32;
          return `M${f1(ax - nx * k)} ${f1(ay - ny * k)}L${f1(bx - nx * k)} ${f1(by - ny * k)}`;
        })
        .join('');
    })
    .join('');
  // The park: lawn, trees, a path that winds, the pond.
  const trees = Array.from({ length: 22 }, (_, k) => {
    const x = 156 + rnd(k, 11) * 48;
    const y = 211 + rnd(k, 12) * 42;
    if (Math.hypot(x - 190, y - 243) < 9) return '';
    return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(2.2 + rnd(k, 13) * 2.4)}" fill="url(#m-tree)"/>`;
  }).join('');
  const park = `<rect x="154" y="209" width="52" height="47" rx="2" fill="#16231a"/><path d="M154 249 C166 240 172 236 182 238 S198 228 206 213" fill="none" stroke="#2d3328" stroke-width="1.6"/><ellipse cx="190" cy="243" rx="7.5" ry="4.2" fill="#0f1c26" stroke="#1d2c36" stroke-width="0.6"/>${trees}`;
  // The river, its banks, a few ripples.
  const river = `<path d="M0 ${RIVER_Y + 2} C60 ${RIVER_Y - 6} 120 ${RIVER_Y + 10} 180 ${RIVER_Y + 3} S260 ${RIVER_Y - 3} 300 ${RIVER_Y + 6} L300 ${MAP_H} L0 ${MAP_H}Z" fill="url(#m-water)" stroke="#202629" stroke-width="1.4"/>` +
    `<path d="M24 410 q5 -1.2 10 0 M78 414 q5 -1.2 10 0 M118 409 q5 -1.2 10 0 M206 412 q5 -1.2 10 0 M252 415 q5 -1.2 10 0" fill="none" stroke="rgba(150,180,205,0.12)" stroke-width="0.5"/>`;
  // The rail line along the top: ballast, ties, two rails.
  const rail = `<rect x="0" y="8.2" width="${MAP_W}" height="8.6" fill="#1a1918"/><rect x="0" y="9.6" width="${MAP_W}" height="5.8" fill="url(#m-ties)"/><path d="M0 11h${MAP_W} M0 14h${MAP_W}" stroke="#55534f" stroke-width="0.55"/>`;
  // (The bank: a stone edge along the water.)
  const bank = `<path class="m-bank" d="M0 ${RIVER_Y + 0.4} C60 ${RIVER_Y - 7.6} 120 ${RIVER_Y + 8.4} 180 ${RIVER_Y + 1.4} S260 ${RIVER_Y - 4.6} 300 ${RIVER_Y + 4.4}"/>`;
  // Big roofs: a parapet just inside the edge (one path for them all).
  const roofs = blds
    .filter((b) => b.w > 9 && b.h > 9 && b.kind !== 'garage' && !b.shape)
    .map((b) => `M${f1(b.x + 1.1)} ${f1(b.y + 1.1)}h${f1(b.w - 2.2)}v${f1(b.h - 2.2)}h${f1(-(b.w - 2.2))}z`)
    .join('');
  return `${river}${bank}${rail}<g class="m-blocks">${blocks.join('')}</g>${lots.map(rect).join('')}<g class="m-blds">${blds.map(foot).join('')}</g><path class="m-lit" d="${lit}"/><path class="m-roofs" d="${roofs}"/>${park}`;
}
/** Over the streets: what parts of town are called, landmarks that aren't places to go, a compass, the scale. */
function overSvg(): string {
  const districts = [
    [195, 34, 'DOWNTOWN'],
    [62, 186, 'THE FLATS'],
    [226, 232, 'OLD TOWN'],
    [86, 352, 'SOUTHSIDE'],
  ]
    .map(([x, y, t]) => `<text class="m-district" x="${x}" y="${y}" text-anchor="middle">${t}</text>`)
    .join('');
  // Landmarks: a small badge in the same style as the pins (the same glyphs), dead
  // centre on its building; the name a fixed distance below it (beside or above, the
  // same distance, where a street name or a pin would be in the way).
  const R = 4;
  const GAP = 2.2;
  const mark = (x: number, y: number, d: string, label: string, anchor = 'middle', side: 'below' | 'above' | 'beside' = 'below', bld?: string) => {
    // (Below or above: centred, or starting at the badge's left edge, or ending at its right.)
    const tx = side === 'beside' ? (anchor === 'end' ? x - R - GAP : x + R + GAP) : anchor === 'start' ? x - R : anchor === 'end' ? x + R : x;
    const ty = side === 'beside' ? y : side === 'above' ? y - R - GAP : y + R + GAP;
    const base = side === 'beside' ? 'central' : side === 'above' ? 'auto' : 'hanging';
    return `<g class="m-landmark"${bld ? ` data-bld="${bld}"` : ''}><circle cx="${f1(x)}" cy="${f1(y)}" r="${R}"/><path transform="translate(${(x - 3).toFixed(2)} ${(y - 3).toFixed(2)}) scale(0.25)" d="${d}"/><text x="${f1(tx)}" y="${f1(ty)}" text-anchor="${anchor}" dominant-baseline="${base}">${label}</text></g>`;
  };
  // (Every one on its own building's middle.)
  const { blds } = layout();
  const at = (k: BuildingKind) => blds.filter((b) => b.kind === k);
  const one = (k: BuildingKind, d: string, label: string, anchor = 'middle', side: 'below' | 'above' | 'beside' = 'below') =>
    at(k).slice(0, 1).map((b) => mark(b.cx, b.cy, d, label, anchor, side, b.id));
  const BAR_LABEL: Record<string, [string, 'below' | 'above' | 'beside']> = { 'Blue Lantern': ['start', 'above'], 'Low Tide': ['start', 'beside'], 'Anchor Room': ['start', 'below'], 'Rosie’s': ['end', 'beside'] };
  const marks = [
    ...one('church', PLACE_ICON.church, 'ST. AGNES', 'middle', 'above'),
    ...one('laundromat', PLACE_ICON.laundromat, 'LAUNDROMAT', 'start'),
    ...one('shelter', PLACE_ICON.shelter, 'SHELTER', 'start', 'beside'),
    // (The water tower stands on a roof downtown: not a building of its own.)
    mark(282, 30, PLACE_ICON.tower, 'WATER TOWER', 'end', 'beside'),
  ].join('');
  // The bars, the school, the lock-ups by the river.
  const extra = [
    // (Each bar's name placed clear of the streets' names and the pins around it.)
    ...at('bar').map((b) => {
      const name = (b.name ?? 'BAR').replace(/^The /, '');
      const [anchor, side] = BAR_LABEL[name] ?? ['middle', 'below'];
      return mark(b.cx, b.cy, PLACE_ICON.bar, name.toUpperCase(), anchor, side, b.id);
    }),
    ...one('school', PLACE_ICON.school, 'SCHOOL'),
    ...one('warehouse', PLACE_ICON.warehouse, 'STORAGE'),
  ].join('');
  // A compass, and how long a block is.
  const compass = `<g class="m-compass" transform="translate(288 64)"><circle r="7.5"/><path d="M0 -6L2 0H-2Z" class="n"/><path d="M0 6L2 0H-2Z"/><text y="-9.5" text-anchor="middle">N</text></g>`;
  const scale = `<g class="m-scale"><rect x="3" y="20.5" width="62" height="11" rx="1.5"/><path d="M6 28.5h57 M6 26.5v4 M63 26.5v4 M34.5 27.5v2"/><text x="34.5" y="25.4" text-anchor="middle">1 BLOCK</text></g>`;
  return `<g class="m-districts">${districts}</g><g class="m-landmarks">${marks}${extra}</g>${compass}${scale}`;
}

/** The streets themselves, as SVG: the curbs, then the asphalt, then the names. */
let streetsCache: string | null = null;
function streetsSvg(): string {
  // (The same every time: drawn once.)
  if (streetsCache) return streetsCache;
  const casing: string[] = [];
  const fill: string[] = [];
  const centre: string[] = [];
  const labels: string[] = [];
  const road = (x1: number, y1: number, x2: number, y2: number, w: number) => {
    casing.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${w + 1.4}"/>`);
    fill.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${w}"/>`);
  };
  const label = (x: number, y: number, a: number, name: string) =>
    labels.push(`<text x="${f1(x)}" y="${f1(y)}" text-anchor="middle" dominant-baseline="central"${a ? ` transform="rotate(${a.toFixed(1)} ${f1(x)} ${f1(y)})"` : ''}>${name.toUpperCase()}</text>`);
  for (const [name, [x1, y1, x2, y2]] of Object.entries(ROADS)) {
    road(x1, y1, x2, y2, ROAD_W);
    const a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    const at = name === 'Tanner Rd' ? 0.47 : 0.9;
    label(x1 + (x2 - x1) * at, y1 + (y2 - y1) * at, a, name);
  }
  for (const [name, [x1, y1, x2, y2]] of Object.entries(STUBS)) {
    road(x1, y1, x2, y2, STUB_W);
    // (Sorrel Ct's name low on it, clear of the bank's pin at the top.)
    if (x1 === x2) label(x1, y2 - 13, -90, name);
    // (Left of centre: clear of the YOU marker at the corner of Grand and Ninth.)
    else label(x1 + (x2 - x1) * 0.37, y1, 0, name);
  }
  // Streets run across, avenues up and down (avenues on top, wider).
  const stLabelAt: Record<string, number> = { 'Alder St': 120, 'Larkin St': 60, 'Pruitt St': 58, 'Ninth St': 115, 'Delmar St': 64, 'Bellamy St': 126, 'Ivy St': 240 };
  const stLine: string[] = [];
  for (const [name, y] of Object.entries(STS)) {
    road(0, y, MAP_W, y, ST_W);
    stLine.push(`M0 ${y}H${MAP_W}`);
    label(stLabelAt[name] ?? 60, y, 0, name);
  }
  centre.push(`<path class="st" d="${stLine.join('')}"/>`);
  // A zebra crossing on each side of every corner (one path: the stripes are its dashes).
  const zebra: string[] = [];
  for (const x of Object.values(AVES))
    for (const y of Object.values(STS)) {
      const ox = AVE_W / 2 + 1.1;
      const oy = ST_W / 2 + 1.1;
      // (Across the avenue, above and below the street; across the street, either side of the avenue.)
      zebra.push(`M${f1(x - AVE_W / 2 + 0.4)} ${f1(y - oy)}H${f1(x + AVE_W / 2 - 0.4)}`, `M${f1(x - AVE_W / 2 + 0.4)} ${f1(y + oy)}H${f1(x + AVE_W / 2 - 0.4)}`);
      zebra.push(`M${f1(x - ox)} ${f1(y - ST_W / 2 + 0.4)}V${f1(y + ST_W / 2 - 0.4)}`, `M${f1(x + ox)} ${f1(y - ST_W / 2 + 0.4)}V${f1(y + ST_W / 2 - 0.4)}`);
    }
  const aveLabelAt: Record<string, number[]> = { 'Kestrel Ave': [67, 342], 'Halsey Ave': [115, 281], 'Grand Ave': [67, 287], 'Fulton Ave': [140, 349], 'Cobb Ave': [232, 62] };
  for (const [name, x] of Object.entries(AVES)) {
    road(x, 0, x, RIVER_Y, AVE_W);
    centre.push(`<line x1="${x}" y1="0" x2="${x}" y2="${RIVER_Y}"/>`);
    for (const y of aveLabelAt[name] ?? [67]) label(x, y, -90, name);
  }
  // Grand Ave crosses the river on its bridge: railings either side.
  casing.push(`<line x1="150" y1="${RIVER_Y}" x2="150" y2="${MAP_H}" stroke-width="${AVE_W + 3}" class="bridge"/>`);
  fill.push(`<line x1="150" y1="${RIVER_Y}" x2="150" y2="${MAP_H}" stroke-width="${AVE_W}"/>`);
  centre.push(`<line x1="150" y1="${RIVER_Y}" x2="150" y2="${MAP_H}"/>`);
  const defs =
    `<defs>` +
    `<pattern id="m-stalls" width="4" height="9" patternUnits="userSpaceOnUse"><rect width="4" height="9" fill="#141516"/><path d="M0 0v3.6 M0 5.4v3.6" stroke="rgba(220,220,210,0.16)" stroke-width="0.35"/></pattern>` +
    `<pattern id="m-ties" width="3.2" height="5.8" patternUnits="userSpaceOnUse"><rect x="0.6" width="1.3" height="5.8" fill="#2c2a27"/></pattern>` +
    `<radialGradient id="m-tree"><stop offset="0" stop-color="#2b4630"/><stop offset="0.7" stop-color="#1f3624"/><stop offset="1" stop-color="#1f3624" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="m-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f1a22"/><stop offset="1" stop-color="#0a1218"/></linearGradient>` +
    `<filter id="m-shade" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0.7" dy="0.9" stdDeviation="0.35" flood-color="#000" flood-opacity="0.75"/></filter>` +
    `</defs>`;
  streetsCache = `<svg class="map-streets" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="none" aria-hidden="true">${defs}<rect width="${MAP_W}" height="${MAP_H}" fill="#0b0c0d"/>${decorSvg()}<g class="m-casing">${casing.join('')}</g><g class="m-road">${fill.join('')}</g><path class="m-zebra" d="${zebra.join('')}"/><g class="m-centre">${centre.join('')}</g><g class="m-labels">${labels.join('')}</g>${overSvg()}</svg>`;
  return streetsCache;
}

/** The map, with everything on it (and the building you've tapped, outlined). */
export function mapHtml(marks: MapMark[], sel?: Building, zoom = { z: 1, tx: 0, ty: 0 }): string {
  const pins = marks
    .map(
      (m) =>
        `<button type="button" class="map-pin${m.here ? ' here' : ''}${m.picked ? ' picked' : ''}" data-tone="${m.tone}" data-mappick="${m.key}" aria-label="${m.label}" style="left:${((100 * m.x) / MAP_W).toFixed(2)}%;top:${((100 * m.y) / MAP_H).toFixed(2)}%"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${m.icon}"/></svg>${m.here ? '<em class="map-you">YOU</em>' : ''}</button>`,
    )
    .join('');
  const outline = sel
    ? `<svg class="map-sel" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="none" aria-hidden="true">${sel.shape ? `<path d="${shapePath(sel, 1.2)}"/>` : `<rect x="${f1(sel.x - 1.2)}" y="${f1(sel.y - 1.2)}" width="${f1(sel.w + 2.4)}" height="${f1(sel.h + 2.4)}" rx="1"/>`}</svg>`
    : '';
  const ctl =
    `<div class="map-zoomctl">` +
    `<button type="button" data-mapzoom="in" aria-label="Zoom in"${zoom.z >= MAP_ZMAX - 0.01 ? ' disabled' : ''}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg></button>` +
    `<button type="button" data-mapzoom="out" aria-label="Zoom out"${zoom.z <= 1.01 ? ' disabled' : ''}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12"/></svg></button>` +
    `<button type="button" data-mapzoom="fit" aria-label="Whole map"${zoom.z <= 1.01 ? ' hidden' : ''}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 8V4h4M12 4h4v4M16 12v4h-4M8 16H4v-4"/></svg></button>` +
    `</div>`;
  return `<div class="map${zoom.z > 1.01 ? ' zoomed' : ''}"><div class="map-zoom" style="${zoomStyle(zoom)}">${streetsSvg()}${outline}${pins}</div>${ctl}</div>`;
}
/** How far the map zooms in. */
export const MAP_ZMAX = 5;
/** The zoomed layer's place: scaled by z from its top left, then moved by (tx, ty) parts of the map's size. */
export const zoomStyle = (v: { z: number; tx: number; ty: number }) => `--z:${v.z.toFixed(3)};transform:translate(${(v.tx * 100).toFixed(3)}%,${(v.ty * 100).toFixed(3)}%) scale(${v.z.toFixed(3)})`;
