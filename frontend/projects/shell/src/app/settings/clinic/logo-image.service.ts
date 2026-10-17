import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { dominantColors, type ColorSuggestion } from './logo-colors';
import { outputSize, type CropRect } from './logo-crop';

/** A decoded image ready to be drawn: canvas + object-URL lifecycle. */
export interface PreparedImage {
  readonly element: HTMLImageElement;
  readonly width: number;
  readonly height: number;
  /** Object URL backing `element`; revoke it with `release`. */
  readonly objectUrl: string;
}

/** Longest side of the uploaded file after the client-side downscale. */
export const MAX_UPLOAD_SIDE = 1024;

/**
 * Canvas plumbing of the logo picker: decode picked files, render the chosen
 * crop, downscale, and sample the logo palette. The geometry lives in
 * `logo-crop` and `logo-colors` (pure, unit-tested); this service is the only
 * piece that touches `Image`/`<canvas>`, so the page can stub it in tests.
 */
@Injectable({ providedIn: 'root' })
export class LogoImageService {
  private readonly document = inject(DOCUMENT);

  /** Decodes a blob into a drawable image and keeps its object URL. */
  prepare(file: Blob): Promise<PreparedImage> {
    const view = this.document.defaultView ?? window;
    const objectUrl = view.URL.createObjectURL(file);
    const element = this.document.createElement('img');

    return new Promise<PreparedImage>((resolve, reject) => {
      element.onload = () => {
        resolve({
          element,
          width: element.naturalWidth,
          height: element.naturalHeight,
          objectUrl,
        });
      };
      element.onerror = () => {
        view.URL.revokeObjectURL(objectUrl);
        reject(new Error('The image could not be decoded'));
      };
      element.src = objectUrl;
    });
  }

  /** Revokes the object URL of a prepared image. */
  release(prepared: PreparedImage): void {
    (this.document.defaultView ?? window).URL.revokeObjectURL(prepared.objectUrl);
  }

  /** Renders `rect` (image pixels) to a file, downscaled to `maxSide`. */
  async renderCrop(
    prepared: PreparedImage,
    rect: CropRect,
    maxSide = MAX_UPLOAD_SIDE,
  ): Promise<File> {
    const size = outputSize(rect, maxSide);
    const canvas = this.createCanvas(size.width, size.height);
    const context = canvas.getContext('2d');

    if (context === null) {
      throw new Error('Canvas 2D is not available');
    }

    context.drawImage(
      prepared.element,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      size.width,
      size.height,
    );

    const blob = (await this.toBlob(canvas, 'image/webp', 0.9)) ?? (await this.toBlob(canvas, 'image/png'));

    if (blob === null) {
      throw new Error('The canvas could not be exported');
    }

    const extension = blob.type === 'image/png' ? 'png' : 'webp';

    return new File([blob], `logo.${extension}`, { type: blob.type });
  }

  /** Most frequent opaque, mid-tone colors of the image (best first). */
  suggestColors(prepared: PreparedImage, max = 5): ColorSuggestion[] {
    const canvas = this.createCanvas(48, 48);
    const context = canvas.getContext('2d');

    if (context === null) {
      return [];
    }

    context.drawImage(prepared.element, 0, 0, canvas.width, canvas.height);

    return dominantColors(context.getImageData(0, 0, canvas.width, canvas.height).data, max);
  }

  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = this.document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    return canvas;
  }

  private toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, type, quality);
    });
  }
}
