import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { ClinicAssetsRepositoryPort } from '../ports/clinic-assets-repository.port.js';

export interface RemovedLogo {
  /** Version left active after the removal: previous one, or `0` (no logo). */
  readonly version: number;
}

/**
 * Removes the current logo by rolling back to the previous version (the
 * assets of every version stay stored, so a mis-click is recoverable). With
 * no previous version the clinic simply ends up without a logo
 * (`clinic.logo.version = 0`), which the frontend renders with its fallback.
 */
@Injectable()
export class RemoveLogoUseCase implements UseCase<void, RemovedLogo> {
  constructor(
    private readonly settings: SettingsService,
    private readonly assets: ClinicAssetsRepositoryPort,
  ) {}

  async execute(): Promise<RemovedLogo> {
    const current = await this.settings.getNumber('clinic.logo.version');

    if (current === 0) {
      return { version: 0 };
    }

    const previous = await this.assets.latestVersionBelow(current);

    if (previous === null) {
      await this.assets.deactivateAll();
      await this.settings.update({ 'clinic.logo.version': 0 });

      return { version: 0 };
    }

    await this.assets.activateVersion(previous);
    await this.settings.update({ 'clinic.logo.version': previous });

    return { version: previous };
  }
}
