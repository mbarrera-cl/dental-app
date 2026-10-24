import { Chart, ChartTooltipBodyDirective } from '@tanstack/angular-charts';
import { HlmChart } from './lib/hlm-chart';

export * from './lib/hlm-chart';
export * from './lib/hlm-chart-theme';
export * from './lib/hlm-chart-tooltip';
export * from './lib/bar-chart';

export const HlmChartImports = [Chart, ChartTooltipBodyDirective, HlmChart] as const;
