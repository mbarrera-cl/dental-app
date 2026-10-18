import { permissionGuard, PERMISSION_KEYS } from 'auth';
import type { Routes } from '@angular/router';
import { ClinicalRecordStore } from './clinical-record.store';

/**
 * Routes exposed by the `patients` remote through Native Federation
 * (`./routes` in `federation.config.mjs`). The shell mounts them lazily.
 *
 * `/patients/:id` is the ficha clínica: a shell with the autofilled HCU header
 * (the `ClinicalRecordStore` lives in the route so every tab shares it) and
 * the record, odontogram, indicators, quotes, prescriptions, consents and
 * patient-account tabs.
 *
 * `/patients/caja` is the first-level cash desk (Caja): patient balance
 * lookup + close of day, gated by `payments:read` (missing permissions land
 * on the shell's `/forbidden`).
 */
export const PATIENTS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./patients-page/patients-page').then((m) => m.PatientsPage),
  },
  {
    path: 'recetas/:prescriptionId/imprimir',
    loadComponent: () =>
      import('./prescriptions/prescription-print').then((m) => m.PrescriptionPrint),
  },
  {
    path: 'consentimientos/:consentId/imprimir',
    loadComponent: () => import('./consents/consent-print').then((m) => m.ConsentPrint),
  },
  {
    path: 'cuenta/:movementId/imprimir',
    loadComponent: () =>
      import('./patient-account/payment-receipt-print').then((m) => m.PaymentReceiptPrint),
  },
  {
    path: 'caja',
    canMatch: [permissionGuard({ allOf: [PERMISSION_KEYS.payments.read] })],
    loadComponent: () => import('./cash-desk/cash-desk-page').then((m) => m.CashDeskPage),
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
      {
        path: 'plan',
        loadComponent: () =>
          import('./treatment-plan/treatment-plan-page').then((m) => m.TreatmentPlanPage),
      },
      {
        path: 'historial',
        loadComponent: () => import('./timeline/timeline-page').then((m) => m.TimelinePage),
      },
      {
        path: 'presupuestos',
        loadComponent: () =>
          import('./patient-quotes/patient-quotes-page').then((m) => m.PatientQuotesPage),
      },
      {
        path: 'recetas',
        loadComponent: () =>
          import('./prescriptions/patient-prescriptions-page').then(
            (m) => m.PatientPrescriptionsPage,
          ),
      },
      {
        path: 'consentimientos',
        loadComponent: () =>
          import('./consents/patient-consents-page').then((m) => m.PatientConsentsPage),
      },
      {
        path: 'cuenta',
        loadComponent: () =>
          import('./patient-account/patient-account-page').then((m) => m.PatientAccountPage),
      },
    ],
  },
];
