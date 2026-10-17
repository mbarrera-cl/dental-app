import { ApiProperty } from '@nestjs/swagger';
import type {
  UploadedLogo,
  UploadedLogoVariant,
} from '../../../application/use-cases/upload-logo.use-case.js';

export class LogoUploadVariantDto {
  @ApiProperty({ enum: ['logo', 'square', 'favicon', 'print'], example: 'logo' })
  variant: string;

  @ApiProperty({ example: 'image/webp' })
  mime: string;

  @ApiProperty({ example: 512 })
  width: number;

  @ApiProperty({ example: 256 })
  height: number;

  @ApiProperty({ example: 18452, description: 'Encoded size in bytes' })
  size: number;

  @ApiProperty({ example: '9f2c…', description: 'sha256 of the blob' })
  hash: string;

  @ApiProperty({ example: '/clinic/assets/logo?v=9f2c…' })
  url: string;
}

/** Answer of `POST /clinic/logo`: the new version and its derived files. */
export class LogoUploadResponseDto {
  @ApiProperty({ example: 3 })
  version: number;

  @ApiProperty({ type: [LogoUploadVariantDto] })
  variants: LogoUploadVariantDto[];

  static fromUploaded(logo: UploadedLogo): LogoUploadResponseDto {
    const dto = new LogoUploadResponseDto();
    dto.version = logo.version;
    dto.variants = logo.variants.map((variant) => LogoUploadResponseDto.variantOf(variant));
    return dto;
  }

  private static variantOf(variant: UploadedLogoVariant): LogoUploadVariantDto {
    const dto = new LogoUploadVariantDto();
    dto.variant = variant.variant;
    dto.mime = variant.mime;
    dto.width = variant.width;
    dto.height = variant.height;
    dto.size = variant.size;
    dto.hash = variant.hash;
    dto.url = variant.url;
    return dto;
  }
}
