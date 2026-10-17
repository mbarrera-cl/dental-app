import { CaroIaAnswerVerifier, CARO_IA_REFUSAL } from './caro-ia-verifier.js';

describe('CaroIaAnswerVerifier', () => {
  const verifier = new CaroIaAnswerVerifier();

  it('accepts an answer backed by at least one MCP result', () => {
    expect(
      verifier.verify({ content: 'Hay 3 presupuestos.', evidence: [{ items: [] }], noAnswer: false }),
    ).toEqual({ ok: true, content: 'Hay 3 presupuestos.', reason: null });
  });

  it('replaces an answer with no MCP evidence', () => {
    expect(
      verifier.verify({ content: 'La capital de Chile es Santiago.', evidence: [], noAnswer: false }),
    ).toEqual({
      ok: false,
      content: CARO_IA_REFUSAL,
      reason: 'missing_mcp_evidence',
    });
  });

  it('honours the no_answer tool', () => {
    const result = verifier.verify({
      content: 'Puedo responder eso.',
      evidence: [{ items: [] }],
      noAnswer: true,
    });

    expect(result.ok).toBe(false);
    expect(result.content).toBe(CARO_IA_REFUSAL);
    expect(result.reason).toBe('no_answer');
  });

  it('rejects an empty answer even when evidence exists', () => {
    expect(
      verifier.verify({ content: '   ', evidence: [{}], noAnswer: false }).reason,
    ).toBe('empty_answer');
  });
});
