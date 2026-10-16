import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { ApiKeyAuthenticatorPort } from '../../shared/security/api-key-authenticator.port.js';
import { SettingsModule } from '../settings/settings.module.js';
import { UsersModule } from '../users/users.module.js';
import { ApiKeyRepositoryPort } from './application/ports/api-key.repository.port.js';
import { CreateApiKeyUseCase } from './application/use-cases/create-api-key.use-case.js';
import { GetApiKeyUseCase } from './application/use-cases/get-api-key.use-case.js';
import { ListApiKeysUseCase } from './application/use-cases/list-api-keys.use-case.js';
import { RevokeApiKeyUseCase } from './application/use-cases/revoke-api-key.use-case.js';
import { RotateApiKeyUseCase } from './application/use-cases/rotate-api-key.use-case.js';
import { ApiKeyAuthenticatorService } from './infrastructure/adapters/api-key-authenticator.service.js';
import { SqliteApiKeyRepository } from './infrastructure/adapters/persistence/sqlite-api-key.repository.js';
import { ApiKeysController } from './infrastructure/http/api-keys.controller.js';

/**
 * Composition root for the API keys context. It binds the shared
 * `ApiKeyAuthenticatorPort` so the global auth guard can authenticate
 * `X-Api-Key` requests; `UsersModule` provides the access reader used to
 * intersect each key with its owner's *current* permissions.
 */
@Module({
  imports: [DatabaseModule, SettingsModule, UsersModule],
  controllers: [ApiKeysController],
  providers: [
    ListApiKeysUseCase,
    GetApiKeyUseCase,
    CreateApiKeyUseCase,
    RotateApiKeyUseCase,
    RevokeApiKeyUseCase,
    // Swap these bindings for other database adapters (Postgres, MongoDB, ...).
    { provide: ApiKeyRepositoryPort, useClass: SqliteApiKeyRepository },
    { provide: ApiKeyAuthenticatorPort, useClass: ApiKeyAuthenticatorService },
  ],
  exports: [ApiKeyAuthenticatorPort],
})
export class ApiKeysModule {}
