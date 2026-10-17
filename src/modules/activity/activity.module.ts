import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { ActivityRetentionService } from './application/activity-retention.service.js';
import { ActivityRecorder } from './application/record-activity.service.js';
import { ActivityRepositoryPort } from './application/ports/activity-repository.port.js';
import { GetActivityConfigUseCase } from './application/use-cases/get-activity-config.use-case.js';
import { ListActivitiesUseCase } from './application/use-cases/list-activities.use-case.js';
import { PurgeActivitiesUseCase } from './application/use-cases/purge-activities.use-case.js';
import { SqliteActivityRepository } from './infrastructure/adapters/persistence/sqlite-activity.repository.js';
import { ActivityController } from './infrastructure/http/activity.controller.js';
import { ActivityInterceptor } from './infrastructure/http/activity.interceptor.js';

/**
 * Composition root of the activity trail. Exports `ActivityRecorder` so
 * adapters that write their own explicit events (the auth controller) can
 * reuse the same policy and privacy rules.
 */
@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [ActivityController],
  providers: [
    ActivityRecorder,
    ListActivitiesUseCase,
    GetActivityConfigUseCase,
    PurgeActivitiesUseCase,
    ActivityRetentionService,
    { provide: ActivityRepositoryPort, useClass: SqliteActivityRepository },
    { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor },
  ],
  exports: [ActivityRecorder, ListActivitiesUseCase],
})
export class ActivityModule {}
