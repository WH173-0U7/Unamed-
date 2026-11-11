/**
 * A short glitch whenever the screen changes: a tab, a drawer, a menu, a new
 * stage of an encounter. The element that changed tears and fringes for a
 * moment, and the glass over everything flickers with static (main.ts
 * listens for the event and pulses it).
 */
export function uiGlitch(el?: Element | null, power = 0.35) {
  if (el instanceof HTMLElement) {
    // (Restarted a frame later, once the style without it has been seen: forcing a layout right after a big redraw, like the map, costs a lot.)
    el.classList.remove('ui-glitch');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('ui-glitch')));
    // One listener per element, however often it glitches.
    if (!el.dataset.glitchHooked) {
      el.dataset.glitchHooked = '1';
      el.addEventListener('animationend', (ev) => {
        if (ev.animationName === 'ui-glitch') el.classList.remove('ui-glitch');
      });
    }
  }
  dispatchEvent(new CustomEvent('ui-glitch', { detail: power }));
}
