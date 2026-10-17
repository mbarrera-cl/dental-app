import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { UcoProcedureRepositoryPort } from './application/ports/uco-procedure-repository.port.js';
import { CreateUcoProcedureUseCase } from './application/use-cases/create-uco-procedure.use-case.js';
import { DeleteUcoProcedureUseCase } from './application/use-cases/delete-uco-procedure.use-case.js';
import { GetUcoProcedureUseCase } from './application/use-cases/get-uco-procedure.use-case.js';
import { ListUcoProceduresUseCase } from './application/use-cases/list-uco-procedures.use-case.js';
import { UpdateUcoProcedureUseCase } from './application/use-cases/update-uco-procedure.use-case.js';
import { UcoBootstrapService } from './infrastructure/bootstrap/uco-bootstrap.service.js';
import { SqliteUcoProcedureRepository } from './infrastructure/adapters/persistence/sqlite-uco-procedure.repository.js';
import { UcoController } from './infrastructure/http/uco.controller.js';

/**
 * Composition root for the UCO fee catalog context (Arancel UCO).
 */
@Module({
  imports: [DatabaseModule],
  controllers: [UcoController],
  providers: [
    CreateUcoProcedureUseCase,
    ListUcoProceduresUseCase,
    GetUcoProcedureUseCase,
    UpdateUcoProcedureUseCase,
    DeleteUcoProcedureUseCase,
    UcoBootstrapService,
    // Swap this binding for another database adapter (Postgres, MongoDB, ...).
    { provide: UcoProcedureRepositoryPort, useClass: SqliteUcoProcedureRepository },
  ],
  exports: [UcoProcedureRepositoryPort],
})
export class UcoModule {}
