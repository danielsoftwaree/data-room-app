/**
 * Search params shared by both browser routes (room root and folder):
 * `?q` filters the room by name, `?select` reveals a node on arrival
 * (favorites deep-links).
 */
export interface BrowserSearch {
  q?: string;
  select?: string;
}

/** `validateSearch` implementation for the browser routes. */
export function validateBrowserSearch(search: Record<string, unknown>): BrowserSearch {
  const q = typeof search.q === 'string' ? search.q.trim() : '';
  const select = typeof search.select === 'string' ? search.select : '';
  return { ...(q ? { q } : {}), ...(select ? { select } : {}) };
}
