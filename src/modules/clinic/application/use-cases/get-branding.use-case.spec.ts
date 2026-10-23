import { SettingsService } from '../../../settings/application/settings.service.js';
import { InMemorySettingsRepository } from '../../../settings/infrastructure/adapters/persistence/in-memory-settings.repository.js';
import { InMemoryClinicAssetsRepository } from '../../infrastructure/adapters/persistence/in-memory-clinic-assets.repository.js';
import type { NewClinicAsset } from '../ports/clinic-assets-repository.port.js';
import type { LogoVariant } from '../../domain/logo-variant.js';
import { GetBrandingUseCase } from './get-branding.use-case.js';

const asset = (variant: LogoVariant, version: number, hash: string): NewClinicAsset => ({
  id: `${version}-${variant}`,
  variant,
  mime: 'image/webp',
  width: 10,
  height: 10,
  size: 5,
  hash,
  version,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: null,
  bytes: Buffer.from('bytes'),
});

describe('GetBrandingUseCase', () => {
  const setup = () => {
    const settings = new SettingsService(new InMemorySettingsRepository());
    const assets = new InMemoryClinicAssetsRepository();

    return { settings, assets, useCase: new GetBrandingUseCase(settings, assets) };
  };

  it('projects the registry defaults with no logo', async () => {
    const { useCase } = setup();

    await expect(useCase.execute()).resolves.toEqual({
      name: 'Mi clínica',
      slogan: '',
      logoUrl: null,
      faviconUrl: null,
      colors: { primary: '#0284c7', accent: '#f59e0b', mode: 'auto' },
      login: {
        heading: '',
        lead: '',
        headline: '',
        body: '',
        point1: '',
        point2: '',
        point3: '',
      },
      version: 0,
    });
  });

  it('reflects the configured identity, colors and active assets', async () => {
    const { useCase, settings, assets } = setup();
    await settings.update({
      'clinic.name': 'Clínica Los Andes',
      'clinic.slogan': 'Odontología familiar',
      'clinic.theme.primary': '#112233',
      'clinic.theme.mode': 'light',
      'clinic.login.heading': 'Entra a Los Andes',
      'clinic.login.lead': 'Tu equipo, en un solo lugar.',
      'clinic.login.headline': 'Tu clínica, en orden.',
      'clinic.login.body': 'Ficha y agenda conectadas.',
      'clinic.login.point1': 'Ficha clínica',
      'clinic.login.point2': 'Agenda',
      'clinic.login.point3': 'Acceso por rol',
    });
    await assets.saveVersion([asset('logo', 4, 'logo-hash'), asset('favicon', 4, 'fav-hash')]);
    await settings.update({ 'clinic.logo.version': 4 });

    await expect(useCase.execute()).resolves.toEqual({
      name: 'Clínica Los Andes',
      slogan: 'Odontología familiar',
      logoUrl: '/clinic/assets/logo?v=logo-hash',
      faviconUrl: '/clinic/assets/favicon?v=fav-hash',
      colors: { primary: '#112233', accent: '#f59e0b', mode: 'light' },
      login: {
        heading: 'Entra a Los Andes',
        lead: 'Tu equipo, en un solo lugar.',
        headline: 'Tu clínica, en orden.',
        body: 'Ficha y agenda conectadas.',
        point1: 'Ficha clínica',
        point2: 'Agenda',
        point3: 'Acceso por rol',
      },
      version: 4,
    });
  });
});
