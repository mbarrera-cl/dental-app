import { InvalidCategoriaEtariaError } from './clinical.errors.js';

/**
 * Age/condition ranges of the HCU dental form (SNS-MSP / HCU-form.033).
 * `5-14-no-programado` is a manual condition: "programado / no programado"
 * describes the appointment, not the patient's age.
 */
export const CATEGORIAS_ETARIAS = [
  'menor-1',
  '1-4',
  '5-9-programado',
  '5-14-no-programado',
  '10-14-programado',
  '15-19',
  'mayor-20',
] as const;

export type CategoriaEtaria = (typeof CATEGORIAS_ETARIAS)[number];

export function createCategoriaEtaria(value: string): CategoriaEtaria {
  const normalized = value.trim().toLowerCase();

  if (!(CATEGORIAS_ETARIAS as readonly string[]).includes(normalized)) {
    throw new InvalidCategoriaEtariaError(value);
  }

  return normalized as CategoriaEtaria;
}

/** Whole years between a timezone-free `YYYY-MM-DD` date and `today`. */
export function ageInYears(fechaNacimiento: string, today: Date = new Date()): number {
  const [year, month, day] = fechaNacimiento.split('-').map(Number);
  let age = today.getFullYear() - year;

  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1;
  }

  return age;
}

/** Age range suggested for a patient; the operator can always override it. */
export function suggestCategoriaEtaria(
  fechaNacimiento: string,
  today: Date = new Date(),
): CategoriaEtaria {
  const age = ageInYears(fechaNacimiento, today);

  if (age < 1) return 'menor-1';
  if (age <= 4) return '1-4';
  if (age <= 9) return '5-9-programado';
  if (age <= 14) return '10-14-programado';
  if (age <= 19) return '15-19';

  return 'mayor-20';
}
