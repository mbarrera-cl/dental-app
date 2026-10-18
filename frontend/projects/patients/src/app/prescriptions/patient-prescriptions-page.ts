import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFilePlus2,
  lucideFileText,
  lucidePlus,
  lucidePrinter,
  lucideTrash2,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
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
import { PrescriptionsApi, mapApiError, type Prescription } from 'data-access';
import { ClinicalRecordStore } from '../clinical-record.store';

type PrescriptionItemForm = FormGroup<{
  medicamento: FormControl<string>;
  dosis: FormControl<string>;
  frecuencia: FormControl<string>;
  duracion: FormControl<string>;
}>;

/**
 * Prescriptions tab of the patient record: list the issued documents and
 * create a new one with any number of free-text medications.
 */
@Component({
  selector: 'app-patient-prescriptions-page',
  imports: [
    ReactiveFormsModule,
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
  providers: provideIcons({
    lucideFilePlus2,
    lucideFileText,
    lucidePlus,
    lucidePrinter,
    lucideTrash2,
    lucideTriangleAlert,
  }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="grid gap-1">
          <h2 class="text-2xl font-semibold tracking-tight">
            {{ 'prescriptions.title' | transloco }}
          </h2>
          <p class="text-muted-foreground text-sm">
            {{ 'prescriptions.subtitle' | transloco }}
          </p>
        </div>
        <button
          *hasPermission="permissionKeys.prescriptions.create"
          hlmBtn
          size="sm"
          type="button"
          data-testid="prescription-create"
          (click)="openForm()"
        >
          <ng-icon name="lucideFilePlus2" />
          {{ 'prescriptions.new' | transloco }}
        </button>
      </header>

      @if (formOpen()) {
        <form
          [formGroup]="form"
          (ngSubmit)="submit()"
          class="bg-card grid gap-4 rounded-lg border p-4"
          novalidate
          data-testid="prescription-form"
        >
          <div formArrayName="items" class="grid gap-4">
            @for (item of items.controls; track $index; let i = $index) {
              <div
                [formGroupName]="i"
                class="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-5"
              >
                <div class="grid gap-2 lg:col-span-2">
                  <label hlmLabel [for]="'prescription-med-' + i">
                    {{ 'prescriptions.form.medication' | transloco }}
                  </label>
                  <input
                    hlmInput
                    [id]="'prescription-med-' + i"
                    formControlName="medicamento"
                    autocomplete="off"
                  />
                </div>
                <div class="grid gap-2">
                  <label hlmLabel [for]="'prescription-dose-' + i">
                    {{ 'prescriptions.form.dose' | transloco }}
                  </label>
                  <input
                    hlmInput
                    [id]="'prescription-dose-' + i"
                    formControlName="dosis"
                    autocomplete="off"
                  />
                </div>
                <div class="grid gap-2">
                  <label hlmLabel [for]="'prescription-freq-' + i">
                    {{ 'prescriptions.form.frequency' | transloco }}
                  </label>
                  <input
                    hlmInput
                    [id]="'prescription-freq-' + i"
                    formControlName="frecuencia"
                    autocomplete="off"
                  />
                </div>
                <div class="grid gap-2">
                  <label hlmLabel [for]="'prescription-dur-' + i">
                    {{ 'prescriptions.form.duration' | transloco }}
                  </label>
                  <div class="flex items-center gap-2">
                    <input
                      hlmInput
                      [id]="'prescription-dur-' + i"
                      formControlName="duracion"
                      autocomplete="off"
                    />
                    <button
                      hlmBtn
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      class="text-destructive shrink-0"
                      [attr.aria-label]="'prescriptions.form.removeItem' | transloco"
                      [disabled]="items.length === 1"
                      (click)="removeItem(i)"
                    >
                      <ng-icon name="lucideTrash2" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>

          <button hlmBtn type="button" variant="outline" size="sm" (click)="addItem()">
            <ng-icon name="lucidePlus" />
            {{ 'prescriptions.form.addItem' | transloco }}
          </button>

          <div class="grid gap-2">
            <label hlmLabel for="prescription-indicaciones">
              {{ 'prescriptions.form.indications' | transloco }}
            </label>
            <textarea
              hlmInput
              id="prescription-indicaciones"
              rows="3"
              class="min-h-20 resize-y"
              formControlName="indicaciones"
              [placeholder]="'prescriptions.form.indicationsPlaceholder' | transloco"
            ></textarea>
          </div>

          <div class="flex justify-end gap-2">
            <button hlmBtn type="button" variant="outline" (click)="formOpen.set(false)">
              {{ 'common.cancel' | transloco }}
            </button>
            <button
              hlmBtn
              type="submit"
              [disabled]="saving()"
              data-testid="prescription-save"
            >
              {{ 'prescriptions.form.save' | transloco }}
            </button>
          </div>
        </form>
      }

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

      <div hlmTableContainer class="bg-card rounded-lg border">
        <table hlmTable>
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh>{{ 'prescriptions.columns.date' | transloco }}</th>
              <th hlmTh>{{ 'prescriptions.columns.medications' | transloco }}</th>
              <th hlmTh class="hidden sm:table-cell">
                {{ 'prescriptions.columns.issuedBy' | transloco }}
              </th>
              <th hlmTh class="text-end">{{ 'common.actions' | transloco }}</th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @if (loading()) {
              @for (row of skeletonRows; track row) {
                <tr hlmTr>
                  <td hlmTd><div hlmSkeleton class="h-4 w-24"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-4 w-64"></div></td>
                  <td hlmTd class="hidden sm:table-cell">
                    <div hlmSkeleton class="h-4 w-32"></div>
                  </td>
                  <td hlmTd><div hlmSkeleton class="ms-auto h-8 w-16"></div></td>
                </tr>
              }
            } @else if (prescriptions().length === 0) {
              <tr hlmTr>
                <td hlmTd colspan="4" class="py-12">
                  <div class="text-muted-foreground flex flex-col items-center gap-2 text-center">
                    <ng-icon name="lucideFileText" class="size-6" />
                    <p>{{ 'prescriptions.empty' | transloco }}</p>
                  </div>
                </td>
              </tr>
            } @else {
              @for (prescription of prescriptions(); track prescription.id) {
                <tr hlmTr data-testid="prescription-row">
                  <td hlmTd class="whitespace-nowrap">{{ formatDate(prescription.issuedAt) }}</td>
                  <td hlmTd class="font-medium">{{ summary(prescription) }}</td>
                  <td hlmTd class="hidden sm:table-cell">{{ prescription.issuedByName }}</td>
                  <td hlmTd>
                    <div class="flex justify-end">
                      <a
                        hlmBtn
                        variant="ghost"
                        size="icon-sm"
                        [routerLink]="['/patients/recetas', prescription.id, 'imprimir']"
                        [attr.aria-label]="'prescriptions.print.action' | transloco"
                        [attr.data-testid]="'prescription-print-' + prescription.id"
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
export class PatientPrescriptionsPage {
  private readonly api = inject(PrescriptionsApi);
  private readonly store = inject(ClinicalRecordStore);
  private readonly transloco = inject(TranslocoService);

  protected readonly permissionKeys = PERMISSION_KEYS;
  protected readonly prescriptions = signal<Prescription[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly skeletonRows = [0, 1, 2];

  protected readonly form = new FormGroup({
    indicaciones: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    items: new FormArray<PrescriptionItemForm>([]),
  });

  constructor() {
    this.load();
  }

  protected get items(): FormArray<PrescriptionItemForm> {
    return this.form.controls.items;
  }

  protected load(): void {
    const patientId = this.store.patientId();

    if (patientId === '') {
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);

    this.api.listByPatient(patientId).subscribe({
      next: (prescriptions) => this.prescriptions.set(prescriptions),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });
  }

  protected openForm(): void {
    this.items.clear();
    this.items.push(this.newItem());
    this.form.controls.indicaciones.reset('');
    this.formOpen.set(true);
  }

  protected addItem(): void {
    this.items.push(this.newItem());
  }

  protected removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const patientId = this.store.patientId();

    if (patientId === '') {
      return;
    }

    const raw = this.form.getRawValue();

    this.saving.set(true);

    this.api
      .create(patientId, {
        items: raw.items.map((item) => ({
          medicamento: item.medicamento.trim(),
          dosis: item.dosis.trim(),
          frecuencia: item.frecuencia.trim(),
          duracion: item.duracion.trim(),
        })),
        indicaciones: raw.indicaciones.trim() === '' ? null : raw.indicaciones.trim(),
      })
      .subscribe({
        next: () => {
          toast.success(this.transloco.translate('prescriptions.toasts.created'));
          this.formOpen.set(false);
          this.saving.set(false);
          this.load();
        },
        error: (error: unknown) => {
          toast.error(this.transloco.translate(mapApiError(error)));
          this.saving.set(false);
        },
      });
  }

  protected summary(prescription: Prescription): string {
    return prescription.items.map((item) => item.medicamento).join(' · ');
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang() === 'en' ? 'en-US' : 'es-CL', {
      dateStyle: 'medium',
    }).format(new Date(value));
  }

  private newItem(): PrescriptionItemForm {
    return new FormGroup({
      medicamento: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(200)],
      }),
      dosis: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(200)],
      }),
      frecuencia: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(200)],
      }),
      duracion: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(200)],
      }),
    });
  }
}
