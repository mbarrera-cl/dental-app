import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { PrescriptionRepositoryPort } from './application/ports/prescription-repository.port.js';
import { CreatePrescriptionUseCase } from './application/use-cases/create-prescription.use-case.js';
import { GetPrescriptionUseCase } from './application/use-cases/get-prescription.use-case.js';
import { ListPrescriptionsUseCase } from './application/use-cases/list-prescriptions.use-case.js';
import { PostgresPrescriptionRepository } from './infrastructure/adapters/persistence/postgres-prescription.repository.js';
import { PrescriptionsController } from './infrastructure/http/prescriptions.controller.js';

/**
 * Composition root for the prescriptions context. Depends on the patients
 * module to validate the patient and snapshot its identity into the document.
 */
@Module({
  imports: [DatabaseModule, PatientsModule],
  controllers: [PrescriptionsController],
  providers: [
    CreatePrescriptionUseCase,
    GetPrescriptionUseCase,
    ListPrescriptionsUseCase,
    { provide: PrescriptionRepositoryPort, useClass: PostgresPrescriptionRepository },
  ],
})
export class PrescriptionsModule {}
