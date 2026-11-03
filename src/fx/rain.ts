/**
 * Rain. Two layers:
 *
 * - **Falling rain** behind the interface: thin, slanting streaks over the
 *   picture, and in a downpour the odd flash of lightning.
 * - **Drops on the glass**, over everything: beads that land, grow as more
 *   land, merge, and once heavy enough run down in fits and starts, leaving a
 *   trail of tiny beads. Running drops wash a narrow path through the blood
 *   and grime on the glass (see Glass.wash). When the rain stops they dry up.
 *
 * Drawn on 2D canvases: water is clear, so it's mostly light (a bright crescent
 * low inside the drop where it focuses the light, a hot highlight up top) and
 * a dark rim.
 */
import type { Glass } from './glass';

interface Drop {
  x: number;
  y: number;
  r: number;
  /** Running speed (px/s); 0 when it's stuck. */
  v: number;
  /** Time until it next sticks or lets go. */
  t: number;
  trail: number;
  /** Where its unwashed path starts. */
  wx: number;
  wy: number;
}

export function createRain(fall: HTMLCanvasElement, glass: Glass) {
  const on = document.createElement('canvas');
  on.id = 'rain-glass';
  document.body.appendChild(on);
  const fx = fall.getContext('2d')!;
  const ox = on.getContext('2d')!;
  let w = 1;
  let h = 1;
  let pr = 1;
  let amount = 0;
  let target = 0;
  const drops: Drop[] = [];
  let streaks: { x: number; y: number; len: number; v: number; a: number }[] = [];
  let flash = 0;
  let nextFlash = 8;
  let acc = 0;
  let idle = true;
  let frame = 0;
  const MAX = 280;

  // One drop, drawn once at a good size; every drop on the glass is a copy
  // of it, scaled (far cheaper than drawing each one).
  const SPRITE = 64;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = SPRITE;
  {
    const c = sprite.getContext('2d')!;
    const r = SPRITE / 2 - 2;
    c.translate(SPRITE / 2, SPRITE / 2);
    c.fillStyle = 'rgba(170, 190, 210, 0.08)';
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = r * 0.16;
    c.strokeStyle = 'rgba(0, 0, 0, 0.32)';
    c.beginPath();
    c.arc(0, r * 0.05, r * 0.92, 0, Math.PI * 2);
    c.stroke();
    const g = c.createRadialGradient(0, r * 0.45, 0, 0, r * 0.45, r * 0.75);
    g.addColorStop(0, 'rgba(225, 235, 255, 0.3)');
    g.addColorStop(1, 'rgba(225, 235, 255, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.8)';
    c.beginPath();
    c.arc(-r * 0.32, -r * 0.42, r * 0.16, 0, Math.PI * 2);
    c.fill();
  }

  function resize(width: number, height: number, pixelRatio: number) {
    w = width;
    h = height;
    // Water's soft: it doesn't need the full resolution.
    pr = Math.min(pixelRatio, 1.25);
    for (const c of [fall, on]) {
      c.width = Math.round(w * pr);
      c.height = Math.round(h * pr);
    }
    fx.setTransform(pr, 0, 0, pr, 0, 0);
    ox.setTransform(pr, 0, 0, pr, 0, 0);
  }

  const rnd = Math.random;
  const WIND = 0.18;

  function land() {
    // Mostly small beads; now and then a fat one.
    const big = rnd() < 0.1;
    const r = big ? 6 + rnd() * 5 : 1.4 + Math.pow(rnd(), 2) * 4;
    const x = rnd() * w;
    const y = rnd() * h;
    // Landing on another drop: they join.
    for (const d of drops) {
      if (Math.hypot(d.x - x, d.y - y) < d.r + r) {
        d.r = Math.min(16, Math.hypot(d.r, r));
        return;
      }
    }
    if (drops.length < MAX) drops.push({ x, y, r, v: 0, t: 1 + rnd() * 4, trail: 0, wx: x, wy: y });
  }

  function step(dt: number) {
    amount += (target - amount) * Math.min(1, dt * 0.5);
    // New drops landing.
    acc += dt * amount * 34;
    while (acc >= 1) {
      acc -= 1;
      land();
    }
    // Washing is a pass over the whole glass, so paths are washed in
    // pieces, and only a few a frame.
    // (A few times a second, a few strokes at a time.)
    let washes = frame % 8 ? 0 : 3;
    const wash = (d: Drop, force: boolean) => {
      if (!washes || (!force && d.y - d.wy < 40)) return;
      washes--;
      glass.wash(d.wx, d.wy, d.x, d.y, d.r * 1.5, 0.5);
      d.wx = d.x;
      d.wy = d.y;
    };
    // Drops that are heavy enough run, stop, run again.
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.t -= dt;
      if (d.v === 0) {
        if (d.r > 4.2 && d.t <= 0) {
          d.v = 40 + d.r * 18 * rnd();
          d.t = 0.2 + rnd() * 1.2;
        } else if (d.t <= 0) d.t = 0.5 + rnd() * 3;
      } else {
        if (d.wy > d.y) {
          d.wx = d.x;
          d.wy = d.y;
        }
        d.v = Math.min(420, d.v + 260 * dt);
        d.y += d.v * dt;
        d.x += Math.sin(d.y * 0.05 + d.r) * 0.4;
        // A narrow clean path behind it.
        wash(d, false);
        // It leaves beads behind, and shrinks doing it.
        d.trail += d.v * dt;
        if (d.trail > 9) {
          d.trail = 0;
          if (rnd() < 0.7 && drops.length < MAX) drops.push({ x: d.x + (rnd() - 0.5) * 2, y: d.y - d.r, r: 0.8 + rnd() * 1.2, v: 0, t: 99, trail: 0, wx: d.x, wy: d.y });
          d.r = Math.max(2, d.r - 0.05);
        }
        // It picks up the drops in its way.
        for (let j = drops.length - 1; j >= 0; j--) {
          const o = drops[j];
          if (o === d || o.v) continue;
          if (Math.abs(o.x - d.x) < d.r + o.r && o.y > d.y - d.r && o.y < d.y + d.r + o.r) {
            d.r = Math.min(16, Math.hypot(d.r, o.r * 0.8));
            drops.splice(j, 1);
            if (j < i) i--;
          }
        }
        if (d.t <= 0) {
          // Sticks for a moment (or runs out of water).
          wash(d, true);
          d.v = d.r > 4.5 && rnd() < 0.7 ? 30 : 0;
          d.t = 0.2 + rnd() * 1.5;
        }
        if (d.y - d.r > h) {
          drops.splice(i, 1);
          continue;
        }
      }
      // Drying once the rain stops.
      if (target === 0) {
        d.r -= dt * (0.25 + 0.6 / d.r);
        if (d.r < 0.6) drops.splice(i, 1);
      }
    }
    // Falling streaks.
    const want = Math.round(amount * 140);
    while (streaks.length < want) streaks.push({ x: rnd() * (w + 200) - 100, y: rnd() * h, len: 18 + rnd() * 46, v: 900 + rnd() * 700, a: 0.05 + rnd() * 0.13 });
    if (streaks.length > want) streaks = streaks.slice(0, want);
    for (const s of streaks) {
      s.y += s.v * dt;
      s.x += s.v * dt * WIND;
      if (s.y > h + s.len) {
        s.y = -s.len - rnd() * 80;
        s.x = rnd() * (w + 200) - 100 - h * WIND;
      }
    }
    // Lightning, in a downpour.
    flash = Math.max(0, flash - dt * 3.5);
    if (amount > 0.85) {
      nextFlash -= dt;
      if (nextFlash <= 0) {
        flash = 0.6 + rnd() * 0.4;
        nextFlash = 10 + rnd() * 25;
      }
    }
  }

  function draw() {
    fx.clearRect(0, 0, w, h);
    if (streaks.length || flash > 0) {
      fx.lineCap = 'round';
      fx.lineWidth = 1;
      // Three shades of streak, one path each.
      const fade = Math.min(1, amount * 1.5);
      for (const [lo, hi, a] of [[0, 0.09, 0.07], [0.09, 0.14, 0.11], [0.14, 1, 0.16]]) {
        fx.strokeStyle = `rgba(190, 205, 225, ${a * fade})`;
        fx.beginPath();
        for (const s of streaks) {
          if (s.a < lo || s.a >= hi) continue;
          fx.moveTo(s.x, s.y);
          fx.lineTo(s.x - s.len * WIND, s.y - s.len);
        }
        fx.stroke();
      }
      if (flash > 0) {
        // A flicker, not a steady flash.
        const f = flash * (0.6 + 0.4 * Math.sin(flash * 40));
        fx.fillStyle = `rgba(200, 210, 255, ${f * 0.22})`;
        fx.fillRect(0, 0, w, h);
      }
    }
    ox.clearRect(0, 0, w, h);
    for (const d of drops) {
      // Running drops stretch a little.
      const ry = d.v ? d.r * 1.25 : d.r;
      ox.drawImage(sprite, d.x - d.r, d.y - ry, d.r * 2, ry * 2);
    }
  }

  return {
    resize,
    /** How hard it's raining, 0..1 (0 stops new drops; the ones there dry up). */
    setAmount(a: number) {
      target = a;
    },
    update(dt: number) {
      const active = target > 0 || amount > 0.01 || drops.length > 0 || flash > 0;
      if (!active) {
        if (!idle) {
          fx.clearRect(0, 0, w, h);
          ox.clearRect(0, 0, w, h);
          streaks = [];
          idle = true;
        }
        return;
      }
      idle = false;
      frame++;
      step(Math.min(dt, 0.05));
      draw();
    },
    /** For tests. */
    get debug() {
      return { drops: drops.length, amount, streaks: streaks.length };
    },
  };
}

export type Rain = ReturnType<typeof createRain>;
