import { Injectable } from '@nestjs/common';
import { UcoProcedureRepositoryPort } from '../../../application/ports/uco-procedure-repository.port.js';
import type { UcoProcedure } from '../../../domain/uco-procedure.entity.js';
import { UcoProcedureNotFoundError } from '../../../domain/uco.errors.js';

/**
 * Driven adapter: keeps the catalog in memory for unit tests. Mirrors the
 * SQLite adapter's behaviour (code uniqueness, soft-delete semantics).
 */
@Injectable()
export class InMemoryUcoProcedureRepository extends UcoProcedureRepositoryPort {
  private readonly byId = new Map<string, UcoProcedure>();
  private readonly byCode = new Map<string, UcoProcedure>();

  async save(procedure: UcoProcedure): Promise<void> {
    if (this.byCode.has(procedure.code)) {
      throw new UcoProcedureNotFoundError(procedure.id);
    }

    this.byId.set(procedure.id, procedure);
    this.byCode.set(procedure.code, procedure);
  }

  async update(procedure: UcoProcedure): Promise<void> {
    if (!this.byId.has(procedure.id)) {
      throw new UcoProcedureNotFoundError(procedure.id);
    }

    if (this.byCode.has(procedure.code) && this.byCode.get(procedure.code)!.id !== procedure.id) {
      throw new UcoProcedureNotFoundError(procedure.id);
    }

    for (const [code, existing] of this.byCode) {
      if (existing.id === procedure.id && code !== procedure.code) {
        this.byCode.delete(code);
      }
    }

    this.byId.set(procedure.id, procedure);
    this.byCode.set(procedure.code, procedure);
  }

  async delete(id: string): Promise<void> {
    const procedure = this.byId.get(id);

    if (procedure === undefined) {
      throw new UcoProcedureNotFoundError(id);
    }

    procedure.deactivate();
  }

  async findById(id: string): Promise<UcoProcedure | null> {
    return this.byId.get(id) ?? null;
  }

  async findByCode(code: string): Promise<UcoProcedure | null> {
    return this.byCode.get(code) ?? null;
  }

  async findAll(): Promise<UcoProcedure[]> {
    return [...this.byId.values()].sort(byName);
  }

  async search(q: string, activeOnly: boolean): Promise<UcoProcedure[]> {
    const needle = q.toLowerCase();

    return [...this.byId.values()]
      .filter((procedure) => (activeOnly ? procedure.status === 'active' : true))
      .filter(
        (procedure) =>
          procedure.code.toLowerCase().includes(needle) ||
          procedure.name.toLowerCase().includes(needle) ||
          procedure.chapter.toLowerCase().includes(needle),
      )
      .sort(byName);
  }
}

function byName(a: UcoProcedure, b: UcoProcedure): number {
  return a.name.localeCompare(b.name);
}
