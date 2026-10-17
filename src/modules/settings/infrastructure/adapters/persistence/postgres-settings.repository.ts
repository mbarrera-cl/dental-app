import { Injectable } from '@nestjs/common';
import { PostgresDatabase } from '../../../../../shared/infrastructure/database/postgres-database.js';
import { SettingsRepositoryPort } from '../../../application/ports/settings-repository.port.js';
import type { SettingValue } from '../../../domain/setting-definition.js';

interface SettingRow {
  key: string;
  value: SettingValue;
}

@Injectable()
export class PostgresSettingsRepository extends SettingsRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async findAll(): Promise<Record<string, SettingValue>> {
    const rows = await this.db.query<SettingRow>('SELECT key, value FROM settings');
    const values: Record<string, SettingValue> = {};

    for (const row of rows) {
      values[row.key] = row.value;
    }

    return values;
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    await this.db.transaction(async (client) => {
      for (const [key, value] of Object.entries(values)) {
        await client.query(
          `INSERT INTO settings (key, value, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
          [key, JSON.stringify(value)],
        );
      }
    });
  }
}
