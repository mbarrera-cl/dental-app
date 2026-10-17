import type { ClinicAsset, ClinicAssetBlob } from '../../domain/clinic-asset.js';
import type { LogoVariant } from '../../domain/logo-variant.js';

/** A complete variant row, ready to be inserted as part of a new version. */
export interface NewClinicAsset {
  readonly id: string;
  readonly variant: LogoVariant;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly size: number;
  readonly hash: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly createdBy: string | null;
  readonly bytes: Buffer;
}

/**
 * Driven port over the `clinic_assets` table. Only one version is active at
 * any time; older versions stay in the table so `DELETE /clinic/logo` can
 * roll back to the previous one.
 */
export abstract class ClinicAssetsRepositoryPort {
  /** Active asset of one variant, blob included (used to stream it). */
  abstract findActiveByVariant(variant: LogoVariant): Promise<ClinicAssetBlob | null>;

  /** Metadata of every active asset (at most one per variant). */
  abstract listActive(): Promise<ClinicAsset[]>;

  /** Highest stored version below `version`, or `null` when there is none. */
  abstract latestVersionBelow(version: number): Promise<number | null>;

  /** Deactivates everything and inserts `assets` as the active version. */
  abstract saveVersion(assets: readonly NewClinicAsset[]): Promise<void>;

  /** Makes every asset of `version` the active set (rollback). */
  abstract activateVersion(version: number): Promise<void>;

  /** Leaves the clinic without logo assets. */
  abstract deactivateAll(): Promise<void>;
}
