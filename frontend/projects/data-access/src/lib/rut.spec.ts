import { describe, expect, it } from 'vitest';
import { computeCheckDigit, formatRut, isValidRut, normalizeRut } from './rut';

describe('normalizeRut', () => {
  it('canonicalizes the common spellings', () => {
    expect(normalizeRut('12345678-5')).toBe('12345678-5');
    expect(normalizeRut('12.345.678-5')).toBe('12345678-5');
    expect(normalizeRut(' 12 345 678 5 ')).toBe('12345678-5');
    expect(normalizeRut('123456785')).toBe('12345678-5');
  });

  it('uppercases the K check digit and strips leading zeros', () => {
    expect(normalizeRut('1.000.005-k')).toBe('1000005-K');
    expect(normalizeRut('012345678-5')).toBe('12345678-5');
  });

  it('rejects wrong check digits and malformed inputs', () => {
    expect(normalizeRut('12345678-9')).toBeNull();
    expect(normalizeRut('')).toBeNull();
    expect(normalizeRut('abc')).toBeNull();
    expect(normalizeRut('12345678-')).toBeNull();
    expect(normalizeRut('K')).toBeNull();
    expect(normalizeRut('1234567890123-5')).toBeNull();
  });

  it('feeds isValidRut', () => {
    expect(isValidRut('12.345.678-5')).toBe(true);
    expect(isValidRut('12345678-9')).toBe(false);
  });
});

describe('formatRut', () => {
  it('adds the thousand separators for display', () => {
    expect(formatRut('12345678-5')).toBe('12.345.678-5');
    expect(formatRut('1000005-K')).toBe('1.000.005-K');
    expect(formatRut('1234567-4')).toBe('1.234.567-4');
  });

  it('returns unexpected values untouched', () => {
    expect(formatRut('not-a-rut')).toBe('not-a-rut');
  });
});

describe('computeCheckDigit', () => {
  it('matches the módulo 11 algorithm of the backend', () => {
    expect(computeCheckDigit('12345678')).toBe('5');
    expect(computeCheckDigit('1000005')).toBe('K');
    expect(computeCheckDigit('22222222')).toBe('2');
  });
});
