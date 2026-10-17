import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { UcoModule } from '../uco/uco.module.js';
import { QuoteRepositoryPort } from './application/ports/quote-repository.port.js';
import { CreateQuoteUseCase } from './application/use-cases/create-quote.use-case.js';
import { DecideQuoteItemUseCase } from './application/use-cases/decide-quote-item.use-case.js';
import { DeleteQuoteUseCase } from './application/use-cases/delete-quote.use-case.js';
import { DuplicateQuoteUseCase } from './application/use-cases/duplicate-quote.use-case.js';
import { GetQuoteUseCase } from './application/use-cases/get-quote.use-case.js';
import { ListQuoteVersionsUseCase } from './application/use-cases/list-quote-versions.use-case.js';
import { ListQuotesUseCase } from './application/use-cases/list-quotes.use-case.js';
import { SanctionQuoteUseCase } from './application/use-cases/sanction-quote.use-case.js';
import { UpdateQuoteUseCase } from './application/use-cases/update-quote.use-case.js';
import { SqliteQuoteRepository } from './infrastructure/adapters/persistence/sqlite-quote.repository.js';
import { QuotesController } from './infrastructure/http/quotes.controller.js';

/**
 * Composition root for the quotations context. Depends on the patients module
 * (validates the patient + resolves its snapshot), the UCO module (resolves
 * catalog codes) and the settings module (folio prefix, validity days).
 */
@Module({
  imports: [DatabaseModule, PatientsModule, UcoModule, SettingsModule],
  controllers: [QuotesController],
  providers: [
    CreateQuoteUseCase,
    ListQuotesUseCase,
    GetQuoteUseCase,
    UpdateQuoteUseCase,
    DeleteQuoteUseCase,
    DecideQuoteItemUseCase,
    SanctionQuoteUseCase,
    DuplicateQuoteUseCase,
    ListQuoteVersionsUseCase,
    // Swap this binding for another database adapter (Postgres, MongoDB, ...).
    { provide: QuoteRepositoryPort, useClass: SqliteQuoteRepository },
  ],
})
export class QuotesModule {}
