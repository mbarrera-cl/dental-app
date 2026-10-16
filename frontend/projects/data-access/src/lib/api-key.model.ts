/**
 * API keys: credentials owned by a user that act *as* that user. A key can
 * scope down (subset of permissions) but never up: on every request the
 * backend intersects the key with its owner's current effective permissions.
 */

export interface ApiKey {
  id: string;
  /** Owner of the key. */
  userId: string;
  name: string;
  /** First characters of the plain key, for identification in lists. */
  prefix: string;
  /** `null` inherits every effective permission of the owner. */
  scopes: string[] | null;
  /** `null` = the key never expires (setting `apiKeys.defaultExpirationDays` = 0). */
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Creation/rotation response: the only time the plain secret is visible. */
export interface CreatedApiKey extends ApiKey {
  key: string;
}

export interface CreateApiKeyPayload {
  name: string;
  /** Omitted/`null` inherits all current permissions of the owner. */
  scopes?: string[] | null;
  expiresInDays?: number;
  /** Only usable by admins (`apikeys:manage`): create on behalf of a user. */
  userId?: string;
}
