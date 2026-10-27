import { describe, expect, it } from 'vitest';
import { GLOW, createHighlight, dimTarget, easeGlow, glowTarget } from '../../src/system/highlight';

describe('body highlight', () => {
  it('lights the hovered body, the search matches and the moons of the visited body', () => {
    const state = createHighlight();
    state.hovered = 'kalidoku';
    state.marked = new Set(['vps']);
    state.focused = 'vps';
    expect(glowTarget({ slug: 'kalidoku' }, state)).toBe(GLOW.hovered);
    expect(glowTarget({ slug: 'vps' }, state)).toBe(GLOW.marked);
    expect(glowTarget({ slug: 'skill-docker', host: 'vps' }, state)).toBe(GLOW.moonOfFocused);
    expect(glowTarget({ slug: 'chess' }, state)).toBe(0);
  });

  it('keeps the strongest reason when several apply', () => {
    const state = { hovered: 'vps', marked: new Set(['vps']), focused: null };
    expect(glowTarget({ slug: 'vps' }, state)).toBe(GLOW.hovered);
  });

  it('eases towards the target, whatever the frame rate', () => {
    const once = easeGlow(0, 1, 0.1);
    const twice = easeGlow(easeGlow(0, 1, 0.05), 1, 0.05);
    expect(once).toBeCloseTo(twice);
    expect(easeGlow(1, 0, 10)).toBeCloseTo(0);
  });

  it('fades what a search does not match, nothing without a search', () => {
    const state = createHighlight();
    expect(dimTarget({ slug: 'chess' }, state)).toBe(0);
    state.marked = new Set(['kalidoku']);
    expect(dimTarget({ slug: 'chess' }, state)).toBe(1);
    expect(dimTarget({ slug: 'kalidoku' }, state)).toBe(0);
  });
});
