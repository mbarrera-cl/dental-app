import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronRight,
  lucideExternalLink,
  lucidePanelLeftClose,
  lucidePanelLeftOpen,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { MenuItem, MenuKind } from 'data-access';
import { MENU_ICONS, MENU_ICON_FALLBACK, resolveIcon } from './icon-catalog';
import { NavigationStore } from './navigation-store';
import { defaultIcon, resolveRoute } from './route-registry';

/** Where the collapsed rail state is remembered between visits. */
const COLLAPSED_STORAGE_KEY = 'hexa.menu.collapsed';

/** View model of one sidebar entry: labels resolved and already translated. */
interface SidebarNode {
  readonly id: string;
  readonly kind: MenuKind;
  readonly label: string;
  readonly icon: string;
  readonly path: string | null;
  readonly externalUrl: string | null;
  readonly children: readonly SidebarNode[];
}

/**
 * The configurable side menu. Draws the tree served by `GET /navigation`
 * (already filtered by the principal's permissions): labels fall back to the
 * route registry's i18n key, unknown route keys never render, groups expand
 * in place, dividers separate sections and external links open in a new tab.
 *
 * Desktop: collapsible rail (state persisted in `localStorage`). Mobile: an
 * off-canvas drawer opened from the header (see `NavigationStore.mobileOpen`).
 */
@Component({
  selector: 'app-sidebar',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, NgIcon, TranslocoPipe],
  providers: [
    provideIcons(MENU_ICONS),
    provideIcons({ lucideChevronRight, lucideExternalLink, lucidePanelLeftClose, lucidePanelLeftOpen }),
  ],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  protected readonly store = inject(NavigationStore);

  private readonly transloco = inject(TranslocoService);
  private readonly collapsedGroups = signal<ReadonlySet<string>>(new Set());

  protected readonly collapsed = signal(readCollapsedState());

  // Re-resolves every label whenever the shared language changes.
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly nodes = computed<readonly SidebarNode[]>(() => {
    this.activeLang();

    return this.project(this.store.tree());
  });

  protected readonly positionClass = computed(() => {
    const position = this.store.mobileOpen()
      ? 'translate-x-0'
      : '-translate-x-full md:translate-x-0';
    const width = this.collapsed() ? 'md:w-14' : 'md:w-56';

    return `${position} ${width}`;
  });

  protected isExpanded(id: string): boolean {
    return !this.collapsedGroups().has(id);
  }

  protected toggleGroup(id: string): void {
    if (this.collapsed()) {
      // Icon-only rail: expanding it is the only useful reaction.
      this.toggleCollapsed();
      return;
    }

    this.collapsedGroups.update((groups) => {
      const next = new Set(groups);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => {
      const next = !value;

      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Storage disabled (private mode): the rail still toggles in memory.
      }

      return next;
    });
  }

  /** Projects the API tree into render-ready nodes (label, icon, path). */
  private project(items: readonly MenuItem[]): SidebarNode[] {
    const nodes: SidebarNode[] = [];

    for (const item of items) {
      if (item.kind === 'divider') {
        nodes.push({
          id: item.id,
          kind: 'divider',
          label: '',
          icon: MENU_ICON_FALLBACK,
          path: null,
          externalUrl: null,
          children: [],
        });
        continue;
      }

      if (item.kind === 'group') {
        const children = this.project(item.children);

        if (children.length > 0) {
          nodes.push({
            id: item.id,
            kind: 'group',
            label: item.label ?? '',
            icon: this.iconOf(item),
            path: null,
            externalUrl: null,
            children,
          });
        }

        continue;
      }

      const route = item.routeKey === null ? undefined : resolveRoute(item.routeKey);
      const path = item.externalUrl === null ? (route?.path ?? null) : null;

      if (path === null && item.externalUrl === null) {
        // Unknown route key: never rendered here; the editor flags it.
        continue;
      }

      nodes.push({
        id: item.id,
        kind: 'item',
        label: item.label ?? (route === undefined ? '' : this.transloco.translate(route.label)),
        icon: this.iconOf(item),
        path,
        externalUrl: item.externalUrl,
        children: [],
      });
    }

    return nodes;
  }

  private iconOf(item: MenuItem): string {
    return resolveIcon(item.icon ?? defaultIcon(item.routeKey) ?? null);
  }
}

function readCollapsedState(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
