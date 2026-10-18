import { Injectable } from '@nestjs/common';
import {
  PostgresDatabase,
  isUniqueViolation,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
import { ConsentTemplateRepositoryPort } from '../../../application/ports/consent-template-repository.port.js';
import { ConsentTemplate } from '../../../domain/consent-template.entity.js';
import {
  ConsentTemplateAlreadyExistsError,
  ConsentTemplateNotFoundError,
} from '../../../domain/consent.errors.js';

interface ConsentTemplateRow {
  id: string;
  key: string;
  title: string;
  body: string;
  version: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PostgresConsentTemplateRepository extends ConsentTemplateRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async save(template: ConsentTemplate): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO consent_templates
           (id, key, title, body, version, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          template.id,
          template.key,
          template.title,
          template.body,
          template.version,
          template.active,
          template.createdAt,
          template.updatedAt,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConsentTemplateAlreadyExistsError(template.key);
      }

      throw error;
    }
  }

  async update(template: ConsentTemplate): Promise<void> {
    const changed = await this.db.execute(
      `UPDATE consent_templates SET
         title = $1, body = $2, version = $3, active = $4, updated_at = $5
       WHERE id = $6`,
      [
        template.title,
        template.body,
        template.version,
        template.active,
        template.updatedAt,
        template.id,
      ],
    );

    if (changed === 0) {
      throw new ConsentTemplateNotFoundError(template.id);
    }
  }

  async findByKey(key: string): Promise<ConsentTemplate | null> {
    if (key.trim() === '') {
      return null;
    }

    const row = await this.db.queryOne<ConsentTemplateRow>(
      'SELECT * FROM consent_templates WHERE key = $1',
      [key],
    );

    return row === null ? null : this.toDomain(row);
  }

  async findAll(includeInactive: boolean): Promise<ConsentTemplate[]> {
    const rows = await this.db.query<ConsentTemplateRow>(
      `SELECT * FROM consent_templates
       ${includeInactive ? '' : 'WHERE active = TRUE'}
       ORDER BY title ASC, key ASC`,
    );

    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: ConsentTemplateRow): ConsentTemplate {
    return ConsentTemplate.reconstitute(
      {
        key: row.key,
        title: row.title,
        body: row.body,
        version: row.version,
        active: row.active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      },
      row.id,
    );
  }
}
