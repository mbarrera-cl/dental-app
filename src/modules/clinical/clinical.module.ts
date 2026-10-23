import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { ClinicalRecordRepositoryPort } from './application/ports/clinical-record-repository.port.js';
import { TreatmentPlanRepositoryPort } from './application/ports/treatment-plan-repository.port.js';
import { AddClinicalFindingUseCase } from './application/use-cases/add-clinical-finding.use-case.js';
import { CreateClinicalRecordUseCase } from './application/use-cases/create-clinical-record.use-case.js';
import { DeleteTreatmentPlanItemUseCase } from './application/use-cases/delete-treatment-plan-item.use-case.js';
import { FinalizeClinicalRecordUseCase } from './application/use-cases/finalize-clinical-record.use-case.js';
import { GetClinicalIndicesUseCase } from './application/use-cases/get-clinical-indices.use-case.js';
import { GetClinicalRecordUseCase } from './application/use-cases/get-clinical-record.use-case.js';
import { GetPatientClinicalRecordUseCase } from './application/use-cases/get-patient-clinical-record.use-case.js';
import { GetTreatmentPlanUseCase } from './application/use-cases/get-treatment-plan.use-case.js';
import { ImportQuoteIntoTreatmentPlanUseCase } from './application/use-cases/import-quote-into-treatment-plan.use-case.js';
import { ListClinicalEventsUseCase } from './application/use-cases/list-clinical-events.use-case.js';
import { ListClinicalFindingsUseCase } from './application/use-cases/list-clinical-findings.use-case.js';
import { PreviewQuoteImportUseCase } from './application/use-cases/preview-quote-import.use-case.js';
import { RestoreTreatmentPlanItemUseCase } from './application/use-cases/restore-treatment-plan-item.use-case.js';
import { UpdateClinicalRecordUseCase } from './application/use-cases/update-clinical-record.use-case.js';
import { UpdateTreatmentPlanItemUseCase } from './application/use-cases/update-treatment-plan-item.use-case.js';
import { UpdateTreatmentPlanNotesUseCase } from './application/use-cases/update-treatment-plan-notes.use-case.js';
import { VerifyClinicalRecordIntegrityUseCase } from './application/use-cases/verify-clinical-record-integrity.use-case.js';
import { VoidClinicalFindingUseCase } from './application/use-cases/void-clinical-finding.use-case.js';
import { PostgresClinicalRecordRepository } from './infrastructure/adapters/persistence/postgres-clinical-record.repository.js';
import { PostgresTreatmentPlanRepository } from './infrastructure/adapters/persistence/postgres-treatment-plan.repository.js';
import { ClinicalController } from './infrastructure/http/clinical.controller.js';
import { TreatmentPlanController } from './infrastructure/http/treatment-plan.controller.js';

/**
 * Composition root for the clinical context (ficha dental + plan de
 * tratamiento). Depends on the patients module to validate that the patient
 * exists and to suggest the age category from the birth date, and on the
 * quotations module to import approved budgets into the plan.
 */
@Module({
  imports: [DatabaseModule, PatientsModule, QuotesModule],
  controllers: [ClinicalController, TreatmentPlanController],
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
    FinalizeClinicalRecordUseCase,
    VerifyClinicalRecordIntegrityUseCase,
    GetTreatmentPlanUseCase,
    UpdateTreatmentPlanItemUseCase,
    DeleteTreatmentPlanItemUseCase,
    RestoreTreatmentPlanItemUseCase,
    UpdateTreatmentPlanNotesUseCase,
    PreviewQuoteImportUseCase,
    ImportQuoteIntoTreatmentPlanUseCase,
    // Swap these bindings for another database adapter (Postgres, MongoDB, ...).
    {
      provide: ClinicalRecordRepositoryPort,
      useClass: PostgresClinicalRecordRepository,
    },
    {
      provide: TreatmentPlanRepositoryPort,
      useClass: PostgresTreatmentPlanRepository,
    },
  ],
})
export class ClinicalModule {}
