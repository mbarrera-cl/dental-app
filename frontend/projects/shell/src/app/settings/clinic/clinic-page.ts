import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideHexagon,
  lucideImagePlus,
  lucideSparkles,
  lucideTrash2,
  lucideTriangleAlert,
  lucideUndo2,
  lucideUpload,
  lucideX,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';
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
import { HasPermissionDirective, PERMISSION_KEYS, SessionStore } from 'auth';
import {
  BrandingApi,
  mapApiError,
  REGIONS,
  SettingsApi,
  type Setting,
  type SettingValue,
  type SettingsValues,
  isValidRut,
  isValidTelefono,
} from 'data-access';
import {
  DEFAULT_THEME_SEEDS,
  buildThemePalette,
  contrastRatio,
  readableOn,
  wcagLevel,
} from 'ui';
import { map } from 'rxjs';
import { BrandingStore } from '../../branding/branding-store';
import { clampTransform, computeCropRect, cropFrame, IDENTITY_TRANSFORM } from './logo-crop';
import { LogoImageService, type PreparedImage } from './logo-image.service';
import type { ColorSuggestion } from './logo-colors';

/** Raw shape of the form (all controls non-nullable). */
interface ClinicFormValue {
  name: string;
  slogan: string;
  legalName: string;
  rut: string;
  region: string;
  comuna: string;
  calle: string;
  numero: string;
  oficina: string;
  phone: string;
  email: string;
  website: string;
  primary: string;
  accent: string;
  autoDark: boolean;
}

/** Setting key behind each text control (`autoDark` maps to `clinic.theme.mode`). */
const KEY: Record<Exclude<keyof ClinicFormValue, 'autoDark'>, string> = {
  name: 'clinic.name',
  slogan: 'clinic.slogan',
  legalName: 'clinic.legalName',
  rut: 'clinic.rut',
  region: 'clinic.address.region',
  comuna: 'clinic.address.comuna',
  calle: 'clinic.address.calle',
  numero: 'clinic.address.numero',
  oficina: 'clinic.address.oficina',
  phone: 'clinic.contact.phone',
  email: 'clinic.contact.email',
  website: 'clinic.contact.website',
  primary: 'clinic.theme.primary',
  accent: 'clinic.theme.accent',
};

const MODE_KEY = 'clinic.theme.mode';
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
/** Fixed viewport of the crop dialog; the CSS box uses the same numbers. */
const CROP_VIEWPORT = { width: 360, height: 240 };
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface ThemePreset {
  readonly id: string;
  readonly primary: string;
  readonly accent: string;
}

/** Curated pairs to start from; both seeds stay individually editable. */
const PRESETS: readonly ThemePreset[] = [
  { id: 'clinical', primary: '#0284c7', accent: '#f59e0b' },
  { id: 'emerald', primary: '#059669', accent: '#0ea5e9' },
  { id: 'indigo', primary: '#4f46e5', accent: '#d946ef' },
  { id: 'sunset', primary: '#ea580c', accent: '#facc15' },
  { id: 'berry', primary: '#be185d', accent: '#7c3aed' },
  { id: 'graphite', primary: '#334155', accent: '#0d9488' },
];

interface ContrastChip {
  readonly ratio: string;
  readonly level: 'AAA' | 'AA' | 'fail';
  readonly labelKey: string;
}

const rutValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();

  return value === '' || isValidRut(value) ? null : { rut: true };
};

const phoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();

  return value === '' || isValidTelefono(value) ? null : { phone: true };
};

const websiteValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();

  return value === '' || /^https?:\/\/\S+$/.test(value) ? null : { website: true };
};

const colorValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  HEX_PATTERN.test(String(control.value ?? '')) ? null : { color: true };

/**
 * Clinic configuration page (`/settings/clinic`): identity, contact, address
 * and theme of the clinic, persisted through the generic settings API.
 *
 * The logo is the only binary piece: it is decoded and cropped client-side
 * (dialog with zoom/pan + presets), downscaled to ≤ 1024 px and uploaded to
 * `POST /clinic/logo` with a progress bar. After any save or logo change the
 * page refreshes `BrandingStore`, so the shell chrome repaints instantly and
 * the live previews always mirror the form values.
 */
@Component({
  selector: 'app-clinic-page',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    HasPermissionDirective,
    HlmAlertDialog,
    HlmAlertDialogAction,
    HlmAlertDialogCancel,
    HlmAlertDialogContent,
    HlmAlertDialogDescription,
    HlmAlertDialogFooter,
    HlmAlertDialogHeader,
    HlmAlertDialogPortal,
    HlmAlertDialogTitle,
    HlmBadge,
    HlmButton,
    HlmDialog,
    HlmDialogClose,
    HlmDialogContent,
    HlmDialogDescription,
    HlmDialogFooter,
    HlmDialogHeader,
    HlmDialogPortal,
    HlmDialogTitle,
    HlmInput,
    HlmLabel,
    HlmSkeleton,
    HlmSpinner,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideHexagon,
      lucideImagePlus,
      lucideSparkles,
      lucideTrash2,
      lucideTriangleAlert,
      lucideUndo2,
      lucideUpload,
      lucideX,
    }),
  ],
  templateUrl: './clinic-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicPage implements OnInit {
  private readonly settings = inject(SettingsApi);
  private readonly brandingApi = inject(BrandingApi);
  private readonly branding = inject(BrandingStore);
  private readonly session = inject(SessionStore);
  private readonly transloco = inject(TranslocoService);
  private readonly images = inject(LogoImageService);

  protected readonly permissionKeys = PERMISSION_KEYS;
  protected readonly regions = REGIONS;
  protected readonly presets = PRESETS;
  protected readonly cropViewport = CROP_VIEWPORT;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  private readonly baseline = signal<Record<string, SettingValue>>({});

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    slogan: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    legalName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    rut: new FormControl('', { nonNullable: true, validators: [rutValidator] }),
    region: new FormControl('', { nonNullable: true }),
    comuna: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    calle: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    numero: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    oficina: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] }),
    phone: new FormControl('', { nonNullable: true, validators: [phoneValidator] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    website: new FormControl('', { nonNullable: true, validators: [websiteValidator] }),
    primary: new FormControl(DEFAULT_THEME_SEEDS.primary, {
      nonNullable: true,
      validators: [colorValidator],
    }),
    accent: new FormControl(DEFAULT_THEME_SEEDS.accent, {
      nonNullable: true,
      validators: [colorValidator],
    }),
    autoDark: new FormControl(false, { nonNullable: true }),
  });

  protected readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  // ----- Permissions & pending changes --------------------------------------

  protected readonly canEdit = computed(() => this.session.has(PERMISSION_KEYS.settings.update));

  protected readonly dirty = computed<SettingsValues>(() => {
    const value = this.formValue();
    const baseline = this.baseline();
    const dirty: SettingsValues = {};

    for (const [control, key] of Object.entries(KEY) as [keyof typeof KEY, string][]) {
      const current = value[control];

      if (current !== String(baseline[key] ?? '')) {
        dirty[key] = current;
      }
    }

    const mode = value.autoDark ? 'auto' : 'light';

    if (mode !== String(baseline[MODE_KEY] ?? 'light')) {
      dirty[MODE_KEY] = mode;
    }

    return dirty;
  });

  protected readonly dirtyCount = computed(() => Object.keys(this.dirty()).length);

  // ----- Live preview --------------------------------------------------------

  protected readonly palette = computed(() =>
    buildThemePalette({ primary: this.formValue().primary, accent: this.formValue().accent }),
  );
  protected readonly primaryForeground = computed(() => this.palette().light['--primary-foreground']!);
  protected readonly accentForeground = computed(() => this.palette().light['--accent-foreground']!);
  protected readonly primaryChip = computed(() => this.contrastChip(this.formValue().primary));
  protected readonly accentChip = computed(() => this.contrastChip(this.formValue().accent));

  // ----- Logo ----------------------------------------------------------------

  protected readonly logoUrl = computed(() => this.branding.logoUrl());
  protected readonly logoVersion = computed(() => this.branding.branding()?.version ?? 0);
  protected readonly dragging = signal(false);
  protected readonly uploading = signal(false);
  protected readonly uploadProgress = signal(0);
  protected readonly removeOpen = signal(false);
  protected readonly removing = signal(false);
  protected readonly colorSuggestions = signal<readonly ColorSuggestion[]>([]);

  // Crop dialog state.
  protected readonly cropOpen = signal(false);
  protected readonly prepared = signal<PreparedImage | null>(null);
  protected readonly preset = signal<'square' | 'wide'>('square');
  protected readonly zoom = signal(1);
  private readonly pan = signal({ x: 0, y: 0 });
  private dragOrigin: { x: number; y: number; panX: number; panY: number } | null = null;

  protected readonly frame = computed(() =>
    cropFrame(CROP_VIEWPORT, this.preset() === 'square' ? 1 : 16 / 9),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.settings.list().subscribe({
      next: (settings) => {
        this.loading.set(false);
        this.applySettings(settings);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(mapApiError(error));
      },
    });
  }

  /** Transloco key of the validation message for a touched, invalid control. */
  protected errorOf(control: AbstractControl): string | null {
    if (!control.invalid || !control.touched) {
      return null;
    }

    const errors = control.errors ?? {};

    if ('required' in errors) {
      return 'clinic.form.required';
    }

    if ('maxlength' in errors) {
      return 'clinic.form.tooLong';
    }

    if ('rut' in errors) {
      return 'clinic.form.invalidRut';
    }

    if ('phone' in errors) {
      return 'clinic.form.invalidPhone';
    }

    if ('email' in errors) {
      return 'clinic.form.invalidEmail';
    }

    if ('website' in errors) {
      return 'clinic.form.invalidWebsite';
    }

    return 'clinic.form.invalidColor';
  }

  protected resetField(control: Exclude<keyof ClinicFormValue, 'autoDark'>): void {
    this.form.controls[control].setValue(this.toFormValue(this.baseline())[control]);
    this.form.controls[control].markAsUntouched();
  }

  protected save(): void {
    if (this.saving() || !this.canEdit()) {
      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    const values = this.dirty();

    if (Object.keys(values).length === 0) {
      return;
    }

    this.saving.set(true);
    this.settings.update({ values }).subscribe({
      next: (settings) => {
        this.saving.set(false);
        this.applySettings(settings);
        toast.success(this.transloco.translate('clinic.saved'));
        this.branding.refresh().subscribe();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  protected discard(): void {
    this.form.patchValue(this.toFormValue(this.baseline()));
    this.form.markAsUntouched();
  }

  protected applyPreset(preset: ThemePreset): void {
    this.form.patchValue({ primary: preset.primary, accent: preset.accent });
    this.form.controls.primary.markAsDirty();
    this.form.controls.accent.markAsDirty();
  }

  // ----- Logo pick / crop / upload -------------------------------------------

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDragLeave(): void {
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    void this.pickFile(event.dataTransfer?.files[0] ?? null);
  }

  protected onPaste(event: ClipboardEvent): void {
    const item = [...(event.clipboardData?.items ?? [])].find((entry) =>
      entry.type.startsWith('image/'),
    );

    if (item === undefined) {
      return;
    }

    event.preventDefault();
    void this.pickFile(item.getAsFile());
  }

  protected onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    input.value = '';
    void this.pickFile(file);
  }

  /** Validates the pick and opens the crop dialog; the shared funnel of drop/paste/file. */
  protected async pickFile(file: File | null): Promise<void> {
    if (file === null) {
      return;
    }

    if (!LOGO_TYPES.includes(file.type)) {
      toast.error(this.transloco.translate('upload.invalidType'));
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      toast.error(this.transloco.translate('upload.tooLarge'));
      return;
    }

    try {
      const prepared = await this.images.prepare(file);

      this.releasePrepared();
      this.prepared.set(prepared);
      this.restoreCrop();
      this.cropOpen.set(true);
    } catch {
      toast.error(this.transloco.translate('upload.failed'));
    }
  }

  protected onCropStateChanged(state: 'open' | 'closed'): void {
    this.cropOpen.set(state === 'open');

    if (state === 'closed') {
      this.releasePrepared();
    }
  }

  protected setPreset(preset: 'square' | 'wide'): void {
    this.preset.set(preset);
    this.restoreCrop();
  }

  protected onZoom(event: Event): void {
    this.zoom.set(Number((event.target as HTMLInputElement).value));
  }

  protected onPointerDown(event: PointerEvent): void {
    const prepared = this.prepared();

    if (prepared === null) {
      return;
    }

    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.dragOrigin = {
      x: event.clientX,
      y: event.clientY,
      panX: this.pan().x,
      panY: this.pan().y,
    };
  }

  protected onPointerMove(event: PointerEvent): void {
    const prepared = this.prepared();

    if (prepared === null || this.dragOrigin === null) {
      return;
    }

    const clamped = clampTransform(
      { width: prepared.width, height: prepared.height },
      this.frame(),
      {
        zoom: this.zoom(),
        offsetX: this.dragOrigin.panX + (event.clientX - this.dragOrigin.x),
        offsetY: this.dragOrigin.panY + (event.clientY - this.dragOrigin.y),
      },
    );

    this.pan.set({ x: clamped.offsetX, y: clamped.offsetY });
  }

  protected onPointerUp(): void {
    this.dragOrigin = null;
  }

  /** Style of the image inside the frame (the frame itself never moves). */
  protected imageStyle(): Record<string, string> {
    const prepared = this.prepared();

    if (prepared === null) {
      return {};
    }

    const frame = this.frame();
    const scale = Math.max(frame.width / prepared.width, frame.height / prepared.height) * this.zoom();
    const left = (frame.width - prepared.width * scale) / 2 + this.pan().x;
    const top = (frame.height - prepared.height * scale) / 2 + this.pan().y;

    return {
      width: `${prepared.width * scale}px`,
      height: `${prepared.height * scale}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  }

  protected async applyCrop(): Promise<void> {
    const prepared = this.prepared();
    const rect = this.cropRect();

    if (prepared === null || rect === null) {
      return;
    }

    try {
      const file = await this.images.renderCrop(prepared, rect);

      this.cropOpen.set(false);
      this.releasePrepared();
      this.upload(file);
    } catch {
      toast.error(this.transloco.translate('upload.failed'));
    }
  }

  private upload(file: File): void {
    this.uploading.set(true);
    this.uploadProgress.set(0);

    this.brandingApi.upload(file).subscribe({
      next: (event) => {
        this.uploadProgress.set(event.progress);
      },
      error: (error: unknown) => {
        this.uploading.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
      complete: () => {
        this.uploading.set(false);
        toast.success(this.transloco.translate('upload.replaced'));
        this.branding.refresh().subscribe();
      },
    });
  }

  protected confirmRemove(): void {
    this.removing.set(true);
    this.brandingApi.remove().subscribe({
      next: () => {
        this.removing.set(false);
        this.removeOpen.set(false);
        toast.success(this.transloco.translate('upload.removed'));
        this.branding.refresh().subscribe();
      },
      error: (error: unknown) => {
        this.removing.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  protected onRemoveStateChanged(state: 'open' | 'closed'): void {
    this.removeOpen.set(state === 'open');
  }

  /** Dominant colors of the picked image — or of the active logo as fallback. */
  protected async suggestColors(): Promise<void> {
    try {
      let prepared = this.prepared();
      let owned = false;

      if (prepared === null) {
        const url = this.branding.logoUrl();

        if (url === null) {
          return;
        }

        prepared = await this.images.prepare(await (await fetch(url)).blob());
        owned = true;
      }

      const colors = this.images.suggestColors(prepared);

      if (owned) {
        this.images.release(prepared);
      }

      if (colors.length === 0) {
        toast.info(this.transloco.translate('clinic.logo.noColors'));

        return;
      }

      this.colorSuggestions.set(colors);
    } catch {
      toast.error(this.transloco.translate('upload.failed'));
    }
  }

  protected applySuggestion(suggestion: ColorSuggestion): void {
    this.form.patchValue({ primary: suggestion.color });
    this.form.controls.primary.markAsDirty();
  }

  // ----- Internals -----------------------------------------------------------

  private cropRect() {
    const prepared = this.prepared();

    if (prepared === null) {
      return null;
    }

    return computeCropRect(
      { width: prepared.width, height: prepared.height },
      this.frame(),
      { zoom: this.zoom(), offsetX: this.pan().x, offsetY: this.pan().y },
    );
  }

  private restoreCrop(): void {
    this.zoom.set(1);
    this.pan.set({ x: 0, y: 0 });
  }

  private releasePrepared(): void {
    const prepared = this.prepared();

    if (prepared !== null) {
      this.images.release(prepared);
      this.prepared.set(null);
    }
  }

  private applySettings(settings: readonly Setting[]): void {
    const baseline: Record<string, SettingValue> = {};

    for (const setting of settings) {
      if (setting.group === 'clinic') {
        baseline[setting.key] = setting.value;
      }
    }

    this.baseline.set(baseline);
    this.form.patchValue(this.toFormValue(baseline));
    this.form.markAsUntouched();
  }

  private toFormValue(baseline: Record<string, SettingValue>): ClinicFormValue {
    const text = (key: string): string => String(baseline[key] ?? '');

    return {
      name: text(KEY.name),
      slogan: text(KEY.slogan),
      legalName: text(KEY.legalName),
      rut: text(KEY.rut),
      region: text(KEY.region),
      comuna: text(KEY.comuna),
      calle: text(KEY.calle),
      numero: text(KEY.numero),
      oficina: text(KEY.oficina),
      phone: text(KEY.phone),
      email: text(KEY.email),
      website: text(KEY.website),
      primary: text(KEY.primary) || DEFAULT_THEME_SEEDS.primary,
      accent: text(KEY.accent) || DEFAULT_THEME_SEEDS.accent,
      autoDark: baseline[MODE_KEY] === 'auto',
    };
  }

  private contrastChip(color: string): ContrastChip | null {
    if (!HEX_PATTERN.test(color)) {
      return null;
    }

    const ratio = contrastRatio(color, readableOn(color));
    const level = wcagLevel(ratio);

    return {
      ratio: ratio.toFixed(2),
      level,
      labelKey:
        level === 'AAA' ? 'theme.contrastAAA' : level === 'AA' ? 'theme.contrastAA' : 'theme.contrastFail',
    };
  }
}
