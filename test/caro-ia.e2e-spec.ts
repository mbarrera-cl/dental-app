import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import type { DeepSeekMessage, DeepSeekResult, DeepSeekToolDefinition } from './../src/modules/caro-ia/application/deepseek.client.js';
import { DeepSeekClient } from './../src/modules/caro-ia/application/deepseek.client.js';
import { DeepgramClient } from './../src/modules/caro-ia/application/deepgram.client.js';
import type { CaroTranscription } from './../src/modules/caro-ia/domain/caro-ia.models.js';
import { PostgresDatabase } from './../src/shared/infrastructure/database/postgres-database.js';
import { closePostgresTestDatabase, createPostgresTestDatabase } from './helpers/postgres-test-database.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { clearE2eAdminCredentials, loginAsAdmin, useE2eAdminCredentials } from './helpers/auth.js';

class FakeDeepSeek extends DeepSeekClient {
  queue: DeepSeekResult[] = [];

  override async complete(
    _messages: DeepSeekMessage[],
    _tools: DeepSeekToolDefinition[],
    _toolChoice: 'required' | 'auto' | 'none',
    _signal: AbortSignal,
  ): Promise<DeepSeekResult> {
    const next = this.queue.shift();

    if (next === undefined) {
      throw new Error('FakeDeepSeek queue is empty');
    }

    return next;
  }
}

class FakeDeepgram extends DeepgramClient {
  override async transcribe(): Promise<CaroTranscription> {
    return { text: 'Resume el presupuesto COT-2026-0001', confidence: 0.97, durationSeconds: 3.2 };
  }
}

interface CaroEvent {
  type: string;
  approval?: { id: string; tool: string; status: string };
  message?: {
    content: string;
    toolCalls: Array<{ name: string; state: string; chart?: unknown }>;
  };
}

describe('CaroIA API (e2e)', () => {
  let app: INestApplication<App>;
  let database: PostgresDatabase;
  let authorization: string;
  let deepseek: FakeDeepSeek;
  let patientId: string;
  let professionalId: string;
  let appointmentStart: Date;
  let appointmentEnd: Date;
  let adminConversationId: string;

  beforeAll(async () => {
    useE2eAdminCredentials();
    process.env.AGENDA_EMAIL_WORKER = 'false';
    database = await createPostgresTestDatabase();
    deepseek = new FakeDeepSeek();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PostgresDatabase)
      .useValue(database)
      .overrideProvider(DeepSeekClient)
      .useValue(deepseek)
      .overrideProvider(DeepgramClient)
      .useValue(new FakeDeepgram())
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, { swagger: false });
    await app.init();
    authorization = await loginAsAdmin(app);

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

    patientId = (patient.body as { id: string }).id;

    const professionals = await request(app.getHttpServer())
      .get('/agenda/professionals')
      .set('Authorization', authorization)
      .expect(200);
    professionalId = (professionals.body as Array<{ id: string }>)[0]?.id as string;

    appointmentStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    appointmentStart.setSeconds(0, 0);
    appointmentEnd = new Date(appointmentStart.getTime() + 30 * 60 * 1000);

    await request(app.getHttpServer())
      .post('/agenda/appointments')
      .set('Authorization', authorization)
      .send({
        patientId,
        professionalId,
        startsAt: appointmentStart.toISOString(),
        endsAt: appointmentEnd.toISOString(),
        reason: 'Control CaroIA',
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    await closePostgresTestDatabase(database);
    clearE2eAdminCredentials();
    delete process.env.AGENDA_EMAIL_WORKER;
  });

  function parseEvents(text: string): CaroEvent[] {
    return text
      .split('\n\n')
      .map((block) => block.trim())
      .filter((block) => block.startsWith('data:'))
      .map((block) => JSON.parse(block.slice(5).trim()) as CaroEvent);
  }

  async function createConversation(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/caro-ia/conversations')
      .set('Authorization', authorization)
      .send({ title: 'Nueva conversación' })
      .expect(201);

    return (response.body as { id: string }).id;
  }

  it('streams a read turn, keeps citations and derives the title', async () => {
    const id = await createConversation();
    adminConversationId = id;

    deepseek.queue = [
      {
        content: '',
        toolCalls: [
          {
            id: 'call-patients',
            type: 'function',
            function: {
              name: 'hexa_patients_search',
              arguments: JSON.stringify({ query: 'Camila' }),
            },
          },
        ],
      },
      { content: 'Encontré a **Camila Rojas**.', toolCalls: [] },
    ];

    const response = await request(app.getHttpServer())
      .post(`/caro-ia/conversations/${id}/messages`)
      .set('Authorization', authorization)
      .send({ content: 'Busca a Camila por MCP' })
      .expect(200);

    const events = parseEvents(response.text);
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['tool.start', 'tool.result', 'message.delta', 'message.done']),
    );
    expect(events.at(-1)?.message?.content).toContain('Camila');
    expect(events.at(-1)?.message?.toolCalls[0]).toMatchObject({
      name: 'hexa_patients_search',
      state: 'success',
    });

    const detail = await request(app.getHttpServer())
      .get(`/caro-ia/conversations/${id}`)
      .set('Authorization', authorization)
      .expect(200);

    expect((detail.body as { conversation: { title: string; messageCount: number } }).conversation)
      .toMatchObject({ title: 'Busca a Camila por MCP', messageCount: 2 });
    expect(
      (detail.body as { messages: Array<{ citations: unknown[] }> }).messages[1]?.citations,
    ).toHaveLength(1);

    const list = await request(app.getHttpServer())
      .get('/caro-ia/conversations')
      .set('Authorization', authorization)
      .expect(200);

    expect((list.body as Array<{ id: string; preview: string }>)[0]).toMatchObject({
      id,
      preview: 'Encontré a Camila Rojas.',
    });
  });

  it('answers agenda questions with MCP evidence', async () => {
    const id = await createConversation();

    deepseek.queue = [
      {
        content: '',
        toolCalls: [
          {
            id: 'call-agenda',
            type: 'function',
            function: {
              name: 'hexa_agenda_appointments',
              arguments: JSON.stringify({
                from: appointmentStart.toISOString(),
                to: appointmentEnd.toISOString(),
              }),
            },
          },
        ],
      },
      { content: 'Tienes una cita con **Camila Rojas**.', toolCalls: [] },
    ];

    const response = await request(app.getHttpServer())
      .post(`/caro-ia/conversations/${id}/messages`)
      .set('Authorization', authorization)
      .send({ content: '¿Qué pacientes tengo citados?' })
      .expect(200);

    const events = parseEvents(response.text);
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['tool.start', 'tool.result', 'message.done']),
    );
    expect(events.at(-1)?.message?.toolCalls[0]).toMatchObject({
      name: 'hexa_agenda_appointments',
      state: 'success',
    });

    const detail = await request(app.getHttpServer())
      .get(`/caro-ia/conversations/${id}`)
      .set('Authorization', authorization)
      .expect(200);

    expect(
      (detail.body as { messages: Array<{ citations: unknown[] }> }).messages[1]?.citations,
    ).toHaveLength(1);
  });

  it('attaches a bar chart to the tool call and keeps it after reloading', async () => {
    const id = await createConversation();

    deepseek.queue = [
      {
        content: '',
        toolCalls: [
          {
            id: 'call-chart',
            type: 'function',
            function: {
              name: 'hexa_chart_bar',
              arguments: JSON.stringify({
                title: 'Citas por día',
                description: 'Semana actual',
                valueLabel: 'Citas',
                data: [
                  { label: 'Lun', value: 6 },
                  { label: 'Mar', value: 9 },
                ],
              }),
            },
          },
        ],
      },
      { content: '', toolCalls: [] },
    ];

    const response = await request(app.getHttpServer())
      .post(`/caro-ia/conversations/${id}/messages`)
      .set('Authorization', authorization)
      .send({ content: 'Graficame las citas por día' })
      .expect(200);

    const events = parseEvents(response.text);
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['tool.result', 'message.done']),
    );
    expect(events.at(-1)?.message?.content).toBe('Aquí está el gráfico.');
    expect(events.at(-1)?.message?.toolCalls[0]).toMatchObject({
      name: 'hexa_chart_bar',
      state: 'success',
      chart: {
        type: 'bar',
        title: 'Citas por día',
        data: [
          { label: 'Lun', value: 6 },
          { label: 'Mar', value: 9 },
        ],
      },
    });

    const detail = await request(app.getHttpServer())
      .get(`/caro-ia/conversations/${id}`)
      .set('Authorization', authorization)
      .expect(200);

    expect(
      (detail.body as { messages: Array<{ toolCalls: unknown[] }> }).messages[1]?.toolCalls[0],
    ).toMatchObject({ name: 'hexa_chart_bar', chart: { title: 'Citas por día' } });
  });

  it('rejects attachments and invalid messages before streaming', async () => {
    const id = await createConversation();

    await request(app.getHttpServer())
      .post(`/caro-ia/conversations/${id}/messages`)
      .set('Authorization', authorization)
      .send({ content: 'Hola', attachmentIds: ['file-1'] })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/caro-ia/conversations/${id}/messages`)
      .set('Authorization', authorization)
      .send({ content: '   ' })
      .expect(400);
  });

  it('proposes a write, waits for approval and executes it once approved', async () => {
    await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', authorization)
      .send({ values: { 'caroIa.allowWrites': true, 'mcp.allowWrites': true } })
      .expect(200);

    const id = await createConversation();

    deepseek.queue = [
      {
        content: 'Necesito tu aprobación para crear el presupuesto.',
        toolCalls: [
          {
            id: 'call-create',
            type: 'function',
            function: {
              name: 'hexa_quotes_create',
              arguments: JSON.stringify({
                patientId,
                items: [{ description: 'Consulta de urgencia', quantity: 2, unitPrice: 3000 }],
              }),
            },
          },
        ],
      },
    ];

    const response = await request(app.getHttpServer())
      .post(`/caro-ia/conversations/${id}/messages`)
      .set('Authorization', authorization)
      .send({ content: 'Crea un presupuesto' })
      .expect(200);

    const events = parseEvents(response.text);
    const approval = events.find((event) => event.type === 'approval.required')?.approval;

    expect(approval).toMatchObject({ tool: 'hexa_quotes_create', status: 'pending' });
    expect(approval?.id).toEqual(expect.any(String));

    const approved = await request(app.getHttpServer())
      .post(`/caro-ia/conversations/${id}/approvals/${approval!.id}`)
      .set('Authorization', authorization)
      .send({ decision: 'approve' })
      .expect(200);

    const approvalEvents = parseEvents(approved.text);
    expect(approvalEvents.some((event) => event.type === 'tool.result')).toBe(true);
    expect(approvalEvents.at(-1)?.message?.content).toContain('Presupuesto');

    const detail = await request(app.getHttpServer())
      .get(`/caro-ia/conversations/${id}`)
      .set('Authorization', authorization)
      .expect(200);

    const messages = (
      detail.body as {
        messages: Array<{ approvals: Array<{ id: string; status: string }> }>;
      }
    ).messages;
    expect(messages[1]?.approvals[0]).toMatchObject({
      id: approval!.id,
      status: 'approved',
    });

    await request(app.getHttpServer())
      .post(`/caro-ia/conversations/${id}/approvals/${approval!.id}`)
      .set('Authorization', authorization)
      .send({ decision: 'approve' })
      .expect(409);
  });

  it('proposes an agenda write and creates it after approval', async () => {
    await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', authorization)
      .send({ values: { 'caroIa.allowWrites': true, 'mcp.allowWrites': true } })
      .expect(200);

    const id = await createConversation();
    const start = new Date(appointmentStart.getTime() + 2 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    deepseek.queue = [
      {
        content: 'Necesito tu aprobación para agendar la cita.',
        toolCalls: [
          {
            id: 'call-agenda-create',
            type: 'function',
            function: {
              name: 'hexa_agenda_create',
              arguments: JSON.stringify({
                patientId,
                professionalId,
                startsAt: start.toISOString(),
                endsAt: end.toISOString(),
                reason: 'Control CaroIA',
              }),
            },
          },
        ],
      },
    ];

    const response = await request(app.getHttpServer())
      .post(`/caro-ia/conversations/${id}/messages`)
      .set('Authorization', authorization)
      .send({ content: 'Agenda una cita para Camila' })
      .expect(200);

    const events = parseEvents(response.text);
    const approval = events.find((event) => event.type === 'approval.required')?.approval;

    expect(approval).toMatchObject({ tool: 'hexa_agenda_create', status: 'pending' });

    const approved = await request(app.getHttpServer())
      .post(`/caro-ia/conversations/${id}/approvals/${approval!.id}`)
      .set('Authorization', authorization)
      .send({ decision: 'approve' })
      .expect(200);

    const approvalEvents = parseEvents(approved.text);
    expect(approvalEvents.some((event) => event.type === 'tool.result')).toBe(true);
    expect(approvalEvents.at(-1)?.message?.content).toContain('Cita');

    const appointments = await request(app.getHttpServer())
      .get('/agenda/appointments')
      .query({ from: start.toISOString(), to: end.toISOString() })
      .set('Authorization', authorization)
      .expect(200);

    expect(
      (appointments.body as Array<{ startsAt: string; status: string }>).some(
        (appointment) =>
          appointment.startsAt === start.toISOString() && appointment.status === 'scheduled',
      ),
    ).toBe(true);
  });

  it('keeps every conversation private, including from administrators', async () => {
    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({
        email: 'caro-user@example.com',
        name: 'Caro User',
        password: 'Str0ng-Passw0rd!',
      })
      .expect(201);

    const userId = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .put(`/users/${userId}/permissions`)
      .set('Authorization', authorization)
      .send({ permissions: ['caroIa:use'] })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'caro-user@example.com', password: 'Str0ng-Passw0rd!' })
      .expect(200);

    const userAuthorization = `Bearer ${(login.body as { accessToken: string }).accessToken}`;

    const ownList = await request(app.getHttpServer())
      .get('/caro-ia/conversations')
      .set('Authorization', userAuthorization)
      .expect(200);

    expect(ownList.body).toEqual([]);
    await request(app.getHttpServer())
      .get(`/caro-ia/conversations/${adminConversationId}`)
      .set('Authorization', userAuthorization)
      .expect(404);

    const own = await request(app.getHttpServer())
      .post('/caro-ia/conversations')
      .set('Authorization', userAuthorization)
      .send({ title: 'Privada' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/caro-ia/conversations/${(own.body as { id: string }).id}`)
      .set('Authorization', authorization)
      .expect(404);
  });

  it('transcribes audio without persisting it', async () => {
    const response = await request(app.getHttpServer())
      .post('/caro-ia/transcribe')
      .set('Authorization', authorization)
      .attach('audio', Buffer.from('fake-audio'), {
        filename: 'audio.webm',
        contentType: 'audio/webm',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      text: 'Resume el presupuesto COT-2026-0001',
      durationSeconds: 3.2,
    });
  });
});
