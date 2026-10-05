import 'server-only';

/**
 * Supabase (PostgREST) caps every response at the project's `max_rows`, 1000
 * by default, and `.limit(50000)` cannot raise it: the extra rows are simply
 * not sent, with no error. Anything that must see a whole table — a report
 * total, the ECCD checklist a save is about to replace — reads it in pages.
 *
 * `page(from, to)` must build a fresh query with a deterministic `.order()` on
 * a unique key (or a unique combination), otherwise rows can repeat or go
 * missing between pages.
 */
const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
