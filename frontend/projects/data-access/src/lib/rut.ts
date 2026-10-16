/**
 * RUT helpers mirroring the backend `Rut` value object: same normalizing
 * rules, same módulo 11 check digit. The canonical form is `12345678-5`
 * (no dots, uppercase `K`); `formatRut` adds the dots for display.
 */

/** Visual separators tolerated on input: "12.345.678-5" → "123456785". */
const SEPARATOR_PATTERN = /[.\-\s]/g;

const MAX_BODY_LENGTH = 9;

/**
 * Returns the canonical RUT (`12345678-5`) or `null` when the input is not a
 * valid Chilean RUT. Accepts dots, spaces, a missing hyphen and a lowercase
 * `k`.
 */
export function normalizeRut(raw: string): string | null {
  const compact = raw.replace(SEPARATOR_PATTERN, '').toUpperCase();
  const body = compact.slice(0, -1).replace(/^0+/, '');
  const checkDigit = compact.slice(-1);

  if (
    compact.length < 2 ||
    body.length > MAX_BODY_LENGTH ||
    !/^\d+$/.test(body) ||
    !/^[0-9K]$/.test(checkDigit)
  ) {
    return null;
  }

  if (computeCheckDigit(body) !== checkDigit) {
    return null;
  }

  return `${body}-${checkDigit}`;
}

export function isValidRut(raw: string): boolean {
  return normalizeRut(raw) !== null;
}

/** `12345678-5` → `12.345.678-5` (display form). */
export function formatRut(rut: string): string {
  const match = /^(\d{1,8})-([0-9K])$/.exec(rut);

  if (match === null) {
    return rut;
  }

  const body = match[1] ?? '';
  const checkDigit = match[2] ?? '';

  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${checkDigit}`;
}

/** Módulo 11: weights 2..7 cycling from the rightmost digit. */
export function computeCheckDigit(body: string): string {
  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);

  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}
