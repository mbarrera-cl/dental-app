import {
  calculate,
  EmptyCalcValuesError,
  InvalidCalcOperationError,
  NonFiniteCalcValueError,
} from './calc.js';

describe('calculate', () => {
  it('sums a list of values', () => {
    expect(calculate('sum', [1, 2, 3.5])).toEqual({
      operation: 'sum',
      values: [1, 2, 3.5],
      result: 6.5,
    });
  });

  it('computes the mean', () => {
    expect(calculate('mean', [10, 20, 30]).result).toBe(20);
  });

  it('finds the minimum and the maximum', () => {
    expect(calculate('min', [7, 2, 9]).result).toBe(2);
    expect(calculate('max', [7, 2, 9]).result).toBe(9);
  });

  it('counts the values', () => {
    expect(calculate('count', [4, 5, 6, 7]).result).toBe(4);
  });

  it('computes the median of an odd list', () => {
    expect(calculate('median', [9, 1, 5]).result).toBe(5);
  });

  it('computes the median of an even list without mutating the input', () => {
    const values = [8, 2, 6, 4];

    expect(calculate('median', values).result).toBe(5);
    expect(values).toEqual([8, 2, 6, 4]);
  });

  it('computes the range between extremes', () => {
    expect(calculate('range', [7, 2, 9]).result).toBe(7);
  });

  it('computes the population standard deviation', () => {
    expect(calculate('stddev', [2, 4, 4, 4, 5, 5, 7, 9]).result).toBeCloseTo(2);
  });

  it('returns 0 stddev when all values are equal', () => {
    expect(calculate('stddev', [5, 5, 5]).result).toBe(0);
  });

  it('rejects an unknown operation', () => {
    expect(() => calculate('power' as never, [1, 2])).toThrow(
      InvalidCalcOperationError,
    );
  });

  it('rejects an empty list', () => {
    expect(() => calculate('sum', [])).toThrow(EmptyCalcValuesError);
  });

  it('rejects non-finite numbers', () => {
    expect(() => calculate('sum', [1, Number.NaN])).toThrow(
      NonFiniteCalcValueError,
    );
    expect(() => calculate('sum', [Number.POSITIVE_INFINITY])).toThrow(
      NonFiniteCalcValueError,
    );
  });
});
