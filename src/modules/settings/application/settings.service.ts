import { Injectable } from '@nestjs/common';
import type { SettingOverview, SettingValue } from '../domain/setting-definition.js';
import {
  SETTING_DEFINITIONS,
  findSettingDefinition,
  mergeSettingValues,
  validateSettingValue,
} from '../domain/settings-registry.js';
import {
  EmptySettingsUpdateError,
  SettingsUnknownKeyError,
  SettingsValueInvalidError,
  type SettingProblem,
} from '../domain/settings.errors.js';
import { SettingsRepositoryPort } from './ports/settings-repository.port.js';

/**
 * Single access point to configuration: other contexts inject this service
 * (never the repository) and read typed values from it. Stored values are
 * cached in memory and the cache is invalidated on every update, so changes
 * made from the panel apply immediately everywhere.
 */
@Injectable()
export class SettingsService {
  private stored: Record<string, SettingValue> | null = null;

  constructor(private readonly repository: SettingsRepositoryPort) {}

  /** Every definition merged with its effective value, in registry order. */
  async overview(): Promise<SettingOverview[]> {
    const stored = await this.storedValues();

    return SETTING_DEFINITIONS.map((definition) => ({
      ...definition,
      value: stored[definition.key] ?? definition.default,
    }));
  }

  async getValue(key: string): Promise<SettingValue> {
    const definition = findSettingDefinition(key);

    if (definition === undefined) {
      throw new SettingsUnknownKeyError([key]);
    }

    const stored = await this.storedValues();

    return stored[key] ?? definition.default;
  }

  /** Typed getter for code that knows the setting is numeric (e.g. TTLs). */
  async getNumber(key: string): Promise<number> {
    const value = await this.getValue(key);

    if (typeof value !== 'number') {
      throw new Error(`Setting "${key}" is not a number`);
    }

    return value;
  }

  /** Typed getter for code that knows the setting is a boolean toggle. */
  async getBoolean(key: string): Promise<boolean> {
    const value = await this.getValue(key);

    if (typeof value !== 'boolean') {
      throw new Error(`Setting "${key}" is not a boolean`);
    }

    return value;
  }

  /**
   * Validates every provided value against the registry (all-or-nothing),
   * persists them and returns the fresh overview.
   */
  async update(values: Readonly<Record<string, unknown>>): Promise<SettingOverview[]> {
    const entries = Object.entries(values);

    if (entries.length === 0) {
      throw new EmptySettingsUpdateError();
    }

    const unknownKeys = entries
      .map(([key]) => key)
      .filter((key) => findSettingDefinition(key) === undefined);

    if (unknownKeys.length > 0) {
      throw new SettingsUnknownKeyError(unknownKeys);
    }

    const problems: SettingProblem[] = [];

    for (const [key, value] of entries) {
      const reason = validateSettingValue(findSettingDefinition(key)!, value);

      if (reason !== null) {
        problems.push({ key, reason });
      }
    }

    if (problems.length > 0) {
      throw new SettingsValueInvalidError(problems);
    }

    this.assertCrossFieldConsistency({
      ...(await this.storedValues()),
      ...(values as Record<string, SettingValue>),
    });

    await this.repository.saveMany(values as Record<string, SettingValue>);
    this.stored = null;

    return this.overview();
  }

  /** Rules that involve more than one setting are checked on the merged view. */
  private assertCrossFieldConsistency(values: Readonly<Record<string, SettingValue>>): void {
    const effective = mergeSettingValues(values);
    const minLength = effective['passwordPolicy.minLength'] as number;
    const maxLength = effective['passwordPolicy.maxLength'] as number;

    if (minLength > maxLength) {
      throw new SettingsValueInvalidError([
        {
          key: 'passwordPolicy.minLength',
          reason: `must be <= passwordPolicy.maxLength (${maxLength})`,
        },
      ]);
    }
  }

  private async storedValues(): Promise<Record<string, SettingValue>> {
    this.stored ??= await this.repository.findAll();

    return this.stored;
  }
}
