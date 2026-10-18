import type { SettingDefinition, SettingGroup } from '../../settings/domain/setting-definition.js';

/** Settings owned by the agenda context: notifications and email templates. */
export const AGENDA_SETTING_GROUPS: readonly SettingGroup[] = [
  { id: 'agenda', description: 'Appointment calendar and confirmation emails' },
];

export const AGENDA_SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: 'agenda.notifyPatient',
    group: 'agenda',
    type: 'boolean',
    default: true,
    description: 'Send the confirmation email and ICS to the patient',
  },
  {
    key: 'agenda.notifyProfessional',
    group: 'agenda',
    type: 'boolean',
    default: true,
    description: 'Send the confirmation email and ICS to the professional',
  },
  {
    key: 'agenda.defaultDurationMinutes',
    group: 'agenda',
    type: 'number',
    default: 30,
    min: 5,
    max: 480,
    description: 'Default appointment duration in minutes',
  },
  {
    key: 'agenda.confirmationSubject',
    group: 'agenda',
    type: 'string',
    default: 'Hora {{estado}} · {{fecha}} {{hora}}',
    maxLength: 180,
    description: 'Subject of the appointment confirmation email',
  },
  {
    key: 'agenda.confirmationHtml',
    group: 'agenda',
    type: 'html',
    default:
      '<p>Hola {{destinatario}},</p><p>Tu hora con {{profesional}} quedó {{estado}} para el {{fecha}} a las {{hora}}.</p><p>Motivo: {{motivo}}<br>Lugar: {{direccion}}</p><p>— {{clinica}}</p>',
    maxLength: 100000,
    description: 'HTML body of the appointment confirmation email',
  },
];
