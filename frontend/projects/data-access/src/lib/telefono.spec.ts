import { describe, expect, it } from 'vitest';
import { isValidTelefono, normalizeTelefono } from './telefono';

describe('normalizeTelefono', () => {
  it('canonicalizes the common spellings', () => {
    expect(normalizeTelefono('+56912345678')).toBe('+56912345678');
    expect(normalizeTelefono('+56 9 1234 5678')).toBe('+56912345678');
    expect(normalizeTelefono('9 1234 5678')).toBe('+56912345678');
    expect(normalizeTelefono('(2) 2345 6789')).toBe('+56223456789');
    expect(normalizeTelefono('56912345678')).toBe('+56912345678');
  });

  it('rejects invalid values', () => {
    expect(normalizeTelefono('')).toBeNull();
    expect(normalizeTelefono('123')).toBeNull();
    expect(normalizeTelefono('+1 555 123 4567')).toBeNull();
    expect(normalizeTelefono('abcdefgh')).toBeNull();
  });

  it('feeds isValidTelefono', () => {
    expect(isValidTelefono('+56 9 1234 5678')).toBe(true);
    expect(isValidTelefono('123')).toBe(false);
  });
});
