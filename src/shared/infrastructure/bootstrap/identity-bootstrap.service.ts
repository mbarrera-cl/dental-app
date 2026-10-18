import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { RoleRepositoryPort } from '../../../modules/roles/application/ports/role-repository.port.js';
import { ADMIN_ROLE_NAME, Role } from '../../../modules/roles/domain/role.entity.js';
import { UserRepositoryPort } from '../../../modules/users/application/ports/user-repository.port.js';
import { Email } from '../../../modules/users/domain/email.vo.js';
import { User } from '../../../modules/users/domain/user.entity.js';
import { agendaCategory } from '../../../modules/agenda/permissions.js';
import { apiKeysCategory } from '../../../modules/apikeys/permissions.js';
import { activityCategory } from '../../../modules/activity/permissions.js';
import { patientsCategory } from '../../../modules/patients/permissions.js';
import { consentsCategory } from '../../../modules/consents/permissions.js';
import { prescriptionsCategory } from '../../../modules/prescriptions/permissions.js';
import { usersCategory } from '../../../modules/users/permissions.js';
import { allPermissionKeys, dashboardCategory } from '../../security/permissions.js';
import { PasswordHasher } from '../../security/password-hasher.js';
import { PostgresDatabase } from '../database/postgres-database.js';

export const ADMIN_EMAIL_ENV = 'ADMIN_EMAIL';
export const ADMIN_PASSWORD_ENV = 'ADMIN_PASSWORD';

const DEFAULT_ADMIN_EMAIL = 'admin@hexa.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin123!';
const DEFAULT_ROLES_SEEDED_MARKER = 'default-roles-seeded';
const DENTIST_ROLE_NAME = 'dentista';
const DENTIST_ROLE_SEEDED_MARKER = 'dentist-role-seeded';

/** Permissions of the built-in dentist role. */
export const DENTIST_PERMISSIONS = [
  agendaCategory.keys.read,
  agendaCategory.keys.create,
  agendaCategory.keys.update,
  agendaCategory.keys.cancel,
  agendaCategory.keys.professional,
  patientsCategory.keys.read,
  prescriptionsCategory.keys.read,
  prescriptionsCategory.keys.create,
  consentsCategory.keys.read,
  consentsCategory.keys.record,
];

/** Permissions of the seeded `viewer` role (read-only demo role). */
const VIEWER_PERMISSIONS = [
  dashboardCategory.keys.read,
  agendaCategory.keys.read,
  usersCategory.keys.read,
  apiKeysCategory.keys.self,
  activityCategory.keys.read,
];

/** Permissions of the seeded `editor` role (manages users, not roles/settings). */
const EDITOR_PERMISSIONS = [
  ...VIEWER_PERMISSIONS,
  agendaCategory.keys.create,
  agendaCategory.keys.update,
  agendaCategory.keys.cancel,
  usersCategory.keys.create,
  usersCategory.keys.update,
];

/**
 * Brings a database (fresh, upgraded or manually damaged) to a usable state:
 *
 * 1. Keeps the built-in `admin` role in sync with the permission catalog, so
 *    a permission added by a new module is granted automatically on deploy.
 * 2. Seeds the built-in `dentista` role once — a marker in `bootstrap_state`
 *    means the administrator is then in charge: its edits stick.
 * 3. Seeds the demo roles (`editor`, `viewer`) once — a marker in
 *    `bootstrap_state` means deleting them later is respected.
 * 4. Guarantees an active administrator account (`ADMIN_EMAIL` /
 *    `ADMIN_PASSWORD`), which doubles as the lockout rescue.
 */
@Injectable()
export class IdentityBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IdentityBootstrapService.name);

  constructor(
    private readonly db: PostgresDatabase,
    private readonly users: UserRepositoryPort,
    private readonly roles: RoleRepositoryPort,
    private readonly hasher: PasswordHasher,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.syncAdminRole();
    await this.ensureDentistRole();
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

  private async ensureDentistRole(): Promise<void> {
    if (await this.hasState(DENTIST_ROLE_SEEDED_MARKER)) {
      return;
    }

    const existing = await this.roles.findByName(DENTIST_ROLE_NAME);

    if (existing === null) {
      await this.roles.save(
        Role.create({
          name: DENTIST_ROLE_NAME,
          description: 'Dentist: appointment calendar and patient access.',
          permissions: DENTIST_PERMISSIONS,
          builtIn: true,
        }),
      );

      this.logger.log(`Created the built-in "${DENTIST_ROLE_NAME}" role`);
    } else {
      // One-time migration: databases seeded by the previous "ensure on every
      // boot" behaviour get their default permissions completed once, then the
      // administrator is in charge of the role and its edits are respected.
      const missing = DENTIST_PERMISSIONS.filter((key) => !existing.hasPermission(key));

      if (missing.length > 0) {
        existing.changePermissions([...existing.permissions, ...missing]);
        await this.roles.update(existing);
        this.logger.log(
          `Completed the default permissions of the existing "${DENTIST_ROLE_NAME}" role (${missing.length})`,
        );
      }
    }

    await this.setState(DENTIST_ROLE_SEEDED_MARKER);
  }

  private async seedDefaultRolesOnce(): Promise<void> {
    if (await this.hasState(DEFAULT_ROLES_SEEDED_MARKER)) {
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

    await this.setState(DEFAULT_ROLES_SEEDED_MARKER);

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

  private async hasState(key: string): Promise<boolean> {
    const row = await this.db.queryOne<{ found: number }>(
      'SELECT 1 AS found FROM bootstrap_state WHERE key = $1',
      [key],
    );

    return row !== null;
  }

  private async setState(key: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO bootstrap_state (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, new Date().toISOString()],
    );
  }
}
