import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from './permission-catalog.js';

/** Metadata key read by the global permissions guard. */
export const ANY_PERMISSIONS_METADATA = 'hexa:security:any-permissions';

/**
 * Requires the authenticated principal to hold *at least one* of the listed
 * permissions. Complements `@RequirePermissions` (all of them): use it when
 * a route is reachable through different capabilities, e.g. managing your
 * own API keys (`apikeys:self`) or anyone's (`apikeys:manage`).
 */
export const RequireAnyPermissions = (
  ...permissions: readonly PermissionKey[]
): MethodDecorator & ClassDecorator => SetMetadata(ANY_PERMISSIONS_METADATA, permissions);
