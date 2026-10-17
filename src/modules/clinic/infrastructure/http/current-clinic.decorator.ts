import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ClinicBranding } from '../../domain/branding.js';

/** Express request after `ClinicContextInterceptor` has run. */
export interface ClinicRequest extends Request {
  clinic?: ClinicBranding;
}

/**
 * Branding memoized for the current request (`req.clinic`), hydrated once by
 * `ClinicContextInterceptor`. Prefer this over calling `GetBrandingUseCase`
 * inside a handler: within one request the value is guaranteed to be stable.
 */
export const CurrentClinic = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClinicBranding => {
    const request = context.switchToHttp().getRequest<ClinicRequest>();

    if (request.clinic === undefined) {
      throw new Error('ClinicContextInterceptor is not registered in this application');
    }

    return request.clinic;
  },
);
