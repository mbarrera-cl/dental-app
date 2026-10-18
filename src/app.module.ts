import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActivityModule } from './modules/activity/activity.module.js';
import { AgendaModule } from './modules/agenda/agenda.module.js';
import { ApiKeysModule } from './modules/apikeys/apikeys.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CaroIaModule } from './modules/caro-ia/caro-ia.module.js';
import { ClinicModule } from './modules/clinic/clinic.module.js';
import { ClinicalModule } from './modules/clinical/clinical.module.js';
import { ConsentsModule } from './modules/consents/consents.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { NavigationModule } from './modules/navigation/navigation.module.js';
import { PatientsModule } from './modules/patients/patients.module.js';
import { McpModule } from './modules/mcp/mcp.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { QuotesModule } from './modules/quotes/quotes.module.js';
import { UcoModule } from './modules/uco/uco.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { IdentityBootstrapService } from './shared/infrastructure/bootstrap/identity-bootstrap.service.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { JwtAuthGuard } from './shared/security/jwt-auth.guard.js';
import { PermissionsGuard } from './shared/security/permissions.guard.js';
import { SecurityModule } from './shared/security/security.module.js';
import { HealthController } from './shared/infrastructure/http/health.controller.js';

/**
 * Composition root of the application. Every feature lives in
 * `src/modules/<context>` and follows the same
 * domain / application / infrastructure split.
 *
 * Authentication and permissions are enforced *globally*: every route
 * requires a valid principal unless annotated with `@Public()`, and every
 * route annotated with `@RequirePermissions(...)` demands those keys.
 */
/** Reads a positive integer from the environment, falling back when invalid. */
function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        // TTL in milliseconds (v5+ API).
        ttl: positiveInt(process.env.THROTTLE_TTL_MS, 60_000),
        limit: positiveInt(process.env.THROTTLE_LIMIT, 120),
        // The e2e suites issue bursts of requests; throttling is a runtime
        // concern and is covered by its own tests instead.
        skipIf: () => process.env.NODE_ENV === 'test',
      },
    ]),
    SettingsModule,
    ActivityModule,
    AgendaModule,
    RolesModule,
    UsersModule,
    AuthModule,
    ApiKeysModule,
    PatientsModule,
    NavigationModule,
    ClinicModule,
    ClinicalModule,
    PrescriptionsModule,
    ConsentsModule,
    UcoModule,
    QuotesModule,
    PaymentsModule,
    DashboardModule,
    McpModule,
    CaroIaModule,
  ],
  controllers: [HealthController],
  providers: [
    IdentityBootstrapService,
    // Order matters: throttle first, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
