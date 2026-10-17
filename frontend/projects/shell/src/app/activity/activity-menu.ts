import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideArrowRight,
  lucideRefreshCw,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButton } from '@ui/button';
import { formatDateTime, formatRelativeTime } from 'ui';
import type { ActivityEntry } from 'data-access';
import { activityActionLabel, activityActorLabel } from './activity-labels';
import { ActivityStore } from './activity-store';

/**
 * Header entry point of the activity trail: a badge with the unseen count and
 * a dropdown with the latest entries. The full page lives at `/activity`.
 */
@Component({
  selector: 'app-activity-menu',
  imports: [RouterLink, NgIcon, TranslocoPipe, HlmButton],
  providers: [provideIcons({ lucideActivity, lucideArrowRight, lucideRefreshCw, lucideTriangleAlert })],
  templateUrl: './activity-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityMenu implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly transloco = inject(TranslocoService);

  protected readonly store = inject(ActivityStore);
  protected readonly open = signal(false);
  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  ngOnInit(): void {
    this.store.load();
  }

  ngOnDestroy(): void {
    this.store.stopPolling();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();

      return;
    }

    this.open.set(true);
    this.store.markSeen();
    this.store.load(undefined, true);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected refresh(): void {
    this.store.load(undefined, true);
  }

  protected actorLabel(entry: ActivityEntry): string {
    return activityActorLabel(entry, (key) => this.transloco.translate(key));
  }

  protected actionLabel(entry: ActivityEntry): string {
    return activityActionLabel(entry, this.transloco);
  }

  protected subjectLabel(entry: ActivityEntry): string | null {
    return entry.subject.label;
  }

  protected relative(iso: string): string {
    return formatRelativeTime(iso, this.language());
  }

  protected absolute(iso: string): string {
    return formatDateTime(iso, this.language());
  }

  protected initial(entry: ActivityEntry): string {
    const name = entry.actor.name ?? entry.actor.email ?? '?';

    return name.charAt(0).toUpperCase();
  }
}
