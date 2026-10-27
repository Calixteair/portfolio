import { describe, expect, it } from 'vitest';
import { matchesQuery, normalizeText } from '../../src/system/search';

describe('system map search', () => {
  const haystack = normalizeText('Sécurité offensive · SOC Wazuh, détection — Rust');

  it('ignores accents, case and extra spaces', () => {
    expect(normalizeText('  Élève   SÉCU ')).toBe('eleve secu');
    expect(matchesQuery(haystack, 'secu')).toBe(true);
    expect(matchesQuery(haystack, 'DETECTION')).toBe(true);
  });

  it('needs every word of the query', () => {
    expect(matchesQuery(haystack, 'soc rust')).toBe(true);
    expect(matchesQuery(haystack, 'soc java')).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(matchesQuery(haystack, '   ')).toBe(true);
  });
});
