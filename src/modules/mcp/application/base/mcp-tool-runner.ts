import { Injectable, Logger } from '@nestjs/common';
import type { McpContext } from '@rekog/mcp-nest';
import { ApiKeyAuthenticatorPort } from '../../../../shared/security/api-key-authenticator.port.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { ActivityRecorder } from '../../../activity/application/record-activity.service.js';
import { SettingsService } from '../../../settings/application/settings.service.js';

export interface McpRunOptions {
  /** Stable tool name, e.g. `hexa_quotes_create`. */
  tool: string;
  /** Permissions required to invoke the tool. */
  permissions?: readonly string[];
  match?: 'all' | 'any';
  /** Writes require `mcp.allowWrites` plus the per-key rate limit. */
  write?: boolean;
  /** Sensitive actions require `confirm: true` when the admin setting is on. */
  confirm?: boolean;
  /** Optional subject for the activity trail (e.g. the quote that was touched). */
  subject?: (result: unknown) => { type: string; id: string | null; label: string | null } | null;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

interface RawHttpRequest {
  user?: Principal;
  ip?: string;
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
}

const WRITE_WINDOW_MS = 60_000;

/**
 * Single execution path for every MCP tool: resolve the caller (HTTP request
 * principal or the STDIO environment key), enforce permissions and write
 * safety, redact PII when configured, and append the call to the activity
 * trail. It never leaks stack traces to the model.
 */
@Injectable()
export class McpToolRunner {
  private readonly logger = new Logger(McpToolRunner.name);
  private readonly writeWindows = new Map<string, number[]>();

  constructor(
    private readonly settings: SettingsService,
    private readonly activity: ActivityRecorder,
    private readonly apiKeys: ApiKeyAuthenticatorPort,
  ) {}

  async run<T>(
    ctx: McpContext,
    options: McpRunOptions,
    args: unknown,
    handler: (actor: Principal) => Promise<T>,
  ): Promise<McpToolResult> {    const raw = ctx.getRawRequest<RawHttpRequest>();
    const transport = raw === undefined ? 'stdio' : 'http';
    let actor: Principal | null = null;

    try {
      actor = await this.resolvePrincipal(raw);

      if (actor === null) {
        throw new Error(
          transport === 'stdio'
            ? 'HEXA_MCP_API_KEY is missing or invalid. Generate an API key and restart the STDIO server.'
            : 'Authentication required.',
        );
      }

      this.assertPermissions(actor, options);

      if (options.write === true) {
        await this.assertWritesAllowed(actor, options, args);
      }

      const result = await handler(actor);
      const redact = await this.settings.getBoolean('mcp.redactPii');
      const presented = redact ? redactPii(result) : result;

      await this.record(actor, raw, options, 'success', result);

      return {
        content: [{ type: 'text', text: JSON.stringify(presented, null, 2) }],
      };
    } catch (error) {
      await this.record(actor, raw, options, 'failure', null);

      return {
        isError: true,
        content: [{ type: 'text', text: errorMessage(error) }],
      };
    }
  }

  /** Effective `mcp.maxResults`, used as the default page size of list tools. */
  async maxResults(): Promise<number> {
    return this.settings.getNumber('mcp.maxResults');
  }

  private async resolvePrincipal(raw: RawHttpRequest | undefined): Promise<Principal | null> {
    if (raw !== undefined) {
      return raw.user ?? null;
    }

    const key = process.env.HEXA_MCP_API_KEY?.trim();

    if (key === undefined || key === '') {
      return null;
    }

    return this.apiKeys.authenticate(key);
  }

  private assertPermissions(actor: Principal, options: McpRunOptions): void {
    const required = options.permissions ?? [];

    if (required.length === 0) {
      return;
    }

    const allowed =
      options.match === 'any'
        ? required.some((permission) => actor.permissions.has(permission))
        : required.every((permission) => actor.permissions.has(permission));

    if (!allowed) {
      throw new Error(
        `Missing permission${required.length === 1 ? '' : 's'}: ${required.join(', ')}.`,
      );
    }
  }

  private async assertWritesAllowed(
    actor: Principal,
    options: McpRunOptions,
    args: unknown,
  ): Promise<void> {
    if (!(await this.settings.getBoolean('mcp.allowWrites'))) {
      throw new Error(
        'Write tools are disabled by the administrator (setting mcp.allowWrites).',
      );
    }

    const requireConfirmation = await this.settings.getBoolean('mcp.requireConfirmation');

    const confirmed = (args as { confirm?: unknown } | undefined)?.confirm === true;

    if (options.confirm === true && requireConfirmation && !confirmed) {
      throw new Error(
        'This action requires explicit human confirmation. Call the tool again with confirm: true after the user approves the summary.',
      );
    }

    const limit = await this.settings.getNumber('mcp.writeRateLimitPerMinute');
    const key = actor.apiKeyId ?? actor.userId;
    const now = Date.now();
    const window = (this.writeWindows.get(key) ?? []).filter((at) => now - at < WRITE_WINDOW_MS);

    if (window.length >= limit) {
      throw new Error(
        `Write rate limit exceeded (${limit}/minute for this API key). Wait a minute or revoke the key.`,
      );
    }

    window.push(now);
    this.writeWindows.set(key, window);
  }

  private async record(
    actor: Principal | null,
    raw: RawHttpRequest | undefined,
    options: McpRunOptions,
    outcome: 'success' | 'failure',
    result: unknown,
  ): Promise<void> {
    try {
      const subject = result === null ? null : (options.subject?.(result) ?? null);

      await this.activity.record({
        actor:
          actor === null
            ? { id: null, type: 'anonymous', label: 'mcp' }
            : { id: actor.userId, type: actor.type },
        action: `mcp.${options.tool}`,
        module: 'mcp',
        outcome,
        statusCode: null,
        method: 'MCP',
        path: `mcp://tools/${options.tool}`,
        route: null,
        subject,
        ip: raw?.ip ?? raw?.socket?.remoteAddress ?? null,
        userAgent: userAgentOf(raw),
        metadata: { transport: raw === undefined ? 'stdio' : 'http' },
      });
    } catch (error) {
      this.logger.warn(
        `Could not audit MCP tool "${options.tool}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected MCP tool error.';
}

function userAgentOf(raw: RawHttpRequest | undefined): string | null {
  const header = raw?.headers?.['user-agent'];

  if (typeof header === 'string') {
    return header;
  }

  return Array.isArray(header) ? (header[0] ?? null) : null;
}

/** Masks common patient identifiers; leaves ids and names untouched. */
function redactPii(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactPii);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const output: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (typeof child === 'string' && /rut|email|telefono|phone|contacto/i.test(key)) {
      output[key] = mask(key, child);
      continue;
    }

    output[key] = redactPii(child);
  }

  return output;
}

function mask(key: string, value: string): string {
  if (/email/i.test(key)) {
    const [local, domain] = value.split('@');

    return domain === undefined ? '***' : `${local.slice(0, 1)}***@${domain}`;
  }

  if (/telefono|phone/i.test(key)) {
    return '+56 9 **** ****';
  }

  // RUT: keep the first two and last two characters.
  if (value.length <= 4) {
    return '***';
  }

  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}
