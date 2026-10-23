import { Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';

/**
 * Small validation helpers shared by the clinical forms. They mirror the
 * backend value objects: an empty input means "not recorded" (`null`), and
 * anything typed must fall inside the documented range.
 */

/**
 * Angular's number value accessor (`input[type=number]`) writes a `number`
 * (or `null` when empty) into the control, while text inputs write a string.
 * Normalize both so a control declared as `string` can still be processed
 * when its DOM input is numeric.
 */
function asTrimmedString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

export function optionalIntegerRange(min: number, max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = asTrimmedString(control.value);

    if (value === '') return null;

    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed >= min && parsed <= max ? null : { range: true };
  };
}

export function optionalDecimalRange(min: number, max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = asTrimmedString(control.value);

    if (value === '') return null;

    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? null : { range: true };
  };
}

export function toIntegerOrNull(value: unknown): number | null {
  const trimmed = asTrimmedString(value);

  return trimmed === '' ? null : Number.parseInt(trimmed, 10);
}

export function toNumberOrNull(value: unknown): number | null {
  const trimmed = asTrimmedString(value);

  return trimmed === '' ? null : Number(trimmed);
}

export function formatNumberOrEmpty(value: number | null): string {
  return value === null ? '' : String(value);
}

/** `Validators.maxLength` re-exported so both clinical forms stay in sync. */
export const maxLength = Validators.maxLength;
