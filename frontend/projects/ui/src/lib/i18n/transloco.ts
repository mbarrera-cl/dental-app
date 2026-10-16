import { isDevMode, makeEnvironmentProviders, provideAppInitializer, inject } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import type { TranslocoLoader, Translation } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { LANGUAGES, readStoredLanguage, rememberLanguage } from './languages';
import { TRANSLATIONS } from './translations/translations';

import { Injectable } from '@angular/core';
import { DEFAULT_LANGUAGE, isLanguage } from './languages';

/**
 * Serves translations from the statically imported dictionaries.
 *
 * Because everything is bundled (no HTTP fetch), the loader works identically
 * in every microfrontend and does not depend on cross-origin requests between
 * the shell (:4200) and the remotes (:4201/:4202).
 */
@Injectable({ providedIn: 'root' })
export class StaticTranslocoLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    return of(TRANSLATIONS[isLanguage(lang) ? lang : DEFAULT_LANGUAGE]);
  }
}

/**
 * Wires Transloco for any app of the workspace (shell or remotes):
 *
 * - static loader with the shared dictionaries (`es` default, `en` fallback),
 * - re-render on language change,
 * - restores the persisted language on bootstrap.
 *
 * The service is shared as a singleton through Native Federation, so the
 * language switcher of the shell re-renders the remotes too.
 */
export function provideAppTransloco(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: [...LANGUAGES],
        defaultLang: DEFAULT_LANGUAGE,
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: StaticTranslocoLoader,
    }),
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      const language = readStoredLanguage();
      transloco.setActiveLang(language);
      rememberLanguage(language);
    }),
  ]);
}
