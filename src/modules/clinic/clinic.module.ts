import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { ClinicAssetsRepositoryPort } from './application/ports/clinic-assets-repository.port.js';
import { ImageProcessorPort } from './application/ports/image-processor.port.js';
import { GetAssetUseCase } from './application/use-cases/get-asset.use-case.js';
import { GetBrandingUseCase } from './application/use-cases/get-branding.use-case.js';
import { RemoveLogoUseCase } from './application/use-cases/remove-logo.use-case.js';
import { UploadLogoUseCase } from './application/use-cases/upload-logo.use-case.js';
import { SharpImageProcessor } from './infrastructure/adapters/images/sharp-image-processor.js';
import { SqliteClinicAssetsRepository } from './infrastructure/adapters/persistence/sqlite-clinic-assets.repository.js';
import { ClinicContextInterceptor } from './infrastructure/http/clinic-context.interceptor.js';
import { ClinicController } from './infrastructure/http/clinic.controller.js';

/**
 * Composition root for the clinic identity. Identity and colors live in the
 * settings registry (hence `SettingsModule`); the logo blobs live in their
 * own table behind `ClinicAssetsRepositoryPort`. `sharp` stays behind
 * `ImageProcessorPort`, so swapping the image library touches one file.
 */
@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [ClinicController],
  providers: [
    GetBrandingUseCase,
    GetAssetUseCase,
    UploadLogoUseCase,
    RemoveLogoUseCase,
    { provide: ImageProcessorPort, useClass: SharpImageProcessor },
    { provide: ClinicAssetsRepositoryPort, useClass: SqliteClinicAssetsRepository },
    // Global on purpose: memoizes `req.clinic` for every request (one
    // projection per request, whatever route it is).
    { provide: APP_INTERCEPTOR, useClass: ClinicContextInterceptor },
  ],
})
export class ClinicModule {}
