import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { SettingOverview } from '../../domain/setting-definition.js';
import type { SettingsAuditActor } from '../../domain/settings-audit.js';
import { parseSettingsImport } from '../../domain/settings-export.js';
import { UpdateSettingsUseCase } from './update-settings.use-case.js';

export interface ImportSettingsCommand {
  /** Raw request body: the exported envelope, or a bare `{ values }` object. */
  envelope: unknown;
  actor: SettingsAuditActor;
}

/**
 * Imports a configuration envelope. The shape is validated here and the
 * values go through the regular update path (registry validation,
 * managed-key rejection, audit trail, all-or-nothing).
 */
@Injectable()
export class ImportSettingsUseCase implements UseCase<ImportSettingsCommand, SettingOverview[]> {
  constructor(private readonly updateSettings: UpdateSettingsUseCase) {}

  async execute(command: ImportSettingsCommand): Promise<SettingOverview[]> {
    const values = parseSettingsImport(command.envelope);

    return this.updateSettings.execute({ values, actor: command.actor });
  }
}
