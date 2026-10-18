# Agenda de horas

La agenda permite crear, editar, reprogramar y cancelar horas. No calcula
disponibilidad ni slots: cualquier rango válido se puede guardar y las
superposiciones se muestran como advertencia, sin bloquear.

## Permisos

| Permiso | Uso |
|---|---|
| `agenda:read` | Ver calendario, configuración y profesionales |
| `agenda:create` | Crear horas y consultar conflictos |
| `agenda:update` | Editar o reprogramar |
| `agenda:cancel` | Cancelar |
| `agenda:professional` | Aparecer como profesional seleccionable |
| `agenda:manage` | Administrar el catálogo de motivos |

El rol integrado `dentista` recibe los permisos de agenda y lectura de
pacientes. Los administradores pueden crear otros roles desde la UI.

## API

```http
GET    /agenda/config
GET    /agenda/patients?query=
GET    /agenda/patients/:id
GET    /agenda/professionals
GET    /agenda/appointments?from&to&professionalId&patientId
GET    /agenda/appointments/:id
GET    /agenda/conflicts?professionalId&startsAt&endsAt&excludeId
GET    /agenda/reasons
POST   /agenda/reasons
PATCH  /agenda/reasons/:id
DELETE /agenda/reasons/:id
POST   /agenda/appointments
PATCH  /agenda/appointments/:id
POST   /agenda/appointments/:id/cancel
```

Todas las fechas viajan en ISO 8601 UTC. El frontend las presenta y captura
en la zona horaria configurada en `clinic.timeZone`.

## Motivos de agenda

El administrador mantiene el catálogo desde **Administración → Agenda y correo
→ Motivos de agenda**. Al crear la base se siembran seis motivos habituales;
se pueden agregar, renombrar y eliminar. El agendador solo ofrece los motivos
vigentes, pero conserva el texto histórico de las horas anteriores si un motivo
se elimina.

## Settings

| Key | Tipo | Default |
|---|---|---|
| `clinic.timeZone` | string | `America/Santiago` |
| `agenda.notifyPatient` | boolean | `true` |
| `agenda.notifyProfessional` | boolean | `true` |
| `agenda.defaultDurationMinutes` | number | `30` |
| `agenda.confirmationSubject` | string | `Hora {{estado}} · {{fecha}} {{hora}}` |
| `agenda.confirmationHtml` | html | plantilla base |

La pantalla **Administración → Agenda** contiene los toggles, el asunto y el
editor WYSIWYG. El HTML se sanitiza antes de enviarse.

Placeholders disponibles:

```text
{{destinatario}}
{{paciente}}
{{profesional}}
{{fecha}}
{{hora}}
{{duracion}}
{{motivo}}
{{estado}}
{{clinica}}
{{direccion}}
{{zona_horaria}}
```

## Correo

Se usa Resend mediante `EmailSenderPort`. Variables:

```env
RESEND_API_KEY=
MAIL_FROM=
MAIL_REPLY_TO=
AGENDA_EMAIL_WORKER=true
```

Cada correo incluye una versión HTML, texto plano y `invitacion.ics`. El ICS
se genera con la zona horaria de la clínica:

- `METHOD:REQUEST` al crear o reprogramar.
- `METHOD:CANCEL` y `STATUS:CANCELLED` al cancelar.
- `SEQUENCE` se incrementa en cada cambio.

Los correos se encolan en `agenda_email_outbox` después de guardar la cita.
El worker reintenta los fallos. Sin `RESEND_API_KEY` o `MAIL_FROM`, las citas
siguen funcionando y los envíos quedan en estado `skipped`.

## Frontend

- Remote `agenda` en `/agenda` (puerto de desarrollo `4206`).
- FullCalendar con vistas mes/semana/día.
- Formulario lateral con paciente, profesional, fecha, hora, duración, motivo,
  notas y ubicación.
- Botón **Agendar hora** en la ficha del paciente.
- Filtro por profesional.
- Aviso de superposición antes de guardar; el usuario puede continuar.
- Sin drag & drop, disponibilidad ni recordatorios en esta versión.
