import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Movement } from '../../domain/movement.entity.js';
import { MovementNotFoundError } from '../../domain/payment.errors.js';
import { LedgerRepositoryPort } from '../ports/ledger-repository.port.js';

export interface GetMovementCommand {
  id: string;
}

/**
 * One ledger movement by id. The printable receipt (comprobante) reads the
 * balance separately, so this stays a plain lookup.
 */
@Injectable()
export class GetMovementUseCase implements UseCase<GetMovementCommand, Movement> {
  constructor(private readonly ledger: LedgerRepositoryPort) {}

  async execute(command: GetMovementCommand): Promise<Movement> {
    const movement = await this.ledger.findById(command.id);

    if (movement === null) {
      throw new MovementNotFoundError(command.id);
    }

    return movement;
  }
}
