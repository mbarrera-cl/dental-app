import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the patients context. Declare new actions
 * here and use `patientsPermissions.<action>` in guards — the catalog API
 * and the admin panel pick them up automatically.
 */
export const patientsCategory = defineCategory(
  'patients',
  'Patient administration',
  {
    read: 'Read patients (list and detail)',
    create: 'Create patients',
    update: 'Update patient records',
    delete: 'Delete patients',
  },
);

/** Typed keys, e.g. `patientsPermissions.read` → `patients:read`. */
export const patientsPermissions = patientsCategory.keys;
