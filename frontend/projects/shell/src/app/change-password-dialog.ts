import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { SessionStore } from 'auth';
import { mapApiError } from 'data-access';
import {
  errorNameOf,
  violationsOf,
  violationLabel,
  type PasswordViolation,
} from './password-violations';

/**
 * Changes the password of the current session. Policy violations are listed
 * per rule (translated, with the API message as fallback) and a wrong current
 * password is reported separately.
 */
@Component({
  selector: 'app-change-password-dialog',
  imports: [
    ReactiveFormsModule,
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
          <h3 hlmDialogTitle>{{ 'account.changePassword.title' | transloco }}</h3>
          <p hlmDialogDescription>
            {{ 'account.changePassword.description' | transloco }}
          </p>
        </hlm-dialog-header>

        <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-4 py-2" novalidate>
          @if (errorKey(); as key) {
            <p
              role="alert"
              data-testid="change-password-error"
              class="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
            >
              {{ key | transloco }}
            </p>
          }

          @if (violations().length > 0) {
            <ul
              data-testid="change-password-violations"
              class="border-destructive/40 bg-destructive/10 text-destructive list-inside list-disc rounded-md border px-3 py-2 text-xs"
            >
              @for (violation of violations(); track violation.rule) {
                <li>{{ violationLabel(violation) }}</li>
              }
            </ul>
          }

          <div class="grid gap-2">
            <label hlmLabel for="cp-current">{{ 'account.changePassword.current' | transloco }}</label>
            <input
              hlmInput
              id="cp-current"
              type="password"
              autocomplete="current-password"
              formControlName="currentPassword"
              data-testid="change-password-current"
            />
            @if (showError(form.controls.currentPassword)) {
              <p class="text-destructive text-xs">{{ 'common.required' | transloco }}</p>
            }
          </div>

          <div class="grid gap-2">
            <label hlmLabel for="cp-new">{{ 'account.changePassword.newPassword' | transloco }}</label>
            <input
              hlmInput
              id="cp-new"
              type="password"
              autocomplete="new-password"
              formControlName="newPassword"
              data-testid="change-password-new"
            />
            @if (showError(form.controls.newPassword)) {
              <p class="text-destructive text-xs">{{ 'common.required' | transloco }}</p>
            }
          </div>

          <div class="grid gap-2">
            <label hlmLabel for="cp-confirm">{{ 'account.changePassword.confirm' | transloco }}</label>
            <input
              hlmInput
              id="cp-confirm"
              type="password"
              autocomplete="new-password"
              formControlName="confirm"
              data-testid="change-password-confirm"
            />
            @if (showError(form.controls.confirm)) {
              <p class="text-destructive text-xs">
                {{
                  (form.controls.confirm.hasError('mismatch')
                    ? 'account.changePassword.mismatch'
                    : 'common.required') | transloco
                }}
              </p>
            }
          </div>

          <hlm-dialog-footer>
            <button hlmBtn variant="outline" type="button" hlmDialogClose>
              {{ 'common.cancel' | transloco }}
            </button>
            <button hlmBtn type="submit" [disabled]="saving()" data-testid="change-password-submit">
              {{ (saving() ? 'account.changePassword.saving' : 'account.changePassword.submit') | transloco }}
            </button>
          </hlm-dialog-footer>
        </form>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class ChangePasswordDialog {
  private readonly store = inject(SessionStore);
  private readonly transloco = inject(TranslocoService);

  /** Two-way state driven by the parent (opens/closes the dialog). */
  readonly open = input(false);

  /** Emitted when the dialog closes (also after a successful change). */
  readonly closed = output<void>();

  protected readonly saving = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly violations = signal<readonly PasswordViolation[]>([]);

  protected readonly form = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.reset();
      this.closed.emit();
    }
  }

  protected showError(control: FormControl<string>): boolean {
    return control.invalid && control.touched;
  }

  protected violationLabel(violation: PasswordViolation): string {
    return violationLabel(this.transloco, violation);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const { currentPassword, newPassword, confirm } = this.form.getRawValue();

    if (newPassword !== confirm) {
      this.form.controls.confirm.setErrors({ mismatch: true });

      return;
    }

    this.saving.set(true);
    this.resetFeedback();

    this.store.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.saving.set(false);
        toast.success(this.transloco.translate('account.changePassword.success'));
        this.reset();
        this.closed.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.handle(error);
      },
    });
  }

  private handle(error: unknown): void {
    const name = errorNameOf(error);

    if (name === 'PasswordPolicyViolationError') {
      this.violations.set(violationsOf(error));

      return;
    }

    if (name === 'PasswordReusedError') {
      this.errorKey.set('errors.passwordReused');

      return;
    }

    if (name === 'InvalidCredentialsError') {
      this.errorKey.set('errors.wrongCurrentPassword');

      return;
    }

    this.errorKey.set(mapApiError(error));
  }

  private resetFeedback(): void {
    this.errorKey.set(null);
    this.violations.set([]);
  }

  private reset(): void {
    this.form.reset();
    this.resetFeedback();
    this.saving.set(false);
  }
}
