import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by CaroIA. `use` gates the chat page and API.
 * There is deliberately no `read-all`: conversations are private to their
 * owner, including for administrators.
 */
export const caroIaCategory = defineCategory('caroIa', 'CaroIA assistant', {
  use: 'Use the CaroIA assistant and its conversations',
});

export const caroIaPermissions = caroIaCategory.keys;
