/**
 * Public projection of the clinic identity: everything the shell, the login
 * and the print headers need, and nothing else. Reads are cheap and safe to
 * expose without authentication (the branding endpoint is what lets the
 * login screen paint with the clinic's face).
 */
export interface ClinicBranding {
  readonly name: string;
  readonly slogan: string;
  readonly logoUrl: string | null;
  readonly faviconUrl: string | null;
  readonly colors: ClinicBrandingColors;
  /** Current logo generation; `0` means the clinic has no logo. */
  readonly version: number;
}

export interface ClinicBrandingColors {
  readonly primary: string;
  readonly accent: string;
  readonly mode: string;
}
