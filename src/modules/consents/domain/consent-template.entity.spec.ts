import { InvalidConsentError } from './consent.errors.js';
import { ConsentTemplate, normalizeConsentKey } from './consent-template.entity.js';

const TEMPLATE = {
  key: 'extraccion',
  title: 'Consentimiento informado: extracción dental',
  body: 'Yo, {{paciente}}, autorizo {{procedimiento}}.',
};

describe('ConsentTemplate', () => {
  it('normalizes the key and starts at version 1', () => {
    const template = ConsentTemplate.create({
      ...TEMPLATE,
      key: '  Extraccion  ',
    });

    expect(template.key).toBe('extraccion');
    expect(template.version).toBe(1);
    expect(template.active).toBe(true);
    expect(template.createdAt).toEqual(template.updatedAt);
  });

  it('bumps the version when the wording changes', () => {
    const template = ConsentTemplate.create(TEMPLATE);

    template.update({ title: 'Consentimiento informado: extracción simple' });

    expect(template.version).toBe(2);
  });

  it('does not bump the version when only visibility changes', () => {
    const template = ConsentTemplate.create(TEMPLATE);

    template.update({ active: false });

    expect(template.version).toBe(1);
    expect(template.active).toBe(false);
  });

  it('rejects keys that are not slugs', () => {
    expect(() => ConsentTemplate.create({ ...TEMPLATE, key: 'Extracción' })).toThrow(
      InvalidConsentError,
    );
    expect(() => ConsentTemplate.create({ ...TEMPLATE, key: 'a b' })).toThrow(
      InvalidConsentError,
    );
  });

  it('rejects an empty body', () => {
    expect(() => ConsentTemplate.create({ ...TEMPLATE, body: '   ' })).toThrow(
      InvalidConsentError,
    );
  });

  it('exposes the key normalizer for the use cases', () => {
    expect(normalizeConsentKey('  Cirugia-Oral ')).toBe('cirugia-oral');
  });
});
