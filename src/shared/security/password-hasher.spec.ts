import { PasswordHasher, SCRYPT_PARAMS } from './password-hasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('produces a self-describing scrypt hash', async () => {
    const hash = await hasher.hash('S3cret!pass');

    const { cost, blockSize, parallelization } = SCRYPT_PARAMS;
    expect(hash).toMatch(
      new RegExp(`^scrypt\\$${cost}\\$${blockSize}\\$${parallelization}\\$[A-Za-z0-9+/=]+\\$[A-Za-z0-9+/=]+$`),
    );
  });

  it('verifies the correct password', async () => {
    const hash = await hasher.hash('S3cret!pass');

    await expect(hasher.verify('S3cret!pass', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hasher.hash('S3cret!pass');

    await expect(hasher.verify('s3cret!pass', hash)).resolves.toBe(false);
  });

  it('uses a fresh random salt per hash', async () => {
    const first = await hasher.hash('same-password');
    const second = await hasher.hash('same-password');

    expect(first).not.toBe(second);
  });

  it('returns false for malformed stored values instead of throwing', async () => {
    await expect(hasher.verify('anything', 'not-a-hash')).resolves.toBe(false);
    await expect(hasher.verify('anything', 'scrypt$broken')).resolves.toBe(false);
  });
});
