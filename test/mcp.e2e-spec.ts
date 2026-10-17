import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { configureMcp } from './../src/shared/infrastructure/mcp-setup.js';
import { SqliteDatabase } from './../src/shared/infrastructure/database/sqlite-database.js';
import { clearE2eAdminCredentials, loginAsAdmin, useE2eAdminCredentials } from './helpers/auth.js';

interface McpResponse {
  jsonrpc: '2.0';
  id: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
    isError?: boolean;
    tools?: Array<{ name: string }>;
    serverInfo?: { name: string };
  };
  error?: { code: number; message: string };
}

describe('MCP server (e2e)', () => {
  let app: INestApplication<App>;
  let database: SqliteDatabase;
  let authorization: string;
  let apiKey: string;

  beforeAll(async () => {
    useE2eAdminCredentials();
    process.env.MCP_ENABLED = 'true';

    database = new SqliteDatabase(':memory:');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SqliteDatabase)
      .useValue(database)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, { swagger: false });
    await app.init();
    await configureMcp(app);

    authorization = await loginAsAdmin(app);

    const created = await request(app.getHttpServer())
      .post('/apikeys')
      .set('Authorization', authorization)
      .send({
        name: 'MCP e2e',
        scopes: [
          'patients:read',
          'uco:read',
          'quotes:read',
          'quotes:create',
          'quotes:update',
          'quotes:approve',
          'quotes:delete',
          'activity:read',
        ],
      })
      .expect(201);

    apiKey = (created.body as { key: string }).key;
  });

  afterAll(async () => {
    await app.close();
    database.onModuleDestroy();
    clearE2eAdminCredentials();
    delete process.env.MCP_ENABLED;
  });

  function mcp(method: string, params?: unknown, key: string | null = apiKey) {
    const call = request(app.getHttpServer())
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method, params });

    return key === null ? call : call.set('Authorization', `Bearer ${key}`);
  }

  function textOf(response: { body: McpResponse }): string {
    return response.body.result?.content?.[0]?.text ?? '';
  }

  it('rejects unauthenticated transport requests', async () => {
    await mcp('tools/list', undefined, null).expect(401);
  });

  it('initializes and lists the quotation tools', async () => {
    const initialize = await mcp('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'vitest', version: '1.0.0' },
    }).expect(200);

    expect((initialize.body as McpResponse).result?.serverInfo?.name).toBe('hexa-dental');

    const list = await mcp('tools/list').expect(200);
    const names = ((list.body as McpResponse).result?.tools ?? []).map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'hexa_whoami',
        'hexa_patients_search',
        'hexa_uco_search',
        'hexa_quotes_list',
        'hexa_quotes_get',
        'hexa_quotes_create',
        'hexa_quotes_sanction',
        'hexa_activity_list',
      ]),
    );
  });

  it('reports the effective API key scopes', async () => {
    const whoami = await mcp('tools/call', { name: 'hexa_whoami', arguments: {} }).expect(200);
    const body = JSON.parse(textOf(whoami)) as { type: string; permissions: string[] };

    expect(body.type).toBe('apikey');
    expect(body.permissions).toEqual(expect.arrayContaining(['quotes:read', 'quotes:create']));
  });

  it('blocks writes until mcp.allowWrites is enabled', async () => {
    const patient = await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', authorization)
      .send({
        rut: '12.345.678-5',
        nombres: 'Camila',
        apellidoPaterno: 'Rojas',
        apellidoMaterno: 'Pérez',
        fechaNacimiento: '1990-05-17',
        sexo: 'femenino',
      })
      .expect(201);

    const blocked = await mcp('tools/call', {
      name: 'hexa_quotes_create',
      arguments: {
        patientId: (patient.body as { id: string }).id,
        items: [{ description: 'Consulta', quantity: 1, unitPrice: 1000 }],
      },
    }).expect(200);

    expect((blocked.body as McpResponse).result?.isError).toBe(true);
    expect(textOf(blocked)).toContain('mcp.allowWrites');
  });

  it('creates a quotation, requires confirmation to sanction it and audits every call', async () => {
    await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', authorization)
      .send({ values: { 'mcp.allowWrites': true } })
      .expect(200);

    const uco = await mcp('tools/call', {
      name: 'hexa_uco_search',
      arguments: { query: 'consulta', limit: 1 },
    }).expect(200);
    const ucoCode = (JSON.parse(textOf(uco)) as { items: Array<{ code: string }> }).items[0]?.code;

    expect(ucoCode).toBeDefined();

    const created = await mcp('tools/call', {
      name: 'hexa_quotes_create',
      arguments: {
        patientRut: '12.345.678-5',
        notes: 'Creado por MCP e2e',
        items: [{ ucoCode, quantity: 2 }],
      },
    }).expect(200);

    expect((created.body as McpResponse).result?.isError).not.toBe(true);

    const quote = (JSON.parse(textOf(created)) as {
      quote: { id: string; folio: string; totals: { total: number }; status: string };
    }).quote;

    expect(quote.status).toBe('borrador');
    expect(quote.totals.total).toBeGreaterThan(0);

    const list = await request(app.getHttpServer())
      .get('/quotes')
      .set('Authorization', authorization)
      .expect(200);
    expect((list.body as Array<{ folio: string }>).some((row) => row.folio === quote.folio)).toBe(true);

    const noConfirm = await mcp('tools/call', {
      name: 'hexa_quotes_sanction',
      arguments: { quoteId: quote.id, status: 'aprobada' },
    }).expect(200);
    expect((noConfirm.body as McpResponse).result?.isError).toBe(true);

    const confirmed = await mcp('tools/call', {
      name: 'hexa_quotes_sanction',
      arguments: { quoteId: quote.id, status: 'aprobada', confirm: true },
    }).expect(200);
    expect((confirmed.body as McpResponse).result?.isError).not.toBe(true);

    const audit = await request(app.getHttpServer())
      .get('/activity?module=mcp&limit=50')
      .set('Authorization', authorization)
      .expect(200);
    const actions = (audit.body as { items: Array<{ action: string; outcome: string }> }).items;

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'mcp.hexa_quotes_create', outcome: 'success' }),
        expect.objectContaining({ action: 'mcp.hexa_quotes_create', outcome: 'failure' }),
        expect.objectContaining({ action: 'mcp.hexa_quotes_sanction', outcome: 'failure' }),
        expect.objectContaining({ action: 'mcp.hexa_quotes_sanction', outcome: 'success' }),
      ]),
    );
  });

  it('rejects a tool when the key lacks its scope', async () => {
    const readOnly = await request(app.getHttpServer())
      .post('/apikeys')
      .set('Authorization', authorization)
      .send({ name: 'MCP read-only', scopes: ['quotes:read'] })
      .expect(201);

    const response = await mcp(
      'tools/call',
      {
        name: 'hexa_quotes_create',
        arguments: {
          patientRut: '12.345.678-5',
          items: [{ description: 'Consulta', quantity: 1, unitPrice: 1000 }],
        },
      },
      (readOnly.body as { key: string }).key,
    ).expect(200);

    expect((response.body as McpResponse).result?.isError).toBe(true);
    expect(textOf(response)).toContain('Missing permission');
  });
});
