import { defineCategory } from '../../shared/security/permission-catalog.js';

/**
 * Permission category owned by the agenda context. The `professional` action
 * is not a route permission: it marks a user as selectable as the dentist or
 * professional of an appointment.
 */
export const agendaCategory = defineCategory('agenda', 'Appointment calendar', {
  read: 'Read the appointment calendar',
  create: 'Create appointments',
  update: 'Edit and reschedule appointments',
  cancel: 'Cancel appointments',
  professional: 'Be selectable as the professional of an appointment',
  manage: 'Manage the appointment reasons catalog',
});

export const agendaPermissions = agendaCategory.keys;
