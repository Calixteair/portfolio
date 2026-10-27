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

/** Screen margin (px) beyond which a title card is hidden rather than clipped. */
const EDGE = 40;
/** Card height plus a gap (px): a card overlapping a nearer one moves up by this much. */
const STEP = 24;
const MAX_STEPS = 4;

interface Placed {
  x: number;
  y: number;
  w: number;
}

const overlaps = (a: Placed, b: Placed) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < STEP;

/** Lowest free height above `p` among the cards already placed (nearer ones go first). */
function freeSpot(p: Placed, placed: readonly Placed[]): number {
  let y = p.y;
  for (let k = 0; k < MAX_STEPS && placed.some((q) => overlaps({ ...p, y }, q)); k++) y -= STEP;
  return y;
}

const widths = new WeakMap<HTMLElement, number>();

/** A card's width, measured once (reading layout every frame would force reflows). */
function widthOf(card: HTMLElement): number {
  let w = widths.get(card);
  if (w === undefined || w === 0) {
    w = card.offsetWidth;
    widths.set(card, w);
  }
  return w;
}

/**
 * Place each title card above its body, nearer bodies first and on top; a card that would
 * cover a nearer one moves up. Cards behind the camera or off screen are hidden.
 */
export function placeTitles(
  cards: ReadonlyMap<string, HTMLElement>,
  at: (slug: string) => { x: number; y: number; depth: number } | null,
  size: { width: number; height: number },
): void {
  const visible: { card: HTMLElement; p: { x: number; y: number; depth: number } }[] = [];
  for (const [slug, card] of cards) {
    const p = at(slug);
    const off =
      !p || p.x < -EDGE || p.y < -EDGE || p.x > size.width + EDGE || p.y > size.height + EDGE;
    if (card.hidden !== off) card.hidden = off;
    if (p && !off) visible.push({ card, p });
  }
  visible.sort((a, b) => a.p.depth - b.p.depth);
  const placed: Placed[] = [];
  visible.forEach(({ card, p }, i) => {
    const spot = { x: p.x, y: p.y, w: widthOf(card) };
    spot.y = freeSpot(spot, placed);
    placed.push(spot);
    card.style.zIndex = String(visible.length - i);
    card.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px)`;
  });
}
