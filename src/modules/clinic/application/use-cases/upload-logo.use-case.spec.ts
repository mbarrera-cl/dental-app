import { SettingsService } from '../../../settings/application/settings.service.js';
import { InMemorySettingsRepository } from '../../../settings/infrastructure/adapters/persistence/in-memory-settings.repository.js';
import { MAX_UPLOAD_BYTES } from '../../domain/clinic-asset.js';
import {
  ImageTooLargeError,
  InvalidImageError,
  UnsupportedImageFormatError,
} from '../../domain/clinic.errors.js';
import { InMemoryClinicAssetsRepository } from '../../infrastructure/adapters/persistence/in-memory-clinic-assets.repository.js';
import {
  ImageProcessorPort,
  type ProcessedVariant,
} from '../ports/image-processor.port.js';
import { UploadLogoUseCase } from './upload-logo.use-case.js';

/** Smallest possible png: a valid 1x1 image. */
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

class FakeImageProcessor extends ImageProcessorPort {
  readonly calls: Buffer[] = [];
  readonly result: ProcessedVariant[] = [
    { variant: 'logo', mime: 'image/webp', width: 512, height: 256, bytes: Buffer.from('logo-bytes') },
    { variant: 'favicon', mime: 'image/png', width: 48, height: 48, bytes: Buffer.from('favicon-bytes') },
  ];

  async process(input: Buffer): Promise<readonly ProcessedVariant[]> {
    this.calls.push(input);
    return this.result;
  }
}

describe('UploadLogoUseCase', () => {
  const setup = () => {
    const settingsRepository = new InMemorySettingsRepository();
    const processor = new FakeImageProcessor();
    const assets = new InMemoryClinicAssetsRepository();

    return {
      settingsRepository,
      processor,
      assets,
      useCase: new UploadLogoUseCase(new SettingsService(settingsRepository), processor, assets),
    };
  };

  it('stores every variant as the new active version and bumps the setting', async () => {
    const { useCase, processor, assets, settingsRepository } = setup();

    const uploaded = await useCase.execute({ bytes: ONE_PIXEL_PNG, actorId: 'actor-1' });

    expect(uploaded.version).toBe(1);
    expect(processor.calls).toEqual([ONE_PIXEL_PNG]);
    expect(uploaded.variants.map((variant) => variant.variant)).toEqual(['logo', 'favicon']);

    const logo = uploaded.variants[0]!;
    expect(logo.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(logo.url).toBe(`/clinic/assets/logo?v=${logo.hash}`);

    const active = await assets.listActive();
    expect(active).toHaveLength(2);
    expect(active[0]).toMatchObject({ version: 1, createdBy: 'actor-1', size: 10, mime: 'image/webp' });
    expect(settingsRepository.stored['clinic.logo.version']).toBe(1);
  });

  it('increments the version and deactivates the previous set', async () => {
    const { useCase, assets } = setup();

    await useCase.execute({ bytes: ONE_PIXEL_PNG });
    const second = await useCase.execute({ bytes: ONE_PIXEL_PNG });

    expect(second.version).toBe(2);

    const active = await assets.listActive();
    expect(active).toHaveLength(2);
    expect(active.every((asset) => asset.version === 2)).toBe(true);
  });

  it('rejects empty, oversized and non-image payloads before processing', async () => {
    const { useCase, processor, assets } = setup();

    await expect(useCase.execute({ bytes: Buffer.alloc(0) })).rejects.toThrow(InvalidImageError);
    await expect(useCase.execute({ bytes: Buffer.alloc(MAX_UPLOAD_BYTES + 1) })).rejects.toThrow(
      ImageTooLargeError,
    );
    await expect(useCase.execute({ bytes: Buffer.from('<svg></svg>') })).rejects.toThrow(
      UnsupportedImageFormatError,
    );

    expect(processor.calls).toHaveLength(0);
    expect(await assets.listActive()).toHaveLength(0);
  });
});
