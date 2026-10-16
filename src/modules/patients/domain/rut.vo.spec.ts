import { InvalidRutError } from './patient.errors.js';
import { Rut } from './rut.vo.js';

describe('Rut', () => {
  it('canonicalizes the common spellings', () => {
    expect(Rut.create('12345678-5').value).toBe('12345678-5');
    expect(Rut.create('12.345.678-5').value).toBe('12345678-5');
    expect(Rut.create(' 12 345 678 5 ').value).toBe('12345678-5');
    expect(Rut.create('123456785').value).toBe('12345678-5');
  });

  it('uppercases the K check digit and strips leading zeros', () => {
    expect(Rut.create('1.000.005-k').value).toBe('1000005-K');
    expect(Rut.create('012345678-5').value).toBe('12345678-5');
  });

  it('computes the módulo 11 check digit', () => {
    expect(Rut.computeCheckDigit('12345678')).toBe('5');
    expect(Rut.computeCheckDigit('1000005')).toBe('K');
    expect(Rut.computeCheckDigit('22222222')).toBe('2');
  });

  it('rejects RUTs with a wrong check digit', () => {
    expect(() => Rut.create('12345678-9')).toThrow(InvalidRutError);
    expect(() => Rut.create('1000005-1')).toThrow(InvalidRutError);
    expect(() => Rut.create('22222222-K')).toThrow(InvalidRutError);
  });

  it('rejects malformed inputs', () => {
    expect(() => Rut.create('')).toThrow(InvalidRutError);
    expect(() => Rut.create('abc')).toThrow(InvalidRutError);
    expect(() => Rut.create('12345678-')).toThrow(InvalidRutError);
    expect(() => Rut.create('-5')).toThrow(InvalidRutError);
    expect(() => Rut.create('K')).toThrow(InvalidRutError);
    expect(() => Rut.create('1234567890123-5')).toThrow(InvalidRutError);
  });

  it('compares by value', () => {
    expect(Rut.create('12.345.678-5').equals(Rut.create('12345678-5'))).toBe(
      true,
    );
  });
});
