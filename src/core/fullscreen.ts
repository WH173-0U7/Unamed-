/**
 * Keeps the game fullscreen.
 *
 * Browsers only allow fullscreen in response to a tap, click or key press, so
 * every one of those re-requests it whenever the game isn't fullscreen (for
 * example after the player swiped out of it or pressed Esc).
 *
 * iPhones don't support fullscreen for web pages at all; there the game runs
 * fullscreen when added to the home screen (see public/manifest.webmanifest).
 */

type FullscreenDoc = Document & { webkitFullscreenElement?: Element | null };
type FullscreenEl = HTMLElement & { webkitRequestFullscreen?: (opts?: FullscreenOptions) => Promise<void> | void };

export function isFullscreen(): boolean {
  const doc = document as FullscreenDoc;
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

let pending = false;

export function requestFullscreen() {
  if (pending || isFullscreen()) return;
  const el = document.documentElement as FullscreenEl;
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (!request) return;
  pending = true;
  try {
    // Some browsers return a promise, some return nothing.
    const result = request.call(el, { navigationUI: 'hide' }) as Promise<void> | undefined;
    if (result?.then) result.then(done, done);
    else setTimeout(done, 500);
  } catch {
    done();
  }
}

function done() {
  pending = false;
}

export function enforceFullscreen() {
  // One request per gesture, on the event each kind of input allows it from:
  // mouse press, finger lift, or a key (Esc is reserved for leaving fullscreen).
  addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') requestFullscreen();
    },
    { capture: true, passive: true },
  );
  addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType !== 'mouse') requestFullscreen();
    },
    { capture: true, passive: true },
  );
  addEventListener(
    'keydown',
    (e) => {
      if (e.code !== 'Escape') requestFullscreen();
    },
    { capture: true },
  );
}
