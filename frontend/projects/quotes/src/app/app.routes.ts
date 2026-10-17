import type { Routes } from '@angular/router';

/**
 * Routes exposed by the `quotes` remote through Native Federation
 * (`./routes` in `federation.config.mjs`). The shell mounts them under
 * `/quotes`; the guards also run standalone (`ng serve quotes`).
 */
export const QUOTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./quotes-page/quotes-page').then((m) => m.QuotesPage),
  },
  {
    path: 'new',
    loadComponent: () => import('./quotes-page/quote-editor/quote-editor').then((m) => m.QuoteEditor),
  },
  {
    path: ':id',
    loadComponent: () => import('./quotes-page/quote-editor/quote-editor').then((m) => m.QuoteEditor),
  },
  {
    path: ':id/print',
    loadComponent: () => import('./quotes-page/quote-print/quote-print').then((m) => m.QuotePrint),
  },
];
