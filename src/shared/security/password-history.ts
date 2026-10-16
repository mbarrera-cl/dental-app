import { PasswordHasher } from './password-hasher.js';
import { PasswordReusedError } from './password.errors.js';

/** Minimal shape of the history store, so the helper stays transport-free. */
export interface PasswordHistoryStore {
  /** Previous hashes, most recent first, up to `limit` entries. */
  listRecent(userId: string, limit: number): Promise<string[]>;
}

/** Whatever holds a current password hash (the `User` aggregate, mostly). */
export interface PasswordOwner {
  readonly id: string;
  readonly passwordHash: string | null;
}

/**
 * Rejects a candidate that matches the current password or any of the last
 * `historyCount` ones. Shared by the self-service change flow and the admin
 * reset flow so the "no reuse" rule lives in exactly one place.
 */
export async function assertPasswordNotReused(
  hasher: PasswordHasher,
  history: PasswordHistoryStore,
  owner: PasswordOwner,
  candidate: string,
  historyCount: number,
): Promise<void> {
  const recent = await history.listRecent(owner.id, historyCount);
  const storedHashes = [owner.passwordHash, ...recent].filter(
    (hash): hash is string => hash !== null,
  );

  for (const stored of storedHashes) {
    if (await hasher.verify(candidate, stored)) {
      throw new PasswordReusedError(historyCount);
    }
  }
}
