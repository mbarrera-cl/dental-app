import sharp from 'sharp';
import { MAX_IMAGE_DIMENSION } from '../../../domain/clinic-asset.js';
import { InvalidImageError } from '../../../domain/clinic.errors.js';
import { SharpImageProcessor } from './sharp-image-processor.js';

const processor = new SharpImageProcessor();

const pngOf = (width: number, height: number): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 4, background: { r: 200, g: 30, b: 90, alpha: 1 } } })
    .png()
    .toBuffer();

describe('SharpImageProcessor', () => {
  it('derives the four variants with their formats and sizes', async () => {
    const variants = await processor.process(await pngOf(800, 400));
    const byVariant = new Map(variants.map((variant) => [variant.variant, variant]));

    expect([...byVariant.keys()].sort()).toEqual(['favicon', 'logo', 'print', 'square']);

    const logo = byVariant.get('logo')!;
    expect(logo.mime).toBe('image/webp');
    expect([logo.width, logo.height]).toEqual([512, 256]); // inside 512, keeps ratio

    const print = byVariant.get('print')!;
    expect(print.mime).toBe('image/webp');
    expect([print.width, print.height]).toEqual([800, 400]); // fits inside 1024 as-is

    const square = byVariant.get('square')!;
    expect(square.mime).toBe('image/webp');
    expect([square.width, square.height]).toEqual([256, 256]); // centered crop

    const favicon = byVariant.get('favicon')!;
    expect(favicon.mime).toBe('image/png');
    expect([favicon.width, favicon.height]).toEqual([48, 48]);
  });

  it('never upscales the banner variants but normalizes the icon squares', async () => {
    const variants = await processor.process(await pngOf(64, 32));
    const byVariant = new Map(variants.map((variant) => [variant.variant, variant]));

    expect([byVariant.get('logo')!.width, byVariant.get('logo')!.height]).toEqual([64, 32]);
    expect([byVariant.get('print')!.width, byVariant.get('print')!.height]).toEqual([64, 32]);
    expect([byVariant.get('square')!.width, byVariant.get('square')!.height]).toEqual([256, 256]);
    expect([byVariant.get('favicon')!.width, byVariant.get('favicon')!.height]).toEqual([48, 48]);
  });

  it('accepts jpeg input too', async () => {
    const jpeg = await sharp({
      create: { width: 300, height: 150, channels: 3, background: { r: 10, g: 90, b: 200 } },
    })
      .jpeg()
      .toBuffer();

    const variants = await processor.process(jpeg);

    expect(variants).toHaveLength(4);
    expect(variants.every((variant) => variant.bytes.byteLength > 0)).toBe(true);
  });

  it('applies the EXIF orientation and strips the metadata (incl. GPS)', async () => {
    // 60x120 pixels tagged "rotate 90°": the displayed image is 120x60.
    const rotated = await sharp({
      create: { width: 60, height: 120, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const variants = await processor.process(rotated);
    const logo = variants.find((variant) => variant.variant === 'logo')!;

    expect([logo.width, logo.height]).toEqual([120, 60]);

    const metadata = await sharp(logo.bytes).metadata();
    expect(metadata.exif).toBeUndefined();
  });

  it('rejects images wider than the maximum side', async () => {
    const wide = await pngOf(MAX_IMAGE_DIMENSION + 1, 10);

    await expect(processor.process(wide)).rejects.toThrow(InvalidImageError);
  });

  it('rejects payloads that cannot be decoded', async () => {
    await expect(processor.process(Buffer.from('definitely not an image'))).rejects.toThrow(
      InvalidImageError,
    );
  });
});
