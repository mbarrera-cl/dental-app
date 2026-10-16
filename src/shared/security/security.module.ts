import { Module } from '@nestjs/common';
import { PasswordHasher } from './password-hasher.js';

/**
 * Shared security building blocks. The guards themselves are registered
 * globally in `AppModule`; they only need the Reflector, so they live here
 * as plain providers of whoever imports this module.
 */
@Module({
  providers: [PasswordHasher],
  exports: [PasswordHasher],
})
export class SecurityModule {}
