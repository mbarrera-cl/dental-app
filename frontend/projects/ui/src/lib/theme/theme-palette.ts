/**
 * Pure color maths behind the dynamic theme: hex seeds (`clinic.theme.*`) in,
 * OKLCH CSS custom properties out. No DOM here — everything is deterministic
 * and unit-testable.
 */

/** Hex seeds configured by the clinic. */
export interface ThemeSeeds {
  readonly primary: string;
  readonly accent: string;
}

export interface ThemePalette {
  /** CSS custom properties for the light scheme. */
  readonly light: Readonly<Record<string, string>>;
  /** Same tokens adjusted to read on dark surfaces. */
  readonly dark: Readonly<Record<string, string>>;
  /** WCAG contrast of `--primary-foreground` against `--primary` (light). */
  readonly primaryContrast: number;
  /** WCAG contrast of `--primary-foreground` against `--primary` (dark). */
  readonly darkPrimaryContrast: number;
}

const WHITE = '#ffffff';
const INK = '#09090b';
const FALLBACK_PRIMARY = '#0284c7';
const FALLBACK_ACCENT = '#f59e0b';
/** How far a seed travels towards white for the dark scheme. */
const DARK_MIX = 0.35;

export function buildThemePalette(seeds: ThemeSeeds): ThemePalette {
  const primary = normalizeHex(seeds.primary) ?? FALLBACK_PRIMARY;
  const accent = normalizeHex(seeds.accent) ?? FALLBACK_ACCENT;

  const darkPrimary = mixWithWhite(primary, DARK_MIX);
  const darkAccent = mixWithWhite(accent, DARK_MIX);

  const onPrimary = readableOn(primary);
  const onAccent = readableOn(accent);
  const onDarkPrimary = readableOn(darkPrimary);
  const onDarkAccent = readableOn(darkAccent);

  const primaryOklch = toOklch(primary);
  const accentOklch = toOklch(accent);
  const darkPrimaryOklch = toOklch(darkPrimary);
  const darkAccentOklch = toOklch(darkAccent);

  return {
    light: {
      '--primary': primaryOklch,
      '--primary-foreground': onPrimary,
      '--ring': primaryOklch,
      '--accent': accentOklch,
      '--accent-foreground': onAccent,
      '--sidebar-primary': primaryOklch,
      '--sidebar-primary-foreground': onPrimary,
      '--sidebar-ring': primaryOklch,
    },
    dark: {
      '--primary': darkPrimaryOklch,
      '--primary-foreground': onDarkPrimary,
      '--ring': darkPrimaryOklch,
      '--accent': darkAccentOklch,
      '--accent-foreground': onDarkAccent,
      '--sidebar-primary': darkPrimaryOklch,
      '--sidebar-primary-foreground': onDarkPrimary,
      '--sidebar-ring': darkPrimaryOklch,
    },
    primaryContrast: contrastRatio(primary, onPrimary),
    darkPrimaryContrast: contrastRatio(darkPrimary, onDarkPrimary),
  };
}

/** WCAG 2.x contrast ratio between two hex colors (`1` … `21`, order-free). */
export function contrastRatio(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

/** Relative luminance of a hex color, as defined by WCAG 2.x. */
export function luminance(hex: string): number {
  const { r, g, b } = requireRgb(hex);

  return 0.2126 * linearize(r / 255) + 0.7152 * linearize(g / 255) + 0.0722 * linearize(b / 255);
}

/** Conformance level of a contrast ratio (WCAG 2.x AA/AAA thresholds). */
export function wcagLevel(ratio: number, largeText = false): 'AAA' | 'AA' | 'fail' {
  if (largeText) {
    return ratio >= 4.5 ? 'AAA' : ratio >= 3 ? 'AA' : 'fail';
  }

  return ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'fail';
}

/** `#rrggbb` → `oklch(L C H)` with the same rounding Tailwind uses. */
export function toOklch(hex: string): string {
  const { r, g, b } = requireRgb(hex);
  const [lr, lg, lb] = [r / 255, g / 255, b / 255].map(linearize);

  const l = 0.4122214708 * lr! + 0.5363325363 * lg! + 0.0514459929 * lb!;
  const m = 0.2119034982 * lr! + 0.6806995451 * lg! + 0.1073969566 * lb!;
  const s = 0.0883024619 * lr! + 0.2817188376 * lg! + 0.6299787005 * lb!;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const axisA = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const axisB = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;

  const chroma = Math.sqrt(axisA * axisA + axisB * axisB);
  // At (almost) zero chroma the hue is numerically meaningless: pin it to 0.
  const hue = chroma < 0.0005 ? 0 : ((Math.atan2(axisB, axisA) * 180) / Math.PI + 360) % 360;

  return `oklch(${round(lightness)} ${round(chroma)} ${round(hue)})`;
}

/** `#rgb` / `#rrggbb` (any case) → normalized lower-case `#rrggbb`, or null. */
function normalizeHex(hex: string): string | null {
  const value = hex.trim().toLowerCase();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);

  if (match === null) {
    return null;
  }

  const digits = match[1]!;

  return digits.length === 3
    ? `#${digits
        .split('')
        .map((digit) => `${digit}${digit}`)
        .join('')}`
    : `#${digits}`;
}

function requireRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex);

  if (normalized === null) {
    throw new Error(`"${hex}" is not a #rgb or #rrggbb color`);
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function linearize(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Foreground (pure white or near-black zinc) with the best contrast. */
function readableOn(background: string): string {
  return contrastRatio(background, WHITE) >= contrastRatio(background, INK) ? WHITE : INK;
}

function mixWithWhite(hex: string, amount: number): string {
  const { r, g, b } = requireRgb(hex);
  const toHex = (channel: number): string =>
    Math.round(channel + (255 - channel) * amount)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
