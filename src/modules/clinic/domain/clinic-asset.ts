import type { LogoVariant } from './logo-variant.js';

/** Hard limits of the logo pipeline, enforced before sharp ever runs. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Longest accepted side of the source image, in pixels. */
export const MAX_IMAGE_DIMENSION = 4096;

/** sharp aborts before allocating more than this many pixels. */
export const MAX_INPUT_PIXELS = MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION;

/**
 * One stored derivative of an uploaded logo. Assets are immutable per
 * version: a new upload inserts a fresh set and deactivates the previous one.
 */
export interface ClinicAsset {
  readonly id: string;
  readonly variant: LogoVariant;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly size: number;
  /** sha256 of the blob: cache key in URLs and source of the branding ETag. */
  readonly hash: string;
  /** Logo generation this asset belongs to (matches `clinic.logo.version`). */
  readonly version: number;
  readonly createdAt: Date;
  readonly createdBy: string | null;
}

/** An asset together with its blob, ready to stream. */
export interface ClinicAssetBlob extends ClinicAsset {
  readonly bytes: Buffer;
}

/**
 * Public URL of an asset. The hash travel as a query parameter, so the URL
 * changes whenever the bytes do: assets can be cached immutably for a year.
 */
export function clinicAssetUrl(variant: LogoVariant, hash: string): string {
  return `/clinic/assets/${variant}?v=${hash}`;
}
