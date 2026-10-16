import { randomInt } from 'node:crypto';
import type { PasswordPolicyShape } from './password-policy.js';

/**
 * Random password generator used by the admin "reset password" flow. It is a
 * pure function with injectable randomness, so tests are deterministic.
 *
 * The result always satisfies the current policy: at least one character of
 * every required class, no longer than `maxLength` and never shorter than
 * `minLength`. Ambiguous characters (`I`, `l`, `0`, `1`, `O`) are excluded to
 * survive being transcribed from a screen.
 */
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*+-_=';

const DEFAULT_LENGTH = 16;

/** `nextInt(max)` must return a uniformly random integer in `[0, max)`. */
export function generatePassword(
  policy: PasswordPolicyShape,
  nextInt: (max: number) => number = randomInt,
): string {
  const pick = (characters: string): string => characters[nextInt(characters.length)];

  if (policy.maxLength < policy.minLength) {
    throw new Error('Cannot generate a password: the policy has no feasible length range');
  }

  const required: string[] = [];

  if (policy.requireUppercase) {
    required.push(pick(UPPERCASE));
  }

  if (policy.requireLowercase) {
    required.push(pick(LOWERCASE));
  }

  if (policy.requireDigit) {
    required.push(pick(DIGITS));
  }

  if (policy.requireSymbol) {
    required.push(pick(SYMBOLS));
  }

  if (required.length > policy.maxLength) {
    throw new Error('Cannot generate a password: the policy requires more characters than the maximum length');
  }

  // Never below the policy minimum, never above its maximum, and as long as
  // the default whenever the policy allows it.
  const length = Math.max(
    required.length,
    Math.max(policy.minLength, Math.min(DEFAULT_LENGTH, policy.maxLength)),
  );

  const everything = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;
  const characters = [...required];

  while (characters.length < length) {
    characters.push(pick(everything));
  }

  // Fisher–Yates, otherwise the required characters would always be first.
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapWith = nextInt(index + 1);
    [characters[index], characters[swapWith]] = [characters[swapWith], characters[index]];
  }

  return characters.slice(0, length).join('');
}
