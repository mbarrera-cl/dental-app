import type { Routes } from '@angular/router';

export const AGENDA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./agenda-page/agenda-page').then((m) => m.AgendaPage),
  },
];
