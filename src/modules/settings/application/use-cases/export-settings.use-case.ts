import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { SettingsExportEnvelope } from '../../domain/settings-export.js';
import { SETTINGS_EXPORT_VERSION } from '../../domain/settings-export.js';
import { SettingsService } from '../settings.service.js';

/**
 * Exports the *editable* configuration (every key except those managed by
 * their own module) as a transferable JSON envelope: replicate it in staging
 * or another branch with `POST /settings/import`.
 */
@Injectable()
export class ExportSettingsUseCase implements UseCase<void, SettingsExportEnvelope> {
  constructor(private readonly settings: SettingsService) {}

  async execute(): Promise<SettingsExportEnvelope> {
    const overview = await this.settings.overview();

    return {
      app: 'hexa',
      version: SETTINGS_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      values: Object.fromEntries(
        overview.filter((setting) => setting.managed !== true).map((setting) => [
          setting.key,
          setting.value,
        ]),
      ),
    };
  }
}
