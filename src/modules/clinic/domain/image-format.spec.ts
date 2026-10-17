import { detectImageFormat } from './image-format.js';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

describe('detectImageFormat', () => {
  it('recognizes png by its signature', () => {
    expect(detectImageFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe(
      'png',
    );
  });

  it('recognizes jpeg by its signature', () => {
    expect(detectImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe('jpeg');
  });

  it('recognizes webp by its RIFF framing', () => {
    const header = [
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x00, 0x00, 0x00, // size
      0x57, 0x45, 0x42, 0x50, // "WEBP"
    ];

    expect(detectImageFormat(bytes(...header))).toBe('webp');
  });

  it('rejects svg and other text payloads', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    expect(detectImageFormat(svg)).toBeNull();
  });

  it('rejects gif — even though browsers render it — and unknown binaries', () => {
    const gif = new TextEncoder().encode('GIF89a............');

    expect(detectImageFormat(gif)).toBeNull();
    expect(detectImageFormat(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull();
  });

  it('rejects empty and too-short payloads without throwing', () => {
    expect(detectImageFormat(bytes())).toBeNull();
    expect(detectImageFormat(bytes(0x89, 0x50))).toBeNull();
    expect(detectImageFormat(bytes(0x52, 0x49, 0x46, 0x46))).toBeNull();
  });

  it('rejects a RIFF container that is not webp (e.g. wav)', () => {
    const wav = new TextEncoder().encode('RIFF....WAVE');

    expect(detectImageFormat(wav)).toBeNull();
  });
});
