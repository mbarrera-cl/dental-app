import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { GetDashboardSummaryUseCase } from './application/use-cases/get-dashboard-summary.use-case.js';
import { DashboardQueryPort } from './application/ports/dashboard-query.port.js';
import { PostgresDashboardQuery } from './infrastructure/adapters/persistence/postgres-dashboard.query.js';
import { DashboardController } from './infrastructure/http/dashboard.controller.js';

/**
 * Composition root of the dashboard read model. Queries the existing contexts
 * through SQL aggregates — it owns no tables and has no write path.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [DashboardController],
  providers: [
    GetDashboardSummaryUseCase,
    // Swap this binding for another database adapter (Postgres, MongoDB, ...).
    { provide: DashboardQueryPort, useClass: PostgresDashboardQuery },
  ],
  exports: [GetDashboardSummaryUseCase],
})
export class DashboardModule {}
