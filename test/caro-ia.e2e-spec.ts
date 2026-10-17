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
  message?: { content: string; toolCalls: Array<{ name: string; state: string }> };
}

describe('CaroIA API (e2e)', () => {
  let app: INestApplication<App>;
  let database: PostgresDatabase;
  let authorization: string;
  let deepseek: FakeDeepSeek;
  let patientId: string;
  let adminConversationId: string;

  beforeAll(async () => {
    useE2eAdminCredentials();
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
  });

  afterAll(async () => {
    await app.close();
    await closePostgresTestDatabase(database);
    clearE2eAdminCredentials();
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
