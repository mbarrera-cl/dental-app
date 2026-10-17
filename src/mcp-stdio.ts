import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { mcpStdioStrategy } from './modules/mcp/mcp.strategy.stdio.js';

/**
 * STDIO entrypoint for local MCP clients. It reuses the full application
 * (same database, use cases and settings) but speaks MCP over stdin/stdout,
 * so stdout is reserved for the protocol and Nest logging is disabled.
 *
 * Requires `HEXA_MCP_API_KEY`; the key is re-validated on every tool call, so
 * revoking it takes effect immediately.
 */
async function bootstrap(): Promise<void> {
  if ((process.env.HEXA_MCP_API_KEY ?? '').trim() === '') {
    process.stderr.write(
      'HEXA_MCP_API_KEY is required for the STDIO MCP server. Create an API key in Hexa and export it.\n',
    );
    process.exit(1);
  }

  const app = await NestFactory.createMicroservice(AppModule, {
    strategy: mcpStdioStrategy,
    logger: false,
  });

  await app.listen();
}

await bootstrap();
