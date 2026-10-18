import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { LedgerRepositoryPort } from './application/ports/ledger-repository.port.js';
import { GetCashSummaryUseCase } from './application/use-cases/get-cash-summary.use-case.js';
import { GetMovementUseCase } from './application/use-cases/get-movement.use-case.js';
import { GetPatientBalanceUseCase } from './application/use-cases/get-patient-balance.use-case.js';
import { ListMovementsUseCase } from './application/use-cases/list-movements.use-case.js';
import { RecordChargeUseCase } from './application/use-cases/record-charge.use-case.js';
import { RecordPaymentUseCase } from './application/use-cases/record-payment.use-case.js';
import { RecordQuoteChargeUseCase } from './application/use-cases/record-quote-charge.use-case.js';
import { VoidMovementUseCase } from './application/use-cases/void-movement.use-case.js';
import { PostgresLedgerRepository } from './infrastructure/adapters/persistence/postgres-ledger.repository.js';
import { PaymentsController } from './infrastructure/http/payments.controller.js';

/**
 * Composition root for the patient-account context (cobros / caja). Depends
 * on the patients module (validates the patient before every write/read).
 */
@Module({
  imports: [DatabaseModule, PatientsModule],
  controllers: [PaymentsController],
  providers: [
    RecordChargeUseCase,
    RecordPaymentUseCase,
    ListMovementsUseCase,
    GetPatientBalanceUseCase,
    VoidMovementUseCase,
    GetCashSummaryUseCase,
    GetMovementUseCase,
    RecordQuoteChargeUseCase,
    // Swap this binding for another database adapter (Postgres, MongoDB, ...).
    { provide: LedgerRepositoryPort, useClass: PostgresLedgerRepository },
  ],
  exports: [
    RecordChargeUseCase,
    RecordPaymentUseCase,
    ListMovementsUseCase,
    GetPatientBalanceUseCase,
    VoidMovementUseCase,
    GetCashSummaryUseCase,
    GetMovementUseCase,
    RecordQuoteChargeUseCase,
  ],
})
export class PaymentsModule {}
