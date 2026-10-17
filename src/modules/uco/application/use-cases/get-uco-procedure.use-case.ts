import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { UcoProcedure } from '../../domain/uco-procedure.entity.js';
import { UcoProcedureNotFoundError } from '../../domain/uco.errors.js';
import { UcoProcedureRepositoryPort } from '../ports/uco-procedure-repository.port.js';

export interface GetUcoProcedureQuery {
  id: string;
}

@Injectable()
export class GetUcoProcedureUseCase implements UseCase<GetUcoProcedureQuery, UcoProcedure> {
  constructor(private readonly procedures: UcoProcedureRepositoryPort) {}

  async execute(query: GetUcoProcedureQuery): Promise<UcoProcedure> {
    const procedure = await this.procedures.findById(query.id);

    if (procedure === null) {
      throw new UcoProcedureNotFoundError(query.id);
    }

    return procedure;
  }
}
