import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the payments context (cobros / caja).
 * Declare new actions here and use `paymentsPermissions.<action>` in guards —
 * the catalog API, the role matrix and the menu pick them up automatically.
 */
export const paymentsCategory = defineCategory('payments', 'Payments and cash (cobros / caja)', {
  read: 'Read the patient account (ledger, balance) and the cash summary',
  create: 'Record charges and payments on the patient account',
  void: 'Void (annul) ledger movements',
});

/** Typed keys, e.g. `paymentsPermissions.void` → `payments:void`. */
export const paymentsPermissions = paymentsCategory.keys;
