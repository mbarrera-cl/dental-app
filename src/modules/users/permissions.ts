import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the users context. Declare new actions here
 * and use `usersPermissions.<action>` in guards — the catalog API and the
 * admin panel pick them up automatically.
 */
export const usersCategory = defineCategory('users', 'User administration', {
  read: 'Read users (list and detail)',
  create: 'Create users',
  update: 'Update user profile, roles and status',
  delete: 'Delete users',
  resetPassword: 'Reset user passwords (typed or generated)',
  permissions: 'Grant or revoke direct (non-role) permissions',
});

/** Typed keys, e.g. `usersPermissions.resetPassword` → `users:reset-password`. */
export const usersPermissions = usersCategory.keys;
