import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the API keys context. `self` lets any user
 * manage their own keys; `read` and `manage` cover other users' keys and are
 * meant for administrators.
 */
export const apiKeysCategory = defineCategory('apikeys', 'API keys', {
  self: 'Manage your own API keys',
  read: 'List API keys of any user',
  manage: 'Create, rotate and revoke API keys for any user',
});

/** Typed keys, e.g. `apiKeysPermissions.manage` → `apikeys:manage`. */
export const apiKeysPermissions = apiKeysCategory.keys;
