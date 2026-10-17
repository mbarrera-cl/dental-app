import { describe, expect, it } from 'vitest';
import {
  clampTransform,
  computeCropRect,
  coverScale,
  cropFrame,
  IDENTITY_TRANSFORM,
  outputSize,
} from './logo-crop';

const IMAGE = { width: 800, height: 400 };
const VIEWPORT = { width: 360, height: 240 };

describe('cropFrame', () => {
  it('fits the largest rect of the aspect inside the viewport', () => {
    expect(cropFrame(VIEWPORT, 1)).toEqual({ width: 240, height: 240 });
    expect(cropFrame(VIEWPORT, 16 / 9)).toEqual({ width: 360, height: 203 });
  });

  it('is limited by height on square viewports', () => {
    expect(cropFrame({ width: 240, height: 400 }, 2)).toEqual({ width: 240, height: 120 });
  });
});

describe('coverScale', () => {
  it('returns the smallest scale that covers the frame', () => {
    expect(coverScale({ width: 800, height: 400 }, { width: 200, height: 200 })).toBe(0.5);
    expect(coverScale({ width: 400, height: 800 }, { width: 200, height: 200 })).toBe(0.5);
  });
});

describe('clampTransform', () => {
  const frame = { width: 200, height: 200 };
  const image = { width: 400, height: 200 };

  it('bounds the zoom and centers when there is no slack', () => {
    expect(clampTransform(image, frame, { zoom: 0.5, offsetX: 0, offsetY: 0 })).toEqual({
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
    expect(clampTransform(image, frame, { zoom: 99, offsetX: 0, offsetY: 0 }).zoom).toBe(4);
  });

  it('pans only as far as the frame keeps showing image', () => {
    const clamped = clampTransform(image, frame, { zoom: 2, offsetX: 999, offsetY: -999 });

    // At zoom 2 the 400×200 image displays 800×400 px: 300 px of slack per side.
    expect(clamped.offsetX).toBe(300);
    expect(clamped.offsetY).toBe(-100);
  });
});

describe('computeCropRect', () => {
  const frame = { width: 300, height: 300 };

  it('crops the centred region at zoom 1', () => {
    const rect = computeCropRect(IMAGE, frame, IDENTITY_TRANSFORM);

    // 800×400 into a 300×300 frame: scale 0.75 → 400×400 of the full height…
    // but the image is only 400 tall, so the rect is horizontally centred.
    expect(rect).toEqual({ x: 200, y: 0, width: 400, height: 400 });
  });

  it('shrinks the rect as the zoom grows', () => {
    const rect = computeCropRect(IMAGE, frame, { zoom: 2, offsetX: 0, offsetY: 0 });

    expect(rect).toEqual({ x: 300, y: 100, width: 200, height: 200 });
  });

  it('follows the pan and stays inside the image', () => {
    const rect = computeCropRect(IMAGE, frame, { zoom: 4, offsetX: 999, offsetY: 999 });

    // The pan is clamped to (1050, 450): the crop hugs the image's bottom edge.
    expect(rect).toEqual({ x: 17, y: 0, width: 100, height: 100 });
    expect(rect.x + rect.width).toBeLessThanOrEqual(IMAGE.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(IMAGE.height);
  });
});

describe('outputSize', () => {
  it('keeps sizes that already fit', () => {
    expect(outputSize({ x: 0, y: 0, width: 400, height: 400 }, 1024)).toEqual({
      width: 400,
      height: 400,
    });
  });

  it('downscales the longest side to the limit', () => {
    expect(outputSize({ x: 0, y: 0, width: 3000, height: 1500 }, 1024)).toEqual({
      width: 1024,
      height: 512,
    });
  });
});
