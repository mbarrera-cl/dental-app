import type { Routes } from '@angular/router';
import { ClinicalRecordStore } from './clinical-record.store';

/**
 * Routes exposed by the `patients` remote through Native Federation
 * (`./routes` in `federation.config.mjs`). The shell mounts them lazily.
 *
 * `/patients/:id` is the ficha clínica: a shell with the autofilled HCU header
 * (the `ClinicalRecordStore` lives in the route so every tab shares it) and
 * three tabs — record, odontogram and indicators.
 */
export const PATIENTS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./patients-page/patients-page').then((m) => m.PatientsPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./patient-detail/patient-detail-page').then((m) => m.PatientDetailPage),
    providers: [ClinicalRecordStore],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'ficha' },
      {
        path: 'ficha',
        loadComponent: () =>
          import('./clinical-record/clinical-record-page').then((m) => m.ClinicalRecordPage),
      },
      {
        path: 'odontograma',
        loadComponent: () => import('./odontogram/odontogram-page').then((m) => m.OdontogramPage),
      },
      {
        path: 'indicadores',
        loadComponent: () => import('./indices/indices-page').then((m) => m.IndicesPage),
      },
    ],
  },
];
