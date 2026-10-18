import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideRefreshCw, lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmButton } from '@ui/button';
import { HlmCard, HlmCardContent, HlmCardDescription, HlmCardFooter, HlmCardHeader, HlmCardTitle } from '@ui/card';
import { HlmSkeleton } from '@ui/skeleton';
import { formatRut, mapApiError, PatientsApi, type Patient } from 'data-access';

/** Live summary of the patients API: total count and the 5 most recent records. */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmCard,
    HlmCardHeader,
    HlmCardTitle,
    HlmCardDescription,
    HlmCardContent,
    HlmCardFooter,
    HlmSkeleton,
  ],
  providers: [provideIcons({ lucideArrowRight, lucideRefreshCw, lucideTriangleAlert })],
  templateUrl: './dashboard-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(PatientsApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly patients = signal<Patient[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly total = computed(() => this.patients().length);

  protected readonly latest = computed(() =>
    [...this.patients()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api.list().subscribe({
      next: (patients) => this.patients.set(patients),
      error: (error: unknown) => this.loadError.set(mapApiError(error)),
      complete: () => this.loading.set(false),
    });
  }

  protected nombreCompleto(patient: Patient): string {
    return `${patient.nombres} ${patient.apellidoPaterno} ${patient.apellidoMaterno}`;
  }

  protected formatRut(rut: string): string {
    return formatRut(rut);
  }

  protected previsionLabel(patient: Patient): string {
    const prevision = patient.prevision;

    if (prevision === null) {
      return '—';
    }

    return prevision.tipo === 'FONASA'
      ? `${prevision.tipo} · ${prevision.tramo}`
      : prevision.tipo === 'ISAPRE'
        ? (prevision.plan ?? '—')
        : prevision.tipo === 'CONVENIO'
          ? (prevision.convenio ?? '—')
          : 'Particular';
  }
}
