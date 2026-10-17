import { DomainError, type DomainErrorKind } from '../../../shared/domain/domain-error.js';
import { LOGO_VARIANTS, type LogoVariant } from './logo-variant.js';

/** The bytes are not a decodable image, or exceed the size/dimension limits. */
export class InvalidImageError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`The uploaded logo is not a valid image: ${reason}`);
  }
}

/** The magic bytes do not match png/jpeg/webp (svg, gif and friends). */
export class UnsupportedImageFormatError extends DomainError {
  readonly kind: DomainErrorKind = 'unsupported_media';

  constructor() {
    super('The uploaded file is not a supported image: only png, jpeg and webp are accepted', {
      details: { accepted: ['png', 'jpeg', 'webp'] },
    });
  }
}

/** The file exceeds the 5 MB input limit. */
export class ImageTooLargeError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(bytes: number, maxBytes: number) {
    super(`The uploaded logo is ${bytes} bytes; the maximum is ${maxBytes}`, {
      details: { bytes, maxBytes },
    });
  }
}

/** `:variant` is not one of the four derived logo files. */
export class UnknownVariantError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(variant: string) {
    super(`Unknown logo variant "${variant}"`, {
      details: { variant, accepted: LOGO_VARIANTS },
    });
  }
}

/** The variant is known but the clinic has no active logo. */
export class ClinicAssetNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(variant: LogoVariant) {
    super(`There is no active "${variant}" asset`);
  }
}
