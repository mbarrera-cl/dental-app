import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CaroIaGateway,
  DEFAULT_CONVERSATION_TITLE,
  type CaroApprovalDecision,
  type CaroAttachment,
  type CaroConversation,
  type CaroConversationDetail,
  type CaroConversationQuery,
  type CaroCreateConversationInput,
  type CaroMessage,
  type CaroPendingApproval,
  type CaroSendMessageInput,
  type CaroStreamEvent,
  type CaroToolCall,
  type CaroTranscription,
} from 'data-access';

const TOOL_LABELS: Record<string, string> = {
  hexa_quotes_get: 'Consultó el presupuesto',
  hexa_quotes_list: 'Listó presupuestos',
  hexa_quotes_create: 'Creó un presupuesto',
  hexa_patients_search: 'Buscó pacientes',
  hexa_patients_get: 'Consultó un paciente',
  hexa_uco_search: 'Buscó en el arancel UCO',
  hexa_activity_list: 'Consultó la actividad',
};

const REFUSAL =
  'No puedo responder eso. Solo uso la información del MCP de Hexa (presupuestos, pacientes, arancel UCO y actividad). Prueba con una consulta sobre esos datos.';

const GREETING = `¡Hola! Soy **CaroIA**, la asistente de presupuestos de Hexa. Puedo ayudarte con:

- **Presupuestos**: buscar, revisar y preparar borradores o cambios (con tu aprobación antes de escribir).
- **Pacientes**: encontrar fichas y revisar sus datos.
- **Arancel UCO**: consultar precios y códigos.
- **Actividad**: ver las acciones recientes en Hexa.

¿Sobre qué te ayudo hoy?`;

function labelFor(name: string): string {
  return TOOL_LABELS[name] ?? `Consultó ${name.replace('hexa_', '').replaceAll('_', ' ')}`;
}

function words(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Gateway simulado de la rama UI. Reproduce conversaciones, streaming, tool
 * calls, aprobaciones, adjuntos y transcripciones para revisar toda la
 * experiencia sin backend. La rama backend lo sustituye por HTTP + SSE.
 */
@Injectable()
export class CaroIaMockGateway extends CaroIaGateway {
  private conversations: CaroConversation[] = [];
  private readonly details = new Map<string, CaroConversationDetail>();

  constructor() {
    super();
    this.seed();
  }

  list(query: CaroConversationQuery = {}): Observable<CaroConversation[]> {
    const needle = (query.query ?? '').trim().toLowerCase();
    const rows = this.conversations
      .filter((conversation) => (query.deleted === 'only' ? false : true))
      .filter((conversation) =>
        needle === ''
          ? true
          : `${conversation.title} ${conversation.preview ?? ''}`.toLowerCase().includes(needle),
      );

    return new Observable((subscriber) => {
      const timer = setTimeout(() => {
        subscriber.next(clone(rows));
        subscriber.complete();
      }, 180);

      return () => clearTimeout(timer);
    });
  }

  get(id: string): Observable<CaroConversationDetail> {
    const detail = this.details.get(id);

    return new Observable((subscriber) => {
      const timer = setTimeout(() => {
        if (detail === undefined) {
          subscriber.error(new Error('Conversación no encontrada.'));
          return;
        }

        subscriber.next(clone(detail));
        subscriber.complete();
      }, 160);

      return () => clearTimeout(timer);
    });
  }

  create(input: CaroCreateConversationInput = {}): Observable<CaroConversation> {
    const now = new Date().toISOString();
    const conversation: CaroConversation = {
      id: crypto.randomUUID(),
      title: input.title?.trim() || DEFAULT_CONVERSATION_TITLE,
      preview: null,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    this.conversations = [conversation, ...this.conversations];
    this.details.set(conversation.id, { conversation, messages: [] });

    return new Observable((subscriber) => {
      const timer = setTimeout(() => {
        subscriber.next(clone(conversation));
        subscriber.complete();
      }, 120);

      return () => clearTimeout(timer);
    });
  }

  rename(id: string, title: string): Observable<CaroConversation> {
    const conversation = this.conversations.find((row) => row.id === id);

    return new Observable((subscriber) => {
      const timer = setTimeout(() => {
        if (conversation === undefined) {
          subscriber.error(new Error('Conversación no encontrada.'));
          return;
        }

        conversation.title = title.trim() || DEFAULT_CONVERSATION_TITLE;
        conversation.updatedAt = new Date().toISOString();
        const detail = this.details.get(id);

        if (detail !== undefined) {
          detail.conversation = conversation;
        }

        subscriber.next(clone(conversation));
        subscriber.complete();
      }, 120);

      return () => clearTimeout(timer);
    });
  }

  remove(id: string): Observable<void> {
    this.conversations = this.conversations.filter((row) => row.id !== id);
    this.details.delete(id);

    return new Observable((subscriber) => {
      const timer = setTimeout(() => {
        subscriber.next();
        subscriber.complete();
      }, 120);

      return () => clearTimeout(timer);
    });
  }

  send(conversationId: string, input: CaroSendMessageInput): Observable<CaroStreamEvent> {
    return new Observable((subscriber) => {
      const detail = this.details.get(conversationId);

      if (detail === undefined) {
        subscriber.error(new Error('Conversación no encontrada.'));
        return;
      }

      const timers: Array<ReturnType<typeof setTimeout>> = [];
      const schedule = (fn: () => void, delay: number): void => {
        timers.push(
          setTimeout(() => {
            if (!subscriber.closed) {
              fn();
            }
          }, delay),
        );
      };
      const now = new Date().toISOString();
      const userMessage: CaroMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: input.content,
        createdAt: now,
        attachments: [],
        toolCalls: [],
        approvals: [],
        citations: [],
      };
      detail.messages.push(userMessage);

      const messageId = crypto.randomUUID();
      const toolCalls: CaroToolCall[] = [];
      const approvals: CaroPendingApproval[] = [];
      const citations: CaroMessage['citations'] = [];
      let content = '';

      const stream = (text: string, startDelay: number): void => {
        words(text).forEach((chunk, index) => {
          schedule(() => {
            content += chunk;
            subscriber.next({ type: 'message.delta', delta: chunk });
          }, startDelay + index * 22);
        });
      };

      const finish = (): void => {
        const message: CaroMessage = {
          id: messageId,
          role: 'assistant',
          content,
          createdAt: new Date().toISOString(),
          attachments: [],
          toolCalls,
          approvals,
          citations,
        };

        detail.messages.push(message);
        detail.conversation = {
          ...detail.conversation,
          preview: content.replace(/\s+/g, ' ').slice(0, 90),
          updatedAt: message.createdAt,
          messageCount: detail.messages.length,
        };
        const row = this.conversations.find((item) => item.id === conversationId);

        if (row !== undefined) {
          row.preview = detail.conversation.preview;
          row.updatedAt = detail.conversation.updatedAt;
          row.messageCount = detail.conversation.messageCount;
        }

        subscriber.next({ type: 'message.done', message: clone(message) });
        subscriber.complete();
      };

      const text = input.content.toLowerCase();

      if (/clima|capital|receta|diagn[oó]stico|medicamento|f[uú]tbol|chiste|pol[ií]tica/.test(text)) {
        stream(REFUSAL, 250);
        schedule(finish, 250 + words(REFUSAL).length * 22 + 180);
        return () => timers.forEach(clearTimeout);
      }

      if (/^(hola|holi|buenas|hey|hello|hi)\b|^gracias|qu[eé]\s+(puedes|puedo|haces|hacer|opciones)/.test(text)) {
        stream(GREETING, 250);
        schedule(finish, 250 + words(GREETING).length * 22 + 180);
        return () => timers.forEach(clearTimeout);
      }

      if (/crea(r)?\s+(un\s+)?presupuesto|nuevo\s+presupuesto/.test(text)) {
        const tool: CaroToolCall = {
          id: crypto.randomUUID(),
          name: 'hexa_quotes_create',
          label: labelFor('hexa_quotes_create'),
          state: 'running',
          summary: null,
        };
        toolCalls.push(tool);
        schedule(() => subscriber.next({ type: 'tool.start', toolCall: clone(tool) }), 220);

        const approval: CaroPendingApproval = {
          id: crypto.randomUUID(),
          tool: 'hexa_quotes_create',
          title: 'Crear presupuesto',
          summary:
            'Se creará un borrador con una línea de consulta de urgencia para Camila Rojas. Revisa los datos antes de aprobar.',
          parameters: [
            { label: 'Paciente', value: 'Camila Rojas Pérez' },
            { label: 'Líneas', value: '2 × Consulta de urgencia' },
            { label: 'Total', value: '$6.000' },
          ],
          status: 'pending',
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        };
        approvals.push(approval);
        schedule(() => subscriber.next({ type: 'approval.required', approval: clone(approval) }), 520);
        stream(
          'Puedo crear el borrador, pero **necesito tu aprobación** antes de escribir en Hexa. Revisa el resumen y elige Aprobar o Rechazar.',
          760,
        );
        schedule(
          finish,
          760 +
            words(
              'Puedo crear el borrador, pero **necesito tu aprobación** antes de escribir en Hexa. Revisa el resumen y elige Aprobar o Rechazar.',
            ).length *
              22 +
            180,
        );

        return () => timers.forEach(clearTimeout);
      }

      if (/paciente|rut/.test(text)) {
        const tool: CaroToolCall = {
          id: crypto.randomUUID(),
          name: 'hexa_patients_search',
          label: labelFor('hexa_patients_search'),
          state: 'running',
          summary: null,
        };
        toolCalls.push(tool);
        schedule(() => subscriber.next({ type: 'tool.start', toolCall: clone(tool) }), 200);
        schedule(() => {
          tool.state = 'success';
          tool.summary = '1 paciente';
          subscriber.next({ type: 'tool.result', toolCall: clone(tool) });
        }, 520);
        const answer =
          'Encontré **1 paciente** con ese RUT:\n\n| Nombre | RUT | N° HC |\n| --- | --- | --- |\n| Camila Rojas Pérez | 12.345.678-5 | HC-000001 |\n\n¿Quieres que abra su ficha o revise sus presupuestos?';
        stream(answer, 700);
        citations.push({ toolCallId: tool.id, label: 'hexa_patients_search' });
        schedule(finish, 700 + words(answer).length * 22 + 180);

        return () => timers.forEach(clearTimeout);
      }

      const tool: CaroToolCall = {
        id: crypto.randomUUID(),
        name: 'hexa_quotes_get',
        label: labelFor('hexa_quotes_get'),
        state: 'running',
        summary: null,
      };
      toolCalls.push(tool);
      schedule(() => subscriber.next({ type: 'tool.start', toolCall: clone(tool) }), 200);
      schedule(() => {
        tool.state = 'success';
        tool.summary = 'COT-2026-0001 · borrador';
        subscriber.next({ type: 'tool.result', toolCall: clone(tool) });
      }, 600);
      const answer =
        '## Presupuesto COT-2026-0001\n\n**Paciente:** Camila Rojas Pérez  \n**Estado:** Borrador  \n**Validez:** 16/11/2026\n\n| Prestación | Cant. | Unitario | Total |\n| --- | ---: | ---: | ---: |\n| Consulta de urgencia | 2 | $3.000 | $6.000 |\n\n**Total: $6.000**\n\nEl presupuesto sigue en borrador. ¿Quieres que lo duplique, lo sancione o revise otra versión?';
      stream(answer, 760);
      citations.push({ toolCallId: tool.id, label: 'hexa_quotes_get' });
      schedule(finish, 760 + words(answer).length * 22 + 200);

      return () => timers.forEach(clearTimeout);
    });
  }

  uploadAttachment(_conversationId: string, file: File): Observable<CaroAttachment> {
    return new Observable((subscriber) => {
      const timer = setTimeout(() => {
        const kind = file.type.startsWith('audio/')
          ? 'audio'
          : file.type.startsWith('image/')
            ? 'image'
            : 'document';
        let url: string | null = null;

        try {
          url = URL.createObjectURL(file);
        } catch {
          url = null;
        }

        const attachment: CaroAttachment = {
          id: crypto.randomUUID(),
          kind,
          filename: file.name,
          mime: file.type || 'application/octet-stream',
          size: file.size,
          status: 'ready',
          text:
            kind === 'audio'
              ? 'Transcripción simulada: resume el presupuesto COT-2026-0001.'
              : kind === 'image'
                ? 'OCR simulado: contenido de la imagen.'
                : `Contenido extraído simulado de ${file.name}.`,
          durationSeconds: kind === 'audio' ? 8 : null,
          url,
          error: null,
          createdAt: new Date().toISOString(),
        };

        subscriber.next(attachment);
        subscriber.complete();
      }, 900);

      return () => clearTimeout(timer);
    });
  }

  transcribeAudio(_audio: Blob): Observable<CaroTranscription> {
    return new Observable((subscriber) => {
      const timer = setTimeout(() => {
        subscriber.next({
          text: 'Resume el presupuesto COT-2026-0001 y dime si sigue en borrador.',
          confidence: 0.96,
          durationSeconds: 8,
        });
        subscriber.complete();
      }, 1200);

      return () => clearTimeout(timer);
    });
  }

  decideApproval(
    conversationId: string,
    approvalId: string,
    decision: CaroApprovalDecision,
  ): Observable<CaroStreamEvent> {
    return new Observable((subscriber) => {
      const detail = this.details.get(conversationId);
      const timers: Array<ReturnType<typeof setTimeout>> = [];
      const schedule = (fn: () => void, delay: number): void => {
        timers.push(setTimeout(() => !subscriber.closed && fn(), delay));
      };

      if (detail === undefined) {
        subscriber.error(new Error('Conversación no encontrada.'));
        return () => timers.forEach(clearTimeout);
      }

      const findApproval = (): CaroPendingApproval | undefined => {
        for (const message of detail.messages) {
          const approval = message.approvals.find((item) => item.id === approvalId);

          if (approval !== undefined) {
            return approval;
          }
        }

        return undefined;
      };
      const approval = findApproval();
      const messageId = crypto.randomUUID();
      const toolCalls: CaroToolCall[] = [];
      const content =
        decision === 'approve'
          ? 'Presupuesto **COT-2026-0007** creado por **$6.000**. Quedó en estado **borrador**; puedes revisarlo o sancionarlo cuando quieras.'
          : 'Acción cancelada. No se creó ningún presupuesto.';
      let streamed = '';

      if (approval !== undefined) {
        approval.status = decision === 'approve' ? 'approved' : 'rejected';
      }

      if (decision === 'approve') {
        const tool: CaroToolCall = {
          id: crypto.randomUUID(),
          name: 'hexa_quotes_create',
          label: labelFor('hexa_quotes_create'),
          state: 'running',
          summary: null,
        };
        toolCalls.push(tool);
        schedule(() => subscriber.next({ type: 'tool.start', toolCall: clone(tool) }), 180);
        schedule(() => {
          tool.state = 'success';
          tool.summary = 'COT-2026-0007 · borrador';
          subscriber.next({ type: 'tool.result', toolCall: clone(tool) });
        }, 520);
      }

      const chunks = words(content);
      chunks.forEach((chunk, index) => {
        schedule(() => {
          streamed += chunk;
          subscriber.next({ type: 'message.delta', delta: chunk });
        }, 700 + index * 22);
      });
      schedule(() => {
        const message: CaroMessage = {
          id: messageId,
          role: 'assistant',
          content: streamed,
          createdAt: new Date().toISOString(),
          attachments: [],
          toolCalls,
          approvals: [],
          citations: toolCalls.map((tool) => ({ toolCallId: tool.id, label: tool.name })),
        };

        detail.messages.push(message);
        detail.conversation = {
          ...detail.conversation,
          preview: streamed.replace(/\s+/g, ' ').slice(0, 90),
          updatedAt: message.createdAt,
          messageCount: detail.messages.length,
        };
        const row = this.conversations.find((item) => item.id === conversationId);

        if (row !== undefined) {
          row.preview = detail.conversation.preview;
          row.updatedAt = detail.conversation.updatedAt;
          row.messageCount = detail.conversation.messageCount;
        }

        subscriber.next({ type: 'message.done', message: clone(message) });
        subscriber.complete();
      }, 700 + chunks.length * 22 + 200);

      return () => timers.forEach(clearTimeout);
    });
  }

  private seed(): void {
    const now = Date.now();
    const iso = (offsetMs: number): string => new Date(now - offsetMs).toISOString();
    const make = (
      title: string,
      preview: string,
      minutesAgo: number,
      messages: CaroMessage[],
    ): void => {
      const conversation: CaroConversation = {
        id: crypto.randomUUID(),
        title,
        preview,
        createdAt: iso(minutesAgo * 60_000 + 3_600_000),
        updatedAt: iso(minutesAgo * 60_000),
        messageCount: messages.length,
      };

      this.conversations.push(conversation);
      this.details.set(conversation.id, { conversation, messages });
    };
    const message = (
      role: 'user' | 'assistant',
      content: string,
      minutesAgo: number,
      toolCalls: CaroToolCall[] = [],
      approvals: CaroPendingApproval[] = [],
      citations: CaroMessage['citations'] = [],
    ): CaroMessage => ({
      id: crypto.randomUUID(),
      role,
      content,
      createdAt: iso(minutesAgo * 60_000),
      attachments: [],
      toolCalls,
      approvals,
      citations,
    });
    const tool = (name: string, state: CaroToolCall['state'], summary: string | null): CaroToolCall => ({
      id: crypto.randomUUID(),
      name,
      label: labelFor(name),
      state,
      summary,
    });
    const quoteTool = tool('hexa_quotes_get', 'success', 'COT-2026-0001 · borrador');
    const quoteAnswer =
      '## Presupuesto COT-2026-0001\n\n**Paciente:** Camila Rojas Pérez  \n**Estado:** Borrador  \n**Validez:** 16/11/2026\n\n| Prestación | Cant. | Unitario | Total |\n| --- | ---: | ---: | ---: |\n| Consulta de urgencia | 2 | $3.000 | $6.000 |\n\n**Total: $6.000**\n\nEl presupuesto sigue en borrador. ¿Quieres que lo duplique, lo sancione o revise otra versión?';
    const approval: CaroPendingApproval = {
      id: crypto.randomUUID(),
      tool: 'hexa_quotes_create',
      title: 'Crear presupuesto',
      summary:
        'Se creará un borrador con una línea de consulta de urgencia para Camila Rojas. Revisa los datos antes de aprobar.',
      parameters: [
        { label: 'Paciente', value: 'Camila Rojas Pérez' },
        { label: 'Líneas', value: '2 × Consulta de urgencia' },
        { label: 'Total', value: '$6.000' },
      ],
      status: 'pending',
      expiresAt: new Date(now + 10 * 60_000).toISOString(),
    };

    make(
      'Resumen del presupuesto COT-2026-0001',
      'El presupuesto sigue en borrador. ¿Quieres que lo duplique…',
      3,
      [
        message('user', 'Resume el presupuesto COT-2026-0001', 8),
        message('assistant', quoteAnswer, 7, [quoteTool], [], [
          { toolCallId: quoteTool.id, label: 'hexa_quotes_get' },
        ]),
        message('user', 'Crea un presupuesto para Camila Rojas con una consulta de urgencia', 6),
        message(
          'assistant',
          'Puedo crear el borrador, pero **necesito tu aprobación** antes de escribir en Hexa. Revisa el resumen y elige Aprobar o Rechazar.',
          5,
          [tool('hexa_quotes_create', 'running', null)],
          [approval],
        ),
        message('user', '¿Qué clima hace en Santiago?', 4),
        message('assistant', REFUSAL, 3),
      ],
    );

    make(
      'Buscar paciente por RUT',
      'Encontré 1 paciente con ese RUT: Camila Rojas Pérez.',
      70,
      [
        message('user', 'Busca el paciente 12.345.678-5', 72),
        message(
          'assistant',
          'Encontré **1 paciente** con ese RUT:\n\n| Nombre | RUT | N° HC |\n| --- | --- | --- |\n| Camila Rojas Pérez | 12.345.678-5 | HC-000001 |\n\n¿Quieres que abra su ficha o revise sus presupuestos?',
          70,
          [tool('hexa_patients_search', 'success', '1 paciente')],
        ),
      ],
    );

    make('Presupuestos pendientes de aprobar', 'Hay 3 presupuestos en borrador.', 26 * 60, [
      message('user', '¿Qué presupuestos están pendientes?', 26 * 60 + 2),
      message(
        'assistant',
        'Hay **3 presupuestos** en borrador:\n\n- COT-2026-0003 · Camila Rojas · $18.000\n- COT-2026-0004 · Manuel Barrera · $6.000\n- COT-2026-0006 · Ana Soto · $24.000\n\n¿Quieres que abra alguno?',
        26 * 60,
        [tool('hexa_quotes_list', 'success', '3 presupuestos')],
      ),
    ]);

    make('Comparar presupuestos', 'La diferencia principal es la línea de endodoncia.', 3 * 24 * 60, [
      message('user', 'Compara COT-2026-0001 con COT-2026-0002', 3 * 24 * 60 + 2),
      message(
        'assistant',
        'La diferencia principal está en la **endodoncia** ($12.000) y en la cantidad de consultas. El total cambia de **$6.000** a **$18.000**.',
        3 * 24 * 60,
      ),
    ]);

    make('¿Qué es el arancel UCO?', 'El arancel UCO es el catálogo de prestaciones…', 12 * 24 * 60, [
      message('user', '¿Qué es el arancel UCO?', 12 * 24 * 60 + 2),
      message(
        'assistant',
        'El **arancel UCO** es el catálogo de prestaciones dentales con códigos y unidades UCO. En Hexa puedes buscarlo con `hexa_uco_search` y usarlo para proponer precios en un presupuesto.',
        12 * 24 * 60,
      ),
    ]);
  }
}
