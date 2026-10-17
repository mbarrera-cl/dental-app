import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { SessionStore } from 'auth';
import {
  API_BASE_URL,
  CaroIaGateway,
  type CaroApprovalDecision,
  type CaroAttachment,
  type CaroConversation,
  type CaroConversationDetail,
  type CaroConversationQuery,
  type CaroCreateConversationInput,
  type CaroSendMessageInput,
  type CaroStreamEvent,
  type CaroTranscription,
} from 'data-access';

/**
 * HTTP + SSE adapter of `CaroIaGateway`. Non-streaming calls use Angular's
 * `HttpClient` (interceptor: bearer token, cookies, one 401 refresh). The two
 * streaming endpoints use `fetch` because HttpClient does not expose raw
 * response chunks; they still attach the in-memory token and retry once after
 * a refresh.
 */
@Injectable()
export class CaroIaHttpGateway extends CaroIaGateway {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);
  private readonly baseUrl = inject(API_BASE_URL).replace(/\/+$/, '');

  list(query?: CaroConversationQuery): Observable<CaroConversation[]> {
    let params = new HttpParams();

    if (query?.query !== undefined && query.query.trim() !== '') {
      params = params.set('query', query.query.trim());
    }

    if (query?.deleted !== undefined) {
      params = params.set('deleted', query.deleted);
    }

    return this.http.get<CaroConversation[]>(`${this.baseUrl}/caro-ia/conversations`, { params });
  }

  get(id: string): Observable<CaroConversationDetail> {
    return this.http.get<CaroConversationDetail>(
      `${this.baseUrl}/caro-ia/conversations/${encodeURIComponent(id)}`,
    );
  }

  create(input?: CaroCreateConversationInput): Observable<CaroConversation> {
    return this.http.post<CaroConversation>(`${this.baseUrl}/caro-ia/conversations`, {
      title: input?.title,
    });
  }

  rename(id: string, title: string): Observable<CaroConversation> {
    return this.http.patch<CaroConversation>(
      `${this.baseUrl}/caro-ia/conversations/${encodeURIComponent(id)}`,
      { title },
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/caro-ia/conversations/${encodeURIComponent(id)}`,
    );
  }

  send(conversationId: string, input: CaroSendMessageInput): Observable<CaroStreamEvent> {
    return this.stream(
      `/caro-ia/conversations/${encodeURIComponent(conversationId)}/messages`,
      { content: input.content, attachmentIds: input.attachmentIds ?? [] },
    );
  }

  decideApproval(
    conversationId: string,
    approvalId: string,
    decision: CaroApprovalDecision,
  ): Observable<CaroStreamEvent> {
    return this.stream(
      `/caro-ia/conversations/${encodeURIComponent(conversationId)}/approvals/${encodeURIComponent(approvalId)}`,
      { decision },
    );
  }

  uploadAttachment(_conversationId: string, _file: File): Observable<CaroAttachment> {
    return throwError(() => new Error('Los adjuntos todavía no están disponibles.'));
  }

  transcribeAudio(audio: Blob): Observable<CaroTranscription> {
    const form = new FormData();
    form.append('audio', audio, audioName(audio));

    return this.http.post<CaroTranscription>(`${this.baseUrl}/caro-ia/transcribe`, form);
  }

  private stream(path: string, body: unknown): Observable<CaroStreamEvent> {
    return new Observable<CaroStreamEvent>((subscriber) => {
      const abort = new AbortController();

      void (async () => {
        try {
          let response = await this.request(path, body, abort.signal);

          if (response.status === 401 && this.session.isAuthenticated()) {
            await firstValueFrom(this.session.refresh());
            response = await this.request(path, body, abort.signal);
          }

          if (!response.ok) {
            throw new Error(await errorMessage(response));
          }

          if (response.body === null) {
            throw new Error('La respuesta de CaroIA no tiene contenido.');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!abort.signal.aborted) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.indexOf('\n\n');

            while (boundary >= 0) {
              const block = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const event = parseEvent(block);

              if (event !== null) {
                subscriber.next(event);
              }

              boundary = buffer.indexOf('\n\n');
            }
          }

          subscriber.complete();
        } catch (error) {
          if (!abort.signal.aborted) {
            subscriber.error(error);
          }
        }
      })();

      return () => abort.abort();
    });
  }

  private async request(
    path: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<Response> {
    const token = this.session.accessToken();

    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
      signal,
    });
  }
}

function parseEvent(block: string): CaroStreamEvent | null {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();

  if (data === '') {
    return null;
  }

  try {
    return JSON.parse(data) as CaroStreamEvent;
  } catch {
    return null;
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    const message = typeof body.message === 'string' ? body.message : '';

    if (message !== '') {
      return message;
    }
  } catch {
    // Fall through to the generic message.
  }

  return `CaroIA respondió con HTTP ${response.status}`;
}

function audioName(blob: Blob): string {
  const extension = blob.type.includes('ogg')
    ? 'ogg'
    : blob.type.includes('mp4')
      ? 'm4a'
      : blob.type.includes('wav')
        ? 'wav'
        : 'webm';

  return `audio.${extension}`;
}
