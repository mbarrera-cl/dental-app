import { describe, expect, it } from 'vitest';
import { clampPage, pageCount, slicePage } from './pagination';

describe('pagination helpers', () => {
  it('counts pages with a minimum of one', () => {
    expect(pageCount(0, 10)).toBe(1);
    expect(pageCount(1, 10)).toBe(1);
    expect(pageCount(10, 10)).toBe(1);
    expect(pageCount(11, 10)).toBe(2);
    expect(pageCount(25, 25)).toBe(1);
  });

  it('clamps a page into the valid range', () => {
    expect(clampPage(0, 25, 10)).toBe(1);
    expect(clampPage(3, 25, 10)).toBe(3);
    expect(clampPage(9, 25, 10)).toBe(3);
    expect(clampPage(2, 0, 10)).toBe(1);
  });

  it('slices the requested page with the envelope metadata', () => {
    const items = Array.from({ length: 25 }, (_, index) => index);

    expect(slicePage(items, 1, 10)).toEqual({
      items: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      total: 25,
      limit: 10,
      offset: 0,
    });
    expect(slicePage(items, 3, 10).items).toEqual([20, 21, 22, 23, 24]);
    expect(slicePage(items, 3, 10).offset).toBe(20);
    // Out-of-range pages clamp instead of returning an empty slice.
    expect(slicePage(items, 99, 10).offset).toBe(20);
  });
});
