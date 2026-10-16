import type { Request } from 'express';
import type { Principal } from './principal.js';

/**
 * Express request after the global authentication guard ran: `user` holds
 * the resolved principal. `undefined` only for `@Public()` routes.
 */
export interface AuthenticatedRequest extends Request {
  user?: Principal;
}
