import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * scrypt parameters. Memory-hard (128 * N * r ≈ 16 MB) yet fast enough for an
 * interactive login (~50 ms), and available in `node:crypto` — no third-party
 * password-hashing dependency.
 */
export const SCRYPT_PARAMS = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
  keyLength: 64,
  saltLength: 16,
} as const;

const STORED_FORMAT = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/;

/**
 * Hashes and verifies passwords with scrypt. The stored value is
 * self-describing (`scrypt$N$r$p$salt$hash`, base64), so parameters can be
 * raised later without invalidating existing hashes.
 */
@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const { cost, blockSize, parallelization, keyLength, saltLength } = SCRYPT_PARAMS;
    const salt = randomBytes(saltLength);
    const derived = await scryptAsync(password, salt, keyLength, {
      N: cost,
      r: blockSize,
      p: parallelization,
    });

    return [
      'scrypt',
      cost,
      blockSize,
      parallelization,
      salt.toString('base64'),
      derived.toString('base64'),
    ].join('$');
  }

  /**
   * Runs the same scrypt work as `verify()` without a real stored hash.
   *
   * Credential flows call this when the account does not exist so that
   * unknown-email attempts take as long as wrong-password attempts, closing
   * the timing side channel used to enumerate users.
   */
  async verifyDummy(password: string): Promise<void> {
    const { cost, blockSize, parallelization, keyLength, saltLength } = SCRYPT_PARAMS;

    await scryptAsync(password, Buffer.alloc(saltLength, 0), keyLength, {
      N: cost,
      r: blockSize,
      p: parallelization,
    });
  }

  /** Constant-time verification; returns `false` for malformed stored values. */
  async verify(password: string, stored: string): Promise<boolean> {
    const match = STORED_FORMAT.exec(stored);

    if (match === null) {
      return false;
    }

    const [, cost, blockSize, parallelization, salt, hash] = match;
    const expected = Buffer.from(hash, 'base64');

    const derived = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelization),
    });

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }
}
