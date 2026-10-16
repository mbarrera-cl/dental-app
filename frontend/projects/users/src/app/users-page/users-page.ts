import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePencil,
  lucidePlus,
  lucideRefreshCw,
  lucideSearch,
  lucideSearchX,
  lucideTrash2,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import {
  HlmAlertDialog,
  HlmAlertDialogAction,
  HlmAlertDialogCancel,
  HlmAlertDialogContent,
  HlmAlertDialogDescription,
  HlmAlertDialogFooter,
  HlmAlertDialogHeader,
  HlmAlertDialogPortal,
  HlmAlertDialogTitle,
} from '@ui/alert-dialog';
import { HlmBadge } from '@ui/badge';
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
import { HlmSkeleton } from '@ui/skeleton';
import { HlmSpinner } from '@ui/spinner';
import { HlmTBody, HlmTable, HlmTableContainer, HlmTd, HlmTh, HlmTHead, HlmTr } from '@ui/table';
import { mapApiError, UsersApi, type User } from 'data-access';
import { formatDateTime } from 'ui';

/**
 * Full CRUD over the hexagonal backend:
 * list + search, create, edit and delete, with loading/error states and
 * toasts. Everything is signal-based so it plays nicely with zoneless change
 * detection.
 */
@Component({
  selector: 'app-users-page',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmBadge,
    HlmSkeleton,
    HlmSpinner,
    HlmTableContainer,
    HlmTable,
    HlmTHead,
    HlmTBody,
    HlmTr,
    HlmTh,
    HlmTd,
    HlmDialog,
    HlmDialogContent,
    HlmDialogPortal,
    HlmDialogHeader,
    HlmDialogTitle,
    HlmDialogDescription,
    HlmDialogFooter,
    HlmDialogClose,
    HlmAlertDialog,
    HlmAlertDialogContent,
    HlmAlertDialogPortal,
    HlmAlertDialogHeader,
    HlmAlertDialogTitle,
    HlmAlertDialogDescription,
    HlmAlertDialogFooter,
    HlmAlertDialogCancel,
    HlmAlertDialogAction,
  ],
  providers: [
    provideIcons({
      lucidePencil,
      lucidePlus,
      lucideRefreshCw,
      lucideSearch,
      lucideSearchX,
      lucideTrash2,
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './users-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  private readonly api = inject(UsersApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  // List state
  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();

    if (query === '') {
      return this.users();
    }

    return this.users().filter(
      (user) => user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query),
    );
  });

  // Create / edit dialog
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<User | null>(null);
  protected readonly saving = signal(false);
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
  });

  // Delete confirmation
  protected readonly deleteOpen = signal(false);
  protected readonly deletingUser = signal<User | null>(null);
  protected readonly deleting = signal(false);

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

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected formatDate(createdAt: string): string {
    return formatDateTime(createdAt, this.language());
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ name: '', email: '' });
    this.formOpen.set(true);
  }

  protected openEdit(user: User): void {
    this.editing.set(user);
    this.form.reset({ name: user.name, email: user.email });
    this.formOpen.set(true);
  }

  protected onFormStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.formOpen.set(false);
    }
  }

  protected showError(control: FormControl<string>): boolean {
    return control.invalid && control.touched;
  }

  protected nameError(): string | null {
    const control = this.form.controls.name;

    if (!this.showError(control)) {
      return null;
    }

    if (control.hasError('required')) return 'users.validation.nameRequired';
    if (control.hasError('minlength')) return 'users.validation.nameMin';
    if (control.hasError('maxlength')) return 'users.validation.nameMax';
    return 'errors.invalidName';
  }

  protected emailError(): string | null {
    const control = this.form.controls.email;

    if (!this.showError(control)) {
      return null;
    }

    if (control.hasError('required')) return 'users.validation.emailRequired';
    if (control.hasError('email')) return 'users.validation.emailInvalid';
    if (control.hasError('maxlength')) return 'users.validation.emailMax';
    return 'errors.invalidEmail';
  }

  protected submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const target = this.editing();
    const payload = this.form.getRawValue();
    this.saving.set(true);

    const request$ = target ? this.api.update(target.id, payload) : this.api.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        toast.success(this.transloco.translate(target ? 'users.toasts.updated' : 'users.toasts.created'));
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  protected askDelete(user: User): void {
    this.deletingUser.set(user);
    this.deleteOpen.set(true);
  }

  protected onDeleteStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.deleteOpen.set(false);
      this.deletingUser.set(null);
    }
  }

  protected confirmDelete(): void {
    const user = this.deletingUser();

    if (user === null) {
      return;
    }

    this.deleting.set(true);

    this.api.delete(user.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteOpen.set(false);
        this.deletingUser.set(null);
        toast.success(this.transloco.translate('users.toasts.deleted'));
        this.load();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.deleteOpen.set(false);
        this.deletingUser.set(null);
        toast.error(this.transloco.translate(mapApiError(error)));
        this.load();
      },
    });
  }
}
