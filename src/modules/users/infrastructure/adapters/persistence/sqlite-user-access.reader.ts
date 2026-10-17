import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import {
  UserAccessReaderPort,
  type UserAccess,
} from '../../../../../shared/security/user-access.reader.port.js';
import type { RoleRef } from '../../../../../shared/security/principal.js';

interface RoleRow {
  id: string;
  name: string;
  permissions: string;
}

/**
 * Reads everything the permission resolver needs, in a single adapter: user
 * status, the roles (with their permission lists) and the user's direct
 * permissions. Kept separate from `SqliteUserRepository` so the user
 * aggregate stays free of RBAC reads.
 */
@Injectable()
export class SqliteUserAccessReader extends UserAccessReaderPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async load(userId: string): Promise<UserAccess | null> {
    const user = this.db.connection
      .prepare('SELECT status, name FROM users WHERE id = ?')
      .get(userId) as unknown as { status: string; name: string } | undefined;

    if (user === undefined) {
      return null;
    }

    const roleRows = this.db.connection
      .prepare(
        `SELECT r.id, r.name, r.permissions
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = ?
         ORDER BY r.name ASC`,
      )
      .all(userId) as unknown as RoleRow[];

    const directRows = this.db.connection
      .prepare('SELECT permission_key FROM user_permissions WHERE user_id = ? ORDER BY permission_key ASC')
      .all(userId) as unknown as Array<{ permission_key: string }>;

    const roles: RoleRef[] = roleRows.map((row) => ({ id: row.id, name: row.name }));

    return {
      status: user.status === 'disabled' ? 'disabled' : 'active',
      name: user.name,
      roles,
      rolePermissions: roleRows.flatMap((row) => parsePermissions(row.permissions)),
      directPermissions: directRows.map((row) => row.permission_key),
    };
  }
}

function parsePermissions(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);

    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}
