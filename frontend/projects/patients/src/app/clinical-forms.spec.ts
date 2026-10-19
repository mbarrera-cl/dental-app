import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  optionalDecimalRange,
  optionalIntegerRange,
  toIntegerOrNull,
  toNumberOrNull,
} from './clinical-forms';

describe('clinical-forms', () => {
  describe('toIntegerOrNull', () => {
    it('maps an empty value to null', () => {
      expect(toIntegerOrNull('')).toBeNull();
      expect(toIntegerOrNull(null)).toBeNull();
      expect(toIntegerOrNull(undefined)).toBeNull();
    });

    it('parses a string written by a text input', () => {
      expect(toIntegerOrNull('36')).toBe(36);
    });

    it('accepts the number written by an input[type=number]', () => {
      // Angular's number value accessor stores a number, not a string; the
      // helpers used to assume `string` and threw on `.trim()`.
      expect(toIntegerOrNull(36)).toBe(36);
    });
  });

  describe('toNumberOrNull', () => {
    it('parses decimals from a string or a number', () => {
      expect(toNumberOrNull('36.5')).toBe(36.5);
      expect(toNumberOrNull(36.5)).toBe(36.5);
      expect(toNumberOrNull('')).toBeNull();
      expect(toNumberOrNull(null)).toBeNull();
    });
  });

  describe('optionalIntegerRange', () => {
    const validate = optionalIntegerRange(0, 3);

    it('accepts an empty value', () => {
      expect(validate(new FormControl(''))).toBeNull();
      expect(validate(new FormControl(null))).toBeNull();
    });

    it('accepts an in-range number from a number input without throwing', () => {
      expect(validate(new FormControl(3))).toBeNull();
      expect(validate(new FormControl('3'))).toBeNull();
    });

    it('rejects out-of-range values from either origin', () => {
      expect(validate(new FormControl('9'))).toEqual({ range: true });
      expect(validate(new FormControl(9))).toEqual({ range: true });
    });
  });

  describe('optionalDecimalRange', () => {
    const validate = optionalDecimalRange(30, 45);

    it('accepts an in-range numeric value', () => {
      expect(validate(new FormControl(36.5))).toBeNull();
      expect(validate(new FormControl('36.5'))).toBeNull();
    });

    it('rejects an out-of-range numeric value', () => {
      expect(validate(new FormControl(50))).toEqual({ range: true });
    });
  });
});
