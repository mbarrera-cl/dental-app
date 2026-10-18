import { Ctx, Payload } from '@nestjs/microservices';
import { McpContext, McpController, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import {
  CALC_OPERATIONS,
  calculate,
  type CalcOperation,
} from '../../domain/calc.js';
import { McpToolRunner } from '../base/mcp-tool-runner.js';

const evaluateSchema = z.object({
  operation: z
    .enum(CALC_OPERATIONS)
    .describe(
      'Operation to apply: sum, mean, min, max, count, median, range (max-min) or stddev.',
    ),
  values: z
    .array(z.number().finite())
    .min(1)
    .max(1000)
    .describe('Finite numbers to operate on, e.g. quote line totals.'),
});

@McpController()
export class CalcTools {
  constructor(private readonly runner: McpToolRunner) {}

  @Tool({
    name: 'hexa_calc',
    description:
      'Deterministic calculator over a list of numbers: sum, mean, min, max, count, median, range or stddev. Use it instead of computing arithmetic mentally so the result is exact.',
    parameters: evaluateSchema,
  })
  async evaluate(
    @Payload() args: z.infer<typeof evaluateSchema>,
    @Ctx() ctx: McpContext,
  ) {
    return this.runner.run(ctx, { tool: 'hexa_calc' }, args, async () => {
      const outcome = calculate(args.operation as CalcOperation, args.values);

      return {
        operation: outcome.operation,
        values: outcome.values,
        result: outcome.result,
      };
    });
  }
}
