/**
 * Search in the system map: accents and case do not matter ("secu" finds "Sécurité"),
 * every word of the query must appear somewhere in the entry (title, summary, tags).
 */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** `haystack` is already normalised (done once, at build time). */
export function matchesQuery(haystack: string, query: string): boolean {
  const words = normalizeText(query).split(' ').filter(Boolean);
  return words.every((word) => haystack.includes(word));
}
