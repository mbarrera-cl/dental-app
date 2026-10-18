import type { AgendaReason } from '../../domain/agenda-reason.entity.js';

export abstract class AgendaReasonRepositoryPort {
  abstract findAll(): Promise<AgendaReason[]>;

  abstract findById(id: string): Promise<AgendaReason | null>;

  abstract count(): Promise<number>;

  abstract save(reason: AgendaReason): Promise<void>;

  abstract update(reason: AgendaReason): Promise<void>;

  abstract delete(id: string): Promise<void>;
}
