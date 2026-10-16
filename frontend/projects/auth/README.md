# auth

Session and RBAC library of the shell and the remotes. It is a Native
Federation **singleton**: every microfrontend shares one `SessionStore`
instance (the lib is added to `paths` in the workspace `tsconfig.json`, which
is how the federation plugin discovers shared mappings).

Contents:

- `SessionStore` — signals for user, roles and effective permissions; login,
  silent `bootstrap()` (refresh cookie), single-flight `refresh()`, logout and
  `changePassword`. The access token lives in memory only.
- `authInterceptor` — Bearer header from the store, cookies on, one shared
  refresh + retry on 401, redirect to `/login?returnUrl=…` when it fails.
- `authGuard` / `permissionGuard({ allOf?, anyOf? })` — `canMatch` guards.
- `HasPermissionDirective` — `*hasPermission="'users:create'"` (or an array
  with `mode: 'any'`), reactive to role changes.
- `PermissionMatrixComponent` — reusable role/API-key permission editor
  (accordion, counters, select-all, search, read-only and "via role" states).
- `PERMISSION_KEYS` — typed keys mirroring the backend catalog.

Build order note: `ng build auth` resolves `data-access` from its `dist`
output (`tsconfig.lib.json` maps it there), so run `ng build data-access`
first. Tests (`ng test auth`) resolve everything from source and have no
build prerequisite.
