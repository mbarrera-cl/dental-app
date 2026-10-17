import { Injectable } from '@nestjs/common';
import {
  PostgresDatabase,
  isForeignKeyViolation,
  isUniqueViolation,
  isUuid,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
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
  created_at: Date;
}

@Injectable()
export class PostgresPatientRepository extends PatientRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async save(patient: Patient): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO patients (
           id, rut, nombres, apellido_paterno, apellido_materno,
           fecha_nacimiento, sexo, email, telefono,
           direccion_region, direccion_comuna, direccion_calle, direccion_numero,
           direccion_departamento, prevision_tipo, prevision_tramo, prevision_plan,
           contacto_nombre, contacto_telefono, contacto_parentesco, notas,
           numero_historia, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                   $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
        [patient.id, ...this.toColumnValues(patient), patient.createdAt],
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
      const changed = await this.db.execute(
        `UPDATE patients SET
           rut = $1, nombres = $2, apellido_paterno = $3, apellido_materno = $4,
           fecha_nacimiento = $5, sexo = $6, email = $7, telefono = $8,
           direccion_region = $9, direccion_comuna = $10, direccion_calle = $11,
           direccion_numero = $12, direccion_departamento = $13,
           prevision_tipo = $14, prevision_tramo = $15, prevision_plan = $16,
           contacto_nombre = $17, contacto_telefono = $18, contacto_parentesco = $19,
           notas = $20, numero_historia = $21
         WHERE id = $22`,
        [...this.toColumnValues(patient), patient.id],
      );

      if (changed === 0) {
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
    if (!isUuid(id)) {
      throw new PatientNotFoundError(id);
    }

    try {
      const changed = await this.db.execute('DELETE FROM patients WHERE id = $1', [id]);

      if (changed === 0) {
        throw new PatientNotFoundError(id);
      }
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new PatientHasQuotesError(id);
      }

      throw error;
    }
  }

  async findById(id: string): Promise<Patient | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<PatientRow>('SELECT * FROM patients WHERE id = $1', [id]);
    return row === null ? null : this.toDomain(row);
  }

  async findByRut(rut: string): Promise<Patient | null> {
    const row = await this.db.queryOne<PatientRow>('SELECT * FROM patients WHERE rut = $1', [rut]);
    return row === null ? null : this.toDomain(row);
  }

  async findAll(): Promise<Patient[]> {
    const rows = await this.db.query<PatientRow>(
      'SELECT * FROM patients ORDER BY created_at ASC, id ASC',
    );

    return rows.map((row) => this.toDomain(row));
  }

  async nextNumeroHistoria(): Promise<string> {
    const row = await this.db.queryOne<{ value: string }>(
      `INSERT INTO bootstrap_state (key, value)
       VALUES ($1, '1')
       ON CONFLICT (key) DO UPDATE
         SET value = (COALESCE(NULLIF(bootstrap_state.value, '')::integer, 0) + 1)::text
       RETURNING value`,
      [NUMERO_HISTORIA_SEQ_KEY],
    );

    return formatNumeroHistoria(Number(row?.value ?? 1));
  }

  async findWithoutNumeroHistoria(): Promise<Patient[]> {
    const rows = await this.db.query<PatientRow>(
      'SELECT * FROM patients WHERE numero_historia IS NULL ORDER BY created_at ASC, id ASC',
    );

    return rows.map((row) => this.toDomain(row));
  }

  private toColumnValues(patient: Patient): Array<string | Date | null> {
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
