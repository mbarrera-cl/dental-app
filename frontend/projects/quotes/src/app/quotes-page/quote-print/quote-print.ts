import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucidePrinter } from '@ng-icons/lucide';
import { HlmButton } from '@ui/button';
import { HlmSkeleton } from '@ui/skeleton';
import {
  BrandingApi,
  QuotesApi,
  type ClinicBranding,
  type Quote,
} from 'data-access';

/**
 * A4 printable document of a quotation (F4). Renders the clinic identity,
 * the patient snapshot, the item table and the totals, and offers
 * Imprimir / Descargar PDF via `window.print()`.
 */
@Component({
  selector: 'app-quote-print',
  imports: [RouterLink, TranslocoPipe, NgIcon, HlmButton, HlmSkeleton],
  providers: provideIcons({ lucidePrinter, lucideArrowLeft }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mb-4 flex items-center gap-2 print:hidden">
      <a hlmBtn variant="outline" size="sm" routerLink="/quotes">
        <ng-icon name="lucideArrowLeft" />
        {{ 'quotes.print.back' | transloco }}
      </a>
      <button hlmBtn size="sm" (click)="print()" [disabled]="quote() === null">
        <ng-icon name="lucidePrinter" />
        {{ 'quotes.print.action' | transloco }}
      </button>
    </section>

    <article
      class="mx-auto max-w-3xl rounded-lg bg-white p-8 text-black shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none"
      data-testid="quote-document"
    >
      @if (quote(); as quote) {
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
              <h1 class="text-lg font-semibold tracking-tight">{{ branding()?.name ?? 'Hexa' }}</h1>
              @if (branding()?.slogan; as slogan) {
                <p class="text-xs text-neutral-600">{{ slogan }}</p>
              }
            </div>
          </div>
          <div class="grid gap-0.5 text-right text-sm">
            <p class="text-base font-bold tracking-wide">
              {{ 'quotes.print.title' | transloco }}
            </p>
            <p>
              {{ 'quotes.print.folio' | transloco }}:
              <span class="font-mono font-medium">{{ quote.folio }}</span>
            </p>
            <p>{{ 'quotes.print.date' | transloco }}: {{ formatDate(quote.createdAt) }}</p>
            <p class="text-xs text-neutral-600">
              {{ 'quotes.print.version' | transloco }}: {{ quote.version }}
            </p>
          </div>
        </header>

        <section class="mb-6 grid gap-1 text-sm">
          <h2 class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            {{ 'quotes.print.patient' | transloco }}
          </h2>
          <p class="font-medium">{{ quote.patientName }}</p>
          <p>
            {{ 'quotes.print.rut' | transloco }}:
            <span class="font-mono">{{ quote.patientRut }}</span>
          </p>
          @if (quote.patientEmail) {
            <p>{{ quote.patientEmail }}</p>
          }
          @if (quote.validUntil) {
            <p class="text-neutral-600">
              {{ 'quotes.print.validUntil' | transloco }}:
              {{ formatDate(quote.validUntil) }}
            </p>
          }
        </section>

        <table class="mb-6 w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th class="py-1.5 pe-2 font-medium">{{ 'quotes.print.code' | transloco }}</th>
              <th class="py-1.5 pe-2 font-medium">{{ 'quotes.print.description' | transloco }}</th>
              <th class="py-1.5 pe-2 text-center font-medium">{{ 'quotes.print.qty' | transloco }}</th>
              <th class="py-1.5 pe-2 text-right font-medium">{{ 'quotes.print.value' | transloco }}</th>
              <th class="py-1.5 text-right font-medium">{{ 'quotes.print.net' | transloco }}</th>
            </tr>
          </thead>
          <tbody>
            @for (item of quote.items; track item.id) {
              <tr class="border-b border-neutral-200 align-top">
                <td class="py-1.5 pe-2 font-mono text-xs">{{ item.ucoCode ?? '—' }}</td>
                <td class="py-1.5 pe-2">
                  {{ item.description }}
                  @if (item.piezaDental) {
                    <span class="text-neutral-500"> · {{ item.piezaDental }}</span>
                  }
                </td>
                <td class="py-1.5 pe-2 text-center tabular-nums">{{ item.quantity }}</td>
                <td class="py-1.5 pe-2 text-right tabular-nums">
                  {{ formatMoney(item.unitPrice) }}
                  @if (item.discountPercent > 0) {
                    <span class="text-neutral-500"> (−{{ item.discountPercent }}%)</span>
                  }
                </td>
                <td class="py-1.5 text-right font-medium tabular-nums">
                  {{ formatMoney(item.netAmount) }}
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="pt-2 text-right font-medium">
                {{ 'quotes.totals.subtotal' | transloco }}
              </td>
              <td class="pt-2 text-right tabular-nums">{{ formatMoney(quote.subtotal) }}</td>
            </tr>
            @if (quote.discountTotal > 0) {
              <tr>
                <td colspan="4" class="text-right text-neutral-600">
                  {{ 'quotes.totals.discount' | transloco }}
                </td>
                <td class="text-right tabular-nums">− {{ formatMoney(quote.discountTotal) }}</td>
              </tr>
            }
            <tr class="border-t-2 border-neutral-400">
              <td colspan="4" class="pt-2 text-right text-base font-bold">
                {{ 'quotes.totals.total' | transloco }}
              </td>
              <td class="pt-2 text-right text-base font-bold tabular-nums">
                {{ formatMoney(quote.total) }}
              </td>
            </tr>
            @if (quote.approvedTotal > 0) {
              <tr>
                <td colspan="4" class="text-right font-medium">
                  {{ 'quotes.totals.approved' | transloco }}
                </td>
                <td class="text-right font-medium tabular-nums">
                  {{ formatMoney(quote.approvedTotal) }}
                </td>
              </tr>
            }
          </tfoot>
        </table>

        @if (quote.notes) {
          <section class="mb-6 grid gap-1 text-sm">
            <h2 class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {{ 'quotes.print.notes' | transloco }}
            </h2>
            <p class="whitespace-pre-wrap">{{ quote.notes }}</p>
          </section>
        }

        <footer class="grid gap-1 border-t pt-4 text-xs">
          <p>
            {{ 'quotes.print.generatedBy' | transloco }}:
            <span class="font-medium">{{ quote.createdByName }}</span>
            · {{ formatDateTime(quote.createdAt) }}
          </p>
          @if (quote.sanctionedByName) {
            <p>
              {{ 'quotes.print.sanctionedBy' | transloco }}:
              <span class="font-medium">{{ quote.sanctionedByName }}</span>
              @if (quote.sanctionedAt) {
                · {{ formatDateTime(quote.sanctionedAt) }}
              }
            </p>
          }
          <div class="mt-10 grid gap-1">
            <div class="h-px w-64 bg-neutral-500"></div>
            <p class="text-neutral-500">{{ 'quotes.print.signature' | transloco }}</p>
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
export class QuotePrint {
  private readonly api = inject(QuotesApi);
  private readonly brandingApi = inject(BrandingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly quote = signal<Quote | null>(null);
  protected readonly branding = signal<ClinicBranding | null>(null);

  protected readonly initial = computed(() => (this.branding()?.name ?? 'H').slice(0, 1).toUpperCase());

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');

    if (id !== null) {
      this.api.getById(id).subscribe({ next: (quote) => this.quote.set(quote) });
    }

    this.brandingApi.get().subscribe({
      next: (snapshot) => this.branding.set(snapshot.branding),
    });
  }

  protected print(): void {
    window.print();
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat(this.language() === 'en' ? 'en-US' : 'es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(this.language() === 'en' ? 'en-US' : 'es-ES', {
      dateStyle: 'medium',
    }).format(new Date(value));
  }

  protected formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(this.language() === 'en' ? 'en-US' : 'es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
}
