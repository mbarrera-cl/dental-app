import { Entity } from '../../../shared/domain/entity.js';

export type QuoteItemStatus = 'generado' | 'aprobado' | 'rechazado';

export interface QuoteItemProps {
  position: number;
  /** UCO code, when the line came from the catalog; null for manual lines. */
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
  statusChangedBy: string | null;
  statusChangedByName: string | null;
  statusChangedAt: Date | null;
}

export interface QuoteItemInput {
  /** Position within the quote; `create` reassigns sequential positions. */
  position?: number;
  ucoCode?: string | null;
  description: string;
  piezaDental?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  /** Existing id when editing; undefined when creating. */
  id?: string;
}

/** A single line of a quotation, with its own acceptance state. */
export class QuoteItem extends Entity<QuoteItemProps> {
  private constructor(props: QuoteItemProps, id?: string) {
    super(props, id);
  }

  static create(input: QuoteItemInput): QuoteItem {
    const normalized = normalizeItemInput(input);

    return new QuoteItem({
      position: normalized.position,      ucoCode: normalized.ucoCode,
      description: normalized.description,
      piezaDental: normalized.piezaDental,
      quantity: normalized.quantity,
      unitPrice: normalized.unitPrice,
      discountPercent: normalized.discountPercent,
      subtotal: normalized.subtotal,
      discountAmount: normalized.discountAmount,
      netAmount: normalized.netAmount,
      status: 'generado',
      statusChangedBy: null,
      statusChangedByName: null,
      statusChangedAt: null,
    });
  }

  /** Rebuilds a line that already exists (e.g. loaded from a database). */
  static reconstitute(props: QuoteItemProps, id: string): QuoteItem {
    return new QuoteItem(props, id);
  }

  get position(): number {
    return this.props.position;
  }

  get ucoCode(): string | null {
    return this.props.ucoCode;
  }

  get description(): string {
    return this.props.description;
  }

  get piezaDental(): string | null {
    return this.props.piezaDental;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get unitPrice(): number {
    return this.props.unitPrice;
  }

  get discountPercent(): number {
    return this.props.discountPercent;
  }

  get subtotal(): number {
    return this.props.subtotal;
  }

  get discountAmount(): number {
    return this.props.discountAmount;
  }

  get netAmount(): number {
    return this.props.netAmount;
  }

  get status(): QuoteItemStatus {
    return this.props.status;
  }

  get statusChangedBy(): string | null {
    return this.props.statusChangedBy;
  }

  get statusChangedByName(): string | null {
    return this.props.statusChangedByName;
  }

  get statusChangedAt(): Date | null {
    return this.props.statusChangedAt;
  }

  /** Recomputes values when the price/quantity/discount changes. */
  change(input: { quantity: number; unitPrice: number; discountPercent: number }): void {
    const normalized = normalizeItemInput({
      position: this.props.position,
      ucoCode: this.props.ucoCode,
      description: this.props.description,
      piezaDental: this.props.piezaDental,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      discountPercent: input.discountPercent,
    });

    this.props.quantity = normalized.quantity;
    this.props.unitPrice = normalized.unitPrice;
    this.props.discountPercent = normalized.discountPercent;
    this.props.subtotal = normalized.subtotal;
    this.props.discountAmount = normalized.discountAmount;
    this.props.netAmount = normalized.netAmount;
  }

  /** Marks the line as decided (patient acceptance recorded by staff). */
  decide(status: QuoteItemStatus, actorId: string | null, actorName: string): void {
    if (status !== 'aprobado' && status !== 'rechazado') {
      throw new Error('quotes.item.invalidDecision');
    }

    this.props.status = status;
    this.props.statusChangedBy = actorId;
    this.props.statusChangedByName = actorName;
    this.props.statusChangedAt = new Date();
  }

  /** Returns a decided line to `generado` while the quote is not sanctioned. */
  reopen(actorId: string | null, actorName: string): void {
    if (this.props.status === 'generado') {
      return;
    }

    this.props.status = 'generado';
    this.props.statusChangedBy = actorId;
    this.props.statusChangedByName = actorName;
    this.props.statusChangedAt = new Date();
  }
}

/**
 * Recomputes a line's money fields (integer CLP) from its inputs. This is the
 * single source of truth for the arithmetic, shared by the entity and the
 * server-side validation of inbound payloads.
 */
export function computeItemTotals(input: {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}): { subtotal: number; discountAmount: number; netAmount: number } {
  const quantity = Math.trunc(input.quantity);
  const unitPrice = Math.round(input.unitPrice);
  const discountPercent = clampDiscount(input.discountPercent);
  const subtotal = quantity * unitPrice;
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const netAmount = subtotal - discountAmount;

  return { subtotal, discountAmount, netAmount };
}

function normalizeItemInput(input: QuoteItemInput): {
  position: number;
  ucoCode: string | null;
  description: string;
  piezaDental: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  subtotal: number;
  discountAmount: number;
  netAmount: number;
} {
  const description = input.description.trim();

  if (description.length === 0) {
    throw new Error('quotes.item.description.required');
  }

  const quantity = Math.trunc(input.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10_000) {
    throw new Error('quotes.item.invalidQuantity');
  }

  const unitPrice = Math.round(input.unitPrice);

  if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000_000) {
    throw new Error('quotes.item.invalidUnitPrice');
  }

  const discountPercent = clampDiscount(input.discountPercent ?? 0);
  const { subtotal, discountAmount, netAmount } = computeItemTotals({
    quantity,
    unitPrice,
    discountPercent,
  });

  return {
    position: Math.trunc(input.position ?? 0),
    ucoCode: input.ucoCode === null || input.ucoCode === undefined ? null : input.ucoCode.trim() || null,
    description,
    piezaDental: input.piezaDental === null || input.piezaDental === undefined ? null : input.piezaDental.trim() || null,
    quantity,
    unitPrice,
    discountPercent,
    subtotal,
    discountAmount,
    netAmount,
  };
}

function clampDiscount(value: number): number {
  const clamped = Math.round(value ?? 0);

  if (!Number.isFinite(clamped) || clamped < 0 || clamped > 100) {
    throw new Error('quotes.item.invalidDiscount');
  }

  return clamped;
}
