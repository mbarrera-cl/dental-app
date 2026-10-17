import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { SecurityModule } from '../../shared/security/security.module.js';
import { ActivityModule } from '../activity/activity.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { UsersModule } from '../users/users.module.js';
import { LoginAttemptsService } from './application/login-attempts.service.js';
import { PasswordChangeService } from './application/password-change.service.js';
import { RefreshTokenRepositoryPort } from './application/ports/refresh-token.repository.port.js';
import { SessionService } from './application/session.service.js';
import { ChangeExpiredPasswordUseCase } from './application/use-cases/change-expired-password.use-case.js';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case.js';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case.js';
import { LoginUseCase } from './application/use-cases/login.use-case.js';
import { LogoutUseCase } from './application/use-cases/logout.use-case.js';
import { RefreshUseCase } from './application/use-cases/refresh.use-case.js';
import { SqliteRefreshTokenRepository } from './infrastructure/adapters/persistence/sqlite-refresh-token.repository.js';
import { AuthController } from './infrastructure/http/auth.controller.js';

/**
 * Composition root for the auth context: login, refresh rotation, logout,
 * profile and password changes. It consumes the users context (credentials,
 * history, permission resolution) and the shared security services.
 */
@Module({
  imports: [DatabaseModule, SecurityModule, SettingsModule, UsersModule, ActivityModule],
  controllers: [AuthController],
  providers: [
    SessionService,
    LoginAttemptsService,
    PasswordChangeService,
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    GetProfileUseCase,
    ChangePasswordUseCase,
    ChangeExpiredPasswordUseCase,
    { provide: RefreshTokenRepositoryPort, useClass: SqliteRefreshTokenRepository },
  ],
})
export class AuthModule {}
