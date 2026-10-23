import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucidePrinter } from '@ng-icons/lucide';
import { HlmButton } from '@ui/button';
import { HlmSkeleton } from '@ui/skeleton';
import { BrandingApi, PrescriptionsApi, type ClinicBranding, type Prescription } from 'data-access';

/**
 * A4 printable prescription (receta). Renders the clinic identity, the
 * professional, the patient snapshot and the medication table; printing is
 * delegated to the browser (`window.print()` → save as PDF).
 */
@Component({
  selector: 'app-prescription-print',
  imports: [RouterLink, TranslocoPipe, NgIcon, HlmButton, HlmSkeleton],
  providers: provideIcons({ lucideArrowLeft, lucidePrinter }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mb-4 flex items-center gap-2 print:hidden">
      <a hlmBtn variant="outline" size="sm" [routerLink]="backLink()">
        <ng-icon name="lucideArrowLeft" />
        {{ 'prescriptions.print.back' | transloco }}
      </a>
      <button hlmBtn size="sm" (click)="print()" [disabled]="prescription() === null">
        <ng-icon name="lucidePrinter" />
        {{ 'prescriptions.print.action' | transloco }}
      </button>
    </section>

    <article
      class="mx-auto max-w-3xl rounded-lg bg-white p-8 text-black shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none"
      data-testid="prescription-document"
    >
      @if (prescription(); as prescription) {
        <header class="mb-6 flex items-start justify-between gap-6 border-b pb-4">
          <div class="flex items-center gap-3">
            @if (branding()?.logoUrl; as logo) {
              <img [src]="logo" class="h-14 w-auto max-w-40 object-contain" alt="" />
            } @else {
              <span
                class="flex size-12 items-center justify-center rounded-lg bg-neutral-800 text-xl font-bold text-white"
              >
                {{ initial() }}
              </span>
            }
            <div class="grid gap-0.5">
              <h1 class="text-lg font-semibold tracking-tight">
                {{ branding()?.name ?? 'Clínica' }}
              </h1>
              @if (branding()?.slogan; as slogan) {
                <p class="text-xs text-neutral-600">{{ slogan }}</p>
              }
            </div>
          </div>
          <div class="grid gap-0.5 text-right text-sm">
            <p class="text-base font-bold tracking-wide">
              {{ 'prescriptions.print.title' | transloco }}
            </p>
            <p>
              {{ 'prescriptions.print.date' | transloco }}: {{ formatDate(prescription.issuedAt) }}
            </p>
          </div>
        </header>

        <section class="mb-6 grid gap-1 text-sm">
          <h2 class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            {{ 'prescriptions.print.patient' | transloco }}
          </h2>
          <p class="font-medium">{{ prescription.patientName }}</p>
          <p>
            {{ 'prescriptions.print.rut' | transloco }}:
            <span class="font-mono">{{ prescription.patientRut }}</span>
          </p>
        </section>

        <table class="mb-6 w-full border-collapse text-sm">
          <thead>
            <tr
              class="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500"
            >
              <th class="py-1.5 pe-2 font-medium">
                {{ 'prescriptions.form.medication' | transloco }}
              </th>
              <th class="py-1.5 pe-2 font-medium">{{ 'prescriptions.form.dose' | transloco }}</th>
              <th class="py-1.5 pe-2 font-medium">
                {{ 'prescriptions.form.frequency' | transloco }}
              </th>
              <th class="py-1.5 font-medium">{{ 'prescriptions.form.duration' | transloco }}</th>
            </tr>
          </thead>
          <tbody>
            @for (item of prescription.items; track $index) {
              <tr class="border-b border-neutral-200 align-top">
                <td class="py-1.5 pe-2 font-medium">{{ item.medicamento }}</td>
                <td class="py-1.5 pe-2">{{ item.dosis }}</td>
                <td class="py-1.5 pe-2">{{ item.frecuencia }}</td>
                <td class="py-1.5">{{ item.duracion }}</td>
              </tr>
            }
          </tbody>
        </table>

        @if (prescription.indicaciones) {
          <section class="mb-6 grid gap-1 text-sm">
            <h2 class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {{ 'prescriptions.print.indications' | transloco }}
            </h2>
            <p class="whitespace-pre-wrap">{{ prescription.indicaciones }}</p>
          </section>
        }

        <footer class="grid gap-1 border-t pt-4 text-xs">
          <p>
            {{ 'prescriptions.print.issuedBy' | transloco }}:
            <span class="font-medium">{{ prescription.issuedByName }}</span>
          </p>
          <div class="mt-10 grid gap-1">
            <div class="h-px w-64 bg-neutral-500"></div>
            <p class="text-neutral-500">{{ 'prescriptions.print.signature' | transloco }}</p>
          </div>
        </footer>
      } @else {
        <div class="grid gap-3 p-8">
          <div hlmSkeleton class="h-5 w-48"></div>
          <div hlmSkeleton class="h-4 w-full"></div>
          <div hlmSkeleton class="h-4 w-5/6"></div>
          <div hlmSkeleton class="h-4 w-2/3"></div>
        </div>
      }
    </article>
  `,
})
export class PrescriptionPrint {
  private readonly api = inject(PrescriptionsApi);
  private readonly brandingApi = inject(BrandingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  protected readonly prescription = signal<Prescription | null>(null);
  protected readonly branding = signal<ClinicBranding | null>(null);

  protected readonly initial = computed(() =>
    (this.branding()?.name ?? 'H').slice(0, 1).toUpperCase(),
  );

  protected readonly backLink = computed(() => {
    const prescription = this.prescription();

    return prescription === null ? ['/patients'] : ['/patients', prescription.patientId, 'recetas'];
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('prescriptionId');

    if (id !== null) {
      this.api
        .getById(id)
        .subscribe({ next: (prescription) => this.prescription.set(prescription) });
    }

    this.brandingApi.get().subscribe({
      next: (snapshot) => this.branding.set(snapshot.branding),
    });
  }

  protected print(): void {
    window.print();
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang() === 'en' ? 'en-US' : 'es-CL', {
      dateStyle: 'medium',
    }).format(new Date(value));
  }
}
