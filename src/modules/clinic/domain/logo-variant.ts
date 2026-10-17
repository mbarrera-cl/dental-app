/**
 * The four derived files of an uploaded logo. Every upload produces the
 * whole set, and they share one `version` (the current logo generation).
 */
export const LOGO_VARIANTS = ['logo', 'square', 'favicon', 'print'] as const;

export type LogoVariant = (typeof LOGO_VARIANTS)[number];

export function isLogoVariant(value: string): value is LogoVariant {
  return (LOGO_VARIANTS as readonly string[]).includes(value);
}
