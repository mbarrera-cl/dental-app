import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideBadgeDollarSign,
  lucideCalendarDays,
  lucideLifeBuoy,
  lucideSearch,
  lucideSearchX,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import { HlmSkeleton } from '@ui/skeleton';
import {
  formatRut,
  mapApiError,
  PatientsApi,
  PaymentsApi,
  type CashSummaryEntry,
  type Patient,
  type PaymentMethod,
} from 'data-access';

const PAYMENT_METHOD_KEYS: Record<PaymentMethod, string> = {
  efectivo: 'patientAccount.payment.methodEfectivo',
  tarjeta: 'patientAccount.payment.methodTarjeta',
  transferencia: 'patientAccount.payment.methodTransferencia',
};

/**
 * «Caja» (cash desk), the first-level surface of the patient account: look a
 * patient up to read their balance — the ledger itself keeps living in the
 * patient's «Cuenta» tab — and run the close of day (non-voided payments by
 * method over an inclusive date range).
 */
@Component({
  selector: 'app-cash-desk-page',
  imports: [RouterLink, TranslocoPipe, NgIcon, HlmBadge, HlmButton, HlmInput, HlmLabel, HlmSkeleton],
  providers: provideIcons({
    lucideArrowRight,
    lucideBadgeDollarSign,
    lucideCalendarDays,
    lucideLifeBuoy,
    lucideSearch,
    lucideSearchX,
    lucideTriangleAlert,
  }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto flex w-full max-w-5xl flex-col gap-6" data-testid="cash-desk">
      <header class="grid gap-1">
        <h1 class="text-2xl font-semibold tracking-tight">{{ 'cashDesk.title' | transloco }}</h1>
        <p class="text-muted-foreground text-sm">{{ 'cashDesk.subtitle' | transloco }}</p>
      </header>

      @if (patientsError(); as errorKey) {
        <div
          class="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
        >
          <ng-icon name="lucideTriangleAlert" class="shrink-0" />
          <p class="flex-1">{{ errorKey | transloco }}</p>
          <button hlmBtn variant="outline" size="sm" (click)="loadPatients()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      }

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Saldos por paciente -->
        <div class="bg-card grid content-start gap-4 rounded-lg border p-4" data-testid="cash-desk-search">
          <div class="grid gap-2">
            <label hlmLabel for="cash-desk-search-input">{{ 'cashDesk.searchLabel' | transloco }}</label>
            <div class="relative">
              <ng-icon name="lucideSearch" class="text-muted-foreground absolute top-2.5 left-3 size-4" />
              <input
                hlmInput
                id="cash-desk-search-input"
                class="pl-9"
                autocomplete="off"
                [value]="query()"
                (input)="query.set($any($event.target).value)"
                [placeholder]="'cashDesk.searchPlaceholder' | transloco"
                data-testid="cash-desk-search-input"
              />
            </div>
          </div>

          @if (patientsLoading()) {
            @for (row of skeletonRows; track row) {
              <div hlmSkeleton class="h-10 w-full"></div>
            }
          } @else if (matches().length === 0) {
            <div class="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
              <ng-icon name="lucideSearchX" class="size-6" />
              {{ 'cashDesk.searchEmpty' | transloco: { query: query() || ' ' } }}
            </div>
          } @else {
            <ul class="grid gap-1" data-testid="cash-desk-results">
              @for (patient of matches(); track patient.id) {
                <li>
                  <button
                    hlmBtn
                    variant="ghost"
                    size="sm"
                    class="w-full justify-between"
                    (click)="select(patient)"
                    [attr.data-testid]="'cash-desk-patient-' + patient.id"
                  >
                    <span class="truncate">
                      {{ patientName(patient) }}
                      <span class="text-muted-foreground ml-2 font-mono text-xs">
                        {{ formatRut(patient.rut) }}
                      </span>
                    </span>
                    <ng-icon name="lucideArrowRight" />
                  </button>
                </li>
              }
            </ul>
          }

          @if (selected(); as patient) {
            <div class="border-primary/40 bg-primary/5 grid gap-1 rounded-lg border p-3" data-testid="cash-desk-account">
              <p class="text-sm font-semibold">{{ patientName(patient) }}</p>
              <p class="text-muted-foreground text-xs font-mono">{{ formatRut(patient.rut) }}</p>
              @if (accountError(); as errorKey) {
                <p class="text-destructive mt-2 text-sm">{{ errorKey | transloco }}</p>
              } @else if (accountLoading()) {
                <div hlmSkeleton class="mt-2 h-8 w-40"></div>
              } @else {
                <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div class="grid gap-0.5">
                    <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {{ 'cashDesk.selected.balance' | transloco }}
                    </p>
                    <p class="text-xl font-semibold tabular-nums" data-testid="cash-desk-balance">
                      {{ formatMoney(balance()) }}
                    </p>
                  </div>
                  <span hlmBadge [variant]="balance() === 0 ? 'secondary' : 'default'">
                    {{
                      (balance() === 0
                        ? 'cashDesk.selected.balancePaid'
                        : 'cashDesk.selected.balance') | transloco
                    }}
                  </span>
                </div>
                <a
                  hlmBtn
                  variant="outline"
                  size="sm"
                  class="mt-2 w-fit"
                  [routerLink]="['/patients', patient.id, 'cuenta']"
                  data-testid="cash-desk-open-account"
                >
                  {{ 'cashDesk.selected.open' | transloco }}
                  <ng-icon name="lucideArrowRight" />
                </a>
              }
            </div>
          } @else {
            <p class="text-muted-foreground text-xs">{{ 'cashDesk.selectHint' | transloco }}</p>
          }
        </div>

        <!-- Cierre del día -->
        <div class="bg-card grid content-start gap-4 rounded-lg border p-4" data-testid="cash-desk-summary">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideCalendarDays" />
            <h2 class="text-lg font-semibold">{{ 'cashDesk.closeOfDay.title' | transloco }}</h2>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-2">
              <label hlmLabel for="cash-desk-from">{{ 'cashDesk.closeOfDay.from' | transloco }}</label>
              <input
                hlmInput
                id="cash-desk-from"
                type="date"
                [value]="summaryFrom()"
                (change)="summaryFrom.set($any($event.target).value)"
                data-testid="cash-desk-from"
              />
            </div>
            <div class="grid gap-2">
              <label hlmLabel for="cash-desk-to">{{ 'cashDesk.closeOfDay.to' | transloco }}</label>
              <input
                hlmInput
                id="cash-desk-to"
                type="date"
                [value]="summaryTo()"
                (change)="summaryTo.set($any($event.target).value)"
                data-testid="cash-desk-to"
              />
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button hlmBtn variant="outline" size="sm" (click)="setToday()">
              {{ 'cashDesk.closeOfDay.today' | transloco }}
            </button>
            <button
              hlmBtn
              variant="outline"
              size="sm"
              (click)="loadSummary()"
              [disabled]="summaryLoading()"
              data-testid="cash-desk-apply"
            >
              {{ 'cashDesk.closeOfDay.apply' | transloco }}
            </button>
          </div>

          @if (summaryError(); as errorKey) {
            <div
              class="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
            >
              <ng-icon name="lucideTriangleAlert" class="shrink-0" />
              <p class="flex-1">{{ errorKey | transloco }}</p>
              <button hlmBtn variant="outline" size="sm" (click)="loadSummary()">
                {{ 'common.retry' | transloco }}
              </button>
            </div>
          }

          @if (summaryLoading()) {
            <div hlmSkeleton class="h-16 w-full"></div>
          } @else if (summary() !== null && summary()!.length === 0) {
            <div class="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
              <ng-icon name="lucideLifeBuoy" class="size-6" />
              {{ 'cashDesk.closeOfDay.empty' | transloco }}
            </div>
          } @else if (summary(); as summary) {
            <ul class="grid gap-1" data-testid="cash-desk-summary-list">
              @for (entry of summary; track entry.method) {
                <li class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
                  <span>{{ methodLabel(entry.method) }}</span>
                  <span class="font-medium tabular-nums">{{ formatMoney(entry.total) }}</span>
                </li>
              }
            </ul>
            <div class="border-t pt-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="font-semibold">{{ 'cashDesk.closeOfDay.total' | transloco }}</span>
                <span class="text-lg font-semibold tabular-nums" data-testid="cash-desk-total">
                  {{ formatMoney(summaryTotal(summary)) }}
                </span>
              </div>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class CashDeskPage {
  private readonly patientsApi = inject(PatientsApi);
  private readonly paymentsApi = inject(PaymentsApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly skeletonRows = [0, 1, 2, 3];

  protected readonly patients = signal<Patient[]>([]);
  protected readonly patientsLoading = signal(true);
  protected readonly patientsError = signal<string | null>(null);
  protected readonly query = signal('');

  protected readonly selected = signal<Patient | null>(null);
  protected readonly accountLoading = signal(false);
  protected readonly accountError = signal<string | null>(null);
  protected readonly balance = signal(0);

  protected readonly summaryFrom = signal(isoDate(new Date()));
  protected readonly summaryTo = signal(isoDate(new Date()));
  protected readonly summary = signal<CashSummaryEntry[] | null>(null);
  protected readonly summaryLoading = signal(false);
  protected readonly summaryError = signal<string | null>(null);

  /** Same client-side filter the patients list uses (name + RUT, digits-tolerant). */
  protected readonly matches = computed(() => {
    const query = this.query().trim().toLowerCase();

    if (query === '') {
      return this.patients().slice(0, 8);
    }

    const digitsQuery = query.replace(/[^0-9k]/g, '');

    return this.patients()
      .filter((patient) => {
        const haystack =
          [
            patient.nombres,
            patient.apellidoPaterno,
            patient.apellidoMaterno,
            patient.email ?? '',
            patient.rut,
            formatRut(patient.rut),
          ]
            .join(' ')
            .toLowerCase();

        return haystack.includes(query) || (digitsQuery !== '' && haystack.replace(/[^0-9k]/g, '').includes(digitsQuery));
      })
      .slice(0, 8);
  });

  constructor() {
    this.loadPatients();
    this.loadSummary();
  }

  protected loadPatients(): void {
    this.patientsLoading.set(true);
    this.patientsError.set(null);

    this.patientsApi.list().subscribe({
      next: (patients) => {
        this.patients.set(patients);
        this.patientsLoading.set(false);
      },
      error: (error: unknown) => {
        this.patientsError.set(mapApiError(error));
        this.patientsLoading.set(false);
      },
    });
  }

  protected select(patient: Patient): void {
    this.selected.set(patient);
    this.accountLoading.set(true);
    this.accountError.set(null);
    this.balance.set(0);

    this.paymentsApi.ledger(patient.id, { limit: 1 }).subscribe({
      next: (ledger) => {
        this.balance.set(ledger.balance);
        this.accountLoading.set(false);
      },
      error: (error: unknown) => {
        this.accountError.set(mapApiError(error));
        this.accountLoading.set(false);
      },
    });
  }

  protected setToday(): void {
    const today = isoDate(new Date());
    this.summaryFrom.set(today);
    this.summaryTo.set(today);
    this.loadSummary();
  }

  protected loadSummary(): void {
    this.summaryLoading.set(true);
    this.summaryError.set(null);

    this.paymentsApi.cashSummary({ from: this.summaryFrom(), to: this.summaryTo() }).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.summaryLoading.set(false);
      },
      error: (error: unknown) => {
        this.summaryError.set(mapApiError(error));
        this.summary.set(null);
        this.summaryLoading.set(false);
      },
    });
  }

  protected summaryTotal(summary: CashSummaryEntry[]): number {
    return summary.reduce((total, entry) => total + entry.total, 0);
  }

  protected patientName(patient: Patient): string {
    return `${patient.nombres} ${patient.apellidoPaterno} ${patient.apellidoMaterno}`;
  }

  protected methodLabel(method: PaymentMethod): string {
    return this.transloco.translate(PAYMENT_METHOD_KEYS[method]);
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat(this.transloco.getActiveLang() === 'en' ? 'en-US' : 'es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatRut(rut: string): string {
    return formatRut(rut);
  }
}

/** `yyyy-MM-dd` in the local timezone (`toISOString` would drift for UTC-3 evenings). */
function isoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
