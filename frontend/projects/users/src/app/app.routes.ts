import type { Routes } from '@angular/router';

/**
 * Routes exposed by the `users` remote through Native Federation
 * (`./routes` in `federation.config.mjs`). The shell mounts them lazily.
 */
export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./users-page/users-page').then((m) => m.UsersPage),
  },
];
