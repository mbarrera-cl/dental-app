export type ImageFormat = 'png' | 'jpeg' | 'webp';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] as const; // "RIFF"
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50] as const; // "WEBP"

/**
 * Detects the image format from its *magic bytes*, never from the declared
 * content type or the file extension. Only png, jpeg and webp are accepted:
 * svg (scriptable), gif and anything else fall through as `null`.
 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (matches(bytes, 0, PNG_SIGNATURE)) {
    return 'png';
  }

  if (matches(bytes, 0, JPEG_SIGNATURE)) {
    return 'jpeg';
  }

  // WebP is RIFF-framed: "RIFF" + 4-byte size + "WEBP".
  if (matches(bytes, 0, RIFF_SIGNATURE) && matches(bytes, 8, WEBP_TAG)) {
    return 'webp';
  }

  return null;
}

function matches(bytes: Uint8Array, offset: number, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}
