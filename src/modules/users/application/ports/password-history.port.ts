/**
 * Driven port for the password history: previous hashes that policy checks
 * compare candidates against, so "last N passwords" cannot be reused.
 *
 * It lives in the users context (credentials are part of the user aggregate)
 * and is consumed by the auth context.
 */
export abstract class PasswordHistoryPort {
  /** Previous hashes, most recent first, up to `limit` entries. */
  abstract listRecent(userId: string, limit: number): Promise<string[]>;

  /** Records a hash as being replaced. */
  abstract append(userId: string, passwordHash: string, changedAt: Date): Promise<void>;

  /** Keeps only the `keep` most recent entries for the user. */
  abstract trim(userId: string, keep: number): Promise<void>;
}
