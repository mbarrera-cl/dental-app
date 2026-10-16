import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCopy,
  lucideLock,
  lucidePencil,
  lucidePlus,
  lucideRefreshCw,
  lucideSearch,
  lucideSearchX,
  lucideShieldCheck,
  lucideTrash2,
  lucideTriangleAlert,
  lucideUsers,
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
import { HasPermissionDirective, PERMISSION_KEYS, PermissionMatrixComponent } from 'auth';
import {
  PermissionsApi,
  RolesApi,
  mapApiError,
  type CreateRolePayload,
  type PermissionCatalog,
  type Role,
  type UpdateRolePayload,
} from 'data-access';
import { formatDateTime } from 'ui';

/**
 * Roles section of the admin panel: the whole role catalog is data-driven,
 * so this page is the place where new roles are composed from the permission
 * matrix. The protected `admin` role can only be re-scoped (its name is
 * frozen and it must keep every administration permission).
 */
@Component({
  selector: 'app-roles-page',
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
    HasPermissionDirective,
    PermissionMatrixComponent,
  ],
  providers: [
    provideIcons({
      lucideCopy,
      lucideLock,
      lucidePencil,
      lucidePlus,
      lucideRefreshCw,
      lucideSearch,
      lucideSearchX,
      lucideShieldCheck,
      lucideTrash2,
      lucideTriangleAlert,
      lucideUsers,
    }),
  ],
  templateUrl: './roles-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage {
  private readonly api = inject(RolesApi);
  private readonly permissionsApi = inject(PermissionsApi);
  private readonly transloco = inject(TranslocoService);

  /** Typed permission keys, so the template never hard-codes strings. */
  protected readonly permissionKeys = PERMISSION_KEYS;

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  // List state
  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();

    if (query === '') {
      return this.roles();
    }

    return this.roles().filter(
      (role) =>
        role.name.toLowerCase().includes(query) ||
        role.description.toLowerCase().includes(query),
    );
  });

  // Permission catalog (lazy: only the editor needs it)
  protected readonly catalog = signal<PermissionCatalog | null>(null);
  protected readonly catalogLoading = signal(false);
  protected readonly catalogError = signal(false);

  // Create / edit / duplicate dialog
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Role | null>(null);
  protected readonly saving = signal(false);
  protected readonly selectedPermissions = signal<readonly string[]>([]);
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(50)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
  });

  // Delete confirmation
  protected readonly deleteOpen = signal(false);
  protected readonly deletingRole = signal<Role | null>(null);
  protected readonly deleting = signal(false);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api.list().subscribe({
      next: (roles) => this.roles.set(roles),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected formatDate(iso: string): string {
    return formatDateTime(iso, this.language());
  }

  protected permissionTitle(role: Role): string {
    return role.permissions.join(', ');
  }

  // --- Create / edit / duplicate -------------------------------------------

  protected openCreate(): void {
    this.editing.set(null);
    this.form.controls.name.enable();
    this.form.reset({ name: '', description: '' });
    this.selectedPermissions.set([]);
    this.formOpen.set(true);
    this.ensureCatalog();
  }

  protected openEdit(role: Role): void {
    this.editing.set(role);
    // The name of the protected role is frozen: disable the control so it
    // cannot be edited (and `getRawValue` still submits it unchanged).
    if (role.builtIn) {
      this.form.controls.name.disable();
    } else {
      this.form.controls.name.enable();
    }
    this.form.reset({ name: role.name, description: role.description });
    this.selectedPermissions.set([...role.permissions]);
    this.formOpen.set(true);
    this.ensureCatalog();
  }

  /** Duplication is a prefilled creation: pick a new name and adjust scopes. */
  protected openDuplicate(role: Role): void {
    this.editing.set(null);
    this.form.controls.name.enable();
    this.form.reset({
      name: `${role.name} ${this.transloco.translate('roles.duplicate.suffix')}`,
      description: role.description,
    });
    this.selectedPermissions.set([...role.permissions]);
    this.formOpen.set(true);
    this.ensureCatalog();
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

    if (control.hasError('required')) return 'roles.validation.nameRequired';
    if (control.hasError('minlength')) return 'roles.validation.nameMin';
    if (control.hasError('maxlength')) return 'roles.validation.nameMax';
    return null;
  }

  protected descriptionError(): string | null {
    const control = this.form.controls.description;

    if (!this.showError(control) || !control.hasError('maxlength')) {
      return null;
    }

    return 'roles.validation.descriptionMax';
  }

  protected submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const target = this.editing();
    const { name, description } = this.form.getRawValue();
    const permissions = [...this.selectedPermissions()];
    this.saving.set(true);

    const request$ =
      target === null
        ? this.api.create({ name, description, permissions } satisfies CreateRolePayload)
        : this.api.update(target.id, {
            name,
            description,
            permissions,
          } satisfies UpdateRolePayload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        toast.success(
          this.transloco.translate(target ? 'roles.toasts.updated' : 'roles.toasts.created'),
        );
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  // --- Delete --------------------------------------------------------------

  protected askDelete(role: Role): void {
    this.deletingRole.set(role);
    this.deleteOpen.set(true);
  }

  protected onDeleteStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.deleteOpen.set(false);
      this.deletingRole.set(null);
    }
  }

  protected confirmDelete(): void {
    const role = this.deletingRole();

    if (role === null) {
      return;
    }

    this.deleting.set(true);

    this.api.remove(role.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteOpen.set(false);
        this.deletingRole.set(null);
        toast.success(this.transloco.translate('roles.toasts.deleted'));
        this.load();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.deleteOpen.set(false);
        this.deletingRole.set(null);
        toast.error(this.transloco.translate(mapApiError(error)));
        this.load();
      },
    });
  }

  // --- Lazy catalog --------------------------------------------------------

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
