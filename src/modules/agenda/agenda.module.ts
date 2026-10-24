import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AgendaEmailOutboxRepositoryPort } from './application/ports/agenda-email-outbox.repository.port.js';
import { AgendaReasonRepositoryPort } from './application/ports/agenda-reason-repository.port.js';
import { AppointmentRepositoryPort } from './application/ports/appointment-repository.port.js';
import { EmailSenderPort } from './application/ports/email-sender.port.js';
import { AgendaEmailService } from './application/services/agenda-email.service.js';
import { AgendaReasonsBootstrapService } from './application/services/agenda-reasons-bootstrap.service.js';
import { AgendaTemplateService } from './application/services/agenda-template.service.js';
import { AppointmentIcsService } from './application/services/appointment-ics.service.js';
import { EmailOutboxWorker } from './application/services/email-outbox.worker.js';
import { CancelAppointmentUseCase } from './application/use-cases/cancel-appointment.use-case.js';
import { CheckConflictsUseCase } from './application/use-cases/check-conflicts.use-case.js';
import { GetAgendaConfigUseCase } from './application/use-cases/get-agenda-config.use-case.js';
import { CreateAgendaReasonUseCase } from './application/use-cases/create-agenda-reason.use-case.js';
import { CreateAppointmentUseCase } from './application/use-cases/create-appointment.use-case.js';
import { DeleteAgendaReasonUseCase } from './application/use-cases/delete-agenda-reason.use-case.js';
import { ListAgendaReasonsUseCase } from './application/use-cases/list-agenda-reasons.use-case.js';
import { UpdateAgendaReasonUseCase } from './application/use-cases/update-agenda-reason.use-case.js';
import { GetAgendaPatientUseCase } from './application/use-cases/get-agenda-patient.use-case.js';
import { GetAppointmentUseCase } from './application/use-cases/get-appointment.use-case.js';
import { ListAppointmentsUseCase } from './application/use-cases/list-appointments.use-case.js';
import { ListProfessionalsUseCase } from './application/use-cases/list-professionals.use-case.js';
import { SearchAgendaPatientsUseCase } from './application/use-cases/search-agenda-patients.use-case.js';
import { UpdateAppointmentUseCase } from './application/use-cases/update-appointment.use-case.js';
import { ResendEmailSender } from './infrastructure/adapters/email/resend-email-sender.js';
import { PostgresAgendaEmailOutboxRepository } from './infrastructure/adapters/persistence/postgres-agenda-email-outbox.repository.js';
import { PostgresAgendaReasonRepository } from './infrastructure/adapters/persistence/postgres-agenda-reason.repository.js';
import { PostgresAppointmentRepository } from './infrastructure/adapters/persistence/postgres-appointment.repository.js';
import { AgendaController } from './infrastructure/http/agenda.controller.js';
import { AgendaReasonsController } from './infrastructure/http/agenda-reasons.controller.js';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [AgendaController, AgendaReasonsController],
  providers: [
    AgendaEmailService,
    AgendaReasonsBootstrapService,
    ListAgendaReasonsUseCase,
    CreateAgendaReasonUseCase,
    UpdateAgendaReasonUseCase,
    DeleteAgendaReasonUseCase,
    AgendaTemplateService,
    AppointmentIcsService,
    EmailOutboxWorker,
    CreateAppointmentUseCase,
    UpdateAppointmentUseCase,
    CancelAppointmentUseCase,
    GetAppointmentUseCase,
    GetAgendaPatientUseCase,
    ListAppointmentsUseCase,
    ListProfessionalsUseCase,
    SearchAgendaPatientsUseCase,
    CheckConflictsUseCase,
    GetAgendaConfigUseCase,
    { provide: AppointmentRepositoryPort, useClass: PostgresAppointmentRepository },
    { provide: AgendaReasonRepositoryPort, useClass: PostgresAgendaReasonRepository },
    {
      provide: AgendaEmailOutboxRepositoryPort,
      useClass: PostgresAgendaEmailOutboxRepository,
    },
    { provide: EmailSenderPort, useClass: ResendEmailSender },
  ],
  exports: [
    CancelAppointmentUseCase,
    CreateAppointmentUseCase,
    GetAgendaConfigUseCase,
    GetAppointmentUseCase,
    ListAppointmentsUseCase,
    ListProfessionalsUseCase,
    UpdateAppointmentUseCase,
  ],
})
export class AgendaModule {}
