import { inject } from '@angular/core';
import type { RedirectFunction, Routes } from '@angular/router';
import { SessionStore, authGuard, permissionGuard, PERMISSION_KEYS } from 'auth';

/**
 * Sends `/admin` to the first section the user may open. It is a `redirectTo`
 * function because a route whose only configuration is a `canMatch` guard is
 * rejected by the router (NG04014) and `redirectTo` cannot be combined with
 * guards on the same route. Redirect functions run inside an injection
 * context, so the store resolves here. The parent guard already guarantees
 * at least one of the three administration permissions.
 */
export const adminHome: RedirectFunction = () => {
  const store = inject(SessionStore);

  if (store.has(PERMISSION_KEYS.roles.read)) {
    return 'roles';
  }

  if (store.has(PERMISSION_KEYS.settings.read)) {
    return 'settings';
  }

  if (store.has(PERMISSION_KEYS.apiKeys.read)) {
    return 'api-keys';
  }

  return '/forbidden';
};

/**
 * Routes exposed by the `admin` remote through Native Federation
 * (`./routes` in `federation.config.mjs`). The shell mounts them under
 * `/admin`; the guards also run standalone (`ng serve admin`).
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canMatch: [
      authGuard,
      permissionGuard({
        anyOf: [PERMISSION_KEYS.roles.read, PERMISSION_KEYS.settings.read, PERMISSION_KEYS.apiKeys.read],
      }),
    ],
    loadComponent: () => import('./admin-layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: adminHome },
      {
        path: 'roles',
        canMatch: [permissionGuard({ allOf: [PERMISSION_KEYS.roles.read] })],
        loadComponent: () => import('./roles/roles-page').then((m) => m.RolesPage),
      },
      {
        path: 'settings',
        canMatch: [permissionGuard({ allOf: [PERMISSION_KEYS.settings.read] })],
        loadComponent: () => import('./settings/settings-page').then((m) => m.SettingsPage),
      },
      {
        path: 'api-keys',
        canMatch: [permissionGuard({ allOf: [PERMISSION_KEYS.apiKeys.read] })],
        loadComponent: () => import('./api-keys/api-keys-page').then((m) => m.ApiKeysPage),
      },
    ],
  },
];
