import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import { PermissionMatrixComponent } from 'auth';
import {
  ApiKeysApi,
  mapApiError,
  PermissionsApi,
  type ApiKey,
  type PermissionCatalog,
} from 'data-access';
import { formatDateTime } from 'ui';

type KeyStatus = 'active' | 'expired' | 'revoked';
type BadgeVariant = 'secondary' | 'outline' | 'destructive';
type ScopesMode = 'inherit' | 'subset';

const STATUS_VARIANT: Record<KeyStatus, BadgeVariant> = {
  active: 'secondary',
  expired: 'outline',
  revoked: 'destructive',
};

/**
 * "My API keys" of the authenticated user: list with status, create
 * (inheriting every permission or a subset picked with the permission
 * matrix), rotate and revoke. The plain secret is shown exactly once.
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
    PermissionMatrixComponent,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideCopy,
      lucideKeyRound,
      lucidePlus,
      lucideRefreshCw,
      lucideTrash2,
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './api-keys-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeysPage {
  private readonly api = inject(ApiKeysApi);
  private readonly permissionsApi = inject(PermissionsApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  // List state
  protected readonly keys = signal<ApiKey[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly skeletonRows = [0, 1, 2];

  // Create dialog
  protected readonly createOpen = signal(false);
  protected readonly creating = signal(false);
  protected readonly scopesMode = signal<ScopesMode>('inherit');
  protected readonly selectedScopes = signal<readonly string[]>([]);
  protected readonly catalog = signal<PermissionCatalog | null>(null);
  protected readonly catalogLoading = signal(false);
  protected readonly catalogError = signal(false);
  protected readonly createForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    expiresInDays: new FormControl(90, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(3650)],
    }),
  });

  // Secret shown exactly once (after create/rotate)
  protected readonly secret = signal<string | null>(null);
  protected readonly copied = signal(false);

  // Rotate / revoke confirmations
  protected readonly rotateTarget = signal<ApiKey | null>(null);
  protected readonly rotateOpen = signal(false);
  protected readonly rotating = signal(false);
  protected readonly revokeTarget = signal<ApiKey | null>(null);
  protected readonly revokeOpen = signal(false);
  protected readonly revoking = signal(false);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api.list().subscribe({
      next: (keys) => this.keys.set(keys),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });
  }

  protected statusOf(key: ApiKey): KeyStatus {
    if (key.revokedAt !== null) {
      return 'revoked';
    }

    return new Date(key.expiresAt).getTime() <= Date.now() ? 'expired' : 'active';
  }

  protected statusVariant(key: ApiKey): BadgeVariant {
    return STATUS_VARIANT[this.statusOf(key)];
  }

  protected scopesLabel(key: ApiKey): string {
    return key.scopes === null
      ? this.transloco.translate('apiKeys.scopesAll')
      : this.transloco.translate('apiKeys.scopesCount', { count: key.scopes.length });
  }

  protected formatDate(iso: string): string {
    return formatDateTime(iso, this.language());
  }

  // --- create -------------------------------------------------------------

  protected openCreate(): void {
    this.createForm.reset({ name: '', expiresInDays: 90 });
    this.scopesMode.set('inherit');
    this.selectedScopes.set([]);
    this.createOpen.set(true);
    this.ensureCatalog();
  }

  protected onCreateStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.createOpen.set(false);
    }
  }

  private ensureCatalog(): void {
    if (this.catalog() !== null || this.catalogLoading()) {
      return;
    }

    this.catalogLoading.set(true);
    this.catalogError.set(false);

    this.permissionsApi.getCatalog().subscribe({
      next: (catalog) => this.catalog.set(catalog),
      error: () => this.catalogError.set(true),
      complete: () => this.catalogLoading.set(false),
    });
  }

  protected submitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();

      return;
    }

    const { name, expiresInDays } = this.createForm.getRawValue();
    this.creating.set(true);

    this.api
      .create({
        name,
        expiresInDays,
        scopes: this.scopesMode() === 'inherit' ? null : [...this.selectedScopes()],
      })
      .subscribe({
        next: (created) => {
          this.creating.set(false);
          this.createOpen.set(false);
          this.copied.set(false);
          this.secret.set(created.key);
          toast.success(this.transloco.translate('apiKeys.toasts.created'));
          this.load();
        },
        error: (error: unknown) => {
          this.creating.set(false);
          toast.error(this.transloco.translate(mapApiError(error)));
        },
      });
  }

  // --- secret once --------------------------------------------------------

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

  // --- rotate -------------------------------------------------------------

  protected askRotate(key: ApiKey): void {
    this.rotateTarget.set(key);
    this.rotateOpen.set(true);
  }

  protected onRotateStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.rotateOpen.set(false);
      this.rotateTarget.set(null);
    }
  }

  protected confirmRotate(): void {
    const target = this.rotateTarget();

    if (target === null) {
      return;
    }

    this.rotating.set(true);

    this.api.rotate(target.id).subscribe({
      next: (rotated) => {
        this.rotating.set(false);
        this.rotateOpen.set(false);
        this.rotateTarget.set(null);
        this.copied.set(false);
        this.secret.set(rotated.key);
        toast.success(this.transloco.translate('apiKeys.toasts.rotated'));
        this.load();
      },
      error: (error: unknown) => {
        this.rotating.set(false);
        this.rotateOpen.set(false);
        this.rotateTarget.set(null);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  // --- revoke -------------------------------------------------------------

  protected askRevoke(key: ApiKey): void {
    this.revokeTarget.set(key);
    this.revokeOpen.set(true);
  }

  protected onRevokeStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.revokeOpen.set(false);
      this.revokeTarget.set(null);
    }
  }

  protected confirmRevoke(): void {
    const target = this.revokeTarget();

    if (target === null) {
      return;
    }

    this.revoking.set(true);

    this.api.revoke(target.id).subscribe({
      next: () => {
        this.revoking.set(false);
        this.revokeOpen.set(false);
        this.revokeTarget.set(null);
        toast.success(this.transloco.translate('apiKeys.toasts.revoked'));
        this.load();
      },
      error: (error: unknown) => {
        this.revoking.set(false);
        this.revokeOpen.set(false);
        this.revokeTarget.set(null);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }
}
