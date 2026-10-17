import type { McpContext } from '@rekog/mcp-nest';
import type { ApiKeyAuthenticatorPort } from '../../../../shared/security/api-key-authenticator.port.js';
import type { Principal } from '../../../../shared/security/principal.js';
import type { ActivityRecorder } from '../../../activity/application/record-activity.service.js';
import type { SettingsService } from '../../../settings/application/settings.service.js';
import { McpToolRunner } from './mcp-tool-runner.js';

const actor: Principal = {
  type: 'apikey',
  userId: 'user-1',
  name: 'Ana',
  apiKeyId: 'key-1',
  permissions: new Set(['quotes:read']),
  roles: [{ id: 'role-1', name: 'admin' }],
};

function httpContext(principal: Principal | undefined = actor): McpContext {
  return {
    getRawRequest: () => ({ user: principal, ip: '10.0.0.1', headers: { 'user-agent': 'vitest' } }),
  } as unknown as McpContext;
}

function stdioContext(): McpContext {
  return { getRawRequest: () => undefined } as unknown as McpContext;
}

function settingsWith(overrides: Record<string, boolean | number> = {}): SettingsService {
  return {
    getBoolean: async (key: string) => (overrides[key] as boolean | undefined) ?? false,
    getNumber: async (key: string) => (overrides[key] as number | undefined) ?? 20,
  } as unknown as SettingsService;
}

function recorder(): ActivityRecorder & { record: ReturnType<typeof vi.fn> } {
  return { record: vi.fn(async () => true) } as unknown as ActivityRecorder & {
    record: ReturnType<typeof vi.fn>;
  };
}

function apiKeys(principal: Principal | null = actor): ApiKeyAuthenticatorPort {
  return { authenticate: vi.fn(async () => principal) } as unknown as ApiKeyAuthenticatorPort;
}

describe('McpToolRunner', () => {
  it('executes an authorized tool and audits the success', async () => {
    const activity = recorder();
    const runner = new McpToolRunner(settingsWith(), activity, apiKeys());

    const result = await runner.run(
      httpContext(),
      { tool: 'hexa_quotes_get', permissions: ['quotes:read'] },
      {},
      async (principal) => ({ owner: principal.userId }),
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('user-1');
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'mcp.hexa_quotes_get',
        module: 'mcp',
        outcome: 'success',
        method: 'MCP',
        metadata: { transport: 'http' },
      }),
    );
  });

  it('denies a tool when the API key lacks the permission', async () => {
    const activity = recorder();
    const runner = new McpToolRunner(settingsWith(), activity, apiKeys());

    const result = await runner.run(
      httpContext(),
      { tool: 'hexa_quotes_create', permissions: ['quotes:create'] },
      {},
      async () => ({ ok: true }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Missing permission');
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' }),
    );
  });

  it('blocks writes while mcp.allowWrites is off', async () => {
    const runner = new McpToolRunner(settingsWith(), recorder(), apiKeys());

    const result = await runner.run(
      httpContext(),
      { tool: 'hexa_quotes_create', permissions: ['quotes:read'], write: true },
      {},
      async () => ({ ok: true }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('mcp.allowWrites');
  });

  it('requires confirm: true for sensitive writes', async () => {
    const runner = new McpToolRunner(
      settingsWith({ 'mcp.allowWrites': true, 'mcp.requireConfirmation': true }),
      recorder(),
      apiKeys(),
    );

    const blocked = await runner.run(
      httpContext(),
      { tool: 'hexa_quotes_sanction', permissions: ['quotes:read'], write: true, confirm: true },
      { quoteId: 'q-1' },
      async () => ({ ok: true }),
    );
    expect(blocked.isError).toBe(true);
    expect(blocked.content[0]?.text).toContain('confirm: true');

    const allowed = await runner.run(
      httpContext(),
      { tool: 'hexa_quotes_sanction', permissions: ['quotes:read'], write: true, confirm: true },
      { quoteId: 'q-1', confirm: true },
      async () => ({ ok: true }),
    );
    expect(allowed.isError).toBeUndefined();
  });

  it('enforces the per-key write rate limit', async () => {
    const runner = new McpToolRunner(
      settingsWith({
        'mcp.allowWrites': true,
        'mcp.requireConfirmation': false,
        'mcp.writeRateLimitPerMinute': 1,
      }),
      recorder(),
      apiKeys(),
    );
    const options = { tool: 'hexa_quotes_create', write: true } as const;

    const first = await runner.run(httpContext(), options, {}, async () => ({ ok: true }));
    const second = await runner.run(httpContext(), options, {}, async () => ({ ok: true }));

    expect(first.isError).toBeUndefined();
    expect(second.isError).toBe(true);
    expect(second.content[0]?.text).toContain('rate limit');
  });

  it('redacts patient identifiers when mcp.redactPii is on', async () => {
    const runner = new McpToolRunner(
      settingsWith({ 'mcp.redactPii': true }),
      recorder(),
      apiKeys(),
    );

    const result = await runner.run(
      httpContext(),
      { tool: 'hexa_patients_get', permissions: ['quotes:read'] },
      {},
      async () => ({ patient: { rut: '12345678-5', email: 'camila@example.com', name: 'Camila' } }),
    );
    const text = result.content[0]?.text ?? '';

    expect(text).toContain('12***-5');
    expect(text).toContain('c***@example.com');
    expect(text).toContain('Camila');
    expect(text).not.toContain('12345678-5');
  });

  it('authenticates STDIO calls from the environment API key', async () => {
    const previous = process.env.HEXA_MCP_API_KEY;
    process.env.HEXA_MCP_API_KEY = 'hexa_test';
    const authenticate = vi.fn(async () => actor);
    const keys = { authenticate } as unknown as ApiKeyAuthenticatorPort;
    const activity = recorder();
    const runner = new McpToolRunner(settingsWith(), activity, keys);

    try {
      const result = await runner.run(
        stdioContext(),
        { tool: 'hexa_whoami' },
        {},
        async (principal) => ({ owner: principal.userId }),
      );

      expect(result.isError).toBeUndefined();
      expect(authenticate).toHaveBeenCalledWith('hexa_test');
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { transport: 'stdio' } }),
      );
    } finally {
      if (previous === undefined) {
        delete process.env.HEXA_MCP_API_KEY;
      } else {
        process.env.HEXA_MCP_API_KEY = previous;
      }
    }
  });
});
