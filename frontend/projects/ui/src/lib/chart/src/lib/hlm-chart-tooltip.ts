import { hlm } from '@ui/utils';
import type { ChartTooltipInput, ChartTooltipOptions, ChartValue } from '@tanstack/charts';
import { tooltip } from '@tanstack/charts/tooltip';

/** Enables TanStack's DOM tooltip with the design-system styling. */
export function hlmChartTooltip<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  options: ChartTooltipOptions<TDatum, TXValue, TYValue> = {},
): ChartTooltipInput<TDatum, TXValue, TYValue, 'dom'> {
  return {
    use: tooltip,
    ...options,
    className: hlm('spartan-chart-tooltip', options.className),
  };
}
