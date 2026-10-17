import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@ui/button';
import {
  HlmDialog,
  HlmDialogClose,
  HlmDialogContent,
  HlmDialogDescription,
  HlmDialogFooter,
  HlmDialogHeader,
  HlmDialogPortal,
  HlmDialogTitle,
} from '@ui/dialog';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import { mapApiError } from 'data-access';
import { ActivityStore } from './activity-store';

const CONFIRMATION_WORD = 'PURGAR';

/**
 * Destructive cleanup with an explicit scope, a preview count and a typed
 * confirmation. The backend audits the purge itself, so it survives its own
 * scope (including “everything”).
 */
@Component({
  selector: 'app-activity-purge-dialog',
  imports: [
    TranslocoPipe,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmDialog,
    HlmDialogClose,
    HlmDialogContent,
    HlmDialogDescription,
    HlmDialogFooter,
    HlmDialogHeader,
    HlmDialogPortal,
    HlmDialogTitle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-dialog [state]="open() ? 'open' : 'closed'" (stateChanged)="onStateChanged($event)">
      <hlm-dialog-content *hlmDialogPortal="let ctx" class="sm:max-w-md">
        <hlm-dialog-header>
          <h3 hlmDialogTitle>{{ 'activity.purge.title' | transloco }}</h3>
          <p hlmDialogDescription>{{ 'activity.purge.description' | transloco }}</p>
        </hlm-dialog-header>

        <div class="grid gap-4 py-2">
          <fieldset class="grid gap-2">
            <legend class="text-sm font-medium">{{ 'activity.purge.mode' | transloco }}</legend>
            <label class="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="purge-mode"
                class="accent-primary size-4"
                [checked]="mode() === 'before'"
                (change)="setMode('before')"
              />
              {{ 'activity.purge.olderThan' | transloco }}
            </label>
            @if (mode() === 'before') {
              <input
                hlmInput
                type="date"
                class="w-full"
                [value]="before()"
                data-testid="activity-purge-before"
                (change)="setBefore($event)"
              />
            }
            <label class="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="purge-mode"
                class="accent-primary size-4"
                [checked]="mode() === 'all'"
                (change)="setMode('all')"
              />
              <span class="text-destructive">{{ 'activity.purge.all' | transloco }}</span>
            </label>
          </fieldset>

          <div class="bg-muted/50 rounded-md px-3 py-2 text-sm">
            @if (previewing()) {
              {{ 'common.loading' | transloco }}
            } @else if (count() !== null) {
              {{ 'activity.purge.preview' | transloco: { count: count() } }}
            } @else {
              {{ 'activity.purge.previewHint' | transloco }}
            }
          </div>

          <div class="grid gap-2">
            <label hlmLabel for="purge-confirm">
              {{ 'activity.purge.confirm' | transloco: { word: word } }}
            </label>
            <input
              hlmInput
              id="purge-confirm"
              autocomplete="off"
              [value]="confirmation()"
              data-testid="activity-purge-confirmation"
              (input)="setConfirmation($event)"
            />
          </div>

          @if (errorKey(); as key) {
            <p
              role="alert"
              class="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
            >
              {{ key | transloco }}
            </p>
          }
        </div>

        <hlm-dialog-footer>
          <button hlmBtn variant="outline" type="button" hlmDialogClose>
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            hlmBtn
            variant="destructive"
            type="button"
            [disabled]="!canSubmit()"
            data-testid="activity-purge-submit"
            (click)="submit()"
          >
            {{ (purging() ? 'activity.purge.purging' : 'activity.purge.submit') | transloco }}
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class ActivityPurgeDialog {
  private readonly store = inject(ActivityStore);
  private readonly transloco = inject(TranslocoService);

  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly word = CONFIRMATION_WORD;
  protected readonly mode = signal<'before' | 'all'>('before');
  protected readonly before = signal(defaultCutoff());
  protected readonly confirmation = signal('');
  protected readonly count = signal<number | null>(null);
  protected readonly previewing = signal(false);
  protected readonly purging = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.closed.emit();

      return;
    }

    this.confirmation.set('');
    this.errorKey.set(null);
    this.count.set(null);
    this.preview();
  }

  protected setMode(mode: 'before' | 'all'): void {
    this.mode.set(mode);
    this.preview();
  }

  protected setBefore(event: Event): void {
    this.before.set((event.target as HTMLInputElement).value);
    this.preview();
  }

  protected setConfirmation(event: Event): void {
    this.confirmation.set((event.target as HTMLInputElement).value);
  }

  protected canSubmit(): boolean {
    return (
      !this.purging() &&
      this.confirmation() === CONFIRMATION_WORD &&
      (this.mode() === 'all' || this.before() !== '')
    );
  }

  protected preview(): void {
    if (this.mode() === 'before' && this.before() === '') {
      this.count.set(null);
      this.previewing.set(false);

      return;
    }

    this.count.set(null);
    this.previewing.set(true);

    this.store.previewPurge(this.query()).subscribe({
      next: (result) => this.count.set(result.count),
      error: (error: unknown) => this.errorKey.set(mapApiError(error)),
      complete: () => this.previewing.set(false),
    });
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      return;
    }

    this.purging.set(true);
    this.errorKey.set(null);

    this.store.purge(this.query()).subscribe({
      next: (result) => {
        toast.success(this.transloco.translate('activity.purge.success', { count: result.deleted }));
        this.purging.set(false);
        this.closed.emit();
      },
      error: (error: unknown) => {
        this.purging.set(false);
        this.errorKey.set(mapApiError(error));
      },
    });
  }

  private query(): { all: true } | { before: string } {
    if (this.mode() === 'all') {
      return { all: true };
    }

    return { before: new Date(`${this.before()}T00:00:00`).toISOString() };
  }
}

function defaultCutoff(): string {
  const date = new Date();

  date.setDate(date.getDate() - 180);

  return date.toISOString().slice(0, 10);
}
