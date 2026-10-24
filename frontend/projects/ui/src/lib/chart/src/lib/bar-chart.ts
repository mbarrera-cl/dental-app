import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Chart } from '@tanstack/angular-charts';
import { barY, defineChart } from '@tanstack/charts';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { HlmChart } from './hlm-chart';
import { HLM_CHART_THEME } from './hlm-chart-theme';
import { hlmChartTooltip } from './hlm-chart-tooltip';

export type BarChartValueFormat = 'number' | 'currency' | 'percent';

export interface BarChartDatum {
  label: string;
  value: number;
}

/**
 * Responsive bar chart shared by the dashboard and CaroIA. It renders one
 * series with the same TanStack/Spartan recipe used by the dashboard cards.
 */
@Component({
  selector: 'hexa-bar-chart',
  imports: [Chart, HlmChart],
  template: `<tanstack-chart hlmChart class="block w-full" [options]="options()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChart {
  readonly data = input.required<readonly BarChartDatum[]>();
  readonly ariaLabel = input<string>('Gráfico de barras');
  readonly valueLabel = input<string>('');
  readonly valueFormat = input<BarChartValueFormat>('number');
  readonly currency = input<string>('CLP');
  readonly locale = input<string>('es-CL');
  readonly height = input<number>(220);

  protected readonly options = computed(() => {
    const data = [...this.data()];
    const ariaLabel = this.ariaLabel();
    const rowLabel = this.valueLabel().trim() || ariaLabel;

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
          tooltip: hlmChartTooltip<BarChartDatum, string, number>({
            content: (points) => ({
              title: points[0]?.xValue,
              rows: points.map((point) => ({
                label: rowLabel,
                value: this.formatValue(point.yValue),
                color: point.color,
              })),
            }),
          }),
        },
      ),
      ariaLabel,
      ariaDescription: ariaLabel,
      height: this.height(),
    };
  });

  private formatValue(value: number): string {
    const locale = this.locale();
    const format = this.valueFormat();

    if (format === 'currency') {
      const currency = this.currency().trim().toUpperCase() || 'CLP';

      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'CLP' ? 0 : 2,
      }).format(value);
    }

    if (format === 'percent') {
      return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'percent',
        maximumFractionDigits: 1,
      }).format(value);
    }

    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  }
}
