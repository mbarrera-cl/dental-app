import { Injectable } from '@nestjs/common';
import { PostgresDatabase } from '../../../../../shared/infrastructure/database/postgres-database.js';
import type { ClinicAsset, ClinicAssetBlob } from '../../../domain/clinic-asset.js';
import type { LogoVariant } from '../../../domain/logo-variant.js';
import {
  ClinicAssetsRepositoryPort,
  type NewClinicAsset,
} from '../../../application/ports/clinic-assets-repository.port.js';

interface ClinicAssetRow {
  id: string;
  variant: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  hash: string;
  version: number;
  created_at: Date;
  created_by: string | null;
  bytes?: Buffer;
}

const METADATA_COLUMNS =
  'id, variant, mime, width, height, size, hash, version, active, created_at, created_by';

@Injectable()
export class PostgresClinicAssetsRepository extends ClinicAssetsRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async findActiveByVariant(variant: LogoVariant): Promise<ClinicAssetBlob | null> {
    const row = await this.db.queryOne<ClinicAssetRow>(
      `SELECT ${METADATA_COLUMNS}, bytes FROM clinic_assets
       WHERE variant = $1 AND active = TRUE
       ORDER BY version DESC LIMIT 1`,
      [variant],
    );

    return row === null ? null : { ...this.toMetadata(row), bytes: Buffer.from(row.bytes!) };
  }

  async listActive(): Promise<ClinicAsset[]> {
    const rows = await this.db.query<ClinicAssetRow>(
      `SELECT ${METADATA_COLUMNS} FROM clinic_assets WHERE active = TRUE`,
    );

    return rows.map((row) => this.toMetadata(row));
  }

  async latestVersionBelow(version: number): Promise<number | null> {
    const row = await this.db.queryOne<{ version: number | null }>(
      'SELECT MAX(version) AS version FROM clinic_assets WHERE version < $1',
      [version],
    );

    return row?.version === null || row?.version === undefined ? null : Number(row.version);
  }

  async saveVersion(assets: readonly NewClinicAsset[]): Promise<void> {
    await this.db.transaction(async (client) => {
      await client.query('UPDATE clinic_assets SET active = FALSE');

      for (const asset of assets) {
        await client.query(
          `INSERT INTO clinic_assets
             (id, variant, mime, width, height, bytes, size, hash, version, active, created_at, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $11)`,
          [
            asset.id,
            asset.variant,
            asset.mime,
            asset.width,
            asset.height,
            asset.bytes,
            asset.size,
            asset.hash,
            asset.version,
            asset.createdAt,
            asset.createdBy,
          ],
        );
      }
    });
  }

  async activateVersion(version: number): Promise<void> {
    await this.db.transaction(async (client) => {
      await client.query('UPDATE clinic_assets SET active = FALSE');
      await client.query('UPDATE clinic_assets SET active = TRUE WHERE version = $1', [version]);
    });
  }

  async deactivateAll(): Promise<void> {
    await this.db.execute('UPDATE clinic_assets SET active = FALSE');
  }

  private toMetadata(row: ClinicAssetRow): ClinicAsset {
    return {
      id: row.id,
      variant: row.variant as LogoVariant,
      mime: row.mime,
      width: Number(row.width),
      height: Number(row.height),
      size: Number(row.size),
      hash: row.hash,
      version: Number(row.version),
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,
    };
  }
}
