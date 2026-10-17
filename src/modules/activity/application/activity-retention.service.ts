import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { SettingsService } from '../../settings/application/settings.service.js';
import { ACTIVITY_SETTINGS } from '../domain/activity-settings.js';
import { PurgeActivitiesUseCase } from './use-cases/purge-activities.use-case.js';

/** How often the retention rule is evaluated. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Applies `activity.retentionDays`: entries older than the configured window
 * are deleted in batches. `0` disables retention. Runs in-process with an
 * unref'd timer (no scheduler dependency) and writes an audit entry only when
 * something was actually removed.
 */
@Injectable()
export class ActivityRetentionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ActivityRetentionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly purgeActivities: PurgeActivitiesUseCase,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.run(), CHECK_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Exposed for tests and for a future admin “run now” button. */
  async run(now: Date = new Date()): Promise<number> {
    try {
      const days = await this.settings.getNumber(ACTIVITY_SETTINGS.retentionDays);

      if (days <= 0) {
        return 0;
      }

      const before = new Date(now.getTime() - days * DAY_MS).toISOString();
      const pending = await this.purgeActivities.preview({ all: false, before });

      if (pending === 0) {
        return 0;
      }

      const result = await this.purgeActivities.execute({
        all: false,
        before,
        actor: { id: null, type: 'system', label: 'retention' },
        reason: 'retention',
      });

      this.logger.log(`Retention removed ${result.deleted} activity entries older than ${before}`);

      return result.deleted;
    } catch (error) {
      this.logger.warn(
        `Activity retention failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      return 0;
    }
  }
}
