import { loadRemoteModule } from '@angular-architects/native-federation';
import type { Routes } from '@angular/router';

/**
 * Routes of the shell. Each microfrontend exposes a `./routes` entry
 * (`USERS_ROUTES` / `DASHBOARD_ROUTES`) which is loaded lazily from its own
 * dev server (:4201 / :4202) through Native Federation.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  {
    path: 'users',
    loadChildren: () =>
      loadRemoteModule<{ USERS_ROUTES: Routes }>('users', './routes').then((m) => m.USERS_ROUTES),
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      loadRemoteModule<{ DASHBOARD_ROUTES: Routes }>('dashboard', './routes').then(
        (m) => m.DASHBOARD_ROUTES,
      ),
  },
  { path: '**', redirectTo: 'users' },
];
