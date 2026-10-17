import {
  SETTING_DEFINITIONS,
  SETTING_GROUPS,
  coerceSettingValue,
  findSettingDefinition,
  mergeSettingValues,
} from './settings-registry.js';

/** Reason why `value` does not fit `key`, or `null` when it does. */
const invalidReason = (key: string, value: unknown): string | null => {
  const result = coerceSettingValue(findSettingDefinition(key)!, value);
  return result.ok ? null : result.reason;
};

/** Normalized value `key` stores for `value`; throws when `value` is invalid. */
const normalizedValue = (key: string, value: unknown): unknown => {
  const result = coerceSettingValue(findSettingDefinition(key)!, value);

  if (!result.ok) {
    throw new Error(`unexpected invalid value for ${key}: ${result.reason}`);
  }

  return result.value;
};

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
      expect(invalidReason(definition.key, definition.default)).toBeNull();
    }
  });

  it('validates numbers, including bounds and integrality', () => {
    expect(invalidReason('passwordPolicy.minLength', 8)).toBeNull();
    expect(invalidReason('passwordPolicy.minLength', 5)).toBe('must be >= 6');
    expect(invalidReason('passwordPolicy.minLength', 65)).toBe('must be <= 64');
    expect(invalidReason('passwordPolicy.minLength', 8.5)).toBe('must be an integer');
    expect(invalidReason('passwordPolicy.minLength', Number.NaN)).toBe('must be an integer');
    expect(invalidReason('passwordPolicy.minLength', '8')).toBe('must be an integer');
  });

  it('validates booleans and strings', () => {
    expect(invalidReason('passwordPolicy.requireUppercase', true)).toBeNull();
    expect(invalidReason('passwordPolicy.requireUppercase', 1)).toBe('must be a boolean');
    expect(invalidReason('clinic.name', 'Clínica Los Andes')).toBeNull();
    expect(invalidReason('clinic.name', 42)).toBe('must be a string');
  });

  it('enforces `maxLength` on strings', () => {
    expect(invalidReason('clinic.name', 'a'.repeat(60))).toBeNull();
    expect(invalidReason('clinic.name', 'a'.repeat(61))).toBe(
      'must have at most 60 characters',
    );
  });

  it('normalizes colors to lower-case #rrggbb and rejects everything else', () => {
    expect(normalizedValue('clinic.theme.primary', ' #0284C7 ')).toBe('#0284c7');
    expect(invalidReason('clinic.theme.primary', 'red')).toBe('must be a #rrggbb hex color');
    expect(invalidReason('clinic.theme.primary', '#12345')).toBe('must be a #rrggbb hex color');
    expect(invalidReason('clinic.theme.primary', '#12345g')).toBe('must be a #rrggbb hex color');
    expect(invalidReason('clinic.theme.primary', 0xffffff)).toBe('must be a string');
  });

  it('trims and lower-cases emails, accepting the empty string', () => {
    expect(normalizedValue('clinic.contact.email', ' Contacto@Clinica.CL ')).toBe(
      'contacto@clinica.cl',
    );
    expect(normalizedValue('clinic.contact.email', '')).toBe('');
    expect(invalidReason('clinic.contact.email', 'nope')).toBe('must be an email address');
    expect(invalidReason('clinic.contact.email', 'a@b')).toBe('must be an email address');
  });

  it('accepts only http(s) URLs, and the empty string', () => {
    expect(normalizedValue('clinic.contact.website', ' https://clinica.cl ')).toBe(
      'https://clinica.cl',
    );
    expect(normalizedValue('clinic.contact.website', '')).toBe('');
    expect(invalidReason('clinic.contact.website', 'clinica.cl')).toBe('must be an http(s) URL');
    expect(invalidReason('clinic.contact.website', 'ftp://clinica.cl')).toBe(
      'must be an http(s) URL',
    );
  });

  it('canonicalizes RUTs with the módulo 11 check, accepting the empty string', () => {
    expect(normalizedValue('clinic.rut', '12.345.678-5')).toBe('12345678-5');
    expect(normalizedValue('clinic.rut', '1.000.005-k')).toBe('1000005-K');
    expect(normalizedValue('clinic.rut', '')).toBe('');
    expect(invalidReason('clinic.rut', '12345678-9')).toBe('must be a valid Chilean RUT');
    expect(invalidReason('clinic.rut', 'abc')).toBe('must be a valid Chilean RUT');
  });

  it('canonicalizes phones to +56 form, accepting the empty string', () => {
    expect(normalizedValue('clinic.contact.phone', '+56 9 1234 5678')).toBe('+56912345678');
    expect(normalizedValue('clinic.contact.phone', '')).toBe('');
    expect(invalidReason('clinic.contact.phone', '123')).toBe(
      'must be a valid Chilean phone number',
    );
    expect(invalidReason('clinic.contact.phone', '+54 9 1234 5678')).toBe(
      'must be a valid Chilean phone number',
    );
  });

  it('restricts enums to their declared values', () => {
    expect(invalidReason('clinic.theme.mode', 'light')).toBeNull();
    expect(invalidReason('clinic.theme.mode', 'auto')).toBeNull();
    expect(invalidReason('clinic.theme.mode', 'dark')).toBe('must be one of: light, auto');
    expect(invalidReason('clinic.theme.mode', true)).toBe('must be one of: light, auto');
  });

  it('declares the clinic identity, contact and theme keys', () => {
    expect(normalizedValue('clinic.name', 'Mi clínica')).toBe('Mi clínica');
    expect(findSettingDefinition('clinic.name')?.default).toBe('Mi clínica');
    expect(findSettingDefinition('clinic.contact.email')?.default).toBe('');
    expect(findSettingDefinition('clinic.theme.primary')?.default).toBe('#0284c7');
    expect(findSettingDefinition('clinic.theme.accent')?.default).toBe('#f59e0b');
    expect(findSettingDefinition('clinic.theme.mode')?.default).toBe('auto');
    expect(findSettingDefinition('clinic.address.comuna')?.type).toBe('string');
  });

  it('marks only module-managed keys as `managed`', () => {
    expect(findSettingDefinition('clinic.logo.version')?.managed).toBe(true);

    for (const definition of SETTING_DEFINITIONS) {
      if (definition.key !== 'clinic.logo.version') {
        expect(definition.managed).toBeUndefined();
      }
    }
  });

  it('looks definitions up by key and returns undefined otherwise', () => {
    expect(findSettingDefinition('session.accessTokenTtlMinutes')?.type).toBe('number');
    expect(findSettingDefinition('nope.nope')).toBeUndefined();
  });

  it('merges stored values over the defaults', () => {
    const merged = mergeSettingValues({ 'passwordPolicy.minLength': 12, 'nope.ignored': 1 });

    expect(merged['passwordPolicy.minLength']).toBe(12);
    expect(merged['passwordPolicy.maxLength']).toBe(128);
    expect(merged['clinic.name']).toBe('Mi clínica');
    expect(merged['nope.ignored']).toBeUndefined();
    expect(Object.keys(merged)).toHaveLength(SETTING_DEFINITIONS.length);
  });
});
