/**
 * Pagination contract shared by every list in the UI.
 *
 * Lists whose endpoint pages on the server (`Page<T>`) and lists the client
 * pages in memory (`slicePage`) both drive the same `PaginatorComponent`.
 */

export const DEFAULT_PAGE_SIZE = 10;

/** Sizes offered by the paginator (the configured default is added if absent). */
export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100];

export interface PageQuery {
  limit?: number;
  offset?: number;
}

/** Envelope returned by every paginated endpoint. */
export interface Page<T> {
  items: T[];
  /** Rows matching the filters, across every page. */
  total: number;
  /** Page size applied by the server. */
  limit: number;
  offset: number;
}

/** Total pages of a list; always at least 1 so empty lists still render one page. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

/** Clamps a 1-based page into the valid range of a list. */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, Math.trunc(page)), pageCount(total, pageSize));
}

/** Slices an already-loaded list into the requested 1-based page. */
export function slicePage<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.trunc(pageSize));
  const safePage = clampPage(page, items.length, size);
  const offset = (safePage - 1) * size;

  return {
    items: items.slice(offset, offset + size),
    total: items.length,
    limit: size,
    offset,
  };
}
