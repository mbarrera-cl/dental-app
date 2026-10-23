import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideArrowLeft,
  lucideBadgeDollarSign,
  lucideCalendar,
  lucideClipboardList,
  lucideFilePlus2,
  lucideFileText,
  lucideHistory,
  lucideListChecks,
  lucideLock,
  lucideRefreshCw,
  lucideShieldCheck,
  lucideSmile,
  lucideTriangleAlert,
  lucideWallet,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HasPermissionDirective, PERMISSION_KEYS } from 'auth';
import { HlmAlertDialogImports } from '@ui/alert-dialog';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmSkeleton } from '@ui/skeleton';
import { BrandingApi, ageInYears, mapApiError, type Patient } from 'data-access';
import { distinctUntilChanged, filter, map } from 'rxjs';
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
    HlmAlertDialogImports,
    HlmBadge,
    HlmButton,
    HlmSkeleton,
    HasPermissionDirective,
  ],
  providers: [
    provideIcons({
      lucideActivity,
      lucideArrowLeft,
      lucideBadgeDollarSign,
      lucideCalendar,
      lucideClipboardList,
      lucideFilePlus2,
      lucideFileText,
      lucideHistory,
      lucideListChecks,
      lucideLock,
      lucideRefreshCw,
      lucideShieldCheck,
      lucideSmile,
      lucideTriangleAlert,
      lucideWallet,
    }),
  ],
  templateUrl: './patient-detail-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientDetailPage {
  private readonly transloco = inject(TranslocoService);
  private readonly branding = inject(BrandingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Exposed for the template; shared with the tabs through the route. */
  protected readonly store = inject(ClinicalRecordStore);
  protected readonly permissionKeys = PERMISSION_KEYS;

  protected readonly establecimiento = signal<string | null>(null);

  /** Live URL, to tell the clinical tabs from the quotes tab. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /**
   * `true` while a clinical tab is active. Patients without a record have no
   * clinical tabs, so the “open the record” card replaces the outlet there —
   * the quotes, prescriptions, consents and account tabs stay reachable in
   * any case.
   */
  protected readonly clinicalSection = computed(
    () => !/\/(presupuestos|recetas|consentimientos|cuenta)(?:[/?#]|$)/.test(this.url()),
  );

  protected readonly categoriaLabelKey = computed(() => {
    const record = this.store.record();

    return record === null ? null : `clinical.form.categorias.${record.categoria}`;
  });

  constructor() {
    // Component ActivatedRoute has `:id`; the store's EnvironmentInjector route does not.
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((patientId) => this.store.load(patientId));

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
    this.store.load(this.store.patientId(), { force: true });
  }

  protected openRecord(): void {
    this.store.createRecord().subscribe({
      next: () =>
        toast.success(this.transloco.translate('clinical.toasts.created')),
      error: (error: unknown) =>
        toast.error(this.transloco.translate(mapApiError(error))),
    });
  }

  protected readonly finalizeOpen = signal(false);
  protected readonly finalizing = signal(false);

  protected askFinalize(): void {
    this.finalizeOpen.set(true);
  }

  protected onFinalizeStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.finalizeOpen.set(false);
    }
  }

  protected confirmFinalize(): void {
    this.finalizing.set(true);

    this.store.finalizeRecord().subscribe({
      next: () => {
        this.finalizing.set(false);
        this.finalizeOpen.set(false);
        toast.success(this.transloco.translate('clinical.toasts.finalized'));
      },
      error: (error: unknown) => {
        this.finalizing.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }
}
