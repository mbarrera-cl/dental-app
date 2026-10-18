import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Movement } from '../../domain/movement.entity.js';
import { MovementNotFoundError } from '../../domain/payment.errors.js';
import { LedgerRepositoryPort } from '../ports/ledger-repository.port.js';

export interface VoidMovementCommand {
  id: string;
  reason: string;
  actorId: string | null;
}

/**
 * Annuls a ledger movement (cargo or abono). The row stays in the book with
 * its void metadata; the balance is recomputed and heals itself.
 */
@Injectable()
export class VoidMovementUseCase implements UseCase<VoidMovementCommand, Movement> {
  constructor(private readonly ledger: LedgerRepositoryPort) {}

  async execute(command: VoidMovementCommand): Promise<Movement> {
    const movement = await this.ledger.findById(command.id);

    if (movement === null) {
      throw new MovementNotFoundError(command.id);
    }

    movement.void(command.actorId, command.reason);

    await this.ledger.replace(movement);

    return movement;
  }
}
