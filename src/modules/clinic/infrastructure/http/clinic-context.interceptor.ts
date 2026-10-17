import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { GetBrandingUseCase } from '../../application/use-cases/get-branding.use-case.js';
import type { ClinicRequest } from './current-clinic.decorator.js';

/**
 * Request-scoped memo of the clinic branding. The settings behind it are
 * already cached in memory, but this guarantees the projection (identity +
 * assets query) is built *once per request*, so several consumers in the
 * same request — handlers, logging, print views — see an identical snapshot
 * through `@CurrentClinic()`.
 */
@Injectable()
export class ClinicContextInterceptor implements NestInterceptor {
  constructor(private readonly getBranding: GetBrandingUseCase) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    // MCP tool handlers run in the RPC pipeline and have no HTTP request.
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<ClinicRequest>();

    request.clinic ??= await this.getBranding.execute();

    return next.handle();
  }
}
