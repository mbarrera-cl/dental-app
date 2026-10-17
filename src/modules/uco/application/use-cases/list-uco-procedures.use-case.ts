import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { UcoProcedure } from '../../domain/uco-procedure.entity.js';
import { UcoProcedureRepositoryPort } from '../ports/uco-procedure-repository.port.js';

export interface ListUcoProceduresQuery {
  /** Search term; matches code, name or chapter. */
  q?: string;
  /** When `true`, hide inactive (soft-deleted) entries. */
  active?: boolean;
}

/**
 * Lists the fee catalog. The search is the predictive-search entry point the
 * quote editor and the admin table share.
 */
@Injectable()
export class ListUcoProceduresUseCase implements UseCase<ListUcoProceduresQuery, UcoProcedure[]> {
  constructor(private readonly procedures: UcoProcedureRepositoryPort) {}

  async execute(query: ListUcoProceduresQuery): Promise<UcoProcedure[]> {
    const term = (query.q ?? '').trim();

    if (term.length > 0) {
      return this.procedures.search(term, query.active === true);
    }

    if (query.active === true) {
      const all = await this.procedures.findAll();

      return all.filter((procedure) => procedure.status === 'active');
    }

    return this.procedures.findAll();
  }
}
