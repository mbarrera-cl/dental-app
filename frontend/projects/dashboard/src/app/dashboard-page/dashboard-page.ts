import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideRefreshCw, lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmButton } from '@ui/button';
import { HlmCard, HlmCardContent, HlmCardDescription, HlmCardFooter, HlmCardHeader, HlmCardTitle } from '@ui/card';
import { HlmSkeleton } from '@ui/skeleton';
import { mapApiError, UsersApi, type User } from 'data-access';
import { formatDateTime } from 'ui';

/** Live summary of the users API: total count and the 5 most recent users. */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmCard,
    HlmCardHeader,
    HlmCardTitle,
    HlmCardDescription,
    HlmCardContent,
    HlmCardFooter,
    HlmSkeleton,
  ],
  providers: [provideIcons({ lucideArrowRight, lucideRefreshCw, lucideTriangleAlert })],
  templateUrl: './dashboard-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(UsersApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly total = computed(() => this.users().length);

  protected readonly latest = computed(() =>
    [...this.users()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api.list().subscribe({
      next: (users) => this.users.set(users),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });
  }

  protected formatDate(createdAt: string): string {
    return formatDateTime(createdAt, this.language());
  }
}
