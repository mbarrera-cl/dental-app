import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import type { Observable } from 'rxjs';
import {
  lucideCheck,
  lucideCopy,
  lucideEye,
  lucideEyeOff,
  lucideKeyRound,
  lucidePencil,
  lucidePlus,
  lucideRefreshCw,
  lucideSearch,
  lucideSearchX,
  lucideShieldCheck,
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
  HlmComboboxChip,
  HlmComboboxChipInput,
  HlmComboboxChips,
  HlmComboboxContent,
  HlmComboboxEmpty,
  HlmComboboxItem,
  HlmComboboxList,
  HlmComboboxMultiple,
  HlmComboboxPortal,
} from '@ui/combobox';
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
import { HasPermissionDirective, PERMISSION_KEYS, PermissionMatrixComponent } from 'auth';
import {
  PermissionsApi,
  RolesApi,
  UsersApi,
  mapApiError,
  type CreateUserPayload,
  type PermissionCatalog,
  type Role,
  type SetPasswordPayload,
  type UpdateUserPayload,
  type User,
} from 'data-access';
import { formatDateTime } from 'ui';

type UserStatus = 'active' | 'disabled';
type ResetMode = 'typed' | 'generate';
type RolesStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

const STATUS_VARIANT: Record<UserStatus, 'secondary' | 'outline'> = {
  active: 'secondary',
  disabled: 'outline',
};

/**
 * User administration: profile CRUD plus the account features of the auth
 * system — roles, status, admin password resets (typed or generated) and
 * direct permissions. Actions are hidden without the matching `users:*`
 * permission; the server enforces them in any case.
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
    HlmComboboxMultiple,
    HlmComboboxChips,
    HlmComboboxChipInput,
    HlmComboboxChip,
    HlmComboboxContent,
    HlmComboboxPortal,
    HlmComboboxList,
    HlmComboboxItem,
    HlmComboboxEmpty,
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
    HasPermissionDirective,
    PermissionMatrixComponent,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideCopy,
      lucideEye,
      lucideEyeOff,
      lucideKeyRound,
      lucidePencil,
      lucidePlus,
      lucideRefreshCw,
      lucideSearch,
      lucideSearchX,
      lucideShieldCheck,
      lucideTrash2,
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './users-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  private readonly api = inject(UsersApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly permissionsApi = inject(PermissionsApi);
  private readonly transloco = inject(TranslocoService);

  /** Typed permission keys, so the template never hard-codes strings. */
  protected readonly permissionKeys = PERMISSION_KEYS;

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

  // Roles catalog (lazy: a `users:read` holder may lack `roles:read`).
  protected readonly roles = signal<Role[]>([]);
  protected readonly rolesStatus = signal<RolesStatus>('idle');

  // Create / edit dialog
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<User | null>(null);
  protected readonly saving = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly formRoles = signal<string[]>([]);
  protected readonly formStatus = signal<UserStatus>('active');
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    password: new FormControl('', { nonNullable: true }),
  });

  // Delete confirmation
  protected readonly deleteOpen = signal(false);
  protected readonly deletingUser = signal<User | null>(null);
  protected readonly deleting = signal(false);

  // Reset password dialog
  protected readonly resetOpen = signal(false);
  protected readonly resetTarget = signal<User | null>(null);
  protected readonly resetMode = signal<ResetMode>('generate');
  protected readonly resetValue = signal('');
  protected readonly resetPasswordVisible = signal(false);
  protected readonly resetError = signal<string | null>(null);
  protected readonly resetting = signal(false);

  // Generated password (shown exactly once)
  protected readonly generatedPassword = signal<string | null>(null);
  protected readonly copied = signal(false);

  // Direct permissions dialog
  protected readonly permissionsOpen = signal(false);
  protected readonly permissionsTarget = signal<User | null>(null);
  protected readonly catalog = signal<PermissionCatalog | null>(null);
  protected readonly catalogLoading = signal(false);
  protected readonly catalogError = signal(false);
  protected readonly selectedPermissions = signal<readonly string[]>([]);
  protected readonly savingPermissions = signal(false);

  /** Permissions the target user already holds through their roles. */
  protected readonly inheritedPermissions = computed<readonly string[]>(() => {
    const byId = new Map(this.roles().map((role) => [role.id, role]));
    const target = this.permissionsTarget();
    const inherited = (target?.roles ?? []).flatMap((ref) => byId.get(ref.id)?.permissions ?? []);

    return [...new Set(inherited)];
  });

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

  protected formatLastLogin(user: User): string | null {
    return user.lastLoginAt ? formatDateTime(user.lastLoginAt, this.language()) : null;
  }

  protected directPermissionsTitle(user: User): string {
    return (user.directPermissions ?? []).join(', ');
  }

  protected statusVariant(user: User): 'secondary' | 'outline' {
    return STATUS_VARIANT[user.status ?? 'active'];
  }

  // --- Create / edit -------------------------------------------------------

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ name: '', email: '', password: '' });
    this.formRoles.set([]);
    this.formStatus.set('active');
    this.passwordVisible.set(false);
    this.formOpen.set(true);
    this.ensureRoles();
  }

  protected openEdit(user: User): void {
    this.editing.set(user);
    this.form.reset({ name: user.name, email: user.email, password: '' });
    this.formRoles.set((user.roles ?? []).map((role) => role.id));
    this.formStatus.set(user.status ?? 'active');
    this.passwordVisible.set(false);
    this.formOpen.set(true);
    this.ensureRoles();
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

  /** Label lookup shared by the chips and the combobox filter. */
  protected readonly roleLabel = (roleId: string): string =>
    this.roles().find((role) => role.id === roleId)?.name ?? roleId;

  /**
   * The combobox owns the selection while it is open: writes are mirrored
   * into `formRoles`, and the equality guard stops the feedback loop of the
   * `[value]` binding writing the same array back into the control.
   */
  protected onRolesSelected(roleIds: readonly string[] | null | undefined): void {
    const next = [...(roleIds ?? [])];
    const current = this.formRoles();
    const unchanged = next.length === current.length && next.every((id) => current.includes(id));

    if (!unchanged) {
      this.formRoles.set(next);
    }
  }

  protected submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const target = this.editing();
    const { name, email, password } = this.form.getRawValue();
    // Without the roles catalog (no `roles:read`) the assignment cannot be
    // edited: keep the current roles instead of wiping them.
    const roles =
      this.rolesStatus() === 'ready'
        ? [...this.formRoles()]
        : (target?.roles ?? []).map((role) => role.id);
    const status = this.formStatus();
    this.saving.set(true);

    let request$: Observable<User>;

    if (target !== null) {
      const payload: UpdateUserPayload = { name, email, roles, status };
      request$ = this.api.update(target.id, payload);
    } else {
      const payload: CreateUserPayload = { name, email, roles, status };

      if (password.trim() !== '') {
        payload.password = password;
      }

      request$ = this.api.create(payload);
    }

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

  // --- Delete --------------------------------------------------------------

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

  // --- Password reset ------------------------------------------------------

  protected openReset(user: User): void {
    this.resetTarget.set(user);
    this.resetMode.set('generate');
    this.resetValue.set('');
    this.resetPasswordVisible.set(false);
    this.resetError.set(null);
    this.resetOpen.set(true);
  }

  protected onResetStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.resetOpen.set(false);
      this.resetTarget.set(null);
      this.resetting.set(false);
    }
  }

  protected onResetInput(event: Event): void {
    this.resetValue.set((event.target as HTMLInputElement).value);
  }

  protected submitReset(): void {
    const target = this.resetTarget();

    if (target === null) {
      return;
    }

    const typed = this.resetMode() === 'typed';
    const value = this.resetValue();

    if (typed && value.trim() === '') {
      this.resetError.set('users.reset.passwordRequired');
      return;
    }

    this.resetError.set(null);
    this.resetting.set(true);

    const payload: SetPasswordPayload = typed ? { password: value } : { generate: true };

    this.api.setPassword(target.id, payload).subscribe({
      next: (result) => {
        this.resetting.set(false);
        this.resetOpen.set(false);
        this.resetTarget.set(null);
        toast.success(this.transloco.translate('users.reset.done'));

        if (typeof result.password === 'string' && result.password !== '') {
          this.generatedPassword.set(result.password);
        }

        this.load();
      },
      error: (error: unknown) => {
        this.resetting.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  protected onGeneratedStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.generatedPassword.set(null);
      this.copied.set(false);
    }
  }

  protected copyGenerated(): void {
    const password = this.generatedPassword();

    if (password === null) {
      return;
    }

    // `clipboard` is absent in non-secure contexts (and in tests): ignore it.
    void navigator.clipboard
      ?.writeText(password)
      .then(() => this.copied.set(true))
      .catch(() => this.copied.set(false));
  }

  // --- Direct permissions --------------------------------------------------

  protected openPermissions(user: User): void {
    this.permissionsTarget.set(user);
    this.selectedPermissions.set(user.directPermissions ?? []);
    this.permissionsOpen.set(true);
    this.ensureRoles();
    this.ensureCatalog();
  }

  protected onPermissionsStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.permissionsOpen.set(false);
      this.permissionsTarget.set(null);
      this.savingPermissions.set(false);
    }
  }

  protected savePermissions(): void {
    const target = this.permissionsTarget();

    if (target === null) {
      return;
    }

    this.savingPermissions.set(true);

    this.api.updatePermissions(target.id, [...this.selectedPermissions()]).subscribe({
      next: () => {
        this.savingPermissions.set(false);
        this.permissionsOpen.set(false);
        this.permissionsTarget.set(null);
        toast.success(this.transloco.translate('users.permissions.saved'));
        this.load();
      },
      error: (error: unknown) => {
        this.savingPermissions.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  // --- Lazy catalogs -------------------------------------------------------

  private ensureRoles(): void {
    if (this.rolesStatus() !== 'idle') {
      return;
    }

    this.rolesStatus.set('loading');

    this.rolesApi.list().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.rolesStatus.set('ready');
      },
      // A `users:*` holder without `roles:read` still manages accounts; only
      // the role pickers degrade to read-only.
      error: () => this.rolesStatus.set('unavailable'),
    });
  }

  private ensureCatalog(): void {
    if (this.catalog() !== null || this.catalogLoading()) {
      return;
    }

    this.catalogLoading.set(true);
    this.catalogError.set(false);

    this.permissionsApi.getCatalog().subscribe({
      next: (catalog) => {
        this.catalog.set(catalog);
        this.catalogLoading.set(false);
      },
      error: () => {
        this.catalogError.set(true);
        this.catalogLoading.set(false);
      },
    });
  }
}
