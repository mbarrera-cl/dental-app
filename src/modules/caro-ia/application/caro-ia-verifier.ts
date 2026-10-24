import { Injectable } from '@nestjs/common';

export const CARO_IA_REFUSAL =
  'No puedo responder eso. Solo uso la información del MCP de Hexa (presupuestos, pacientes, arancel UCO, actividad y cálculos simples). Prueba con una consulta sobre esos datos.';

export const CARO_IA_GREETING = `¡Hola! Soy **CaroIA**, la asistente de presupuestos de Hexa. Puedo ayudarte con:

- **Presupuestos**: buscar, revisar y preparar borradores o cambios (con tu aprobación antes de escribir).
- **Pacientes**: encontrar fichas y revisar sus datos.
- **Arancel UCO**: consultar precios y códigos.
- **Actividad**: ver las acciones recientes en Hexa.
- **Gráficos**: barras responsivas con los datos de Hexa.
- **Cálculos**: sumar, promediar, o sacar máximo, mínimo y mediana de una lista de valores.

¿Sobre qué te ayudo hoy?`;

export interface VerificationInput {
  content: string;
  /** Successful MCP tool results used for this turn. */
  evidence: readonly unknown[];
  noAnswer: boolean;
  /** The turn was pure small talk (greeting, thanks, capabilities question). */
  greeting: boolean;
  /** A successful hexa_chart_bar call produced a renderable chart. */
  hasChart?: boolean;
}

export interface VerificationResult {
  ok: boolean;
  content: string;
  reason: string | null;
}

/**
 * Deterministic, always-on answer verifier. CaroIA may only answer when the
 * turn produced at least one successful MCP result; refusals and the canned
 * greeting are the only allowed exceptions. A model cannot turn general
 * knowledge into an answer because the only path to a final message with
 * evidence is through the catalog.
 */
@Injectable()
export class CaroIaAnswerVerifier {
  verify(input: VerificationInput): VerificationResult {
    if (input.noAnswer) {
      return { ok: false, content: CARO_IA_REFUSAL, reason: 'no_answer' };
    }

    if (input.greeting) {
      return { ok: false, content: CARO_IA_GREETING, reason: 'greeting' };
    }

    if (input.evidence.length === 0) {
      return { ok: false, content: CARO_IA_REFUSAL, reason: 'missing_mcp_evidence' };
    }

    if (input.content.trim() === '') {
      if (input.hasChart === true) {
        return { ok: true, content: 'Aquí está el gráfico.', reason: null };
      }

      return { ok: false, content: CARO_IA_REFUSAL, reason: 'empty_answer' };
    }

    return { ok: true, content: input.content.trim(), reason: null };
  }
}
