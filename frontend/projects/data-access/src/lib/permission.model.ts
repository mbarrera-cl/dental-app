/**
 * The code-defined permission catalog, grouped by category (`GET /permissions`,
 * mirrors `permission-catalog-response.dto.ts`). The frontend only uses it to
 * render editors and hide actions — enforcement always happens server-side.
 */

/** One action inside a category, e.g. `users:read`. */
export interface PermissionAction {
  key: string;
  action: string;
  description: string;
}

/** One bounded context of permissions, e.g. `users` or `settings`. */
export interface PermissionCategory {
  id: string;
  description: string;
  permissions: PermissionAction[];
}

export interface PermissionCatalog {
  categories: PermissionCategory[];
}
