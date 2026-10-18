import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the consents context (consentimientos
 * informados). `manage` is only needed to edit the template library.
 */
export const consentsCategory = defineCategory(
  'consents',
  'Informed consents (consentimientos)',
  {
    read: 'Read consent templates and accepted consents',
    record: 'Record a patient acceptance',
    manage: 'Create and edit consent templates',
  },
);

export const consentsPermissions = consentsCategory.keys;
