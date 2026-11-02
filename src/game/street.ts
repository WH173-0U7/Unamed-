import * as THREE from 'three';
import { Person, skeleton, mulberry, type Kind, type Stage } from './people';

const grey = (v: number, a = 1) => {
  const c = Math.max(0, Math.min(255, Math.round(v)));
  return a >= 1 ? `rgb(${c},${c},${c})` : `rgba(${c},${c},${c},${a})`;
};

/**
 * What the TV shows: a night-time security camera on a city street, seen
 * side-on. A brick wall with windows and a doorway, a street lamp, a wet
 * sidewalk. Every cut to a new camera builds a different street. People
 * (see people.ts) walk through it as silhouettes against the lamp light.
 */
export function createStreet() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  // The street itself is drawn once per camera into this, then copied each frame.
  const backdrop = document.createElement('canvas');
  const bctx = backdrop.getContext('2d')!;

  let width = 1;
  let height = 1;
  let scale = 1;
  let time = 0;
  let seed = (Math.random() * 2 ** 31) | 0;
  let cam = 1;
  let clock = 0; // seconds past midnight on the camera's timestamp
  let flicker = 1;
  let person: Person | null = null;
  /** People who stay after their part is done (someone asleep in the doorway). */
  let resting: Person | null = null;
  const stage: Stage = { width: 1, H: 1, lampX: 0, doorX: 0 };
  let ground = 0;

  function layout() {
    stage.width = width;
    stage.H = Math.min(height * 0.36, width * 0.42);
    ground = height * 0.8;
    const r = mulberry(seed);
    stage.lampX = width * (0.35 + r() * 0.3);
    // The doorway sits well to one side of the lamp, in the gloom.
    const side = r() < 0.5 ? -1 : 1;
    stage.doorX = stage.lampX + side * Math.max(stage.H * 1.1, width * 0.22);
    // Keep it clear of the TV's curved edges (try the other side, else squeeze in).
    const lo = width * 0.14 + stage.H * 0.35;
    const hi = width * 0.86 - stage.H * 0.35;
    if (stage.doorX < lo || stage.doorX > hi) stage.doorX = stage.lampX - side * Math.max(stage.H * 1.1, width * 0.22);
    stage.doorX = Math.min(hi, Math.max(lo, stage.doorX));
    drawBackdrop(r);
  }

  function drawBackdrop(r: () => number) {
    backdrop.width = canvas.width;
    backdrop.height = canvas.height;
    const c = bctx;
    const { H, lampX, doorX } = stage;
    c.setTransform(scale, 0, 0, scale, 0, 0);

    // The wall: rows of bricks, each a slightly different shade.
    c.fillStyle = grey(9);
    c.fillRect(0, 0, width, ground);
    const bh = Math.max(5, H * 0.045);
    const bw = bh * 2.6;
    for (let row = 0, y = ground - bh; y > -bh; row++, y -= bh) {
      for (let x = row % 2 ? -bw / 2 : 0; x < width; x += bw) {
        c.fillStyle = grey(8 + r() * 6);
        c.fillRect(x + 0.6, y + 0.6, bw - 1.2, bh - 1.2);
      }
    }
    // Grime: dark streaks running down the wall.
    for (let i = 0; i < 7; i++) {
      const x = r() * width;
      const g = c.createLinearGradient(0, 0, 0, ground);
      g.addColorStop(0, grey(0, 0));
      g.addColorStop(1, grey(0, 0.35));
      c.fillStyle = g;
      c.fillRect(x, 0, H * (0.1 + r() * 0.3), ground);
    }

    // Windows, in rows up the wall. A few are lit behind blinds.
    const ww = H * 0.48;
    const wh = H * 0.62;
    const gap = H * 1.35;
    const offset = r() * gap;
    for (let wy = ground - H * 1.85; wy > -wh; wy -= H * 1.5) {
      for (let wx = offset - gap; wx < width; wx += gap) {
        c.fillStyle = grey(30);
        c.fillRect(wx - 3, wy - 3, ww + 6, wh + 6); // frame
        c.fillStyle = grey(38);
        c.fillRect(wx - 5, wy + wh + 2, ww + 10, 3); // sill
        const lit = r() < 0.3;
        if (lit) {
          const v = 70 + r() * 60;
          const g = c.createLinearGradient(0, wy, 0, wy + wh);
          g.addColorStop(0, grey(v * 0.7));
          g.addColorStop(1, grey(v));
          c.fillStyle = g;
          c.fillRect(wx, wy, ww, wh);
          // Blinds, some pulled part way up.
          const up = r() < 0.5 ? r() * 0.6 : 0;
          c.fillStyle = grey(v * 0.55);
          for (let y = wy + wh * up; y < wy + wh; y += 4) c.fillRect(wx, y, ww, 1.5);
        } else {
          c.fillStyle = grey(5);
          c.fillRect(wx, wy, ww, wh);
          c.fillStyle = grey(12);
          c.fillRect(wx + ww * 0.1, wy + wh * 0.08, ww * 0.25, wh * 0.84); // faint reflection
        }
        c.fillStyle = grey(30);
        c.fillRect(wx + ww / 2 - 1, wy, 2, wh); // mullion
      }
    }

    // The doorway: a deep, dark recess with a step.
    const dw = H * 0.62;
    const dh = H * 1.08;
    c.fillStyle = grey(26);
    c.fillRect(doorX - dw / 2 - 5, ground - dh - 5, dw + 10, dh + 5);
    c.fillStyle = grey(3);
    c.fillRect(doorX - dw / 2, ground - dh, dw, dh);
    c.fillStyle = grey(20);
    c.fillRect(doorX - dw / 2 - 4, ground - 4, dw + 8, 4);

    // A drainpipe.
    const px = r() < 0.5 ? width * 0.1 : width * 0.9;
    c.fillStyle = grey(22);
    c.fillRect(px, 0, Math.max(3, H * 0.03), ground);

    // Sidewalk: slabs, the kerb, and the road beyond.
    const sw = height * 0.07;
    c.fillStyle = grey(22);
    c.fillRect(0, ground, width, sw);
    c.fillStyle = grey(14);
    for (let x = r() * H; x < width; x += H * 0.9) c.fillRect(x, ground, 1.5, sw);
    c.fillStyle = grey(44);
    c.fillRect(0, ground + sw, width, 2.5);
    c.fillStyle = grey(6);
    c.fillRect(0, ground + sw + 2.5, width, height);
    // Puddles on the sidewalk.
    for (let i = 0; i < 3; i++) {
      c.fillStyle = grey(12);
      c.beginPath();
      c.ellipse(r() * width, ground + sw * (0.3 + r() * 0.5), H * (0.2 + r() * 0.4), sw * 0.15, 0, 0, Math.PI * 2);
      c.fill();
    }

    // The lamp post: pole, arm over the sidewalk, and the lamp head.
    const top = ground - H * 1.95;
    const pw = Math.max(3, H * 0.045);
    c.fillStyle = grey(26);
    c.fillRect(lampX - pw / 2, top, pw, ground - top);
    c.fillRect(lampX - pw, ground - H * 0.15, pw * 2, H * 0.15); // base
    c.fillRect(lampX - pw / 2, top, H * 0.3, pw * 0.8); // arm
    c.fillRect(lampX + H * 0.22, top - 2, H * 0.18, pw * 1.4); // head
    c.fillStyle = grey(48); // lit edge of the pole, facing the lamp
    c.fillRect(lampX + pw / 2 - 1, top + pw, 1, ground - top - pw);
  }

  /** Draws one person: a dark silhouette, rim-lit on the side facing the lamp. */
  function drawPerson(p: Person, light: number) {
    const H = stage.H;
    const sk = skeleton(p.pose, p.x, p.dir, ground, H, p.jitter);
    const toLamp = Math.sign(stage.lampX - p.x) || 1;
    const near = Math.max(0, 1 - Math.abs(stage.lampX - p.x) / (H * 1.6)) * light;

    const body = (dx: number, col: string, grow: number) => {
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const line = (pts: [number, number][], w: number) => {
        ctx.lineWidth = w + grow;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] + dx, pts[0][1]);
        for (const q of pts.slice(1)) ctx.lineTo(q[0] + dx, q[1]);
        ctx.stroke();
      };
      // Back leg and arm first, then the body, then the front ones.
      line(sk.legs[1], H * 0.085);
      line(sk.arms[1], H * 0.058);
      ctx.lineWidth = H * 0.15 + grow;
      ctx.beginPath();
      ctx.moveTo(sk.hip[0] + dx, sk.hip[1]);
      ctx.quadraticCurveTo(sk.back[0] + dx, sk.back[1], sk.neck[0] + dx, sk.neck[1]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sk.head[0] + dx, sk.head[1], sk.headR + grow / 2, 0, Math.PI * 2);
      ctx.fill();
      if (p.props.hood) {
        ctx.beginPath();
        ctx.arc(sk.head[0] + dx - p.dir * sk.headR * 0.25, sk.head[1] - sk.headR * 0.1, sk.headR * 1.3 + grow / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (p.props.hat) {
        ctx.fillRect(sk.head[0] + dx - sk.headR * 1.5, sk.head[1] - sk.headR * 0.75, sk.headR * 3, sk.headR * 0.35 + grow);
        ctx.fillRect(sk.head[0] + dx - sk.headR * 0.9, sk.head[1] - sk.headR * 1.6, sk.headR * 1.8, sk.headR + grow);
      }
      line(sk.legs[0], H * 0.085);
      line(sk.arms[0], H * 0.058);
      const hand = sk.arms[0][2];
      if (p.props.bottle) {
        ctx.save();
        ctx.translate(hand[0] + dx, hand[1]);
        const a = Math.atan2(hand[1] - sk.arms[0][1][1], hand[0] - sk.arms[0][1][0]);
        ctx.rotate(a - Math.PI / 2);
        ctx.fillRect(-H * 0.022 - grow / 2, -H * 0.02, H * 0.044 + grow, H * 0.12 + grow);
        ctx.restore();
      }
      if (p.props.bag) {
        const b = sk.arms[1][2];
        ctx.fillRect(b[0] + dx - H * 0.06, b[1], H * 0.12 + grow, H * 0.14 + grow);
      }
      if (p.props.blanket) {
        // A lumpy blanket pulled up over the sitting body.
        const k = p.props.blanket;
        const foot = sk.legs[0][2];
        ctx.beginPath();
        ctx.moveTo(sk.hip[0] + dx - p.dir * H * 0.1, ground);
        ctx.quadraticCurveTo(
          lerp(sk.hip[0], sk.neck[0], k) + dx - p.dir * H * 0.14,
          lerp(sk.hip[1], sk.neck[1], k) - H * 0.05,
          lerp(sk.hip[0], sk.neck[0], k) + dx + p.dir * H * 0.12,
          lerp(sk.hip[1], sk.neck[1] + H * 0.03, k),
        );
        ctx.quadraticCurveTo(sk.legs[0][1][0] + dx + p.dir * H * 0.04, sk.legs[0][1][1] - H * 0.06 - grow, foot[0] + dx + p.dir * H * 0.08, ground);
        ctx.closePath();
        ctx.fill();
      }
    };

    // Reflection in the wet sidewalk.
    ctx.save();
    ctx.translate(0, ground * 2);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.09 + near * 0.08;
    body(0, grey(160), 0);
    ctx.restore();
    // Shadow thrown away from the lamp.
    ctx.fillStyle = grey(0, 0.5 * near + 0.15);
    ctx.beginPath();
    ctx.ellipse(p.x - toLamp * H * 0.35 * near, ground + 2, H * (0.2 + near * 0.35), H * 0.025, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rim light, then the silhouette over it.
    body(0, grey(34 + 40 * near), Math.max(2, H * 0.014));
    body(toLamp * Math.max(1.5, H * 0.016), grey(60 + 195 * near), 1);
    body(0, grey(2), 0);
  }

  /** A shopping cart: wire basket, piled bags, small wheels. */
  function drawCart(x: number, dir: number) {
    const H = stage.H;
    const w = H * 0.46;
    const h = H * 0.26;
    const top = ground - H * 0.5;
    const x0 = x - w / 2;
    ctx.strokeStyle = grey(70);
    ctx.lineWidth = 1.2;
    ctx.fillStyle = grey(6);
    // Bags heaped above the basket.
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(x0 + w * (0.2 + i * 0.2), top - h * (0.15 + (i % 2) * 0.2), w * 0.18, h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x0 + w, top);
    ctx.lineTo(x0 + w * 0.88, top + h);
    ctx.lineTo(x0 + w * 0.12, top + h);
    ctx.closePath();
    ctx.stroke();
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(x0 + (w * i) / 6, top);
      ctx.lineTo(x0 + w * 0.12 + ((w * 0.76) * i) / 6, top + h);
      ctx.stroke();
    }
    // Handle on the side nearest the pusher, frame and wheels.
    const hx = dir === 1 ? x0 : x0 + w;
    ctx.beginPath();
    ctx.moveTo(hx, top);
    ctx.lineTo(hx - dir * H * 0.06, top - H * 0.04);
    ctx.moveTo(x0 + w * 0.12, top + h);
    ctx.lineTo(x0 + w * 0.15, ground - H * 0.04);
    ctx.moveTo(x0 + w * 0.88, top + h);
    ctx.lineTo(x0 + w * 0.85, ground - H * 0.04);
    ctx.stroke();
    ctx.fillStyle = grey(50);
    for (const wx of [x0 + w * 0.15, x0 + w * 0.85]) {
      ctx.beginPath();
      ctx.arc(wx, ground - H * 0.03, H * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    texture,

    setSize(w: number, h: number, pixelRatio: number) {
      width = w;
      height = h;
      scale = Math.min(pixelRatio, 2);
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      layout();
      // Keep anyone on screen in a sensible spot for the new size.
      for (const p of [person, resting]) if (p) p.x = Math.min(Math.max(p.x, -stage.H), w + stage.H);
    },

    /** Cuts to a different camera: a new street, empty. */
    newCamera() {
      seed = (Math.random() * 2 ** 31) | 0;
      cam = 1 + Math.floor(Math.random() * 9);
      clock = 60 * 60 * (Math.random() < 0.8 ? Math.random() * 4.5 : 22 + Math.random() * 2);
      person = null;
      resting = null;
      layout();
    },

    /** Someone walks into view. */
    spawn(kind: Kind) {
      person = new Person(kind, stage, (Math.random() * 2 ** 31) | 0);
    },

    /** The person currently in view (if any). */
    get person() {
      return person;
    },

    /** Moves time on for the people in view (only while not paused). */
    step(dt: number) {
      clock += dt;
      if (person) {
        person.update(dt);
        if (person.done) {
          if (person.kind === 'homeless') resting = person;
          person = null;
        }
      }
      if (resting) resting.update(dt);
    },

    /** Paints the camera picture (call every frame while the TV is on). */
    draw(dt: number) {
      time += dt;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(backdrop, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const { H, lampX } = stage;

      // The lamp buzzes, and now and then it stutters.
      const stutter = Math.sin(time * 0.37) > 0.93 ? (Math.sin(time * 61) > 0 ? 0.25 : 1) : 1;
      flicker = lerp(flicker, (0.92 + 0.08 * Math.sin(time * 13)) * stutter, Math.min(1, dt * 30));

      // Its light, spilling over the wall and pooling on the sidewalk.
      const lx = lampX + H * 0.31;
      const ly = ground - H * 1.92;
      ctx.globalCompositeOperation = 'lighter';
      let g = ctx.createRadialGradient(lx, ly, 0, lx, ly, H * 2.3);
      g.addColorStop(0, grey(255, 0.6 * flicker));
      g.addColorStop(0.06, grey(255, 0.3 * flicker));
      g.addColorStop(0.45, grey(255, 0.1 * flicker));
      g.addColorStop(1, grey(255, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(lx, ground + height * 0.035);
      ctx.scale(1, 0.18);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, H * 1.5);
      g.addColorStop(0, grey(255, 0.28 * flicker));
      g.addColorStop(1, grey(255, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-H * 1.5, -H * 1.5, H * 3, H * 3);
      ctx.restore();
      // A long wobbling reflection on the wet road.
      g = ctx.createLinearGradient(0, ground + height * 0.08, 0, height);
      g.addColorStop(0, grey(255, 0.16 * flicker));
      g.addColorStop(1, grey(255, 0));
      ctx.fillStyle = g;
      for (let y = ground + height * 0.08; y < height; y += 3) {
        const wob = Math.sin(y * 0.15 + time * 2.4) * H * 0.04;
        ctx.fillRect(lx - H * 0.06 + wob, y, H * 0.12, 2);
      }
      // The bulb itself.
      ctx.fillStyle = grey(255, 0.9 * flicker);
      ctx.fillRect(lx - H * 0.08, ly + 1, H * 0.16, 2.5);
      ctx.globalCompositeOperation = 'source-over';

      // People, and anything they've left behind.
      for (const p of [resting, person]) {
        if (!p) continue;
        if (p.props.cart) drawCart(p.props.cart.x, p.dir);
        drawPerson(p, flicker);
      }

      // Darkness creeping in from the edges of the lens.
      g = ctx.createRadialGradient(width / 2, height * 0.55, Math.min(width, height) * 0.3, width / 2, height * 0.55, Math.max(width, height) * 0.75);
      g.addColorStop(0, grey(0, 0));
      g.addColorStop(1, grey(0, 0.75));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // The camera's own overlay: name, timestamp, a blinking REC.
      const fs = Math.round(Math.min(16, Math.max(11, width * 0.028)));
      const mx = width * 0.09;
      const my = height * 0.08;
      ctx.font = `${fs}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.fillStyle = grey(200, 0.8);
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(`CAM ${String(cam).padStart(2, '0')}`, mx, my);
      const s = Math.floor(clock) % 86400;
      const hh = String(Math.floor(s / 3600)).padStart(2, '0');
      const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      ctx.textAlign = 'right';
      ctx.fillText(`${hh}:${mm}:${ss}`, width - mx, my);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      if (time % 1.2 < 0.7) {
        ctx.beginPath();
        ctx.arc(mx + fs * 0.4, height - my - fs * 0.45, fs * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillText('REC', mx + fs, height - my);

      texture.needsUpdate = true;
    },

    dispose() {
      texture.dispose();
    },
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
