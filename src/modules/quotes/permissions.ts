import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the quotations context (presupuestos).
 * Declare new actions here and use `quotesPermissions.<action>` in guards —
 * the catalog API, the role matrix and the menu pick them up automatically.
 */
export const quotesCategory = defineCategory('quotes', 'Quotations (presupuestos)', {
  read: 'Read quotations',
  create: 'Create quotations',
  update: 'Edit quotations and decide item status',
  delete: 'Delete draft quotations',
  send: 'Send a quotation by email',
  approve: 'Sanction (approve/reject) a quotation',
});

/** Typed keys, e.g. `quotesPermissions.approve` → `quotes:approve`. */
export const quotesPermissions = quotesCategory.keys;
