/**
 * Seeing double through cracked glass. Each shard between the cracks bends
 * the light a little differently, so what's behind it shows twice: the
 * picture, and a faint copy shifted a few pixels, broken off sharp along the
 * crack lines.
 *
 * Done with an SVG filter on the game view (the glass itself is a canvas on
 * top, which can't see what's under it): a displacement map, one flat colour
 * per shard (which way it shifts), moves a copy of the view, and that copy is
 * laid over the picture at part strength. Shards only appear once the cracks
 * around them have, and the shift grows with how close you are to going out.
 */

/** A piece of glass between cracks: its outline, when it's revealed (0..1), and which way it bends things. */
export interface Shard {
  pts: { x: number; y: number }[];
  t: number;
  dx: number;
  dy: number;
}

import { settings } from '../core/settings';

const NS = 'http://www.w3.org/2000/svg';
/** Remembered for this visit: the device couldn't keep up with it, so it stays off. */
const TOO_SLOW = 'darcvoyd.noGhost';
const ID = 'crack-ghost';
/** The map is drawn small (it's flat colours with straight edges) and stretched. */
const MAP_SCALE = 0.25;
/** The most a shard shifts what's behind it, in CSS pixels. */
const MAX_SHIFT = 9;

export function createCrackGhost(target: HTMLElement) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  svg.innerHTML =
    `<filter id="${ID}" x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
    `<feImage result="map" preserveAspectRatio="none" x="0" y="0" width="1" height="1" />` +
    `<feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="shifted" />` +
    `<feComponentTransfer in="shifted" result="ghost"><feFuncA type="linear" slope="0" /></feComponentTransfer>` +
    `<feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="ghost" /></feMerge>` +
    `</filter>`;
  document.body.append(svg);
  const img = svg.querySelector('feImage')!;
  const disp = svg.querySelector('feDisplacementMap')!;
  const alpha = svg.querySelector('feFuncA')!;

  const map = document.createElement('canvas');
  let shards: Shard[] = [];
  let w = 0;
  let h = 0;
  /** How many shards are drawn into the map now (it's redrawn when more show). */
  let drawn = -1;
  let on = false;
  // (Reduced motion: the picture stays steady.)
  const still = matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let slow = false;
  try {
    slow = sessionStorage.getItem(TOO_SLOW) === '1';
  } catch {
    /* no storage */
  }
  /**
   * It's a heavy effect on some phones. While it's showing, count frames:
   * if it drags the game under 30 a second, it goes off and stays off.
   */
  let frames = 0;
  let since = 0;
  let last = 0;
  let watching = 0;
  const watch = (t: number) => {
    if (!on) {
      watching = 0;
      return;
    }
    // (A long gap: the page was hidden, or it just switched on. Start counting
    // again. Slow frames, even very slow ones, are well under this.)
    if (!since || t - last > 1500) {
      since = t;
      frames = 0;
    }
    last = t;
    frames++;
    if (t - since >= 2000) {
      const fps = (frames * 1000) / (t - since);
      frames = 0;
      since = t;
      if (fps < 30) {
        slow = true;
        try {
          sessionStorage.setItem(TOO_SLOW, '1');
        } catch {
          /* no storage */
        }
        target.style.filter = '';
        on = false;
        watching = 0;
        return;
      }
    }
    watching = requestAnimationFrame(watch);
  };

  const drawMap = (level: number) => {
    const show = shards.filter((s) => s.t <= level);
    if (show.length === drawn) return;
    drawn = show.length;
    map.width = Math.max(1, Math.round(w * MAP_SCALE));
    map.height = Math.max(1, Math.round(h * MAP_SCALE));
    const c = map.getContext('2d')!;
    // Neutral grey: no shift.
    c.fillStyle = 'rgb(128,128,0)';
    c.fillRect(0, 0, map.width, map.height);
    c.setTransform(MAP_SCALE, 0, 0, MAP_SCALE, 0, 0);
    for (const s of show) {
      c.fillStyle = `rgb(${Math.round(128 + s.dx * 127)},${Math.round(128 + s.dy * 127)},0)`;
      c.beginPath();
      s.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.closePath();
      c.fill();
    }
    const url = map.toDataURL('image/png');
    img.setAttribute('href', url);
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
    img.setAttribute('width', String(w));
    img.setAttribute('height', String(h));
  };

  return {
    /** A fresh break: the shards from cracks.ts, for a view of this size. */
    setShards(next: Shard[], width: number, height: number) {
      shards = next;
      w = width;
      h = height;
      drawn = -1;
    },
    /** How far the cracks have spread (0..1): more shards, a bigger shift, a stronger ghost. */
    update(level: number) {
      const want = !still && !slow && settings.quality !== 'low' && level > 0.06 && shards.length > 0 && w > 0;
      if (!want) {
        if (on) {
          target.style.filter = '';
          on = false;
        }
        return;
      }
      drawMap(level);
      const k = Math.min(1, (level - 0.06) / 0.6);
      disp.setAttribute('scale', (MAX_SHIFT * 2 * (0.35 + 0.65 * k)).toFixed(1));
      alpha.setAttribute('slope', (0.22 + 0.3 * k).toFixed(2));
      if (!on) {
        target.style.filter = `url(#${ID})`;
        on = true;
        frames = 0;
        since = 0;
        if (!watching) watching = requestAnimationFrame(watch);
      }
    },
    dispose() {
      target.style.filter = '';
      svg.remove();
    },
  };
}
