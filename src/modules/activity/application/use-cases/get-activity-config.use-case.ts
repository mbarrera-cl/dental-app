import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { ACTIVITY_SETTINGS } from '../../domain/activity-settings.js';

/** UI knobs of the activity panel; safe to expose to every authenticated user. */
export interface ActivityPanelConfig {
  enabled: boolean;
  panelLimit: number;
  refreshSeconds: number;
  badge: boolean;
}

/**
 * The panel needs a few settings to render (size, refresh cadence, badge),
 * but ordinary users cannot read `/settings`. This use case exposes only the
 * panel-related subset.
 */
@Injectable()
export class GetActivityConfigUseCase {
  constructor(private readonly settings: SettingsService) {}

  async execute(): Promise<ActivityPanelConfig> {
    const [enabled, panelLimit, refreshSeconds, badge] = await Promise.all([
      this.settings.getBoolean(ACTIVITY_SETTINGS.enabled),
      this.settings.getNumber(ACTIVITY_SETTINGS.panelLimit),
      this.settings.getNumber(ACTIVITY_SETTINGS.panelRefreshSeconds),
      this.settings.getBoolean(ACTIVITY_SETTINGS.panelBadge),
    ]);

    return { enabled, panelLimit, refreshSeconds, badge };
  }
}
