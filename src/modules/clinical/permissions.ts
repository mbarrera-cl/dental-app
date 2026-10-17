import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the clinical records context (ficha dental).
 * Declare new actions here and use `clinicalPermissions.<action>` in guards —
 * the catalog API and the admin panel pick them up automatically.
 */
export const clinicalCategory = defineCategory(
  'clinical',
  'Dental clinical records (ficha clínica)',
  {
    read: 'Read dental clinical records, odontogram and indices',
    create: 'Open the clinical record of a patient',
    update: 'Edit clinical records, odontogram findings and indicators',
  },
);

/** Typed keys, e.g. `clinicalPermissions.read` → `clinical:read`. */
export const clinicalPermissions = clinicalCategory.keys;
