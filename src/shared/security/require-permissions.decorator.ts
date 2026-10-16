import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from './permission-catalog.js';

/** Metadata key read by the global permissions guard. */
export const REQUIRED_PERMISSIONS_METADATA = 'hexa:security:required-permissions';

/**
 * Requires the authenticated principal to hold *every* listed permission.
 * Pass catalog constants (`usersPermissions.create`), never raw strings — a
 * typo then fails to compile instead of silently granting access.
 */
export const RequirePermissions = (
  ...permissions: readonly PermissionKey[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS_METADATA, permissions);
