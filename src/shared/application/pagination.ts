/**
 * Shared pagination contract: every paginated list endpoint answers with the
 * same envelope so clients page lists the same way regardless of the module.
 */
export interface Page<T> {
  items: T[];
  /** Rows matching the filters, across every page. */
  total: number;
  /** Page size actually applied by the server. */
  limit: number;
  offset: number;
}
