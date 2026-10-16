import {
  SETTING_DEFINITIONS,
  SETTING_GROUPS,
  findSettingDefinition,
  mergeSettingValues,
  validateSettingValue,
} from './settings-registry.js';

describe('settings registry', () => {
  it('declares unique keys inside known groups, named `group.name`', () => {
    const keys = SETTING_DEFINITIONS.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);

    const groups = new Set(SETTING_GROUPS.map((group) => group.id));

    for (const definition of SETTING_DEFINITIONS) {
      expect(groups.has(definition.group)).toBe(true);
      expect(definition.key.startsWith(`${definition.group}.`)).toBe(true);
    }
  });

  it('validates its own defaults', () => {
    for (const definition of SETTING_DEFINITIONS) {
      expect(validateSettingValue(definition, definition.default)).toBeNull();
    }
  });

  it('validates numbers, including bounds and integrality', () => {
    const definition = findSettingDefinition('passwordPolicy.minLength')!;

    expect(validateSettingValue(definition, 8)).toBeNull();
    expect(validateSettingValue(definition, 5)).toBe('must be >= 6');
    expect(validateSettingValue(definition, 65)).toBe('must be <= 64');
    expect(validateSettingValue(definition, 8.5)).toBe('must be an integer');
    expect(validateSettingValue(definition, Number.NaN)).toBe('must be an integer');
    expect(validateSettingValue(definition, '8')).toBe('must be an integer');
  });

  it('validates booleans and strings', () => {
    const toggle = findSettingDefinition('login.maxFailedAttempts')!;
    expect(validateSettingValue(toggle, true)).toBe('must be an integer');
    expect(validateSettingValue(toggle, 3)).toBeNull();
  });

  it('looks definitions up by key and returns undefined otherwise', () => {
    expect(findSettingDefinition('session.accessTokenTtlMinutes')?.type).toBe('number');
    expect(findSettingDefinition('nope.nope')).toBeUndefined();
  });

  it('merges stored values over the defaults', () => {
    const merged = mergeSettingValues({ 'passwordPolicy.minLength': 12, 'nope.ignored': 1 });

    expect(merged['passwordPolicy.minLength']).toBe(12);
    expect(merged['passwordPolicy.maxLength']).toBe(128);
    expect(merged['nope.ignored']).toBeUndefined();
    expect(Object.keys(merged)).toHaveLength(SETTING_DEFINITIONS.length);
  });
});
