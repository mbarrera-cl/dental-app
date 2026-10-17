import { parseSettingsImport } from './settings-export.js';

describe('parseSettingsImport', () => {
  it('accepts a full envelope and returns the raw values', () => {
    const values = { 'clinic.name': 'Clínica Los Andes', 'clinic.theme.mode': 'auto' };

    expect(
      parseSettingsImport({ app: 'hexa', version: 1, exportedAt: '2026-10-16T00:00:00.000Z', values }),
    ).toEqual(values);
  });

  it('accepts a bare { values } object', () => {
    expect(parseSettingsImport({ values: { 'clinic.name': 'X' } })).toEqual({ 'clinic.name': 'X' });
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'values'],
    ['a missing values map', { app: 'hexa' }],
    ['a non-object values map', { values: [] }],
    ['another app', { app: 'otra', values: {} }],
    ['a newer version', { app: 'hexa', version: 99, values: {} }],
  ])('rejects %s', (_label, input) => {
    let thrown: unknown;

    try {
      parseSettingsImport(input);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ name: 'SettingsValueInvalidError' });
  });
});
