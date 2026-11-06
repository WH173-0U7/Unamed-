/**
 * Every button answers a touch: it presses in while your finger is on it,
 * and lets off a ring of light when you let go. (Disabled ones don't.)
 */
export function installTapFeedback(root: Document = document) {
  root.addEventListener(
    'pointerdown',
    (ev) => {
      const b = (ev.target as Element | null)?.closest?.('button');
      if (!b || (b as HTMLButtonElement).disabled) return;
      const r = b.getBoundingClientRect();
      // Where the finger went down: the ring starts there.
      b.style.setProperty('--tap-x', `${Math.round(((ev as PointerEvent).clientX - r.left) || r.width / 2)}px`);
      b.style.setProperty('--tap-y', `${Math.round(((ev as PointerEvent).clientY - r.top) || r.height / 2)}px`);
      b.classList.remove('tapped');
      void (b as HTMLElement).offsetWidth;
      b.classList.add('tapped');
      window.setTimeout(() => b.classList.remove('tapped'), 520);
    },
    { passive: true, capture: true },
  );
}
