import { describe, expect, it } from 'vitest';
import { EN } from './en';
import { ES } from './es';

/** Recursively collects every (nested) key of a dictionary. */
function collectKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    collectKeys(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

describe('translations', () => {
  it('es and en expose exactly the same keys', () => {
    const esKeys = collectKeys(ES).sort();
    const enKeys = collectKeys(EN).sort();

    expect(enKeys).toEqual(esKeys);
  });

  it('has no empty strings', () => {
    const emptyInEs = collectKeys(ES).filter((key) => valueAt(ES, key) === '');
    const emptyInEn = collectKeys(EN).filter((key) => valueAt(EN, key) === '');

    expect(emptyInEs).toEqual([]);
    expect(emptyInEn).toEqual([]);
  });
});

function valueAt(dictionary: object, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => {
    if (typeof current === 'object' && current !== null) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionary);
}
