import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideChevronDown,
  lucideExternalLink,
  lucideEye,
  lucideEyeOff,
  lucideGripVertical,
  lucidePencil,
  lucidePlus,
  lucideRotateCcw,
  lucideSearch,
  lucideTrash2,
  lucideTriangleAlert,
  lucideX,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
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
import { HlmButton } from '@ui/button';
import { HlmSpinner } from '@ui/spinner';
import { SessionStore } from 'auth';
import {
  mapApiError,
  NavigationApi,
  PermissionsApi,
  RolesApi,
  type CreateMenuItemPayload,
  type MenuItem,
  type MenuKind,
  type PermissionCatalog,
  type Role,
  type UpdateMenuItemPayload,
} from 'data-access';
import { catchError, forkJoin, map, of } from 'rxjs';
import { MENU_ICON_NAMES, MENU_ICONS, resolveIcon } from '../../navigation/icon-catalog';
import { NavigationStore } from '../../navigation/navigation-store';
import { defaultIcon, NAVIGATION_ROUTES, resolveRoute } from '../../navigation/route-registry';
import { previewMenuTree } from './menu-preview';
import { dropNode, findNode, shiftNode, toReorderEntries } from './menu-tree-edit';

type Destination = 'route' | 'external';

/** Raw shape of the editor form (all controls non-nullable). */
interface MenuFormValue {
  kind: MenuKind;
  parentId: string;
  label: string;
  destination: Destination;
  routeKey: string;
  externalUrl: string;
  icon: string;
  requiredPermission: string;
  enabled: boolean;
}

/**
 * Menu configuration page (`/settings/menu`). The tree is the *full* admin
 * view (`GET /navigation/items`, disabled entries included); the sidebar
 * keeps its own filtered copy, refreshed after every mutation.
 *
 * Drag & drop and the up/down buttons share the same pure operations
 * (`menu-tree-edit`): the drop is applied optimistically, confirmed by the
 * batch response of `PUT /navigation/order` and rolled back by refetching on
 * failure. The "view as" preview mirrors the backend filtering client-side
 * (`menu-preview`).
 */
@Component({
  selector: 'app-menu-page',
  imports: [
    ReactiveFormsModule,
    NgTemplateOutlet,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    NgIcon,
    TranslocoPipe,
    HlmButton,
    HlmSpinner,
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
    provideIcons(MENU_ICONS),
    provideIcons({
      lucideArrowDown,
      lucideArrowUp,
      lucideChevronDown,
      lucideExternalLink,
      lucideEye,
      lucideEyeOff,
      lucideGripVertical,
      lucidePencil,
      lucidePlus,
      lucideRotateCcw,
      lucideSearch,
      lucideTrash2,
      lucideTriangleAlert,
      lucideX,
    }),
  ],
  templateUrl: './menu-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuPage implements OnInit {
  private readonly api = inject(NavigationApi);
  private readonly permissionsApi = inject(PermissionsApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly sidebar = inject(NavigationStore);
  private readonly session = inject(SessionStore);
  private readonly transloco = inject(TranslocoService);

  protected readonly routeOptions = NAVIGATION_ROUTES;

  protected readonly loading = signal(true);
  protected readonly tree = signal<readonly MenuItem[]>([]);
  protected readonly roles = signal<readonly Role[]>([]);
  protected readonly permissionOptions = signal<readonly string[]>([]);

  protected readonly editorOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly iconPickerOpen = signal(false);
  protected readonly iconQuery = signal('');
  protected readonly deleteTarget = signal<MenuItem | null>(null);
  protected readonly deleting = signal(false);
  protected readonly resetOpen = signal(false);
  protected readonly resetting = signal(false);
  protected readonly previewRoleId = signal('');

  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly form = new FormGroup({
    kind: new FormControl<MenuKind>('item', { nonNullable: true }),
    parentId: new FormControl('', { nonNullable: true }),
    label: new FormControl('', { nonNullable: true }),
    destination: new FormControl<Destination>('route', { nonNullable: true }),
    routeKey: new FormControl('', { nonNullable: true }),
    externalUrl: new FormControl('', { nonNullable: true }),
    icon: new FormControl('', { nonNullable: true }),
    requiredPermission: new FormControl('', { nonNullable: true }),
    enabled: new FormControl(true, { nonNullable: true }),
  });

  protected readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly kind = computed(() => this.formValue().kind);
  protected readonly destination = computed(() => this.formValue().destination);

  /** True when the edited item points to a route key missing from the registry. */
  protected readonly selectedRouteUnknown = computed(() => {
    const key = this.formValue().routeKey;
    return key !== '' && resolveRoute(key) === undefined;
  });

  protected readonly editingItem = computed(() => {
    const id = this.editingId();
    return id === null ? null : findNode(this.tree(), id);
  });

  protected readonly parentOptions = computed(() =>
    this.tree().filter((node) => node.kind === 'group'),
  );

  protected readonly filteredIcons = computed(() => {
    const query = this.iconQuery().trim().toLowerCase();
    return query === '' ? MENU_ICON_NAMES : MENU_ICON_NAMES.filter((name) => name.includes(query));
  });

  /** Current icon of the form, already resolved to a registered catalog id. */
  protected readonly selectedIcon = computed(() => resolveIcon(this.formValue().icon));

  private readonly permissionLabels = computed<Record<string, string>>(() => {
    this.activeLang();
    return (this.transloco.translateObject('permissions.items') ?? {}) as Record<string, string>;
  });

  private readonly previewPermissions = computed<ReadonlySet<string>>(() => {
    const roleId = this.previewRoleId();

    if (roleId === '') {
      return new Set(this.session.permissions().effective);
    }

    const role = this.roles().find((candidate) => candidate.id === roleId);
    return new Set(role?.permissions ?? []);
  });

  protected readonly previewTree = computed(() => {
    this.activeLang();

    return previewMenuTree(
      this.tree(),
      this.previewPermissions(),
      (routeKey) => resolveRoute(routeKey) !== undefined,
    );
  });

  ngOnInit(): void {
    this.reload();
  }

  // --- Tree rendering helpers -------------------------------------------------

  protected labelOf(item: MenuItem): string {
    this.activeLang();

    if (item.label !== null) {
      return item.label;
    }

    const route = item.routeKey === null ? undefined : resolveRoute(item.routeKey);

    // Unknown route keys show the raw key so dead entries stay identifiable.
    return route === undefined ? (item.routeKey ?? '') : this.transloco.translate(route.label);
  }

  protected iconOf(item: MenuItem): string {
    return resolveIcon(item.icon ?? defaultIcon(item.routeKey) ?? null);
  }

  protected isUnknownRoute(item: MenuItem): boolean {
    return item.kind === 'item' && item.routeKey !== null && resolveRoute(item.routeKey) === undefined;
  }

  protected permissionLabel(key: string): string {
    return this.permissionLabels()[key] ?? key;
  }

  // --- Loading ---------------------------------------------------------------

  private reload(): void {
    this.loading.set(true);

    forkJoin({
      tree: this.api.list(),
      roles: this.rolesApi.list().pipe(catchError(() => of<Role[]>([]))),
      catalog: this.permissionsApi.getCatalog().pipe(catchError(() => of<PermissionCatalog | null>(null))),
    }).subscribe({
      next: ({ tree, roles, catalog }) => {
        this.tree.set(tree);
        this.roles.set(roles);
        this.permissionOptions.set(flattenCatalog(catalog));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  /** Refetches the full tree (and the sidebar copy) after a mutation. */
  private reloadTree(): void {
    this.api.list().subscribe({
      next: (tree) => {
        this.tree.set(tree);
        this.sidebar.load();
      },
      error: (error: unknown) => {
        toast.error(this.transloco.translate(mapApiError(error)));
        this.reload();
      },
    });
  }

  /** Applies an optimistic order and lets `PUT /navigation/order` confirm it. */
  private applyOrder(next: readonly MenuItem[]): void {
    this.tree.set(next);

    this.api.reorder(toReorderEntries(next)).subscribe({
      next: (tree) => {
        this.tree.set(tree);
        this.sidebar.load();
      },
      error: (error: unknown) => {
        toast.error(this.transloco.translate(mapApiError(error)));
        this.reloadTree();
      },
    });
  }

  // --- Drag & drop / ordering -------------------------------------------------

  // `any` on the event: CDK types it from each drop list's data binding
  // (`null` for the root list, the group id for the nested ones).
  protected onDrop(event: CdkDragDrop<any>): void {
    const sameList = event.previousContainer === event.container;
    const next = dropNode(this.tree(), {
      movedId: event.item.data as string,
      toParentId: event.container.data === null ? null : (event.container.data as string),
      toIndex: event.currentIndex,
      sameList,
    });

    if (next === null) {
      toast.error(this.transloco.translate('menu.errors.invalidMove'));
      return;
    }

    this.applyOrder(next);
  }

  protected shift(item: MenuItem, delta: number): void {
    const next = shiftNode(this.tree(), item.id, delta);

    if (next !== null) {
      this.applyOrder(next);
    }
  }

  // --- Row actions ------------------------------------------------------------

  protected toggleEnabled(item: MenuItem): void {
    this.busyId.set(item.id);

    this.api.update(item.id, { enabled: !item.enabled }).subscribe({
      next: () => {
        this.busyId.set(null);
        toast.success(this.transloco.translate(item.enabled ? 'menu.toasts.hidden' : 'menu.toasts.shown'));
        this.reloadTree();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  protected askDelete(item: MenuItem): void {
    this.deleteTarget.set(item);
  }

  protected onDeleteStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.deleteTarget.set(null);
    }
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();

    if (target === null) {
      return;
    }

    this.deleting.set(true);

    this.api.remove(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);

        if (this.editingId() === target.id) {
          this.closeEditor();
        }

        toast.success(this.transloco.translate('menu.toasts.deleted'));
        this.reloadTree();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  // --- Reset ------------------------------------------------------------------

  protected askReset(): void {
    this.resetOpen.set(true);
  }

  protected onResetStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.resetOpen.set(false);
    }
  }

  protected confirmReset(): void {
    this.resetting.set(true);

    this.api.reset().subscribe({
      next: (tree) => {
        this.resetting.set(false);
        this.resetOpen.set(false);
        this.tree.set(tree);
        this.closeEditor();
        this.sidebar.load();
        toast.success(this.transloco.translate('menu.toasts.resetDone'));
      },
      error: (error: unknown) => {
        this.resetting.set(false);
        this.resetOpen.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  // --- Editor -----------------------------------------------------------------

  protected startCreate(): void {
    this.editingId.set(null);
    this.editorOpen.set(true);
    this.formError.set(null);
    this.iconPickerOpen.set(false);
    this.form.reset({
      kind: 'item',
      parentId: '',
      label: '',
      destination: 'route',
      routeKey: '',
      externalUrl: '',
      icon: '',
      requiredPermission: '',
      enabled: true,
    });
  }

  protected startEdit(item: MenuItem): void {
    this.editingId.set(item.id);
    this.editorOpen.set(true);
    this.formError.set(null);
    this.iconPickerOpen.set(false);
    this.form.reset({
      kind: item.kind,
      parentId: item.parentId ?? '',
      label: item.label ?? '',
      destination: item.externalUrl !== null ? 'external' : 'route',
      routeKey: item.routeKey ?? '',
      externalUrl: item.externalUrl ?? '',
      icon: item.icon ?? '',
      requiredPermission: item.requiredPermission ?? '',
      enabled: item.enabled,
    });
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
    this.formError.set(null);
    this.iconPickerOpen.set(false);
  }

  protected toggleIconPicker(): void {
    this.iconPickerOpen.update((open) => !open);
  }

  protected onIconQuery(event: Event): void {
    this.iconQuery.set((event.target as HTMLInputElement).value);
  }

  protected pickIcon(name: string): void {
    this.form.controls.icon.setValue(name);
    this.iconPickerOpen.set(false);
  }

  protected save(): void {
    const value = this.form.getRawValue();
    const error = validate(value);

    if (error !== null) {
      this.formError.set(error);
      return;
    }

    this.formError.set(null);
    this.saving.set(true);

    const editingId = this.editingId();

    if (editingId === null) {
      this.api.create(this.toCreatePayload(value)).subscribe({
        next: () => this.afterSave('menu.toasts.created'),
        error: (failure: unknown) => this.afterSaveError(failure),
      });
      return;
    }

    this.api.update(editingId, this.toUpdatePayload(value)).subscribe({
      next: () => this.afterSave('menu.toasts.updated'),
      error: (failure: unknown) => this.afterSaveError(failure),
    });
  }

  private afterSave(toastKey: string): void {
    this.saving.set(false);
    this.closeEditor();
    toast.success(this.transloco.translate(toastKey));
    this.reloadTree();
  }

  private afterSaveError(error: unknown): void {
    this.saving.set(false);
    this.formError.set(mapApiError(error));
  }

  private toCreatePayload(value: MenuFormValue): CreateMenuItemPayload {
    const payload: CreateMenuItemPayload = {
      kind: value.kind,
      label: cleanLabel(value),
      icon: value.kind === 'divider' ? null : value.icon === '' ? null : value.icon,
      routeKey: value.kind === 'item' && value.destination === 'route' ? value.routeKey : null,
      externalUrl:
        value.kind === 'item' && value.destination === 'external' ? value.externalUrl.trim() : null,
      requiredPermission:
        value.kind === 'divider' ? null : value.requiredPermission === '' ? null : value.requiredPermission,
      enabled: value.enabled,
    };

    if (value.kind !== 'group') {
      payload.parentId = value.parentId === '' ? null : value.parentId;
    }

    return payload;
  }

  private toUpdatePayload(value: MenuFormValue): UpdateMenuItemPayload {
    return {
      label: value.kind === 'divider' ? null : cleanLabel(value),
      icon: value.kind === 'divider' ? null : value.icon === '' ? null : value.icon,
      routeKey: value.kind === 'item' && value.destination === 'route' ? value.routeKey : null,
      externalUrl:
        value.kind === 'item' && value.destination === 'external' ? value.externalUrl.trim() : null,
      requiredPermission:
        value.kind === 'divider' ? null : value.requiredPermission === '' ? null : value.requiredPermission,
      enabled: value.enabled,
    };
  }

  // --- Preview ----------------------------------------------------------------

  protected onPreviewRoleChanged(event: Event): void {
    this.previewRoleId.set((event.target as HTMLSelectElement).value);
  }
}

function cleanLabel(value: MenuFormValue): string | null {
  const label = value.label.trim();
  return label === '' ? null : label;
}

/** Client-side guards mirroring the domain: feedback without a round trip. */
function validate(value: MenuFormValue): string | null {
  const label = value.label.trim();

  if (value.kind === 'group' && label === '') {
    return 'menu.editor.errors.labelRequired';
  }

  if (label.length > 60) {
    return 'menu.editor.errors.labelTooLong';
  }

  if (value.icon.length > 40) {
    return 'menu.editor.errors.iconTooLong';
  }

  if (value.kind !== 'item') {
    return null;
  }

  if (value.destination === 'route' && value.routeKey === '') {
    return 'menu.editor.errors.routeRequired';
  }

  if (value.destination === 'external' && !isHttpsUrl(value.externalUrl.trim())) {
    return 'menu.editor.errors.externalInvalid';
  }

  return null;
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname !== '' &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}

function flattenCatalog(catalog: PermissionCatalog | null): string[] {
  if (catalog === null) {
    return [];
  }

  return catalog.categories
    .flatMap((category) => category.permissions.map((permission) => permission.key))
    .sort();
}
