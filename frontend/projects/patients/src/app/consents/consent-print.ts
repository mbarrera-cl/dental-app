import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucidePrinter } from '@ng-icons/lucide';
import { HlmButton } from '@ui/button';
import { HlmSkeleton } from '@ui/skeleton';
import {
  BrandingApi,
  ConsentsApi,
  type ClinicBranding,
  type ConsentRecord,
} from 'data-access';

/**
 * A4 printable proof of an accepted informed consent. The body is the frozen
 * snapshot stored with the record, so it always shows the wording the patient
 * actually accepted.
 */
@Component({
  selector: 'app-consent-print',
  imports: [RouterLink, TranslocoPipe, NgIcon, HlmButton, HlmSkeleton],
  providers: provideIcons({ lucideArrowLeft, lucidePrinter }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mb-4 flex items-center gap-2 print:hidden">
      <a hlmBtn variant="outline" size="sm" [routerLink]="backLink()">
        <ng-icon name="lucideArrowLeft" />
        {{ 'consents.print.back' | transloco }}
      </a>
      <button hlmBtn size="sm" (click)="print()" [disabled]="record() === null">
        <ng-icon name="lucidePrinter" />
        {{ 'consents.print.action' | transloco }}
      </button>
    </section>

    <article
      class="mx-auto max-w-3xl rounded-lg bg-white p-8 text-black shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none"
      data-testid="consent-document"
    >
      @if (record(); as record) {
        <header class="mb-6 flex items-start justify-between gap-6 border-b pb-4">
          <div class="flex items-center gap-3">
            @if (branding()?.logoUrl; as logo) {
              <img [src]="logo" class="h-14 w-auto max-w-40 object-contain" alt="" />
            } @else {
              <span class="flex size-12 items-center justify-center rounded-lg bg-neutral-800 text-xl font-bold text-white">
                {{ initial() }}
              </span>
            }
            <div class="grid gap-0.5">
              <h1 class="text-lg font-semibold tracking-tight">{{ branding()?.name ?? 'Hexa' }}</h1>
              @if (branding()?.slogan; as slogan) {
                <p class="text-xs text-neutral-600">{{ slogan }}</p>
              }
            </div>
          </div>
          <div class="grid gap-0.5 text-right text-sm">
            <p class="text-base font-bold tracking-wide">{{ 'consents.print.title' | transloco }}</p>
            <p>{{ 'consents.print.version' | transloco }}: v{{ record.templateVersion }}</p>
          </div>
        </header>

        <section class="mb-6 grid gap-1 text-sm">
          <h2 class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            {{ 'consents.print.patient' | transloco }}
          </h2>
          <p class="font-medium">{{ record.patientName }}</p>
          <p>{{ 'consents.print.rut' | transloco }}: <span class="font-mono">{{ record.patientRut }}</span></p>
          @if (record.procedure) {
            <p>{{ 'consents.print.procedure' | transloco }}: {{ record.procedure }}</p>
          }
          <p>{{ 'consents.print.acceptedAt' | transloco }}: {{ formatDateTime(record.acceptedAt) }}</p>
        </section>

        <section class="mb-6 grid gap-2 text-sm leading-relaxed">
          <h2 class="text-base font-semibold">{{ record.title }}</h2>
          <p class="whitespace-pre-wrap">{{ renderedBody() }}</p>
        </section>

        <footer class="grid gap-1 border-t pt-4 text-xs">
          <p>
            {{ 'consents.print.acceptor' | transloco }}:
            <span class="font-medium">{{ record.acceptorName }}</span>
          </p>
          <div class="mt-10 grid gap-1">
            <div class="h-px w-64 bg-neutral-500"></div>
            <p class="text-neutral-500">{{ 'consents.print.signature' | transloco }}</p>
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
export class ConsentPrint {
  private readonly api = inject(ConsentsApi);
  private readonly brandingApi = inject(BrandingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  protected readonly record = signal<ConsentRecord | null>(null);
  protected readonly branding = signal<ClinicBranding | null>(null);

  protected readonly initial = computed(() =>
    (this.branding()?.name ?? 'H').slice(0, 1).toUpperCase(),
  );

  protected readonly renderedBody = computed(() => {
    const record = this.record();

    if (record === null) {
      return '';
    }

    const procedure = record.procedure ?? record.title;

    return record.body
      .split('{{paciente}}')
      .join(record.patientName)
      .split('{{procedimiento}}')
      .join(procedure);
  });

  protected readonly backLink = computed(() => {
    const record = this.record();

    return record === null
      ? ['/patients']
      : ['/patients', record.patientId, 'consentimientos'];
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('consentId');

    if (id !== null) {
      this.api.getById(id).subscribe({ next: (record) => this.record.set(record) });
    }

    this.brandingApi.get().subscribe({
      next: (snapshot) => this.branding.set(snapshot.branding),
    });
  }

  protected print(): void {
    window.print();
  }

  protected formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang() === 'en' ? 'en-US' : 'es-CL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
}
