/**
 * Quantized dominant-color extraction for the "use my logo colors" shortcut.
 * Pure over raw RGBA pixels (whatever the canvas produced), so it is testable
 * without a browser.
 */

export interface ColorSuggestion {
  /** `#rrggbb`, the average of the bucket. */
  readonly color: string;
  /** Share of the opaque, mid-tone pixels (0..1). */
  readonly weight: number;
}

/** Channels are bucketed in steps of 32: close shades count as one. */
const QUANT_STEP = 32;
const MIN_ALPHA = 125;
/** Near-white / near-black pixels are background, not brand. */
const LUMA_FLOOR = 24;
const LUMA_CEILING = 232;

export function dominantColors(pixels: Uint8ClampedArray, max = 5): ColorSuggestion[] {
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
  let total = 0;

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3]!;

    if (alpha < MIN_ALPHA) {
      continue;
    }

    const r = pixels[index]!;
    const g = pixels[index + 1]!;
    const b = pixels[index + 2]!;
    const luma = (r + g + b) / 3;

    if (luma < LUMA_FLOOR || luma > LUMA_CEILING) {
      continue;
    }

    const key = (quantize(r) << 16) | (quantize(g) << 8) | quantize(b);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };

    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count += 1;
    buckets.set(key, bucket);
    total += 1;
  }

  if (total === 0) {
    return [];
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
    .map((bucket) => ({
      color: hexOf(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count),
      weight: bucket.count / total,
    }));
}

function quantize(channel: number): number {
  return Math.floor(channel / QUANT_STEP);
}

function hexOf(r: number, g: number, b: number): string {
  const channel = (value: number): string =>
    Math.round(value).toString(16).padStart(2, '0');

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
