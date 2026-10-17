import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the UCO fee catalog context. Declare new
 * actions here and use `ucoPermissions.<action>` in guards — the catalog API
 * and the admin panel pick them up automatically.
 */
export const ucoCategory = defineCategory('uco', 'Dental fee catalog (Arancel UCO)', {
  read: 'Read and search the UCO fee catalog',
  manage: 'Manage the UCO fee catalog (create, edit, import, export)',
});

/** Typed keys, e.g. `ucoPermissions.manage` → `uco:manage`. */
export const ucoPermissions = ucoCategory.keys;
