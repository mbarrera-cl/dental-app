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

const RELATIVE_UNITS: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 365 * 24 * 60 * 60 },
  { unit: 'month', seconds: 30 * 24 * 60 * 60 },
  { unit: 'day', seconds: 24 * 60 * 60 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 },
];

/**
 * “hace 5 min” / “5 min ago”, falling back to the absolute date after a week
 * (relative wording stops being useful and the exact date matters for audit).
 */
export function formatRelativeTime(
  value: string | Date,
  language: string,
  now: Date = new Date(),
): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const elapsedSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absoluteSeconds = Math.abs(elapsedSeconds);

  if (absoluteSeconds >= 7 * 24 * 60 * 60) {
    return formatDateTime(date, language);
  }

  const unit = RELATIVE_UNITS.find((candidate) => absoluteSeconds >= candidate.seconds);
  const formatter = new Intl.RelativeTimeFormat(language === 'es' ? 'es' : 'en', {
    numeric: 'auto',
  });

  if (unit === undefined) {
    return formatter.format(0, 'second');
  }

  return formatter.format(Math.round(elapsedSeconds / unit.seconds), unit.unit);
}

