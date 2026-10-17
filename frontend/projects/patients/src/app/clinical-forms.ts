import { Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';

/**
 * Small validation helpers shared by the clinical forms. They mirror the
 * backend value objects: an empty input means "not recorded" (`null`), and
 * anything typed must fall inside the documented range.
 */
export function optionalIntegerRange(min: number, max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value as string).trim();

    if (value === '') return null;

    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed >= min && parsed <= max ? null : { range: true };
  };
}

export function optionalDecimalRange(min: number, max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value as string).trim();

    if (value === '') return null;

    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? null : { range: true };
  };
}

export function toIntegerOrNull(value: string): number | null {
  const trimmed = value.trim();

  return trimmed === '' ? null : Number.parseInt(trimmed, 10);
}

export function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();

  return trimmed === '' ? null : Number(trimmed);
}

export function formatNumberOrEmpty(value: number | null): string {
  return value === null ? '' : String(value);
}

/** `Validators.maxLength` re-exported so both clinical forms stay in sync. */
export const maxLength = Validators.maxLength;
