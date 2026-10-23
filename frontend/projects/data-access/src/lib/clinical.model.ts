/**
 * Domain model of the dental clinical record (ficha clínica, HCU-form.033).
 *
 * Mirrors the backend `clinical` module: the constants and validation rules
 * are duplicated on purpose so the UI preselects, validates and renders
 * exactly what the server accepts (the server remains the source of truth).
 */

/**
 * Age/condition ranges of the HCU form. `5-14-no-programado` is a manual
 * condition: "programado / no programado" describes the appointment, not the
 * patient's age, so it is never suggested automatically.
 */
export const CATEGORIAS_ETARIAS = [
  'menor-1',
  '1-4',
  '5-9-programado',
  '5-14-no-programado',
  '10-14-programado',
  '15-19',
  'mayor-20',
] as const;

export type CategoriaEtaria = (typeof CATEGORIAS_ETARIAS)[number];

export type ClinicalRecordStatus = 'borrador' | 'finalizada';

/** The ten personal/family history items of the HCU dental form. */
export const ANTECEDENTES = [
  'alergia-antibiotico',
  'alergia-anestesia',
  'hemorragias',
  'vih-sida',
  'tuberculosis',
  'asma',
  'diabetes',
  'hipertension',
  'enfermedad-cardiaca',
  'otro',
] as const;

export type AntecedenteKey = (typeof ANTECEDENTES)[number];

export interface AntecedenteEntry {
  present: boolean;
  notes: string | null;
}

export type AntecedentesRecord = Record<AntecedenteKey, AntecedenteEntry>;

export interface AntecedenteInput {
  present?: boolean;
  notes?: string | null;
}

export type AntecedentesInput = Partial<Record<AntecedenteKey, AntecedenteInput>>;

export interface SignosVitales {
  /** Systolic blood pressure (mmHg), 40–300. */
  presionArterialSistolica: number | null;
  /** Diastolic blood pressure (mmHg), 20–200. */
  presionArterialDiastolica: number | null;
  /** Heart rate (bpm), 20–250. */
  frecuenciaCardiaca: number | null;
  /** Temperature (°C) with one decimal, 30–45. */
  temperatura: number | null;
  /** Respiratory rate (breaths/min), 4–80. */
  frecuenciaRespiratoria: number | null;
}

export type SignosVitalesInput = Partial<SignosVitales>;

/** The twelve regions explored during the stomatognathic exam. */
export const REGIONES_ESTOMATOGNATICAS = [
  'labios',
  'mejillas',
  'maxilar-superior',
  'maxilar-inferior',
  'lengua',
  'paladar',
  'piso',
  'carrillos',
  'glandulas-salivales',
  'oro-faringe',
  'atm',
  'ganglios',
] as const;

export type RegionEstomatognatica = (typeof REGIONES_ESTOMATOGNATICAS)[number];

export type EstadoRegion = 'normal' | 'alterado';

export type RegionesRecord = Record<RegionEstomatognatica, EstadoRegion | null>;

export interface ExamenEstomatognatico {
  regiones: RegionesRecord;
  descripcion: string | null;
}

export interface ExamenEstomatognaticoInput {
  regiones?: Partial<Record<RegionEstomatognatica, string | null>>;
  descripcion?: string | null;
}

/** Index teeth of the simplified oral hygiene index (all quadrants). */
export const PIEZAS_HIGIENE_ORAL = [
  16, 17, 55, 11, 21, 51, 26, 27, 65,
  36, 37, 75, 31, 41, 71, 46, 47, 85,
] as const;

export type PiezaHigieneOral = (typeof PIEZAS_HIGIENE_ORAL)[number];

export interface HigieneOralEntry {
  /** Dental plaque 0–3. */
  placa: number | null;
  /** Calculus 0–3. */
  calculo: number | null;
  /** Gingivitis 0–1. */
  gingivitis: number | null;
}

export type HigieneOralRecord = Record<PiezaHigieneOral, HigieneOralEntry>;

export type HigieneOralInput = Record<
  string,
  { placa?: number | null; calculo?: number | null; gingivitis?: number | null }
>;

export interface HigieneOralTotales {
  placa: number;
  calculo: number;
  gingivitis: number;
  total: number;
}

export const ENFERMEDAD_PERIODONTAL = ['leve', 'moderada', 'severa'] as const;
export type EnfermedadPeriodontal = (typeof ENFERMEDAD_PERIODONTAL)[number];

export const MALOCLUSIONES = ['angle-i', 'angle-ii', 'angle-iii'] as const;
export type Maloclusion = (typeof MALOCLUSIONES)[number];

export const GRADOS_FLUOROSIS = ['leve', 'moderada', 'severa'] as const;
export type GradoFluorosis = (typeof GRADOS_FLUOROSIS)[number];

export interface IndicadoresSaludBucal {
  higieneOral: HigieneOralRecord;
  enfermedadPeriodontal: EnfermedadPeriodontal | null;
  maloclusion: Maloclusion | null;
  fluorosis: GradoFluorosis | null;
}

export interface IndicadoresSaludBucalInput {
  higieneOral?: HigieneOralInput | null;
  enfermedadPeriodontal?: EnfermedadPeriodontal | null;
  maloclusion?: Maloclusion | null;
  fluorosis?: GradoFluorosis | null;
}

/** A ficha clínica as returned by the API. */
export interface ClinicalRecord {
  id: string;
  patientId: string;
  categoria: CategoriaEtaria;
  embarazada: boolean;
  status: ClinicalRecordStatus;
  motivoConsulta: string | null;
  enfermedadActual: string | null;
  antecedentes: AntecedentesRecord;
  signosVitales: SignosVitales;
  examenEstomatognatico: ExamenEstomatognatico;
  indicadores: IndicadoresSaludBucal;
  createdBy: string | null;
  updatedBy: string | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  finalizedBy: string | null;
  /** SHA-256 integrity seal, set when the record is finalized. */
  integrityHash: string | null;
}

/** Result of `GET /clinical-records/:id/integrity`. */
export interface ClinicalIntegrity {
  status: ClinicalRecordStatus;
  finalized: boolean;
  /** `null` while the record is still a draft (nothing to verify). */
  valid: boolean | null;
  storedHash: string | null;
  computedHash: string;
}

/**
 * Treatment plan (plan de tratamiento): one entry per procedure, optionally
 * bound to a tooth, with its execution state. Items come only from approved
 * quotations; they can be soft-deleted (with a reason) and restored.
 */
export const TREATMENT_PLAN_ITEM_STATUSES = [
  'pendiente',
  'realizado',
  'cancelado',
] as const;

export type TreatmentPlanItemStatus = (typeof TREATMENT_PLAN_ITEM_STATUSES)[number];

export interface TreatmentPlanItem {
  id: string;
  planId: string;
  /** FDI tooth; `null` for whole-mouth procedures. */
  tooth: number | null;
  procedure: string;
  /** UCO code copied from the source quotation line; `null` for free text. */
  ucoCode: string | null;
  status: TreatmentPlanItemStatus;
  /** Sanitized rich-text note (HTML). */
  notes: string | null;
  position: number;
  /** Quotation line this item was imported from. */
  sourceQuoteItemId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  realizadoAt: string | null;
  realizadoBy: string | null;
  notesUpdatedAt: string | null;
  notesUpdatedBy: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  deletedReason: string | null;
  isDeleted: boolean;
}

export interface TreatmentPlan {
  id: string;
  recordId: string;
  /** Sanitized rich-text note of the whole plan (HTML). */
  notes: string | null;
  notesUpdatedAt: string | null;
  notesUpdatedBy: string | null;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  items: TreatmentPlanItem[];
}

export interface UpdateTreatmentPlanItemPayload {
  status?: TreatmentPlanItemStatus;
  tooth?: number | null;
  procedure?: string;
  ucoCode?: string | null;
  notes?: string | null;
}

/** Classification of a quotation line when importing it into the plan. */
export type QuoteImportFlag = 'nuevo' | 'duplicado' | 'ambiguo' | 'sin-codigo';

export interface QuoteImportPreviewItem {
  quoteItemId: string;
  ucoCode: string | null;
  description: string;
  tooth: number | null;
  flag: QuoteImportFlag;
}

export interface QuoteImportPreview {
  quoteId: string;
  folio: string;
  items: QuoteImportPreviewItem[];
}

export interface ImportQuotePayload {
  quoteId: string;
  /**
   * Quotation line ids to import (the operator's choices from the preview).
   * Omit to import only the unambiguous new lines.
   */
  itemIds?: string[];
}

export interface CreateClinicalRecordPayload {
  categoria?: CategoriaEtaria;
  embarazada?: boolean;
}

/**
 * `PATCH /clinical-records/:id`: omitting a field leaves it untouched,
 * `null` clears the nullable ones.
 */
export interface UpdateClinicalRecordPayload {
  categoria?: CategoriaEtaria;
  embarazada?: boolean;
  motivoConsulta?: string | null;
  enfermedadActual?: string | null;
  antecedentes?: AntecedentesInput | null;
  signosVitales?: SignosVitalesInput | null;
  examenEstomatognatico?: ExamenEstomatognaticoInput | null;
  indicadores?: IndicadoresSaludBucalInput | null;
}

/**
 * Odontogram symbols of the HCU form. Red (`a-realizar`) states are current
 * problems, blue (`realizado`) states are performed treatments.
 */
export const FINDING_SYMBOLS = [
  'sellante-necesario',
  'sellante-realizado',
  'extraccion-indicada',
  'perdida-caries',
  'perdida-otra',
  'endodoncia',
  'protesis-fija',
  'protesis-removible',
  'protesis-total',
  'corona',
  'obturado',
  'caries',
] as const;

export type FindingSymbol = (typeof FINDING_SYMBOLS)[number];

export type FindingState = 'a-realizar' | 'realizado';

/** `V`estibular, `L`ingual/palatina, `M`esial, `D`istal, `O`clusal, `R`aíz. */
export const SURFACES = ['V', 'L', 'M', 'D', 'O', 'R'] as const;

export type Surface = (typeof SURFACES)[number];

/** Symbols still pending; everything else is drawn in blue (done). */
export const PENDING_SYMBOLS: readonly FindingSymbol[] = [
  'sellante-necesario',
  'extraccion-indicada',
  'caries',
];

export function defaultStateFor(symbol: FindingSymbol): FindingState {
  return PENDING_SYMBOLS.includes(symbol) ? 'a-realizar' : 'realizado';
}

/** One odontogram action; the log is append-only and mistakes are voided. */
export interface ClinicalFinding {
  id: string;
  recordId: string;
  /** FDI tooth: permanent 11–48, primary 51–85. */
  tooth: number;
  surfaces: readonly Surface[];
  symbol: FindingSymbol;
  state: FindingState;
  recesion: number | null;
  movilidad: number | null;
  note: string | null;
  createdBy: string | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
  voidedAt: string | null;
  voidedBy: string | null;
  isVoided: boolean;
}

export interface AddFindingPayload {
  tooth: number;
  /** Empty/omitted means "the whole tooth". */
  surfaces?: readonly Surface[];
  symbol: FindingSymbol;
  recesion?: number | null;
  movilidad?: number | null;
  note?: string | null;
}

export const CLINICAL_EVENT_ACTIONS = [
  'ficha-creada',
  'ficha-actualizada',
  'ficha-finalizada',
  'hallazgo-agregado',
  'hallazgo-anulado',
  'plan-item-agregado',
  'plan-item-actualizado',
  'plan-item-eliminado',
  'plan-item-restaurado',
  'plan-item-importado',
  'plan-nota-actualizada',
] as const;

export type ClinicalEventAction = (typeof CLINICAL_EVENT_ACTIONS)[number];

export interface ClinicalEvent {
  id: string;
  patientId: string;
  recordId: string;
  actorId: string | null;
  action: ClinicalEventAction;
  summary: string | null;
  payload: Record<string, unknown> | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** `C`, `P` and `O` counts (teeth, not surfaces) plus the CPO/ceo total. */
export interface IndexBreakdown {
  cariados: number[];
  perdidos: number[];
  obturados: number[];
  total: number;
}

export interface ClinicalIndices {
  /** CPO over the permanent dentition. */
  permanentes: IndexBreakdown;
  /** ceo over the primary dentition. */
  temporales: IndexBreakdown;
  higieneOral: HigieneOralTotales;
}

/** FDI permanent teeth in chart order: quadrant 1–4, upper right → lower right. */
export const PERMANENT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const PERMANENT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

/** FDI primary teeth (51–85) in chart order. */
export const PRIMARY_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
export const PRIMARY_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

/** FDI permanent teeth: quadrants 1–4, positions 1–8. */
export function isPermanentTooth(tooth: number): boolean {
  const quadrant = Math.floor(tooth / 10);
  const position = tooth % 10;

  return quadrant >= 1 && quadrant <= 4 && position >= 1 && position <= 8;
}

/** FDI primary (deciduous) teeth: quadrants 5–8, positions 1–5. */
export function isPrimaryTooth(tooth: number): boolean {
  const quadrant = Math.floor(tooth / 10);
  const position = tooth % 10;

  return quadrant >= 5 && quadrant <= 8 && position >= 1 && position <= 5;
}

export function isFdiTooth(tooth: number): boolean {
  return Number.isInteger(tooth) && (isPermanentTooth(tooth) || isPrimaryTooth(tooth));
}

/** Whole years between a timezone-free `YYYY-MM-DD` date and `today`. */
export function ageInYears(fechaNacimiento: string, today: Date = new Date()): number {
  const [year, month, day] = fechaNacimiento.split('-').map(Number);
  let age = today.getFullYear() - year;

  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1;
  }

  return age;
}

/** Age range suggested for a patient; the operator can always override it. */
export function suggestCategoriaEtaria(
  fechaNacimiento: string,
  today: Date = new Date(),
): CategoriaEtaria {
  const age = ageInYears(fechaNacimiento, today);

  if (age < 1) return 'menor-1';
  if (age <= 4) return '1-4';
  if (age <= 9) return '5-9-programado';
  if (age <= 14) return '10-14-programado';
  if (age <= 19) return '15-19';

  return 'mayor-20';
}

/**
 * Chart projection: voided findings are ignored and, for the same key
 * (tooth + surfaces + symbol), the latest entry wins. The server returns the
 * log oldest-first, so iterating in order and overwriting is enough.
 */
export function activeFindings(findings: readonly ClinicalFinding[]): ClinicalFinding[] {
  const byKey = new Map<string, ClinicalFinding>();

  for (const finding of findings) {
    if (finding.isVoided) {
      continue;
    }

    byKey.set(`${finding.tooth}:${[...finding.surfaces].sort().join('')}:${finding.symbol}`, finding);
  }

  return [...byKey.values()];
}

/** Active findings of one tooth, oldest first. */
export function toothFindings(
  findings: readonly ClinicalFinding[],
  tooth: number,
): ClinicalFinding[] {
  return activeFindings(findings).filter((finding) => finding.tooth === tooth);
}

/**
 * Fills per surface for a tooth: findings with explicit surfaces color those
 * regions; whole-tooth findings are drawn as glyphs (see `toothSymbols`).
 */
export function surfaceStates(
  findings: readonly ClinicalFinding[],
  tooth: number,
): Partial<Record<Surface, FindingState>> {
  const states: Partial<Record<Surface, FindingState>> = {};

  for (const finding of toothFindings(findings, tooth)) {
    for (const surface of finding.surfaces) {
      // Later findings (same surface) overwrite earlier ones.
      states[surface] = finding.state;
    }
  }

  return states;
}

/** Active whole-tooth findings (no surfaces): coronas, pérdidas, prótesis… */
export function toothSymbols(
  findings: readonly ClinicalFinding[],
  tooth: number,
): ClinicalFinding[] {
  return toothFindings(findings, tooth).filter((finding) => finding.surfaces.length === 0);
}

/**
 * Latest recesión / movilidad grades recorded for a tooth (any active finding
 * can carry them; the latest non-null value wins).
 */
export function toothGrades(
  findings: readonly ClinicalFinding[],
  tooth: number,
): { recesion: number | null; movilidad: number | null } {
  let recesion: number | null = null;
  let movilidad: number | null = null;

  for (const finding of toothFindings(findings, tooth)) {
    if (finding.recesion !== null) recesion = finding.recesion;
    if (finding.movilidad !== null) movilidad = finding.movilidad;
  }

  return { recesion, movilidad };
}

/** Short glyph shown over the tooth for whole-tooth symbols. */
export const SYMBOL_SHORT_CODES: Readonly<Record<FindingSymbol, string>> = {
  'sellante-necesario': 'S',
  'sellante-realizado': 'S',
  'extraccion-indicada': 'E',
  'perdida-caries': 'P',
  'perdida-otra': 'P',
  endodoncia: 'En',
  'protesis-fija': 'PF',
  'protesis-removible': 'PR',
  'protesis-total': 'PT',
  corona: 'C',
  obturado: 'O',
  caries: 'Ca',
};
