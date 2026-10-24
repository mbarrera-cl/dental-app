import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFileText,
  lucidePencil,
  lucidePrinter,
  lucideRefreshCw,
  lucideSearch,
  lucideSearchX,
  lucideTrash2,
  lucideTriangleAlert,
  lucideUndo2,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@ui/button';
import { HlmSkeleton } from '@ui/skeleton';
import { HlmBadge } from '@ui/badge';
import { HlmTBody, HlmTable, HlmTableContainer, HlmTd, HlmTh, HlmTHead, HlmTr } from '@ui/table';
import { HasPermissionDirective, PERMISSION_KEYS } from 'auth';
import {
  PatientsApi,
  QuotesApi,
  mapApiError,
  slicePage,
  UiSettingsService,
  type Quote,
  type QuoteStatus,
} from 'data-access';
import { distinctUntilChanged, map } from 'rxjs';
import { formatDateTime, PaginatorComponent } from 'ui';

const STATUS_VARIANT: Record<QuoteStatus, 'secondary' | 'outline' | 'default' | 'destructive'> = {
  borrador: 'outline',
  sin_respuesta: 'secondary',
  aprobada: 'default',
  rechazada: 'destructive',
};

/** List of quotations with filters and quick actions (print, edit, delete, restore). */
@Component({
  selector: 'app-quotes-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmSkeleton,
    HlmBadge,
    HlmTableContainer,
    HlmTable,
    HlmTHead,
    HlmTBody,
    HlmTr,
    HlmTh,
    HlmTd,
    HasPermissionDirective,
    PaginatorComponent,
  ],
  providers: provideIcons({
    lucideFileText,
  lucidePencil,
      lucidePrinter,
    lucideRefreshCw,
    lucideSearch,
    lucideSearchX,
    lucideTrash2,
    lucideTriangleAlert,
    lucideUndo2,
  }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="grid gap-1">
          <h2 class="text-2xl font-semibold tracking-tight">{{ 'quotes.title' | transloco }}</h2>
          <p class="text-muted-foreground text-sm">{{ 'quotes.subtitle' | transloco }}</p>
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
            routerLink="/quotes/new"
            [queryParams]="patientId() === null ? {} : { patientId: patientId() }"
            data-testid="quotes-new"
          >
            <ng-icon name="lucideFileText" />
            {{ 'quotes.newQuote' | transloco }}
          </a>
        </div>
      </header>

      <div class="flex flex-wrap items-center gap-2" role="tablist" [attr.aria-label]="'quotes.view.label' | transloco">
        <button
          hlmBtn
          type="button"
          size="sm"
          [variant]="view() === 'active' ? 'default' : 'outline'"
          role="tab"
          [attr.aria-selected]="view() === 'active'"
          data-testid="quotes-view-active"
          (click)="setView('active')"
        >
          {{ 'quotes.view.active' | transloco }}
        </button>
        <button
          hlmBtn
          type="button"
          size="sm"
          [variant]="view() === 'trash' ? 'default' : 'outline'"
          role="tab"
          [attr.aria-selected]="view() === 'trash'"
          data-testid="quotes-view-trash"
          (click)="setView('trash')"
        >
          <ng-icon name="lucideTrash2" />
          {{ 'quotes.view.trash' | transloco }}
        </button>
      </div>

      @if (view() === 'trash') {
        <div
          class="bg-muted/50 rounded-lg border px-4 py-3 text-sm"
          data-testid="quotes-trash-banner"
        >
          {{ 'quotes.trash.banner' | transloco }}
        </div>
      }

      @if (patientId() !== null) {
        <div
          class="bg-muted/50 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
          data-testid="quotes-patient-banner"
        >
          <p>{{ 'quotes.filteredByPatient' | transloco: { name: patientLabel() ?? '…' } }}</p>
          <a hlmBtn variant="ghost" size="sm" routerLink="/quotes">{{ 'quotes.showAll' | transloco }}</a>
        </div>
      }

      <div class="flex flex-wrap items-center gap-3">
        <div class="relative min-w-64 flex-1">
          <ng-icon
            name="lucideSearch"
            class="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2"
          />
          <input
            hlmInput
            class="ps-9"
            [value]="query()"
            (input)="onQueryInput($event)"
            placeholder="{{ 'quotes.searchPlaceholder' | transloco }}"
            data-testid="quotes-search"
          />
        </div>
        <label class="text-muted-foreground text-sm">{{ 'quotes.filterStatus' | transloco }}</label>
        <select hlmInput class="w-auto" [value]="statusFilter()" (change)="onStatusChange($event)" data-testid="quotes-status-filter">
          <option value="">{{ 'quotes.allStatuses' | transloco }}</option>
          <option value="borrador">{{ 'quotes.status.borrador' | transloco }}</option>
          <option value="sin_respuesta">{{ 'quotes.status.sin_respuesta' | transloco }}</option>
          <option value="aprobada">{{ 'quotes.status.aprobada' | transloco }}</option>
          <option value="rechazada">{{ 'quotes.status.rechazada' | transloco }}</option>
        </select>
      </div>

      @if (loadError(); as errorKey) {
        <div class="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
          <ng-icon name="lucideTriangleAlert" class="shrink-0" />
          <p class="flex-1">{{ errorKey | transloco }}</p>
          <button hlmBtn variant="outline" size="sm" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      }

      <div hlmTableContainer class="bg-card rounded-lg border">
        <table hlmTable>
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh>{{ 'quotes.columns.folio' | transloco }}</th>
              <th hlmTh>{{ 'quotes.columns.patient' | transloco }}</th>
              <th hlmTh class="hidden md:table-cell">{{ 'quotes.columns.total' | transloco }}</th>
              <th hlmTh class="hidden lg:table-cell">{{ 'quotes.columns.approved' | transloco }}</th>
              <th hlmTh>{{ 'quotes.columns.status' | transloco }}</th>
              <th hlmTh class="hidden md:table-cell">{{ 'quotes.columns.created' | transloco }}</th>
              <th hlmTh class="text-end">{{ 'quotes.columns.actions' | transloco }}</th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @if (loading()) {
              @for (row of skeletonRows; track row) {
                <tr hlmTr>
                  <td hlmTd><div hlmSkeleton class="h-4 w-24"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-4 w-40"></div></td>
                  <td hlmTd class="hidden md:table-cell"><div hlmSkeleton class="h-4 w-16"></div></td>
                  <td hlmTd class="hidden lg:table-cell"><div hlmSkeleton class="h-4 w-16"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-5 w-16"></div></td>
                  <td hlmTd class="hidden md:table-cell"><div hlmSkeleton class="h-4 w-24"></div></td>
                  <td hlmTd><div hlmSkeleton class="ms-auto h-8 w-20"></div></td>
                </tr>
              }
            } @else if (filtered().length === 0) {
              <tr hlmTr>
                <td hlmTd colspan="7" class="py-12">
                  <div class="text-muted-foreground flex flex-col items-center gap-2 text-center">
                    <ng-icon name="lucideSearchX" class="size-6" />
                    <p>
                      {{
                        (view() === 'trash'
                          ? 'quotes.trash.empty'
                          : quotes().length === 0
                            ? 'quotes.empty'
                            : 'quotes.noMatches') | transloco
                      }}
                    </p>
                  </div>
                </td>
              </tr>
            } @else {
              @for (quote of paged().items; track quote.id) {
                <tr hlmTr data-testid="quotes-row">
                  <td hlmTd>
                    @if (view() === 'trash') {
                      <span class="font-mono">{{ quote.folio }}</span>
                    } @else {
                      <a routerLink="/quotes/{{ quote.id }}" class="text-primary font-mono hover:underline">{{ quote.folio }}</a>
                    }
                  </td>
                  <td hlmTd>
                    <div class="grid gap-0.5">
                      <span class="font-medium">{{ quote.patientName }}</span>
                      <span class="text-muted-foreground font-mono text-xs">{{ quote.patientRut }}</span>
                    </div>
                  </td>
                  <td hlmTd class="hidden font-medium tabular-nums md:table-cell">{{ formatMoney(quote.total) }}</td>
                  <td hlmTd class="text-muted-foreground hidden tabular-nums lg:table-cell">{{ formatMoney(quote.approvedTotal) }}</td>
                  <td hlmTd>
                    <div class="grid justify-items-start gap-1">
                      <span hlmBadge [variant]="statusVariant(quote)">
                        {{ 'quotes.status.' + statusOf(quote) | transloco }}
                      </span>
                      @if (isExpired(quote)) {
                        <span class="text-destructive text-[10px] font-medium" data-testid="quotes-expired">
                          {{ 'quotes.status.vencida' | transloco }}
                        </span>
                      }
                    </div>
                  </td>
                  <td hlmTd class="text-muted-foreground hidden md:table-cell">
                    @if (view() === 'trash') {
                      {{ 'quotes.trash.deletedAt' | transloco: { date: formatDate(quote.deletedAt ?? '') } }}
                      @if (quote.deletedByName) {
                        · {{ quote.deletedByName }}
                      }
                    } @else {
                      {{ formatDate(quote.createdAt) }} · {{ quote.createdByName }}
                    }
                  </td>
                  <td hlmTd>
                    <div class="flex justify-end gap-1">
                      @if (view() === 'trash') {
                        <button
                          *hasPermission="permissionKeys.quotes.delete"
                          hlmBtn
                          variant="outline"
                          size="sm"
                          type="button"
                          [attr.data-testid]="'quotes-restore-' + quote.id"
                          (click)="askRestore(quote)"
                        >
                          <ng-icon name="lucideUndo2" />
                          {{ 'quotes.trash.restore' | transloco }}
                        </button>
                      } @else {
                        <a hlmBtn variant="ghost" size="icon-sm" [routerLink]="['/quotes', quote.id, 'print']" [attr.aria-label]="'quotes.printAction' | transloco" [attr.data-testid]="'quotes-print-' + quote.id">
                          <ng-icon name="lucidePrinter" />
                        </a>
                        <a
                          *hasPermission="permissionKeys.quotes.update"
                          hlmBtn
                          variant="ghost"
                          size="icon-sm"
                          [routerLink]="['/quotes', quote.id]"
                          [attr.aria-label]="'quotes.editAction' | transloco"
                          [attr.data-testid]="'quotes-edit-' + quote.id"
                        >
                          <ng-icon name="lucidePencil" />
                        </a>
                        <button
                          *hasPermission="permissionKeys.quotes.delete"
                          hlmBtn
                          variant="ghost"
                          size="icon-sm"
                          type="button"
                          [attr.aria-label]="'quotes.trash.move' | transloco"
                          [attr.data-testid]="'quotes-delete-' + quote.id"
                          (click)="askDelete(quote)"
                        >
                          <ng-icon name="lucideTrash2" />
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      @if (!loading() && filtered().length > 0) {
        <hexa-paginator
          [total]="filtered().length"
          [page]="page()"
          [pageSize]="pageSize()"
          (pageChange)="page.set($event)"
          (pageSizeChange)="pageSize.set($event)"
        />
      }
    </section>
  `,
})
export class QuotesPage {
  private readonly api = inject(QuotesApi);
  private readonly patientsApi = inject(PatientsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly uiSettings = inject(UiSettingsService);

  protected readonly permissionKeys = PERMISSION_KEYS;

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly quotes = signal<Quote[]>([]);
  protected readonly loading = signal(true);
  /** Deep link filter: `/quotes?patientId=…` shows one patient's quotations. */
  protected readonly patientId = signal<string | null>(null);
  /** `active` (default) or `trash`; the URL (`?deleted=only`) is the source of truth. */
  protected readonly view = signal<'active' | 'trash'>('active');
  protected readonly patientLabel = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly statusFilter = signal('');
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  // Pagination over the filtered list (filters run in memory today).
  protected readonly page = signal(1);
  protected readonly pageSize = linkedSignal(() => this.uiSettings.defaultPageSize());
  protected readonly paged = computed(() =>
    slicePage(this.filtered(), this.page(), this.pageSize()),
  );

  protected readonly filtered = computed(() => {
    const needle = this.query().toLowerCase();
    const status = this.statusFilter();

    return this.quotes().filter(
      (quote) =>
        (status === '' || quote.status === status) &&
        (quote.folio.toLowerCase().includes(needle) || quote.patientName.toLowerCase().includes(needle)),
    );
  });

  constructor() {
    this.uiSettings.load();
    this.route.queryParamMap
      .pipe(
        map((params) => ({ patientId: params.get('patientId'), deleted: params.get('deleted') })),
        distinctUntilChanged((a, b) => a.patientId === b.patientId && a.deleted === b.deleted),
      )
      .subscribe(({ patientId, deleted }) => {
        const normalized = patientId === null || patientId === '' ? null : patientId;
        this.patientId.set(normalized);
        this.view.set(deleted === 'only' ? 'trash' : 'active');
        this.page.set(1);
        this.loadPatientLabel(normalized);
        this.load();
      });
  }

  /** Resolves the patient name for the filter banner (non-blocking). */
  private loadPatientLabel(patientId: string | null): void {
    if (patientId === null) {
      this.patientLabel.set(null);
      return;
    }

    this.patientsApi.getById(patientId).subscribe({
      next: (patient) =>
        this.patientLabel.set(
          `${patient.nombres} ${patient.apellidoPaterno} ${patient.apellidoMaterno}`.trim(),
        ),
      error: () => this.patientLabel.set(null),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    const patientId = this.patientId();
    const filter = {
      ...(patientId === null ? {} : { patientId }),
      ...(this.view() === 'trash' ? { deleted: 'only' as const } : {}),
    };

    this.api.list(filter).subscribe({
      next: (quotes) => this.quotes.set(quotes),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(1);
  }

  protected statusOf(quote: Quote): QuoteStatus {    return quote.status;
  }

  protected statusVariant(quote: Quote): (typeof STATUS_VARIANT)[QuoteStatus] {
    return STATUS_VARIANT[this.statusOf(quote)];
  }

  protected isExpired(quote: Quote): boolean {
    return (
      (quote.status === 'borrador' || quote.status === 'sin_respuesta') &&
      quote.validUntil !== null &&
      new Date(quote.validUntil) < new Date()
    );
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

  /** Switches the trash view, keeping the URL (and the patient filter) in sync. */
  protected setView(view: 'active' | 'trash'): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { deleted: view === 'trash' ? 'only' : null },
      queryParamsHandling: 'merge',
    });
  }

  protected askRestore(quote: Quote): void {
    if (!window.confirm(this.transloco.translate('quotes.trash.restoreConfirm', { folio: quote.folio }))) {
      return;
    }

    void this.api.restore(quote.id).subscribe({
      next: () => {
        toast.success(this.transloco.translate('quotes.trash.restored', { folio: quote.folio }));
        this.load();
      },
      error: (error: unknown) => toast.error(mapApiError(error)),
    });
  }

  protected askDelete(quote: Quote): void {
    if (!window.confirm(this.transloco.translate('quotes.deleteConfirm', { folio: quote.folio }))) {
      return;
    }

    void this.api.delete(quote.id).subscribe({
      next: () => {
        toast.success(this.transloco.translate('quotes.deleted', { folio: quote.folio }));
        this.load();
      },
      error: (error: unknown) => toast.error(mapApiError(error)),
    });
  }
}
