import { Controller, Get } from '@nestjs/common';
import { Public } from '../../security/public.decorator.js';

/** Unauthenticated liveness probe for Railway/containers. */
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
