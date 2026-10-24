import {
  barChartFromResult,
  buildBarChart,
  InvalidBarChartError,
  MAX_BAR_CHART_POINTS,
  parseBarChart,
} from './bar-chart.js';

describe('buildBarChart', () => {
  it('builds a normalized bar chart with number formatting by default', () => {
    expect(
      buildBarChart({
        title: '  Citas por día  ',
        valueLabel: ' Citas ',
        data: [
          { label: ' Lun ', value: 8 },
          { label: 'Mar', value: 5 },
        ],
      }),
    ).toEqual({
      type: 'bar',
      title: 'Citas por día',
      description: null,
      valueFormat: 'number',
      valueLabel: 'Citas',
      currency: null,
      data: [
        { label: 'Lun', value: 8 },
        { label: 'Mar', value: 5 },
      ],
    });
  });

  it('defaults the currency to CLP when the format is currency', () => {
    const chart = buildBarChart({
      title: 'Caja por método',
      valueFormat: 'currency',
      data: [{ label: 'Efectivo', value: 15000 }],
    });

    expect(chart.currency).toBe('CLP');
  });

  it('normalizes a custom currency code and keeps percentages unitless', () => {
    expect(
      buildBarChart({
        title: 'Cobros',
        valueFormat: 'currency',
        currency: ' usd ',
        data: [{ label: 'Enero', value: 10 }],
      }).currency,
    ).toBe('USD');

    expect(
      buildBarChart({
        title: 'Conversión',
        valueFormat: 'percent',
        currency: 'USD',
        data: [{ label: 'Aprobados', value: 42.5 }],
      }).currency,
    ).toBeNull();
  });

  it('rejects an empty title', () => {
    expect(() => buildBarChart({ title: '   ', data: [{ label: 'A', value: 1 }] })).toThrow(
      InvalidBarChartError,
    );
  });

  it('rejects an empty dataset', () => {
    expect(() => buildBarChart({ title: 'Vacío', data: [] })).toThrow(InvalidBarChartError);
  });

  it('rejects more points than the limit', () => {
    const data = Array.from({ length: MAX_BAR_CHART_POINTS + 1 }, (_, index) => ({
      label: `Categoría ${index + 1}`,
      value: index,
    }));

    expect(() => buildBarChart({ title: 'Demasiadas', data })).toThrow(InvalidBarChartError);
  });

  it('rejects duplicate labels after trimming', () => {
    expect(() =>
      buildBarChart({
        title: 'Duplicados',
        data: [
          { label: 'Lun', value: 1 },
          { label: ' Lun ', value: 2 },
        ],
      }),
    ).toThrow(/duplicate chart label/);
  });

  it('rejects non-finite values', () => {
    expect(() =>
      buildBarChart({ title: 'Inválido', data: [{ label: 'A', value: Number.NaN }] }),
    ).toThrow(InvalidBarChartError);
  });

  it('rejects an invalid currency code', () => {
    expect(() =>
      buildBarChart({
        title: 'Moneda',
        valueFormat: 'currency',
        currency: 'PESOS',
        data: [{ label: 'A', value: 1 }],
      }),
    ).toThrow(InvalidBarChartError);
  });
});

describe('parseBarChart', () => {
  it('re-parses a valid persisted spec', () => {
    const chart = buildBarChart({
      title: 'Citas por día',
      valueFormat: 'number',
      valueLabel: 'Citas',
      data: [{ label: 'Lun', value: 8 }],
    });

    expect(parseBarChart(chart)).toEqual(chart);
  });

  it('returns null for malformed specs', () => {
    expect(parseBarChart(null)).toBeNull();
    expect(parseBarChart({ type: 'line', title: 'X', data: [] })).toBeNull();
    expect(
      parseBarChart({ type: 'bar', title: 'X', data: [{ label: 'A', value: 'no' }] }),
    ).toBeNull();
  });
});

describe('barChartFromResult', () => {
  it('reads the chart from a tool result envelope', () => {
    const chart = buildBarChart({
      title: 'Citas por día',
      data: [{ label: 'Lun', value: 8 }],
    });

    expect(barChartFromResult({ chart })).toEqual(chart);
    expect(barChartFromResult({ items: [] })).toBeNull();
  });
});
