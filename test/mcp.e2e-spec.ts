import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { configureMcp } from './../src/shared/infrastructure/mcp-setup.js';
import { PostgresDatabase } from './../src/shared/infrastructure/database/postgres-database.js';
import { closePostgresTestDatabase, createPostgresTestDatabase } from './helpers/postgres-test-database.js';
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
  let database: PostgresDatabase;
  let authorization: string;
  let apiKey: string;

  beforeAll(async () => {
    useE2eAdminCredentials();
    process.env.MCP_ENABLED = 'true';
    process.env.AGENDA_EMAIL_WORKER = 'false';

    database = await createPostgresTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PostgresDatabase)
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
          'agenda:read',
          'agenda:create',
          'agenda:update',
          'agenda:cancel',
          'activity:read',
        ],
      })
      .expect(201);

    apiKey = (created.body as { key: string }).key;
  });

  afterAll(async () => {
    await app.close();
    await closePostgresTestDatabase(database);
    clearE2eAdminCredentials();
    delete process.env.MCP_ENABLED;
    delete process.env.AGENDA_EMAIL_WORKER;
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
        'hexa_calc',
        'hexa_chart_bar',
        'hexa_patients_search',
        'hexa_uco_search',
        'hexa_quotes_list',
        'hexa_quotes_get',
        'hexa_quotes_create',
        'hexa_quotes_sanction',
        'hexa_quotes_set_status',
        'hexa_agenda_appointments',
        'hexa_agenda_summary',
        'hexa_agenda_create',
        'hexa_agenda_update',
        'hexa_agenda_cancel',
        'hexa_activity_list',
      ]),
    );
  });

  it('evaluates arithmetic without any domain scope', async () => {
    const call = await mcp('tools/call', {
      name: 'hexa_calc',
      arguments: { operation: 'max', values: [14900, 23900, 18990] },
    }).expect(200);

    expect(JSON.parse(textOf(call))).toMatchObject({
      operation: 'max',
      values: [14900, 23900, 18990],
      result: 23900,
    });
  });

  it('builds a render-ready bar chart without any domain scope', async () => {
    const call = await mcp('tools/call', {
      name: 'hexa_chart_bar',
      arguments: {
        title: 'Citas por día',
        description: 'Semana actual',
        valueLabel: 'Citas',
        data: [
          { label: 'Lun', value: 8 },
          { label: 'Mar', value: 5 },
        ],
      },
    }).expect(200);

    expect(JSON.parse(textOf(call))).toMatchObject({
      chart: {
        type: 'bar',
        title: 'Citas por día',
        description: 'Semana actual',
        valueFormat: 'number',
        valueLabel: 'Citas',
        currency: null,
        data: [
          { label: 'Lun', value: 8 },
          { label: 'Mar', value: 5 },
        ],
      },
    });
  });

  it('rejects invalid chart data with a readable error', async () => {
    const call = await mcp('tools/call', {
      name: 'hexa_chart_bar',
      arguments: {
        title: 'Duplicados',
        data: [
          { label: 'Lun', value: 1 },
          { label: ' Lun ', value: 2 },
        ],
      },
    }).expect(200);

    expect((call.body as McpResponse).result?.isError).toBe(true);
    expect(textOf(call)).toContain('duplicate chart label');
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
    const ucoItems = JSON.parse(textOf(uco)) as {
      items: Array<{ code: string; units: number; unitPrice: number; rate: number }>;
    };
    const ucoCode = ucoItems.items[0]?.code;

    expect(ucoCode).toBeDefined();
    expect(ucoItems.items[0]?.rate).toBeGreaterThan(0);
    expect(ucoItems.items[0]?.unitPrice).toBe(
      Math.round(ucoItems.items[0]!.units * ucoItems.items[0]!.rate),
    );

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

  it('lists the agenda, summarizes it and writes appointments with confirmation', async () => {
    const patient = await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', authorization)
      .send({
        rut: '11.111.111-1',
        nombres: 'Agenda',
        apellidoPaterno: 'MCP',
        apellidoMaterno: 'Paciente',
        fechaNacimiento: '1988-03-12',
        sexo: 'otro',
        email: 'agenda.mcp@example.com',
      })
      .expect(201);
    const patientId = (patient.body as { id: string }).id;

    const professionals = await request(app.getHttpServer())
      .get('/agenda/professionals')
      .set('Authorization', authorization)
      .expect(200);
    const professionalId = (professionals.body as Array<{ id: string }>)[0]?.id;

    expect(professionalId).toBeDefined();

    const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const createdByRest = await request(app.getHttpServer())
      .post('/agenda/appointments')
      .set('Authorization', authorization)
      .send({
        patientId,
        professionalId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        reason: 'Control MCP',
      })
      .expect(201);
    const restAppointmentId = (createdByRest.body as { id: string }).id;

    const list = await mcp('tools/call', {
      name: 'hexa_agenda_appointments',
      arguments: {
        from: start.toISOString(),
        to: end.toISOString(),
        limit: 10,
      },
    }).expect(200);

    expect((list.body as McpResponse).result?.isError).not.toBe(true);

    const listed = JSON.parse(textOf(list)) as {
      total: number;
      appointments: Array<{
        id: string;
        status: string;
        patient: { nombreCompleto: string; rut: string; email: string | null };
      }>;
      patients: Array<{ id: string; appointments: number }>;
    };

    expect(listed.total).toBeGreaterThanOrEqual(1);
    expect(listed.appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: restAppointmentId,
          status: 'scheduled',
          patient: expect.objectContaining({
            nombreCompleto: 'Agenda MCP Paciente',
            rut: '11111111-1',
            email: 'agenda.mcp@example.com',
          }),
        }),
      ]),
    );
    expect(listed.patients.some((item) => item.id === patientId)).toBe(true);

    const summary = await mcp('tools/call', {
      name: 'hexa_agenda_summary',
      arguments: {
        from: start.toISOString(),
        to: end.toISOString(),
      },
    }).expect(200);

    expect((summary.body as McpResponse).result?.isError).not.toBe(true);

    const summarized = JSON.parse(textOf(summary)) as {
      totals: { appointments: number; patients: number; byStatus: { scheduled: number } };
      professionals: Array<{ id: string }>;
    };

    expect(summarized.totals.appointments).toBeGreaterThanOrEqual(1);
    expect(summarized.totals.patients).toBeGreaterThanOrEqual(1);
    expect(summarized.totals.byStatus.scheduled).toBeGreaterThanOrEqual(1);
    expect(summarized.professionals.some((item) => item.id === professionalId)).toBe(true);

    await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', authorization)
      .send({ values: { 'mcp.allowWrites': true } })
      .expect(200);

    const newStart = new Date(start.getTime() + 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + 30 * 60 * 1000);

    const withoutConfirm = await mcp('tools/call', {
      name: 'hexa_agenda_create',
      arguments: {
        patientId,
        professionalId,
        startsAt: newStart.toISOString(),
        endsAt: newEnd.toISOString(),
        reason: 'Creada por MCP',
      },
    }).expect(200);

    expect((withoutConfirm.body as McpResponse).result?.isError).toBe(true);
    expect(textOf(withoutConfirm)).toContain('confirm: true');

    const created = await mcp('tools/call', {
      name: 'hexa_agenda_create',
      arguments: {
        patientId,
        professionalId,
        startsAt: newStart.toISOString(),
        endsAt: newEnd.toISOString(),
        reason: 'Creada por MCP',
        confirm: true,
      },
    }).expect(200);

    expect((created.body as McpResponse).result?.isError).not.toBe(true);

    const createdAppointment = (JSON.parse(textOf(created)) as {
      appointment: { id: string; status: string; startsAt: string; endsAt: string };
    }).appointment;

    expect(createdAppointment.status).toBe('scheduled');
    expect(createdAppointment.startsAt).toBe(newStart.toISOString());

    const rescheduledStart = new Date(newStart.getTime() + 30 * 60 * 1000);
    const rescheduledEnd = new Date(rescheduledStart.getTime() + 30 * 60 * 1000);

    const updated = await mcp('tools/call', {
      name: 'hexa_agenda_update',
      arguments: {
        appointmentId: createdAppointment.id,
        startsAt: rescheduledStart.toISOString(),
        confirm: true,
      },
    }).expect(200);

    expect((updated.body as McpResponse).result?.isError).not.toBe(true);

    const rescheduled = (JSON.parse(textOf(updated)) as {
      appointment: { startsAt: string; endsAt: string };
    }).appointment;

    expect(rescheduled.startsAt).toBe(rescheduledStart.toISOString());
    expect(rescheduled.endsAt).toBe(rescheduledEnd.toISOString());

    const cancelled = await mcp('tools/call', {
      name: 'hexa_agenda_cancel',
      arguments: { appointmentId: createdAppointment.id, confirm: true },
    }).expect(200);

    expect((cancelled.body as McpResponse).result?.isError).not.toBe(true);
    expect(
      (JSON.parse(textOf(cancelled)) as { appointment: { status: string } }).appointment.status,
    ).toBe('cancelled');

    const audit = await request(app.getHttpServer())
      .get('/activity?module=mcp&limit=100')
      .set('Authorization', authorization)
      .expect(200);
    const actions = (audit.body as { items: Array<{ action: string; outcome: string }> }).items;

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'mcp.hexa_agenda_create', outcome: 'failure' }),
        expect.objectContaining({ action: 'mcp.hexa_agenda_create', outcome: 'success' }),
        expect.objectContaining({ action: 'mcp.hexa_agenda_update', outcome: 'success' }),
        expect.objectContaining({ action: 'mcp.hexa_agenda_cancel', outcome: 'success' }),
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

    const agenda = await mcp(
      'tools/call',
      { name: 'hexa_agenda_appointments', arguments: {} },
      (readOnly.body as { key: string }).key,
    ).expect(200);

    expect((agenda.body as McpResponse).result?.isError).toBe(true);
    expect(textOf(agenda)).toContain('Missing permission');
  });
});
