/**
 * Languages supported by the whole application (microfrontends included).
 * The list is shared through the `ui` library so the shell and every remote
 * stay in sync.
 */
export const LANGUAGES = ['es', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

/** Spanish is the default language of the app. */
export const DEFAULT_LANGUAGE: Language = 'es';

/** localStorage key used to persist the selected language. */
export const LANGUAGE_STORAGE_KEY = 'hexa.lang';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Reads the persisted language, falling back to {@link DEFAULT_LANGUAGE}. */
export function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    // localStorage may be unavailable (private mode, opaque origins...).
    return DEFAULT_LANGUAGE;
  }
}

/** Persists the language and keeps `<html lang>` in sync. */
export function rememberLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore persistence errors: the language still applies for this session.
  }

  document.documentElement.lang = language;
}
