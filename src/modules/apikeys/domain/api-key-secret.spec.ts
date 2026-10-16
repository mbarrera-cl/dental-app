import { generateApiKeySecret, hashApiKey } from './api-key-secret.js';

describe('api key secret', () => {
  it('mints keys shaped hexa_<fingerprint>_<secret>, hashing the plain value', () => {
    const random = (size: number) => Buffer.alloc(size, 0xab);

    const secret = generateApiKeySecret(random);

    expect(secret.prefix).toMatch(/^hexa_[0-9a-f]{8}$/);
    expect(secret.prefix).toBe('hexa_abababab');
    expect(secret.plain.startsWith(`${secret.prefix}_`)).toBe(true);
    expect(secret.hash).toBe(hashApiKey(secret.plain));
    expect(secret.hash).toMatch(/^[0-9a-f]{64}$/);
    // The hash never contains the secret itself.
    expect(secret.hash).not.toContain(secret.plain);
  });

  it('never repeats a key with real randomness', () => {
    const first = generateApiKeySecret();
    const second = generateApiKeySecret();

    expect(first.plain).not.toBe(second.plain);
    expect(first.hash).not.toBe(second.hash);
  });

  it('hashes deterministically', () => {
    expect(hashApiKey('hexa_test_value')).toBe(hashApiKey('hexa_test_value'));
    expect(hashApiKey('hexa_test_value')).not.toBe(hashApiKey('hexa_test_other'));
  });
});
