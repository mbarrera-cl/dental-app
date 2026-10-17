import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Clinic identity shown on printed documents (letterhead). */
export interface ClinicPrintData {
  name: string;
  slogan?: string | null;
  /** Absolute URL of the print-size logo (1024 px); null when unbranded. */
  logoUrl?: string | null;
  rut?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

/**
 * Letterhead for printed views: it only exists on paper (`hidden print:block`,
 * the screen keeps its own chrome). Consumers — the patient record, future
 * prescriptions and quotes — bind `data` from the branding payload plus the
 * clinic contact settings.
 *
 * ```html
 * <hexa-print-header [data]="printData()" />
 * ```
 */
@Component({
  selector: 'hexa-print-header',
  template: `
    <header class="flex items-start justify-between gap-6 border-b pb-3">
      <div class="flex items-center gap-3">
        @if (data().logoUrl; as logo) {
          <img [src]="logo" alt="" class="h-14 w-auto max-w-40 object-contain" />
        }
        <div class="grid gap-0.5">
          <p class="text-base font-semibold tracking-tight">{{ data().name }}</p>
          @if (data().slogan; as slogan) {
            <p class="text-muted-foreground text-xs">{{ slogan }}</p>
          }
        </div>
      </div>
      <div class="grid gap-0.5 text-right text-xs">
        @if (identityLine(); as line) {
          <p>{{ line }}</p>
        }
        @if (addressLine(); as line) {
          <p>{{ line }}</p>
        }
        @if (contactLine(); as line) {
          <p>{{ line }}</p>
        }
      </div>
    </header>
  `,
  host: { class: 'hidden print:block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintHeaderComponent {
  readonly data = input.required<ClinicPrintData>();

  protected identityLine(): string | null {
    const rut = this.data().rut;

    return rut === undefined || rut === null || rut === '' ? null : `RUT ${rut}`;
  }

  protected addressLine(): string | null {
    const address = this.data().address;

    return address === undefined || address === null || address === '' ? null : address;
  }

  protected contactLine(): string | null {
    const { phone, email, website } = this.data();
    const parts = [phone, email, website].filter(
      (part): part is string => part !== undefined && part !== null && part !== '',
    );

    return parts.length === 0 ? null : parts.join(' · ');
  }
}
