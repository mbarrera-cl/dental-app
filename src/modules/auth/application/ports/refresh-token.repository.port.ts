export interface RefreshTokenRecord {
  id: string;
  userId: string;
  /** SHA-256 of the opaque token; the raw token is never stored. */
  tokenHash: string;
  expiresAt: Date;
  /** Set when the token was rotated; the row is kept for reuse detection. */
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Driven port for refresh sessions. Tokens are opaque random strings; only
 * their SHA-256 hash is persisted. Rotated rows are kept (soft-revoked) so a
 * replayed token can be detected; logging out hard-deletes the row.
 */
export abstract class RefreshTokenRepositoryPort {
  abstract save(record: RefreshTokenRecord): Promise<void>;

  abstract findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;

  /** Soft-revokes a token (logout rows use `delete` instead — see below). */
  abstract revoke(id: string, revokedAt: Date): Promise<void>;

  /**
   * Kills every active session of a user by **deleting** the active rows:
   * used on logout-everywhere, password changes and theft response. Deletion
   * (instead of revocation) guarantees a replayed token can never fall into
   * the rotation grace window.
   */
  abstract revokeAllForUser(userId: string): Promise<void>;

  /** Hard-deletes a token (logout): a deleted token can never be replayed. */
  abstract delete(id: string): Promise<void>;
}
