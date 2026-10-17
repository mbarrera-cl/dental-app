import { describe, expect, it } from 'vitest';
import { buildThemePalette, contrastRatio, luminance, toOklch, wcagLevel } from './theme-palette';

const oklchOf = (value: string): { l: number; c: number; h: number } => {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value);

  if (match === null) {
    throw new Error(`"${value}" is not an oklch() color`);
  }

  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
};

describe('contrastRatio', () => {
  it('spans the full WCAG range on black/white and is symmetric', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
  });

  it('matches the known ratio of mid grey on white', () => {
    expect(contrastRatio('#808080', '#ffffff')).toBeCloseTo(3.95, 2);
  });

  it('throws on colors that are not hex', () => {
    expect(() => contrastRatio('red', '#ffffff')).toThrow();
  });
});

describe('luminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 10);
  });
});

describe('wcagLevel', () => {
  it('classifies normal text', () => {
    expect(wcagLevel(7)).toBe('AAA');
    expect(wcagLevel(6.9)).toBe('AA');
    expect(wcagLevel(4.5)).toBe('AA');
    expect(wcagLevel(4.49)).toBe('fail');
  });

  it('classifies large text with the relaxed thresholds', () => {
    expect(wcagLevel(4.5, true)).toBe('AAA');
    expect(wcagLevel(3, true)).toBe('AA');
    expect(wcagLevel(2.99, true)).toBe('fail');
  });
});

describe('toOklch', () => {
  it('converts white, black and a known brand blue', () => {
    expect(toOklch('#ffffff')).toBe('oklch(1 0 0)');
    expect(toOklch('#000000')).toBe('oklch(0 0 0)');

    const sky = oklchOf(toOklch('#0284c7'));
    expect(sky.l).toBeCloseTo(0.588, 2);
    expect(sky.c).toBeCloseTo(0.139, 2);
    expect(sky.h).toBeCloseTo(242, 0);
  });

  it('accepts shorthand hex and rejects invalid colors', () => {
    expect(toOklch('#fff')).toBe('oklch(1 0 0)');
    expect(() => toOklch('#12345')).toThrow();
  });
});

describe('buildThemePalette', () => {
  it('derives the tokens from the seeds, with identical key sets per scheme', () => {
    const palette = buildThemePalette({ primary: '#0284c7', accent: '#f59e0b' });

    expect(palette.light['--primary']).toBe(toOklch('#0284c7'));
    expect(palette.light['--accent']).toBe(toOklch('#f59e0b'));
    expect(palette.light['--sidebar-primary']).toBe(palette.light['--primary']);
    expect(palette.light['--ring']).toBe(palette.light['--primary']);
    expect(Object.keys(palette.dark).sort()).toEqual(Object.keys(palette.light).sort());
  });

  it('picks the foreground by contrast: white on dark seeds, ink on light ones', () => {
    const dark = buildThemePalette({ primary: '#0f172a', accent: '#3b0764' });
    expect(dark.light['--primary-foreground']).toBe('#ffffff');
    expect(dark.primaryContrast).toBeGreaterThanOrEqual(4.5);

    const light = buildThemePalette({ primary: '#fef08a', accent: '#bae6fd' });
    expect(light.light['--primary-foreground']).toBe('#09090b');
    expect(light.primaryContrast).toBeGreaterThanOrEqual(4.5);
  });

  it('lightens the seeds for the dark scheme', () => {
    const palette = buildThemePalette({ primary: '#0284c7', accent: '#f59e0b' });

    expect(oklchOf(palette.dark['--primary']).l).toBeGreaterThan(
      oklchOf(palette.light['--primary']).l,
    );
    expect(oklchOf(palette.dark['--accent']).l).toBeGreaterThan(
      oklchOf(palette.light['--accent']).l,
    );
    expect(palette.darkPrimaryContrast).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back to the registry defaults on invalid seeds', () => {
    const palette = buildThemePalette({ primary: 'nope', accent: '#12345' });

    expect(palette.light['--primary']).toBe(toOklch('#0284c7'));
    expect(palette.light['--accent']).toBe(toOklch('#f59e0b'));
  });
});
