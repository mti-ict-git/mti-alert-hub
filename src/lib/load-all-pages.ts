export type ListPage<T> = {
  items: T[];
  page: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

// Keep each request within the API limit. Never return a successful partial list.
export async function loadAllPages<T extends { id: string }>(
  fetchPage: (page: number, pageSize: number) => Promise<ListPage<T>>,
): Promise<T[]> {
  const items = new Map<string, T>();
  let lastPage = 1;
  for (let page = 1; page <= lastPage; page++) {
    const response = await fetchPage(page, 200);
    const meta = response.page;
    if (!meta || meta.page !== page || !Number.isInteger(meta.totalPages) || meta.totalPages < 0) {
      throw new Error("Invalid pagination response. Please refresh the list.");
    }
    // Fix the traversal boundary at the first response to avoid chasing a growing list.
    if (page === 1) lastPage = Math.max(1, meta.totalPages);
    for (const item of response.items) items.set(item.id, item);
  }
  return [...items.values()];
}
