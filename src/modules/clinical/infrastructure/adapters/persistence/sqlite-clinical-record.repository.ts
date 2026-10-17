import { Injectable } from '@nestjs/common';
import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { ClinicalRecordRepositoryPort } from '../../../application/ports/clinical-record-repository.port.js';
import { Antecedentes } from '../../../domain/antecedentes.vo.js';
import { createCategoriaEtaria } from '../../../domain/categoria-etaria.js';
import { ClinicalEvent, type ClinicalEventAction } from '../../../domain/clinical-event.entity.js';
import {
  ClinicalFindingNotFoundError,
  ClinicalRecordAlreadyExistsError,
  ClinicalRecordNotFoundError,
} from '../../../domain/clinical.errors.js';
import { ExamenEstomatognatico } from '../../../domain/examen-estomatognatico.vo.js';
import {
  FichaClinica,
  type ClinicalRecordStatus,
} from '../../../domain/ficha-clinica.entity.js';
import {
  Finding,
  type FindingState,
  type FindingSymbol,
  type Surface,
} from '../../../domain/finding.entity.js';
import { IndicadoresSaludBucal } from '../../../domain/indicadores.vo.js';
import { SignosVitales } from '../../../domain/signos-vitales.vo.js';

/** SQLite status code for a violated UNIQUE constraint (SQLITE_CONSTRAINT_UNIQUE). */
const SQLITE_CONSTRAINT_UNIQUE = 2067;

interface ClinicalRecordRow {
  id: string;
  patient_id: string;
  categoria: string;
  embarazada: number;
  motivo_consulta: string | null;
  enfermedad_actual: string | null;
  antecedentes: string;
  signos_vitales: string;
  examen_estomatognatico: string;
  indicadores: string;
  status: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  finalized_by: string | null;
}

interface FindingRow {
  id: string;
  record_id: string;
  tooth: number;
  surfaces: string;
  symbol: string;
  state: string;
  recesion: number | null;
  movilidad: number | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
}

interface ClinicalEventRow {
  id: string;
  patient_id: string;
  record_id: string;
  actor_id: string | null;
  action: string;
  summary: string | null;
  payload: string | null;
  created_at: string;
}

/**
 * Driven adapter: ficha sections as columns (JSON for the composite value
 * objects), the odontogram as an append-only findings log and the timeline as
 * `clinical_events`. `one record per patient` is enforced by a UNIQUE
 * constraint, which is the durable guard the use case relies on.
 */
@Injectable()
export class SqliteClinicalRecordRepository extends ClinicalRecordRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {
    super();
  }

  async save(record: FichaClinica): Promise<void> {
    try {
      this.db.connection
        .prepare(
          `INSERT INTO clinical_records (
             id, patient_id, categoria, embarazada,
             motivo_consulta, enfermedad_actual,
             antecedentes, signos_vitales, examen_estomatognatico, indicadores,
             status, created_by, updated_by, created_at, updated_at,
             finalized_at, finalized_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          record.id,
          record.patientId,
          record.categoria,
          record.embarazada ? 1 : 0,
          record.motivoConsulta,
          record.enfermedadActual,
          JSON.stringify(record.antecedentes.toJSON()),
          JSON.stringify(record.signosVitales.toJSON()),
          JSON.stringify(record.examenEstomatognatico.toJSON()),
          JSON.stringify(record.indicadores.toJSON()),
          record.status,
          record.createdBy,
          record.updatedBy,
          record.createdAt.toISOString(),
          record.updatedAt.toISOString(),
          record.finalizedAt?.toISOString() ?? null,
          record.finalizedBy,
        );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ClinicalRecordAlreadyExistsError(record.patientId);
      }

      throw error;
    }
  }

  async update(record: FichaClinica): Promise<void> {
    const result = this.db.connection
      .prepare(
        `UPDATE clinical_records SET
           categoria = ?, embarazada = ?,
           motivo_consulta = ?, enfermedad_actual = ?,
           antecedentes = ?, signos_vitales = ?,
           examen_estomatognatico = ?, indicadores = ?,
           status = ?, updated_by = ?, updated_at = ?,
           finalized_at = ?, finalized_by = ?
         WHERE id = ?`,
      )
      .run(
        record.categoria,
        record.embarazada ? 1 : 0,
        record.motivoConsulta,
        record.enfermedadActual,
        JSON.stringify(record.antecedentes.toJSON()),
        JSON.stringify(record.signosVitales.toJSON()),
        JSON.stringify(record.examenEstomatognatico.toJSON()),
        JSON.stringify(record.indicadores.toJSON()),
        record.status,
        record.updatedBy,
        record.updatedAt.toISOString(),
        record.finalizedAt?.toISOString() ?? null,
        record.finalizedBy,
        record.id,
      );

    if (result.changes === 0) {
      throw new ClinicalRecordNotFoundError(record.id);
    }
  }

  async findById(id: string): Promise<FichaClinica | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM clinical_records WHERE id = ?')
      .get(id) as unknown as ClinicalRecordRow | undefined;

    return row === undefined ? null : this.toDomainRecord(row);
  }

  async findByPatientId(patientId: string): Promise<FichaClinica | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM clinical_records WHERE patient_id = ?')
      .get(patientId) as unknown as ClinicalRecordRow | undefined;

    return row === undefined ? null : this.toDomainRecord(row);
  }

  async saveFinding(finding: Finding): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO clinical_findings (
           id, record_id, tooth, surfaces, symbol, state,
           recesion, movilidad, note, created_by, created_at,
           voided_at, voided_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        finding.id,
        finding.recordId,
        finding.tooth,
        JSON.stringify(finding.surfaces),
        finding.symbol,
        finding.state,
        finding.recesion,
        finding.movilidad,
        finding.note,
        finding.createdBy,
        finding.createdAt.toISOString(),
        finding.voidedAt?.toISOString() ?? null,
        finding.voidedBy,
      );
  }

  async updateFinding(finding: Finding): Promise<void> {
    const result = this.db.connection
      .prepare(
        `UPDATE clinical_findings SET
           surfaces = ?, symbol = ?, state = ?,
           recesion = ?, movilidad = ?, note = ?,
           voided_at = ?, voided_by = ?
         WHERE id = ?`,
      )
      .run(
        JSON.stringify(finding.surfaces),
        finding.symbol,
        finding.state,
        finding.recesion,
        finding.movilidad,
        finding.note,
        finding.voidedAt?.toISOString() ?? null,
        finding.voidedBy,
        finding.id,
      );

    if (result.changes === 0) {
      throw new ClinicalFindingNotFoundError(finding.id);
    }
  }

  async findFinding(id: string): Promise<Finding | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM clinical_findings WHERE id = ?')
      .get(id) as unknown as FindingRow | undefined;

    return row === undefined ? null : toDomainFinding(row);
  }

  async listFindings(recordId: string): Promise<Finding[]> {
    // `rowid` keeps insertion order even when two findings share a millisecond.
    const rows = this.db.connection
      .prepare('SELECT * FROM clinical_findings WHERE record_id = ? ORDER BY rowid ASC')
      .all(recordId) as unknown as FindingRow[];

    return rows.map((row) => toDomainFinding(row));
  }

  async appendEvent(event: ClinicalEvent): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO clinical_events (
           id, patient_id, record_id, actor_id,
           action, summary, payload, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.patientId,
        event.recordId,
        event.actorId,
        event.action,
        event.summary,
        event.payload === null ? null : JSON.stringify(event.payload),
        event.createdAt.toISOString(),
      );
  }

  async listEvents(recordId: string): Promise<ClinicalEvent[]> {
    const rows = this.db.connection
      .prepare('SELECT * FROM clinical_events WHERE record_id = ? ORDER BY rowid DESC')
      .all(recordId) as unknown as ClinicalEventRow[];

    return rows.map((row) => ClinicalEvent.reconstitute(
      {
        patientId: row.patient_id,
        recordId: row.record_id,
        actorId: row.actor_id,
        action: row.action as ClinicalEventAction,
        summary: row.summary,
        payload: row.payload === null ? null : (JSON.parse(row.payload) as Record<string, unknown>),
        createdAt: new Date(row.created_at),
      },
      row.id,
    ));
  }

  private toDomainRecord(row: ClinicalRecordRow): FichaClinica {
    return FichaClinica.reconstitute(
      {
        patientId: row.patient_id,
        categoria: createCategoriaEtaria(row.categoria),
        embarazada: row.embarazada === 1,
        motivoConsulta: row.motivo_consulta,
        enfermedadActual: row.enfermedad_actual,
        antecedentes: Antecedentes.create(
          JSON.parse(row.antecedentes) as Parameters<typeof Antecedentes.create>[0],
        ),
        signosVitales: SignosVitales.create(
          JSON.parse(row.signos_vitales) as Parameters<typeof SignosVitales.create>[0],
        ),
        examenEstomatognatico: ExamenEstomatognatico.create(
          JSON.parse(row.examen_estomatognatico) as Parameters<
            typeof ExamenEstomatognatico.create
          >[0],
        ),
        indicadores: IndicadoresSaludBucal.create(
          JSON.parse(row.indicadores) as Parameters<typeof IndicadoresSaludBucal.create>[0],
        ),
        status: row.status as ClinicalRecordStatus,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        finalizedAt: row.finalized_at === null ? null : new Date(row.finalized_at),
        finalizedBy: row.finalized_by,
      },
      row.id,
    );
  }
}

function toDomainFinding(row: FindingRow): Finding {
  return Finding.reconstitute(
    {
      recordId: row.record_id,
      tooth: row.tooth,
      surfaces: (JSON.parse(row.surfaces) as Surface[]),
      symbol: row.symbol as FindingSymbol,
      state: row.state as FindingState,
      recesion: row.recesion,
      movilidad: row.movilidad,
      note: row.note,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      voidedAt: row.voided_at === null ? null : new Date(row.voided_at),
      voidedBy: row.voided_by,
    },
    row.id,
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    'errcode' in error &&
    (error as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE
  );
}
