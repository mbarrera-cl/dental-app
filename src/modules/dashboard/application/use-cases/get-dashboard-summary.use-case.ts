import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  dashboardWindow,
  type DashboardSummary,
} from '../../domain/dashboard-summary.js';
import { DashboardQueryPort } from '../ports/dashboard-query.port.js';

export interface GetDashboardSummaryCommand {
  /** Reference instant; defaults to now. Used by specs to pin the window. */
  now?: Date;
}

/**
 * One consolidated read for the dashboard: patients, cash, quotes, agenda and
 * recent activity, all sharing the same day/month window. Read-only.
 */
@Injectable()
export class GetDashboardSummaryUseCase implements UseCase<
  GetDashboardSummaryCommand,
  DashboardSummary
> {
  constructor(private readonly dashboard: DashboardQueryPort) {}

  async execute(command: GetDashboardSummaryCommand = {}): Promise<DashboardSummary> {
    return this.dashboard.getSummary(dashboardWindow(command.now ?? new Date()));
  }
}
