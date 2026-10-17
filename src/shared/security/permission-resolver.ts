import { Injectable } from '@nestjs/common';
import { isPermissionKey } from './permissions.js';
import type { Principal, RoleRef } from './principal.js';
import { UserAccessReaderPort } from './user-access.reader.port.js';

/** Effective permissions plus the breakdown returned by `GET /auth/me`. */
export interface PermissionBreakdown {
  roles: RoleRef[];
  fromRoles: string[];
  direct: string[];
  effective: string[];
}/**
 * The **single** place where a user's effective permissions are computed:
 * `union(role permissions) ∪ direct permissions`, filtered against the
 * catalog (a role saved before the catalog shrank must not grant ghosts).
 * There is deliberately no cache: SQLite is in-process and files that deny
 * access by stale data are worse than a couple of cheap reads.
 */
@Injectable()
export class PermissionResolver {
  constructor(private readonly reader: UserAccessReaderPort) {}

  /** `null` when the user does not exist. */
  async describe(userId: string): Promise<PermissionBreakdown | null> {
    const access = await this.reader.load(userId);

    if (access === null) {
      return null;
    }

    const fromRoles = validUnique(access.rolePermissions);
    const direct = validUnique(access.directPermissions);

    return {
      roles: access.roles,
      fromRoles,
      direct,
      effective: [...new Set([...fromRoles, ...direct])],
    };
  }

  /**
   * Builds the request principal, or `null` when the user does not exist or
   * is disabled (a disabled account loses access immediately).
   */
  async resolveUser(userId: string): Promise<Principal | null> {
    const access = await this.reader.load(userId);

    if (access === null || access.status !== 'active') {
      return null;
    }

    return {
      type: 'user',
      userId,
      name: access.name,
      permissions: new Set([...access.rolePermissions, ...access.directPermissions].filter(isPermissionKey)),
      roles: access.roles,
    };
  }
}

function validUnique(keys: readonly string[]): string[] {
  return [...new Set(keys.filter(isPermissionKey))];
}
