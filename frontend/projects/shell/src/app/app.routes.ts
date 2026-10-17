import { loadRemoteModule } from '@angular-architects/native-federation';
import type { Routes } from '@angular/router';
import { authGuard, permissionGuard, PERMISSION_KEYS } from 'auth';
/**
 * Routes of the shell. Each microfrontend exposes a `./routes` entry
 * (`PATIENTS_ROUTES` / `USERS_ROUTES` / `DASHBOARD_ROUTES` / `ADMIN_ROUTES`)
 * which is loaded lazily from its own dev server (:4203 / :4201 / :4202 /
 * :4204) through Native Federation.
 *
 * `login` and `forbidden` are public; everything else runs through
 * `authGuard` (silent bootstrap + returnUrl) and, where it makes sense,
 * `permissionGuard` (missing permissions land on `/forbidden`).
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'patients' },
  {
    path: 'login',
    loadComponent: () => import('./login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./forbidden/forbidden-page').then((m) => m.ForbiddenPage),
  },
  {
    path: 'account/api-keys',
    canMatch: [authGuard, permissionGuard({ allOf: [PERMISSION_KEYS.apiKeys.self] })],
    loadComponent: () => import('./account/api-keys/api-keys-page').then((m) => m.ApiKeysPage),
  },
  {
    path: 'settings/menu',
    canMatch: [authGuard, permissionGuard({ allOf: [PERMISSION_KEYS.settings.read] })],
    loadComponent: () => import('./settings/menu/menu-page').then((m) => m.MenuPage),
  },
  {
    path: 'settings/clinic',
    canMatch: [authGuard, permissionGuard({ allOf: [PERMISSION_KEYS.settings.read] })],
    loadComponent: () => import('./settings/clinic/clinic-page').then((m) => m.ClinicPage),
  },
  {
    path: 'patients',
    canMatch: [authGuard],
    loadChildren: () =>
      loadRemoteModule<{ PATIENTS_ROUTES: Routes }>('patients', './routes').then(
        (m) => m.PATIENTS_ROUTES,
      ),
  },
  {
    path: 'users',
    canMatch: [authGuard, permissionGuard({ allOf: [PERMISSION_KEYS.users.read] })],
    loadChildren: () =>
      loadRemoteModule<{ USERS_ROUTES: Routes }>('users', './routes').then((m) => m.USERS_ROUTES),
  },
  {
    path: 'dashboard',
    canMatch: [authGuard, permissionGuard({ allOf: [PERMISSION_KEYS.dashboard.read] })],
    loadChildren: () =>
      loadRemoteModule<{ DASHBOARD_ROUTES: Routes }>('dashboard', './routes').then(
        (m) => m.DASHBOARD_ROUTES,
      ),
  },
  {
    path: 'quotes',
    canMatch: [authGuard, permissionGuard({ allOf: [PERMISSION_KEYS.quotes.read] })],
    loadChildren: () =>
      loadRemoteModule<{ QUOTES_ROUTES: Routes }>('quotes', './routes').then((m) => m.QUOTES_ROUTES),
  },
  {
    path: 'admin',
    canMatch: [
      authGuard,
      permissionGuard({
        anyOf: [PERMISSION_KEYS.roles.read, PERMISSION_KEYS.settings.read, PERMISSION_KEYS.apiKeys.read],
      }),
    ],
    loadChildren: () =>
      loadRemoteModule<{ ADMIN_ROUTES: Routes }>('admin', './routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '**', redirectTo: 'patients' },
];
