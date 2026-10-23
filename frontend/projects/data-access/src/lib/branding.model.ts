/**
 * Clinic branding (`GET /clinic/branding`, mirrors
 * `clinic-branding.response.dto.ts`). The payload is public on purpose: the
 * login screen paints with the clinic's face before any session exists.
 */

export type ThemeMode = 'light' | 'auto';

export interface BrandingColors {
  /** Hex seed (`#rrggbb`) the palette is derived from. */
  primary: string;
  accent: string;
  mode: ThemeMode;
}

export interface BrandingLogin {
  /** Empty strings fall back to the localized copy. */
  headline: string;
  body: string;
  point1: string;
  point2: string;
  point3: string;
}

export interface ClinicBranding {
  name: string;
  slogan: string;
  /** API-relative URL (`/clinic/assets/logo?v=…`); null when there is no logo. */
  logoUrl: string | null;
  faviconUrl: string | null;
  colors: BrandingColors;
  /** Login panel copy; optional so older cached payloads still parse. */
  login?: BrandingLogin;
  /** Logo generation; `0` means the clinic has no logo. */
  version: number;
}

export interface LogoUploadVariant {
  variant: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  hash: string;
  url: string;
}

export interface LogoUpload {
  version: number;
  variants: LogoUploadVariant[];
}

export interface LogoRemoval {
  /** Version left active (`0` = no logo at all). */
  version: number;
}

/** Answer of a branding (re)validation: `branding` is null on 304. */
export interface BrandingSnapshot {
  branding: ClinicBranding | null;
  etag: string | null;
}

/** Emission of `BrandingApi.upload`: 0..100, with the response at the end. */
export interface LogoUploadProgress {
  progress: number;
  upload?: LogoUpload;
}
