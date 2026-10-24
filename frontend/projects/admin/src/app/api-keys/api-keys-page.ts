import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCopy,
  lucideKeyRound,
  lucidePlus,
  lucideRefreshCw,
  lucideRotateCw,
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
import { HasPermissionDirective, PERMISSION_KEYS, PermissionMatrixComponent } from 'auth';
import {
  ApiKeysApi,
  PermissionsApi,
  RolesApi,
  UsersApi,
  mapApiError,
  slicePage,
  UiSettingsService,
  type ApiKey,
  type CreateApiKeyPayload,
  type PermissionCatalog,
  type Role,
  type User,
} from 'data-access';
import { formatDateTime, PaginatorComponent } from 'ui';

type KeyStatus = 'active' | 'expired' | 'revoked';
type ScopesMode = 'inherit' | 'subset';

const STATUS_VARIANT: Record<KeyStatus, 'secondary' | 'outline' | 'destructive'> = {
  active: 'secondary',
  expired: 'outline',
  revoked: 'destructive',
};

/**
 * API keys section: every key of every user (`apikeys:read`), with a filter
 * by owner/name and creation on behalf of any user (`apikeys:manage`). The
 * scope picker only offers permissions the target user currently holds —
 * a key can scope down, never up — and the backend re-validates on save.
 */
@Component({
  selector: 'app-api-keys-page',
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
    PaginatorComponent,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideCopy,
      lucideKeyRound,
      lucidePlus,
      lucideRefreshCw,
      lucideRotateCw,
      lucideSearch,
      lucideSearchX,
      lucideTrash2,
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './api-keys-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeysPage {
  private readonly api = inject(ApiKeysApi);
  private readonly usersApi = inject(UsersApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly permissionsApi = inject(PermissionsApi);
  private readonly transloco = inject(TranslocoService);
  private readonly uiSettings = inject(UiSettingsService);

  /** Typed permission keys, so the template never hard-codes strings. */
  protected readonly permissionKeys = PERMISSION_KEYS;

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  // List state
  protected readonly keys = signal<ApiKey[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly query = signal('');

  // Pagination over the filtered key list.
  protected readonly page = signal(1);
  protected readonly pageSize = linkedSignal(() => this.uiSettings.defaultPageSize());
  protected readonly paged = computed(() =>
    slicePage(this.filtered(), this.page(), this.pageSize()),
  );
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly users = signal<User[]>([]);
  protected readonly roles = signal<Role[]>([]);

  protected readonly userById = computed(() => {
    const map = new Map<string, User>();

    for (const user of this.users()) {
      map.set(user.id, user);
    }

    return map;
  });

  /** Effective permissions of every user: roles ∪ direct grants. */
  protected readonly effectiveByUser = computed(() => {
    const rolesById = new Map(this.roles().map((role) => [role.id, role]));
    const map = new Map<string, ReadonlySet<string>>();

    for (const user of this.users()) {
      const permissions = new Set<string>(user.directPermissions ?? []);

      for (const ref of user.roles ?? []) {
        for (const permission of rolesById.get(ref.id)?.permissions ?? []) {
          permissions.add(permission);
        }
      }

      map.set(user.id, permissions);
    }

    return map;
  });

  protected readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();

    if (query === '') {
      return this.keys();
    }

    return this.keys().filter((key) => {
      const owner = this.userById().get(key.userId);

      return (
        key.name.toLowerCase().includes(query) ||
        key.prefix.toLowerCase().includes(query) ||
        (owner?.email.toLowerCase().includes(query) ?? false) ||
        (owner?.name.toLowerCase().includes(query) ?? false)
      );
    });
  });

  // Create dialog
  protected readonly createOpen = signal(false);
  protected readonly creating = signal(false);
  protected readonly scopesMode = signal<ScopesMode>('inherit');
  protected readonly selectedScopes = signal<readonly string[]>([]);
  protected readonly catalog = signal<PermissionCatalog | null>(null);
  protected readonly catalogLoading = signal(false);
  protected readonly catalogError = signal(false);
  protected readonly rolesLoading = signal(false);
  protected readonly createForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(60)],
    }),
    userId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    expiresInDays: new FormControl('90', {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(3650)],
    }),
  });

  protected readonly targetUser = computed(() => {
    const userId = this.createForm.controls.userId.value;

    return this.users().find((user) => user.id === userId);
  });

  /** The catalog, narrowed to what the target user can actually delegate. */
  protected readonly targetCatalog = computed<PermissionCatalog | null>(() => {
    const catalog = this.catalog();
    const target = this.targetUser();

    if (catalog === null || target === undefined) {
      return null;
    }

    const effective = this.effectiveByUser().get(target.id) ?? new Set<string>();
    const categories = catalog.categories
      .map((category) => ({
        ...category,
        permissions: category.permissions.filter((permission) => effective.has(permission.key)),
      }))
      .filter((category) => category.permissions.length > 0);

    return { categories };
  });

  // Secret shown exactly once (create or rotate)
  protected readonly secret = signal<string | null>(null);
  protected readonly copied = signal(false);

  // Rotate confirmation
  protected readonly rotateOpen = signal(false);
  protected readonly rotatingKey = signal<ApiKey | null>(null);
  protected readonly rotating = signal(false);

  // Revoke confirmation
  protected readonly revokeOpen = signal(false);
  protected readonly revokingKey = signal<ApiKey | null>(null);
  protected readonly revoking = signal(false);

  constructor() {
    this.uiSettings.load();
    this.load();
    this.loadUsers();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api.listAll().subscribe({
      next: (keys) => this.keys.set(keys),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });
  }

  private loadUsers(): void {
    this.usersApi.list().subscribe({
      next: (users) => this.users.set(users),
      // Without `users:read` the owner column degrades to the raw user id.
      error: () => this.users.set([]),
    });
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  protected ownerLabel(key: ApiKey): string {
    return this.userById().get(key.userId)?.email ?? key.userId;
  }

  protected statusOf(key: ApiKey): KeyStatus {
    if (key.revokedAt !== null) {
      return 'revoked';
    }

    if (key.expiresAt !== null && new Date(key.expiresAt).getTime() <= Date.now()) {
      return 'expired';
    }

    return 'active';
  }

  protected statusVariant(key: ApiKey): 'secondary' | 'outline' | 'destructive' {
    return STATUS_VARIANT[this.statusOf(key)];
  }

  protected scopesLabel(key: ApiKey): string {
    return key.scopes === null
      ? this.transloco.translate('admin.apiKeys.scopesAll')
      : this.transloco.translate('apiKeys.scopesCount', { count: key.scopes.length });
  }

  protected formatDate(iso: string): string {
    return formatDateTime(iso, this.language());
  }

  // --- Create --------------------------------------------------------------

  protected openCreate(): void {
    this.createForm.reset({ name: '', userId: this.users()[0]?.id ?? '', expiresInDays: '90' });
    this.scopesMode.set('inherit');
    this.selectedScopes.set([]);
    this.createOpen.set(true);
    this.ensureRoles();
    this.ensureCatalog();
  }

  protected onUserChange(event: Event): void {
    const userId = (event.target as HTMLSelectElement).value;
    this.createForm.controls.userId.setValue(userId);
    this.prefillScopes(userId);
  }

  protected setScopesMode(mode: ScopesMode): void {
    this.scopesMode.set(mode);

    if (mode === 'subset') {
      this.prefillScopes(this.createForm.controls.userId.value);
    }
  }

  protected onCreateStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.createOpen.set(false);
      this.creating.set(false);
    }
  }

  protected submitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const { name, userId, expiresInDays } = this.createForm.getRawValue();
    const scopes = this.scopesMode() === 'inherit' ? null : [...this.selectedScopes()];
    const payload: CreateApiKeyPayload = {
      name,
      userId,
      expiresInDays: Number(expiresInDays),
      scopes,
    };
    this.creating.set(true);

    this.api.create(payload).subscribe({
      next: (created) => {
        this.creating.set(false);
        this.createOpen.set(false);
        toast.success(this.transloco.translate('apiKeys.toasts.created'));
        this.secret.set(created.key);
        this.load();
      },
      error: (error: unknown) => {
        this.creating.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  // --- Rotate / revoke -----------------------------------------------------

  protected askRotate(key: ApiKey): void {
    this.rotatingKey.set(key);
    this.rotateOpen.set(true);
  }

  protected onRotateStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.rotateOpen.set(false);
      this.rotatingKey.set(null);
    }
  }

  protected confirmRotate(): void {
    const key = this.rotatingKey();

    if (key === null) {
      return;
    }

    this.rotating.set(true);

    this.api.rotate(key.id).subscribe({
      next: (rotated) => {
        this.rotating.set(false);
        this.rotateOpen.set(false);
        this.rotatingKey.set(null);
        toast.success(this.transloco.translate('apiKeys.toasts.rotated'));
        this.secret.set(rotated.key);
        this.load();
      },
      error: (error: unknown) => {
        this.rotating.set(false);
        this.rotateOpen.set(false);
        this.rotatingKey.set(null);
        toast.error(this.transloco.translate(mapApiError(error)));
        this.load();
      },
    });
  }

  protected askRevoke(key: ApiKey): void {
    this.revokingKey.set(key);
    this.revokeOpen.set(true);
  }

  protected onRevokeStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.revokeOpen.set(false);
      this.revokingKey.set(null);
    }
  }

  protected confirmRevoke(): void {
    const key = this.revokingKey();

    if (key === null) {
      return;
    }

    this.revoking.set(true);

    this.api.revoke(key.id).subscribe({
      next: () => {
        this.revoking.set(false);
        this.revokeOpen.set(false);
        this.revokingKey.set(null);
        toast.success(this.transloco.translate('apiKeys.toasts.revoked'));
        this.load();
      },
      error: (error: unknown) => {
        this.revoking.set(false);
        this.revokeOpen.set(false);
        this.revokingKey.set(null);
        toast.error(this.transloco.translate(mapApiError(error)));
        this.load();
      },
    });
  }

  // --- Secret-once dialog --------------------------------------------------

  protected onSecretStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.secret.set(null);
      this.copied.set(false);
    }
  }

  protected copySecret(): void {
    const value = this.secret();

    if (value === null) {
      return;
    }

    // `clipboard` is absent in non-secure contexts (and in tests): ignore it.
    void navigator.clipboard
      ?.writeText(value)
      .then(() => this.copied.set(true))
      .catch(() => this.copied.set(false));
  }

  // --- Lazy catalogs -------------------------------------------------------

  private prefillScopes(userId: string): void {
    this.selectedScopes.set([...(this.effectiveByUser().get(userId) ?? [])]);
  }

  private ensureRoles(): void {
    if (this.roles().length > 0 || this.rolesLoading()) {
      return;
    }

    this.rolesLoading.set(true);

    this.rolesApi.list().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.rolesLoading.set(false);
        this.prefillScopes(this.createForm.controls.userId.value);
      },
      error: () => this.rolesLoading.set(false),
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
