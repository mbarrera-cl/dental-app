import { Injectable, NotFoundException, type CanActivate } from '@nestjs/common';
import { isMcpEnabled } from '../../../../shared/infrastructure/mcp-setup.js';

/** Keeps `/mcp` hidden (404) unless the environment explicitly enables it. */
@Injectable()
export class McpEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!isMcpEnabled()) {
      throw new NotFoundException();
    }

    return true;
  }
}
