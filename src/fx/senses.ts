/**
 * How you see, over the whole screen (under the glass):
 *
 * - **Stress** narrows it into tunnel vision: the dark closes in from the
 *   edges, pulsing with your heartbeat, and now and then your sight goes:
 *   it dims and swims and comes back. The worse the stress, the narrower the
 *   tunnel and the more often it goes.
 * - **A cigarette** while it lasts: everything a touch brighter, the edges of
 *   things sharper (see body.smoking in the CSS), and smoke curling up from
 *   the bottom of the screen where you hold it, with a bigger cloud now and
 *   then when you exhale.
 */
export function createSenses() {
  const tunnel = document.createElement('div');
  tunnel.id = 'tunnel';
  const smokeCv = document.createElement('canvas');
  smokeCv.id = 'smoke';
  document.body.append(smokeCv, tunnel);
  const sx = smokeCv.getContext('2d')!;

  let stress = 0;
  let shown = 0;
  let time = 0;
  /** A spell of your sight going: how far through it (0..1) and how long it lasts. */
  let dip = 0;
  let dipLen = 0;
  let nextDip = 6;
  let smoking = false;
  let tunnelKey = '';
  let w = 1;
  let h = 1;

  // A soft puff of smoke, drawn once.
  const puff = document.createElement('canvas');
  puff.width = puff.height = 64;
  {
    const c = puff.getContext('2d')!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(215, 215, 220, 0.5)');
    g.addColorStop(0.5, 'rgba(200, 200, 208, 0.2)');
    g.addColorStop(1, 'rgba(200, 200, 208, 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }
  type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; life: number; age: number; spin: number };
  const ps: P[] = [];
  let exhale = 4;

  function resize(width: number, height: number) {
    w = width;
    h = height;
    smokeCv.width = Math.round(w);
    smokeCv.height = Math.round(h);
  }

  function emit(big: boolean) {
    // From the cigarette in your hand (low, right of centre), or your mouth.
    const x = big ? w * (0.4 + Math.random() * 0.2) : w * 0.66 + (Math.random() - 0.5) * 6;
    const y = big ? h + 20 : h - 18;
    ps.push({
      x,
      y,
      vx: (Math.random() - 0.5) * (big ? 70 : 8),
      vy: -(big ? 60 + Math.random() * 60 : 28 + Math.random() * 18),
      r: big ? 16 + Math.random() * 26 : 6 + Math.random() * 5,
      a: big ? 0.16 + Math.random() * 0.08 : 0.35,
      life: big ? 5 + Math.random() * 3 : 6 + Math.random() * 4,
      age: 0,
      spin: Math.random() * 6,
    });
  }

  function stepSmoke(dt: number) {
    if (smoking) {
      // A thin, steady thread from the tip.
      if (Math.random() < dt * 14) emit(false);
      exhale -= dt;
      if (exhale <= 0) {
        for (let i = 0; i < 22; i++) emit(true);
        exhale = 9 + Math.random() * 10;
      }
    }
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age > p.life || p.y < -80) {
        ps.splice(i, 1);
        continue;
      }
      // Smoke curls: a sideways wander that grows as it rises.
      p.vx += Math.sin(time * 1.3 + p.spin + p.y * 0.01) * dt * 18;
      p.vx *= 1 - dt * 0.6;
      p.vy *= 1 - dt * 0.15;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += dt * (p.r < 20 ? 9 : 14);
    }
    sx.clearRect(0, 0, w, h);
    for (const p of ps) {
      const t = p.age / p.life;
      sx.globalAlpha = p.a * Math.min(1, p.age * 2) * (1 - t) * (1 - t);
      sx.drawImage(puff, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    sx.globalAlpha = 1;
  }

  return {
    resize,
    /** Stress 0..100 (0 when there's no game). */
    setStress(s: number) {
      stress = s;
    },
    setSmoking(on: boolean) {
      if (on === smoking) return;
      smoking = on;
      document.body.classList.toggle('smoking', on);
      if (on) exhale = 2.5;
    },
    update(dt: number) {
      time += dt;
      // Eases towards the target so it doesn't snap.
      shown += (stress - shown) * Math.min(1, dt * 0.8);
      const s = shown / 100;
      // Sight going: more often, longer and deeper the worse it is.
      if (s > 0.35) {
        nextDip -= dt * s;
        if (nextDip <= 0 && dip <= 0) {
          dip = 0.0001;
          dipLen = 0.8 + Math.random() * 1.6 * s;
          nextDip = 4 + Math.random() * 8;
        }
      }
      let out = 0;
      if (dip > 0) {
        dip += dt / dipLen;
        // Fades out, flickers, comes back.
        out = Math.sin(Math.min(1, dip) * Math.PI) * (0.35 + s * 0.45) * (0.85 + 0.15 * Math.sin(time * 30));
        if (dip >= 1) dip = 0;
      }
      if (s < 0.02 && !out) {
        if (tunnel.style.opacity !== '0') tunnel.style.opacity = '0';
        tunnelKey = '';
      } else {
        // The tunnel: clear in the middle, dark at the edges, closing in.
        const beat = Math.pow(0.5 + 0.5 * Math.sin(time * (6 + s * 5)), 8) * s * 4;
        const clear = 74 - s * 52 - beat - out * 18;
        // (Only when it changes: each change repaints the whole screen.)
        const key = `${clear.toFixed(0)}|${Math.min(0.97, 0.4 + s * 0.6).toFixed(2)}|${out.toFixed(2)}`;
        if (key !== tunnelKey) {
          tunnelKey = key;
          const [c, d, o] = key.split('|');
          tunnel.style.opacity = '1';
          tunnel.style.setProperty('--clear', `${c}%`);
          tunnel.style.setProperty('--dark', d);
          tunnel.style.setProperty('--out', o);
        }
      }
      if (smoking || ps.length) stepSmoke(dt);
    },
  };
}

export type Senses = ReturnType<typeof createSenses>;
