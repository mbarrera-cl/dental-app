import type { NextFunction, Request, RequestHandler, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defence-in-depth against CSRF for cookie-authenticated flows.
 *
 * Browsers attach an `Origin` header to every state-changing request. If that
 * origin is not explicitly allowed we reject the request before it reaches a
 * controller, even when the browser would still deliver the httpOnly refresh
 * cookie (e.g. a deployment configured with `SameSite=None`).
 *
 * Non-browser clients (MCP, API keys, curl) do not send `Origin`; they are not
 * vulnerable to CSRF, so they pass through.
 */
export function createOriginGuard(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);

  return (request: Request, response: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      next();
      return;
    }

    const origin = request.headers.origin;

    if (origin === undefined || allowed.has(origin)) {
      next();
      return;
    }

    response.status(403).json({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Origin not allowed',
    });
  };
}
