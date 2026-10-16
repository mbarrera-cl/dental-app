import type { RoleRef } from './principal.js';

/** Raw access data of a user, read straight from persistence. */
export interface UserAccess {
  status: 'active' | 'disabled';
  roles: RoleRef[];
  /** Union of the permissions granted by every assigned role. */
  rolePermissions: readonly string[];
  /** Permissions granted to the user directly (outside of roles). */
  directPermissions: readonly string[];
}

/**
 * Driven port: the persistence query needed to resolve what a user can do.
 * The adapter lives in the users context (it owns `user_roles` and
 * `user_permissions`); `PermissionResolver` consumes it.
 */
export abstract class UserAccessReaderPort {
  /** `null` when the user does not exist. */
  abstract load(userId: string): Promise<UserAccess | null>;
}
