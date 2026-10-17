import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideRotateCcw, lucideTriangleAlert, lucideUndo2 } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmSkeleton } from '@ui/skeleton';
import { HlmSpinner } from '@ui/spinner';
import { HasPermissionDirective, PERMISSION_KEYS } from 'auth';
import {
  SettingsApi,
  mapApiError,
  type Setting,
  type SettingValue,
  type SettingsValues,
} from 'data-access';

interface SettingGroup {
  group: string;
  items: Setting[];
}

/**
 * Settings section: a form generated from `GET /settings` alone. Each
 * definition carries its type, bounds, default and description, so adding a
 * setting to the backend registry makes it appear here with no frontend
 * change. Edits accumulate in a draft map (`dirty-state`) and are applied in
 * one `PATCH`; the response is the full merged list.
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmInput,
    HlmBadge,
    HlmSkeleton,
    HlmSpinner,
    HasPermissionDirective,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideRotateCcw, lucideTriangleAlert, lucideUndo2 })],
  templateUrl: './settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly api = inject(SettingsApi);
  private readonly transloco = inject(TranslocoService);

  /** Typed permission keys, so the template never hard-codes strings. */
  protected readonly permissionKeys = PERMISSION_KEYS;

  protected readonly settings = signal<Setting[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  /** Changed values only: `key -> new value`. */
  protected readonly draft = signal<SettingsValues>({});

  protected readonly dirtyCount = computed(() => Object.keys(this.draft()).length);

  /**
   * Settings grouped in registry order. The `clinic` group is skipped: it is
   * edited from its own panel (`/settings/clinic`), not from this dynamic
   * form, which only knows numeric and boolean rows.
   */
  protected readonly groups = computed<SettingGroup[]>(() => {
    const groups = new Map<string, Setting[]>();

    for (const setting of this.settings()) {
      if (setting.group === 'clinic') {
        continue;
      }

      const items = groups.get(setting.group) ?? [];
      items.push(setting);
      groups.set(setting.group, items);
    }

    return [...groups.entries()].map(([group, items]) => ({ group, items }));
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api.list().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.draft.set({});
      },
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });
  }

  // --- i18n labels (literal keys, like the permission matrix) --------------

  protected groupLabel(group: string): string {
    return this.labels('settings.groups')[group] ?? group;
  }

  protected itemLabel(setting: Setting): string {
    const labels = this.labels(`settings.items.${setting.group}`);
    const name = setting.key.slice(setting.group.length + 1);

    return labels[name] ?? setting.description;
  }

  // --- Draft handling ------------------------------------------------------

  protected valueOf(setting: Setting): SettingValue {
    return this.draft()[setting.key] ?? setting.value;
  }

  protected isDirty(setting: Setting): boolean {
    return setting.key in this.draft();
  }

  protected onNumberInput(setting: Setting, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;

    if (raw.trim() === '') {
      return;
    }

    const value = Number(raw);

    if (!Number.isFinite(value)) {
      return;
    }

    this.setValue(setting, value);
  }

  protected onToggle(setting: Setting, checked: boolean): void {
    this.setValue(setting, checked);
  }

  /** Puts the registry default in the draft (still requires saving). */
  protected useDefault(setting: Setting): void {
    this.setValue(setting, setting.default);
  }

  /** Drops the draft value of one row: back to the stored value. */
  protected reset(setting: Setting): void {
    this.draft.update((draft) => {
      const next = { ...draft };
      delete next[setting.key];
      return next;
    });
  }

  protected discard(): void {
    this.draft.set({});
  }

  protected save(): void {
    if (this.dirtyCount() === 0) {
      return;
    }

    this.saving.set(true);

    this.api.update({ values: this.draft() }).subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.draft.set({});
        this.saving.set(false);
        toast.success(this.transloco.translate('settings.toasts.saved'));
      },
      error: (error: unknown) => {
        this.saving.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  private setValue(setting: Setting, value: SettingValue): void {
    if (setting.value === value) {
      this.reset(setting);
      return;
    }

    this.draft.update((draft) => ({ ...draft, [setting.key]: value }));
  }

  private labels(key: string): Record<string, string> {
    return (this.transloco.translateObject(key) as Record<string, string> | null) ?? {};
  }
}
