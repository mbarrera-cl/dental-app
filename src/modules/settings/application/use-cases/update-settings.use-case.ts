import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { SettingOverview, SettingValue } from '../../domain/setting-definition.js';
import type { SettingsAuditActor } from '../../domain/settings-audit.js';
import { diffSettingValues } from '../../domain/settings-audit.js';
import { findSettingDefinition } from '../../domain/settings-registry.js';
import { SettingsSecurityUpdateForbiddenError, SettingsValueInvalidError } from '../../domain/settings.errors.js';
import { SettingsAuditService } from '../settings-audit.service.js';
import { SettingsService } from '../settings.service.js';

export interface UpdateSettingsCommand {
  values: Record<string, unknown>;
  /** Who is writing; omitted by internal callers that need no audit trail. */
  actor?: SettingsAuditActor;
  /**
   * Whether the caller may change `security`-sensitive settings
   * (`settings:update-security`). Defaults to false: internal callers keep
   * writing their own operational keys, and the HTTP boundary passes the
   * principal's effective permission.
   */
  securityGranted?: boolean;
}

/**
 * HTTP-facing update. Besides delegating validation and persistence to the
 * service, it rejects settings flagged as `managed`: those are written by
 * their own module through `SettingsService.update` (e.g. the clinic module
 * owns `clinic.logo.version`). It also gates `security`-sensitive settings
 * behind `securityGranted`.
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
    this.assertSecurityGranted(command.values, command.securityGranted ?? false);

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

  private assertSecurityGranted(values: Record<string, unknown>, granted: boolean): void {
    if (granted) {
      return;
    }

    const securityKeys = Object.keys(values).filter(
      (key) => findSettingDefinition(key)?.sensitivity === 'security',
    );

    if (securityKeys.length > 0) {
      throw new SettingsSecurityUpdateForbiddenError(securityKeys);
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
