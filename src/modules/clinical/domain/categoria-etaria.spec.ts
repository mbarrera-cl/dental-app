import {
  ageInYears,
  createCategoriaEtaria,
  suggestCategoriaEtaria,
} from './categoria-etaria.js';

describe('categoria etaria', () => {
  describe('ageInYears', () => {
    it('computes whole years taking the birthday into account', () => {
      expect(ageInYears('1990-05-17', new Date('2026-05-16T12:00:00'))).toBe(35);
      expect(ageInYears('1990-05-17', new Date('2026-05-17T12:00:00'))).toBe(36);
    });
  });

  describe('suggestCategoriaEtaria', () => {
    const suggestAt = (fechaNacimiento: string, today: string) =>
      suggestCategoriaEtaria(fechaNacimiento, new Date(`${today}T12:00:00`));

    it('maps the ranges of the HCU form', () => {
      expect(suggestAt('2026-01-01', '2026-10-16')).toBe('menor-1');
      expect(suggestAt('2022-10-16', '2026-10-16')).toBe('1-4');
      expect(suggestAt('2019-10-16', '2026-10-16')).toBe('5-9-programado');
      expect(suggestAt('2013-10-16', '2026-10-16')).toBe('10-14-programado');
      expect(suggestAt('2009-10-16', '2026-10-16')).toBe('15-19');
      expect(suggestAt('2000-10-16', '2026-10-16')).toBe('mayor-20');
    });

    it('never suggests the not-programmed range: it describes the appointment', () => {
      expect(suggestAt('2019-10-16', '2026-10-16')).not.toBe('5-14-no-programado');
      expect(suggestAt('2013-10-16', '2026-10-16')).not.toBe('5-14-no-programado');
    });
  });

  describe('createCategoriaEtaria', () => {
    it('normalizes and validates the category', () => {
      expect(createCategoriaEtaria(' 5-9-Programado ')).toBe('5-9-programado');
      expect(createCategoriaEtaria('5-14-no-programado')).toBe(
        '5-14-no-programado',
      );
      expect(() => createCategoriaEtaria('adulto')).toThrow(
        expect.objectContaining({ name: 'InvalidCategoriaEtariaError' }),
      );
    });
  });
});
