import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { SettingsRepositoryPort } from './application/ports/settings-repository.port.js';
import { SettingsService } from './application/settings.service.js';
import { GetSettingsUseCase } from './application/use-cases/get-settings.use-case.js';
import { UpdateSettingsUseCase } from './application/use-cases/update-settings.use-case.js';
import { SqliteSettingsRepository } from './infrastructure/adapters/persistence/sqlite-settings.repository.js';
import { SettingsController } from './infrastructure/http/settings.controller.js';

/**
 * Composition root for the settings context. `SettingsService` is exported so
 * other contexts (auth, users, api keys) can read configuration without ever
 * touching the repository.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    GetSettingsUseCase,
    UpdateSettingsUseCase,
    { provide: SettingsRepositoryPort, useClass: SqliteSettingsRepository },
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
