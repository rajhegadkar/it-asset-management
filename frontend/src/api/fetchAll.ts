import { api } from './client.js';

/**
 * Loads every page of a list endpoint (the API returns at most 100 rows per page).
 * Used by pick-lists such as "Choose employee" / "Choose asset", which must offer every record,
 * not only the first 100. Returns an axios-like `{ data: { data: rows } }` so call sites stay unchanged.
 */
export async function getAll(path: string, maxPages = 50): Promise<{ data: { data: any[] } }> {
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.delete('limit');
  params.delete('page');
  const url = (page: number) => {
    const p = new URLSearchParams(params);
    p.set('limit', '100');
    p.set('page', String(page));
    return `${pathname}?${p.toString()}`;
  };
  const first = await api.get(url(1));
  const rows: any[] = Array.isArray(first.data?.data) ? [...first.data.data] : [];
  const totalPages = Math.min(first.data?.pagination?.totalPages || 1, maxPages);
  if (totalPages > 1) {
    const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, i) => api.get(url(i + 2))));
    rest.forEach((r) => Array.isArray(r.data?.data) && rows.push(...r.data.data));
  }
  return { data: { data: rows } };
}
