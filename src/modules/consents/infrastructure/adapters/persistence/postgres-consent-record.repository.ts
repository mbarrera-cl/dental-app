import { Injectable } from '@nestjs/common';
import {
  PostgresDatabase,
  isUuid,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
import { ConsentRecordRepositoryPort } from '../../../application/ports/consent-record-repository.port.js';
import { ConsentRecord } from '../../../domain/consent-record.entity.js';

interface ConsentRecordRow {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_rut: string;
  template_id: string | null;
  template_key: string;
  template_version: number;
  title: string;
  body: string;
  procedure: string | null;
  acceptor_name: string;
  accepted_at: Date;
  recorded_by: string | null;
  created_at: Date;
}

@Injectable()
export class PostgresConsentRecordRepository extends ConsentRecordRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async append(record: ConsentRecord): Promise<void> {
    await this.db.execute(
      `INSERT INTO consent_records
         (id, patient_id, patient_name, patient_rut, template_id, template_key,
          template_version, title, body, procedure, acceptor_name, accepted_at,
          recorded_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        record.id,
        record.patientId,
        record.patientName,
        record.patientRut,
        record.templateId,
        record.templateKey,
        record.templateVersion,
        record.title,
        record.body,
        record.procedure,
        record.acceptorName,
        record.acceptedAt,
        record.recordedBy,
        record.createdAt,
      ],
    );
  }

  async findById(id: string): Promise<ConsentRecord | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<ConsentRecordRow>(
      'SELECT * FROM consent_records WHERE id = $1',
      [id],
    );

    return row === null ? null : this.toDomain(row);
  }

  async listByPatient(
    patientId: string,
    limit: number,
    offset: number,
  ): Promise<ConsentRecord[]> {
    if (!isUuid(patientId)) {
      return [];
    }

    const rows = await this.db.query<ConsentRecordRow>(
      `SELECT * FROM consent_records
        WHERE patient_id = $1
        ORDER BY accepted_at DESC, id DESC
        LIMIT $2 OFFSET $3`,
      [patientId, limit, offset],
    );

    return rows.map((row) => this.toDomain(row));
  }

  async countByPatient(patientId: string): Promise<number> {
    if (!isUuid(patientId)) {
      return 0;
    }

    const [row] = await this.db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM consent_records WHERE patient_id = $1',
      [patientId],
    );

    return Number(row?.count ?? 0);
  }

  private toDomain(row: ConsentRecordRow): ConsentRecord {
    return ConsentRecord.reconstitute(
      {
        patientId: row.patient_id,
        patientName: row.patient_name,
        patientRut: row.patient_rut,
        templateId: row.template_id,
        templateKey: row.template_key,
        templateVersion: row.template_version,
        title: row.title,
        body: row.body,
        procedure: row.procedure,
        acceptorName: row.acceptor_name,
        acceptedAt: new Date(row.accepted_at),
        recordedBy: row.recorded_by,
        createdAt: new Date(row.created_at),
      },
      row.id,
    );
  }
}
