import { createHash, randomBytes } from 'node:crypto';

/** Injectable randomness so tests can be deterministic. */
export type RandomBytes = (size: number) => Buffer;

/** The three shapes of a freshly generated secret. */
export interface ApiKeySecret {
  /** Full secret: the only time it is readable, never persisted. */
  plain: string;
  /** Non-secret start of the key, shown in lists to identify it. */
  prefix: string;
  /** SHA-256 of `plain` — the only thing stored. */
  hash: string;
}

const KEY_NAMESPACE = 'hexa';
const FINGERPRINT_BYTES = 4;
const SECRET_BYTES = 18;

/**
 * SHA-256 is enough here (unlike passwords): the secret is a high-entropy
 * random string, not something a human picks, so slow hashing only adds
 * latency to every authenticated request.
 */
export function hashApiKey(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

/**
 * Mints a new secret shaped like `hexa_ab12cd34_<base64url>`. The middle
 * block is a random fingerprint that survives in the database as `prefix`,
 * letting users and admins tell keys apart without storing the secret.
 */
export function generateApiKeySecret(random: RandomBytes = randomBytes): ApiKeySecret {
  const fingerprint = random(FINGERPRINT_BYTES).toString('hex');
  const prefix = `${KEY_NAMESPACE}_${fingerprint}`;
  const secret = random(SECRET_BYTES).toString('base64url');
  const plain = `${prefix}_${secret}`;

  return { plain, prefix, hash: hashApiKey(plain) };
}
