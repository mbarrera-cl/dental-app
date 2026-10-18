import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePencil,
  lucidePlus,
  lucideRefreshCw,
  lucideScrollText,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import { HlmSkeleton } from '@ui/skeleton';
import {
  HlmTable,
  HlmTableContainer,
  HlmTBody,
  HlmTd,
  HlmTh,
  HlmTHead,
  HlmTr,
} from '@ui/table';
import { ConsentsApi, mapApiError, type ConsentTemplate } from 'data-access';

/**
 * Informed-consent template library: edit the wording of the seeded templates
 * or add new ones. Only users with `consents:manage` reach this page.
 */
@Component({
  selector: 'app-consents-admin-page',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmSkeleton,
    HlmTableContainer,
    HlmTable,
    HlmTHead,
    HlmTBody,
    HlmTr,
    HlmTh,
    HlmTd,
  ],
  providers: provideIcons({
    lucidePencil,
    lucidePlus,
    lucideRefreshCw,
    lucideScrollText,
    lucideTriangleAlert,
  }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="grid gap-1">
          <h2 class="text-2xl font-semibold tracking-tight">
            {{ 'admin.consents.title' | transloco }}
          </h2>
          <p class="text-muted-foreground text-sm">{{ 'admin.consents.subtitle' | transloco }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button hlmBtn variant="outline" size="sm" (click)="load()" [disabled]="loading()">
            <ng-icon name="lucideRefreshCw" />
            {{ 'common.refresh' | transloco }}
          </button>
          <button hlmBtn size="sm" type="button" (click)="openCreate()" data-testid="consent-template-new">
            <ng-icon name="lucidePlus" />
            {{ 'admin.consents.newTemplate' | transloco }}
          </button>
        </div>
      </header>

      @if (loadError(); as errorKey) {
        <div class="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
          <ng-icon name="lucideTriangleAlert" class="shrink-0" />
          <p class="flex-1">{{ errorKey | transloco }}</p>
          <button hlmBtn variant="outline" size="sm" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      }

      <div hlmTableContainer class="bg-card rounded-lg border">
        <table hlmTable>
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh>{{ 'admin.consents.columns.key' | transloco }}</th>
              <th hlmTh>{{ 'admin.consents.columns.title' | transloco }}</th>
              <th hlmTh>{{ 'admin.consents.columns.version' | transloco }}</th>
              <th hlmTh>{{ 'admin.consents.columns.active' | transloco }}</th>
              <th hlmTh class="text-end">{{ 'common.actions' | transloco }}</th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @if (loading()) {
              @for (row of skeletonRows; track row) {
                <tr hlmTr>
                  <td hlmTd><div hlmSkeleton class="h-4 w-24"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-4 w-64"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-4 w-8"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-5 w-14"></div></td>
                  <td hlmTd><div hlmSkeleton class="ms-auto h-8 w-16"></div></td>
                </tr>
              }
            } @else if (templates().length === 0) {
              <tr hlmTr>
                <td hlmTd colspan="5" class="py-12">
                  <div class="text-muted-foreground flex flex-col items-center gap-2 text-center">
                    <ng-icon name="lucideScrollText" class="size-6" />
                    <p>{{ 'admin.consents.empty' | transloco }}</p>
                  </div>
                </td>
              </tr>
            } @else {
              @for (template of templates(); track template.id) {
                <tr hlmTr data-testid="consent-template-row">
                  <td hlmTd class="font-mono text-xs">{{ template.key }}</td>
                  <td hlmTd class="font-medium">{{ template.title }}</td>
                  <td hlmTd class="tabular-nums">v{{ template.version }}</td>
                  <td hlmTd>
                    <span hlmBadge [variant]="template.active ? 'secondary' : 'outline'">
                      {{ (template.active ? 'admin.consents.active' : 'admin.consents.inactive') | transloco }}
                    </span>
                  </td>
                  <td hlmTd>
                    <div class="flex justify-end">
                      <button
                        hlmBtn
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        [attr.aria-label]="'common.edit' | transloco"
                        [attr.data-testid]="'consent-template-edit-' + template.key"
                        (click)="openEdit(template)"
                      >
                        <ng-icon name="lucidePencil" />
                      </button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        class="bg-card grid gap-4 rounded-lg border p-4"
        novalidate
        data-testid="consent-template-form"
      >
        <h3 class="text-lg font-semibold">
          {{ (editingKey() === null ? 'admin.consents.form.createTitle' : 'admin.consents.form.editTitle') | transloco }}
        </h3>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-2">
            <label hlmLabel for="consent-key">{{ 'admin.consents.form.key' | transloco }}</label>
            <input
              hlmInput
              id="consent-key"
              formControlName="key"
              autocomplete="off"
              placeholder="extraccion"
            />
          </div>
          <div class="grid gap-2">
            <label hlmLabel for="consent-title">{{ 'admin.consents.form.title' | transloco }}</label>
            <input hlmInput id="consent-title" formControlName="title" autocomplete="off" />
          </div>
        </div>

        <div class="grid gap-2">
          <label hlmLabel for="consent-body">{{ 'admin.consents.form.body' | transloco }}</label>
          <textarea
            hlmInput
            id="consent-body"
            rows="10"
            class="min-h-48 resize-y font-mono text-xs"
            formControlName="body"
          ></textarea>
          <p class="text-muted-foreground text-xs">{{ 'admin.consents.form.bodyHint' | transloco }}</p>
        </div>

        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" formControlName="active" />
          {{ 'admin.consents.form.active' | transloco }}
        </label>

        <div class="flex justify-end gap-2">
          <button hlmBtn type="button" variant="outline" (click)="openCreate()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button hlmBtn type="submit" [disabled]="form.invalid || saving()" data-testid="consent-template-save">
            {{ 'admin.consents.form.save' | transloco }}
          </button>
        </div>
      </form>
    </section>
  `,
})
export class ConsentsAdminPage {
  private readonly api = inject(ConsentsApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly templates = signal<ConsentTemplate[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editingKey = signal<string | null>(null);
  protected readonly skeletonRows = [0, 1, 2];

  protected readonly form = new FormGroup({
    key: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    body: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(20_000)],
    }),
    active: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api.listTemplates(true).subscribe({
      next: (templates) => this.templates.set(templates),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });
  }

  protected openCreate(): void {
    this.editingKey.set(null);
    this.form.reset({ key: '', title: '', body: '', active: true });
    this.form.controls.key.enable();
  }

  protected openEdit(template: ConsentTemplate): void {
    this.editingKey.set(template.key);
    this.form.reset({
      key: template.key,
      title: template.title,
      body: template.body,
      active: template.active,
    });
    this.form.controls.key.disable();
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.saving.set(true);

    this.api
      .upsertTemplate({
        key: value.key,
        title: value.title,
        body: value.body,
        active: value.active,
      })
      .subscribe({
        next: () => {
          toast.success(this.transloco.translate('admin.consents.saved'));
          this.saving.set(false);
          this.openCreate();
          this.load();
        },
        error: (error: unknown) => {
          toast.error(this.transloco.translate(mapApiError(error)));
          this.saving.set(false);
        },
      });
  }
}
