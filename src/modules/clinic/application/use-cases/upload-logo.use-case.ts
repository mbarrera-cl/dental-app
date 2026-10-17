import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import {
  MAX_UPLOAD_BYTES,
  clinicAssetUrl,
} from '../../domain/clinic-asset.js';
import {
  ImageTooLargeError,
  InvalidImageError,
  UnsupportedImageFormatError,
} from '../../domain/clinic.errors.js';
import { detectImageFormat } from '../../domain/image-format.js';
import type { LogoVariant } from '../../domain/logo-variant.js';
import {
  ClinicAssetsRepositoryPort,
  type NewClinicAsset,
} from '../ports/clinic-assets-repository.port.js';
import { ImageProcessorPort } from '../ports/image-processor.port.js';

export interface UploadLogoCommand {
  /** Raw upload bytes (multipart field). */
  bytes: Buffer;
  actorId?: string | null;
}

export interface UploadedLogoVariant {
  readonly variant: LogoVariant;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly size: number;
  readonly hash: string;
  readonly url: string;
}

export interface UploadedLogo {
  readonly version: number;
  readonly variants: readonly UploadedLogoVariant[];
}

/**
 * Validates an uploaded logo (size, magic bytes, decodability), derives every
 * variant through the processor, stores them as a new version and bumps
 * `clinic.logo.version` — the setting that tells clients the logo changed and
 * that only this module is allowed to write.
 */
@Injectable()
export class UploadLogoUseCase implements UseCase<UploadLogoCommand, UploadedLogo> {
  constructor(
    private readonly settings: SettingsService,
    private readonly processor: ImageProcessorPort,
    private readonly assets: ClinicAssetsRepositoryPort,
  ) {}

  async execute(command: UploadLogoCommand): Promise<UploadedLogo> {
    const { bytes } = command;

    if (bytes.byteLength === 0) {
      throw new InvalidImageError('the file is empty');
    }

    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new ImageTooLargeError(bytes.byteLength, MAX_UPLOAD_BYTES);
    }

    if (detectImageFormat(bytes) === null) {
      throw new UnsupportedImageFormatError();
    }

    const processed = await this.processor.process(bytes);
    const version = (await this.settings.getNumber('clinic.logo.version')) + 1;
    const createdAt = new Date();

    const assets: NewClinicAsset[] = processed.map((variant) => {
      const hash = createHash('sha256').update(variant.bytes).digest('hex');

      return {
        id: randomUUID(),
        variant: variant.variant,
        mime: variant.mime,
        width: variant.width,
        height: variant.height,
        size: variant.bytes.byteLength,
        hash,
        version,
        createdAt,
        createdBy: command.actorId ?? null,
        bytes: variant.bytes,
      };
    });

    await this.assets.saveVersion(assets);
    await this.settings.update({ 'clinic.logo.version': version });

    return {
      version,
      variants: assets.map((asset) => ({
        variant: asset.variant,
        mime: asset.mime,
        width: asset.width,
        height: asset.height,
        size: asset.size,
        hash: asset.hash,
        url: clinicAssetUrl(asset.variant, asset.hash),
      })),
    };
  }
}
