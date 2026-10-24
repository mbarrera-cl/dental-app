import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { SettingsService } from '../settings.service.js';

/** UI defaults any authenticated user may read (no `settings:read` needed). */
export interface UiSettings {
  /** Rows per page every paginated list starts with. */
  defaultPageSize: number;
}

/**
 * Safe subset of the configuration for the shell: the panel needs a page
 * size before/without holding `settings:read`, so this exposes only the
 * whitelisted UI keys (never security or business values).
 */
@Injectable()
export class GetUiSettingsUseCase implements UseCase<void, UiSettings> {
  constructor(private readonly settings: SettingsService) {}

  async execute(): Promise<UiSettings> {
    return {
      defaultPageSize: await this.settings.getNumber('ui.defaultPageSize'),
    };
  }
}
