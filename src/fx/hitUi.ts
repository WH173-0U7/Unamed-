/**
 * Hit effects on the game's own interface (the HTML on top of the TV):
 * the whole screen shaking, colour fringing on the text, panels glitching
 * sideways, and drops of blood landing on the panels themselves.
 */
export function createHitUi(game: HTMLElement) {
  let shake = 0;
  let fringe = 0;
  let glitchT = 0;
  const panels = () => [...game.querySelectorAll<HTMLElement>('.enc-card, .enc-status, .enc-log, .enc-actions')];

  /** A drop of blood for the interface, shaded like the blood on the screen. */
  function bloodSprite(size: number): string {
    const S = Math.round(size);
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d')!;
    // Thickness first (white), then shade every pixel from it.
    x.fillStyle = '#fff';
    const cx = S / 2;
    const r0 = S * 0.22;
    const harm = Array.from({ length: 6 }, (_, i) => ({ a: (0.25 / (i + 1)) * Math.random(), p: Math.random() * 6.28, k: i + 2 }));
    const g = x.createRadialGradient(cx, cx, 0, cx, cx, r0 * 1.3);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0.45)');
    x.fillStyle = g;
    x.beginPath();
    for (let i = 0; i <= 60; i++) {
      const th = (i / 60) * Math.PI * 2;
      let r = 1;
      for (const h of harm) r += h.a * Math.sin(h.k * th + h.p);
      x.lineTo(cx + Math.cos(th) * r0 * r, cx + Math.sin(th) * r0 * r);
    }
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r0 * (1.2 + Math.random() * 1.0);
      x.beginPath();
      x.arc(cx + Math.cos(a) * d, cx + Math.sin(a) * d, 0.6 + Math.random() * S * 0.025, 0, Math.PI * 2);
      x.fill();
    }
    const img = x.getImageData(0, 0, S, S);
    const d = img.data;
    const T = (i: number, j: number) => d[(Math.min(S - 1, Math.max(0, j)) * S + Math.min(S - 1, Math.max(0, i))) * 4 + 3] / 255;
    const out = x.createImageData(S, S);
    const o = out.data;
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const t = T(i, j);
        if (t < 0.03) continue;
        const gx = T(i + 1, j) - T(i - 1, j);
        const gy = T(i, j + 1) - T(i, j - 1);
        const len = Math.hypot(gx * 4, gy * 4, 1);
        // Light from up-left: specular glint.
        const nx = -gx * 4 / len;
        const ny = -gy * 4 / len;
        const nz = 1 / len;
        const hdot = Math.max(0, nx * -0.33 + ny * -0.4 + nz * 0.85);
        const spec = Math.pow(hdot, 60) * (t > 0.3 ? 1 : 0);
        const deep = Math.min(1, Math.max(0, (t - 0.2) / 0.7));
        const rim = Math.min(1, Math.hypot(gx, gy) * 5);
        let r = (130 - 100 * deep) * (1 - rim * 0.3);
        let gg = 8 * (1 - deep);
        let b = 10 * (1 - deep) + 2;
        r += spec * 230;
        gg += spec * 210;
        b += spec * 200;
        const k = (j * S + i) * 4;
        o[k] = Math.min(255, r);
        o[k + 1] = Math.min(255, gg);
        o[k + 2] = Math.min(255, b);
        o[k + 3] = Math.min(255, (Math.min(1, t / 0.15) * 0.92 + spec * 0.08) * 255);
      }
    }
    x.putImageData(out, 0, 0);
    return c.toDataURL();
  }

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
        const size = (big ? 70 : 40) + Math.random() * (big ? 70 : 40);
        const el = document.createElement('i');
        el.className = 'ui-blood';
        el.style.width = el.style.height = `${size}px`;
        el.style.left = `${Math.random() * 100}%`;
        el.style.top = `${Math.random() * 100}%`;
        el.style.backgroundImage = `url(${bloodSprite(size * 1.5)})`;
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
      game.style.setProperty('--hitca', `${fringe.toFixed(2)}px`);
      game.classList.toggle('hit', fringe > 0.1);
      // Panels jump sideways in glitchy bursts.
      for (const p of panels()) {
        if (glitchT > 0 && Math.random() < 0.35) {
          p.style.transform = `translateX(${(Math.random() - 0.5) * 18}px) skewX(${(Math.random() - 0.5) * 6}deg)`;
        } else if (p.style.transform) p.style.transform = '';
      }
    },
  };
}
