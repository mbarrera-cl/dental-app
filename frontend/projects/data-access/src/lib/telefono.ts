/**
 * Chilean phone helpers mirroring the backend `Telefono` value object: the
 * canonical form is `+56912345678` and the common spellings are accepted.
 */

/** Visual separators tolerated on input. */
const SEPARATOR_PATTERN = /[\s.\-()]/g;

/** National numbers: 8 digits (some fixed lines) or 9 (mobile / area + number). */
const NATIONAL_PATTERN = /^\d{8,9}$/;

const MAX_INPUT_LENGTH = 30;

/** Returns the canonical `+56912345678` form, or `null` when invalid. */
export function normalizeTelefono(raw: string): string | null {
  const compact = raw.replace(SEPARATOR_PATTERN, '');

  if (compact.length === 0 || compact.length > MAX_INPUT_LENGTH) {
    return null;
  }

  let national: string;

  if (compact.startsWith('+')) {
    if (!compact.startsWith('+56')) {
      return null;
    }

    national = compact.slice(3);
  } else if (compact.length === 11 && compact.startsWith('56')) {
    // Country code typed without the plus ("56912345678").
    national = compact.slice(2);
  } else {
    national = compact;
  }

  if (!NATIONAL_PATTERN.test(national)) {
    return null;
  }

  return `+56${national}`;
}

export function isValidTelefono(raw: string): boolean {
  return normalizeTelefono(raw) !== null;
}
