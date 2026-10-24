import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideBadgeDollarSign,
  lucideCalendarClock,
  lucideFileText,
  lucideHistory,
  lucideRefreshCw,
  lucideTrendingUp,
  lucideTriangleAlert,
  lucideUsers,
  lucideWallet,
} from '@ng-icons/lucide';
import { interval } from 'rxjs';
import { HlmButton } from '@ui/button';
import { HlmCard, HlmCardContent, HlmCardDescription, HlmCardHeader, HlmCardTitle } from '@ui/card';
import { BarChart, type BarChartDatum } from '@ui/chart';
import { HlmSkeleton } from '@ui/skeleton';
import { DashboardApi, type DashboardSummary, mapApiError, type PaymentMethod } from 'data-access';

const METHOD_KEYS: Record<PaymentMethod, string> = {
  efectivo: 'dashboard.method.efectivo',
  tarjeta: 'dashboard.method.tarjeta',
  transferencia: 'dashboard.method.transferencia',
};

const QUOTE_STATUS_KEYS: Record<string, string> = {
  borrador: 'dashboard.quoteStatus.borrador',
  sin_respuesta: 'dashboard.quoteStatus.sinRespuesta',
  aprobada: 'dashboard.quoteStatus.aprobada',
  rechazada: 'dashboard.quoteStatus.rechazada',
};

const QUOTE_STATUS_ORDER = ['borrador', 'sin_respuesta', 'aprobada', 'rechazada'] as const;

const APPOINTMENT_STATUS_KEYS: Record<string, string> = {
  scheduled: 'dashboard.appointmentStatus.scheduled',
  cancelled: 'dashboard.appointmentStatus.cancelled',
  completed: 'dashboard.appointmentStatus.completed',
};

const REFRESH_MS = 60_000;

/**
 * Clinic dashboard: one aggregated read (`GET /dashboard/summary`) renders the
 * KPI cards, the Spartan/TanStack charts and the operational lists. Everyone
 * shares the server-computed day/month window; the page refreshes itself every
 * minute and offers a manual refresh.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmCard,
    HlmCardHeader,
    HlmCardTitle,
    HlmCardDescription,
    HlmCardContent,
    HlmSkeleton,
    BarChart,
  ],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideBadgeDollarSign,
      lucideCalendarClock,
      lucideFileText,
      lucideHistory,
      lucideRefreshCw,
      lucideTrendingUp,
      lucideTriangleAlert,
      lucideUsers,
      lucideWallet,
    }),
  ],
  templateUrl: './dashboard-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly locale = computed(() => (this.language() === 'en' ? 'en-US' : 'es-CL'));

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly lastUpdated = signal<Date | null>(null);
  protected readonly skeletonRows = [0, 1, 2, 3];

  protected readonly collectionsToday = computed(() =>
    (this.summary()?.cash.collectionsToday ?? []).reduce((total, entry) => total + entry.total, 0),
  );

  protected readonly appointmentsToday = computed(() =>
    (this.summary()?.agenda.today ?? []).reduce((total, entry) => total + entry.count, 0),
  );

  protected readonly conversionPercent = computed(() => {
    const rate = this.summary()?.quotes.conversionRate ?? null;

    return rate === null ? '—' : `${Math.round(rate * 100)}%`;
  });

  protected readonly cashChart = computed<BarChartDatum[] | null>(() => {
    this.language();

    const summary = this.summary();

    if (summary === null) {
      return null;
    }

    return summary.cash.collectionsMonth.map((entry) => ({
      label: this.transloco.translate(METHOD_KEYS[entry.method]),
      value: entry.total,
    }));
  });

  protected readonly funnelChart = computed<BarChartDatum[] | null>(() => {
    this.language();

    const summary = this.summary();

    if (summary === null) {
      return null;
    }

    return QUOTE_STATUS_ORDER.map((status) => ({
      label: this.transloco.translate(QUOTE_STATUS_KEYS[status]!),
      value: summary.quotes.funnel[status] ?? 0,
    }));
  });

  protected readonly previsionChart = computed<BarChartDatum[] | null>(() => {
    this.language();

    const summary = this.summary();

    if (summary === null) {
      return null;
    }

    return summary.patients.prevision.map((entry) => ({
      label: entry.tipo,
      value: entry.count,
    }));
  });

  constructor() {
    this.load();

    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(true));
  }

  protected load(silent = false): void {
    if (!silent) {
      this.loading.set(true);
    }

    this.loadError.set(null);

    this.api.summary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.lastUpdated.set(new Date());
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(mapApiError(error));
        this.loading.set(false);
      },
    });
  }

  protected methodLabel(method: PaymentMethod): string {
    return METHOD_KEYS[method];
  }

  protected quoteStatusLabel(status: string): string {
    return QUOTE_STATUS_KEYS[status] ?? status;
  }

  protected appointmentStatusLabel(status: string): string {
    const key = APPOINTMENT_STATUS_KEYS[status];

    return key ?? status;
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat(this.language() === 'en' ? 'en-US' : 'es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat(this.language() === 'en' ? 'en-US' : 'es-CL').format(value);
  }

  protected formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(this.language() === 'en' ? 'en-US' : 'es-CL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
}
