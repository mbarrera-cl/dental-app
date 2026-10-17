import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { authInterceptor, SessionStore } from 'auth';
import { API_BASE_URL, CaroIaGateway } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { BrandingStore } from './branding/branding-store';
import { CaroIaHttpGateway } from './caro-ia/caro-ia.http-gateway';
import { NavigationStore } from './navigation/navigation-store';
import { routes } from './app.routes';

const runtimeApiUrl = (window as unknown as { __HEXA_CONFIG__?: { apiUrl?: string } })
  .__HEXA_CONFIG__?.apiUrl?.trim();
const defaultApiUrl =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Silent sign-in on reload: with a valid refresh cookie the session is
    // restored before the first route resolves, so there is no login flash.
    provideAppInitializer(() => inject(SessionStore).bootstrap()),
    // Branding paints synchronously from its localStorage cache when the
    // store is first injected; this only revalidates it with the stored ETag
    // (304 ⇒ no repaint). It is a public endpoint, so it needs no session.
    provideAppInitializer(() => inject(BrandingStore).refresh()),
    // Initializers run in order, so the session is already settled: the
    // sidebar loads its tree once (login/logout transitions reload it later).
    provideAppInitializer(() => inject(NavigationStore).init()),
    // Transloco is shared as a singleton through Native Federation, so the
    // language picked in the shell re-renders the remotes as well.
    provideAppTransloco(),
    provideSpartanHlm(),
    // CaroIA backend real: HTTP + SSE, con audio transitorio y sin adjuntos.
    { provide: CaroIaGateway, useClass: CaroIaHttpGateway },
    // Same-origin in production; config.js can override it at runtime.
    { provide: API_BASE_URL, useValue: runtimeApiUrl || defaultApiUrl },
  ],
};
