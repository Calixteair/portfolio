/** Fills and places the hover label (BodyLabel.tsx) from the frame loop, via CSSOM only. */

export interface LabelText {
  title: string;
  summary: string;
}

let shown: string | null = null;

export function showLabel(
  el: HTMLElement,
  slug: string,
  text: LabelText,
  at: { x: number; y: number },
): void {
  if (shown !== slug) {
    shown = slug;
    const title = el.querySelector('.body-label-title');
    const summary = el.querySelector('.body-label-summary');
    if (title) title.textContent = text.title;
    if (summary) summary.textContent = text.summary;
    el.hidden = false;
  }
  el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;
}

export function hideLabel(el: HTMLElement): void {
  if (shown === null) return;
  shown = null;
  el.hidden = true;
}
