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
export type DrugLook = 'cocaine' | 'heroin' | 'fentanyl' | 'meth' | 'tranq' | 'drunk' | 'caffeine' | 'jitters';

/** How long each takes to come on (seconds to most of the way there). */
const ONSET: Record<DrugLook, number> = { fentanyl: 12, cocaine: 15, meth: 18, heroin: 25, tranq: 30, drunk: 20, caffeine: 20, jitters: 20 };

export function createDrugs() {
  const el = document.createElement('div');
  el.id = 'drug';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i class="d-tint"></i><i class="d-glow"></i><i class="d-blot"></i><i class="d-fringe"></i><i class="d-lid d-top"></i><i class="d-lid d-bot"></i>';
  document.body.append(el);
  let cur: DrugLook | null = null;
  let shown = 0;
  let kShown = '';
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
        document.body.style.setProperty('--k', ks);
      }
    },
  };
}
