import { useState } from "react";

// These lists already load a bounded server result. This pager never implies a server-wide total.
export function useListPagination<T>(items: T[], filterKey = "") {
  const [state, setState] = useState({ key: filterKey, page: 1, pageSize: 25 });
  const pageCount = Math.max(1, Math.ceil(items.length / state.pageSize));
  const page = Math.min(state.key === filterKey ? state.page : 1, pageCount);
  if (state.key !== filterKey || state.page !== page) {
    setState({ ...state, key: filterKey, page });
  }
  return {
    items: items.slice((page - 1) * state.pageSize, page * state.pageSize),
    controls: {
      page,
      pageCount,
      pageSize: state.pageSize,
      total: items.length,
      onPageChange: (page: number) => setState((s) => ({ ...s, key: filterKey, page })),
      onPageSizeChange: (pageSize: number) => setState({ key: filterKey, page: 1, pageSize }),
    },
  };
}
