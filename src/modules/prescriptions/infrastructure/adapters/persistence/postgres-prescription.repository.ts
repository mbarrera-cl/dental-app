import { Injectable } from '@nestjs/common';
import {
  PostgresDatabase,
  isUuid,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
import { PrescriptionRepositoryPort } from '../../../application/ports/prescription-repository.port.js';
import {
  Prescription,
  PrescriptionItem,
  type PrescriptionItemInput,
} from '../../../domain/prescription.entity.js';

interface PrescriptionRow {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_rut: string;
  items: unknown;
  indicaciones: string | null;
  issued_by: string | null;
  issued_by_name: string;
  issued_at: Date;
  created_at: Date;
}

@Injectable()
export class PostgresPrescriptionRepository extends PrescriptionRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async save(prescription: Prescription): Promise<void> {
    await this.db.execute(
      `INSERT INTO prescriptions
         (id, patient_id, patient_name, patient_rut, items, indicaciones,
          issued_by, issued_by_name, issued_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        prescription.id,
        prescription.patientId,
        prescription.patientName,
        prescription.patientRut,
        JSON.stringify(prescription.items.map((item) => item.toJSON())),
        prescription.indicaciones,
        prescription.issuedBy,
        prescription.issuedByName,
        prescription.issuedAt,
        prescription.createdAt,
      ],
    );
  }

  async findById(id: string): Promise<Prescription | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<PrescriptionRow>(
      'SELECT * FROM prescriptions WHERE id = $1',
      [id],
    );

    return row === null ? null : this.toDomain(row);
  }

  async listByPatient(
    patientId: string,
    limit: number,
    offset: number,
  ): Promise<Prescription[]> {
    if (!isUuid(patientId)) {
      return [];
    }

    const rows = await this.db.query<PrescriptionRow>(
      `SELECT * FROM prescriptions
        WHERE patient_id = $1
        ORDER BY issued_at DESC, id DESC
        LIMIT $2 OFFSET $3`,
      [patientId, limit, offset],
    );

    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: PrescriptionRow): Prescription {
    return Prescription.reconstitute(
      {
        patientId: row.patient_id,
        patientName: row.patient_name,
        patientRut: row.patient_rut,
        items: parseItems(row.items).map((item) => PrescriptionItem.create(item)),
        indicaciones: row.indicaciones,
        issuedBy: row.issued_by,
        issuedByName: row.issued_by_name,
        issuedAt: new Date(row.issued_at),
        createdAt: new Date(row.created_at),
      },
      row.id,
    );
  }
}

function parseItems(value: unknown): PrescriptionItemInput[] {
  const raw = typeof value === 'string' ? JSON.parse(value) : value;

  return Array.isArray(raw) ? (raw as PrescriptionItemInput[]) : [];
}
