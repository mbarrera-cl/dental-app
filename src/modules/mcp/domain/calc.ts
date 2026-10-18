export const CALC_OPERATIONS = [
  'sum',
  'mean',
  'min',
  'max',
  'count',
  'median',
  'range',
  'stddev',
] as const;

export type CalcOperation = (typeof CALC_OPERATIONS)[number];

export interface CalcResult {
  operation: CalcOperation;
  /** Input values, echoed back for auditability. */
  values: number[];
  /** Result of the operation, or `null` when the input cannot produce one. */
  result: number | null;
}

export class InvalidCalcOperationError extends Error {
  constructor(operation: unknown) {
    super(`Unsupported calc operation: ${String(operation)}`);
    this.name = 'InvalidCalcOperationError';
  }
}

export class EmptyCalcValuesError extends Error {
  constructor() {
    super('values must contain at least one finite number');
    this.name = 'EmptyCalcValuesError';
  }
}

export class NonFiniteCalcValueError extends Error {
  constructor() {
    super('values must contain only finite numbers');
    this.name = 'NonFiniteCalcValueError';
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function medianOf(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * Pure, deterministic calculator for MCP tool use. It never parses
 * expressions: the caller sends a structured operation and a list of finite
 * numbers, so results are exact and auditable.
 */
export function calculate(
  operation: CalcOperation,
  values: readonly number[],
): CalcResult {
  for (const value of values) {
    if (!isFiniteNumber(value)) {
      throw new NonFiniteCalcValueError();
    }
  }

  if (values.length === 0) {
    throw new EmptyCalcValuesError();
  }

  const list = [...values];
  let result: number | null = null;

  switch (operation) {
    case 'sum':
      result = list.reduce((total, value) => total + value, 0);
      break;
    case 'count':
      result = list.length;
      break;
    case 'min':
      result = Math.min(...list);
      break;
    case 'max':
      result = Math.max(...list);
      break;
    case 'mean':
      result = list.reduce((total, value) => total + value, 0) / list.length;
      break;
    case 'median':
      list.sort((a, b) => a - b);
      result = medianOf(list);
      break;
    case 'range':
      result = Math.max(...list) - Math.min(...list);
      break;
    case 'stddev': {
      const mean =
        list.reduce((total, value) => total + value, 0) / list.length;
      const variance =
        list.reduce((total, value) => total + (value - mean) ** 2, 0) /
        list.length;
      result = Math.sqrt(variance);
      break;
    }
    default:
      throw new InvalidCalcOperationError(operation);
  }

  return { operation, values: [...values], result };
}
