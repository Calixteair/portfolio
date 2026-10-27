import { matchesQuery } from './search';

/**
 * The system map (SystemPanels.astro): every body grouped, a search that filters the list
 * and lights the matches up in 3D, open at first (closed on small screens), toggled with
 * its button or the M key. DOM only: the 3D side gets callbacks.
 */
export interface MapEvents {
  /** Search matches, or null when the search is empty. */
  mark: (slugs: ReadonlySet<string> | null) => void;
  /** A list entry under the pointer or the keyboard focus: light its body up. */
  hover: (slug: string | null) => void;
  open: (slug: string) => void;
}

const SMALL_SCREEN = '(max-width: 640px)';

function setOpen(root: HTMLElement, open: boolean): void {
  root.dataset.open = String(open);
  const reopen = document.querySelector<HTMLElement>('.map-open');
  if (reopen) reopen.hidden = open;
  for (const button of document.querySelectorAll<HTMLElement>('[data-map-toggle]')) {
    button.setAttribute('aria-expanded', String(open));
  }
}

/** Filter the list; returns the matching slugs (null for an empty query). */
function filter(root: HTMLElement, query: string): Set<string> | null {
  const active = query.trim() !== '';
  const found = new Set<string>();
  for (const group of root.querySelectorAll<HTMLElement>('[data-map-group]')) {
    let any = false;
    for (const item of group.querySelectorAll<HTMLElement>('[data-search]')) {
      const hit = !active || matchesQuery(item.dataset.search ?? '', query);
      item.hidden = !hit;
      if (hit && item.dataset.slug) found.add(item.dataset.slug);
      any ||= hit;
    }
    group.hidden = !any;
  }
  const empty = root.querySelector<HTMLElement>('[data-map-empty]');
  if (empty) empty.hidden = found.size > 0;
  return active ? found : null;
}

const typing = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

function firstResult(root: HTMLElement): string | undefined {
  return root.querySelector<HTMLElement>('[data-search]:not([hidden])')?.dataset.slug;
}

/** Search box: filter as you type, Enter goes to the first result, Escape clears. */
function bindSearch(root: HTMLElement, input: HTMLInputElement, events: MapEvents): () => void {
  const onInput = () => events.mark(filter(root, input.value));
  const onKey = (e: KeyboardEvent) => {
    const first = e.key === 'Enter' ? firstResult(root) : undefined;
    if (first) events.open(first);
    if (e.key === 'Escape' && input.value) {
      // Clear the search, without also closing the open panel (window listener).
      e.stopPropagation();
      input.value = '';
      onInput();
    }
  };
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKey);
  return () => {
    input.removeEventListener('input', onInput);
    input.removeEventListener('keydown', onKey);
  };
}

/** List entries light their body up under the pointer or the keyboard focus. */
function bindHover(root: HTMLElement, events: MapEvents): () => void {
  const slugOf = (e: Event) =>
    (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-body]')?.dataset.body ?? null;
  const enter = (e: Event) => events.hover(slugOf(e));
  const leave = () => events.hover(null);
  root.addEventListener('pointerover', enter);
  root.addEventListener('pointerleave', leave);
  root.addEventListener('focusin', enter);
  root.addEventListener('focusout', leave);
  return () => {
    root.removeEventListener('pointerover', enter);
    root.removeEventListener('pointerleave', leave);
    root.removeEventListener('focusin', enter);
    root.removeEventListener('focusout', leave);
  };
}

export function bindMap(events: MapEvents): () => void {
  const root = document.getElementById('system-map');
  const input = root?.querySelector<HTMLInputElement>('[data-map-search]');
  if (!root || !input) return () => {};
  setOpen(root, !matchMedia(SMALL_SCREEN).matches);
  const toggle = () => setOpen(root, root.dataset.open !== 'true');
  const onClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement | null)?.closest('[data-map-toggle]')) toggle();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === 'm' && !typing(e.target) && !e.ctrlKey && !e.metaKey) toggle();
  };
  document.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  const unbind = [bindSearch(root, input, events), bindHover(root, events)];
  return () => {
    document.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
    for (const off of unbind) off();
  };
}
