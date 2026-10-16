import type { Routes } from '@angular/router';

/**
 * Routes exposed by the `dashboard` remote through Native Federation
 * (`./routes` in `federation.config.mjs`). The shell mounts them lazily.
 */
export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard-page/dashboard-page').then((m) => m.DashboardPage),
  },
];
