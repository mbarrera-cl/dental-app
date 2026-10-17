import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { ClinicalRecordRepositoryPort } from './application/ports/clinical-record-repository.port.js';
import { AddClinicalFindingUseCase } from './application/use-cases/add-clinical-finding.use-case.js';
import { CreateClinicalRecordUseCase } from './application/use-cases/create-clinical-record.use-case.js';
import { GetClinicalIndicesUseCase } from './application/use-cases/get-clinical-indices.use-case.js';
import { GetClinicalRecordUseCase } from './application/use-cases/get-clinical-record.use-case.js';
import { GetPatientClinicalRecordUseCase } from './application/use-cases/get-patient-clinical-record.use-case.js';
import { ListClinicalEventsUseCase } from './application/use-cases/list-clinical-events.use-case.js';
import { ListClinicalFindingsUseCase } from './application/use-cases/list-clinical-findings.use-case.js';
import { UpdateClinicalRecordUseCase } from './application/use-cases/update-clinical-record.use-case.js';
import { VoidClinicalFindingUseCase } from './application/use-cases/void-clinical-finding.use-case.js';
import { PostgresClinicalRecordRepository } from './infrastructure/adapters/persistence/postgres-clinical-record.repository.js';
import { ClinicalController } from './infrastructure/http/clinical.controller.js';

/**
 * Composition root for the clinical context (ficha dental). Depends on the
 * patients module to validate that the patient exists and to suggest the age
 * category from the birth date.
 */
@Module({
  imports: [DatabaseModule, PatientsModule],
  controllers: [ClinicalController],
  providers: [
    CreateClinicalRecordUseCase,
    GetClinicalRecordUseCase,
    GetPatientClinicalRecordUseCase,
    UpdateClinicalRecordUseCase,
    AddClinicalFindingUseCase,
    ListClinicalFindingsUseCase,
    VoidClinicalFindingUseCase,
    GetClinicalIndicesUseCase,
    ListClinicalEventsUseCase,
    // Swap this binding for another database adapter (Postgres, MongoDB, ...).
    { provide: ClinicalRecordRepositoryPort, useClass: PostgresClinicalRecordRepository },
  ],
})
export class ClinicalModule {}
