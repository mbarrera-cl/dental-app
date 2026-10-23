import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLock, lucideSave } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import {
  ANTECEDENTES,
  CATEGORIAS_ETARIAS,
  REGIONES_ESTOMATOGNATICAS,
  mapApiError,
  type AntecedenteKey,
  type AntecedentesInput,
  type CategoriaEtaria,
  type ClinicalRecord,
  type ExamenEstomatognaticoInput,
  type RegionesRecord,
  type SignosVitalesInput,
  type UpdateClinicalRecordPayload,
} from 'data-access';
import { ClinicalRecordStore } from '../clinical-record.store';
import {
  formatNumberOrEmpty,
  optionalDecimalRange,
  optionalIntegerRange,
  toIntegerOrNull,
  toNumberOrNull,
} from '../clinical-forms';

/** Both-or-neither, and systolic must beat diastolic (backend rule). */
function bloodPressureOrder(group: AbstractControl): ValidationErrors | null {
  const sistolica = (group.get('pas')?.value as string).trim();
  const diastolica = (group.get('pad')?.value as string).trim();

  if (sistolica === '' || diastolica === '') {
    return sistolica === '' && diastolica === '' ? null : { bloodPressureOrder: true };
  }

  return Number(sistolica) > Number(diastolica) ? null : { bloodPressureOrder: true };
}

type AntecedenteGroup = FormGroup<{
  present: FormControl<boolean>;
  notes: FormControl<string>;
}>;

function buildAntecedentes(): FormGroup<Record<AntecedenteKey, AntecedenteGroup>> {
  const controls = {} as Record<AntecedenteKey, AntecedenteGroup>;

  for (const key of ANTECEDENTES) {
    controls[key] = new FormGroup({
      present: new FormControl(false, { nonNullable: true }),
      notes: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(500)],
      }),
    });
  }

  return new FormGroup(controls);
}

type RegionesGroup = FormGroup<Record<string, FormControl<string>>>;

function buildRegiones(): RegionesGroup {
  const controls: Record<string, FormControl<string>> = {};

  for (const region of REGIONES_ESTOMATOGNATICAS) {
    controls[region] = new FormControl('', { nonNullable: true });
  }

  return new FormGroup(controls);
}

/**
 * Sections 1–5 of the HCU ficha (motivo, enfermedad actual, antecedentes,
 * signos vitales y examen estomatognático) plus the age category and the
 * pregnant flag. Composite sections are replaced as a whole on save, matching
 * the PATCH contract of the API.
 */
@Component({
  selector: 'app-clinical-record-page',
  imports: [ReactiveFormsModule, TranslocoPipe, NgIcon, HlmButton, HlmInput, HlmLabel],
  providers: [provideIcons({ lucideLock, lucideSave })],
  templateUrl: './clinical-record-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicalRecordPage {
  private readonly transloco = inject(TranslocoService);
  private readonly store = inject(ClinicalRecordStore);

  protected readonly categorias = CATEGORIAS_ETARIAS;
  protected readonly antecedentesKeys = ANTECEDENTES;
  protected readonly regionesKeys = REGIONES_ESTOMATOGNATICAS;

  protected readonly saving = signal(false);

  /** A finalized ficha is sealed: the form renders disabled and read-only. */
  protected readonly finalized = computed(() => this.store.record()?.status === 'finalizada');

  protected readonly form = new FormGroup({
    categoria: new FormControl<CategoriaEtaria>('5-9-programado', { nonNullable: true }),
    embarazada: new FormControl(false, { nonNullable: true }),
    motivoConsulta: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
    enfermedadActual: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(4000)],
    }),
    antecedentes: buildAntecedentes(),
    signos: new FormGroup(
      {
        pas: new FormControl('', { nonNullable: true, validators: [optionalIntegerRange(40, 300)] }),
        pad: new FormControl('', { nonNullable: true, validators: [optionalIntegerRange(20, 200)] }),
        fc: new FormControl('', { nonNullable: true, validators: [optionalIntegerRange(20, 250)] }),
        temperatura: new FormControl('', {
          nonNullable: true,
          validators: [optionalDecimalRange(30, 45)],
        }),
        fr: new FormControl('', { nonNullable: true, validators: [optionalIntegerRange(4, 80)] }),
      },
      { validators: [bloodPressureOrder] },
    ),
    examen: new FormGroup({
      descripcion: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(2000)],
      }),
      regiones: buildRegiones(),
    }),
  });

  constructor() {
    const record = this.store.record();

    if (record !== null) {
      this.form.patchValue({
        categoria: record.categoria,
        embarazada: record.embarazada,
        motivoConsulta: record.motivoConsulta ?? '',
        enfermedadActual: record.enfermedadActual ?? '',
        signos: {
          pas: formatNumberOrEmpty(record.signosVitales.presionArterialSistolica),
          pad: formatNumberOrEmpty(record.signosVitales.presionArterialDiastolica),
          fc: formatNumberOrEmpty(record.signosVitales.frecuenciaCardiaca),
          temperatura: formatNumberOrEmpty(record.signosVitales.temperatura),
          fr: formatNumberOrEmpty(record.signosVitales.frecuenciaRespiratoria),
        },
        examen: {
          descripcion: record.examenEstomatognatico.descripcion ?? '',
          regiones: this.regionesFormValue(record),
        },
      });

      for (const key of ANTECEDENTES) {
        this.form.controls.antecedentes.controls[key].patchValue({
          present: record.antecedentes[key].present,
          notes: record.antecedentes[key].notes ?? '',
        });
      }

      if (record.status === 'finalizada') {
        this.form.disable();
      }
    }
  }

  protected showTextError(control: FormControl<string>, key: string): string | null {
    return control.invalid && control.touched ? key : null;
  }

  protected antecedenteNotesError(key: AntecedenteKey): string | null {
    const notes = this.form.controls.antecedentes.controls[key].controls.notes;

    return notes.invalid && notes.touched ? 'clinical.validation.antecedenteNotesMax' : null;
  }

  protected signoError(field: 'pas' | 'pad' | 'fc' | 'temperatura' | 'fr'): string | null {
    const control = this.form.controls.signos.controls[field];

    if (!control.invalid || !control.touched) {
      return null;
    }

    const keys = {
      pas: 'clinical.validation.sistolicaRange',
      pad: 'clinical.validation.diastolicaRange',
      fc: 'clinical.validation.fcRange',
      temperatura: 'clinical.validation.temperaturaRange',
      fr: 'clinical.validation.frRange',
    } as const;

    return keys[field];
  }

  protected bloodPressureError(): string | null {
    const signos = this.form.controls.signos;

    return signos.hasError('bloodPressureOrder') && signos.touched
      ? 'clinical.validation.bloodPressureOrder'
      : null;
  }

  protected save(): void {
    if (this.finalized()) {
      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    const patch = this.buildPatch();

    if (Object.keys(patch).length === 0) {
      toast(this.transloco.translate('errors.emptyUpdate'));
      return;
    }

    this.saving.set(true);

    this.store.updateRecord(patch).subscribe({
      next: () => {
        this.saving.set(false);
        toast.success(this.transloco.translate('clinical.toasts.recordSaved'));
      },
      error: (error: unknown) => {
        this.saving.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  /**
   * Only the sections that actually changed travel in the PATCH, so the
   * timeline does not fill with no-op "ficha-actualizada" events.
   */
  private buildPatch(): UpdateClinicalRecordPayload {
    const record = this.store.record();

    if (record === null) {
      return {};
    }

    const raw = this.form.getRawValue();
    const patch: UpdateClinicalRecordPayload = {};

    if (raw.categoria !== record.categoria) patch.categoria = raw.categoria;
    if (raw.embarazada !== record.embarazada) patch.embarazada = raw.embarazada;

    const motivo = raw.motivoConsulta.trim();
    if ((motivo === '' ? null : motivo) !== record.motivoConsulta) {
      patch.motivoConsulta = motivo === '' ? null : motivo;
    }

    const enfermedad = raw.enfermedadActual.trim();
    if ((enfermedad === '' ? null : enfermedad) !== record.enfermedadActual) {
      patch.enfermedadActual = enfermedad === '' ? null : enfermedad;
    }

    const antecedentes = this.buildAntecedentesPatch(raw.antecedentes);

    if (JSON.stringify(antecedentes) !== JSON.stringify(record.antecedentes)) {
      patch.antecedentes = antecedentes;
    }

    const signosVitales: SignosVitalesInput = {
      presionArterialSistolica: toIntegerOrNull(raw.signos.pas),
      presionArterialDiastolica: toIntegerOrNull(raw.signos.pad),
      frecuenciaCardiaca: toIntegerOrNull(raw.signos.fc),
      temperatura: toNumberOrNull(raw.signos.temperatura),
      frecuenciaRespiratoria: toIntegerOrNull(raw.signos.fr),
    };

    if (JSON.stringify(signosVitales) !== JSON.stringify(record.signosVitales)) {
      patch.signosVitales = signosVitales;
    }

    const examen: ExamenEstomatognaticoInput = {
      regiones: this.buildRegionesPatch(raw.examen.regiones),
      descripcion: raw.examen.descripcion.trim() === '' ? null : raw.examen.descripcion.trim(),
    };

    if (JSON.stringify(examen) !== JSON.stringify(record.examenEstomatognatico)) {
      patch.examenEstomatognatico = examen;
    }

    return patch;
  }

  private buildAntecedentesPatch(
    values: Record<AntecedenteKey, { present: boolean; notes: string }>,
  ): AntecedentesInput {
    const antecedentes: AntecedentesInput = {};

    for (const key of ANTECEDENTES) {
      const notes = values[key].notes.trim();
      antecedentes[key] = {
        present: values[key].present,
        notes: notes === '' ? null : notes,
      };
    }

    return antecedentes;
  }

  private buildRegionesPatch(values: Record<string, string>): Partial<RegionesRecord> {
    const regiones: Record<string, string | null> = {};

    for (const region of REGIONES_ESTOMATOGNATICAS) {
      regiones[region] = values[region] === '' ? null : values[region];
    }

    return regiones;
  }

  /** The selects speak `''` for "not explored"; the domain stores `null`. */
  private regionesFormValue(record: ClinicalRecord): Record<string, string> {
    const values: Record<string, string> = {};

    for (const region of REGIONES_ESTOMATOGNATICAS) {
      values[region] = record.examenEstomatognatico.regiones[region] ?? '';
    }

    return values;
  }
}
