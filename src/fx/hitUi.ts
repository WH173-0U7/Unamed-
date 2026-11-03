/**
 * Hit effects on the game's own interface (the HTML on top of the TV):
 * the whole screen shaking, colour fringing on the text, panels glitching
 * sideways, and drops of blood landing on the panels themselves.
 */
export function createHitUi(game: HTMLElement) {
  let shake = 0;
  let fringe = 0;
  let glitchT = 0;
  let jumped = false;
  const panels = () => [...game.querySelectorAll<HTMLElement>('.enc-card, .enc-status, .enc-log, .enc-actions')];

  /**
   * A splash of blood for the interface, made the same way as the blood on
   * the screen: a field of soft blobs cut at a surface threshold, then shaded
   * pixel by pixel (dark where thick, red at the edges, a dark meniscus line
   * and a glossy highlight).
   */
  // A few splashes, made once and reused (each one takes a while to draw);
  // they're turned at random, so it doesn't show.
  const sprites = new Map<number, string[]>();
  function spriteFor(size: number): string {
    const bucket = Math.max(60, Math.round(size / 40) * 40);
    const list = sprites.get(bucket) ?? [];
    sprites.set(bucket, list);
    if (list.length < 3) list.push(bloodSprite(bucket));
    return list[Math.floor(Math.random() * list.length)];
  }

  function bloodSprite(size: number): string {
    const S = Math.round(size);
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d')!;
    x.globalCompositeOperation = 'lighter';
    const stamp = (px: number, py: number, r: number, a: number) => {
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.25, `rgba(255,255,255,${a * 0.84})`);
      g.addColorStop(0.5, `rgba(255,255,255,${a * 0.5})`);
      g.addColorStop(0.75, `rgba(255,255,255,${a * 0.19})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(px, py, r, 0, Math.PI * 2);
      x.fill();
    };
    const cx = S / 2;
    const base = S * 0.16;
    const dir = Math.random() * Math.PI * 2;
    stamp(cx, cx, base * 1.6, 0.62);
    for (let i = 0; i < 5; i++) stamp(cx + (Math.random() - 0.5) * base, cx + (Math.random() - 0.5) * base, base * (0.5 + Math.random() * 0.4), 0.28);
    // A few streams ending in beads, and loose drops.
    for (let i = 0; i < 4; i++) {
      const a = dir + (Math.random() - 0.5) * 2.2;
      const len = base * (1 + Math.random() * 1.4);
      for (let t = 0; t < 1; t += 0.08) stamp(cx + Math.cos(a) * (base * 0.6 + len * t), cx + Math.sin(a) * (base * 0.6 + len * t), base * (0.3 - t * 0.18), 0.4);
      stamp(cx + Math.cos(a) * (base * 0.7 + len), cx + Math.sin(a) * (base * 0.7 + len), base * 0.3, 0.62);
    }
    for (let i = 0; i < 12; i++) {
      const a = dir + (Math.random() - 0.5) * 3;
      const d = base * (1.8 + Math.random() * 1.2);
      stamp(cx + Math.cos(a) * d, cx + Math.sin(a) * d, 1.5 + Math.random() * base * 0.25, 0.62);
    }
    const img = x.getImageData(0, 0, S, S);
    const d = img.data;
    const F = (i: number, j: number) => d[(Math.min(S - 1, Math.max(0, j)) * S + Math.min(S - 1, Math.max(0, i))) * 4 + 3] / 255;
    const out = x.createImageData(S, S);
    const o = out.data;
    const THR = 0.3;
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const f = F(i, j);
        const cover = Math.min(1, Math.max(0, (f - THR + 0.03) / 0.06));
        if (cover <= 0) continue;
        const hgt = Math.min(1, Math.max(0, (f - THR) / (1 - THR)));
        const gx = F(i + 2, j) - F(i - 2, j);
        const gy = F(i, j + 2) - F(i, j - 2);
        const len = Math.hypot(gx * 8, gy * 8, 1);
        const nh = Math.max(0, (-gx * 8 * -0.3 + -gy * 8 * -0.4 + 0.87) / len);
        const curved = Math.min(1, Math.max(0, (Math.hypot(gx, gy) - 0.02) / 0.05)) * (hgt > 0.03 ? 1 : 0);
        const spec = (Math.pow(nh, 140) * 1.1 + Math.pow(nh, 24) * 0.12) * curved;
        const depth = 0.12 + hgt * 1.2;
        const edge = hgt < 0.07 ? 1 - hgt / 0.07 : 0;
        const shade = 1 - edge * 0.4;
        const k = (j * S + i) * 4;
        o[k] = Math.min(255, (204 * Math.exp(-1.05 * depth) * shade + spec * 255));
        o[k + 1] = Math.min(255, (18 * Math.exp(-3.2 * depth) * shade + spec * 240));
        o[k + 2] = Math.min(255, (15 * Math.exp(-2.8 * depth) * shade + spec * 230));
        o[k + 3] = Math.min(255, cover * (0.82 + 0.16 * Math.min(1, hgt / 0.25)) * 255);
      }
    }
    x.putImageData(out, 0, 0);
    return c.toDataURL();
  }

  let lastCa = '';
  return {
    /** A blow landed: shake and fringe the screen. `power` 0..1. */
    kick(power: number, hurtYou: boolean) {
      shake = Math.max(shake, (hurtYou ? 9 : 4) + power * (hurtYou ? 14 : 6));
      fringe = Math.max(fringe, (hurtYou ? 2.5 : 1.2) + power * 2.5);
      glitchT = Math.max(glitchT, hurtYou ? 0.35 : 0.2);
    },

    /** Drops of blood landing on the panels. */
    splash(count: number, big: boolean) {
      const ps = panels();
      if (!ps.length) return;
      for (let i = 0; i < count; i++) {
        const p = ps[Math.floor(Math.random() * ps.length)];
        if (p.querySelectorAll('.ui-blood').length > 4) continue;
        const size = (big ? 90 : 55) + Math.random() * (big ? 80 : 45);
        const el = document.createElement('i');
        el.className = 'ui-blood';
        el.style.width = el.style.height = `${size}px`;
        el.style.left = `${Math.random() * 100}%`;
        el.style.top = `${Math.random() * 100}%`;
        el.style.backgroundImage = `url(${spriteFor(size * 1.5)})`;
        el.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`;
        p.appendChild(el);
      }
    },

    /** Cleans the blood off the panels. */
    clear() {
      for (const el of game.querySelectorAll('.ui-blood')) el.remove();
    },

    update(dt: number) {
      shake = Math.max(0, shake - dt * 45);
      fringe = Math.max(0, fringe - dt * 12);
      glitchT = Math.max(0, glitchT - dt);
      if (shake > 0.2) {
        const a = Math.random() * Math.PI * 2;
        game.style.transform = `translate(${Math.cos(a) * shake}px, ${Math.sin(a) * shake}px) rotate(${(Math.random() - 0.5) * shake * 0.08}deg)`;
      } else if (game.style.transform) game.style.transform = '';
      const ca = `${fringe.toFixed(1)}px`;
      if (ca !== lastCa) {
        lastCa = ca;
        game.style.setProperty('--hitca', ca);
      }
      game.classList.toggle('hit', fringe > 0.1);
      // Panels jump sideways in glitchy bursts (and are put back once, after).
      if (glitchT <= 0 && !jumped) return;
      jumped = glitchT > 0;
      for (const p of panels()) {
        if (glitchT > 0 && Math.random() < 0.35) {
          p.style.transform = `translateX(${(Math.random() - 0.5) * 18}px) skewX(${(Math.random() - 0.5) * 6}deg)`;
        } else if (p.style.transform) p.style.transform = '';
      }
    },
  };
}
