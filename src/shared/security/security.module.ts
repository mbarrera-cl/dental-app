import { Module } from '@nestjs/common';
import { SettingsModule } from '../../modules/settings/settings.module.js';
import { JwtService } from './jwt.js';
import { PasswordHasher } from './password-hasher.js';
import { PasswordPolicyService } from './password-policy.js';

/**
 * Shared security building blocks: password hashing, JWT signing and the
 * configurable password policy. The guards live in `AppModule` (registered
 * as `APP_GUARD`) and `PermissionResolver` is registered by `UsersModule`
 * (it owns the access data).
 */
@Module({
  imports: [SettingsModule],
  providers: [PasswordHasher, JwtService, PasswordPolicyService],
  exports: [PasswordHasher, JwtService, PasswordPolicyService],
})
export class SecurityModule {}
