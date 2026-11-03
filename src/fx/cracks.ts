/**
 * Cracks in the glass: how close you are to going out. Drawn once per fight
 * onto a canvas the glass shader reads, and revealed bit by bit as you lose
 * Awake.
 *
 * Up to three impact points, each a spider-web: jagged radial cracks running
 * out from a crushed little core, branching now and then, joined by short
 * bowed cross-cracks. Every segment carries its own threshold (the green
 * channel), so a crack grows outward from where it started as the level
 * rises; the first impact's inner cracks show first, the third impact's
 * outer ones last. Red is how strong the line is (thick near the centre,
 * hairline at the tips); alpha is coverage.
 */

/** A seeded random (each fight's glass breaks its own way). */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function drawCracks(canvas: HTMLCanvasElement, w: number, h: number, scale: number, seed: number) {
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const c = canvas.getContext('2d')!;
  c.setTransform(scale, 0, 0, scale, 0, 0);
  c.clearRect(0, 0, w, h);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const R = rng(seed);
  const diag = Math.hypot(w, h);

  /** One straight piece of crack, revealed at threshold `t` (0..1). */
  const seg = (ax: number, ay: number, bx: number, by: number, t: number, width: number, strength: number) => {
    const g = Math.round(Math.min(1, Math.max(0, t)) * 255);
    c.strokeStyle = `rgb(${Math.round(strength * 255)}, ${g}, 0)`;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(bx, by);
    c.stroke();
  };

  /**
   * A crack running out from (x, y) at angle `ang`: a jagged path that
   * wanders a little, thins out, and now and then splits. Its points are
   * returned (with their distance from the impact) for the cross-cracks.
   */
  const run = (
    x: number,
    y: number,
    ang: number,
    len: number,
    t0: number,
    span: number,
    cx: number,
    cy: number,
    reach: number,
    width: number,
    depth: number,
  ): { x: number; y: number; r: number }[] => {
    const pts = [{ x, y, r: Math.hypot(x - cx, y - cy) }];
    let gone = 0;
    let a = ang;
    while (gone < len) {
      const stepLen = 7 + R() * 16;
      // Glass cracks run nearly straight, with the odd sharp kink.
      a += (R() - 0.5) * (R() < 0.12 ? 0.5 : 0.12);
      const nx = x + Math.cos(a) * stepLen;
      const ny = y + Math.sin(a) * stepLen;
      gone += stepLen;
      const r = Math.hypot(nx - cx, ny - cy);
      const f = Math.min(1, r / reach);
      // Thick and bright near the impact, a hairline at the tip.
      const wNow = width * (1 - (gone / len) * 0.7);
      seg(x, y, nx, ny, t0 + span * Math.pow(f, 0.85), Math.max(0.35, wNow), 0.45 + 0.55 * (1 - gone / len));
      x = nx;
      y = ny;
      pts.push({ x, y, r });
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) break;
      // Splitting off.
      if (depth < 2 && R() < 0.07) run(x, y, a + (R() < 0.5 ? -1 : 1) * (0.35 + R() * 0.55), (len - gone) * (0.35 + R() * 0.4), t0, span, cx, cy, reach, wNow * 0.75, depth + 1);
    }
    return pts;
  };

  const impacts = 3;
  for (let i = 0; i < impacts; i++) {
    // Not dead centre, not hard against the edge.
    const cx = w * (0.14 + R() * 0.72);
    const cy = h * (0.12 + R() * 0.76);
    const t0 = [0.03, 0.4, 0.68][i];
    const span = [0.5, 0.3, 0.3][i];
    const reach = diag * (i === 0 ? 0.55 : 0.38) * (0.75 + R() * 0.4);

    // The crushed core: a tiny star of short, bright splinters.
    const core = 6 + R() * 6;
    for (let k = 0; k < 16; k++) {
      const a = R() * Math.PI * 2;
      const r1 = R() * core * 0.4;
      const r2 = r1 + core * (0.4 + R() * 0.8);
      seg(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a + (R() - 0.5) * 0.6) * r2, cy + Math.sin(a + (R() - 0.5) * 0.6) * r2, t0, 0.6 + R() * 0.5, 1);
    }

    // The radial cracks.
    const n = 7 + Math.floor(R() * 5);
    const base = R() * Math.PI * 2;
    const rays: { x: number; y: number; r: number }[][] = [];
    for (let j = 0; j < n; j++) {
      const a = base + (j / n) * Math.PI * 2 + (R() - 0.5) * (Math.PI / n) * 0.9;
      const len = reach * (0.45 + R() * 0.6);
      rays.push(run(cx + Math.cos(a) * core * 0.5, cy + Math.sin(a) * core * 0.5, a, len, t0, span, cx, cy, reach, 0.9 + R() * 0.5, 0));
    }

    // The web: short cross-cracks between neighbouring rays, at a few
    // distances out, bowed slightly and a little jagged.
    const rings = [0.07, 0.14, 0.24, 0.36].map((f) => f * reach * (0.8 + R() * 0.4));
    for (const rr of rings) {
      for (let j = 0; j < n; j++) {
        if (R() < 0.3) continue;
        const A = rays[j].find((p) => p.r >= rr);
        const B = rays[(j + 1) % n].find((p) => p.r >= rr * (0.85 + R() * 0.3));
        if (!A || !B) continue;
        const t = t0 + span * Math.pow(Math.min(1, rr / reach), 0.85) + 0.04;
        // Two or three pieces, pushed outward a touch (the web sags).
        const mx = (A.x + B.x) / 2;
        const my = (A.y + B.y) / 2;
        const ox = mx - cx;
        const oy = my - cy;
        const ol = Math.hypot(ox, oy) || 1;
        const bow = (R() * 0.12 + 0.03) * Math.hypot(B.x - A.x, B.y - A.y);
        const px = mx + (ox / ol) * bow + (R() - 0.5) * 4;
        const py = my + (oy / ol) * bow + (R() - 0.5) * 4;
        const wd = 0.4 + R() * 0.35;
        seg(A.x, A.y, px, py, t, wd, 0.45);
        seg(px, py, B.x, B.y, t, wd, 0.45);
      }
    }
  }
}
