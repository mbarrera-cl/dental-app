import { Injectable } from '@nestjs/common';
import { PostgresDatabase } from '../../../../../shared/infrastructure/database/postgres-database.js';
import {
  UserAccessReaderPort,
  type UserAccess,
} from '../../../../../shared/security/user-access.reader.port.js';
import type { RoleRef } from '../../../../../shared/security/principal.js';

interface RoleRow {
  id: string;
  name: string;
  permissions: string[];
}

@Injectable()
export class PostgresUserAccessReader extends UserAccessReaderPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async load(userId: string): Promise<UserAccess | null> {
    const user = await this.db.queryOne<{ status: string; name: string }>(
      'SELECT status, name FROM users WHERE id = $1',
      [userId],
    );

    if (user === null) {
      return null;
    }

    const roleRows = await this.db.query<RoleRow>(
      `SELECT r.id, r.name, r.permissions
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
       ORDER BY r.name ASC`,
      [userId],
    );

    const directRows = await this.db.query<{ permission_key: string }>(
      'SELECT permission_key FROM user_permissions WHERE user_id = $1 ORDER BY permission_key ASC',
      [userId],
    );

    const roles: RoleRef[] = roleRows.map((row) => ({ id: row.id, name: row.name }));
    const rolePermissions = roleRows.flatMap((row) =>
      Array.isArray(row.permissions)
        ? row.permissions.filter((key): key is string => typeof key === 'string')
        : [],
    );

    return {
      status: user.status === 'disabled' ? 'disabled' : 'active',
      name: user.name,
      roles,
      rolePermissions,
      directPermissions: directRows.map((row) => row.permission_key),
    };
  }
}
