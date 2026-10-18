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
import { HlmChartImports, HLM_CHART_THEME, hlmChartTooltip } from '@ui/chart';
import { HlmSkeleton } from '@ui/skeleton';
import { barY, defineChart } from '@tanstack/charts';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { DashboardApi, type DashboardSummary, mapApiError, type PaymentMethod } from 'data-access';

type ChartDatum = { label: string; value: number };

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
    ...HlmChartImports,
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

  protected readonly cashChart = computed(() => {
    this.language();

    const summary = this.summary();

    if (summary === null) {
      return null;
    }

    return this.barOptions(
      summary.cash.collectionsMonth.map((entry) => ({
        label: this.transloco.translate(METHOD_KEYS[entry.method]),
        value: entry.total,
      })),
      'dashboard.charts.cashAria',
    );
  });

  protected readonly funnelChart = computed(() => {
    this.language();

    const summary = this.summary();

    if (summary === null) {
      return null;
    }

    return this.barOptions(
      QUOTE_STATUS_ORDER.map((status) => ({
        label: this.transloco.translate(QUOTE_STATUS_KEYS[status]!),
        value: summary.quotes.funnel[status] ?? 0,
      })),
      'dashboard.charts.funnelAria',
    );
  });

  protected readonly previsionChart = computed(() => {
    this.language();

    const summary = this.summary();

    if (summary === null) {
      return null;
    }

    return this.barOptions(
      summary.patients.prevision.map((entry) => ({
        label: entry.tipo,
        value: entry.count,
      })),
      'dashboard.charts.previsionAria',
    );
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

  private barOptions(data: ChartDatum[], ariaLabelKey: string) {
    const ariaLabel = this.transloco.translate(ariaLabelKey);

    return {
      definition: defineChart(
        {
          marks: [
            barY(data, {
              id: 'bars',
              x: 'label',
              y: 'value',
              key: 'label',
              fill: 'var(--chart-2)',
            }),
          ],
          scales: {
            x: {
              scale: () => scaleBand<string>().paddingInner(0.25).paddingOuter(0.15),
              axis: {
                line: false,
                ticks: { size: 0, padding: 8 },
                tickLabels: { thin: { minGap: 24 } },
              },
            },
            y: { scale: scaleLinear, grid: true, axis: false },
          },
          theme: HLM_CHART_THEME,
        },
        {
          focus: 'group-x',
          tooltip: hlmChartTooltip<ChartDatum, string, number>({
            content: (points) => ({
              title: points[0]?.xValue,
              rows: points.map((point) => ({
                label: ariaLabel,
                value: point.yValue.toLocaleString(this.language() === 'en' ? 'en-US' : 'es-CL'),
                color: point.color,
              })),
            }),
          }),
        },
      ),
      ariaLabel,
      ariaDescription: ariaLabel,
      height: 220,
    };
  }
}
