import type { ClinicAsset, ClinicAssetBlob } from '../../../domain/clinic-asset.js';
import type { LogoVariant } from '../../../domain/logo-variant.js';
import {
  ClinicAssetsRepositoryPort,
  type NewClinicAsset,
} from '../../../application/ports/clinic-assets-repository.port.js';

interface StoredAsset extends ClinicAssetBlob {
  active: boolean;
}

/**
 * In-memory adapter used by unit tests. Mirrors the SQLite behaviour: at most
 * one active version, and every version stays queryable for rollbacks.
 */
export class InMemoryClinicAssetsRepository extends ClinicAssetsRepositoryPort {
  private rows: StoredAsset[] = [];

  async findActiveByVariant(variant: LogoVariant): Promise<ClinicAssetBlob | null> {
    return this.rows.find((asset) => asset.variant === variant && asset.active) ?? null;
  }

  async listActive(): Promise<ClinicAsset[]> {
    return this.rows.filter((asset) => asset.active);
  }

  async latestVersionBelow(version: number): Promise<number | null> {
    const versions = this.rows
      .map((asset) => asset.version)
      .filter((storedVersion) => storedVersion < version);

    return versions.length === 0 ? null : Math.max(...versions);
  }

  async saveVersion(assets: readonly NewClinicAsset[]): Promise<void> {
    for (const asset of this.rows) {
      asset.active = false;
    }

    this.rows.push(...assets.map((asset) => ({ ...asset, active: true })));
  }

  async activateVersion(version: number): Promise<void> {
    for (const asset of this.rows) {
      asset.active = asset.version === version;
    }
  }

  async deactivateAll(): Promise<void> {
    for (const asset of this.rows) {
      asset.active = false;
    }
  }
}
