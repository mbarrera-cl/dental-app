import { InvalidNumeroHistoriaError } from './patient.errors.js';

/** Canonical shape: `HC-` + at least six digits (`HC-000123`). */
export const NUMERO_HISTORIA_PATTERN = /^HC-\d{6,}$/;

/**
 * Formats a sequence number as a patient's clinical record number
 * (`1` → `HC-000001`). Zero padding keeps the numbers sortable as text.
 */
export function formatNumeroHistoria(sequence: number): string {
  return `HC-${String(sequence).padStart(6, '0')}`;
}

/** Validates and normalizes an assigned/stored number; never accepts junk. */
export function normalizeNumeroHistoria(value: string): string {
  const normalized = value.trim().toUpperCase();

  if (!NUMERO_HISTORIA_PATTERN.test(normalized)) {
    throw new InvalidNumeroHistoriaError(value);
  }

  return normalized;
}
