import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideEyeOff, lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import { HlmSpinner } from '@ui/spinner';
import { SessionStore } from 'auth';
import { mapApiError } from 'data-access';
import { formatDateTime } from 'ui';
import { LanguageSwitcher } from '../language-switcher';
import {
  errorDetailsOf,
  errorNameOf,
  violationsOf,
  violationLabel,
  type PasswordViolation,
} from '../password-violations';

/**
 * Public sign-in page.
 *
 * Handles the three failure modes of the backend in a single screen:
 * invalid credentials, temporarily locked accounts (shows the unlock time)
 * and disabled accounts. When the password is expired or was reset by an
 * administrator the page switches to the forced-change form and signs the
 * user in as soon as the new password is accepted.
 */
@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmSpinner,
    LanguageSwitcher,
  ],
  providers: [provideIcons({ lucideEye, lucideEyeOff, lucideTriangleAlert })],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly store = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  protected readonly mode = signal<'credentials' | 'expired'>('credentials');
  protected readonly reason = signal<'expired' | 'reset' | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly errorParams = signal<Record<string, string>>({});
  protected readonly violations = signal<readonly PasswordViolation[]>([]);
  protected readonly showPassword = signal(false);
  protected readonly showNewPassword = signal(false);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly expiredForm = new FormGroup({
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** Password accepted by the API but expired/reset: reused for the change. */
  private currentPassword = '';

  constructor() {
    if (this.store.isAuthenticated()) {
      void this.router.navigateByUrl('/');
    }
  }

  protected submitCredentials(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.resetFeedback();

    this.store.login({ email, password }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.enter();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.handleLoginError(error, password);
      },
    });
  }

  protected submitExpired(): void {
    if (this.expiredForm.invalid) {
      this.expiredForm.markAllAsTouched();

      return;
    }

    const { newPassword, confirm } = this.expiredForm.getRawValue();

    if (newPassword !== confirm) {
      this.expiredForm.controls.confirm.setErrors({ mismatch: true });

      return;
    }

    this.submitting.set(true);
    this.resetFeedback();

    this.store
      .changeExpiredPassword({
        email: this.form.controls.email.value,
        currentPassword: this.currentPassword,
        newPassword,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.enter();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.handleExpiredError(error);
        },
      });
  }

  protected showError(control: FormControl<string>): boolean {
    return control.invalid && control.touched;
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected toggleNewPassword(): void {
    this.showNewPassword.update((visible) => !visible);
  }

  protected emailErrorKey(): string {
    const control = this.form.controls.email;

    return control.hasError('required')
      ? 'login.validation.emailRequired'
      : 'login.validation.emailInvalid';
  }

  protected confirmErrorKey(): string {
    return this.expiredForm.controls.confirm.hasError('mismatch')
      ? 'login.validation.mismatch'
      : 'login.validation.confirmRequired';
  }

  protected violationLabel(violation: PasswordViolation): string {
    return violationLabel(this.transloco, violation);
  }

  private handleLoginError(error: unknown, password: string): void {
    const name = errorNameOf(error);

    if (name === 'PasswordChangeRequiredError') {
      this.currentPassword = password;
      const reason = errorDetailsOf(error)['reason'];
      this.reason.set(reason === 'reset' ? 'reset' : 'expired');
      this.expiredForm.reset();
      this.mode.set('expired');

      return;
    }

    if (name === 'AccountLockedError') {
      const lockedUntil = errorDetailsOf(error)['lockedUntil'];
      this.errorKey.set('login.lockedUntil');
      this.errorParams.set({
        time:
          typeof lockedUntil === 'string'
            ? formatDateTime(lockedUntil, this.language())
            : this.transloco.translate('common.loading'),
      });

      return;
    }

    if (name === 'AccountDisabledError') {
      this.errorKey.set('errors.accountDisabled');

      return;
    }

    if (name === 'InvalidCredentialsError') {
      this.errorKey.set('errors.invalidCredentials');

      return;
    }

    this.errorKey.set(mapApiError(error));
  }

  private handleExpiredError(error: unknown): void {
    const name = errorNameOf(error);

    if (name === 'PasswordPolicyViolationError') {
      this.violations.set(violationsOf(error));

      return;
    }

    if (name === 'PasswordReusedError') {
      this.errorKey.set('errors.passwordReused');

      return;
    }

    this.errorKey.set(mapApiError(error));
  }

  /** Logged in: honour `returnUrl` when it points inside the application. */
  private enter(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const safe = returnUrl !== null && returnUrl.startsWith('/') && !returnUrl.startsWith('//');

    void this.router.navigateByUrl(safe ? returnUrl : '/');
  }

  private resetFeedback(): void {
    this.errorKey.set(null);
    this.errorParams.set({});
    this.violations.set([]);
  }
}
