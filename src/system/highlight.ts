/**
 * How much each body glows (0-1), from what the visitor does: the body under the pointer,
 * the search matches, and the moons of the body being visited (a hint they are clickable).
 * Pure: the 3D side eases each body's glow towards this target.
 */
export interface HighlightState {
  hovered: string | null;
  /** Search matches; null when no search is active. */
  marked: ReadonlySet<string> | null;
  /** The body in orbit (its moons light up). */
  focused: string | null;
}

export const GLOW = { hovered: 1, marked: 0.75, moonOfFocused: 0.8 } as const;

export function createHighlight(): HighlightState {
  return { hovered: null, marked: null, focused: null };
}

export function glowTarget(body: { slug: string; host?: string }, state: HighlightState): number {
  let target = 0;
  if (state.hovered === body.slug) target = GLOW.hovered;
  if (state.marked?.has(body.slug)) target = Math.max(target, GLOW.marked);
  if (state.focused !== null && body.host === state.focused) {
    target = Math.max(target, GLOW.moonOfFocused);
  }
  return target;
}

/** Ease `current` towards `target`, frame-rate independent (rate per second). */
export function easeGlow(current: number, target: number, dt: number, rate = 6): number {
  return current + (target - current) * (1 - Math.exp(-dt * rate));
}
