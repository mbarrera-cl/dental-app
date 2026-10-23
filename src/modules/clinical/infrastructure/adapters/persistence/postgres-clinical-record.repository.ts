import { Injectable } from '@nestjs/common';
import {
  PostgresDatabase,
  isUniqueViolation,
  isUuid,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
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

interface ClinicalRecordRow {
  id: string;
  patient_id: string;
  categoria: string;
  embarazada: boolean;
  motivo_consulta: string | null;
  enfermedad_actual: string | null;
  antecedentes: Record<string, unknown>;
  signos_vitales: Record<string, unknown>;
  examen_estomatognatico: Record<string, unknown>;
  indicadores: Record<string, unknown>;
  status: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  finalized_at: Date | null;
  finalized_by: string | null;
  integrity_hash: string | null;
}

interface FindingRow {
  id: string;
  record_id: string;
  tooth: number;
  surfaces: Surface[];
  symbol: string;
  state: string;
  recesion: number | null;
  movilidad: number | null;
  note: string | null;
  created_by: string | null;
  created_at: Date;
  voided_at: Date | null;
  voided_by: string | null;
}

interface ClinicalEventRow {
  id: string;
  patient_id: string;
  record_id: string;
  actor_id: string | null;
  action: string;
  summary: string | null;
  payload: Record<string, unknown> | null;
  created_at: Date;
}

@Injectable()
export class PostgresClinicalRecordRepository extends ClinicalRecordRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async save(record: FichaClinica): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO clinical_records (
           id, patient_id, categoria, embarazada,
           motivo_consulta, enfermedad_actual,
           antecedentes, signos_vitales, examen_estomatognatico, indicadores,
           status, created_by, updated_by, created_at, updated_at,
           finalized_at, finalized_by, integrity_hash
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb,
                   $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          record.id,
          record.patientId,
          record.categoria,
          record.embarazada,
          record.motivoConsulta,
          record.enfermedadActual,
          JSON.stringify(record.antecedentes.toJSON()),
          JSON.stringify(record.signosVitales.toJSON()),
          JSON.stringify(record.examenEstomatognatico.toJSON()),
          JSON.stringify(record.indicadores.toJSON()),
          record.status,
          record.createdBy,
          record.updatedBy,
          record.createdAt,
          record.updatedAt,
          record.finalizedAt,
          record.finalizedBy,
          record.integrityHash,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ClinicalRecordAlreadyExistsError(record.patientId);
      }

      throw error;
    }
  }

  async update(record: FichaClinica): Promise<void> {
    const changed = await this.db.execute(
      `UPDATE clinical_records SET
         categoria = $1, embarazada = $2,
         motivo_consulta = $3, enfermedad_actual = $4,
         antecedentes = $5::jsonb, signos_vitales = $6::jsonb,
         examen_estomatognatico = $7::jsonb, indicadores = $8::jsonb,
         status = $9, updated_by = $10, updated_at = $11,
         finalized_at = $12, finalized_by = $13, integrity_hash = $14
       WHERE id = $15`,
      [
        record.categoria,
        record.embarazada,
        record.motivoConsulta,
        record.enfermedadActual,
        JSON.stringify(record.antecedentes.toJSON()),
        JSON.stringify(record.signosVitales.toJSON()),
        JSON.stringify(record.examenEstomatognatico.toJSON()),
        JSON.stringify(record.indicadores.toJSON()),
        record.status,
        record.updatedBy,
        record.updatedAt,
        record.finalizedAt,
        record.finalizedBy,
        record.integrityHash,
        record.id,
      ],
    );

    if (changed === 0) {
      throw new ClinicalRecordNotFoundError(record.id);
    }
  }

  async findById(id: string): Promise<FichaClinica | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<ClinicalRecordRow>(
      'SELECT * FROM clinical_records WHERE id = $1',
      [id],
    );

    return row === null ? null : this.toDomainRecord(row);
  }

  async findByPatientId(patientId: string): Promise<FichaClinica | null> {
    if (!isUuid(patientId)) {
      return null;
    }

    const row = await this.db.queryOne<ClinicalRecordRow>(
      'SELECT * FROM clinical_records WHERE patient_id = $1',
      [patientId],
    );

    return row === null ? null : this.toDomainRecord(row);
  }

  async saveFinding(finding: Finding): Promise<void> {
    await this.db.execute(
      `INSERT INTO clinical_findings (
         id, record_id, tooth, surfaces, symbol, state,
         recesion, movilidad, note, created_by, created_at,
         voided_at, voided_by
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
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
        finding.createdAt,
        finding.voidedAt,
        finding.voidedBy,
      ],
    );
  }

  async updateFinding(finding: Finding): Promise<void> {
    const changed = await this.db.execute(
      `UPDATE clinical_findings SET
         surfaces = $1::jsonb, symbol = $2, state = $3,
         recesion = $4, movilidad = $5, note = $6,
         voided_at = $7, voided_by = $8
       WHERE id = $9`,
      [
        JSON.stringify(finding.surfaces),
        finding.symbol,
        finding.state,
        finding.recesion,
        finding.movilidad,
        finding.note,
        finding.voidedAt,
        finding.voidedBy,
        finding.id,
      ],
    );

    if (changed === 0) {
      throw new ClinicalFindingNotFoundError(finding.id);
    }
  }

  async findFinding(id: string): Promise<Finding | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<FindingRow>(
      'SELECT * FROM clinical_findings WHERE id = $1',
      [id],
    );

    return row === null ? null : toDomainFinding(row);
  }

  async listFindings(recordId: string): Promise<Finding[]> {
    if (!isUuid(recordId)) {
      return [];
    }

    const rows = await this.db.query<FindingRow>(
      'SELECT * FROM clinical_findings WHERE record_id = $1 ORDER BY created_at ASC, id ASC',
      [recordId],
    );

    return rows.map((row) => toDomainFinding(row));
  }

  async appendEvent(event: ClinicalEvent): Promise<void> {
    await this.db.execute(
      `INSERT INTO clinical_events (
         id, patient_id, record_id, actor_id,
         action, summary, payload, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        event.id,
        event.patientId,
        event.recordId,
        event.actorId,
        event.action,
        event.summary,
        event.payload === null ? null : JSON.stringify(event.payload),
        event.createdAt,
      ],
    );
  }

  async listEvents(recordId: string): Promise<ClinicalEvent[]> {
    if (!isUuid(recordId)) {
      return [];
    }

    const rows = await this.db.query<ClinicalEventRow>(
      'SELECT * FROM clinical_events WHERE record_id = $1 ORDER BY created_at DESC, id DESC',
      [recordId],
    );

    return rows.map((row) =>
      ClinicalEvent.reconstitute(
        {
          patientId: row.patient_id,
          recordId: row.record_id,
          actorId: row.actor_id,
          action: row.action as ClinicalEventAction,
          summary: row.summary,
          payload: row.payload,
          createdAt: new Date(row.created_at),
        },
        row.id,
      ),
    );
  }

  private toDomainRecord(row: ClinicalRecordRow): FichaClinica {
    return FichaClinica.reconstitute(
      {
        patientId: row.patient_id,
        categoria: createCategoriaEtaria(row.categoria),
        embarazada: row.embarazada,
        motivoConsulta: row.motivo_consulta,
        enfermedadActual: row.enfermedad_actual,
        antecedentes: Antecedentes.create(
          row.antecedentes as Parameters<typeof Antecedentes.create>[0],
        ),
        signosVitales: SignosVitales.create(
          row.signos_vitales as Parameters<typeof SignosVitales.create>[0],
        ),
        examenEstomatognatico: ExamenEstomatognatico.create(
          row.examen_estomatognatico as Parameters<typeof ExamenEstomatognatico.create>[0],
        ),
        indicadores: IndicadoresSaludBucal.create(
          row.indicadores as Parameters<typeof IndicadoresSaludBucal.create>[0],
        ),
        status: row.status as ClinicalRecordStatus,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        finalizedAt: row.finalized_at === null ? null : new Date(row.finalized_at),
        finalizedBy: row.finalized_by,
        integrityHash: row.integrity_hash,
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
      surfaces: Array.isArray(row.surfaces) ? row.surfaces : [],
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
