import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '../../button/src/lib/hlm-button';

/** Sizes offered by default; the active one is always added by the component. */
const DEFAULT_PAGE_SIZES: readonly number[] = [10, 25, 50, 100];

/**
 * Page footer shared by every list:
 *
 * ```html
 * <hexa-paginator
 *   [total]="filtered().length"
 *   [page]="page()"
 *   [pageSize]="pageSize()"
 *   (pageChange)="page.set($event)"
 *   (pageSizeChange)="pageSize.set($event)" />
 * ```
 *
 * It is presentation-only: the owner keeps `page`/`pageSize` and decides
 * whether it pages in memory or asks the server for the next slice.
 */
@Component({
  selector: 'hexa-paginator',
  imports: [HlmButton, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideChevronLeft, lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      class="text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm"
      [attr.aria-label]="'common.pagination.label' | transloco"
    >
      <p aria-live="polite">
        @if (total() === 0) {
          {{ 'common.pagination.empty' | transloco }}
        } @else {
          {{
            'common.pagination.range'
              | transloco: { from: first(), to: last(), total: total() }
          }}
        }
      </p>

      <div class="flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-2">
          <span>{{ 'common.pagination.rowsPerPage' | transloco }}</span>
          <select
            class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-sm outline-none focus-visible:ring-3"
            [value]="pageSize()"
            (change)="onPageSizeChange($event)"
          >
            @for (size of sizeOptions(); track size) {
              <option [value]="size" [selected]="size === pageSize()">{{ size }}</option>
            }
          </select>
        </label>

        <div class="flex items-center gap-1">
          <button
            type="button"
            hlmBtn
            variant="outline"
            size="icon-sm"
            [disabled]="!canGoPrevious()"
            [attr.aria-label]="'common.pagination.previous' | transloco"
            (click)="goTo(page() - 1)"
          >
            <ng-icon name="lucideChevronLeft" />
          </button>

          <span class="min-w-24 text-center text-xs tabular-nums">
            {{
              'common.pagination.page'
                | transloco: { page: safePage(), pages: totalPages() }
            }}
          </span>

          <button
            type="button"
            hlmBtn
            variant="outline"
            size="icon-sm"
            [disabled]="!canGoNext()"
            [attr.aria-label]="'common.pagination.next' | transloco"
            (click)="goTo(page() + 1)"
          >
            <ng-icon name="lucideChevronRight" />
          </button>
        </div>
      </div>
    </nav>
  `,
})
export class PaginatorComponent {
  /** Rows matching the current filters, across every page. */
  readonly total = input.required<number>();
  /** 1-based current page. */
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  /** Sizes offered in the selector; the active one is always included. */
  readonly sizes = input<readonly number[]>(DEFAULT_PAGE_SIZES);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(Math.max(0, this.total()) / Math.max(1, this.pageSize()))),
  );
  protected readonly safePage = computed(() =>
    Math.min(Math.max(1, Math.trunc(this.page())), this.totalPages()),
  );
  protected readonly first = computed(() =>
    this.total() === 0 ? 0 : (this.safePage() - 1) * this.pageSize() + 1,
  );
  protected readonly last = computed(() =>
    Math.min(this.total(), this.safePage() * this.pageSize()),
  );
  protected readonly canGoPrevious = computed(() => this.safePage() > 1);
  protected readonly canGoNext = computed(() => this.safePage() < this.totalPages());
  protected readonly sizeOptions = computed(() =>
    [...new Set([...this.sizes(), this.pageSize()])].sort((a, b) => a - b),
  );

  protected goTo(page: number): void {
    const target = Math.min(Math.max(1, Math.trunc(page)), this.totalPages());

    if (target !== this.safePage()) {
      this.pageChange.emit(target);
    }
  }

  protected onPageSizeChange(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);

    if (Number.isInteger(size) && size > 0 && size !== this.pageSize()) {
      this.pageSizeChange.emit(size);
    }
  }
}
