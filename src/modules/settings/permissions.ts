import { defineCategory } from '../../shared/security/permission-catalog.js';

/** Permission category owned by the settings context. */
export const settingsCategory = defineCategory('settings', 'System settings', {
  read: 'Read settings',
  update: 'Change settings',
});

/** Typed keys, e.g. `settingsPermissions.update` → `settings:update`. */
export const settingsPermissions = settingsCategory.keys;
