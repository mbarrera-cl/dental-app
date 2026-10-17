import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { ActivityModule } from '../activity/activity.module.js';
import { McpModule } from '../mcp/mcp.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { CaroIaAnswerVerifier } from './application/caro-ia-verifier.js';
import { CaroIaRetentionService } from './application/caro-ia-retention.service.js';
import { CaroIaRepositoryPort } from './application/caro-ia.repository.port.js';
import { CaroIaService } from './application/caro-ia.service.js';
import { DeepSeekClient, HttpDeepSeekClient } from './application/deepseek.client.js';
import { DeepgramClient, HttpDeepgramClient } from './application/deepgram.client.js';
import { SqliteCaroIaRepository } from './infrastructure/adapters/persistence/sqlite-caro-ia.repository.js';
import { CaroIaController } from './infrastructure/http/caro-ia.controller.js';

/**
 * CaroIA context. The model/tool integrations are ports so tests (and future
 * providers) can replace DeepSeek or Deepgram without touching the workflow.
 * Attachments are intentionally absent in this phase.
 */
@Module({
  imports: [DatabaseModule, SettingsModule, ActivityModule, McpModule],
  controllers: [CaroIaController],
  providers: [
    CaroIaService,
    CaroIaAnswerVerifier,
    CaroIaRetentionService,
    { provide: CaroIaRepositoryPort, useClass: SqliteCaroIaRepository },
    { provide: DeepSeekClient, useClass: HttpDeepSeekClient },
    { provide: DeepgramClient, useClass: HttpDeepgramClient },
  ],
})
export class CaroIaModule {}
