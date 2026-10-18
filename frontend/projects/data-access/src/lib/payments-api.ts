import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type {
  CashSummaryEntry,
  Ledger,
  Movement,
  RecordChargePayload,
  RecordPaymentPayload,
} from './payment.model';

/** Typed HTTP client for the patient account (cobros / caja). */
@Injectable({ providedIn: 'root' })
export class PaymentsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  /** Records a charge (cargo) on the patient account. */
  recordCharge(patientId: string, payload: RecordChargePayload): Observable<Movement> {
    return this.http.post<Movement>(
      `${this.baseUrl}/patients/${encodeURIComponent(patientId)}/ledger/charges`,
      payload,
    );
  }

  /** Records a payment (abono) on the patient account. */
  recordPayment(patientId: string, payload: RecordPaymentPayload): Observable<Movement> {
    return this.http.post<Movement>(
      `${this.baseUrl}/patients/${encodeURIComponent(patientId)}/ledger/payments`,
      payload,
    );
  }

  /** History of the account plus its computed balance. */
  ledger(patientId: string, query: { limit?: number; offset?: number } = {}): Observable<Ledger> {
    return this.http.get<Ledger>(
      `${this.baseUrl}/patients/${encodeURIComponent(patientId)}/ledger`,
      { params: { ...query } },
    );
  }

  /** One movement by id (the printable receipt reads this). */
  get(id: string): Observable<Movement> {
    return this.http.get<Movement>(`${this.baseUrl}/ledger/${encodeURIComponent(id)}`);
  }

  /** Annuls a movement (append-only: the row stays, the balance heals). */
  void(id: string, reason: string): Observable<Movement> {
    return this.http.post<Movement>(
      `${this.baseUrl}/ledger/${encodeURIComponent(id)}/void`,
      { reason },
    );
  }

  /** Close-of-day: non-voided payments grouped by method in an inclusive range. */
  cashSummary(query: { from?: string; to?: string } = {}): Observable<CashSummaryEntry[]> {
    return this.http.get<CashSummaryEntry[]>(`${this.baseUrl}/ledger/cash-summary`, {
      params: { ...query },
    });
  }
}
