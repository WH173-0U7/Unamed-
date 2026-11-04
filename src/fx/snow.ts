/**
 * Snow: flakes drifting down over the picture (near ones big and soft, far
 * ones small and slow, all swaying a little), the odd one landing on the
 * glass and melting into a drop of water, and in heavy snow a frost that
 * creeps in from the corners of the screen. `setAmount` 0..1.
 */
interface Flake {
  x: number;
  y: number;
  /** 0 far .. 1 near. */
  z: number;
  phase: number;
  sway: number;
}
interface Stuck {
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
  rot: number;
}

export function createSnow(fall: HTMLCanvasElement) {
  const on = document.createElement('canvas');
  on.id = 'snow-glass';
  document.body.appendChild(on);
  const fx = fall.getContext('2d')!;
  const ox = on.getContext('2d')!;
  let w = 1;
  let h = 1;
  let pr = 1;
  let amount = 0;
  let target = 0;
  let time = 0;
  let wind = 0;
  let frost = 0;
  let idle = true;
  const flakes: Flake[] = [];
  const stuck: Stuck[] = [];
  const MAX = 400;

  // A soft round flake, drawn once and copied.
  const S = 32;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = S;
  {
    const c = sprite.getContext('2d')!;
    const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(240,244,250,0.85)');
    g.addColorStop(1, 'rgba(230,236,246,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
  }
  // A flake caught on the glass: a little six-armed crystal in a soft halo.
  const C = 48;
  const crystal = document.createElement('canvas');
  crystal.width = crystal.height = C;
  {
    const c = crystal.getContext('2d')!;
    c.translate(C / 2, C / 2);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, C / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, C / 2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 1.4;
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      c.rotate(Math.PI / 3);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -C * 0.4);
      c.moveTo(0, -C * 0.22);
      c.lineTo(C * 0.08, -C * 0.3);
      c.moveTo(0, -C * 0.22);
      c.lineTo(-C * 0.08, -C * 0.3);
      c.stroke();
    }
  }
  // Frost: feathery white creeping in from the corners (drawn once per size).
  let frostTex: HTMLCanvasElement | null = null;
  const makeFrost = () => {
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(w * pr * 0.5));
    t.height = Math.max(1, Math.round(h * pr * 0.5));
    const c = t.getContext('2d')!;
    const W = t.width;
    const H = t.height;
    for (const [cx, cy] of [
      [0, 0],
      [W, 0],
      [0, H],
      [W, H],
    ]) {
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.42);
      g.addColorStop(0, 'rgba(225,235,245,0.55)');
      g.addColorStop(0.6, 'rgba(225,235,245,0.12)');
      g.addColorStop(1, 'rgba(225,235,245,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      // Feathery fronds growing out of the corner.
      c.strokeStyle = 'rgba(240,246,252,0.35)';
      c.lineWidth = 0.8;
      for (let i = 0; i < 90; i++) {
        let x = cx;
        let y = cy;
        let a = Math.atan2(H / 2 - cy, W / 2 - cx) + (Math.random() - 0.5) * 1.6;
        const len = Math.max(W, H) * (0.06 + Math.random() * 0.22);
        c.beginPath();
        c.moveTo(x, y);
        for (let s = 0; s < len; s += 6) {
          a += (Math.random() - 0.5) * 0.5;
          x += Math.cos(a) * 6;
          y += Math.sin(a) * 6;
          c.lineTo(x, y);
          if (Math.random() < 0.18) {
            c.moveTo(x, y);
            c.lineTo(x + Math.cos(a + 0.9) * 5, y + Math.sin(a + 0.9) * 5);
            c.moveTo(x, y);
          }
        }
        c.stroke();
      }
    }
    frostTex = t;
  };

  const spawn = (top: boolean): Flake => ({
    x: Math.random() * (w + 80) - 40,
    y: top ? -10 - Math.random() * 40 : Math.random() * h,
    z: Math.pow(Math.random(), 1.6),
    phase: Math.random() * Math.PI * 2,
    sway: 8 + Math.random() * 22,
  });

  return {
    resize(width: number, height: number, pixelRatio: number) {
      w = width;
      h = height;
      pr = Math.min(pixelRatio, 2);
      for (const c of [fall, on]) {
        c.width = Math.round(w * pr);
        c.height = Math.round(h * pr);
      }
      frostTex = null;
    },
    /** How hard it's snowing here, 0..1 (0 indoors). */
    setAmount(a: number) {
      target = a;
    },
    update(dt: number) {
      time += dt;
      amount += (target - amount) * Math.min(1, dt * 0.6);
      if (amount < 0.003 && !flakes.length && !stuck.length && frost < 0.003) {
        if (!idle) {
          fx.clearRect(0, 0, fall.width, fall.height);
          ox.clearRect(0, 0, on.width, on.height);
          idle = true;
        }
        return;
      }
      idle = false;
      // A wind that comes and goes.
      wind = Math.sin(time * 0.13) * 18 + Math.sin(time * 0.41) * 8;
      // As many flakes as the snow calls for (they thin out as it eases).
      const want = Math.round(MAX * amount);
      while (flakes.length < want) flakes.push(spawn(flakes.length > want * 0.5));
      fx.setTransform(pr, 0, 0, pr, 0, 0);
      fx.clearRect(0, 0, w, h);
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i];
        const v = 22 + 58 * f.z;
        f.y += v * dt;
        f.x += (Math.sin(time * (0.6 + f.z * 0.6) + f.phase) * f.sway * 0.04 + wind * (0.3 + f.z)) * dt;
        if (f.y > h + 12 || f.x < -60 || f.x > w + 60) {
          if (flakes.length > want) flakes.splice(i, 1);
          else Object.assign(f, spawn(true));
          continue;
        }
        const r = 0.9 + 3.6 * f.z * f.z + f.z;
        fx.globalAlpha = 0.28 + 0.6 * f.z;
        // The nearest are out of focus: bigger and fainter.
        const blur = f.z > 0.85 ? 2.2 : 1;
        fx.drawImage(sprite, f.x - r * blur, f.y - r * blur, r * 2 * blur, r * 2 * blur);
        // Now and then a near one lands on the glass.
        if (f.z > 0.75 && stuck.length < 40 && Math.random() < dt * 0.06 * amount) {
          stuck.push({ x: f.x, y: f.y, r: 4 + Math.random() * 5, age: 0, life: 4 + Math.random() * 5, rot: Math.random() * Math.PI });
          Object.assign(f, spawn(true));
        }
      }
      fx.globalAlpha = 1;
      // On the glass: flakes melting into drops, and frost in the corners.
      ox.setTransform(pr, 0, 0, pr, 0, 0);
      ox.clearRect(0, 0, w, h);
      frost += (Math.max(0, amount - 0.45) * 1.1 - frost) * Math.min(1, dt * 0.03);
      if (frost > 0.01) {
        if (!frostTex) makeFrost();
        ox.globalAlpha = Math.min(0.9, frost);
        ox.drawImage(frostTex!, 0, 0, w, h);
      }
      for (let i = stuck.length - 1; i >= 0; i--) {
        const s = stuck[i];
        s.age += dt;
        const k = s.age / s.life;
        if (k >= 1) {
          stuck.splice(i, 1);
          continue;
        }
        // Crisp at first, then it softens and shrinks into a drop of water.
        ox.save();
        ox.translate(s.x, s.y);
        ox.rotate(s.rot);
        const r = s.r * (1 - k * 0.55);
        ox.globalAlpha = (1 - k) * 0.85;
        ox.drawImage(crystal, -r, -r, r * 2, r * 2);
        if (k > 0.45) {
          // The meltwater: a tiny clear bead with a bright edge.
          ox.globalAlpha = Math.min(1, (k - 0.45) * 2) * (1 - k) * 0.9;
          ox.strokeStyle = 'rgba(220,232,245,0.8)';
          ox.lineWidth = 0.8;
          ox.beginPath();
          ox.arc(0, r * 0.2, r * 0.35, 0, Math.PI * 2);
          ox.stroke();
        }
        ox.restore();
      }
      ox.globalAlpha = 1;
    },
  };
}

export type Snow = ReturnType<typeof createSnow>;
