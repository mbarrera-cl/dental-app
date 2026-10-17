import type { SettingValue } from '../../../domain/setting-definition.js';
import { SettingsRepositoryPort } from '../../../application/ports/settings-repository.port.js';

/**
 * In-memory adapter used by unit tests. `stored` is exposed on purpose:
 * specs assert on what was persisted without going through the service.
 */
export class InMemorySettingsRepository extends SettingsRepositoryPort {
  readonly stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}
