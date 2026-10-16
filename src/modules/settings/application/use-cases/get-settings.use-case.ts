import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { SettingOverview } from '../../domain/setting-definition.js';
import { SettingsService } from '../settings.service.js';

@Injectable()
export class GetSettingsUseCase implements UseCase<void, SettingOverview[]> {
  constructor(private readonly settings: SettingsService) {}

  async execute(): Promise<SettingOverview[]> {
    return this.settings.overview();
  }
}
