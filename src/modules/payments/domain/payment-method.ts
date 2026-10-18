/** Payment methods accepted at the front desk (caja). */
export const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Type guard for raw input (HTTP/DTO) before it reaches the domain. */
export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value);
}
