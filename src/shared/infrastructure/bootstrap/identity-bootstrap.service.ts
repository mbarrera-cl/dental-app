import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { RoleRepositoryPort } from '../../../modules/roles/application/ports/role-repository.port.js';
import { ADMIN_ROLE_NAME, Role } from '../../../modules/roles/domain/role.entity.js';
import { UserRepositoryPort } from '../../../modules/users/application/ports/user-repository.port.js';
import { Email } from '../../../modules/users/domain/email.vo.js';
import { User } from '../../../modules/users/domain/user.entity.js';
import { apiKeysCategory } from '../../../modules/apikeys/permissions.js';
import { usersCategory } from '../../../modules/users/permissions.js';
import { allPermissionKeys, dashboardCategory } from '../../security/permissions.js';
import { PasswordHasher } from '../../security/password-hasher.js';
import { SqliteDatabase } from '../database/sqlite-database.js';

export const ADMIN_EMAIL_ENV = 'ADMIN_EMAIL';
export const ADMIN_PASSWORD_ENV = 'ADMIN_PASSWORD';

const DEFAULT_ADMIN_EMAIL = 'admin@hexa.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin123!';
const DEFAULT_ROLES_SEEDED_MARKER = 'default-roles-seeded';

/** Permissions of the seeded `viewer` role (read-only demo role). */
const VIEWER_PERMISSIONS = [
  dashboardCategory.keys.read,
  usersCategory.keys.read,
  apiKeysCategory.keys.self,
];

/** Permissions of the seeded `editor` role (manages users, not roles/settings). */
const EDITOR_PERMISSIONS = [
  ...VIEWER_PERMISSIONS,
  usersCategory.keys.create,
  usersCategory.keys.update,
];

/**
 * Brings a database (fresh, upgraded or manually damaged) to a usable state:
 *
 * 1. Keeps the built-in `admin` role in sync with the permission catalog, so
 *    a permission added by a new module is granted automatically on deploy.
 * 2. Seeds the demo roles (`editor`, `viewer`) once — a marker in
 *    `bootstrap_state` means deleting them later is respected.
 * 3. Guarantees an active administrator account (`ADMIN_EMAIL` /
 *    `ADMIN_PASSWORD`), which doubles as the lockout rescue.
 */
@Injectable()
export class IdentityBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IdentityBootstrapService.name);

  constructor(
    private readonly db: SqliteDatabase,
    private readonly users: UserRepositoryPort,
    private readonly roles: RoleRepositoryPort,
    private readonly hasher: PasswordHasher,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.syncAdminRole();
    await this.seedDefaultRolesOnce();
    await this.ensureAdminUser();
  }

  private async syncAdminRole(): Promise<void> {
    const catalogKeys: string[] = [...allPermissionKeys()];
    const existing = await this.roles.findByName(ADMIN_ROLE_NAME);

    if (existing === null) {
      await this.roles.save(
        Role.create({
          name: ADMIN_ROLE_NAME,
          description: 'Built-in administrator. Always kept in sync with the permission catalog.',
          permissions: catalogKeys,
          builtIn: true,
        }),
      );

      this.logger.log(`Created the built-in "${ADMIN_ROLE_NAME}" role (${catalogKeys.length} permissions)`);
      return;
    }

    const inSync =
      existing.permissions.length === catalogKeys.length &&
      existing.permissions.every((key) => catalogKeys.includes(key));

    if (!inSync) {
      existing.changePermissions(catalogKeys);
      await this.roles.update(existing);
      this.logger.log(
        `Synced the "${ADMIN_ROLE_NAME}" role with the permission catalog (${catalogKeys.length} permissions)`,
      );
    }
  }

  private async seedDefaultRolesOnce(): Promise<void> {
    if (this.hasState(DEFAULT_ROLES_SEEDED_MARKER)) {
      return;
    }

    const viewer = Role.create({
      name: 'viewer',
      description: 'Read-only access: dashboard and the user list.',
      permissions: VIEWER_PERMISSIONS,
    });
    const editor = Role.create({
      name: 'editor',
      description: 'Manages users (no deletions, no roles or settings administration).',
      permissions: EDITOR_PERMISSIONS,
    });

    await this.roles.save(viewer);
    await this.roles.save(editor);

    const usersWithoutRoles = await this.users.listUserIdsWithoutRoles();

    if (usersWithoutRoles.length > 0) {
      await this.users.assignRoleToUsers(viewer.id, usersWithoutRoles);
    }

    this.setState(DEFAULT_ROLES_SEEDED_MARKER);

    this.logger.log(
      `Seeded default roles "editor" and "viewer"` +
        (usersWithoutRoles.length > 0
          ? `; assigned "viewer" to ${usersWithoutRoles.length} user(s) without a role`
          : ''),
    );
  }

  private async ensureAdminUser(): Promise<void> {
    if (await this.users.existsActiveAdmin()) {
      return;
    }

    const adminRole = await this.roles.findByName(ADMIN_ROLE_NAME);

    if (adminRole === null) {
      this.logger.error('Cannot guarantee an administrator: the admin role is missing');
      return;
    }

    const email = (process.env[ADMIN_EMAIL_ENV] ?? DEFAULT_ADMIN_EMAIL).trim();
    const password = process.env[ADMIN_PASSWORD_ENV] ?? DEFAULT_ADMIN_PASSWORD;
    const normalizedEmail = Email.create(email).value;

    let user = await this.users.findByEmail(normalizedEmail);

    if (user === null) {
      user = User.create({ email: normalizedEmail, name: 'Administrator' });
      user.setPassword(await this.hasher.hash(password), { mustChange: false });
      await this.users.save(user);
      this.logger.warn(`Created the initial administrator account "${normalizedEmail}"`);
    } else {
      if (!user.hasPassword) {
        user.setPassword(await this.hasher.hash(password), { mustChange: false });
      }

      user.changeStatus('active');
      user.clearLoginFailures();
      await this.users.update(user);
      this.logger.warn(`Promoted existing user "${normalizedEmail}" to administrator`);
    }

    await this.users.assignRoleToUsers(adminRole.id, [user.id]);

    if (process.env[ADMIN_PASSWORD_ENV] === undefined) {
      this.logger.warn(
        `"${normalizedEmail}" uses the default development password. Set ADMIN_PASSWORD before exposing this API (see README).`,
      );
    }
  }

  private hasState(key: string): boolean {
    const row = this.db.connection
      .prepare('SELECT 1 AS found FROM bootstrap_state WHERE key = ?')
      .get(key);

    return row !== undefined;
  }

  private setState(key: string): void {
    this.db.connection
      .prepare('INSERT OR REPLACE INTO bootstrap_state (key, value) VALUES (?, ?)')
      .run(key, new Date().toISOString());
  }
}
