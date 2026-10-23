import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type {
  AddFindingPayload,
  ClinicalEvent,
  ClinicalFinding,
  ClinicalIndices,
  ClinicalIntegrity,
  ClinicalRecord,
  CreateClinicalRecordPayload,
  ImportQuotePayload,
  QuoteImportPreview,
  TreatmentPlan,
  TreatmentPlanItem,
  UpdateClinicalRecordPayload,
  UpdateTreatmentPlanItemPayload,
} from './clinical.model';

/**
 * Typed HTTP client for the clinical records REST API. The record is opened
 * through its patient (`POST /patients/:id/clinical-record`) and everything
 * else hangs from the record id (`/clinical-records/:id/...`).
 */
@Injectable({ providedIn: 'root' })
export class ClinicalApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  createForPatient(
    patientId: string,
    payload: CreateClinicalRecordPayload = {},
  ): Observable<ClinicalRecord> {
    return this.http.post<ClinicalRecord>(
      `${this.baseUrl}/patients/${encodeURIComponent(patientId)}/clinical-record`,
      payload,
    );
  }

  /** 404 means "the patient has no record yet", not "patient not found". */
  getForPatient(patientId: string): Observable<ClinicalRecord> {
    return this.http.get<ClinicalRecord>(
      `${this.baseUrl}/patients/${encodeURIComponent(patientId)}/clinical-record`,
    );
  }

  getById(id: string): Observable<ClinicalRecord> {
    return this.http.get<ClinicalRecord>(`${this.baseUrl}/clinical-records/${encodeURIComponent(id)}`);
  }

  update(id: string, payload: UpdateClinicalRecordPayload): Observable<ClinicalRecord> {
    return this.http.patch<ClinicalRecord>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(id)}`,
      payload,
    );
  }

  /** Full append-only log (voided entries included), oldest first. */
  listFindings(recordId: string): Observable<ClinicalFinding[]> {
    return this.http.get<ClinicalFinding[]>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(recordId)}/findings`,
    );
  }

  addFinding(recordId: string, payload: AddFindingPayload): Observable<ClinicalFinding> {
    return this.http.post<ClinicalFinding>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(recordId)}/findings`,
      payload,
    );
  }

  /** Undo: the finding stays in the log marked as voided. */
  voidFinding(recordId: string, findingId: string): Observable<ClinicalFinding> {
    return this.http.post<ClinicalFinding>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(recordId)}/findings/${encodeURIComponent(findingId)}/void`,
      {},
    );
  }

  /** CPO/ceo and hygiene totals, always derived server-side. */
  getIndices(recordId: string): Observable<ClinicalIndices> {
    return this.http.get<ClinicalIndices>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(recordId)}/indices`,
    );
  }

  /** Timeline / audit trail, newest first. */
  listEvents(recordId: string): Observable<ClinicalEvent[]> {
    return this.http.get<ClinicalEvent[]>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(recordId)}/events`,
    );
  }

  /** Seals the ficha with an integrity hash and locks it (423 on later edits). */
  finalize(id: string): Observable<ClinicalRecord> {
    return this.http.post<ClinicalRecord>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(id)}/finalize`,
      {},
    );
  }

  /** Recomputes the integrity hash and compares it to the stored seal. */
  getIntegrity(id: string): Observable<ClinicalIntegrity> {
    return this.http.get<ClinicalIntegrity>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(id)}/integrity`,
    );
  }

  /** Treatment plan of a record (the plan is created lazily by the API). */
  getTreatmentPlan(
    recordId: string,
    options: { deleted?: boolean } = {},
  ): Observable<TreatmentPlan> {
    return this.http.get<TreatmentPlan>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(recordId)}/treatment-plan`,
      { params: options.deleted === true ? { deleted: 'true' } : {} },
    );
  }

  /** Dry-run of importing an approved quotation (flags per line, no writes). */
  previewQuoteImport(recordId: string, quoteId: string): Observable<QuoteImportPreview> {
    return this.http.post<QuoteImportPreview>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(recordId)}/treatment-plan/import/preview`,
      { quoteId },
    );
  }

  /** Imports the chosen lines of an approved quotation into the plan. */
  importQuote(
    recordId: string,
    payload: ImportQuotePayload,
  ): Observable<TreatmentPlanItem[]> {
    return this.http.post<TreatmentPlanItem[]>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(recordId)}/treatment-plan/import`,
      payload,
    );
  }

  /** Replaces the plan-level rich-text note. */
  updatePlanNotes(recordId: string, notes: string | null): Observable<TreatmentPlan> {
    return this.http.patch<TreatmentPlan>(
      `${this.baseUrl}/clinical-records/${encodeURIComponent(recordId)}/treatment-plan/notes`,
      { notes },
    );
  }

  updateTreatmentPlanItem(
    itemId: string,
    payload: UpdateTreatmentPlanItemPayload,
  ): Observable<TreatmentPlanItem> {
    return this.http.patch<TreatmentPlanItem>(
      `${this.baseUrl}/treatment-plan-items/${encodeURIComponent(itemId)}`,
      payload,
    );
  }

  /** Moves a plan item to the trash (soft delete, mandatory reason). */
  deleteTreatmentPlanItem(itemId: string, reason: string): Observable<TreatmentPlanItem> {
    return this.http.delete<TreatmentPlanItem>(
      `${this.baseUrl}/treatment-plan-items/${encodeURIComponent(itemId)}`,
      { body: { reason } },
    );
  }

  /** Brings a plan item back from the trash. */
  restoreTreatmentPlanItem(itemId: string): Observable<TreatmentPlanItem> {
    return this.http.post<TreatmentPlanItem>(
      `${this.baseUrl}/treatment-plan-items/${encodeURIComponent(itemId)}/restore`,
      {},
    );
  }
}
