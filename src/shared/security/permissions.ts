import { apiKeysCategory } from '../../modules/apikeys/permissions.js';
import { rolesCategory } from '../../modules/roles/permissions.js';
import { settingsCategory } from '../../modules/settings/permissions.js';
import { usersCategory } from '../../modules/users/permissions.js';
import { defineCategory, type PermissionCategory, type PermissionKey } from './permission-catalog.js';

/**
 * Dashboard is a UI-only capability: no backend module owns it, so its
 * category is declared here instead of in a module folder.
 */
export const dashboardCategory = defineCategory('dashboard', 'Dashboard', {
  read: 'See aggregated stats on the dashboard',
});

/** Every category in the system, in presentation order. */
export const PERMISSION_CATEGORIES: readonly PermissionCategory[] = [
  usersCategory,
  rolesCategory,
  settingsCategory,
  apiKeysCategory,
  dashboardCategory,
];

const ALL_PERMISSION_KEYS: readonly PermissionKey[] = PERMISSION_CATEGORIES.flatMap(
  (category) => category.permissionKeys,
);

const PERMISSION_KEY_SET = new Set<string>(ALL_PERMISSION_KEYS);

/** All valid permission keys, in catalog order. */
export function allPermissionKeys(): readonly PermissionKey[] {
  return ALL_PERMISSION_KEYS;
}

export function isPermissionKey(key: string): key is PermissionKey {
  return PERMISSION_KEY_SET.has(key);
}

/**
 * Permissions the built-in `admin` role can never lose: everything needed to
 * administer users, roles and settings. Nobody can lock the system out of
 * its own administration, and a permission added by a future module is
 * picked up by the boot-time sync.
 */
export const ADMIN_CRITICAL_PERMISSIONS: readonly PermissionKey[] = [
  usersCategory.keys.read,
  usersCategory.keys.update,
  rolesCategory.keys.read,
  rolesCategory.keys.update,
  settingsCategory.keys.read,
  settingsCategory.keys.update,
];
