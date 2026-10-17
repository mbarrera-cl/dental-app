import { Controller, UseGuards } from '@nestjs/common';
import { McpHttpControllerFor } from '@rekog/mcp-nest';
import { mcpHttpTransport } from '../../mcp.transport.js';
import { McpEnabledGuard } from './mcp-enabled.guard.js';

/**
 * Mounts the MCP Streamable HTTP transport as a real Nest controller. The
 * global `JwtAuthGuard` (APP_GUARD) authenticates every transport request and
 * attaches the principal to the raw request; `resolveUser` then maps it to the
 * MCP auth context.
 */
@Controller('mcp')
@UseGuards(McpEnabledGuard)
export class McpHttpController extends McpHttpControllerFor(mcpHttpTransport) {}
