/** Interface defaults exposed by `GET /settings/ui` to every user. */
export interface UiSettings {
  /** Rows per page every paginated list starts with. */
  defaultPageSize: number;
}
