import { Injectable } from '@nestjs/common';
import { PostgresDatabase, isUuid } from '../../../../../shared/infrastructure/database/postgres-database.js';
import { AppointmentRepositoryPort, type AppointmentRange } from '../../../application/ports/appointment-repository.port.js';
import { Appointment, type AppointmentStatus } from '../../../domain/appointment.entity.js';
import type {
  AppointmentConflict,
  AppointmentPatient,
  AppointmentProfessional,
  AppointmentView,
} from '../../../domain/appointment.models.js';
import { AppointmentNotFoundError } from '../../../domain/appointment.errors.js';

interface AppointmentRow {
  id: string;
  patient_id: string;
  professional_id: string;
  starts_at: Date;
  ends_at: Date;
  status: string;
  reason: string | null;
  notes: string | null;
  location: string | null;
  ics_sequence: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  patient_nombres: string;
  patient_apellido_paterno: string;
  patient_apellido_materno: string;
  patient_rut: string;
  patient_email: string | null;
  professional_name: string;
  professional_email: string;
}

const SELECT_VIEW = `
  SELECT
    a.*,
    p.nombres AS patient_nombres,
    p.apellido_paterno AS patient_apellido_paterno,
    p.apellido_materno AS patient_apellido_materno,
    p.rut AS patient_rut,
    p.email AS patient_email,
    u.name AS professional_name,
    u.email AS professional_email
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN users u ON u.id = a.professional_id
`;

@Injectable()
export class PostgresAppointmentRepository extends AppointmentRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async save(appointment: Appointment): Promise<void> {
    await this.db.execute(
      `INSERT INTO appointments (
         id, patient_id, professional_id, starts_at, ends_at, status,
         reason, notes, location, ics_sequence,
         created_by, updated_by, created_at, updated_at, cancelled_at, cancelled_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        appointment.id,
        appointment.patientId,
        appointment.professionalId,
        appointment.startsAt,
        appointment.endsAt,
        appointment.status,
        appointment.reason,
        appointment.notes,
        appointment.location,
        appointment.icsSequence,
        appointment.createdBy,
        appointment.updatedBy,
        appointment.createdAt,
        appointment.updatedAt,
        appointment.cancelledAt,
        appointment.cancelledBy,
      ],
    );
  }

  async update(appointment: Appointment): Promise<void> {
    const changed = await this.db.execute(
      `UPDATE appointments SET
         patient_id = $1, professional_id = $2, starts_at = $3, ends_at = $4,
         status = $5, reason = $6, notes = $7, location = $8, ics_sequence = $9,
         updated_by = $10, updated_at = $11, cancelled_at = $12, cancelled_by = $13
       WHERE id = $14`,
      [
        appointment.patientId,
        appointment.professionalId,
        appointment.startsAt,
        appointment.endsAt,
        appointment.status,
        appointment.reason,
        appointment.notes,
        appointment.location,
        appointment.icsSequence,
        appointment.updatedBy,
        appointment.updatedAt,
        appointment.cancelledAt,
        appointment.cancelledBy,
        appointment.id,
      ],
    );

    if (changed === 0) {
      throw new AppointmentNotFoundError(appointment.id);
    }
  }

  async findById(id: string): Promise<AppointmentView | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<AppointmentRow>(`${SELECT_VIEW} WHERE a.id = $1`, [id]);

    return row === null ? null : toView(row);
  }

  async findEntityById(id: string): Promise<Appointment | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<AppointmentRow>(`${SELECT_VIEW} WHERE a.id = $1`, [id]);

    return row === null ? null : toEntity(row);
  }

  async list(range: AppointmentRange): Promise<AppointmentView[]> {
    const conditions = ['a.starts_at >= $1', 'a.starts_at < $2'];
    const values: Array<string | Date> = [range.from, range.to];

    if (range.professionalId !== undefined) {
      values.push(range.professionalId);
      conditions.push(`a.professional_id = $${values.length}`);
    }

    if (range.patientId !== undefined) {
      values.push(range.patientId);
      conditions.push(`a.patient_id = $${values.length}`);
    }

    const rows = await this.db.query<AppointmentRow>(
      `${SELECT_VIEW} WHERE ${conditions.join(' AND ')} ORDER BY a.starts_at ASC, a.id ASC`,
      values,
    );

    return rows.map(toView);
  }

  async findConflicts(
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string | null,
  ): Promise<AppointmentConflict[]> {
    if (!isUuid(professionalId)) {
      return [];
    }

    const values: Array<string | Date> = [professionalId, startsAt, endsAt];
    let exclude = '';

    if (excludeId !== undefined && excludeId !== null) {
      values.push(excludeId);
      exclude = `AND a.id <> $${values.length}`;
    }

    const rows = await this.db.query<AppointmentRow>(
      `${SELECT_VIEW}
       WHERE a.professional_id = $1
         AND a.status = 'scheduled'
         AND a.starts_at < $3
         AND a.ends_at > $2
         ${exclude}
       ORDER BY a.starts_at ASC`,
      values,
    );

    return rows.map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      patientName: patientName(row),
      professionalName: row.professional_name,
    }));
  }

  async findPatient(id: string): Promise<AppointmentPatient | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<{
      id: string;
      nombres: string;
      apellido_paterno: string;
      apellido_materno: string;
      rut: string;
      email: string | null;
    }>(
      `SELECT id, nombres, apellido_paterno, apellido_materno, rut, email
       FROM patients WHERE id = $1`,
      [id],
    );

    return row === null
      ? null
      : {
          id: row.id,
          nombreCompleto: `${row.nombres} ${row.apellido_paterno} ${row.apellido_materno}`.trim(),
          rut: row.rut,
          email: row.email,
        };
  }

  async searchPatients(query: string): Promise<AppointmentPatient[]> {
    const term = `%${query.trim()}%`;
    const rows = await this.db.query<{
      id: string;
      nombres: string;
      apellido_paterno: string;
      apellido_materno: string;
      rut: string;
      email: string | null;
    }>(
      `SELECT id, nombres, apellido_paterno, apellido_materno, rut, email
       FROM patients
       WHERE $1 = '%%'
          OR nombres ILIKE $1
          OR apellido_paterno ILIKE $1
          OR apellido_materno ILIKE $1
          OR rut ILIKE $1
       ORDER BY apellido_paterno ASC, apellido_materno ASC, nombres ASC
       LIMIT 25`,
      [term],
    );

    return rows.map((row) => ({
      id: row.id,
      nombreCompleto: `${row.nombres} ${row.apellido_paterno} ${row.apellido_materno}`.trim(),
      rut: row.rut,
      email: row.email,
    }));
  }

  async findProfessional(id: string): Promise<AppointmentProfessional | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<{ id: string; name: string; email: string }>(
      `SELECT u.id, u.name, u.email
       FROM users u
       WHERE u.id = $2
         AND u.status = 'active'
         AND ${PROFESSIONAL_PERMISSION_SQL}`,
      ['agenda:professional', id],
    );

    return row ?? null;
  }

  async listProfessionals(): Promise<AppointmentProfessional[]> {
    return this.db.query<AppointmentProfessional>(
      `SELECT DISTINCT u.id, u.name, u.email
       FROM users u
       WHERE u.status = 'active'
         AND ${PROFESSIONAL_PERMISSION_SQL}
       ORDER BY u.name ASC`,
      ['agenda:professional'],
    );
  }
}

const PROFESSIONAL_PERMISSION_SQL = `
  (
    EXISTS (
      SELECT 1 FROM user_permissions up
      WHERE up.user_id = u.id AND up.permission_key = $1
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = u.id AND r.permissions ? $1
    )
  )
`;

function patientName(row: AppointmentRow): string {
  return `${row.patient_nombres} ${row.patient_apellido_paterno} ${row.patient_apellido_materno}`.trim();
}

function toView(row: AppointmentRow): AppointmentView {
  return {
    appointment: toEntity(row),
    patient: {
      id: row.patient_id,
      nombreCompleto: patientName(row),
      rut: row.patient_rut,
      email: row.patient_email,
    },
    professional: {
      id: row.professional_id,
      name: row.professional_name,
      email: row.professional_email,
    },
  };
}

function toEntity(row: AppointmentRow): Appointment {
  return Appointment.reconstitute(
    {
      patientId: row.patient_id,
      professionalId: row.professional_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status as AppointmentStatus,
      reason: row.reason,
      notes: row.notes,
      location: row.location,
      icsSequence: Number(row.ics_sequence),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cancelledAt: row.cancelled_at,
      cancelledBy: row.cancelled_by,
    },
    row.id,
  );
}
