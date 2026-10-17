import { Injectable } from '@nestjs/common';
import sharp, { type Metadata } from 'sharp';
import {
  MAX_IMAGE_DIMENSION,
  MAX_INPUT_PIXELS,
} from '../../../domain/clinic-asset.js';
import { InvalidImageError } from '../../../domain/clinic.errors.js';
import type { LogoVariant } from '../../../domain/logo-variant.js';
import type { ProcessedVariant } from '../../../application/ports/image-processor.port.js';
import { ImageProcessorPort } from '../../../application/ports/image-processor.port.js';

interface VariantRecipe {
  readonly variant: LogoVariant;
  readonly width: number;
  readonly height: number;
  readonly fit: 'inside' | 'cover';
  readonly format: 'webp' | 'png';
  /** Icon variants are normalized to an exact square; banner-like ones keep ratio. */
  readonly withoutEnlargement: boolean;
}

/**
 * Derived files, in generation order. `logo`/`print` are banners (fit inside,
 * never upscaled); `square`/`favicon` are centered crops at an exact size.
 */
const VARIANT_RECIPES: readonly VariantRecipe[] = [
  { variant: 'logo', width: 512, height: 512, fit: 'inside', format: 'webp', withoutEnlargement: true },
  { variant: 'print', width: 1024, height: 1024, fit: 'inside', format: 'webp', withoutEnlargement: true },
  { variant: 'square', width: 256, height: 256, fit: 'cover', format: 'webp', withoutEnlargement: false },
  { variant: 'favicon', width: 48, height: 48, fit: 'cover', format: 'png', withoutEnlargement: false },
];

const MIME_BY_FORMAT = { webp: 'image/webp', png: 'image/png' } as const;

/**
 * sharp-based image pipeline. `limitInputPixels` makes sharp abort before
 * allocating a decompression bomb; EXIF rotation is applied and the metadata
 * (including GPS) is dropped because sharp only keeps it on `.withMetadata()`.
 */
@Injectable()
export class SharpImageProcessor extends ImageProcessorPort {
  async process(input: Buffer): Promise<readonly ProcessedVariant[]> {
    const metadata = await this.readMetadata(input);

    if ((metadata.pages ?? 1) > 1) {
      throw new InvalidImageError('animated images are not supported');
    }

    if (metadata.width < 1 || metadata.height < 1) {
      throw new InvalidImageError('the image declares no dimensions');
    }

    if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
      throw new InvalidImageError(
        `the image is ${metadata.width}x${metadata.height}; the maximum side is ${MAX_IMAGE_DIMENSION} px`,
      );
    }

    return Promise.all(VARIANT_RECIPES.map((recipe) => this.render(input, recipe)));
  }

  private async readMetadata(input: Buffer): Promise<Metadata> {
    try {
      return await sharp(input, {
        limitInputPixels: MAX_INPUT_PIXELS,
        animated: false,
      }).metadata();
    } catch {
      throw new InvalidImageError('the file could not be decoded as an image');
    }
  }

  private async render(input: Buffer, recipe: VariantRecipe): Promise<ProcessedVariant> {
    try {
      // `.rotate()` applies the EXIF orientation *before* the metadata is
      // stripped, so a photo taken sideways still lands upright.
      const pipeline = sharp(input, {
        limitInputPixels: MAX_INPUT_PIXELS,
        animated: false,
      })
        .rotate()
        .resize({
          width: recipe.width,
          height: recipe.height,
          fit: recipe.fit,
          withoutEnlargement: recipe.withoutEnlargement,
        });

      const { data, info } =
        recipe.format === 'png'
          ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
          : await pipeline.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });

      return {
        variant: recipe.variant,
        mime: MIME_BY_FORMAT[recipe.format],
        width: info.width,
        height: info.height,
        bytes: data,
      };
    } catch (error) {
      if (error instanceof InvalidImageError) {
        throw error;
      }

      throw new InvalidImageError(`the "${recipe.variant}" variant could not be rendered`);
    }
  }
}
