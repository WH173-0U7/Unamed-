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
 * - **Tranq:** sick and swimming. A green murk, a slow sway as if you're
 *   about to go over, and dark blotches drifting through.
 *
 * Only opacity and transforms are animated (see #drug in style.css), so it's
 * cheap; the strength (`--k`) fades as a high wears off.
 */
export type DrugLook = 'cocaine' | 'heroin' | 'fentanyl' | 'meth' | 'tranq';

export function createDrugs() {
  const el = document.createElement('div');
  el.id = 'drug';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i class="d-tint"></i><i class="d-glow"></i><i class="d-blot"></i><i class="d-fringe"></i><i class="d-lid d-top"></i><i class="d-lid d-bot"></i>';
  document.body.append(el);
  let cur = '';
  let kShown = '';
  return {
    /** What you're on now (null: nothing), and how strongly (0..1). */
    set(drug: DrugLook | null, k: number) {
      const d = drug ?? '';
      if (d !== cur) {
        cur = d;
        if (d) document.body.dataset.drug = d;
        else delete document.body.dataset.drug;
      }
      // In 5% steps: each change restyles the layers.
      const ks = (Math.round(Math.max(0, Math.min(1, k)) * 20) / 20).toFixed(2);
      if (ks !== kShown) {
        kShown = ks;
        el.style.setProperty('--k', ks);
      }
    },
  };
}
