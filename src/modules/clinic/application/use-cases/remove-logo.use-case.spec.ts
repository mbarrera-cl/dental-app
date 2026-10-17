import { SettingsService } from '../../../settings/application/settings.service.js';
import { InMemorySettingsRepository } from '../../../settings/infrastructure/adapters/persistence/in-memory-settings.repository.js';
import type { NewClinicAsset } from '../ports/clinic-assets-repository.port.js';
import type { LogoVariant } from '../../domain/logo-variant.js';
import { InMemoryClinicAssetsRepository } from '../../infrastructure/adapters/persistence/in-memory-clinic-assets.repository.js';
import { RemoveLogoUseCase } from './remove-logo.use-case.js';

const asset = (variant: LogoVariant, version: number): NewClinicAsset => ({
  id: `${version}-${variant}`,
  variant,
  mime: 'image/webp',
  width: 10,
  height: 10,
  size: 5,
  hash: `hash-${version}-${variant}`,
  version,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: null,
  bytes: Buffer.from('bytes'),
});

describe('RemoveLogoUseCase', () => {
  const setup = () => {
    const settingsRepository = new InMemorySettingsRepository();
    const settings = new SettingsService(settingsRepository);
    const assets = new InMemoryClinicAssetsRepository();

    return {
      settingsRepository,
      settings,
      assets,
      useCase: new RemoveLogoUseCase(settings, assets),
    };
  };

  it('rolls back to the previous version when there is one', async () => {
    const { useCase, settings, assets, settingsRepository } = setup();
    await assets.saveVersion([asset('logo', 1)]);
    await assets.saveVersion([asset('logo', 2)]);
    await settings.update({ 'clinic.logo.version': 2 });

    const removed = await useCase.execute();

    expect(removed.version).toBe(1);
    expect(settingsRepository.stored['clinic.logo.version']).toBe(1);
    expect((await assets.listActive()).map((stored) => stored.hash)).toEqual(['hash-1-logo']);
  });

  it('leaves the clinic without logo when no previous version exists', async () => {
    const { useCase, settings, assets, settingsRepository } = setup();
    await assets.saveVersion([asset('logo', 1), asset('favicon', 1)]);
    await settings.update({ 'clinic.logo.version': 1 });

    const removed = await useCase.execute();

    expect(removed.version).toBe(0);
    expect(settingsRepository.stored['clinic.logo.version']).toBe(0);
    expect(await assets.listActive()).toHaveLength(0);
  });

  it('is a no-op when the clinic has no logo', async () => {
    const { useCase, settingsRepository } = setup();

    await expect(useCase.execute()).resolves.toEqual({ version: 0 });
    expect(settingsRepository.stored).toEqual({});
  });
});
