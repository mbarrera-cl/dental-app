import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { SettingOverview, SettingValue } from '../../domain/setting-definition.js';
import type { SettingsAuditActor } from '../../domain/settings-audit.js';
import { diffSettingValues } from '../../domain/settings-audit.js';
import { findSettingDefinition } from '../../domain/settings-registry.js';
import { SettingsValueInvalidError } from '../../domain/settings.errors.js';
import { SettingsAuditService } from '../settings-audit.service.js';
import { SettingsService } from '../settings.service.js';

export interface UpdateSettingsCommand {
  values: Record<string, unknown>;
  /** Who is writing; omitted by internal callers that need no audit trail. */
  actor?: SettingsAuditActor;
}

/**
 * HTTP-facing update. Besides delegating validation and persistence to the
 * service, it rejects settings flagged as `managed`: those are written by
 * their own module through `SettingsService.update` (e.g. the clinic module
 * owns `clinic.logo.version`).
 *
 * When the caller identifies itself, the effective diff is appended to the
 * configuration audit trail (keys that actually moved, never no-ops).
 */
@Injectable()
export class UpdateSettingsUseCase implements UseCase<UpdateSettingsCommand, SettingOverview[]> {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: SettingsAuditService,
  ) {}

  async execute(command: UpdateSettingsCommand): Promise<SettingOverview[]> {
    this.assertNoManagedKeys(command.values);

    const before = await this.settings.overview();
    const after = await this.settings.update(command.values);

    if (command.actor !== undefined) {
      const keys = Object.keys(command.values);

      await this.audit.record(
        command.actor,
        diffSettingValues(pick(before, keys), pick(after, keys)),
      );
    }

    return after;
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

/** Effective values of `overview` for exactly `keys` (unknown keys drop out). */
function pick(
  overview: readonly SettingOverview[],
  keys: readonly string[],
): Record<string, SettingValue> {
  return Object.fromEntries(
    overview.filter((setting) => keys.includes(setting.key)).map((setting) => [
      setting.key,
      setting.value,
    ]),
  );
}
