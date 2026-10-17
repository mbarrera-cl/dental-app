import { Injectable } from '@nestjs/common';

export const CARO_IA_REFUSAL =
  'No puedo responder eso. Solo uso la información del MCP de Hexa (presupuestos, pacientes, arancel UCO y actividad). Prueba con una consulta sobre esos datos.';

export interface VerificationInput {
  content: string;
  /** Successful MCP tool results used for this turn. */
  evidence: readonly unknown[];
  noAnswer: boolean;
}

export interface VerificationResult {
  ok: boolean;
  content: string;
  reason: string | null;
}

/**
 * Deterministic, always-on answer verifier. CaroIA may only answer when the
 * turn produced at least one successful MCP result; refusals are the only
 * allowed exception. A model cannot turn general knowledge into an answer
 * because the only path to a final message with evidence is through the
 * catalog.
 */
@Injectable()
export class CaroIaAnswerVerifier {
  verify(input: VerificationInput): VerificationResult {
    if (input.noAnswer) {
      return { ok: false, content: CARO_IA_REFUSAL, reason: 'no_answer' };
    }

    if (input.evidence.length === 0) {
      return { ok: false, content: CARO_IA_REFUSAL, reason: 'missing_mcp_evidence' };
    }

    if (input.content.trim() === '') {
      return { ok: false, content: CARO_IA_REFUSAL, reason: 'empty_answer' };
    }

    return { ok: true, content: input.content.trim(), reason: null };
  }
}
