import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHistory } from '@ng-icons/lucide';
import { HlmBadge } from '@ui/badge';
import { formatDateTime } from 'ui';
import type { ClinicalEvent } from 'data-access';
import { ClinicalRecordStore } from '../clinical-record.store';

/**
 * Clinical timeline of the ficha: every audited action (record edits,
 * findings, voids, finalization and treatment plan changes), newest first.
 */
@Component({
  selector: 'app-timeline-page',
  imports: [TranslocoPipe, NgIcon, HlmBadge],
  providers: [provideIcons({ lucideHistory })],
  templateUrl: './timeline-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelinePage {
  private readonly transloco = inject(TranslocoService);
  private readonly store = inject(ClinicalRecordStore);

  protected readonly events = this.store.events;
  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected actionLabelKey(action: string): string {
    return `clinical.timeline.actions.${action}`;
  }

  protected formatDate(iso: string): string {
    return formatDateTime(iso, this.language());
  }

  protected eventPayload(event: ClinicalEvent): string | null {
    if (event.payload === null || typeof event.payload !== 'object') {
      return null;
    }

    // A compact secondary line: tooth + procedure/status when present.
    const payload = event.payload as Record<string, unknown>;
    const parts: string[] = [];

    if (typeof payload['tooth'] === 'number') {
      parts.push(`#${payload['tooth']}`);
    }

    if (typeof payload['procedure'] === 'string') {
      parts.push(payload['procedure']);
    }

    if (typeof payload['status'] === 'string') {
      parts.push(String(payload['status']));
    }

    return parts.length === 0 ? null : parts.join(' · ');
  }
}
