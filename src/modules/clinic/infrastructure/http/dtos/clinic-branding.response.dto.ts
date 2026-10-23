import { ApiProperty } from '@nestjs/swagger';
import type { ClinicBranding } from '../../../domain/branding.js';

export class ClinicBrandingColorsDto {
  @ApiProperty({ example: '#0284c7' })
  primary: string;

  @ApiProperty({ example: '#f59e0b' })
  accent: string;

  @ApiProperty({ enum: ['light', 'auto'], example: 'auto' })
  mode: string;
}

/** Copy for the login brand panel; empty strings fall back to the UI language. */
export class ClinicBrandingLoginDto {
  @ApiProperty({ example: 'El día de tu clínica, en orden.' })
  headline: string;

  @ApiProperty({ example: 'Ficha, agenda y presupuestos conectados.' })
  body: string;

  @ApiProperty({ example: 'Ficha clínica y plan de tratamiento' })
  point1: string;

  @ApiProperty({ example: 'Agenda y presupuestos conectados' })
  point2: string;

  @ApiProperty({ example: 'Acceso seguro según tu rol' })
  point3: string;
}

/**
 * Public branding payload (`GET /clinic/branding`). The URLs carry the asset
 * hash, so clients can cache them forever: a new logo always ships new URLs
 * and a new `version`.
 */
export class ClinicBrandingResponseDto {
  @ApiProperty({ example: 'Clínica Los Andes' })
  name: string;

  @ApiProperty({ example: 'Odontología familiar en Providencia' })
  slogan: string;

  @ApiProperty({ example: '/clinic/assets/logo?v=9f2c…', nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: '/clinic/assets/favicon?v=1ab3…', nullable: true })
  faviconUrl: string | null;

  @ApiProperty({ type: ClinicBrandingColorsDto })
  colors: ClinicBrandingColorsDto;

  @ApiProperty({ type: ClinicBrandingLoginDto })
  login: ClinicBrandingLoginDto;

  @ApiProperty({ example: 3, description: 'Logo generation; 0 means no logo' })
  version: number;

  static fromBranding(branding: ClinicBranding): ClinicBrandingResponseDto {
    const dto = new ClinicBrandingResponseDto();
    dto.name = branding.name;
    dto.slogan = branding.slogan;
    dto.logoUrl = branding.logoUrl;
    dto.faviconUrl = branding.faviconUrl;
    dto.colors = {
      primary: branding.colors.primary,
      accent: branding.colors.accent,
      mode: branding.colors.mode,
    };
    dto.login = {
      headline: branding.login.headline,
      body: branding.login.body,
      point1: branding.login.point1,
      point2: branding.login.point2,
      point3: branding.login.point3,
    };
    dto.version = branding.version;
    return dto;
  }
}
