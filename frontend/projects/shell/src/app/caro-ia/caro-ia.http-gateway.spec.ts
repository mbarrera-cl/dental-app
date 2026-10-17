import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, toArray } from 'rxjs';
import { API_BASE_URL, type CaroStreamEvent } from 'data-access';
import { SessionStore } from 'auth';
import { CaroIaHttpGateway } from './caro-ia.http-gateway';

const BASE_URL = 'http://api.test';

describe('CaroIaHttpGateway', () => {
  let gateway: CaroIaHttpGateway;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
        {
          provide: SessionStore,
          useValue: {
            accessToken: () => 'token-1',
            isAuthenticated: () => true,
            refresh: () => {
              throw new Error('unexpected refresh');
            },
          },
        },
        CaroIaHttpGateway,
      ],
    });

    gateway = TestBed.inject(CaroIaHttpGateway);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  it('uses the REST endpoints for CRUD and transcription', () => {
    gateway.list().subscribe();
    http.expectOne('http://api.test/caro-ia/conversations').flush([]);

    gateway.get('c 1').subscribe();
    http.expectOne('http://api.test/caro-ia/conversations/c%201').flush({
      conversation: {},
      messages: [],
    });

    gateway.create({ title: 'Hola' }).subscribe();
    const create = http.expectOne('http://api.test/caro-ia/conversations');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ title: 'Hola' });
    create.flush({});

    gateway.rename('c1', 'Nuevo').subscribe();
    const rename = http.expectOne('http://api.test/caro-ia/conversations/c1');
    expect(rename.request.method).toBe('PATCH');
    rename.flush({});

    gateway.remove('c1').subscribe();
    http.expectOne('http://api.test/caro-ia/conversations/c1').flush(null);

    gateway.transcribeAudio(new Blob(['audio'], { type: 'audio/webm' })).subscribe();
    const transcribe = http.expectOne('http://api.test/caro-ia/transcribe');
    expect(transcribe.request.method).toBe('POST');
    expect(transcribe.request.body instanceof FormData).toBe(true);
    transcribe.flush({ text: 'hola', confidence: 1, durationSeconds: 1 });
  });

  it('parses SSE frames split across chunks', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"type":"message.delta","delta":"Hola"}\n\n',
      'data: {"type":"message.delta","delta":" mundo"}\n\n' +
        'data: {"type":"message.done","message":{"id":"m1","role":"assistant","content":"Hola mundo","createdAt":"2026-01-01T00:00:00.000Z","attachments":[],"toolCalls":[],"approvals":[],"citations":[]}}\n\n',
    ];
    let index = 0;
    const reader = {
      read: vi.fn(async () => {
        if (index >= chunks.length) {
          return { done: true, value: undefined };
        }

        return { done: false, value: encoder.encode(chunks[index++]) };
      }),
    };
    const response = {
      ok: true,
      status: 200,
      body: { getReader: () => reader },
    } as unknown as Response;
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    const events = await firstValueFrom(
      gateway.send('c1', { content: 'Hola' }).pipe(toArray()),
    );

    expect(events).toEqual<CaroStreamEvent[]>([
      { type: 'message.delta', delta: 'Hola' },
      { type: 'message.delta', delta: ' mundo' },
      {
        type: 'message.done',
        message: {
          id: 'm1',
          role: 'assistant',
          content: 'Hola mundo',
          createdAt: '2026-01-01T00:00:00.000Z',
          attachments: [],
          toolCalls: [],
          approvals: [],
          citations: [],
        },
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/caro-ia/conversations/c1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
      }),
    );
  });

  it('does not call the backend for attachments in this phase', async () => {
    await expect(
      firstValueFrom(gateway.uploadAttachment('c1', new File(['x'], 'x.pdf'))),
    ).rejects.toThrow('Los adjuntos todavía no están disponibles.');

    http.expectNone('http://api.test/caro-ia/conversations/c1/attachments');
  });
});
