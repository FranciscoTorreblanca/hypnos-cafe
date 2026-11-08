/** Fetch an ordered, filtered dataset without assuming the API's row cap.
 * Callers must apply stable ordering (including a unique tie-breaker).
 * An error never returns a partial dataset as a successful report.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  signal?: AbortSignal,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (;;) {
    signal?.throwIfAborted();
    const { data, error } = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (error) throw error;
    signal?.throwIfAborted();
    if (!data?.length) return rows;
    rows.push(...data);
    // Continue even after a short page: the server may enforce a smaller cap.
  }
}