import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBadgeDollarSign,
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
import { HlmTBody, HlmTable, HlmTableContainer, HlmTd, HlmTh, HlmTHead, HlmTr } from '@ui/table';
import { HasPermissionDirective, PERMISSION_KEYS } from 'auth';
import { UcoApi, mapApiError, type UcoProcedure } from 'data-access';

/**
 * UCO fee catalog administration: table, search, create/edit dialog and
 * soft-delete. Gated by `uco:read` to browse and `uco:manage` to mutate.
 */
@Component({
  selector: 'app-uco-page',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmBadge,
    HlmSkeleton,
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
  ],
  providers: provideIcons({
    lucideBadgeDollarSign,
    lucidePencil,
    lucidePlus,
    lucideRefreshCw,
    lucideSearch,
    lucideSearchX,
    lucideTrash2,
    lucideTriangleAlert,
  }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="grid gap-1">
          <h2 class="text-2xl font-semibold tracking-tight">{{ 'admin.uco.title' | transloco }}</h2>
          <p class="text-muted-foreground text-sm">{{ 'admin.uco.subtitle' | transloco }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button hlmBtn variant="outline" size="sm" (click)="load()" [disabled]="loading()">
            <ng-icon name="lucideRefreshCw" />
            {{ 'common.refresh' | transloco }}
          </button>
          <button
            *hasPermission="permissionKeys.uco.manage"
            hlmBtn
            size="sm"
            data-testid="uco-create"
            (click)="openCreate()"
          >
            <ng-icon name="lucidePlus" />
            {{ 'admin.uco.newProcedure' | transloco }}
          </button>
        </div>
      </header>

      <div class="flex flex-wrap items-center gap-3">
        <div class="relative min-w-64 flex-1">
          <ng-icon
            name="lucideSearch"
            class="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2"
          />
          <input
            hlmInput
            class="ps-9"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            placeholder="{{ 'admin.uco.searchPlaceholder' | transloco }}"
            data-testid="uco-search"
          />
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            [checked]="includeInactive()"
            (change)="includeInactive.set($any($event.target).checked)"
          />
          {{ 'admin.uco.includeInactive' | transloco }}
        </label>
      </div>

      @if (loadError(); as errorKey) {
        <div class="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
          <ng-icon name="lucideTriangleAlert" class="shrink-0" />
          <p class="flex-1">{{ errorKey | transloco }}</p>
          <button hlmBtn variant="outline" size="sm" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      }

      <div hlmTableContainer class="bg-card rounded-lg border">
        <table hlmTable>
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh>{{ 'admin.uco.columns.code' | transloco }}</th>
              <th hlmTh class="hidden sm:table-cell">{{ 'admin.uco.columns.chapter' | transloco }}</th>
              <th hlmTh>{{ 'admin.uco.columns.name' | transloco }}</th>
              <th hlmTh class="text-end">{{ 'admin.uco.columns.units' | transloco }}</th>
              <th hlmTh class="hidden md:table-cell text-end">{{ 'admin.uco.columns.value' | transloco }}</th>
              <th hlmTh>{{ 'admin.uco.columns.status' | transloco }}</th>
              <th hlmTh class="text-end">{{ 'admin.uco.columns.actions' | transloco }}</th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @if (loading()) {
              @for (row of skeletonRows; track row) {
                <tr hlmTr>
                  <td hlmTd><div hlmSkeleton class="h-4 w-16"></div></td>
                  <td hlmTd class="hidden sm:table-cell"><div hlmSkeleton class="h-4 w-8"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-4 w-56"></div></td>
                  <td hlmTd><div hlmSkeleton class="ms-auto h-4 w-12"></div></td>
                  <td hlmTd class="hidden md:table-cell"><div hlmSkeleton class="ms-auto h-4 w-20"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-5 w-16"></div></td>
                  <td hlmTd><div hlmSkeleton class="ms-auto h-8 w-20"></div></td>
                </tr>
              }
            } @else if (filtered().length === 0) {
              <tr hlmTr>
                <td hlmTd colspan="7" class="py-12">
                  <div class="text-muted-foreground flex flex-col items-center gap-2 text-center">
                    <ng-icon name="lucideSearchX" class="size-6" />
                    <p>{{ (procedures().length === 0 ? 'admin.uco.empty' : 'admin.uco.noMatches') | transloco }}</p>
                  </div>
                </td>
              </tr>
            } @else {
              @for (procedure of filtered(); track procedure.id) {
                <tr hlmTr data-testid="uco-row">
                  <td hlmTd class="font-mono text-xs">{{ procedure.code }}</td>
                  <td hlmTd class="hidden sm:table-cell">{{ procedure.chapter }}</td>
                  <td hlmTd class="font-medium">{{ procedure.name }}</td>
                  <td hlmTd class="text-end tabular-nums">{{ procedure.units }}</td>
                  <td hlmTd class="hidden md:table-cell text-end tabular-nums">{{ formatMoney(procedure.units * ucoRate()) }}</td>
                  <td hlmTd>
                    <span hlmBadge [variant]="procedure.status === 'active' ? 'secondary' : 'outline'">
                      {{ 'admin.uco.status.' + procedure.status | transloco }}
                    </span>
                  </td>
                  <td hlmTd>
                    <div class="flex justify-end gap-1">
                      <button
                        *hasPermission="permissionKeys.uco.manage"
                        hlmBtn
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        [attr.aria-label]="'common.edit' | transloco"
                        [attr.data-testid]="'uco-edit-' + procedure.id"
                        (click)="openEdit(procedure)"
                      >
                        <ng-icon name="lucidePencil" />
                      </button>
                      <button
                        *hasPermission="permissionKeys.uco.manage"
                        hlmBtn
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        class="text-destructive"
                        [disabled]="procedure.status === 'inactive'"
                        [attr.aria-label]="'common.delete' | transloco"
                        [attr.data-testid]="'uco-delete-' + procedure.id"
                        (click)="askDeactivate(procedure)"
                      >
                        <ng-icon name="lucideTrash2" />
                      </button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>

    <!-- Create / edit dialog -->
    <hlm-dialog [state]="formOpen() ? 'open' : 'closed'" (stateChanged)="onFormStateChanged($event)">
      <hlm-dialog-content *hlmDialogPortal="let ctx" data-testid="uco-form-dialog" class="sm:max-w-md">
        <hlm-dialog-header>
          <h3 hlmDialogTitle>
            {{ (editing() === null ? 'admin.uco.form.createTitle' : 'admin.uco.form.editTitle') | transloco }}
          </h3>
          <p hlmDialogDescription>{{ 'admin.uco.subtitle' | transloco }}</p>
        </hlm-dialog-header>

        <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-4" novalidate>
          <div class="grid gap-2">
            <label hlmLabel for="uco-code">{{ 'admin.uco.form.code' | transloco }}</label>
            <input hlmInput id="uco-code" formControlName="code" data-testid="uco-form-code" />
          </div>
          <div class="grid gap-2">
            <label hlmLabel for="uco-chapter">{{ 'admin.uco.form.chapter' | transloco }}</label>
            <input hlmInput id="uco-chapter" formControlName="chapter" data-testid="uco-form-chapter" />
          </div>
          <div class="grid gap-2">
            <label hlmLabel for="uco-name">{{ 'admin.uco.form.name' | transloco }}</label>
            <input hlmInput id="uco-name" formControlName="name" data-testid="uco-form-name" />
          </div>
          <div class="grid gap-2">
            <label hlmLabel for="uco-units">{{ 'admin.uco.form.units' | transloco }}</label>
            <input hlmInput id="uco-units" type="number" step="0.001" min="0.001" formControlName="units" data-testid="uco-form-units" />
          </div>
          @if (editing() !== null) {
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" formControlName="active" />
              {{ 'admin.uco.form.active' | transloco }}
            </label>
          }
        </form>

        <hlm-dialog-footer>
          <button hlmBtn type="button" variant="outline" (click)="formOpen.set(false)">
            {{ 'common.cancel' | transloco }}
          </button>
          <button hlmBtn type="button" [disabled]="form.invalid || saving()" (click)="submit()" data-testid="uco-form-save">
            {{ 'admin.uco.form.save' | transloco }}
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>

    <!-- Deactivate confirmation -->
    <hlm-alert-dialog [state]="deactivateTarget() === null ? 'closed' : 'open'" (stateChanged)="onDeactivateStateChanged($event)">
      <hlm-alert-dialog-content *hlmAlertDialogPortal="let ctx">
        <hlm-alert-dialog-header>
          <h3 hlmAlertDialogTitle>{{ 'admin.uco.deleteTitle' | transloco }}</h3>
          <p hlmAlertDialogDescription>
            {{ 'admin.uco.deleteDescription' | transloco: { name: deactivateTarget()?.name ?? '' } }}
          </p>
        </hlm-alert-dialog-header>
        <hlm-alert-dialog-footer>
          <button hlmAlertDialogCancel type="button">{{ 'common.cancel' | transloco }}</button>
          <button hlmAlertDialogAction type="button" (click)="confirmDeactivate()" data-testid="uco-delete-confirm">
            {{ 'admin.uco.deactivate' | transloco }}
          </button>
        </hlm-alert-dialog-footer>
      </hlm-alert-dialog-content>
    </hlm-alert-dialog>
  `,
})
export class UcoPage {
  private readonly api = inject(UcoApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly permissionKeys = PERMISSION_KEYS;

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly procedures = signal<UcoProcedure[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly includeInactive = signal(true);
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  /** Reference CLP rate of one UCO unit (mirrors `quotes.ucoRate` default). */
  protected readonly ucoRate = signal(3000);

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<UcoProcedure | null>(null);
  protected readonly saving = signal(false);
  protected readonly deactivateTarget = signal<UcoProcedure | null>(null);

  protected readonly form = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    chapter: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    units: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
    active: new FormControl(true, { nonNullable: true }),
  });

  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const includeInactive = this.includeInactive();

    return this.procedures().filter(
      (procedure) =>
        (includeInactive || procedure.status === 'active') &&
        (needle === '' ||
          procedure.code.toLowerCase().includes(needle) ||
          procedure.name.toLowerCase().includes(needle) ||
          procedure.chapter.toLowerCase().includes(needle)),
    );
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api.list('', false).subscribe({
      next: (procedures) => this.procedures.set(procedures),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ code: '', chapter: '', name: '', units: 1, active: true });
    this.form.controls.code.enable();
    this.formOpen.set(true);
  }

  protected openEdit(procedure: UcoProcedure): void {
    this.editing.set(procedure);
    this.form.reset({
      code: procedure.code,
      chapter: procedure.chapter,
      name: procedure.name,
      units: procedure.units,
      active: procedure.status === 'active',
    });
    this.formOpen.set(true);
  }

  protected onFormStateChanged(state: 'open' | 'closed'): void {
    this.formOpen.set(state === 'open');
  }

  protected onDeactivateStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.deactivateTarget.set(null);
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const editing = this.editing();

    this.saving.set(true);

    const request$ =
      editing === null
        ? this.api.create({ code: value.code, chapter: value.chapter, name: value.name, units: value.units })
        : this.api.update(editing.id, {
            code: value.code,
            chapter: value.chapter,
            name: value.name,
            units: value.units,
            active: value.active,
          });

    request$.subscribe({
      next: () => {
        toast.success(
          this.transloco.translate(editing === null ? 'admin.uco.created' : 'admin.uco.saved'),
        );
        this.formOpen.set(false);
        this.saving.set(false);
        this.load();
      },
      error: (error: unknown) => {
        toast.error(mapApiError(error));
        this.saving.set(false);
      },
    });
  }

  protected askDeactivate(procedure: UcoProcedure): void {
    this.deactivateTarget.set(procedure);
  }

  protected confirmDeactivate(): void {
    const target = this.deactivateTarget();

    if (target === null) {
      return;
    }

    this.api.delete(target.id).subscribe({
      next: () => {
        toast.success(this.transloco.translate('admin.uco.deactivated'));
        this.deactivateTarget.set(null);
        this.load();
      },
      error: (error: unknown) => toast.error(mapApiError(error)),
    });
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat(this.language() === 'en' ? 'en-US' : 'es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
