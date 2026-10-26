/**
 * The static system UI (SystemPanels.astro): shows one detail panel at a time, and wires
 * the links between bodies, the back button and Escape. DOM only, no 3D.
 */

function root(): HTMLElement | null {
  return document.getElementById('system-ui');
}

export function revealSystemUi(): void {
  const el = root();
  if (el) el.hidden = false;
}

export function showPanel(slug: string): void {
  for (const panel of root()?.querySelectorAll<HTMLElement>('[data-panel]') ?? []) {
    panel.hidden = panel.dataset.panel !== slug;
  }
  // Move the focus to the panel title, so keyboard and screen reader users land on it.
  document.getElementById(`panel-title-${slug}`)?.focus({ preventScroll: true });
}

export function hidePanels(): void {
  for (const panel of root()?.querySelectorAll<HTMLElement>('[data-panel]') ?? []) {
    panel.hidden = true;
  }
}

export interface PanelEvents {
  /** A link to another body (keyboard list, related skills) was followed. */
  open: (slug: string) => void;
  /** Back button or Escape. */
  back: () => void;
}

/** Event delegation on the system UI; returns the cleanup. */
export function bindPanels(events: PanelEvents): () => void {
  const el = root();
  const click = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const link = target?.closest<HTMLElement>('[data-body]');
    if (link?.dataset.body) {
      e.preventDefault();
      events.open(link.dataset.body);
    } else if (target?.closest('[data-back]')) {
      events.back();
    }
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') events.back();
  };
  el?.addEventListener('click', click);
  window.addEventListener('keydown', key);
  return () => {
    el?.removeEventListener('click', click);
    window.removeEventListener('keydown', key);
  };
}
