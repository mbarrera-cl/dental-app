import { Entity } from '../../../shared/domain/entity.js';
import {
  QuoteItem,
  type QuoteItemInput,
  type QuoteItemStatus,
} from './quote-item.entity.js';

export type QuoteStatus = 'borrador' | 'entregada' | 'aprobada' | 'rechazada';

/** Money is always integer CLP. */
export interface QuoteTotals {
  subtotal: number;
  discountTotal: number;
  total: number;
}

export interface QuoteProps {
  folio: string;
  patientId: string;
  patientName: string;
  patientRut: string;
  patientEmail: string | null;
  status: QuoteStatus;
  validUntil: Date | null;
  notes: string | null;
  items: QuoteItem[];
  version: number;
  /** New version linked to this quote (duplicate chain). */
  replacesQuoteId: string | null;
  createdBy: string | null;
  createdByName: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedByName: string;
  updatedAt: Date;
  sanctionedBy: string | null;
  sanctionedByName: string | null;
  sanctionedAt: Date | null;
}

export interface CreateQuoteProps {
  folio: string;
  patientId: string;
  patientName: string;
  patientRut: string;
  patientEmail: string | null;
  validUntil: Date | null;
  notes: string | null;
  items: QuoteItemInput[];
  createdBy: string | null;
  createdByName: string;
}

/** Snapshot of a quote used for the version trail and the printed document. */
export interface QuoteSnapshot {
  id: string;
  folio: string;
  status: QuoteStatus;
  patient: { id: string; name: string; rut: string; email: string | null };
  validUntil: string | null;
  notes: string | null;
  totals: QuoteTotals;
  items: Array<{
    id: string;
    ucoCode: string | null;
    description: string;
    piezaDental: string | null;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    subtotal: number;
    discountAmount: number;
    netAmount: number;
    status: string;
  }>;
  createdByName: string;
  createdAt: string;
}

/**
 * A dental quotation: a snapshot of the patient plus its lines. Totals are
 * recomputed on the server (never trusted from the client). A sanctioned
 * quote is immutable; editing requires duplicating it.
 */
export class Quote extends Entity<QuoteProps> {
  private constructor(props: QuoteProps, id?: string) {
    super(props, id);
  }

  static create(props: CreateQuoteProps): Quote {
    const now = new Date();

    return new Quote({
      folio: normalizeFolio(props.folio),
      patientId: props.patientId,
      patientName: props.patientName.trim(),
      patientRut: props.patientRut.trim(),
      patientEmail: props.patientEmail === null ? null : props.patientEmail.trim() || null,
      status: 'borrador',
      validUntil: props.validUntil,
      notes: props.notes === null ? null : props.notes.trim() || null,
      items: props.items.map((item, index) => QuoteItem.create({ ...item, position: index })),
      version: 1,
      replacesQuoteId: null,
      createdBy: props.createdBy,
      createdByName: props.createdByName.trim(),
      createdAt: now,
      updatedBy: null,
      updatedByName: props.createdByName.trim(),
      updatedAt: now,
      sanctionedBy: null,
      sanctionedByName: null,
      sanctionedAt: null,
    });
  }

  /** Rebuilds a quote that already exists (e.g. loaded from a database). */
  static reconstitute(props: QuoteProps, id: string): Quote {
    return new Quote(props, id);
  }

  get folio(): string {
    return this.props.folio;
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get patientName(): string {
    return this.props.patientName;
  }

  get patientRut(): string {
    return this.props.patientRut;
  }

  get patientEmail(): string | null {
    return this.props.patientEmail;
  }

  get status(): QuoteStatus {
    return this.props.status;
  }

  get validUntil(): Date | null {
    return this.props.validUntil;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  get items(): QuoteItem[] {
    return this.props.items;
  }

  get version(): number {
    return this.props.version;
  }

  get replacesQuoteId(): string | null {
    return this.props.replacesQuoteId;
  }

  get createdBy(): string | null {
    return this.props.createdBy;
  }

  get createdByName(): string {
    return this.props.createdByName;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy;
  }

  get updatedByName(): string {
    return this.props.updatedByName;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get sanctionedBy(): string | null {
    return this.props.sanctionedBy;
  }

  get sanctionedByName(): string | null {
    return this.props.sanctionedByName;
  }

  get sanctionedAt(): Date | null {
    return this.props.sanctionedAt;
  }

  get subtotal(): number {
    return this.props.items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  get discountTotal(): number {
    return this.props.items.reduce((sum, item) => sum + item.discountAmount, 0);
  }

  get total(): number {
    return this.props.items.reduce((sum, item) => sum + item.netAmount, 0);
  }

  /** Sum of the nets of approved items only (Total Aprobado). */
  get approvedTotal(): number {
    return this.props.items
      .filter((item) => item.status === 'aprobado')
      .reduce((sum, item) => sum + item.netAmount, 0);
  }

  get totals(): QuoteTotals {
    return { subtotal: this.subtotal, discountTotal: this.discountTotal, total: this.total };
  }

  /**
   * Replaces the lines and the editable header fields, recomputing totals.
   * Only valid on a draft/entregada quote (not sanctioned). Bumps the version
   * on every save.
   */
  update(input: {
    validUntil?: Date | null;
    notes?: string | null;
    items: QuoteItemInput[];
    actorId: string | null;
    actorName: string;
  }): void {
    this.assertEditable();

    if (input.validUntil !== undefined) {
      this.props.validUntil = input.validUntil;
    }

    if (input.notes !== undefined) {
      this.props.notes = (input.notes ?? '').trim() || null;
    }

    this.props.items = input.items.map((item, index) => {
      const existing = this.props.items.find((line) => line.id === item.id);

      if (existing !== undefined) {
        existing.change({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent ?? 0,
        });
        return existing;
      }

      return QuoteItem.create({ ...item, position: index });
    });

    this.touch(input.actorId, input.actorName);
  }

  /** Deliver the quote: from borrador to entregada (optional transition). */
  deliver(actorId: string | null, actorName: string): void {
    if (this.props.status !== 'borrador') {
      throw new Error('quotes.status.onlyFromDraft');
    }

    this.props.status = 'entregada';
    this.touch(actorId, actorName);
  }

  /**
   * Decides the acceptance state of one line. Lines of a sanctioned quote are
   * locked; otherwise any `generado`/decided transition is allowed (decided →
   * generated is a "reopen").
   */
  decideItem(itemId: string, status: QuoteItemStatus, actorId: string | null, actorName: string): void {
    this.assertEditable();
    const item = this.item(itemId);

    if (status === 'generado') {
      item.reopen(actorId, actorName);
    } else {
      item.decide(status, actorId, actorName);
    }

    this.touch(actorId, actorName);
  }

  /**
   * Sanctions the quote (approve/reject). Closes it; the sanction wins even
   * with undecided items. Records who and when.
   */
  sanction(status: 'aprobada' | 'rechazada', actorId: string | null, actorName: string): void {
    if (this.props.status === 'aprobada' || this.props.status === 'rechazada') {
      throw new Error('quotes.status.alreadySanctioned');
    }

    this.props.status = status;
    this.props.sanctionedBy = actorId;
    this.props.sanctionedByName = actorName;
    this.props.sanctionedAt = new Date();
    this.touch(actorId, actorName);
  }

  /** A new version referencing this quote; bumps the version and resets to draft. */
  duplicate(actorId: string | null, actorName: string, folio: string): Quote {
    const now = new Date();

    return new Quote({
      folio: normalizeFolio(folio),
      patientId: this.props.patientId,
      patientName: this.props.patientName,
      patientRut: this.props.patientRut,
      patientEmail: this.props.patientEmail,
      status: 'borrador',
      validUntil: this.props.validUntil,
      notes: this.props.notes,
      items: this.props.items.map((item, index) =>
        QuoteItem.create({
          position: index,
          ucoCode: item.ucoCode,
          description: item.description,
          piezaDental: item.piezaDental,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
        }),
      ),
      version: 1,
      replacesQuoteId: this.id,
      createdBy: actorId,
      createdByName: actorName,
      createdAt: now,
      updatedBy: actorId,
      updatedByName: actorName,
      updatedAt: now,
      sanctionedBy: null,
      sanctionedByName: null,
      sanctionedAt: null,
    });
  }

  /** A JSON-serializable snapshot for the version trail / print document. */
  snapshot(): QuoteSnapshot {
    return {
      id: this.id,
      folio: this.props.folio,
      status: this.props.status,
      patient: {
        id: this.props.patientId,
        name: this.props.patientName,
        rut: this.props.patientRut,
        email: this.props.patientEmail,
      },
      validUntil: this.props.validUntil === null ? null : this.props.validUntil.toISOString(),
      notes: this.props.notes,
      totals: this.totals,
      items: this.props.items.map((item) => ({
        id: item.id,
        ucoCode: item.ucoCode,
        description: item.description,
        piezaDental: item.piezaDental,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        subtotal: item.subtotal,
        discountAmount: item.discountAmount,
        netAmount: item.netAmount,
        status: item.status,
      })),
      createdByName: this.props.createdByName,
      createdAt: this.props.createdAt.toISOString(),
    };
  }

  private item(itemId: string): QuoteItem {
    const item = this.props.items.find((line) => line.id === itemId);

    if (item === undefined) {
      throw new Error('quotes.item.notFound');
    }

    return item;
  }

  private assertEditable(): void {
    if (this.props.status === 'aprobada' || this.props.status === 'rechazada') {
      throw new Error('quotes.status.locked');
    }
  }

  private touch(actorId: string | null, actorName: string): void {
    this.props.updatedBy = actorId;
    this.props.updatedByName = actorName;
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }
}

function normalizeFolio(folio: string): string {
  const normalized = folio.trim().toUpperCase();

  if (normalized.length === 0 || normalized.length > 24) {
    throw new Error('quotes.folio.invalid');
  }

  return normalized;
}
