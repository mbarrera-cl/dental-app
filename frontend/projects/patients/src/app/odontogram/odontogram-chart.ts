import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  PERMANENT_LOWER,
  PERMANENT_UPPER,
  PRIMARY_LOWER,
  PRIMARY_UPPER,
  SYMBOL_SHORT_CODES,
  activeFindings,
  type ClinicalFinding,
  type FindingState,
  type Surface,
} from 'data-access';

/** Which chart of the HCU form is drawn. */
export type Dentition = 'permanente' | 'temporal';

/** Everything the chart needs to know about one tooth, precomputed. */
interface ToothInfo {
  tooth: number;
  surfaces: Partial<Record<Surface, FindingState>>;
  /** Whole-tooth symbols (coronas, pérdidas, prótesis…), oldest first. */
  glyphs: ClinicalFinding[];
  recesion: number | null;
  movilidad: number | null;
}

interface ChartRow {
  key: 'upper' | 'lower';
  quadrants: ToothInfo[][];
}

const SURFACE_FILL: Record<FindingState, string> = {
  // Red: current pathology / pending treatment (classic odontogram colors).
  'a-realizar': '#fca5a5',
  // Blue: performed treatment.
  realizado: '#93c5fd',
};

/**
 * Pure odontogram chart: four quadrants of FDI teeth, each drawn as five
 * clickable regions (V/L/M/D border bands plus the O center). It only renders
 * and emits intents — adding findings and voiding them belongs to the page.
 */
@Component({
  selector: 'app-odontogram-chart',
  imports: [TranslocoPipe],
  template: `
    <div class="grid gap-4 overflow-x-auto pb-1">
      @for (row of rows(); track row.key) {
        <div class="flex items-start justify-center gap-4">
          @for (quadrant of row.quadrants; track $index) {
            <div class="flex gap-0.5">
              @for (tooth of quadrant; track tooth.tooth) {
                <div class="flex w-9 flex-col items-center gap-0.5">
                  <svg
                    viewBox="0 0 32 32"
                    class="size-8 cursor-pointer select-none"
                    [attr.data-testid]="'odontogram-tooth-' + tooth.tooth"
                    (click)="toothSelected.emit(tooth.tooth)"
                  >
                    <rect
                      x="0.5"
                      y="0.5"
                      width="31"
                      height="31"
                      class="fill-card"
                      [class]="selectedTooth() === tooth.tooth ? 'stroke-primary' : 'stroke-border'"
                      [attr.stroke-width]="selectedTooth() === tooth.tooth ? 2 : 1"
                    />

                    <polygon
                      points="1,1 31,1 26,6 6,6"
                      stroke-width="0.5"
                      class="stroke-border"
                      [attr.fill]="fillFor(tooth, 'V')"
                      [attr.data-testid]="'odontogram-surface-' + tooth.tooth + '-V'"
                      (click)="selectSurface(tooth.tooth, 'V', $event)"
                    >
                      <title>{{ 'clinical.odontogram.surfaces.V' | transloco }}</title>
                    </polygon>

                    <polygon
                      points="1,31 31,31 26,26 6,26"
                      stroke-width="0.5"
                      class="stroke-border"
                      [attr.fill]="fillFor(tooth, 'L')"
                      [attr.data-testid]="'odontogram-surface-' + tooth.tooth + '-L'"
                      (click)="selectSurface(tooth.tooth, 'L', $event)"
                    >
                      <title>{{ 'clinical.odontogram.surfaces.L' | transloco }}</title>
                    </polygon>

                    <polygon
                      points="1,1 6,6 6,26 1,31"
                      stroke-width="0.5"
                      class="stroke-border"
                      [attr.fill]="fillFor(tooth, 'M')"
                      [attr.data-testid]="'odontogram-surface-' + tooth.tooth + '-M'"
                      (click)="selectSurface(tooth.tooth, 'M', $event)"
                    >
                      <title>{{ 'clinical.odontogram.surfaces.M' | transloco }}</title>
                    </polygon>

                    <polygon
                      points="31,1 31,31 26,26 26,6"
                      stroke-width="0.5"
                      class="stroke-border"
                      [attr.fill]="fillFor(tooth, 'D')"
                      [attr.data-testid]="'odontogram-surface-' + tooth.tooth + '-D'"
                      (click)="selectSurface(tooth.tooth, 'D', $event)"
                    >
                      <title>{{ 'clinical.odontogram.surfaces.D' | transloco }}</title>
                    </polygon>

                    <rect
                      x="6"
                      y="6"
                      width="20"
                      height="20"
                      stroke-width="0.5"
                      class="stroke-border"
                      [attr.fill]="fillFor(tooth, 'O')"
                      [attr.data-testid]="'odontogram-surface-' + tooth.tooth + '-O'"
                      (click)="selectSurface(tooth.tooth, 'O', $event)"
                    >
                      <title>{{ 'clinical.odontogram.surfaces.O' | transloco }}</title>
                    </rect>
                  </svg>

                  <div class="flex min-h-3.5 flex-wrap items-center justify-center gap-0.5">
                    @for (glyph of tooth.glyphs; track glyph.id) {
                      <span
                        class="rounded border px-0.5 text-[9px] leading-3 font-semibold"
                        [class]="
                          glyph.state === 'a-realizar'
                            ? 'border-red-300 bg-red-100 text-red-700'
                            : 'border-blue-300 bg-blue-100 text-blue-700'
                        "
                        [title]="'clinical.odontogram.symbols.' + glyph.symbol | transloco"
                      >
                        {{ shortCode(glyph.symbol) }}
                      </span>
                    }
                  </div>

                  <span class="text-muted-foreground text-[10px] tabular-nums">
                    {{ tooth.tooth }}
                  </span>

                  @if (gradesLabel(tooth); as grades) {
                    <span class="text-muted-foreground text-[9px] leading-3 tabular-nums">
                      {{ grades }}
                    </span>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OdontogramChart {
  /** Full append-only log; the chart projects the current state itself. */
  readonly findings = input.required<readonly ClinicalFinding[]>();
  readonly dentition = input.required<Dentition>();
  readonly selectedTooth = input<number | null>(null);

  /** A click on the tooth body (its number/border). */
  readonly toothSelected = output<number>();
  /** A click on one of the five surface regions. */
  readonly surfaceSelected = output<{ tooth: number; surface: Surface }>();

  protected readonly rows = computed<ChartRow[]>(() => {
    const permanent = this.dentition() === 'permanente';
    const upper = permanent ? PERMANENT_UPPER : PRIMARY_UPPER;
    const lower = permanent ? PERMANENT_LOWER : PRIMARY_LOWER;
    const half = upper.length / 2;
    const info = this.toothInfos();

    return [
      {
        key: 'upper',
        quadrants: [
          upper.slice(0, half).map((tooth) => info.get(tooth) ?? emptyTooth(tooth)),
          upper.slice(half).map((tooth) => info.get(tooth) ?? emptyTooth(tooth)),
        ],
      },
      {
        key: 'lower',
        quadrants: [
          lower.slice(0, half).map((tooth) => info.get(tooth) ?? emptyTooth(tooth)),
          lower.slice(half).map((tooth) => info.get(tooth) ?? emptyTooth(tooth)),
        ],
      },
    ];
  });

  private readonly toothInfos = computed<Map<number, ToothInfo>>(() => {
    const byTooth = new Map<number, ToothInfo>();

    for (const finding of activeFindings(this.findings())) {
      const info = byTooth.get(finding.tooth) ?? emptyTooth(finding.tooth);

      for (const surface of finding.surfaces) {
        info.surfaces[surface] = finding.state;
      }

      if (finding.surfaces.length === 0) {
        info.glyphs.push(finding);
      }

      if (finding.recesion !== null) {
        info.recesion = finding.recesion;
      }

      if (finding.movilidad !== null) {
        info.movilidad = finding.movilidad;
      }

      byTooth.set(finding.tooth, info);
    }

    return byTooth;
  });

  protected fillFor(tooth: ToothInfo, surface: Surface): string {
    const state = tooth.surfaces[surface];

    return state === undefined ? 'transparent' : SURFACE_FILL[state];
  }

  protected shortCode(symbol: ClinicalFinding['symbol']): string {
    return SYMBOL_SHORT_CODES[symbol];
  }

  /** Classic notation: `R2` for recession, `M1` for mobility. */
  protected gradesLabel(tooth: ToothInfo): string | null {
    const grades: string[] = [];

    if (tooth.recesion !== null) grades.push(`R${tooth.recesion}`);
    if (tooth.movilidad !== null) grades.push(`M${tooth.movilidad}`);

    return grades.length === 0 ? null : grades.join(' · ');
  }

  protected selectSurface(tooth: number, surface: Surface, event: Event): void {
    // Surfaces sit inside the tooth; the parent click (toothSelected) must not
    // also fire when the operator points at a region.
    event.stopPropagation();
    this.surfaceSelected.emit({ tooth, surface });
  }
}

function emptyTooth(tooth: number): ToothInfo {
  return { tooth, surfaces: {}, glyphs: [], recesion: null, movilidad: null };
}
