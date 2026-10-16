import type { Principal } from './principal.js';

/**
 * Port bound by the api keys context (`ApiKeysModule`) so the global auth
 * guard can authenticate `X-Api-Key` requests without depending on that
 * module. When nothing is bound, api-key authentication is unavailable.
 */
export abstract class ApiKeyAuthenticatorPort {
  /**
   * Returns the principal for an active, non-expired key whose owner is
   * active — or `null`. Implementations refresh `last_used_at`.
   */
  abstract authenticate(rawKey: string): Promise<Principal | null>;
}
