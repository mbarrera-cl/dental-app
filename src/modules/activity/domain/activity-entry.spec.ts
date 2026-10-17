import {
  DEFAULT_ACTIVITY_LIMIT,
  MAX_ACTIVITY_LIMIT,
  decodeActivityCursor,
  encodeActivityCursor,
  normalizeActivityLimit,
} from './activity-entry.js';

describe('activity entry helpers', () => {
  it('round-trips a keyset cursor', () => {
    const cursor = encodeActivityCursor({ at: '2026-10-17T12:00:00.000Z', id: 'abc-123' });

    expect(cursor).not.toContain('|');
    expect(decodeActivityCursor(cursor)).toEqual({
      at: '2026-10-17T12:00:00.000Z',
      id: 'abc-123',
    });
  });

  it('rejects malformed cursors instead of throwing', () => {
    expect(decodeActivityCursor('not-base64!!')).toBeNull();
    expect(decodeActivityCursor('')).toBeNull();
  });

  it('clamps the page size', () => {
    expect(normalizeActivityLimit(undefined)).toBe(DEFAULT_ACTIVITY_LIMIT);
    expect(normalizeActivityLimit(Number.NaN)).toBe(DEFAULT_ACTIVITY_LIMIT);
    expect(normalizeActivityLimit(0)).toBe(1);
    expect(normalizeActivityLimit(500)).toBe(MAX_ACTIVITY_LIMIT);
    expect(normalizeActivityLimit(25.9)).toBe(25);
  });
});
