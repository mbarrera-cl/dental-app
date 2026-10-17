import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBadgeDollarSign,
  lucideFileText,
  lucidePlus,
  lucidePrinter,
  lucideRefreshCw,
  lucideSearchX,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmSkeleton } from '@ui/skeleton';
import { HlmTBody, HlmTable, HlmTableContainer, HlmTd, HlmTh, HlmTHead, HlmTr } from '@ui/table';
import { HasPermissionDirective, PERMISSION_KEYS } from 'auth';
import { QuotesApi, mapApiError, type Quote } from 'data-access';
import { distinctUntilChanged, map } from 'rxjs';
import { formatDateTime } from 'ui';

type RowStatus = 'borrador' | 'entregada' | 'aprobada' | 'rechazada' | 'vencida';

const STATUS_VARIANT: Record<RowStatus, 'secondary' | 'outline' | 'default' | 'destructive'> = {
  borrador: 'outline',
  entregada: 'secondary',
  aprobada: 'default',
  rechazada: 'destructive',
  vencida: 'outline',
};

/**
 * “Presupuestos” tab of the patient profile: every quotation associated with
 * this patient (`GET /quotes?patientId=…`). It reuses the shared `QuotesApi`
 * and links to the `quotes` remote for editing/printing — the patient remote
 * never duplicates the quote editor.
 */
@Component({
  selector: 'app-patient-quotes-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmSkeleton,
    HlmTableContainer,
    HlmTable,
    HlmTHead,
    HlmTBody,
    HlmTr,
    HlmTh,
    HlmTd,
    HasPermissionDirective,
  ],
  providers: provideIcons({
    lucideBadgeDollarSign,
    lucideFileText,
    lucidePlus,
    lucidePrinter,
    lucideRefreshCw,
    lucideSearchX,
    lucideTriangleAlert,
  }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="grid gap-4" data-testid="patient-quotes">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="grid gap-0.5">
          <h3 class="font-semibold">{{ 'patientQuotes.title' | transloco }}</h3>
          <p class="text-muted-foreground text-sm">{{ 'patientQuotes.subtitle' | transloco }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button hlmBtn variant="outline" size="sm" (click)="load()" [disabled]="loading()">
            <ng-icon name="lucideRefreshCw" />
            {{ 'common.refresh' | transloco }}
          </button>
          <a
            *hasPermission="permissionKeys.quotes.create"
            hlmBtn
            size="sm"
            [routerLink]="['/quotes/new']"
            [queryParams]="{ patientId: patientId() }"
            data-testid="patient-quotes-new"
          >
            <ng-icon name="lucidePlus" />
            {{ 'patientQuotes.newQuote' | transloco }}
          </a>
        </div>
      </header>

      @if (loadError(); as errorKey) {
        <div class="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
          <ng-icon name="lucideTriangleAlert" class="shrink-0" />
          <p class="flex-1">{{ errorKey | transloco }}</p>
          <button hlmBtn variant="outline" size="sm" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      }

      <div hlmTableContainer class="bg-card rounded-lg border">
        <table hlmTable>
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh>{{ 'quotes.columns.folio' | transloco }}</th>
              <th hlmTh class="hidden md:table-cell">{{ 'quotes.columns.created' | transloco }}</th>
              <th hlmTh class="text-end">{{ 'quotes.columns.total' | transloco }}</th>
              <th hlmTh class="hidden lg:table-cell text-end">{{ 'quotes.columns.approved' | transloco }}</th>
              <th hlmTh>{{ 'quotes.columns.status' | transloco }}</th>
              <th hlmTh class="text-end">{{ 'quotes.columns.actions' | transloco }}</th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @if (loading()) {
              @for (row of skeletonRows; track row) {
                <tr hlmTr>
                  <td hlmTd><div hlmSkeleton class="h-4 w-24"></div></td>
                  <td hlmTd class="hidden md:table-cell"><div hlmSkeleton class="h-4 w-28"></div></td>
                  <td hlmTd><div hlmSkeleton class="ms-auto h-4 w-16"></div></td>
                  <td hlmTd class="hidden lg:table-cell"><div hlmSkeleton class="ms-auto h-4 w-16"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-5 w-16"></div></td>
                  <td hlmTd><div hlmSkeleton class="ms-auto h-8 w-16"></div></td>
                </tr>
              }
            } @else if (quotes().length === 0) {
              <tr hlmTr>
                <td hlmTd colspan="6" class="py-10">
                  <div class="text-muted-foreground flex flex-col items-center gap-2 text-center">
                    <ng-icon name="lucideSearchX" class="size-6" />
                    <p>{{ 'patientQuotes.empty' | transloco }}</p>
                    <a
                      *hasPermission="permissionKeys.quotes.create"
                      hlmBtn
                      variant="outline"
                      size="sm"
                      [routerLink]="['/quotes/new']"
                      [queryParams]="{ patientId: patientId() }"
                    >
                      <ng-icon name="lucidePlus" />
                      {{ 'patientQuotes.newQuote' | transloco }}
                    </a>
                  </div>
                </td>
              </tr>
            } @else {
              @for (quote of quotes(); track quote.id) {
                <tr hlmTr data-testid="patient-quote-row">
                  <td hlmTd>
                    <a
                      [routerLink]="['/quotes', quote.id]"
                      class="text-primary font-mono text-sm hover:underline"
                    >
                      {{ quote.folio }}
                    </a>
                  </td>
                  <td hlmTd class="text-muted-foreground hidden text-sm md:table-cell">
                    {{ formatDate(quote.createdAt) }}
                  </td>
                  <td hlmTd class="text-end font-medium tabular-nums">
                    {{ formatMoney(quote.total) }}
                  </td>
                  <td hlmTd class="text-muted-foreground hidden text-end tabular-nums lg:table-cell">
                    {{ formatMoney(quote.approvedTotal) }}
                  </td>
                  <td hlmTd>
                    <span hlmBadge [variant]="statusVariant(quote)">
                      {{ 'quotes.status.' + statusOf(quote) | transloco }}
                    </span>
                  </td>
                  <td hlmTd>
                    <div class="flex justify-end gap-1">
                      <a
                        hlmBtn
                        variant="ghost"
                        size="icon-sm"
                        [routerLink]="['/quotes', quote.id]"
                        [attr.aria-label]="'common.edit' | transloco"
                        [attr.data-testid]="'patient-quote-edit-' + quote.id"
                      >
                        <ng-icon name="lucideFileText" />
                      </a>
                      <a
                        hlmBtn
                        variant="ghost"
                        size="icon-sm"
                        [routerLink]="['/quotes', quote.id, 'print']"
                        [attr.aria-label]="'quotes.printAction' | transloco"
                        [attr.data-testid]="'patient-quote-print-' + quote.id"
                      >
                        <ng-icon name="lucidePrinter" />
                      </a>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      @if (trashCount() > 0) {
        <p class="text-muted-foreground text-sm" data-testid="patient-quotes-trash">
          {{ 'patientQuotes.trashCount' | transloco: { count: trashCount() } }}
          <a
            class="text-primary hover:underline"
            routerLink="/quotes"
            [queryParams]="{ patientId: patientId(), deleted: 'only' }"
          >
            {{ 'patientQuotes.openTrash' | transloco }}
          </a>
        </p>
      }
    </section>
  `,
})
export class PatientQuotesPage {
  private readonly api = inject(QuotesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  protected readonly permissionKeys = PERMISSION_KEYS;
  protected readonly skeletonRows = [0, 1, 2];

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly patientId = signal('');
  protected readonly quotes = signal<Quote[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  /** Quotations of this patient currently in the trash (link target only). */
  protected readonly trashCount = signal(0);

  protected readonly hasQuotes = computed(() => this.quotes().length > 0);

  constructor() {
    // The tab is a child of `/patients/:id`; the parent route owns the param.
    this.route.parent?.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        distinctUntilChanged(),
      )
      .subscribe((patientId) => {
        this.patientId.set(patientId);
        this.load();
      });
  }

  protected load(): void {
    const patientId = this.patientId();

    if (patientId === '') {
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);

    this.api.list({ patientId }).subscribe({
      next: (quotes) => this.quotes.set(quotes),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });

    // The trash link only matters when there is something in it.
    this.api.list({ patientId, deleted: 'only' }).subscribe({
      next: (trash) => this.trashCount.set(trash.length),
      error: () => this.trashCount.set(0),
    });
  }

  protected statusOf(quote: Quote): RowStatus {
    if (quote.status === 'borrador' || quote.status === 'entregada') {
      return quote.validUntil !== null && new Date(quote.validUntil) < new Date()
        ? 'vencida'
        : quote.status;
    }

    return quote.status;
  }

  protected statusVariant(quote: Quote): (typeof STATUS_VARIANT)[RowStatus] {
    return STATUS_VARIANT[this.statusOf(quote)];
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat(this.language() === 'en' ? 'en-US' : 'es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatDate(value: string): string {
    return formatDateTime(value, this.language());
  }
}
