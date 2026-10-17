import { defineCategory, toKebabCase } from './permission-catalog.js';
import {
  ADMIN_CRITICAL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  allPermissionKeys,
  dashboardCategory,
  isPermissionKey,
} from './permissions.js';
import { apiKeysCategory } from '../../modules/apikeys/permissions.js';
import { clinicalCategory } from '../../modules/clinical/permissions.js';
import { patientsCategory } from '../../modules/patients/permissions.js';
import { quotesCategory } from '../../modules/quotes/permissions.js';
import { rolesCategory } from '../../modules/roles/permissions.js';
import { settingsCategory } from '../../modules/settings/permissions.js';
import { ucoCategory } from '../../modules/uco/permissions.js';
import { usersCategory } from '../../modules/users/permissions.js';

describe('permission catalog', () => {
  it('converts camelCase actions to kebab-case keys', () => {
    expect(toKebabCase('read')).toBe('read');
    expect(toKebabCase('resetPassword')).toBe('reset-password');
    expect(toKebabCase('manage_permissions all')).toBe('manage-permissions-all');
  });

  it('derives typed keys for every declared action', () => {
    expect(Object.keys(usersCategory.keys)).toEqual(Object.keys(usersCategory.actions));
    expect(usersCategory.keys.resetPassword).toBe('users:reset-password');
    expect(apiKeysCategory.keys.manage).toBe('apikeys:manage');
    expect(usersCategory.permissionKeys).toEqual([
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
      'users:reset-password',
      'users:permissions',
    ]);
  });

  it('supports declaring new categories (three steps to grow the system)', () => {
    const demoCategory = defineCategory('demo', 'Demo category', {
      read: 'Read demos',
      spinUp: 'Spin up a demo',
    });

    expect(demoCategory.keys.read).toBe('demo:read');
    expect(demoCategory.keys.spinUp).toBe('demo:spin-up');
  });

  it('keeps category ids and permission keys globally unique', () => {
    const ids = PERMISSION_CATEGORIES.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);

    const keys = allPermissionKeys();
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(16);
  });

  it('lists keys in category declaration order', () => {
    const expected = PERMISSION_CATEGORIES.flatMap((category) => [...category.permissionKeys]);

    expect([...allPermissionKeys()]).toEqual(expected);
  });

  it('registers every module-owned category plus the UI-only dashboard category', () => {
    expect(PERMISSION_CATEGORIES).toEqual([
      usersCategory,
      patientsCategory,
      clinicalCategory,
      rolesCategory,
      settingsCategory,
      apiKeysCategory,
      dashboardCategory,
      ucoCategory,
      quotesCategory,
    ]);
  });

  it('validates permission keys', () => {
    expect(isPermissionKey('users:read')).toBe(true);
    expect(isPermissionKey('settings:update')).toBe(true);
    expect(isPermissionKey('users:readWrite')).toBe(false);
    expect(isPermissionKey('nope:read')).toBe(false);
    expect(isPermissionKey('')).toBe(false);
  });

  it('keeps every critical admin permission inside the catalog', () => {
    for (const key of ADMIN_CRITICAL_PERMISSIONS) {
      expect(isPermissionKey(key)).toBe(true);
    }
  });
});
