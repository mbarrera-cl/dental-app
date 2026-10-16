import type { Routes } from '@angular/router';

/**
 * Routes exposed by the `patients` remote through Native Federation
 * (`./routes` in `federation.config.mjs`). The shell mounts them lazily.
 */
export const PATIENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./patients-page/patients-page').then((m) => m.PatientsPage),
  },
];
