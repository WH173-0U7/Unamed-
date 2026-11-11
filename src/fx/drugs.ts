/**
 * What you're on, over the whole screen (under the glass, like the stress
 * tunnel). Each drug has its own look:
 *
 * - **Cocaine** (wired): cold and crisp. A frosty white rim at the edges,
 *   everything a little brighter, and a fine buzzing tremor.
 * - **Heroin:** warm and slow. An amber, faded wash, a soft glow in the
 *   middle, and heavy eyelids that droop and lift as you nod.
 * - **Fentanyl:** cold and fading. Blue-grey and drained of colour, the dark
 *   breathing in from the edges, and now and then your eyes almost close.
 * - **Meth:** hot and electric. A red-magenta glare, red and cyan fringes
 *   at the edges, a fast jitter, and flashes on a racing heartbeat.
 * - **Drunk:** warm and reeling. A golden haze, the room swaying and now
 *   and then lurching, the edges going soft. Stronger the more you drink.
 * - **Caffeine:** clear and bright: a clean lift at the edges; too much, and a
 *   fine tremor and a pulse at the edges (`jitters`).
 * - **Tranq:** sick and swimming. A green murk, a slow sway as if you're
 *   about to go over, and dark blotches drifting through.
 *
 * Only opacity and transforms are animated (see #drug in style.css), so it's
 * cheap; the strength (`--k`) fades as a high wears off.
 */
export type DrugLook = 'cocaine' | 'heroin' | 'fentanyl' | 'meth' | 'tranq' | 'drunk' | 'caffeine' | 'jitters' | 'withdrawal';

/** How long each takes to come on (seconds to most of the way there). */
const ONSET: Record<DrugLook, number> = { fentanyl: 12, cocaine: 15, meth: 18, heroin: 25, tranq: 30, drunk: 20, caffeine: 20, jitters: 20, withdrawal: 40 };

/**
 * How hard it rocks the whole screen, UI and all, and how much it blurs it
 * (at full strength). Drink most of all; a downer swims; the rest stay sharp.
 */
const REEL: Partial<Record<DrugLook, { sway: number; blur: number }>> = {
  drunk: { sway: 1, blur: 1 },
  tranq: { sway: 0.7, blur: 0.8 },
  heroin: { sway: 0.3, blur: 0.45 },
  fentanyl: { sway: 0.25, blur: 0.55 },
};

export function createDrugs() {
  const el = document.createElement('div');
  el.id = 'drug';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i class="d-tint"></i><i class="d-glow"></i><i class="d-blot"></i><i class="d-fringe"></i><i class="d-lid d-top"></i><i class="d-lid d-bot"></i>';
  document.body.append(el);
  // The blur: over everything (the street, a fight, a shop), and under the glass.
  const haze = document.createElement('div');
  haze.id = 'haze';
  haze.setAttribute('aria-hidden', 'true');
  document.body.append(haze);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur: DrugLook | null = null;
  let shown = 0;
  let kShown = '';
  // The sway: slow and wandering, and now and then a lurch you have to catch.
  let t = Math.random() * 100;
  let lurchX = 0;
  let lurchR = 0;
  let toX = 0;
  let toR = 0;
  let swaying = false;
  let blurShown = '';
  const reel = (dt: number) => {
    const game = document.getElementById('game');
    if (!game) return;
    const body = document.body.classList;
    const f = cur ? REEL[cur] : undefined;
    // Under a menu it eases off (you've still got to read it), and the pause menu is clear.
    const menu = body.contains('in-menu') ? 0.4 : 1;
    const a = body.contains('paused') || !f ? 0 : shown * f.sway * menu;
    const b = body.contains('paused') || !f ? 0 : Math.pow(shown, 1.3) * f.blur * menu;
    t += dt;
    if (a > 0.01 && !still) {
      // A lurch: the floor tips, and you catch yourself.
      if (Math.random() < dt * 0.16 * a) {
        const side = Math.random() < 0.5 ? -1 : 1;
        toX = side * (14 + Math.random() * 14) * a;
        toR = side * (1.8 + Math.random() * 1.8) * a;
      }
      lurchX += (toX - lurchX) * Math.min(1, dt * 5);
      lurchR += (toR - lurchR) * Math.min(1, dt * 5);
      toX *= Math.exp(-dt * 0.9);
      toR *= Math.exp(-dt * 0.9);
      const x = (Math.sin(t * 0.9) * 13 + Math.sin(t * 0.37 + 1) * 11) * a + lurchX;
      const y = (Math.sin(t * 0.71 + 2) * 7 + Math.sin(t * 0.23) * 5) * a;
      const r = (Math.sin(t * 0.53) * 2.8 + Math.sin(t * 0.19 + 0.5) * 1.8) * a + lurchR;
      game.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      game.style.rotate = `${r.toFixed(2)}deg`;
      // (A little bigger, so the edges don't show as it tips.)
      game.style.scale = (1 + 0.07 * a).toFixed(3);
      swaying = true;
    } else if (swaying) {
      game.style.translate = game.style.rotate = game.style.scale = '';
      lurchX = lurchR = toX = toR = 0;
      swaying = false;
    }
    // Blurrier the more you've had; it swims in and out of focus.
    // (Reduced motion: a steady blur, not one that pulses.)
    const px = b > 0.01 ? b * 5 * (still ? 1 : 0.7 + 0.3 * Math.sin(t * 0.8)) : 0;
    const bs = px < 0.15 ? '' : `blur(${(Math.round(px * 10) / 10).toFixed(1)}px)`;
    if (bs !== blurShown) {
      blurShown = bs;
      haze.style.backdropFilter = bs;
      haze.style.setProperty('-webkit-backdrop-filter', bs);
    }
  };
  return {
    /**
     * What you're on now (null: nothing), and how strongly (0..1). It comes
     * on slowly, and a different drug only takes over once the last has
     * faded out.
     */
    update(drug: DrugLook | null, k: number, dt: number) {
      let target = Math.max(0, Math.min(1, k));
      if (drug !== cur) {
        // The old one fades first.
        target = 0;
        if (shown < 0.02) {
          cur = drug;
          shown = 0;
          if (cur) document.body.dataset.drug = cur;
          else delete document.body.dataset.drug;
        }
      }
      const rate = target > shown ? 1 / (cur ? ONSET[cur] : 10) : 1 / 4;
      shown += (target - shown) * Math.min(1, dt * rate * 2.3);
      if (Math.abs(target - shown) < 0.004) shown = target;
      // In 2% steps: each change restyles the layers.
      const ks = (Math.round(shown * 50) / 50).toFixed(2);
      if (ks !== kShown) {
        kShown = ks;
        // Only on the two layers that read it (on body it restyled the whole page).
        el.style.setProperty('--k', ks);
        document.getElementById('game')?.style.setProperty('--k', ks);
      }
      reel(dt);
    },
  };
}
