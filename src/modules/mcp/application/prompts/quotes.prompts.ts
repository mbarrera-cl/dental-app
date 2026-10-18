import { Ctx, Payload } from '@nestjs/microservices';
import { McpContext, McpController, Prompt } from '@rekog/mcp-nest';
import { z } from 'zod';

const budgetSchema = z.object({
  patientRef: z.string().describe('Patient RUT or internal id.'),
  indicaciones: z.string().optional().describe('Clinical or commercial notes from the dentist.'),
});

const quoteSchema = z.object({
  quoteId: z.string().describe('Quotation id (UUID).'),
});

const compareSchema = z.object({
  firstQuoteId: z.string(),
  secondQuoteId: z.string(),
});

/**
 * Reusable prompts for the quotation workflow. They only produce instructions:
 * the model must still call the tools (and ask the human before any write).
 */
@McpController()
export class QuotesPrompts {
  @Prompt({
    name: 'presupuesto_desde_arancel',
    description:
      'Guide the model to build a quotation from the UCO catalog, showing the summary before creating it.',
    parameters: budgetSchema,
  })
  async budgetFromCatalog(
    @Payload() { patientRef, indicaciones }: z.infer<typeof budgetSchema>,
    @Ctx() _ctx: McpContext,
  ) {
    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Build a dental quotation for patient ${patientRef}.`,
              'Steps:',
              '1. Call hexa_patients_get or hexa_patients_search to identify the patient.',
              '2. Call hexa_uco_search with the relevant procedures and pick the exact codes; each result includes the suggested CLP price (unitPrice computed with the configured UCO rate).',
              '3. Propose the lines (code, quantity, tooth if applicable) and ask the human to confirm prices and quantities.',
              '4. Only after explicit confirmation, call hexa_quotes_create with patientId/patientRut and the agreed lines.',
              'Never invent prices: omit unitPrice so the server derives it from the UCO rate.',
              indicaciones ? `Dentist notes: ${indicaciones}` : '',
            ].join('\n'),
          },
        },
      ],
    };
  }

  @Prompt({
    name: 'resumen_presupuesto',
    description: 'Summarize a quotation: patient, status, totals and lines.',
    parameters: quoteSchema,
  })
  async summarize(@Payload() { quoteId }: z.infer<typeof quoteSchema>, @Ctx() _ctx: McpContext) {
    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Call hexa_quotes_get with quoteId ${quoteId}.`,
              'Summarize: patient, folio, status, validity, total and each line (description, quantity, unit price, line total, status).',
              'Do not modify the quotation.',
            ].join('\n'),
          },
        },
      ],
    };
  }

  @Prompt({
    name: 'comparar_presupuestos',
    description: 'Compare two quotations line by line and highlight the differences.',
    parameters: compareSchema,
  })
  async compare(
    @Payload() { firstQuoteId, secondQuoteId }: z.infer<typeof compareSchema>,
    @Ctx() _ctx: McpContext,
  ) {
    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Call hexa_quotes_get twice: ${firstQuoteId} and ${secondQuoteId}.`,
              'Compare status, totals, and each line by description/UCO code: quantity, unit price and line total.',
              'Return a concise table and call out additions, removals and price changes. Do not modify either quotation.',
            ].join('\n'),
          },
        },
      ],
    };
  }
}
