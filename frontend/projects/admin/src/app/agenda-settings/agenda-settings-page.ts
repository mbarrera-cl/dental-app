import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { AgendaApi, SettingsApi, mapApiError, type AgendaReason, type Setting } from 'data-access';
import { SessionStore, PERMISSION_KEYS } from 'auth';

interface AgendaSettingsForm {
  notifyPatient: boolean;
  notifyProfessional: boolean;
  defaultDurationMinutes: number;
  confirmationSubject: string;
  confirmationHtml: string;
}

const EMPTY_FORM: AgendaSettingsForm = {
  notifyPatient: true,
  notifyProfessional: true,
  defaultDurationMinutes: 30,
  confirmationSubject: 'Hora {{estado}} · {{fecha}} {{hora}}',
  confirmationHtml:
    '<p>Hola {{destinatario}},</p><p>Tu hora con {{profesional}} quedó {{estado}} para el {{fecha}} a las {{hora}}.</p><p>Motivo: {{motivo}}<br>Lugar: {{direccion}}</p><p>— {{clinica}}</p>',
};

const PLACEHOLDERS = [
  '{{destinatario}}',
  '{{paciente}}',
  '{{profesional}}',
  '{{fecha}}',
  '{{hora}}',
  '{{duracion}}',
  '{{motivo}}',
  '{{estado}}',
  '{{clinica}}',
  '{{direccion}}',
  '{{zona_horaria}}',
];

@Component({
  selector: 'app-agenda-settings-page',
  imports: [HlmButton, HlmInput],
  templateUrl: './agenda-settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaSettingsPage {
  private readonly api = inject(SettingsApi);
  private readonly agendaApi = inject(AgendaApi);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly session = inject(SessionStore);

  @ViewChild('editor') private editor?: ElementRef<HTMLElement>;

  protected readonly placeholders = PLACEHOLDERS;
  protected readonly form = signal<AgendaSettingsForm>(EMPTY_FORM);
  protected readonly editorHtml = signal(DOMPurify.sanitize(EMPTY_FORM.confirmationHtml));
  protected readonly previewOpen = signal(false);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reasons = signal<AgendaReason[]>([]);
  protected readonly newReasonName = signal('');
  protected readonly editingReasonId = signal<string | null>(null);
  protected readonly editingReasonName = signal('');
  protected readonly reasonBusy = signal(false);
  protected readonly reasonError = signal<string | null>(null);
  protected readonly canEdit = computed(() => this.session.has(PERMISSION_KEYS.settings.update));
  protected readonly canManageReasons = computed(() => this.session.has(PERMISSION_KEYS.agenda.manage));
  protected readonly previewHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(this.form().confirmationHtml)),
  );

  constructor() {
    this.load();
    this.loadReasons();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.list().subscribe({
      next: (settings) => {
        const values = new Map(
          settings.filter((setting) => setting.group === 'agenda').map((setting) => [setting.key, setting.value]),
        );
        const form: AgendaSettingsForm = {
          notifyPatient: Boolean(values.get('agenda.notifyPatient') ?? true),
          notifyProfessional: Boolean(values.get('agenda.notifyProfessional') ?? true),
          defaultDurationMinutes: Number(values.get('agenda.defaultDurationMinutes') ?? 30),
          confirmationSubject: asText(values.get('agenda.confirmationSubject'), EMPTY_FORM.confirmationSubject),
          confirmationHtml: asText(values.get('agenda.confirmationHtml'), EMPTY_FORM.confirmationHtml),
        };
        this.form.set(form);
        this.editorHtml.set(DOMPurify.sanitize(form.confirmationHtml));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(mapApiError(error));
      },
    });
  }

  protected set<K extends keyof AgendaSettingsForm>(key: K, value: AgendaSettingsForm[K]): void {
    this.form.update((form) => ({ ...form, [key]: value }));
  }

  protected syncEditor(): void {
    const html = this.editor?.nativeElement.innerHTML ?? '';
    this.set('confirmationHtml', html);
  }

  protected command(command: string, value?: string): void {
    const editor = this.editor?.nativeElement;

    if (editor === undefined) {
      return;
    }

    editor.focus();
    document.execCommand(command, false, value);
    this.syncEditor();
  }

  protected insertPlaceholder(placeholder: string): void {
    const editor = this.editor?.nativeElement;

    if (editor === undefined) {
      return;
    }

    editor.focus();
    document.execCommand('insertText', false, placeholder);
    this.syncEditor();
  }

  protected setLink(): void {
    const url = window.prompt('URL del enlace (https://…)');

    if (url !== null && /^https?:\/\//.test(url)) {
      this.command('createLink', url);
    }
  }

  protected save(): void {
    if (!this.canEdit()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const form = this.form();

    this.api
      .update({
        values: {
          'agenda.notifyPatient': form.notifyPatient,
          'agenda.notifyProfessional': form.notifyProfessional,
          'agenda.defaultDurationMinutes': form.defaultDurationMinutes,
          'agenda.confirmationSubject': form.confirmationSubject,
          'agenda.confirmationHtml': form.confirmationHtml,
        },
      })
      .subscribe({
        next: (settings) => {
          this.saving.set(false);
          this.applyResponse(settings);
          toast.success('Configuración de agenda guardada.');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(mapApiError(error));
          toast.error('No se pudo guardar la configuración de agenda.');
        },
      });
  }

  protected loadReasons(): void {
    this.reasonError.set(null);
    this.agendaApi.reasons().subscribe({
      next: (reasons) => this.reasons.set(reasons),
      error: (error: unknown) => this.reasonError.set(mapApiError(error)),
    });
  }

  protected setNewReasonName(event: Event): void {
    this.newReasonName.set((event.target as HTMLInputElement).value);
  }

  protected addReason(): void {
    const name = this.newReasonName().trim();

    if (!this.canManageReasons() || name.length < 2) {
      return;
    }

    this.reasonBusy.set(true);
    this.agendaApi.createReason(name).subscribe({
      next: (reason) => {
        this.reasons.update((reasons) => [...reasons, reason].sort((a, b) => a.name.localeCompare(b.name)));
        this.newReasonName.set('');
        this.reasonBusy.set(false);
        toast.success('Motivo agregado.');
      },
      error: (error: unknown) => {
        this.reasonError.set(mapApiError(error));
        this.reasonBusy.set(false);
      },
    });
  }

  protected startReasonEdit(reason: AgendaReason): void {
    this.editingReasonId.set(reason.id);
    this.editingReasonName.set(reason.name);
  }

  protected setEditingReasonName(event: Event): void {
    this.editingReasonName.set((event.target as HTMLInputElement).value);
  }

  protected cancelReasonEdit(): void {
    this.editingReasonId.set(null);
    this.editingReasonName.set('');
  }

  protected saveReason(): void {
    const id = this.editingReasonId();
    const name = this.editingReasonName().trim();

    if (id === null || name.length < 2 || !this.canManageReasons()) {
      return;
    }

    this.reasonBusy.set(true);
    this.agendaApi.updateReason(id, name).subscribe({
      next: (reason) => {
        this.reasons.update((reasons) =>
          reasons
            .map((item) => (item.id === reason.id ? reason : item))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        this.cancelReasonEdit();
        this.reasonBusy.set(false);
        toast.success('Motivo actualizado.');
      },
      error: (error: unknown) => {
        this.reasonError.set(mapApiError(error));
        this.reasonBusy.set(false);
      },
    });
  }

  protected deleteReason(reason: AgendaReason): void {
    if (!this.canManageReasons() || !window.confirm(`¿Eliminar el motivo "${reason.name}"?`)) {
      return;
    }

    this.reasonBusy.set(true);
    this.agendaApi.deleteReason(reason.id).subscribe({
      next: () => {
        this.reasons.update((reasons) => reasons.filter((item) => item.id !== reason.id));
        this.reasonBusy.set(false);
        toast.success('Motivo eliminado.');
      },
      error: (error: unknown) => {
        this.reasonError.set(mapApiError(error));
        this.reasonBusy.set(false);
      },
    });
  }

  private applyResponse(settings: readonly Setting[]): void {
    const values = new Map(
      settings.filter((setting) => setting.group === 'agenda').map((setting) => [setting.key, setting.value]),
    );
    const html = asText(values.get('agenda.confirmationHtml'), this.form().confirmationHtml);
    this.form.update((form) => ({
      ...form,
      confirmationHtml: html,
      confirmationSubject: asText(values.get('agenda.confirmationSubject'), form.confirmationSubject),
      defaultDurationMinutes: Number(values.get('agenda.defaultDurationMinutes') ?? form.defaultDurationMinutes),
    }));
    this.editorHtml.set(DOMPurify.sanitize(html));
  }
}

function asText(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
