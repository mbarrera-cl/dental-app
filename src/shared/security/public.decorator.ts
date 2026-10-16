import { SetMetadata } from '@nestjs/common';

/** Metadata key read by the global authentication guard. */
export const IS_PUBLIC_METADATA = 'hexa:security:is-public';

/** Marks a controller or route as reachable without authentication. */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_METADATA, true);
