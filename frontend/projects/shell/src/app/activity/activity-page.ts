import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideRefreshCw,
  lucideTrash2,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import { PERMISSION_KEYS, SessionStore } from 'auth';
import {
  ACTIVITY_MODULES,
  type ActivityEntry,
  type ActivityOutcome,
} from 'data-access';
import { formatDateTime, formatRelativeTime } from 'ui';
import { activityActionLabel, activityActorLabel, activityModuleLabel } from './activity-labels';
import { ActivityPurgeDialog } from './activity-purge-dialog';
import { ActivityStore } from './activity-store';

/**
 * Full activity page: filters, keyset pagination and the audited purge.
 * The header panel and this page share the same `ActivityStore`, so opening
 * one warms the other.
 */
@Component({
  selector: 'app-activity-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    HlmBadge,
    HlmButton,
    HlmInput,
    HlmLabel,
    ActivityPurgeDialog,
  ],
  providers: [provideIcons({ lucideActivity, lucideRefreshCw, lucideTrash2, lucideTriangleAlert })],
  templateUrl: './activity-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityPage implements OnInit {
  private readonly transloco = inject(TranslocoService);
  private readonly session = inject(SessionStore);

  protected readonly store = inject(ActivityStore);
  protected readonly modules = ACTIVITY_MODULES;
  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  protected readonly canReadAll = computed(() => this.session.has(PERMISSION_KEYS.activity.readAll));
  protected readonly canPurge = computed(() => this.session.has(PERMISSION_KEYS.activity.purge));
  protected readonly mine = signal(false);
  protected readonly purgeOpen = signal(false);

  ngOnInit(): void {
    if (this.store.items().length === 0) {
      this.store.load();
    }
  }

  protected refresh(): void {
    this.store.load();
  }

  protected loadMore(): void {
    this.store.loadMore();
  }

  protected onModule(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    this.store.setFilters({ module: value === '' ? null : value });
  }

  protected onOutcome(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const outcome: ActivityOutcome | null =
      value === 'success' || value === 'failure' ? value : null;

    this.store.setFilters({ outcome });
  }

  protected onFrom(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.store.setFilters({ from: value === '' ? null : startOfDay(value) });
  }

  protected onTo(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.store.setFilters({ to: value === '' ? null : endOfDay(value) });
  }

  protected onMine(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    this.mine.set(checked);
    this.store.setFilters({ actorId: checked ? (this.session.user()?.id ?? null) : null });
  }

  protected clearFilters(): void {
    this.mine.set(false);
    this.store.clearFilters();
  }

  protected moduleLabel(module: string): string {
    return activityModuleLabel(module, this.transloco);
  }

  protected actorLabel(entry: ActivityEntry): string {
    return activityActorLabel(entry, (key) => this.transloco.translate(key));
  }

  protected actionLabel(entry: ActivityEntry): string {
    return activityActionLabel(entry, this.transloco);
  }

  protected initial(entry: ActivityEntry): string {
    return (entry.actor.name ?? entry.actor.email ?? '?').charAt(0).toUpperCase();
  }

  protected relative(iso: string): string {
    return formatRelativeTime(iso, this.language());
  }

  protected absolute(iso: string): string {
    return formatDateTime(iso, this.language());
  }
}

function startOfDay(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

function endOfDay(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}
