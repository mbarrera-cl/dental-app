import { Module } from '@nestjs/common';
import { RolesModule } from './modules/roles/roles.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { IdentityBootstrapService } from './shared/infrastructure/bootstrap/identity-bootstrap.service.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { SecurityModule } from './shared/security/security.module.js';

/**
 * Composition root of the application. Every feature lives in
 * `src/modules/<context>` and follows the same
 * domain / application / infrastructure split.
 */
@Module({
  imports: [DatabaseModule, SecurityModule, SettingsModule, RolesModule, UsersModule],
  providers: [IdentityBootstrapService],
})
export class AppModule {}
