import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PostgresDatabase } from '../../../../shared/infrastructure/database/postgres-database.js';
import { AgendaReasonRepositoryPort } from '../ports/agenda-reason-repository.port.js';
import { AgendaReason } from '../../domain/agenda-reason.entity.js';

const MARKER = 'agenda.reasons.seeded';
const DEFAULT_REASONS = [
  'Consulta general',
  'Control',
  'Limpieza dental',
  'Urgencia',
  'Tratamiento',
  'Otro',
];

@Injectable()
export class AgendaReasonsBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AgendaReasonsBootstrapService.name);

  constructor(
    private readonly db: PostgresDatabase,
    private readonly reasons: AgendaReasonRepositoryPort,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const marker = await this.db.queryOne<{ value: string }>(
      'SELECT value FROM bootstrap_state WHERE key = $1',
      [MARKER],
    );

    if (marker !== null) {
      return;
    }

    if ((await this.reasons.count()) === 0) {
      for (const name of DEFAULT_REASONS) {
        await this.reasons.save(AgendaReason.create({ name }));
      }

      this.logger.log(`Seeded ${DEFAULT_REASONS.length} agenda reasons`);
    }

    await this.db.execute(
      `INSERT INTO bootstrap_state (key, value) VALUES ($1, '1')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [MARKER],
    );
  }
}
