import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { AGENDA_ROUTES } from './app.routes';

/**
 * Configuration used when the remote runs standalone (`ng serve dashboard`).
 * When federated, the shell provides the router/runtime and this file is not
 * loaded.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(AGENDA_ROUTES),
    provideHttpClient(),
    provideAppTransloco(),
    provideSpartanHlm(),
  ],
};
