import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { SettingsService } from '../../../settings/application/settings.service.js';
import { clinicAssetUrl, type ClinicAsset } from '../../domain/clinic-asset.js';
import type { ClinicBranding } from '../../domain/branding.js';
import { ClinicAssetsRepositoryPort } from '../ports/clinic-assets-repository.port.js';

/**
 * Builds the public branding projection: identity and colors from the
 * settings registry plus the hashed URLs of the active logo. It reads the
 * service's in-memory cache, so it is cheap enough to hydrate once per
 * request (see `ClinicContextInterceptor`).
 */
@Injectable()
export class GetBrandingUseCase implements UseCase<void, ClinicBranding> {
  constructor(
    private readonly settings: SettingsService,
    private readonly assets: ClinicAssetsRepositoryPort,
  ) {}

  async execute(): Promise<ClinicBranding> {
    const [name, slogan, primary, accent, mode, version, active] = await Promise.all([
      this.settings.getValue('clinic.name'),
      this.settings.getValue('clinic.slogan'),
      this.settings.getValue('clinic.theme.primary'),
      this.settings.getValue('clinic.theme.accent'),
      this.settings.getValue('clinic.theme.mode'),
      this.settings.getValue('clinic.logo.version'),
      this.assets.listActive(),
    ]);

    const byVariant = new Map(active.map((asset) => [asset.variant, asset]));

    return {
      name: String(name),
      slogan: String(slogan),
      logoUrl: urlOf(byVariant.get('logo')),
      faviconUrl: urlOf(byVariant.get('favicon')),
      colors: {
        primary: String(primary),
        accent: String(accent),
        mode: String(mode),
      },
      version: Number(version),
    };
  }
}

function urlOf(asset: ClinicAsset | undefined): string | null {
  return asset === undefined ? null : clinicAssetUrl(asset.variant, asset.hash);
}
