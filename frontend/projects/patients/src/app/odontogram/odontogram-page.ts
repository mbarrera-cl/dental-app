import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmAlertDialogImports } from '@ui/alert-dialog';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmLabel } from '@ui/label';
import { formatDateTime } from 'ui';
import { toast } from '@spartan-ng/brain/sonner';
import {
  FINDING_SYMBOLS,
  PENDING_SYMBOLS,
  mapApiError,
  type AddFindingPayload,
  type ClinicalFinding,
  type FindingSymbol,
  type Surface,
} from 'data-access';
import { ClinicalRecordStore } from '../clinical-record.store';
import { OdontogramChart, type Dentition } from './odontogram-chart';

/**
 * Interactive odontogram: the classic red/blue chart per dentition, a symbol
 * palette, and the append-only history of the selected tooth with its void
 * action. Findings are never edited: mistakes are voided with audit.
 */
@Component({
  selector: 'app-odontogram-page',
  imports: [OdontogramChart, TranslocoPipe, HlmAlertDialogImports, HlmBadge, HlmButton, HlmLabel],
  templateUrl: './odontogram-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OdontogramPage {
  private readonly transloco = inject(TranslocoService);
  private readonly store = inject(ClinicalRecordStore);

  protected readonly findings = this.store.findings;
  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly dentitions: readonly Dentition[] = ['permanente', 'temporal'];
  protected readonly grades = [1, 2, 3] as const;

  protected readonly dentition = signal<Dentition>('permanente');
  protected readonly symbol = signal<FindingSymbol | null>(null);
  protected readonly recesion = signal<number | null>(null);
  protected readonly movilidad = signal<number | null>(null);
  protected readonly selectedTooth = signal<number | null>(null);

  protected readonly adding = signal(false);
  protected readonly voiding = signal(false);
  protected readonly voidTarget = signal<ClinicalFinding | null>(null);
  protected readonly voidOpen = signal(false);

  protected readonly pendingSymbols = FINDING_SYMBOLS.filter((symbol) =>
    PENDING_SYMBOLS.includes(symbol),
  );
  protected readonly doneSymbols = FINDING_SYMBOLS.filter(
    (symbol) => !PENDING_SYMBOLS.includes(symbol),
  );

  /** Log of the selected tooth, newest first (voided entries included). */
  protected readonly history = computed(() => {
    const tooth = this.selectedTooth();

    if (tooth === null) {
      return [];
    }

    return this.store
      .findings()
      .filter((finding) => finding.tooth === tooth)
      .slice()
      .reverse();
  });

  protected selectDentition(dentition: Dentition): void {
    this.dentition.set(dentition);
  }

  protected selectSymbol(symbol: FindingSymbol): void {
    this.symbol.set(this.symbol() === symbol ? null : symbol);
  }

  protected selectTooth(tooth: number): void {
    this.selectedTooth.set(tooth);
  }

  /** A surface click adds the finding directly when a palette symbol is armed. */
  protected onSurfaceSelected(event: { tooth: number; surface: Surface }): void {
    this.selectedTooth.set(event.tooth);

    const symbol = this.symbol();

    if (symbol === null) {
      return;
    }

    this.add({ tooth: event.tooth, surfaces: [event.surface], symbol });
  }

  protected addToSelectedTooth(): void {
    const tooth = this.selectedTooth();
    const symbol = this.symbol();

    if (tooth === null || symbol === null) {
      return;
    }

    this.add({ tooth, symbol });
  }

  protected readGrade(event: Event): number | null {
    const value = (event.target as HTMLSelectElement).value;

    return value === '' ? null : Number(value);
  }

  protected askVoid(finding: ClinicalFinding): void {
    this.voidTarget.set(finding);
    this.voidOpen.set(true);
  }

  protected onVoidStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.voidOpen.set(false);
      this.voidTarget.set(null);
    }
  }

  protected confirmVoid(): void {
    const finding = this.voidTarget();

    if (finding === null) {
      return;
    }

    this.voiding.set(true);

    this.store.voidFinding(finding.id).subscribe({
      next: () => {
        this.voiding.set(false);
        this.voidOpen.set(false);
        this.voidTarget.set(null);
        toast.success(this.transloco.translate('clinical.toasts.findingVoided'));
      },
      error: (error: unknown) => {
        this.voiding.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  protected symbolLabelKey(symbol: FindingSymbol): string {
    return `clinical.odontogram.symbols.${symbol}`;
  }

  protected stateLabelKey(finding: ClinicalFinding): string {
    return `clinical.odontogram.states.${finding.state}`;
  }

  /** Classic notation: `R2` for recession, `M1` for mobility. */
  protected gradesLabel(finding: ClinicalFinding): string | null {
    const grades: string[] = [];

    if (finding.recesion !== null) grades.push(`R${finding.recesion}`);
    if (finding.movilidad !== null) grades.push(`M${finding.movilidad}`);

    return grades.length === 0 ? null : grades.join(' · ');
  }

  protected formatDate(iso: string): string {
    return formatDateTime(iso, this.language());
  }

  private add(payload: AddFindingPayload): void {
    this.adding.set(true);

    this.store
      .addFinding({ ...payload, recesion: this.recesion(), movilidad: this.movilidad() })
      .subscribe({
        next: () => {
          this.adding.set(false);
          toast.success(this.transloco.translate('clinical.toasts.findingAdded'));
        },
        error: (error: unknown) => {
          this.adding.set(false);
          toast.error(this.transloco.translate(mapApiError(error)));
        },
      });
  }
}
