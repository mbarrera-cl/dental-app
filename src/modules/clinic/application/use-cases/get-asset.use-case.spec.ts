import type { NewClinicAsset } from '../ports/clinic-assets-repository.port.js';
import { ClinicAssetNotFoundError, UnknownVariantError } from '../../domain/clinic.errors.js';
import { InMemoryClinicAssetsRepository } from '../../infrastructure/adapters/persistence/in-memory-clinic-assets.repository.js';
import { GetAssetUseCase } from './get-asset.use-case.js';

const logoAsset: NewClinicAsset = {
  id: 'logo-1',
  variant: 'logo',
  mime: 'image/webp',
  width: 512,
  height: 256,
  size: 7,
  hash: 'logo-hash',
  version: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: null,
  bytes: Buffer.from('bytes!!'),
};

describe('GetAssetUseCase', () => {
  const setup = async () => {
    const assets = new InMemoryClinicAssetsRepository();
    await assets.saveVersion([logoAsset]);

    return { useCase: new GetAssetUseCase(assets) };
  };

  it('returns the active blob of a known variant', async () => {
    const { useCase } = await setup();

    const asset = await useCase.execute({ variant: 'logo' });

    expect(asset).toMatchObject({
      variant: 'logo',
      mime: 'image/webp',
      size: 7,
      hash: 'logo-hash',
      version: 1,
    });
    expect(asset.bytes.toString()).toBe('bytes!!');
  });

  it('rejects unknown variants with a not-found error', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute({ variant: 'banner' })).rejects.toThrow(UnknownVariantError);
  });

  it('reports a known variant without an active asset', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute({ variant: 'favicon' })).rejects.toThrow(
      ClinicAssetNotFoundError,
    );
  });
});
