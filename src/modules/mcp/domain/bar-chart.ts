export const CHART_BAR_TOOL_NAME = 'hexa_chart_bar';

export const BAR_CHART_VALUE_FORMATS = ['number', 'currency', 'percent'] as const;

export type BarChartValueFormat = (typeof BAR_CHART_VALUE_FORMATS)[number];

export const MAX_BAR_CHART_POINTS = 20;
export const MAX_BAR_CHART_TITLE_LENGTH = 120;
export const MAX_BAR_CHART_DESCRIPTION_LENGTH = 200;
export const MAX_BAR_CHART_LABEL_LENGTH = 40;
export const MAX_BAR_CHART_VALUE_LABEL_LENGTH = 40;

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export interface BarChartDatum {
  label: string;
  value: number;
}

/**
 * Render-ready bar chart produced by `hexa_chart_bar`. CaroIA persists it next
 * to the tool call and paints it with the shared dashboard chart component.
 */
export interface BarChartSpec {
  type: 'bar';
  title: string;
  description: string | null;
  valueFormat: BarChartValueFormat;
  valueLabel: string | null;
  currency: string | null;
  data: BarChartDatum[];
}

export interface BarChartInput {
  title: string;
  description?: string | null;
  valueFormat?: BarChartValueFormat;
  valueLabel?: string | null;
  currency?: string | null;
  data: readonly BarChartDatum[];
}

export class InvalidBarChartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBarChartError';
  }
}

function normalizeText(
  value: string | null | undefined,
  label: string,
  maxLength: number,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (normalized === '') {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new InvalidBarChartError(`${label} must be at most ${maxLength} characters`);
  }

  return normalized;
}

function normalizeCurrency(value: string | null | undefined): string {
  const normalized = (value ?? 'CLP').trim().toUpperCase();

  if (!CURRENCY_CODE_PATTERN.test(normalized)) {
    throw new InvalidBarChartError('currency must be a 3-letter ISO 4217 code');
  }

  return normalized;
}

/**
 * Validates and normalizes a bar chart supplied by the model. The tool is a
 * pure renderer: it never queries domain data, so the only guarantees are
 * shape, bounds and finite values.
 */
export function buildBarChart(input: BarChartInput): BarChartSpec {
  const title = normalizeText(input.title, 'title', MAX_BAR_CHART_TITLE_LENGTH);

  if (title === null) {
    throw new InvalidBarChartError('title is required');
  }

  const description = normalizeText(
    input.description,
    'description',
    MAX_BAR_CHART_DESCRIPTION_LENGTH,
  );
  const valueLabel = normalizeText(
    input.valueLabel,
    'valueLabel',
    MAX_BAR_CHART_VALUE_LABEL_LENGTH,
  );
  const valueFormat = input.valueFormat ?? 'number';

  if (!BAR_CHART_VALUE_FORMATS.includes(valueFormat)) {
    throw new InvalidBarChartError(`unsupported valueFormat: ${String(valueFormat)}`);
  }

  if (input.data.length === 0) {
    throw new InvalidBarChartError('data must contain at least one point');
  }

  if (input.data.length > MAX_BAR_CHART_POINTS) {
    throw new InvalidBarChartError(`data can contain at most ${MAX_BAR_CHART_POINTS} points`);
  }

  const labels = new Set<string>();
  const data = input.data.map((point, index) => {
    const label = normalizeText(point.label, `data[${index}].label`, MAX_BAR_CHART_LABEL_LENGTH);

    if (label === null) {
      throw new InvalidBarChartError(`data[${index}].label is required`);
    }

    if (labels.has(label)) {
      throw new InvalidBarChartError(`duplicate chart label: ${label}`);
    }

    if (!Number.isFinite(point.value)) {
      throw new InvalidBarChartError(`data[${index}].value must be a finite number`);
    }

    labels.add(label);

    return { label, value: point.value };
  });

  return {
    type: 'bar',
    title,
    description,
    valueFormat,
    valueLabel,
    currency: valueFormat === 'currency' ? normalizeCurrency(input.currency) : null,
    data,
  };
}

/** Defensive reader for chart specs persisted with a CaroIA tool call. */
export function parseBarChart(value: unknown): BarChartSpec | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (record.type !== 'bar' || typeof record.title !== 'string' || !Array.isArray(record.data)) {
    return null;
  }

  try {
    return buildBarChart({
      title: record.title,
      description: typeof record.description === 'string' ? record.description : null,
      valueFormat:
        typeof record.valueFormat === 'string'
          ? (record.valueFormat as BarChartValueFormat)
          : undefined,
      valueLabel: typeof record.valueLabel === 'string' ? record.valueLabel : null,
      currency: typeof record.currency === 'string' ? record.currency : null,
      data: record.data as BarChartDatum[],
    });
  } catch {
    return null;
  }
}

/** Reads `{ chart }` from a successful `hexa_chart_bar` tool result. */
export function barChartFromResult(value: unknown): BarChartSpec | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return parseBarChart((value as Record<string, unknown>).chart);
}
