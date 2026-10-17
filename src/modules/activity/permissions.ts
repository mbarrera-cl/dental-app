import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the activity context. `read` shows the
 * caller's own history, `read-all` the whole platform and `purge` allows the
 * audited cleanup of old entries.
 */
export const activityCategory = defineCategory('activity', 'Activity log', {
  read: 'Read your own activity',
  readAll: 'Read the activity of every user',
  purge: 'Purge activity entries',
});

/** Typed keys, e.g. `activityPermissions.read` → `activity:read`. */
export const activityPermissions = activityCategory.keys;
