import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLock, lucideSave } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import {
  ENFERMEDAD_PERIODONTAL,
  GRADOS_FLUOROSIS,
  MALOCLUSIONES,
  PIEZAS_HIGIENE_ORAL,
  mapApiError,
  type EnfermedadPeriodontal,
  type GradoFluorosis,
  type HigieneOralInput,
  type HigieneOralTotales,
  type IndicadoresSaludBucalInput,
  type Maloclusion,
} from 'data-access';
import { formatNumberOrEmpty, optionalIntegerRange, toIntegerOrNull } from '../clinical-forms';
import { ClinicalRecordStore } from '../clinical-record.store';

interface HigieneEntryGroup {
  placa: FormControl<string>;
  calculo: FormControl<string>;
  gingivitis: FormControl<string>;
}

function buildHigiene(): FormGroup<Record<string, FormGroup<HigieneEntryGroup>>> {
  const controls: Record<string, FormGroup<HigieneEntryGroup>> = {};

  for (const tooth of PIEZAS_HIGIENE_ORAL) {
    controls[String(tooth)] = new FormGroup({
      placa: new FormControl('', { nonNullable: true, validators: [optionalIntegerRange(0, 3)] }),
      calculo: new FormControl('', { nonNullable: true, validators: [optionalIntegerRange(0, 3)] }),
      gingivitis: new FormControl('', { nonNullable: true, validators: [optionalIntegerRange(0, 1)] }),
    });
  }

  return new FormGroup(controls);
}

/**
 * Section 7 (simplified oral hygiene + periodontal disease, Angle occlusion
 * and fluorosis) and section 8 (CPO/ceo) of the ficha. Only the raw scores are
 * edited here: every index shown on the side is computed by the server from
 * the stored record and its odontogram findings.
 */
@Component({
  selector: 'app-indices-page',
  imports: [ReactiveFormsModule, TranslocoPipe, NgIcon, HlmButton, HlmInput, HlmLabel],
  providers: [provideIcons({ lucideLock, lucideSave })],
  templateUrl: './indices-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicesPage {
  private readonly transloco = inject(TranslocoService);
  private readonly store = inject(ClinicalRecordStore);

  protected readonly indices = this.store.indices;
  protected readonly teeth = PIEZAS_HIGIENE_ORAL;
  protected readonly periodontalLevels = ENFERMEDAD_PERIODONTAL;
  protected readonly maloclusionLevels = MALOCLUSIONES;
  protected readonly fluorosisLevels = GRADOS_FLUOROSIS;

  protected readonly saving = signal(false);
  /** A finalized ficha is sealed: the form renders disabled and read-only. */
  protected readonly finalized = computed(() => this.store.record()?.status === 'finalizada');
  /** Live column sums of the table, before saving (server totals on the side). */
  protected readonly liveTotals = signal<HigieneOralTotales>({
    placa: 0,
    calculo: 0,
    gingivitis: 0,
    total: 0,
  });

  protected readonly form = new FormGroup({
    higiene: buildHigiene(),
    periodontal: new FormControl('', { nonNullable: true }),
    maloclusion: new FormControl('', { nonNullable: true }),
    fluorosis: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    const record = this.store.record();

    if (record !== null) {
      for (const tooth of PIEZAS_HIGIENE_ORAL) {
        const entry = record.indicadores.higieneOral[tooth];

        this.form.controls.higiene.controls[String(tooth)].patchValue({
          placa: formatNumberOrEmpty(entry.placa),
          calculo: formatNumberOrEmpty(entry.calculo),
          gingivitis: formatNumberOrEmpty(entry.gingivitis),
        });
      }

      this.form.patchValue({
        periodontal: record.indicadores.enfermedadPeriodontal ?? '',
        maloclusion: record.indicadores.maloclusion ?? '',
        fluorosis: record.indicadores.fluorosis ?? '',
      });

      if (record.status === 'finalizada') {
        this.form.disable();
      }
    }

    this.liveTotals.set(this.computeTotals());

    this.form.controls.higiene.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.liveTotals.set(this.computeTotals()));
  }

  protected higieneError(tooth: number, field: keyof HigieneEntryGroup): string | null {
    const control = this.form.controls.higiene.controls[String(tooth)].controls[field];

    return control.invalid && control.touched ? 'clinical.validation.higieneRange' : null;
  }

  protected cariados(indices: number[]): string {
    return indices.length === 0 ? '—' : indices.join(' · ');
  }

  protected save(): void {
    if (this.finalized()) {
      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    const record = this.store.record();
    const indicadores = this.buildPayload();

    if (record === null) {
      return;
    }

    if (JSON.stringify(indicadores) === JSON.stringify(record.indicadores)) {
      toast(this.transloco.translate('errors.emptyUpdate'));
      return;
    }

    this.saving.set(true);

    this.store.updateRecord({ indicadores }).subscribe({
      next: () => {
        this.saving.set(false);
        toast.success(this.transloco.translate('clinical.toasts.indicatorsSaved'));
      },
      error: (error: unknown) => {
        this.saving.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  private buildPayload(): IndicadoresSaludBucalInput {
    const raw = this.form.getRawValue();
    const higieneOral: HigieneOralInput = {};

    for (const tooth of PIEZAS_HIGIENE_ORAL) {
      const entry = raw.higiene[String(tooth)];

      higieneOral[String(tooth)] = {
        placa: toIntegerOrNull(entry.placa),
        calculo: toIntegerOrNull(entry.calculo),
        gingivitis: toIntegerOrNull(entry.gingivitis),
      };
    }

    return {
      higieneOral,
      enfermedadPeriodontal: raw.periodontal === '' ? null : (raw.periodontal as EnfermedadPeriodontal),
      maloclusion: raw.maloclusion === '' ? null : (raw.maloclusion as Maloclusion),
      fluorosis: raw.fluorosis === '' ? null : (raw.fluorosis as GradoFluorosis),
    };
  }

  private computeTotals(): HigieneOralTotales {
    const raw = this.form.controls.higiene.getRawValue();
    let placa = 0;
    let calculo = 0;
    let gingivitis = 0;

    for (const tooth of PIEZAS_HIGIENE_ORAL) {
      const entry = raw[String(tooth)];

      placa += toIntegerOrNull(entry.placa) ?? 0;
      calculo += toIntegerOrNull(entry.calculo) ?? 0;
      gingivitis += toIntegerOrNull(entry.gingivitis) ?? 0;
    }

    return { placa, calculo, gingivitis, total: placa + calculo + gingivitis };
  }
}
