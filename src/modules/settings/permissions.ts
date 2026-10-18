import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the settings context. `update` covers
 * operational configuration (clinic, quotes, activity, agenda, AI limits);
 * `updateSecurity` additionally gates password policy, lockout, tokens and
 * write gates.
 */
export const settingsCategory = defineCategory('settings', 'System settings', {
  read: 'Read settings',
  update: 'Change general settings',
  updateSecurity: 'Change security settings',
});

/** Typed keys, e.g. `settingsPermissions.updateSecurity` → `settings:update-security`. */
export const settingsPermissions = settingsCategory.keys;
