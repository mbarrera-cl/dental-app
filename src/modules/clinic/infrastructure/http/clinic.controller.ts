import { createHash } from 'node:crypto';
import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import { Public } from '../../../../shared/security/public.decorator.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { settingsPermissions } from '../../../settings/permissions.js';
import { MAX_UPLOAD_BYTES } from '../../domain/clinic-asset.js';
import { InvalidImageError } from '../../domain/clinic.errors.js';
import { GetAssetUseCase } from '../../application/use-cases/get-asset.use-case.js';
import { RemoveLogoUseCase } from '../../application/use-cases/remove-logo.use-case.js';
import { UploadLogoUseCase } from '../../application/use-cases/upload-logo.use-case.js';
import { ClinicBrandingResponseDto } from './dtos/clinic-branding.response.dto.js';
import { LogoUploadResponseDto } from './dtos/logo-upload.response.dto.js';
import { LogoVersionResponseDto } from './dtos/logo-version.response.dto.js';
import { CurrentClinic } from './current-clinic.decorator.js';
import type { ClinicBranding } from '../../domain/branding.js';

/**
 * Clinic identity endpoints. `GET /clinic/branding` and the asset stream are
 * `@Public()` on purpose: the login screen has to paint with the clinic's
 * face *before* anyone authenticates. Uploads and removal are configuration
 * and require `settings:update`.
 */
@ApiTags('clinic')
@Controller('clinic')
export class ClinicController {
  constructor(
    private readonly getAsset: GetAssetUseCase,
    private readonly uploadLogo: UploadLogoUseCase,
    private readonly removeLogo: RemoveLogoUseCase,
  ) {}

  @Get('branding')
  @Public()
  @ApiOperation({
    summary: 'Public branding (identity, colors, logo URLs) with ETag revalidation',
  })
  @ApiOkResponse({ type: ClinicBrandingResponseDto })
  async branding(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentClinic() branding: ClinicBranding,
  ): Promise<ClinicBrandingResponseDto> {
    const dto = ClinicBrandingResponseDto.fromBranding(branding);

    // Strong ETag over the exact payload; Express turns a matching
    // `If-None-Match` into a 304 with no body.
    response.setHeader('ETag', etagOf(dto));
    response.setHeader('Cache-Control', 'no-cache');

    return dto;
  }

  @Get('assets/:variant')
  @Public()
  @ApiOperation({ summary: 'Stream an active logo variant (immutable, hash in the URL)' })
  @ApiProduces('image/webp', 'image/png')
  @ApiOkResponse({ description: 'The image bytes.' })
  @ApiNotFoundResponse({ description: 'Unknown variant, or the clinic has no active logo.' })
  async asset(@Param('variant') variant: string, @Res() response: Response): Promise<void> {
    const asset = await this.getAsset.execute({ variant });

    response.setHeader('Content-Type', asset.mime);
    response.setHeader('Content-Length', String(asset.size));
    // The URL carries the asset hash, so the bytes behind it never change.
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(asset.bytes);
  }

  @Post('logo')
  @RequirePermissions(settingsPermissions.update)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }),
  )
  @ApiOperation({ summary: 'Upload a logo and generate every derived variant' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: LogoUploadResponseDto })
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<LogoUploadResponseDto> {
    if (file === undefined) {
      throw new InvalidImageError('no file was uploaded in the "file" field');
    }

    const logo = await this.uploadLogo.execute({
      bytes: file.buffer,
      actorId: principal.userId,
    });

    return LogoUploadResponseDto.fromUploaded(logo);
  }

  @Delete('logo')
  @RequirePermissions(settingsPermissions.update)
  @ApiOperation({ summary: 'Remove the current logo, rolling back to the previous version' })
  @ApiOkResponse({ type: LogoVersionResponseDto })
  async remove(): Promise<LogoVersionResponseDto> {
    const { version } = await this.removeLogo.execute();

    return LogoVersionResponseDto.fromVersion(version);
  }
}

function etagOf(payload: unknown): string {
  return `"${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}"`;
}
