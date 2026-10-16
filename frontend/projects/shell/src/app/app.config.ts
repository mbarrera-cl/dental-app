import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { authInterceptor, SessionStore } from 'auth';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Silent sign-in on reload: with a valid refresh cookie the session is
    // restored before the first route resolves, so there is no login flash.
    provideAppInitializer(() => inject(SessionStore).bootstrap()),
    // Transloco is shared as a singleton through Native Federation, so the
    // language picked in the shell re-renders the remotes as well.
    provideAppTransloco(),
    provideSpartanHlm(),
  ],
};
