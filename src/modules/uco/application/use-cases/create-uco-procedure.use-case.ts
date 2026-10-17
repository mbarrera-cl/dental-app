import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { UcoProcedure } from '../../domain/uco-procedure.entity.js';
import {
  UcoProcedureCodeTakenError,
} from '../../domain/uco.errors.js';
import { UcoProcedureRepositoryPort } from '../ports/uco-procedure-repository.port.js';

export interface CreateUcoProcedureCommand {
  code: string;
  chapter: string;
  name: string;
  units: number;
  actorId: string | null;
}

/**
 * Creates one fee catalog entry. The code is unique: a duplicate surfaces as
 * a conflict so the UI can prompt the user instead of silently failing.
 */
@Injectable()
export class CreateUcoProcedureUseCase implements UseCase<CreateUcoProcedureCommand, UcoProcedure> {
  constructor(private readonly procedures: UcoProcedureRepositoryPort) {}

  async execute(command: CreateUcoProcedureCommand): Promise<UcoProcedure> {
    const existing = await this.procedures.findByCode(command.code);

    if (existing !== null) {
      throw new UcoProcedureCodeTakenError(existing.code);
    }

    const procedure = UcoProcedure.create({
      code: command.code,
      chapter: command.chapter,
      name: command.name,
      units: command.units,
    });

    await this.procedures.save(procedure);

    return procedure;
  }
}
