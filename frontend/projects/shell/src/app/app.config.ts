import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { authInterceptor, SessionStore } from 'auth';
import { CaroIaGateway } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { BrandingStore } from './branding/branding-store';
import { CaroIaMockGateway } from './caro-ia/caro-ia.mock';
import { NavigationStore } from './navigation/navigation-store';
import { routes } from './app.routes';

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
    // Rama UI: gateway simulado. La rama backend lo cambia por CaroIaHttpGateway.
    { provide: CaroIaGateway, useClass: CaroIaMockGateway },
  ],
};
