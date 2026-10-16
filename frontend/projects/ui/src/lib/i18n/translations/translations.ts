import type { Translation } from '@jsverse/transloco';
import { EN } from './en';
import { ES } from './es';
import type { Language } from '../languages';

/** Every dictionary, keyed by language. */
export const TRANSLATIONS: Record<Language, Translation> = {
  es: ES as unknown as Translation,
  en: EN as unknown as Translation,
};
