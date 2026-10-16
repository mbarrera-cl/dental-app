/**
 * Formats an ISO date using `Intl`, so it reacts to the active language
 * without registering Angular locale data (`LOCALE_ID`).
 */
export function formatDateTime(value: string | Date, language: string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
