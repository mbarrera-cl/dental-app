import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { PatientRepositoryPort } from '../../../application/ports/patient-repository.port.js';
import { ContactoEmergencia } from '../../../domain/contacto-emergencia.vo.js';
import { Direccion } from '../../../domain/direccion.vo.js';
import { Email } from '../../../domain/email.vo.js';
import { FechaNacimiento } from '../../../domain/fecha-nacimiento.vo.js';
import { formatNumeroHistoria } from '../../../domain/numero-historia.js';
import { Patient, type Sexo } from '../../../domain/patient.entity.js';
import {
  PatientAlreadyExistsError,
  PatientHasQuotesError,
  PatientNotFoundError,
} from '../../../domain/patient.errors.js';
import { Prevision } from '../../../domain/prevision.vo.js';
import { Rut } from '../../../../../shared/domain/rut.vo.js';
import { Telefono } from '../../../../../shared/domain/telefono.vo.js';

/** SQLite status code for a violated UNIQUE constraint (SQLITE_CONSTRAINT_UNIQUE). */
const SQLITE_CONSTRAINT_UNIQUE = 2067;

/** `bootstrap_state` marker holding the last assigned history-number sequence. */
const NUMERO_HISTORIA_SEQ_KEY = 'patients.numeroHistoriaSeq';

interface PatientRow {
  id: string;
  rut: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  fecha_nacimiento: string;
  sexo: string;
  email: string | null;
  telefono: string | null;
  direccion_region: string | null;
  direccion_comuna: string | null;
  direccion_calle: string | null;
  direccion_numero: string | null;
  direccion_departamento: string | null;
  prevision_tipo: string | null;
  prevision_tramo: string | null;
  prevision_plan: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_parentesco: string | null;
  notas: string | null;
  numero_historia: string | null;
  created_at: string;
}

/**
 * Driven adapter backed by SQLite. It maps rows ⇄ domain objects, translates
 * driver errors into domain errors, and keeps every SQL statement in this
 * file — use cases and entities never see SQL.
 *
 * The `patients` table is created by the shared schema (`ensureSchema`); the
 * RUT is enforced with a UNIQUE constraint, which is the durable guard
 * behind the use case's check-then-save flow.
 */
@Injectable()
export class SqlitePatientRepository extends PatientRepositoryPort {
  private readonly db: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super();
    this.db = database;
  }

  async save(patient: Patient): Promise<void> {
    try {
      this.db.connection
        .prepare(
          `INSERT INTO patients (
             id, rut, nombres, apellido_paterno, apellido_materno,
             fecha_nacimiento, sexo, email, telefono,
             direccion_region, direccion_comuna, direccion_calle, direccion_numero,
             direccion_departamento, prevision_tipo, prevision_tramo, prevision_plan,
             contacto_nombre, contacto_telefono, contacto_parentesco, notas,
             numero_historia, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          patient.id,
          ...this.toColumnValues(patient),
          patient.createdAt.toISOString(),
        );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PatientAlreadyExistsError(patient.rut);
      }

      throw error;
    }
  }

  async update(patient: Patient): Promise<void> {
    try {
      const result = this.db.connection
        .prepare(
          `UPDATE patients SET
             rut = ?, nombres = ?, apellido_paterno = ?, apellido_materno = ?,
             fecha_nacimiento = ?, sexo = ?, email = ?, telefono = ?,
             direccion_region = ?, direccion_comuna = ?, direccion_calle = ?,
             direccion_numero = ?, direccion_departamento = ?,
             prevision_tipo = ?, prevision_tramo = ?, prevision_plan = ?,
             contacto_nombre = ?, contacto_telefono = ?, contacto_parentesco = ?,
             notas = ?, numero_historia = ?
           WHERE id = ?`,
        )
        .run(...this.toColumnValues(patient), patient.id);

      if (result.changes === 0) {
        throw new PatientNotFoundError(patient.id);
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PatientAlreadyExistsError(patient.rut);
      }

      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = this.db.connection
        .prepare('DELETE FROM patients WHERE id = ?')
        .run(id);

      if (result.changes === 0) {
        throw new PatientNotFoundError(id);
      }
    } catch (error) {
      // The patient is referenced by quotations (`ON DELETE RESTRICT`): a
      // priced document must not disappear with the patient.
      if (isForeignKeyViolation(error)) {
        throw new PatientHasQuotesError(id);
      }

      throw error;
    }
  }

  async findById(id: string): Promise<Patient | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM patients WHERE id = ?')
      .get(id) as unknown as PatientRow | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async findByRut(rut: string): Promise<Patient | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM patients WHERE rut = ?')
      .get(rut) as unknown as PatientRow | undefined;

    return row === undefined ? null : this.toDomain(row);
  }

  async findAll(): Promise<Patient[]> {
    const rows = this.db.connection
      .prepare('SELECT * FROM patients ORDER BY rowid ASC')
      .all() as unknown as PatientRow[];

    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Reads/increments the sequence kept in `bootstrap_state` — the single
   * writer of that marker is this adapter, so the read-modify-write needs no
   * locking (`node:sqlite` is synchronous).
   */
  async nextNumeroHistoria(): Promise<string> {
    const row = this.db.connection
      .prepare('SELECT value FROM bootstrap_state WHERE key = ?')
      .get(NUMERO_HISTORIA_SEQ_KEY) as unknown as { value: string } | undefined;

    const parsed = row === undefined ? 0 : Number.parseInt(row.value, 10);
    const next = (Number.isNaN(parsed) ? 0 : parsed) + 1;

    this.db.connection
      .prepare('INSERT OR REPLACE INTO bootstrap_state (key, value) VALUES (?, ?)')
      .run(NUMERO_HISTORIA_SEQ_KEY, String(next));

    return formatNumeroHistoria(next);
  }

  async findWithoutNumeroHistoria(): Promise<Patient[]> {
    const rows = this.db.connection
      .prepare('SELECT * FROM patients WHERE numero_historia IS NULL ORDER BY rowid ASC')
      .all() as unknown as PatientRow[];

    return rows.map((row) => this.toDomain(row));
  }

  /** Patient column values in INSERT/UPDATE order (never `id`/`created_at`). */
  private toColumnValues(patient: Patient): Array<string | null> {
    const direccion = patient.direccion;
    const prevision = patient.prevision;
    const contacto = patient.contactoEmergencia;

    return [
      patient.rut,
      patient.nombres,
      patient.apellidoPaterno,
      patient.apellidoMaterno,
      patient.fechaNacimiento,
      patient.sexo,
      patient.email,
      patient.telefono,
      direccion?.region ?? null,
      direccion?.comuna ?? null,
      direccion?.calle ?? null,
      direccion?.numero ?? null,
      direccion?.departamento ?? null,
      prevision?.tipo ?? null,
      prevision?.tramo ?? null,
      prevision?.plan ?? null,
      contacto?.nombre ?? null,
      contacto?.telefono ?? null,
      contacto?.parentesco ?? null,
      patient.notas,
      patient.numeroHistoria,
    ];
  }

  private toDomain(row: PatientRow): Patient {
    return Patient.reconstitute(
      {
        rut: Rut.create(row.rut),
        nombres: row.nombres,
        apellidoPaterno: row.apellido_paterno,
        apellidoMaterno: row.apellido_materno,
        fechaNacimiento: FechaNacimiento.create(row.fecha_nacimiento),
        sexo: row.sexo as Sexo,
        email: row.email === null ? null : Email.create(row.email),
        telefono: row.telefono === null ? null : Telefono.create(row.telefono),
        direccion:
          row.direccion_region === null
            ? null
            : Direccion.create({
                region: row.direccion_region,
                comuna: row.direccion_comuna ?? '',
                calle: row.direccion_calle ?? '',
                numero: row.direccion_numero ?? '',
                departamento: row.direccion_departamento,
              }),
        prevision:
          row.prevision_tipo === null
            ? null
            : Prevision.create({
                tipo: row.prevision_tipo,
                tramo: row.prevision_tramo,
                plan: row.prevision_plan,
              }),
        contactoEmergencia:
          row.contacto_nombre === null
            ? null
            : ContactoEmergencia.create({
                nombre: row.contacto_nombre,
                telefono: row.contacto_telefono ?? '',
                parentesco: row.contacto_parentesco,
              }),
        notas: row.notas,
        numeroHistoria: row.numero_historia,
        createdAt: new Date(row.created_at),
      },
      row.id,
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    'errcode' in error &&
    (error as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE
  );
}

/** SQLite status code for a violated foreign key (SQLITE_CONSTRAINT_FOREIGNKEY). */
const SQLITE_CONSTRAINT_FOREIGNKEY = 787;

function isForeignKeyViolation(error: unknown): boolean {
  return (
    (error instanceof Error &&
      'errcode' in error &&
      (error as { errcode?: number }).errcode === SQLITE_CONSTRAINT_FOREIGNKEY) ||
    (error instanceof Error && error.message.includes('FOREIGN KEY constraint failed'))
  );
}