import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { SettingsAuditRepositoryPort } from './application/ports/settings-audit-repository.port.js';
import { SettingsRepositoryPort } from './application/ports/settings-repository.port.js';
import { SettingsAuditService } from './application/settings-audit.service.js';
import { SettingsService } from './application/settings.service.js';
import { ExportSettingsUseCase } from './application/use-cases/export-settings.use-case.js';
import { GetSettingsUseCase } from './application/use-cases/get-settings.use-case.js';
import { ImportSettingsUseCase } from './application/use-cases/import-settings.use-case.js';
import { UpdateSettingsUseCase } from './application/use-cases/update-settings.use-case.js';
import { SqliteSettingsAuditRepository } from './infrastructure/adapters/persistence/sqlite-settings-audit.repository.js';
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
    SettingsAuditService,
    GetSettingsUseCase,
    UpdateSettingsUseCase,
    ExportSettingsUseCase,
    ImportSettingsUseCase,
    { provide: SettingsRepositoryPort, useClass: SqliteSettingsRepository },
    { provide: SettingsAuditRepositoryPort, useClass: SqliteSettingsAuditRepository },
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
