import type { LogoVariant } from '../../domain/logo-variant.js';

/** One derived file produced by the processor, still without its hash. */
export interface ProcessedVariant {
  readonly variant: LogoVariant;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: Buffer;
}

/**
 * Driven port around the image library (sharp in production). Implementations
 * must strip metadata, derive every variant and reject anything that is not a
 * decodable raster image by throwing `InvalidImageError`.
 */
export abstract class ImageProcessorPort {
  abstract process(input: Buffer): Promise<readonly ProcessedVariant[]>;
}
