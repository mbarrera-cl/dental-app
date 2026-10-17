import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { SettingsService } from '../../settings/application/settings.service.js';
import { CaroIaRepositoryPort } from './caro-ia.repository.port.js';

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Optional retention sweep. `caroIa.retentionDays = 0` (the default) keeps
 * conversations forever; a positive value hard-deletes conversations whose
 * last activity is older than the cutoff. Messages and approvals follow the
 * SQL foreign-key cascade.
 */
@Injectable()
export class CaroIaRetentionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CaroIaRetentionService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly repository: CaroIaRepositoryPort,
    private readonly settings: SettingsService,
  ) {}

  onApplicationBootstrap(): void {
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async sweep(): Promise<number> {
    try {
      const days = await this.settings.getNumber('caroIa.retentionDays');

      if (days <= 0) {
        return 0;
      }

      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const deleted = await this.repository.purgeOlderThan(cutoff);

      if (deleted > 0) {
        this.logger.log(`Deleted ${deleted} CaroIA conversation(s) past retention`);
      }

      return deleted;
    } catch (error) {
      this.logger.warn(
        `CaroIA retention sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return 0;
    }
  }
}
