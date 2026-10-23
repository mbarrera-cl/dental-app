import { describe, expect, it } from 'vitest';
import type { ClinicBranding } from '../../../domain/branding.js';
import { ClinicBrandingResponseDto } from './clinic-branding.response.dto.js';

describe('ClinicBrandingResponseDto', () => {
  it('maps every public field, including the configurable login copy', () => {
    const branding: ClinicBranding = {
      name: 'Clínica Los Andes',
      slogan: 'Odontología familiar',
      logoUrl: '/clinic/assets/logo?v=logo-hash',
      faviconUrl: '/clinic/assets/favicon?v=fav-hash',
      colors: { primary: '#0284c7', accent: '#f59e0b', mode: 'auto' },
      login: {
        heading: 'Entra a Los Andes',
        lead: 'Tu equipo, en un solo lugar.',
        headline: 'Tu clínica, en orden.',
        body: 'Ficha, agenda y presupuestos conectados.',
        point1: 'Ficha clínica',
        point2: 'Agenda',
        point3: 'Acceso por rol',
      },
      version: 3,
    };

    expect(ClinicBrandingResponseDto.fromBranding(branding)).toEqual({
      name: 'Clínica Los Andes',
      slogan: 'Odontología familiar',
      logoUrl: '/clinic/assets/logo?v=logo-hash',
      faviconUrl: '/clinic/assets/favicon?v=fav-hash',
      colors: { primary: '#0284c7', accent: '#f59e0b', mode: 'auto' },
      login: {
        heading: 'Entra a Los Andes',
        lead: 'Tu equipo, en un solo lugar.',
        headline: 'Tu clínica, en orden.',
        body: 'Ficha, agenda y presupuestos conectados.',
        point1: 'Ficha clínica',
        point2: 'Agenda',
        point3: 'Acceso por rol',
      },
      version: 3,
    });
  });
});
