import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { UcoProcedure } from '../../domain/uco-procedure.entity.js';
import { UCO_SEED } from '../../domain/uco-seed.js';
import { UcoProcedureRepositoryPort } from '../../application/ports/uco-procedure-repository.port.js';

/**
 * Seeds the reference UCO catalog on a fresh database. Idempotent: if any
 * entry already exists the seed is skipped, so an edited catalog is never
 * overwritten by a restart. An official schedule arrives via CSV import
 * (`POST /uco/import`) instead.
 */
@Injectable()
export class UcoBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UcoBootstrapService.name);

  constructor(private readonly procedures: UcoProcedureRepositoryPort) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.procedures.findAll();

    if (existing.length > 0) {
      return;
    }

    const entities = UCO_SEED.map((entry) =>
      UcoProcedure.create({
        code: entry.code,
        chapter: entry.chapter,
        name: entry.name,
        units: entry.units,
      }),
    );

    for (const procedure of entities) {
      await this.procedures.save(procedure);
    }

    this.logger.log(`Seeded the reference UCO catalog (${entities.length} procedures)`);
  }
}
