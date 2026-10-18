import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the prescriptions context (recetas).
 * Declare new actions here and use `prescriptionsPermissions.<action>` in
 * guards — the catalog API and the admin panel pick them up automatically.
 */
export const prescriptionsCategory = defineCategory(
  'prescriptions',
  'Prescriptions (recetas)',
  {
    read: 'Read prescriptions',
    create: 'Issue prescriptions',
  },
);

export const prescriptionsPermissions = prescriptionsCategory.keys;
