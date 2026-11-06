/**
 * "Move your game": export the save as a code to copy, or paste one in to
 * load it (Settings). A small panel over the menu.
 */
import { exportCode, importCode, type SaveData } from '../core/save';

function panel(html: string): HTMLElement {
  document.getElementById('transfer')?.remove();
  const el = document.createElement('div');
  el.id = 'transfer';
  el.innerHTML = `<div class="transfer-card">${html}<button type="button" class="btn transfer-close">Close</button></div>`;
  el.querySelector('.transfer-close')!.addEventListener('click', () => el.remove());
  document.body.append(el);
  return el;
}

/** Copy the code (and show it, in case copying isn't allowed). */
export async function showExport(toast: (t: string) => void) {
  const code = await exportCode().catch(() => null);
  if (!code) return toast('There’s no saved game to move');
  const el = panel(
    `<h3>Your game, as a code</h3>` +
      `<p>Paste this on the other device: Settings, Move your game, Import. It’s long; copy all of it.</p>` +
      `<textarea readonly spellcheck="false"></textarea>` +
      `<button type="button" class="btn transfer-copy">Copy it again</button>`,
  );
  const ta = el.querySelector('textarea')!;
  ta.value = code;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Copied. Paste it somewhere safe, or straight into the other device.');
    } catch {
      ta.focus();
      ta.select();
      toast('Couldn’t copy by itself: select all of it and copy.');
    }
  };
  el.querySelector('.transfer-copy')!.addEventListener('click', () => void copy());
  void copy();
}

/** Paste a code in; it replaces the game saved here (asked first). */
export function showImport(toast: (t: string) => void, confirmReplace: (go: () => void) => void, loaded: (s: SaveData) => void) {
  const el = panel(
    `<h3>Load a game from a code</h3>` +
      `<p>Paste the code from the other device. It replaces the game saved here.</p>` +
      `<textarea spellcheck="false" placeholder="DARCVOYD1:…"></textarea>` +
      `<button type="button" class="btn transfer-load">Load this game</button>`,
  );
  const ta = el.querySelector('textarea')!;
  el.querySelector('.transfer-load')!.addEventListener('click', () => {
    const code = ta.value.trim();
    if (!code) return toast('Paste the code in first');
    // (Out of the way of the question.)
    el.hidden = true;
    confirmReplace(() => {
      void importCode(code).then((s) => {
        if (!s) {
          el.hidden = false;
          return toast('That isn’t a whole code. Copy all of it and try again.');
        }
        el.remove();
        loaded(s);
      });
    });
  });
}
