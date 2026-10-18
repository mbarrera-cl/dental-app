import { Injectable } from '@nestjs/common';
import { ListUcoProceduresUseCase } from '../../../uco/application/use-cases/list-uco-procedures.use-case.js';
import { UcoProcedureRepositoryPort } from '../../../uco/application/ports/uco-procedure-repository.port.js';
import type { UcoProcedure } from '../../../uco/domain/uco-procedure.entity.js';
import { SettingsService } from '../../../settings/application/settings.service.js';

export interface UcoProcedureView {
  id: string;
  code: string;
  chapter: string;
  name: string;
  units: number;
  status: 'active' | 'inactive';
  /** Suggested CLP price = units × rate, rounded. */
  unitPrice: number;
  /** The `quotes.ucoRate` setting used to compute `unitPrice`. */
  rate: number;
}

/** MCP-facing reads of the UCO fee catalog (Arancel UCO). */
@Injectable()
export class UcoFacade {
  constructor(
    private readonly list: ListUcoProceduresUseCase,
    private readonly procedures: UcoProcedureRepositoryPort,
    private readonly settings: SettingsService,
  ) {}

  async search(query: string, limit: number): Promise<UcoProcedureView[]> {
    const [procedures, rate] = await Promise.all([
      this.list.execute({ q: query, active: true }),
      this.settings.getNumber('quotes.ucoRate'),
    ]);

    return procedures
      .slice(0, limit)
      .map((procedure) => toView(procedure, rate));
  }

  async getByCode(code: string): Promise<UcoProcedureView> {
    const [procedure, rate] = await Promise.all([
      this.procedures.findByCode(code.trim()),
      this.settings.getNumber('quotes.ucoRate'),
    ]);

    if (procedure === null) {
      throw new Error(`UCO procedure not found: ${code}`);
    }

    return toView(procedure, rate);
  }
}

export function toView(
  procedure: UcoProcedure,
  rate: number,
): UcoProcedureView {
  return {
    id: procedure.id,
    code: procedure.code,
    chapter: procedure.chapter,
    name: procedure.name,
    units: procedure.units,
    status: procedure.status,
    unitPrice: Math.round(procedure.units * rate),
    rate,
  };
}
