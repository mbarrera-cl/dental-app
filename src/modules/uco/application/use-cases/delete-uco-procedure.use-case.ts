import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { UcoProcedureRepositoryPort } from '../ports/uco-procedure-repository.port.js';

export interface DeleteUcoProcedureCommand {
  id: string;
}

/**
 * Soft-deletes a fee catalog entry: it stops appearing in searches and
 * predictions but historical quotes keep resolving its code/name snapshot.
 */
@Injectable()
export class DeleteUcoProcedureUseCase implements UseCase<DeleteUcoProcedureCommand, void> {
  constructor(private readonly procedures: UcoProcedureRepositoryPort) {}

  async execute(command: DeleteUcoProcedureCommand): Promise<void> {
    await this.procedures.delete(command.id);
  }
}
