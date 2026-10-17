import { describe, expect, it } from 'vitest';
import { dominantColors } from './logo-colors';

const rgba = (pixels: readonly (readonly number[])[]): Uint8ClampedArray =>
  Uint8ClampedArray.from(pixels.flat());

const RED = [220, 40, 40, 255];
const RED_NEAR = [210, 50, 45, 255];
const BLUE = [30, 60, 200, 255];
const WHITE = [250, 250, 250, 255];
const BLACK = [5, 5, 5, 255];
const TRANSPARENT = [220, 40, 40, 0];

describe('dominantColors', () => {
  it('returns the most frequent bucket first, averaging close shades', () => {
    const colors = dominantColors(rgba([RED, RED_NEAR, BLUE]));

    expect(colors).toHaveLength(2);
    expect(colors[0]!.color).toBe('#d72d2b');
    expect(colors[0]!.weight).toBeCloseTo(2 / 3, 5);
    expect(colors[1]!.color).toBe('#1e3cc8');
  });

  it('ignores transparent, near-white and near-black pixels', () => {
    expect(dominantColors(rgba([TRANSPARENT, WHITE, BLACK]))).toEqual([]);
  });

  it('caps the number of suggestions', () => {
    const colors = dominantColors(
      rgba([RED, [30, 60, 200, 255], [40, 180, 80, 255], [200, 200, 40, 255], [120, 40, 160, 255]]),
      2,
    );

    expect(colors).toHaveLength(2);
  });
});
