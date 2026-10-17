import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { ClinicAssetBlob } from '../../domain/clinic-asset.js';
import { ClinicAssetNotFoundError, UnknownVariantError } from '../../domain/clinic.errors.js';
import { isLogoVariant } from '../../domain/logo-variant.js';
import { ClinicAssetsRepositoryPort } from '../ports/clinic-assets-repository.port.js';

export interface GetAssetCommand {
  /** Raw `:variant` path parameter; validated here, not by the router. */
  variant: string;
}

/**
 * Streams one active logo variant. Unknown variants and a missing logo are
 * both 404s, but with different errors so clients can tell them apart.
 */
@Injectable()
export class GetAssetUseCase implements UseCase<GetAssetCommand, ClinicAssetBlob> {
  constructor(private readonly assets: ClinicAssetsRepositoryPort) {}

  async execute(command: GetAssetCommand): Promise<ClinicAssetBlob> {
    if (!isLogoVariant(command.variant)) {
      throw new UnknownVariantError(command.variant);
    }

    const asset = await this.assets.findActiveByVariant(command.variant);

    if (asset === null) {
      throw new ClinicAssetNotFoundError(command.variant);
    }

    return asset;
  }
}
