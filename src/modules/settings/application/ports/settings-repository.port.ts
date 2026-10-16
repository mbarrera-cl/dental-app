import type { SettingValue } from '../../domain/setting-definition.js';

/**
 * Driven port for settings persistence. Only values explicitly changed by an
 * administrator are stored; registry defaults fill the gaps.
 */
export abstract class SettingsRepositoryPort {
  abstract findAll(): Promise<Record<string, SettingValue>>;

  /** Upserts every given value atomically. */
  abstract saveMany(values: Record<string, SettingValue>): Promise<void>;
}
