import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import {
  lucideClipboardList,
  lucidePencil,
  lucidePlus,
  lucideRefreshCw,
  lucideSearch,
  lucideSearchX,
  lucideTrash2,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { toast } from '@spartan-ng/brain/sonner';
import { HasPermissionDirective, PERMISSION_KEYS } from 'auth';
import {
  HlmAlertDialog,
  HlmAlertDialogAction,
  HlmAlertDialogCancel,
  HlmAlertDialogContent,
  HlmAlertDialogDescription,
  HlmAlertDialogFooter,
  HlmAlertDialogHeader,
  HlmAlertDialogPortal,
  HlmAlertDialogTitle,
} from '@ui/alert-dialog';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import {
  HlmDialog,
  HlmDialogClose,
  HlmDialogContent,
  HlmDialogDescription,
  HlmDialogFooter,
  HlmDialogHeader,
  HlmDialogPortal,
  HlmDialogTitle,
} from '@ui/dialog';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import { HlmSkeleton } from '@ui/skeleton';
import { HlmSpinner } from '@ui/spinner';
import { HlmTBody, HlmTable, HlmTableContainer, HlmTd, HlmTh, HlmTHead, HlmTr } from '@ui/table';
import {
  formatRut,
  isValidRut,
  isValidTelefono,
  mapApiError,
  normalizeRut,
  PatientsApi,
  REGIONS,
  type CreatePatientPayload,
  type FonasaTramo,
  type Patient,
  type PatientSexo,
  type RegionCode,
} from 'data-access';

const FECHA_NACIMIENTO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Mirrors the backend `Rut` value object (módulo 11 check digit). */
function rutValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  return isValidRut(value) ? null : { rut: true };
}

/** Mirrors the backend `Telefono` value object. Empty means "not provided". */
function optionalTelefonoValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();

  if (value === '') {
    return null;
  }

  return isValidTelefono(value) ? null : { telefono: true };
}

/** Mirrors the backend `FechaNacimiento` value object. */
function fechaNacimientoValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();

  if (!FECHA_NACIMIENTO_PATTERN.test(value)) {
    return { fechaNacimiento: true };
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  if (!isRealDate || year < 1900) {
    return { fechaNacimiento: true };
  }

  return value > new Date().toISOString().slice(0, 10) ? { fechaNacimiento: true } : null;
}

/**
 * Full CRUD over the patients API:
 * list + search by RUT/name/email, create, edit and delete with the whole
 * Chilean patient record (address, health coverage, emergency contact,
 * notes), loading/error states and toasts. Signal-based to play nicely with
 * zoneless change detection.
 */
@Component({
  selector: 'app-patients-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HasPermissionDirective,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmBadge,
    HlmSkeleton,
    HlmSpinner,
    HlmTableContainer,
    HlmTable,
    HlmTHead,
    HlmTBody,
    HlmTr,
    HlmTh,
    HlmTd,
    HlmDialog,
    HlmDialogContent,
    HlmDialogPortal,
    HlmDialogHeader,
    HlmDialogTitle,
    HlmDialogDescription,
    HlmDialogFooter,
    HlmDialogClose,
    HlmAlertDialog,
    HlmAlertDialogContent,
    HlmAlertDialogPortal,
    HlmAlertDialogHeader,
    HlmAlertDialogTitle,
    HlmAlertDialogDescription,
    HlmAlertDialogFooter,
    HlmAlertDialogCancel,
    HlmAlertDialogAction,
  ],
  providers: [
    provideIcons({
      lucideClipboardList,
      lucidePencil,
      lucidePlus,
      lucideRefreshCw,
      lucideSearch,
      lucideSearchX,
      lucideTrash2,
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './patients-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientsPage {
  private readonly api = inject(PatientsApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly permissionKeys = PERMISSION_KEYS;

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly regions = REGIONS;
  protected readonly tramos: FonasaTramo[] = ['A', 'B', 'C', 'D'];
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  // List state
  protected readonly patients = signal<Patient[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly query = signal('');

  protected readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();

    if (query === '') {
      return this.patients();
    }

    const digitsQuery = query.replace(/[^0-9k]/g, '');

    return this.patients().filter((patient) => {
      const haystack = [
        patient.nombres,
        patient.apellidoPaterno,
        patient.apellidoMaterno,
        patient.email ?? '',
        patient.rut,
        formatRut(patient.rut),
      ]
        .join(' ')
        .toLowerCase();

      if (haystack.includes(query)) {
        return true;
      }

      return (
        digitsQuery !== '' && haystack.replace(/[^0-9k]/g, '').includes(digitsQuery)
      );
    });
  });

  // Create / edit dialog
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Patient | null>(null);
  protected readonly saving = signal(false);
  /** True once a submit was attempted; drives the group-level errors. */
  protected readonly submitted = signal(false);
  protected readonly form = new FormGroup({
    rut: new FormControl('', { nonNullable: true, validators: [Validators.required, rutValidator] }),
    nombres: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
    apellidoPaterno: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
    apellidoMaterno: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
    fechaNacimiento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, fechaNacimientoValidator],
    }),
    sexo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(254)],
    }),
    telefono: new FormControl('', { nonNullable: true, validators: [optionalTelefonoValidator] }),
    region: new FormControl('', { nonNullable: true }),
    comuna: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    calle: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
    numero: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    departamento: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    previsionTipo: new FormControl('', { nonNullable: true }),
    previsionTramo: new FormControl('', { nonNullable: true }),
    previsionPlan: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    previsionConvenio: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    contactoNombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    contactoTelefono: new FormControl('', { nonNullable: true }),
    contactoParentesco: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(50)],
    }),
    notas: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });

  // Delete confirmation
  protected readonly deleteOpen = signal(false);
  protected readonly deletingPatient = signal<Patient | null>(null);
  protected readonly deleting = signal(false);

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

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected formatRut(rut: string): string {
    return formatRut(rut);
  }

  protected nombreCompleto(patient: Patient): string {
    return `${patient.nombres} ${patient.apellidoPaterno} ${patient.apellidoMaterno}`;
  }

  protected age(fechaNacimiento: string): number {
    const [year, month, day] = fechaNacimiento.split('-').map(Number);
    const today = new Date();
    let age = today.getFullYear() - year;

    if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
      age -= 1;
    }

    return age;
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

  protected deletingLabel(): { name: string; rut: string } {
    const patient = this.deletingPatient();

    return patient === null
      ? { name: '', rut: '' }
      : { name: this.nombreCompleto(patient), rut: formatRut(patient.rut) };
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.submitted.set(false);
    this.form.reset({
      rut: '',
      nombres: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      fechaNacimiento: '',
      sexo: '',
      email: '',
      telefono: '',
      region: '',
      comuna: '',
      calle: '',
      numero: '',
      departamento: '',
      previsionTipo: '',
      previsionTramo: '',
      previsionPlan: '',
      previsionConvenio: '',
      contactoNombre: '',
      contactoTelefono: '',
      contactoParentesco: '',
      notas: '',
    });
    this.formOpen.set(true);
  }

  protected openEdit(patient: Patient): void {
    this.editing.set(patient);
    this.submitted.set(false);
    this.form.reset({
      rut: formatRut(patient.rut),
      nombres: patient.nombres,
      apellidoPaterno: patient.apellidoPaterno,
      apellidoMaterno: patient.apellidoMaterno,
      fechaNacimiento: patient.fechaNacimiento,
      sexo: patient.sexo,
      email: patient.email ?? '',
      telefono: patient.telefono ?? '',
      region: patient.direccion?.region ?? '',
      comuna: patient.direccion?.comuna ?? '',
      calle: patient.direccion?.calle ?? '',
      numero: patient.direccion?.numero ?? '',
      departamento: patient.direccion?.departamento ?? '',
      previsionTipo: patient.prevision?.tipo ?? '',
      previsionTramo: patient.prevision?.tramo ?? '',
      previsionPlan: patient.prevision?.plan ?? '',
      previsionConvenio: patient.prevision?.convenio ?? '',
      contactoNombre: patient.contactoEmergencia?.nombre ?? '',
      contactoTelefono: patient.contactoEmergencia?.telefono ?? '',
      contactoParentesco: patient.contactoEmergencia?.parentesco ?? '',
      notas: patient.notas ?? '',
    });
    this.formOpen.set(true);
  }

  protected onFormStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.formOpen.set(false);
    }
  }

  protected showError(control: FormControl<string>): boolean {
    return control.invalid && control.touched;
  }

  protected rutError(): string | null {
    const control = this.form.controls.rut;

    if (!this.showError(control)) {
      return null;
    }

    return control.hasError('required')
      ? 'patients.validation.rutRequired'
      : 'patients.validation.rutInvalid';
  }

  protected nombresError(): string | null {
    return this.nameError(this.form.controls.nombres, 'patients.validation.nombresRequired');
  }

  protected apellidoPaternoError(): string | null {
    return this.nameError(
      this.form.controls.apellidoPaterno,
      'patients.validation.apellidoPaternoRequired',
    );
  }

  protected apellidoMaternoError(): string | null {
    return this.nameError(
      this.form.controls.apellidoMaterno,
      'patients.validation.apellidoMaternoRequired',
    );
  }

  protected fechaNacimientoError(): string | null {
    const control = this.form.controls.fechaNacimiento;

    if (!this.showError(control)) {
      return null;
    }

    return control.hasError('required')
      ? 'patients.validation.fechaNacimientoRequired'
      : 'patients.validation.fechaNacimientoInvalid';
  }

  protected sexoError(): string | null {
    return this.showError(this.form.controls.sexo) ? 'patients.validation.sexoRequired' : null;
  }

  protected emailError(): string | null {
    const control = this.form.controls.email;

    if (!this.showError(control)) {
      return null;
    }

    if (control.hasError('maxlength')) return 'patients.validation.emailMax';
    return 'patients.validation.emailInvalid';
  }

  protected telefonoError(): string | null {
    return this.showError(this.form.controls.telefono)
      ? 'patients.validation.telefonoInvalid'
      : null;
  }

  protected notasError(): string | null {
    return this.showError(this.form.controls.notas) ? 'patients.validation.notasMax' : null;
  }

  /** Address group error, surfaced once a submit was attempted. */
  protected addressError(): string | null {
    return this.submitted() ? this.addressValidationKey() : null;
  }

  /** Prevision group error, surfaced once a submit was attempted. */
  protected previsionError(): string | null {
    return this.submitted() ? this.previsionValidationKey() : null;
  }

  /** Emergency contact group error, surfaced once a submit was attempted. */
  protected contactoError(): string | null {
    return this.submitted() ? this.contactoValidationKey() : null;
  }

  protected submitForm(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();

    const hasGroupError =
      this.addressValidationKey() !== null ||
      this.previsionValidationKey() !== null ||
      this.contactoValidationKey() !== null;

    if (this.form.invalid || hasGroupError) {
      return;
    }

    const target = this.editing();
    const payload = this.buildPayload();
    this.saving.set(true);

    const request$ = target ? this.api.update(target.id, payload) : this.api.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        toast.success(
          this.transloco.translate(target ? 'patients.toasts.updated' : 'patients.toasts.created'),
        );
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  protected askDelete(patient: Patient): void {
    this.deletingPatient.set(patient);
    this.deleteOpen.set(true);
  }

  protected onDeleteStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.deleteOpen.set(false);
      this.deletingPatient.set(null);
    }
  }

  protected confirmDelete(): void {
    const patient = this.deletingPatient();

    if (patient === null) {
      return;
    }

    this.deleting.set(true);

    this.api.delete(patient.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteOpen.set(false);
        this.deletingPatient.set(null);
        toast.success(this.transloco.translate('patients.toasts.deleted'));
        this.load();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.deleteOpen.set(false);
        this.deletingPatient.set(null);
        toast.error(this.transloco.translate(mapApiError(error)));
        this.load();
      },
    });
  }

  private nameError(control: FormControl<string>, requiredKey: string): string | null {
    if (!this.showError(control)) {
      return null;
    }

    return control.hasError('required') ? requiredKey : 'patients.validation.nameLength';
  }

  private addressValidationKey(): string | null {
    const { region, comuna, calle, numero, departamento } = this.form.getRawValue();
    const anyFilled = [region, comuna, calle, numero, departamento].some(
      (value) => value.trim() !== '',
    );

    if (!anyFilled) {
      return null;
    }

    if (region === '') return 'patients.validation.regionRequired';
    if (comuna.trim() === '') return 'patients.validation.comunaRequired';
    if (calle.trim() === '') return 'patients.validation.calleRequired';
    if (numero.trim() === '') return 'patients.validation.numeroRequired';
    return null;
  }

  private previsionValidationKey(): string | null {
    const { previsionTipo, previsionTramo, previsionPlan, previsionConvenio } =
      this.form.getRawValue();

    if (previsionTipo === '') {
      return previsionTramo !== '' ||
        previsionPlan.trim() !== '' ||
        previsionConvenio.trim() !== ''
        ? 'patients.validation.previsionTipoRequired'
        : null;
    }

    if (previsionTipo === 'FONASA') {
      return previsionTramo === '' ? 'patients.validation.tramoRequired' : null;
    }

    if (previsionTipo === 'ISAPRE') {
      return previsionPlan.trim() === '' ? 'patients.validation.planRequired' : null;
    }

    if (previsionTipo === 'CONVENIO') {
      return previsionConvenio.trim() === '' ? 'patients.validation.convenioRequired' : null;
    }

    return null;
  }

  private contactoValidationKey(): string | null {
    const { contactoNombre, contactoTelefono, contactoParentesco } = this.form.getRawValue();
    const anyFilled = [contactoNombre, contactoTelefono, contactoParentesco].some(
      (value) => value.trim() !== '',
    );

    if (!anyFilled) {
      return null;
    }

    if (contactoNombre.trim() === '') return 'patients.validation.contactoNombreRequired';

    if (contactoTelefono.trim() === '' || !isValidTelefono(contactoTelefono.trim())) {
      return 'patients.validation.contactoTelefonoRequired';
    }

    return null;
  }

  private buildPayload(): CreatePatientPayload {
    const raw = this.form.getRawValue();

    return {
      rut: normalizeRut(raw.rut) ?? raw.rut,
      nombres: raw.nombres.trim(),
      apellidoPaterno: raw.apellidoPaterno.trim(),
      apellidoMaterno: raw.apellidoMaterno.trim(),
      fechaNacimiento: raw.fechaNacimiento,
      sexo: raw.sexo as PatientSexo,
      email: raw.email.trim() === '' ? null : raw.email.trim(),
      telefono: raw.telefono.trim() === '' ? null : raw.telefono.trim(),
      direccion:
        raw.region === ''
          ? null
          : {
              region: raw.region as RegionCode,
              comuna: raw.comuna.trim(),
              calle: raw.calle.trim(),
              numero: raw.numero.trim(),
              departamento: raw.departamento.trim() === '' ? null : raw.departamento.trim(),
            },
      prevision:
        raw.previsionTipo === ''
          ? null
          : raw.previsionTipo === 'FONASA'
            ? {
                tipo: 'FONASA',
                tramo: raw.previsionTramo as FonasaTramo,
                plan: null,
                convenio: null,
              }
            : raw.previsionTipo === 'ISAPRE'
              ? {
                  tipo: 'ISAPRE',
                  tramo: null,
                  plan: raw.previsionPlan.trim(),
                  convenio: null,
                }
              : raw.previsionTipo === 'CONVENIO'
                ? {
                    tipo: 'CONVENIO',
                    tramo: null,
                    plan: null,
                    convenio: raw.previsionConvenio.trim(),
                  }
                : { tipo: 'PARTICULAR', tramo: null, plan: null, convenio: null },
      contactoEmergencia:
        raw.contactoNombre.trim() === '' && raw.contactoTelefono.trim() === ''
          ? null
          : {
              nombre: raw.contactoNombre.trim(),
              telefono: raw.contactoTelefono.trim(),
              parentesco: raw.contactoParentesco.trim() === '' ? null : raw.contactoParentesco.trim(),
            },
      notas: raw.notas.trim() === '' ? null : raw.notas.trim(),
    };
  }
}
