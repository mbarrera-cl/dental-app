import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import {
  ClinicalApi,
  PatientsApi,
  mapApiError,
  type AddFindingPayload,
  type ClinicalFinding,
  type ClinicalIndices,
  type ClinicalRecord,
  type CreateClinicalRecordPayload,
  type Patient,
  type UpdateClinicalRecordPayload,
} from 'data-access';

/**
 * Route-scoped store of one patient's clinical record (`/patients/:id`).
 *
 * It is provided by the `:id` route so the header, the ficha form, the
 * odontogram and the indicators tab all share the same signals. A 404 while
 * loading the record is not an error: it means the record has not been
 * opened yet and the detail page offers to create it.
 */
@Injectable()
export class ClinicalRecordStore {
  private readonly route = inject(ActivatedRoute);
  private readonly patientsApi = inject(PatientsApi);
  private readonly clinicalApi = inject(ClinicalApi);

  readonly patientId = signal('');
  readonly patient = signal<Patient | null>(null);
  readonly record = signal<ClinicalRecord | null>(null);
  /** Full append-only log (voided entries included), oldest first. */
  readonly findings = signal<readonly ClinicalFinding[]>([]);
  readonly indices = signal<ClinicalIndices | null>(null);

  readonly loading = signal(true);
  /** Transloco key of the load failure, if any. */
  readonly loadError = signal<string | null>(null);
  readonly creating = signal(false);

  readonly recordId = computed(() => this.record()?.id ?? null);

  constructor() {
    this.route.paramMap.subscribe((params) => this.load(params.get('id') ?? ''));
  }

  load(patientId: string): void {
    if (patientId === '') {
      return;
    }

    this.patientId.set(patientId);
    this.loading.set(true);
    this.loadError.set(null);
    this.patient.set(null);
    this.record.set(null);
    this.findings.set([]);
    this.indices.set(null);

    this.patientsApi
      .getById(patientId)
      .pipe(
        tap((patient) => this.patient.set(patient)),
        switchMap(() =>
          this.clinicalApi
            .getForPatient(patientId)
            .pipe(
              map((record): ClinicalRecord | HttpErrorResponse => record),
              // A missing record is a normal state, not an error.
              catchError((error: unknown) =>
                of<ClinicalRecord | HttpErrorResponse>(
                  error instanceof HttpErrorResponse ? error : new HttpErrorResponse({ status: 0 }),
                ),
              ),
            ),
        ),
      )
      .subscribe({
        next: (result) => {
          if (result instanceof HttpErrorResponse) {
            if (result.status !== 404) {
              this.loadError.set(mapApiError(result));
            }
          } else {
            this.record.set(result);
            this.reloadFindings();
            this.reloadIndices();
          }

          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loadError.set(mapApiError(error));
          this.loading.set(false);
        },
      });
  }

  createRecord(payload: CreateClinicalRecordPayload = {}): Observable<ClinicalRecord> {
    this.creating.set(true);

    return this.clinicalApi.createForPatient(this.patientId(), payload).pipe(
      tap({
        next: (record) => {
          this.record.set(record);
          this.creating.set(false);
          this.reloadFindings();
          this.reloadIndices();
        },
        error: () => this.creating.set(false),
      }),
    );
  }

  updateRecord(payload: UpdateClinicalRecordPayload): Observable<ClinicalRecord> {
    return this.clinicalApi.update(this.requireRecordId(), payload).pipe(
      tap({
        next: (record) => {
          this.record.set(record);
          // The odontogram and the hygiene totals may be unaffected, but the
          // derived indices are cheap and always safe to refresh.
          this.reloadIndices();
        },
      }),
    );
  }

  addFinding(payload: AddFindingPayload): Observable<ClinicalFinding> {
    return this.clinicalApi.addFinding(this.requireRecordId(), payload).pipe(
      tap({
        next: () => {
          this.reloadFindings();
          this.reloadIndices();
        },
      }),
    );
  }

  voidFinding(findingId: string): Observable<ClinicalFinding> {
    return this.clinicalApi.voidFinding(this.requireRecordId(), findingId).pipe(
      tap({
        next: () => {
          this.reloadFindings();
          this.reloadIndices();
        },
      }),
    );
  }

  reloadFindings(): void {
    const recordId = this.recordId();

    if (recordId === null) {
      return;
    }

    this.clinicalApi
      .listFindings(recordId)
      .subscribe({ next: (findings) => this.findings.set(findings) });
  }

  reloadIndices(): void {
    const recordId = this.recordId();

    if (recordId === null) {
      return;
    }

    this.clinicalApi
      .getIndices(recordId)
      .subscribe({ next: (indices) => this.indices.set(indices) });
  }

  private requireRecordId(): string {
    const recordId = this.recordId();

    if (recordId === null) {
      throw new Error('The clinical record is not loaded yet');
    }

    return recordId;
  }
}
