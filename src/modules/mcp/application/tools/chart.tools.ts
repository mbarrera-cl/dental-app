import { Ctx, Payload } from '@nestjs/microservices';
import { McpContext, McpController, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import {
  BAR_CHART_VALUE_FORMATS,
  buildBarChart,
  CHART_BAR_TOOL_NAME,
  MAX_BAR_CHART_DESCRIPTION_LENGTH,
  MAX_BAR_CHART_LABEL_LENGTH,
  MAX_BAR_CHART_POINTS,
  MAX_BAR_CHART_TITLE_LENGTH,
  MAX_BAR_CHART_VALUE_LABEL_LENGTH,
} from '../../domain/bar-chart.js';
import { McpToolRunner } from '../base/mcp-tool-runner.js';

const barChartSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(MAX_BAR_CHART_TITLE_LENGTH)
    .describe('Short chart title in the user language, e.g. "Citas por día".'),
  description: z
    .string()
    .trim()
    .max(MAX_BAR_CHART_DESCRIPTION_LENGTH)
    .optional()
    .describe('Optional one-line context, e.g. "Semana del 19 al 25 de octubre".'),
  valueFormat: z
    .enum(BAR_CHART_VALUE_FORMATS)
    .optional()
    .describe(
      'How to format values: number (default), currency (ISO 4217) or percent (values are percentage points, 42.5 = 42,5 %).',
    ),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .optional()
    .describe('ISO 4217 currency for valueFormat=currency. Defaults to CLP.'),
  valueLabel: z
    .string()
    .trim()
    .max(MAX_BAR_CHART_VALUE_LABEL_LENGTH)
    .optional()
    .describe('What the bars measure, e.g. "Citas" or "Monto". Used in the tooltip.'),
  data: z
    .array(
      z.object({
        label: z
          .string()
          .trim()
          .min(1)
          .max(MAX_BAR_CHART_LABEL_LENGTH)
          .describe('Category shown under the bar. Must be unique and short.'),
        value: z.number().finite().describe('Exact numeric value for this category.'),
      }),
    )
    .min(1)
    .max(MAX_BAR_CHART_POINTS)
    .describe('Bars to render, in display order.'),
});

/**
 * Chart renderer for CaroIA. It does not query domain data: the model passes
 * values it already obtained from other Hexa tools, and this tool only
 * validates them and returns a render-ready spec.
 */
@McpController()
export class ChartTools {
  constructor(private readonly runner: McpToolRunner) {}

  @Tool({
    name: CHART_BAR_TOOL_NAME,
    description:
      'Build a responsive bar chart for CaroIA from data already returned by Hexa tools. Use it when the user asks to graph, compare or visualize numbers. Never invent or estimate values; pass exactly the values returned by previous tools. Up to 20 categories: aggregate or show the top categories when there are more. Always accompany the chart with a short text summary.',
    parameters: barChartSchema,
  })
  async bar(
    @Payload() args: z.infer<typeof barChartSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(ctx, { tool: CHART_BAR_TOOL_NAME }, args, async () => ({
      chart: buildBarChart(args),
    }));
  }
}
