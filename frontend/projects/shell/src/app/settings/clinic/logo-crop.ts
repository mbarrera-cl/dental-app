/**
 * Pure geometry of the logo crop dialog. The frame is fixed on screen
 * (square or wide) and the image moves and zooms *under* it. Everything here
 * works in viewport or image pixels — never on the DOM — so the maths stays
 * unit-testable and the component only wires pointer events to it.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface CropTransform {
  /** `1` = the image exactly covers the frame. */
  readonly zoom: number;
  /** Pan, in frame pixels. */
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** The unit crop: the whole frame, untouched. */
export const IDENTITY_TRANSFORM: CropTransform = { zoom: 1, offsetX: 0, offsetY: 0 };

/** Largest rect of `aspect` that fits inside `viewport`. */
export function cropFrame(viewport: Size, aspect: number): Size {
  const width = Math.min(viewport.width, viewport.height * aspect);

  return { width: Math.round(width), height: Math.round(width / aspect) };
}

/** Scale at which the image exactly covers the frame (`zoom = 1`). */
export function coverScale(image: Size, frame: Size): number {
  return Math.max(frame.width / image.width, frame.height / image.height);
}

/**
 * Applies the zoom bounds and pans only as far as the frame keeps showing
 * image (no blank corners).
 */
export function clampTransform(image: Size, frame: Size, transform: CropTransform): CropTransform {
  const zoom = clamp(transform.zoom, MIN_ZOOM, MAX_ZOOM);
  const scale = coverScale(image, frame) * zoom;
  const limitX = Math.max(0, (image.width * scale - frame.width) / 2);
  const limitY = Math.max(0, (image.height * scale - frame.height) / 2);

  return {
    zoom,
    offsetX: clamp(transform.offsetX, -limitX, limitX),
    offsetY: clamp(transform.offsetY, -limitY, limitY),
  };
}

/** Region of the source image (image pixels) currently inside the frame. */
export function computeCropRect(
  image: Size,
  frame: Size,
  transform: CropTransform,
): CropRect {
  const { zoom, offsetX, offsetY } = clampTransform(image, frame, transform);
  const scale = coverScale(image, frame) * zoom;
  const width = Math.min(image.width, Math.round(frame.width / scale));
  const height = Math.min(image.height, Math.round(frame.height / scale));
  const left = (frame.width - image.width * scale) / 2 + offsetX;
  const top = (frame.height - image.height * scale) / 2 + offsetY;

  return {
    x: clamp(Math.round(-left / scale), 0, image.width - width),
    y: clamp(Math.round(-top / scale), 0, image.height - height),
    width,
    height,
  };
}

/** Canvas size of the crop, downscaled so no side exceeds `maxSide`. */
export function outputSize(rect: CropRect, maxSide: number): Size {
  const scale = Math.min(1, maxSide / Math.max(rect.width, rect.height));

  return {
    width: Math.max(1, Math.round(rect.width * scale)),
    height: Math.max(1, Math.round(rect.height * scale)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
