import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { SettingOverview } from '../../domain/setting-definition.js';
import { SettingsService } from '../settings.service.js';

export interface UpdateSettingsCommand {
  values: Record<string, unknown>;
}

@Injectable()
export class UpdateSettingsUseCase implements UseCase<UpdateSettingsCommand, SettingOverview[]> {
  constructor(private readonly settings: SettingsService) {}

  async execute(command: UpdateSettingsCommand): Promise<SettingOverview[]> {
    return this.settings.update(command.values);
  }
}
