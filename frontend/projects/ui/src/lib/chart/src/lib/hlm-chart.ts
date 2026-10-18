import { Directive } from '@angular/core';
import { classes } from '@ui/utils';

/**
 * Spartan chart surface: maps TanStack Charts' theme variables onto the
 * semantic tokens of the design system (see `libs/helm/chart` upstream).
 */
@Directive({
  selector: 'tanstack-chart[hlmChart]',
  exportAs: 'hlmChart',
  host: {
    'data-slot': 'chart',
    style: `
      --ts-chart-1: var(--chart-1);
      --ts-chart-2: var(--chart-2);
      --ts-chart-3: var(--chart-3);
      --ts-chart-4: var(--chart-4);
      --ts-chart-5: var(--chart-5);
      --ts-chart-focus-fill: var(--background);
      --ts-chart-crosshair-label-halo: var(--background);
      --ts-chart-crosshair-marker-fill: var(--background);
      --ts-chart-tooltip-background: var(--popover);
      --ts-chart-tooltip-color: var(--popover-foreground);
      --ts-chart-tooltip-border: 1px solid var(--border);
    `,
  },
})
export class HlmChart {
  constructor() {
    classes(() => 'spartan-chart text-foreground');
  }
}
