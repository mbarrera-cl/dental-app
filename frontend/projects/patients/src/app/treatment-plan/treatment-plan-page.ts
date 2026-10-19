import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLock, lucidePlus } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import {
  TREATMENT_PLAN_ITEM_STATUSES,
  isFdiTooth,
  mapApiError,
  type TreatmentPlanItem,
  type TreatmentPlanItemStatus,
} from 'data-access';
import { ClinicalRecordStore } from '../clinical-record.store';

/**
 * Treatment plan of the ficha: add procedures (optionally bound to a tooth)
 * and advance their state (planificado → en-ejecucion → realizado / cancelado).
 * Every change is audited in the clinical timeline.
 */
@Component({
  selector: 'app-treatment-plan-page',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmInput,
    HlmLabel,
  ],
  providers: [provideIcons({ lucideLock, lucidePlus })],
  templateUrl: './treatment-plan-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreatmentPlanPage {
  private readonly transloco = inject(TranslocoService);
  private readonly store = inject(ClinicalRecordStore);

  protected readonly plan = this.store.plan;
  protected readonly statuses = TREATMENT_PLAN_ITEM_STATUSES;
  protected readonly finalized = computed(() => this.store.record()?.status === 'finalizada');

  protected readonly adding = signal(false);

  protected readonly form = new FormGroup({
    tooth: new FormControl('', { nonNullable: true }),
    procedure: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(300)],
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  protected items(): TreatmentPlanItem[] {
    return this.plan()?.items ?? [];
  }

  protected toothLabel(tooth: number | null): string {
    return tooth === null ? '—' : String(tooth);
  }

  /**
   * The tooth field is an `input[type=number]`, so Angular's number value
   * accessor hands back a `number` (or `null`), not the `string` the control
   * is declared with. Normalize before trimming.
   */
  private toothInput(): string {
    const value: unknown = this.form.controls.tooth.value;

    return value === null || value === undefined ? '' : String(value).trim();
  }

  protected toothError(): string | null {
    const raw = this.toothInput();

    if (raw !== '' && !isFdiTooth(Number(raw))) {
      return 'clinical.plan.validation.tooth';
    }

    return null;
  }

  protected readStatus(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected add(): void {
    if (this.finalized()) {
      return;
    }

    this.form.markAllAsTouched();

    const raw = this.form.getRawValue();
    const toothRaw = this.toothInput();
    const procedure = raw.procedure.trim();

    if (procedure === '' || this.toothError() !== null) {
      return;
    }

    this.adding.set(true);

    this.store
      .addPlanItem({
        tooth: toothRaw === '' ? null : Number(toothRaw),
        procedure,
        notes: raw.notes.trim() === '' ? null : raw.notes.trim(),
      })
      .subscribe({
        next: () => {
          this.adding.set(false);
          this.form.reset();
          toast.success(this.transloco.translate('clinical.plan.toasts.itemAdded'));
        },
        error: (error: unknown) => {
          this.adding.set(false);
          toast.error(this.transloco.translate(mapApiError(error)));
        },
      });
  }

  protected changeStatus(item: TreatmentPlanItem, status: string): void {
    if (this.finalized() || status === item.status) {
      return;
    }

    this.store.updatePlanItem(item.id, { status: status as TreatmentPlanItemStatus }).subscribe({
      error: (error: unknown) => toast.error(this.transloco.translate(mapApiError(error))),
    });
  }

  protected statusLabelKey(status: string): string {
    return `clinical.plan.statuses.${status}`;
  }

  protected statusVariant(status: string): 'outline' | 'secondary' | 'destructive' {
    switch (status) {
      case 'realizado':
        return 'secondary';
      case 'cancelado':
        return 'destructive';
      default:
        return 'outline';
    }
  }
}
