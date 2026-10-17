import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideArrowLeft,
  lucideClipboardList,
  lucideFilePlus2,
  lucideRefreshCw,
  lucideSmile,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HasPermissionDirective, PERMISSION_KEYS } from 'auth';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmSkeleton } from '@ui/skeleton';
import { BrandingApi, ageInYears, mapApiError, type Patient } from 'data-access';
import { ClinicalRecordStore } from '../clinical-record.store';

/**
 * Patient profile chrome for the dental clinical record: the HCU header
 * (autofilled from the patient, the clinic identity and the record) plus the
 * tabs of the ficha. When the patient has no record yet it offers to open it.
 */
@Component({
  selector: 'app-patient-detail-page',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmSkeleton,
    HasPermissionDirective,
  ],
  providers: [
    provideIcons({
      lucideActivity,
      lucideArrowLeft,
      lucideClipboardList,
      lucideFilePlus2,
      lucideRefreshCw,
      lucideSmile,
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './patient-detail-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientDetailPage {
  private readonly transloco = inject(TranslocoService);
  private readonly branding = inject(BrandingApi);

  /** Exposed for the template; shared with the tabs through the route. */
  protected readonly store = inject(ClinicalRecordStore);
  protected readonly permissionKeys = PERMISSION_KEYS;

  protected readonly establecimiento = signal<string | null>(null);

  protected readonly categoriaLabelKey = computed(() => {
    const record = this.store.record();

    return record === null ? null : `clinical.form.categorias.${record.categoria}`;
  });

  constructor() {
    this.branding.get().subscribe({
      next: (snapshot) => this.establecimiento.set(snapshot.branding?.name ?? null),
      // The header is decoration: a missing clinic name never blocks the ficha.
      error: () => undefined,
    });
  }

  protected nombreCompleto(patient: Patient): string {
    return `${patient.nombres} ${patient.apellidoPaterno} ${patient.apellidoMaterno}`;
  }

  protected sexoKey(patient: Patient): string {
    switch (patient.sexo) {
      case 'femenino':
        return 'patients.form.sexoFemenino';
      case 'masculino':
        return 'patients.form.sexoMasculino';
      default:
        return 'patients.form.sexoOtro';
    }
  }

  protected age(patient: Patient): number {
    return ageInYears(patient.fechaNacimiento);
  }

  protected retry(): void {
    this.store.load(this.store.patientId());
  }

  protected openRecord(): void {
    this.store.createRecord().subscribe({
      next: () =>
        toast.success(this.transloco.translate('clinical.toasts.created')),
      error: (error: unknown) =>
        toast.error(this.transloco.translate(mapApiError(error))),
    });
  }
}
