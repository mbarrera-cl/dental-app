import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { QUOTES_ROUTES } from './app.routes';

/**
 * Configuration used when the remote runs standalone (`ng serve quotes`).
 * When federated, the shell provides the router/runtime and this file is not
 * loaded.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(QUOTES_ROUTES),
    provideHttpClient(),
    provideAppTransloco(),
    provideSpartanHlm(),
  ],
};
