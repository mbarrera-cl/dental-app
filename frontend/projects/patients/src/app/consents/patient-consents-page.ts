import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePrinter, lucideScrollText, lucideTriangleAlert } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HasPermissionDirective, PERMISSION_KEYS } from 'auth';
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
import {
  ConsentsApi,
  mapApiError,
  type ConsentRecord,
  type ConsentTemplate,
} from 'data-access';
import { ClinicalRecordStore } from '../clinical-record.store';

/**
 * Consents tab of the patient record: preview an active template, capture a
 * simple digital acceptance (name + explicit checkbox) and keep the history.
 */
@Component({
  selector: 'app-patient-consents-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
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
    HasPermissionDirective,
  ],
  providers: provideIcons({ lucidePrinter, lucideScrollText, lucideTriangleAlert }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-6">
      <header class="grid gap-1">
        <h2 class="text-2xl font-semibold tracking-tight">{{ 'consents.title' | transloco }}</h2>
        <p class="text-muted-foreground text-sm">{{ 'consents.subtitle' | transloco }}</p>
      </header>

      @if (loadError(); as errorKey) {
        <div
          class="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
        >
          <ng-icon name="lucideTriangleAlert" class="shrink-0" />
          <p class="flex-1">{{ errorKey | transloco }}</p>
          <button hlmBtn variant="outline" size="sm" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      }

      @if (canRecord()) {
        <div
          *hasPermission="permissionKeys.consents.record"
          class="bg-card grid gap-4 rounded-lg border p-4"
          data-testid="consent-form"
        >
          <h3 class="text-lg font-semibold">{{ 'consents.new' | transloco }}</h3>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-2">
              <label hlmLabel for="consent-template">{{ 'consents.template' | transloco }}</label>
              <select
                hlmInput
                id="consent-template"
                [value]="selectedKey()"
                (change)="onTemplateChange($event)"
                data-testid="consent-template"
              >
                <option value="">{{ 'consents.selectTemplate' | transloco }}</option>
                @for (template of templates(); track template.key) {
                  <option [value]="template.key">{{ template.title }} · v{{ template.version }}</option>
                }
              </select>
            </div>

            <div class="grid gap-2">
              <label hlmLabel for="consent-procedure">{{ 'consents.procedure' | transloco }}</label>
              <input
                hlmInput
                id="consent-procedure"
                autocomplete="off"
                [value]="procedure()"
                (input)="procedure.set($any($event.target).value)"
                [placeholder]="'consents.procedurePlaceholder' | transloco"
              />
            </div>
          </div>

          @if (preview(); as text) {
            <div
              class="bg-muted/40 max-h-72 overflow-auto rounded-md border p-4 text-sm whitespace-pre-wrap"
              data-testid="consent-preview"
            >
              {{ text }}
            </div>
          }

          <div class="grid gap-2 sm:max-w-md">
            <label hlmLabel for="consent-acceptor">{{ 'consents.acceptorName' | transloco }}</label>
            <input
              hlmInput
              id="consent-acceptor"
              autocomplete="off"
              [value]="acceptorName()"
              (input)="acceptorName.set($any($event.target).value)"
              [placeholder]="'consents.acceptorPlaceholder' | transloco"
              data-testid="consent-acceptor"
            />
          </div>

          <label class="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              class="mt-0.5"
              [checked]="accepted()"
              (change)="accepted.set($any($event.target).checked)"
              data-testid="consent-accepted"
            />
            <span>{{ 'consents.acceptedLabel' | transloco }}</span>
          </label>

          <div class="flex justify-end">
            <button
              hlmBtn
              type="button"
              [disabled]="!canSubmit() || saving()"
              (click)="submit()"
              data-testid="consent-record"
            >
              {{ 'consents.accept' | transloco }}
            </button>
          </div>
        </div>
      }

      <div hlmTableContainer class="bg-card rounded-lg border">
        <table hlmTable>
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh>{{ 'consents.columns.date' | transloco }}</th>
              <th hlmTh>{{ 'consents.columns.title' | transloco }}</th>
              <th hlmTh class="hidden sm:table-cell">{{ 'consents.columns.procedure' | transloco }}</th>
              <th hlmTh class="hidden md:table-cell">{{ 'consents.columns.acceptor' | transloco }}</th>
              <th hlmTh class="hidden sm:table-cell">{{ 'consents.columns.version' | transloco }}</th>
              <th hlmTh class="text-end">{{ 'common.actions' | transloco }}</th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @if (loading()) {
              @for (row of skeletonRows; track row) {
                <tr hlmTr>
                  <td hlmTd><div hlmSkeleton class="h-4 w-24"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-4 w-56"></div></td>
                  <td hlmTd class="hidden sm:table-cell"><div hlmSkeleton class="h-4 w-32"></div></td>
                  <td hlmTd class="hidden md:table-cell"><div hlmSkeleton class="h-4 w-32"></div></td>
                  <td hlmTd class="hidden sm:table-cell"><div hlmSkeleton class="h-4 w-8"></div></td>
                  <td hlmTd><div hlmSkeleton class="ms-auto h-8 w-16"></div></td>
                </tr>
              }
            } @else if (records().length === 0) {
              <tr hlmTr>
                <td hlmTd colspan="6" class="py-12">
                  <div class="text-muted-foreground flex flex-col items-center gap-2 text-center">
                    <ng-icon name="lucideScrollText" class="size-6" />
                    <p>{{ 'consents.empty' | transloco }}</p>
                  </div>
                </td>
              </tr>
            } @else {
              @for (record of records(); track record.id) {
                <tr hlmTr data-testid="consent-row">
                  <td hlmTd class="whitespace-nowrap">{{ formatDate(record.acceptedAt) }}</td>
                  <td hlmTd class="font-medium">{{ record.title }}</td>
                  <td hlmTd class="hidden sm:table-cell">{{ record.procedure ?? '—' }}</td>
                  <td hlmTd class="hidden md:table-cell">{{ record.acceptorName }}</td>
                  <td hlmTd class="hidden sm:table-cell tabular-nums">v{{ record.templateVersion }}</td>
                  <td hlmTd>
                    <div class="flex justify-end">
                      <a
                        hlmBtn
                        variant="ghost"
                        size="icon-sm"
                        [routerLink]="['/patients/consentimientos', record.id, 'imprimir']"
                        [attr.aria-label]="'consents.print.action' | transloco"
                        [attr.data-testid]="'consent-print-' + record.id"
                      >
                        <ng-icon name="lucidePrinter" />
                      </a>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class PatientConsentsPage {
  private readonly api = inject(ConsentsApi);
  private readonly store = inject(ClinicalRecordStore);
  private readonly transloco = inject(TranslocoService);

  protected readonly permissionKeys = PERMISSION_KEYS;
  protected readonly templates = signal<ConsentTemplate[]>([]);
  protected readonly records = signal<ConsentRecord[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly selectedKey = signal('');
  protected readonly procedure = signal('');
  protected readonly acceptorName = signal('');
  protected readonly accepted = signal(false);
  protected readonly skeletonRows = [0, 1, 2];

  protected readonly selectedTemplate = computed(
    () => this.templates().find((template) => template.key === this.selectedKey()) ?? null,
  );

  protected readonly preview = computed(() => {
    const template = this.selectedTemplate();

    if (template === null) {
      return '';
    }

    const patient = this.store.patient();
    const patientName =
      patient === null
        ? '{{paciente}}'
        : `${patient.nombres} ${patient.apellidoPaterno} ${patient.apellidoMaterno}`;
    const procedure = this.procedure().trim() === '' ? template.title : this.procedure().trim();

    return template.body
      .split('{{paciente}}')
      .join(patientName)
      .split('{{procedimiento}}')
      .join(procedure);
  });

  protected readonly canRecord = computed(() => this.store.patientId() !== '');
  protected readonly canSubmit = computed(
    () => this.selectedKey() !== '' && this.acceptorName().trim() !== '' && this.accepted(),
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    const patientId = this.store.patientId();

    if (patientId === '') {
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);

    this.api.listTemplates().subscribe({
      next: (templates) => this.templates.set(templates),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
    });

    this.api.listByPatient(patientId).subscribe({
      next: (records) => this.records.set(records),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });
  }

  protected onTemplateChange(event: Event): void {
    this.selectedKey.set((event.target as HTMLSelectElement).value);
  }

  protected submit(): void {
    const patientId = this.store.patientId();

    if (!this.canSubmit() || patientId === '' || this.saving()) {
      return;
    }

    const procedure = this.procedure().trim();

    this.saving.set(true);

    this.api
      .record(patientId, {
        templateKey: this.selectedKey(),
        procedure: procedure === '' ? null : procedure,
        acceptorName: this.acceptorName().trim(),
      })
      .subscribe({
        next: () => {
          toast.success(this.transloco.translate('consents.toasts.recorded'));
          this.accepted.set(false);
          this.acceptorName.set('');
          this.procedure.set('');
          this.selectedKey.set('');
          this.saving.set(false);
          this.load();
        },
        error: (error: unknown) => {
          toast.error(this.transloco.translate(mapApiError(error)));
          this.saving.set(false);
        },
      });
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang() === 'en' ? 'en-US' : 'es-CL', {
      dateStyle: 'medium',
    }).format(new Date(value));
  }
}
