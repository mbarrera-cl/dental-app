import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { PatientExportPort } from './application/ports/patient-export.port.js';
import { PatientRepositoryPort } from './application/ports/patient-repository.port.js';
import { CreatePatientUseCase } from './application/use-cases/create-patient.use-case.js';
import { DeletePatientUseCase } from './application/use-cases/delete-patient.use-case.js';
import { ExportPatientsUseCase } from './application/use-cases/export-patients.use-case.js';
import { GetPatientByRutUseCase } from './application/use-cases/get-patient-by-rut.use-case.js';
import { GetPatientUseCase } from './application/use-cases/get-patient.use-case.js';
import { ListPatientsUseCase } from './application/use-cases/list-patients.use-case.js';
import { UpdatePatientUseCase } from './application/use-cases/update-patient.use-case.js';
import { WriteExcelFilePatientExportAdapter } from './infrastructure/adapters/export/write-excel-file-patient-export.adapter.js';
import { PostgresPatientRepository } from './infrastructure/adapters/persistence/postgres-patient.repository.js';
import { PatientNumberBootstrapService } from './infrastructure/bootstrap/patient-number-bootstrap.service.js';
import { PatientsController } from './infrastructure/http/patients.controller.js';

/**
 * Composition root for the patients context: picks concrete adapters for
 * the ports and registers use cases. This is the only place that knows which
 * implementations are wired together.
 */
@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [PatientsController],
  providers: [
    CreatePatientUseCase,
    GetPatientUseCase,
    GetPatientByRutUseCase,
    ListPatientsUseCase,
    ExportPatientsUseCase,
    UpdatePatientUseCase,
    DeletePatientUseCase,
    PatientNumberBootstrapService,
    // Swap this binding for another database adapter (Postgres, MongoDB, ...).
    { provide: PatientRepositoryPort, useClass: PostgresPatientRepository },
    { provide: PatientExportPort, useClass: WriteExcelFilePatientExportAdapter },
  ],
  exports: [
    PatientRepositoryPort,
    ListPatientsUseCase,
    GetPatientUseCase,
    GetPatientByRutUseCase,
  ],
})
export class PatientsModule {}
