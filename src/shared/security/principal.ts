/** Minimal role reference carried by a principal (enough for the UI). */
export interface RoleRef {
  id: string;
  name: string;
}

/**
 * Authenticated caller attached to every request. `user` principals come
 * from a JWT access token (or a refresh flow); `apikey` principals come from
 * the `X-Api-Key` header. Both carry the **effective** permissions resolved
 * per request from the database, so panel changes apply immediately.
 */
export interface Principal {
  type: 'user' | 'apikey';
  userId: string;
  /** Only present for `apikey` principals. */
  apiKeyId?: string;
  permissions: ReadonlySet<string>;
  roles: readonly RoleRef[];
}
