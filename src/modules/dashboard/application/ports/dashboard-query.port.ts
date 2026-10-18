import type { DashboardSummary, DashboardWindow } from '../../domain/dashboard-summary.js';

/**
 * Read-model port of the dashboard. Implementations only aggregate — they never
 * write and never own a table of their own.
 */
export abstract class DashboardQueryPort {
  abstract getSummary(window: DashboardWindow): Promise<DashboardSummary>;
}
