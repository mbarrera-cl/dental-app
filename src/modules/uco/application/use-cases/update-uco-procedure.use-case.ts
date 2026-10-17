import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { UcoProcedure } from '../../domain/uco-procedure.entity.js';
import { UcoProcedureNotFoundError } from '../../domain/uco.errors.js';
import { UcoProcedureRepositoryPort } from '../ports/uco-procedure-repository.port.js';

export interface UpdateUcoProcedureCommand {
  id: string;
  code?: string;
  chapter?: string;
  name?: string;
  units?: number;
  /** When `false` the entry is soft-deleted. */
  active?: boolean;
  actorId: string | null;
}

export interface UpdateUcoProcedureResult {
  procedure: UcoProcedure;
  /** Was the code actually changed? (The UI shows a hint when the folio references change.) */
  codeChanged: boolean;
}

/**
 * Partially updates a fee catalog entry. Soft-deletes are done here too
 * (`active: false`), so the controller exposes a single PATCH for edits and
 * for the low-level toggle.
 */
@Injectable()
export class UpdateUcoProcedureUseCase implements UseCase<UpdateUcoProcedureCommand, UpdateUcoProcedureResult> {
  constructor(private readonly procedures: UcoProcedureRepositoryPort) {}

  async execute(command: UpdateUcoProcedureCommand): Promise<UpdateUcoProcedureResult> {
    const procedure = await this.procedures.findById(command.id);

    if (procedure === null) {
      throw new UcoProcedureNotFoundError(command.id);
    }

    const beforeCode = procedure.code;

    if (command.code !== undefined) {
      procedure.changeCode(command.code);
    }

    if (command.chapter !== undefined) {
      procedure.changeChapter(command.chapter);
    }

    if (command.name !== undefined) {
      procedure.changeName(command.name);
    }

    if (command.units !== undefined) {
      procedure.changeUnits(command.units);
    }

    if (command.active === false) {
      procedure.deactivate();
    } else if (command.active === true) {
      procedure.reactivate();
    }

    await this.procedures.update(procedure);

    return { procedure, codeChanged: procedure.code !== beforeCode };
  }
}
