import { CARO_IA_GREETING, CaroIaAnswerVerifier, CARO_IA_REFUSAL } from './caro-ia-verifier.js';

describe('CaroIaAnswerVerifier', () => {
  const verifier = new CaroIaAnswerVerifier();

  it('accepts an answer backed by at least one MCP result', () => {
    expect(
      verifier.verify({
        content: 'Hay 3 presupuestos.',
        evidence: [{ items: [] }],
        noAnswer: false,
        greeting: false,
      }),
    ).toEqual({ ok: true, content: 'Hay 3 presupuestos.', reason: null });
  });

  it('replaces an answer with no MCP evidence', () => {
    expect(
      verifier.verify({
        content: 'La capital de Chile es Santiago.',
        evidence: [],
        noAnswer: false,
        greeting: false,
      }),
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
      greeting: false,
    });

    expect(result.ok).toBe(false);
    expect(result.content).toBe(CARO_IA_REFUSAL);
    expect(result.reason).toBe('no_answer');
  });

  it('honours the greeting tool without requiring MCP evidence', () => {
    const result = verifier.verify({
      content: '',
      evidence: [],
      noAnswer: false,
      greeting: true,
    });

    expect(result.ok).toBe(false);
    expect(result.content).toBe(CARO_IA_GREETING);
    expect(result.reason).toBe('greeting');
  });

  it('prefers the refusal when no_answer and greeting both fire', () => {
    expect(
      verifier.verify({
        content: '',
        evidence: [],
        noAnswer: true,
        greeting: true,
      }).content,
    ).toBe(CARO_IA_REFUSAL);
  });

  it('replaces model text with the canned greeting even when evidence exists', () => {
    const result = verifier.verify({
      content: 'Texto improvisado.',
      evidence: [{ items: [] }],
      noAnswer: false,
      greeting: true,
    });

    expect(result.ok).toBe(false);
    expect(result.content).toBe(CARO_IA_GREETING);
  });

  it('rejects an empty answer even when evidence exists', () => {
    expect(
      verifier.verify({
        content: '   ',
        evidence: [{}],
        noAnswer: false,
        greeting: false,
      }).reason,
    ).toBe('empty_answer');
  });

  it('keeps a chart-only turn with a short caption', () => {
    expect(
      verifier.verify({
        content: '   ',
        evidence: [{ chart: { type: 'bar' } }],
        noAnswer: false,
        greeting: false,
        hasChart: true,
      }),
    ).toEqual({ ok: true, content: 'Aquí está el gráfico.', reason: null });
  });
});
