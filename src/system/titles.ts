import { bindHover } from './map';

/**
 * Title cards over the bodies (SystemPanels.astro), toggled with the I key or the map's
 * button. DOM only: the 3D side places the cards (placeTitles) while they are shown.
 */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

export interface Titles {
  root: HTMLElement;
  cards: Map<string, HTMLElement>;
  shown: () => boolean;
  dispose: () => void;
}

function setShown(root: HTMLElement, shown: boolean): void {
  root.hidden = !shown;
  for (const button of document.querySelectorAll('[data-titles-toggle]')) {
    button.setAttribute('aria-pressed', String(shown));
  }
}

export function bindTitles(hover: (slug: string | null) => void): Titles | null {
  const root = document.getElementById('body-titles');
  if (!root) return null;
  const cards = new Map(
    [...root.querySelectorAll<HTMLElement>('[data-title-of]')].map((c) => [
      c.dataset.titleOf ?? '',
      c,
    ]),
  );
  const toggle = () => setShown(root, root.hidden !== false);
  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === 'i' && !typing(e.target) && !e.ctrlKey && !e.metaKey) toggle();
  };
  const onClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement | null)?.closest('[data-titles-toggle]')) toggle();
  };
  window.addEventListener('keydown', onKey);
  document.addEventListener('click', onClick);
  const unhover = bindHover(root, { hover });
  return {
    root,
    cards,
    shown: () => !root.hidden,
    dispose: () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
      unhover();
      setShown(root, false);
    },
  };
}
