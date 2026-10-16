import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { PermissionCatalog, PermissionCategory } from 'data-access';

interface MatrixItem {
  key: string;
  label: string;
  description: string;
  /** Granted through a role: shown checked, cannot be toggled. */
  inherited: boolean;
  checked: boolean;
}

interface MatrixCategory {
  id: string;
  title: string;
  selectedCount: number;
  total: number;
  editableCount: number;
  allSelected: boolean;
  expanded: boolean;
  items: MatrixItem[];
}

function matches(item: MatrixItem, needle: string): boolean {
  return (
    item.label.toLowerCase().includes(needle) ||
    item.description.toLowerCase().includes(needle) ||
    item.key.includes(needle)
  );
}

/**
 * Spartan-styled, reusable permission matrix: accordion per category, `n/m`
 * counters, per-category select-all, search, read-only mode and "via role"
 * locked items. Labels come from `permissions.categories.*` /
 * `permissions.items.*` with the backend descriptions as fallback.
 */
@Component({
  selector: 'hexa-permission-matrix',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <input
        type="search"
        data-testid="matrix-search"
        class="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring"
        [placeholder]="text().search"
        [value]="query()"
        (input)="onQuery($event)"
      />

      @for (category of filtered(); track category.id) {
        <section
          class="rounded-lg border border-border"
          data-testid="matrix-category"
          [attr.data-category]="category.id"
        >
          <header class="flex items-center justify-between gap-2 px-3 py-2">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 text-left"
              [attr.aria-expanded]="category.expanded"
              (click)="toggleCollapsed(category.id)"
            >
              <span class="truncate text-sm font-medium">{{ category.title }}</span>
              <span class="shrink-0 text-xs text-muted-foreground" data-testid="matrix-counter">
                {{ category.selectedCount }}/{{ category.total }}
              </span>
            </button>
            <button
              type="button"
              data-testid="matrix-select-all"
              class="shrink-0 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
              [disabled]="isReadonly() || category.editableCount === 0"
              (click)="toggleCategory(category)"
            >
              {{ category.allSelected ? text().clear : text().selectAll }}
            </button>
          </header>

          @if (category.expanded) {
            <ul class="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
              @for (item of category.items; track item.key) {
                <li data-testid="matrix-item" [attr.data-key]="item.key">
                  <label class="flex items-start gap-2">
                    <input
                      type="checkbox"
                      class="mt-0.5 size-4 shrink-0 accent-primary"
                      [checked]="item.checked"
                      [disabled]="isReadonly() || item.inherited"
                      (change)="toggle(item)"
                    />
                    <span class="min-w-0">
                      <span class="block text-sm">{{ item.label }}</span>
                      <span class="block text-xs text-muted-foreground">{{ item.description }}</span>
                    </span>
                    @if (item.inherited) {
                      <span
                        data-testid="matrix-inherited"
                        class="ml-auto shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary-foreground"
                      >
                        {{ text().viaRole }}
                      </span>
                    }
                  </label>
                </li>
              }
            </ul>
          }
        </section>
      } @empty {
        <p class="text-sm text-muted-foreground" data-testid="matrix-empty">{{ text().empty }}</p>
      }
    </div>
  `,
})
export class PermissionMatrixComponent {
  private readonly transloco = inject(TranslocoService);

  /** Code-defined catalog (the response of `GET /permissions`). */
  readonly catalog = input.required<PermissionCatalog>();

  /** Directly granted keys: the editable selection. */
  readonly selected = input<readonly string[]>([]);

  /** Keys granted through roles: shown checked and locked ("via role"). */
  readonly inherited = input<readonly string[]>([]);

  /** Locks the whole matrix (view-only mode). */
  readonly isReadonly = input(false, { alias: 'readonly' });

  /** Emits the new direct selection whenever the user toggles a key. */
  readonly selectedChange = output<readonly string[]>();

  readonly query = signal('');
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  readonly text = computed(() => {
    const matrix = this.transloco.translateObject('permissions.matrix') as Record<string, string> | null;

    return {
      search: matrix?.['search'] ?? 'Search permissions',
      selectAll: matrix?.['selectAll'] ?? 'Select all',
      clear: matrix?.['clear'] ?? 'Clear',
      viaRole: matrix?.['viaRole'] ?? 'via role',
      empty: matrix?.['empty'] ?? 'No permissions match the search',
    };
  });

  readonly filtered = computed<MatrixCategory[]>(() => {
    const categories = this.transloco.translateObject('permissions.categories') as Record<string, string> | null;
    const items = this.transloco.translateObject('permissions.items') as Record<string, string> | null;
    const selected = new Set(this.selected());
    const inherited = new Set(this.inherited());
    const needle = this.query().trim().toLowerCase();

    return this.catalog()
      .categories.map((category) =>
        this.buildCategory(category, selected, inherited, categories ?? {}, items ?? {}),
      )
      .map((category) => {
        if (needle === '') {
          return category;
        }

        const titleMatches = category.title.toLowerCase().includes(needle);
        const kept = titleMatches
          ? category.items
          : category.items.filter((item) => matches(item, needle));

        return { ...category, items: kept };
      })
      .filter((category) => category.items.length > 0);
  });

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  toggleCollapsed(id: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  toggle(item: MatrixItem): void {
    if (this.isReadonly() || item.inherited) {
      return;
    }

    const current = new Set(this.selected());

    if (current.has(item.key)) {
      current.delete(item.key);
    } else {
      current.add(item.key);
    }

    this.selectedChange.emit([...current]);
  }

  toggleCategory(category: MatrixCategory): void {
    if (this.isReadonly()) {
      return;
    }

    const current = new Set(this.selected());
    const editable = category.items.filter((item) => !item.inherited);

    for (const item of editable) {
      if (category.allSelected) {
        current.delete(item.key);
      } else {
        current.add(item.key);
      }
    }

    this.selectedChange.emit([...current]);
  }

  private buildCategory(
    category: PermissionCategory,
    selected: ReadonlySet<string>,
    inherited: ReadonlySet<string>,
    categoryLabels: Record<string, string>,
    itemLabels: Record<string, string>,
  ): MatrixCategory {
    const items = category.permissions.map((permission) => {
      const viaRole = inherited.has(permission.key);

      return {
        key: permission.key,
        label: itemLabels[permission.key] ?? permission.description,
        description: permission.description,
        inherited: viaRole,
        checked: selected.has(permission.key) || viaRole,
      };
    });
    const editable = items.filter((item) => !item.inherited);
    const selectedCount = items.filter((item) => item.checked).length;

    return {
      id: category.id,
      title: categoryLabels[category.id] ?? category.description,
      selectedCount,
      total: items.length,
      editableCount: editable.length,
      allSelected: editable.length > 0 && editable.every((item) => item.checked),
      expanded: !this.collapsed().has(category.id),
      items,
    };
  }
}
