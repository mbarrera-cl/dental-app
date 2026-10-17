import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidAntecedentesError } from './clinical.errors.js';

/** The ten personal/family history items of the HCU dental form. */
export const ANTECEDENTES = [
  'alergia-antibiotico',
  'alergia-anestesia',
  'hemorragias',
  'vih-sida',
  'tuberculosis',
  'asma',
  'diabetes',
  'hipertension',
  'enfermedad-cardiaca',
  'otro',
] as const;

export type AntecedenteKey = (typeof ANTECEDENTES)[number];

export interface AntecedenteEntry {
  present: boolean;
  notes: string | null;
}

export type AntecedentesRecord = Record<AntecedenteKey, AntecedenteEntry>;

export type AntecedentesInput = Partial<
  Record<AntecedenteKey, { present?: boolean; notes?: string | null }>
>;

const MAX_NOTES_LENGTH = 500;

/**
 * Personal and family history: one flag + optional observation per item.
 * `create` accepts a partial record (the common case when filling the form)
 * and rejects unknown keys, so a typo cannot silently lose a finding.
 */
export class Antecedentes extends ValueObject<{ entries: AntecedentesRecord }> {
  private constructor(entries: AntecedentesRecord) {
    super({ entries });
  }

  static create(input: AntecedentesInput | null | undefined): Antecedentes {
    const source = input ?? {};

    for (const key of Object.keys(source)) {
      if (!(ANTECEDENTES as readonly string[]).includes(key)) {
        throw new InvalidAntecedentesError(`unknown item "${key}"`);
      }
    }

    const entries = {} as AntecedentesRecord;

    for (const key of ANTECEDENTES) {
      const raw = source[key];
      entries[key] = {
        present: raw?.present === true,
        notes: normalizeNotes(raw?.notes, key),
      };
    }

    return new Antecedentes(entries);
  }

  get(key: AntecedenteKey): AntecedenteEntry {
    return this.props.entries[key];
  }

  get entries(): Readonly<AntecedentesRecord> {
    return this.props.entries;
  }

  toJSON(): AntecedentesRecord {
    return this.props.entries;
  }
}

function normalizeNotes(
  value: string | null | undefined,
  key: string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new InvalidAntecedentesError(`notes of "${key}" must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length > MAX_NOTES_LENGTH) {
    throw new InvalidAntecedentesError(
      `notes of "${key}" must have at most ${MAX_NOTES_LENGTH} characters`,
    );
  }

  return trimmed.length === 0 ? null : trimmed;
}
