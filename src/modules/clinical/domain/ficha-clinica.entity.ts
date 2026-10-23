import { Entity } from '../../../shared/domain/entity.js';
import { Antecedentes } from './antecedentes.vo.js';
import { createCategoriaEtaria, type CategoriaEtaria } from './categoria-etaria.js';
import {
  ClinicalRecordLockedError,
  InvalidFichaClinicaError,
} from './clinical.errors.js';
import { ExamenEstomatognatico } from './examen-estomatognatico.vo.js';
import { IndicadoresSaludBucal } from './indicadores.vo.js';
import { SignosVitales } from './signos-vitales.vo.js';

export const CLINICAL_RECORD_STATUSES = ['borrador', 'finalizada'] as const;
export type ClinicalRecordStatus = (typeof CLINICAL_RECORD_STATUSES)[number];

export interface FichaClinicaProps {
  patientId: string;
  categoria: CategoriaEtaria;
  embarazada: boolean;
  motivoConsulta: string | null;
  enfermedadActual: string | null;
  antecedentes: Antecedentes;
  signosVitales: SignosVitales;
  examenEstomatognatico: ExamenEstomatognatico;
  indicadores: IndicadoresSaludBucal;
  status: ClinicalRecordStatus;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  finalizedAt: Date | null;
  finalizedBy: string | null;
  integrityHash: string | null;
}

export interface CreateFichaClinicaProps {
  patientId: string;
  categoria: string;
  embarazada?: boolean;
  createdBy: string | null;
}

const MAX_MOTIVO_CONSULTA_LENGTH = 1000;
const MAX_ENFERMEDAD_ACTUAL_LENGTH = 4000;

/**
 * Dental clinical record (ficha clínica) aggregate root: the HCU-form
 * sections plus the audit trail. Odontogram findings live in their own
 * append-only log (`Finding`), keyed by `recordId`.
 *
 * Once finalized the record is locked: mutators reject edits until a future
 * re-open flow exists.
 */
export class FichaClinica extends Entity<FichaClinicaProps> {
  private constructor(props: FichaClinicaProps, id?: string) {
    super(props, id);
  }

  static create({
    patientId,
    categoria,
    embarazada = false,
    createdBy,
  }: CreateFichaClinicaProps): FichaClinica {
    const now = new Date();

    return new FichaClinica({
      patientId: requireText(patientId, 'patientId'),
      categoria: createCategoriaEtaria(categoria),
      embarazada,
      motivoConsulta: null,
      enfermedadActual: null,
      antecedentes: Antecedentes.create(null),
      signosVitales: SignosVitales.create(),
      examenEstomatognatico: ExamenEstomatognatico.create(),
      indicadores: IndicadoresSaludBucal.create(),
      status: 'borrador',
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
      finalizedAt: null,
      finalizedBy: null,
      integrityHash: null,
    });
  }

  static reconstitute(props: FichaClinicaProps, id: string): FichaClinica {
    return new FichaClinica(props, id);
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get categoria(): CategoriaEtaria {
    return this.props.categoria;
  }

  get embarazada(): boolean {
    return this.props.embarazada;
  }

  get motivoConsulta(): string | null {
    return this.props.motivoConsulta;
  }

  get enfermedadActual(): string | null {
    return this.props.enfermedadActual;
  }

  get antecedentes(): Antecedentes {
    return this.props.antecedentes;
  }

  get signosVitales(): SignosVitales {
    return this.props.signosVitales;
  }

  get examenEstomatognatico(): ExamenEstomatognatico {
    return this.props.examenEstomatognatico;
  }

  get indicadores(): IndicadoresSaludBucal {
    return this.props.indicadores;
  }

  get status(): ClinicalRecordStatus {
    return this.props.status;
  }

  get createdBy(): string | null {
    return this.props.createdBy;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get finalizedAt(): Date | null {
    return this.props.finalizedAt;
  }

  get finalizedBy(): string | null {
    return this.props.finalizedBy;
  }

  get integrityHash(): string | null {
    return this.props.integrityHash;
  }

  get isDraft(): boolean {
    return this.props.status === 'borrador';
  }

  changeCategoria(value: string): void {
    this.assertEditable();
    this.props.categoria = createCategoriaEtaria(value);
  }

  changeEmbarazada(embarazada: boolean): void {
    this.assertEditable();
    this.props.embarazada = embarazada;
  }

  changeMotivoConsulta(value: string | null): void {
    this.assertEditable();
    this.props.motivoConsulta = normalizeText(
      value,
      'motivoConsulta',
      MAX_MOTIVO_CONSULTA_LENGTH,
    );
  }

  changeEnfermedadActual(value: string | null): void {
    this.assertEditable();
    this.props.enfermedadActual = normalizeText(
      value,
      'enfermedadActual',
      MAX_ENFERMEDAD_ACTUAL_LENGTH,
    );
  }

  changeAntecedentes(antecedentes: Antecedentes): void {
    this.assertEditable();
    this.props.antecedentes = antecedentes;
  }

  changeSignosVitales(signosVitales: SignosVitales): void {
    this.assertEditable();
    this.props.signosVitales = signosVitales;
  }

  changeExamenEstomatognatico(examen: ExamenEstomatognatico): void {
    this.assertEditable();
    this.props.examenEstomatognatico = examen;
  }

  changeIndicadores(indicadores: IndicadoresSaludBucal): void {
    this.assertEditable();
    this.props.indicadores = indicadores;
  }

  /** Records who touched the record and when (audit). */
  touch(actorId: string | null, when: Date = new Date()): void {
    this.props.updatedBy = actorId;
    this.props.updatedAt = when;
  }

  /**
   * Locks the record and seals it with an integrity hash (SHA-256 over a
   * canonical serialization of the record and its non-voided findings). Once
   * finalized the record is immutable: every mutator rejects with
   * `ClinicalRecordLockedError`.
   */
  finalize(actorId: string | null, integrityHash: string, when: Date = new Date()): void {
    this.assertEditable();

    this.props.status = 'finalizada';
    this.props.finalizedAt = when;
    this.props.finalizedBy = actorId;
    this.props.integrityHash = integrityHash;
    this.touch(actorId, when);
  }

  private assertEditable(): void {
    if (!this.isDraft) {
      throw new ClinicalRecordLockedError(this.id);
    }
  }
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new InvalidFichaClinicaError(`"${field}" must not be empty`);
  }

  return trimmed;
}

function normalizeText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new InvalidFichaClinicaError(`"${field}" must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new InvalidFichaClinicaError(
      `"${field}" must have at most ${maxLength} characters`,
    );
  }

  return trimmed.length === 0 ? null : trimmed;
}
