import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLock, lucideRefreshCw, lucideRotateCcw, lucideSlidersHorizontal, lucideTriangleAlert, lucideUndo2 } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmSkeleton } from '@ui/skeleton';
import { HlmSpinner } from '@ui/spinner';
import { HasPermissionDirective, PERMISSION_KEYS, SessionStore } from 'auth';
import {
  SettingsApi,
  mapApiError,
  type Setting,
  type SettingValue,
  type SettingsValues,
} from 'data-access';

interface SettingSection {
  group: string;
  security: boolean;
  items: Setting[];
}

/**
 * Settings section: a form generated from `GET /settings` alone. Each
 * definition carries its type, bounds, default and description, so adding a
 * setting to the backend registry makes it appear here with no frontend
 * change.
 *
 * The form is split in two blocks driven by the registry `sensitivity` flag:
 * security settings (password policy, lockout, tokens, write gates) require
 * `settings:update-security` and are hidden without it; operational settings
 * keep working with plain `settings:update`. Edits accumulate in one draft
 * map and each block saves only its own keys in a single `PATCH`.
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    NgTemplateOutlet,
    HlmButton,
    HlmInput,
    HlmBadge,
    HlmSkeleton,
    HlmSpinner,
    HasPermissionDirective,
  ],
  providers: [
    provideIcons({
      lucideRefreshCw,
      lucideRotateCcw,
      lucideTriangleAlert,
      lucideUndo2,
      lucideLock,
      lucideSlidersHorizontal,
    }),
  ],
  templateUrl: './settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly api = inject(SettingsApi);
  private readonly transloco = inject(TranslocoService);
  private readonly session = inject(SessionStore);

  /** Typed permission keys, so the template never hard-codes strings. */
  protected readonly permissionKeys = PERMISSION_KEYS;

  protected readonly settings = signal<Setting[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  /** Changed values only: `key -> new value`. */
  protected readonly draft = signal<SettingsValues>({});

  protected readonly canEditSecurity = computed(() =>
    this.session.has(PERMISSION_KEYS.settings.updateSecurity),
  );

  protected readonly dirtyCount = computed(() => Object.keys(this.draft()).length);

  protected readonly securityDirtyCount = computed(() =>
    Object.keys(this.draft()).filter((key) => this.isSecurity(key)).length,
  );

  protected readonly standardDirtyCount = computed(() =>
    Object.keys(this.draft()).filter((key) => !this.isSecurity(key)).length,
  );

  /**
   * Settings grouped in registry order, split by `sensitivity`. The `clinic`
   * group is skipped: it is edited from its own panel (`/settings/clinic`),
   * not from this dynamic form, which only knows numeric and boolean rows.
   * The same goes for `agenda`, which has its own page. A group with mixed
   * sensitivity (e.g. `mcp`) appears once per block, with its own rows.
   */
  protected readonly sections = computed<SettingSection[]>(() => {
    const sections = new Map<string, SettingSection>();

    for (const setting of this.settings()) {
      if (setting.group === 'clinic' || setting.group === 'agenda') {
        continue;
      }

      const security = setting.sensitivity === 'security';
      const key = `${setting.group}:${security}`;
      const section = sections.get(key) ?? { group: setting.group, security, items: [] };
      section.items.push(setting);
      sections.set(key, section);
    }

    return [...sections.values()];
  });

  protected readonly securitySections = computed(() =>
    this.sections().filter((section) => section.security),
  );

  protected readonly standardSections = computed(() =>
    this.sections().filter((section) => !section.security),
  );

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

  /** Stable `@for` key: the same group may appear once per sensitivity block. */
  protected trackSection(section: SettingSection): string {
    return `${section.group}:${section.security}`;
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

  /** Saves only the security-sensitive rows of the draft. */
  protected saveSecurity(): void {
    this.save((key) => this.isSecurity(key));
  }

  /** Saves only the operational rows of the draft. */
  protected saveStandard(): void {
    this.save((key) => !this.isSecurity(key));
  }

  protected save(predicate: (key: string) => boolean): void {
    const values = Object.fromEntries(
      Object.entries(this.draft()).filter(([key]) => predicate(key)),
    );

    if (Object.keys(values).length === 0) {
      return;
    }

    this.saving.set(true);

    this.api.update({ values }).subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.draft.update((draft) => {
          const next = { ...draft };

          for (const key of Object.keys(values)) {
            delete next[key];
          }

          return next;
        });
        this.saving.set(false);
        toast.success(this.transloco.translate('settings.toasts.saved'));
      },
      error: (error: unknown) => {
        this.saving.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  private isSecurity(key: string): boolean {
    return this.settings().find((setting) => setting.key === key)?.sensitivity === 'security';
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
