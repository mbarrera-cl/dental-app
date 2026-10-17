/** Acceptance state of a single quote line. */
export type QuoteItemStatus = 'generado' | 'aprobado' | 'rechazado';

/** Persisted workflow state of a quotation. Expiry is shown separately. */
export type QuoteStatus = 'borrador' | 'sin_respuesta' | 'aprobada' | 'rechazada';

/** One line of a quotation. */
export interface QuoteItem {
  id: string;
  /** UCO code when the line came from the catalog; null for manual lines. */
  ucoCode: string | null;
  description: string;
  piezaDental: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  subtotal: number;
  discountAmount: number;
  netAmount: number;
  status: QuoteItemStatus;
  statusChangedByName: string | null;
  statusChangedAt: string | null;
}

/** A dental quotation (presupuesto). */
export interface Quote {
  id: string;
  folio: string;
  patientId: string;
  patientName: string;
  patientRut: string;
  patientEmail: string | null;
  status: QuoteStatus;
  validUntil: string | null;
  notes: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  approvedTotal: number;
  version: number;
  replacesQuoteId: string | null;
  createdByName: string;
  createdAt: string;
  updatedByName: string;
  updatedAt: string;
  sanctionedByName: string | null;
  sanctionedAt: string | null;
  /** Set when the quotation is in the trash (soft deleted). */
  deletedAt: string | null;
  deletedByName: string | null;
  items: QuoteItem[];
}

export interface CreateQuoteItemPayload {
  id?: string;
  ucoCode?: string | null;
  description: string;
  piezaDental?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
}

/** Payload accepted by `POST /quotes`. */
export interface CreateQuotePayload {
  patientId: string;
  validUntil?: string | null;
  notes?: string | null;
  items: CreateQuoteItemPayload[];
}

/** Payload accepted by `PUT /quotes/:id`. */
export interface UpdateQuotePayload {
  validUntil?: string | null;
  notes?: string | null;
  items: CreateQuoteItemPayload[];
}

export interface QuoteVersion {
  id: string;
  version: number;
  action: string;
  snapshot: string;
  actorName: string;
  createdAt: string;
}
