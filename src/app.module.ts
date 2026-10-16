import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeysModule } from './modules/apikeys/apikeys.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { PatientsModule } from './modules/patients/patients.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { IdentityBootstrapService } from './shared/infrastructure/bootstrap/identity-bootstrap.service.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { JwtAuthGuard } from './shared/security/jwt-auth.guard.js';
import { PermissionsGuard } from './shared/security/permissions.guard.js';
import { SecurityModule } from './shared/security/security.module.js';

/**
 * Composition root of the application. Every feature lives in
 * `src/modules/<context>` and follows the same
 * domain / application / infrastructure split.
 *
 * Authentication and permissions are enforced *globally*: every route
 * requires a valid principal unless annotated with `@Public()`, and every
 * route annotated with `@RequirePermissions(...)` demands those keys.
 */
@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    SettingsModule,
    RolesModule,
    UsersModule,
    AuthModule,
    ApiKeysModule,
    PatientsModule,
  ],
  providers: [
    IdentityBootstrapService,
    // Order matters: authenticate first, authorize second.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
