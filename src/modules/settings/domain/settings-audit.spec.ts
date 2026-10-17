import type { SettingValue } from './setting-definition.js';
import { diffSettingValues } from './settings-audit.js';

describe('diffSettingValues', () => {
  it('keeps only the keys whose value moved, in `after` order', () => {
    const before: Record<string, SettingValue> = {
      'clinic.name': 'Mi clínica',
      'clinic.slogan': 'Odontología',
      'clinic.theme.mode': 'light',
    };

    expect(
      diffSettingValues(before, {
        'clinic.slogan': 'Odontología',
        'clinic.name': 'Clínica Los Andes',
        'clinic.theme.mode': 'auto',
      }),
    ).toEqual([
      { key: 'clinic.name', from: 'Mi clínica', to: 'Clínica Los Andes' },
      { key: 'clinic.theme.mode', from: 'light', to: 'auto' },
    ]);
  });

  it('uses null as `from` for keys that had no previous value', () => {
    expect(diffSettingValues({}, { 'clinic.rut': '76.543.210-K' })).toEqual([
      { key: 'clinic.rut', from: null, to: '76.543.210-K' },
    ]);
  });

  it('returns an empty diff when nothing changed', () => {
    const before: Record<string, SettingValue> = { 'clinic.name': 'Mi clínica' };

    expect(diffSettingValues(before, { 'clinic.name': 'Mi clínica' })).toEqual([]);
  });
});
