import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { ConsentRecordRepositoryPort } from './application/ports/consent-record-repository.port.js';
import { ConsentTemplateRepositoryPort } from './application/ports/consent-template-repository.port.js';
import { GetConsentUseCase } from './application/use-cases/get-consent.use-case.js';
import { ListConsentTemplatesUseCase } from './application/use-cases/list-consent-templates.use-case.js';
import { ListPatientConsentsUseCase } from './application/use-cases/list-patient-consents.use-case.js';
import { RecordConsentUseCase } from './application/use-cases/record-consent.use-case.js';
import { UpsertConsentTemplateUseCase } from './application/use-cases/upsert-consent-template.use-case.js';
import { PostgresConsentRecordRepository } from './infrastructure/adapters/persistence/postgres-consent-record.repository.js';
import { PostgresConsentTemplateRepository } from './infrastructure/adapters/persistence/postgres-consent-template.repository.js';
import { ConsentBootstrapService } from './infrastructure/bootstrap/consent-bootstrap.service.js';
import { ConsentsController } from './infrastructure/http/consents.controller.js';

/**
 * Composition root for the informed-consents context. Depends on the patients
 * module to validate the patient and snapshot their identity into each
 * acceptance.
 */
@Module({
  imports: [DatabaseModule, PatientsModule],
  controllers: [ConsentsController],
  providers: [
    ListConsentTemplatesUseCase,
    UpsertConsentTemplateUseCase,
    RecordConsentUseCase,
    ListPatientConsentsUseCase,
    GetConsentUseCase,
    ConsentBootstrapService,
    { provide: ConsentTemplateRepositoryPort, useClass: PostgresConsentTemplateRepository },
    { provide: ConsentRecordRepositoryPort, useClass: PostgresConsentRecordRepository },
  ],
})
export class ConsentsModule {}
