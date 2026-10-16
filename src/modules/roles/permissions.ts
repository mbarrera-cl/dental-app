import { defineCategory } from '../../shared/security/permission-catalog.js';

/** Permission category owned by the roles context. */
export const rolesCategory = defineCategory('roles', 'Role administration', {
  read: 'Read roles',
  create: 'Create roles',
  update: 'Update roles and the permissions they grant',
  delete: 'Delete roles',
});

/** Typed keys, e.g. `rolesPermissions.update` → `roles:update`. */
export const rolesPermissions = rolesCategory.keys;
