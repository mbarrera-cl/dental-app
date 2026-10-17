import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
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
  created_at: string;
  created_by: string | null;
  bytes?: Uint8Array;
}

const METADATA_COLUMNS =
  'id, variant, mime, width, height, size, hash, version, active, created_at, created_by';

const INSERT_SQL = `
  INSERT INTO clinic_assets
    (id, variant, mime, width, height, bytes, size, hash, version, active, created_at, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
`;

/**
 * Driven adapter backed by SQLite. The `active` flag marks the current
 * version's assets; old versions stay in the table (blobs included) so
 * `DELETE /clinic/logo` can roll back without re-processing anything.
 */
@Injectable()
export class SqliteClinicAssetsRepository extends ClinicAssetsRepositoryPort {
  constructor(private readonly database: SqliteDatabase) {
    super();
  }

  async findActiveByVariant(variant: LogoVariant): Promise<ClinicAssetBlob | null> {
    const row = this.database.connection
      .prepare(
        `SELECT ${METADATA_COLUMNS}, bytes FROM clinic_assets
         WHERE variant = ? AND active = 1
         ORDER BY version DESC LIMIT 1`,
      )
      .get(variant) as unknown as ClinicAssetRow | undefined;

    return row === undefined ? null : { ...this.toMetadata(row), bytes: Buffer.from(row.bytes!) };
  }

  async listActive(): Promise<ClinicAsset[]> {
    const rows = this.database.connection
      .prepare(`SELECT ${METADATA_COLUMNS} FROM clinic_assets WHERE active = 1`)
      .all() as unknown as ClinicAssetRow[];

    return rows.map((row) => this.toMetadata(row));
  }

  async latestVersionBelow(version: number): Promise<number | null> {
    const row = this.database.connection
      .prepare('SELECT MAX(version) AS version FROM clinic_assets WHERE version < ?')
      .get(version) as unknown as { version: number | null };

    return row.version === null ? null : Number(row.version);
  }

  async saveVersion(assets: readonly NewClinicAsset[]): Promise<void> {
    const insert = this.database.connection.prepare(INSERT_SQL);

    this.transaction(() => {
      this.database.connection.prepare('UPDATE clinic_assets SET active = 0').run();

      for (const asset of assets) {
        insert.run(
          asset.id,
          asset.variant,
          asset.mime,
          asset.width,
          asset.height,
          asset.bytes,
          asset.size,
          asset.hash,
          asset.version,
          asset.createdAt.toISOString(),
          asset.createdBy,
        );
      }
    });
  }

  async activateVersion(version: number): Promise<void> {
    this.transaction(() => {
      this.database.connection.prepare('UPDATE clinic_assets SET active = 0').run();
      this.database.connection
        .prepare('UPDATE clinic_assets SET active = 1 WHERE version = ?')
        .run(version);
    });
  }

  async deactivateAll(): Promise<void> {
    this.database.connection.prepare('UPDATE clinic_assets SET active = 0').run();
  }

  private transaction<T>(work: () => T): T {
    this.database.connection.exec('BEGIN');

    try {
      const result = work();
      this.database.connection.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.connection.exec('ROLLBACK');
      throw error;
    }
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
