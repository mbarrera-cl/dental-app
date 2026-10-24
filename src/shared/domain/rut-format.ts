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
