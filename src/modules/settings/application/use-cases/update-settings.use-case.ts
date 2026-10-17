import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { SettingOverview } from '../../domain/setting-definition.js';
import { findSettingDefinition } from '../../domain/settings-registry.js';
import { SettingsValueInvalidError } from '../../domain/settings.errors.js';
import { SettingsService } from '../settings.service.js';

export interface UpdateSettingsCommand {
  values: Record<string, unknown>;
}

/**
 * HTTP-facing update. Besides delegating validation and persistence to the
 * service, it rejects settings flagged as `managed`: those are written by
 * their own module through `SettingsService.update` (e.g. the clinic module
 * owns `clinic.logo.version`).
 */
@Injectable()
export class UpdateSettingsUseCase implements UseCase<UpdateSettingsCommand, SettingOverview[]> {
  constructor(private readonly settings: SettingsService) {}

  async execute(command: UpdateSettingsCommand): Promise<SettingOverview[]> {
    this.assertNoManagedKeys(command.values);

    return this.settings.update(command.values);
  }

  private assertNoManagedKeys(values: Record<string, unknown>): void {
    const managedKeys = Object.keys(values).filter(
      (key) => findSettingDefinition(key)?.managed === true,
    );

    if (managedKeys.length > 0) {
      throw new SettingsValueInvalidError(
        managedKeys.map((key) => ({
          key,
          reason: 'is managed internally and cannot be edited',
        })),
      );
    }
  }
}
