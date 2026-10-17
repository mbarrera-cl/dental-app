import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, type Observable, type Subscription } from 'rxjs';
import {
  CaroIaGateway,
  type CaroApprovalDecision,
  type CaroAttachment,
  type CaroConversation,
  type CaroMessage,
  type CaroStreamEvent,
  type CaroTranscription,
} from 'data-access';

/**
 * Estado de CaroIA. Solo conoce `CaroIaGateway`; la rama UI usa el gateway
 * simulado y la rama backend lo sustituye por HTTP/SSE sin tocar la página.
 */
@Injectable({ providedIn: 'root' })
export class CaroIaStore {
  private readonly gateway = inject(CaroIaGateway);

  private readonly conversationsSignal = signal<CaroConversation[]>([]);
  private readonly activeIdSignal = signal<string | null>(null);
  private readonly messagesSignal = signal<CaroMessage[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly loadingMessagesSignal = signal(false);
  private readonly sendingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly attachmentsSignal = signal<CaroAttachment[]>([]);
  private readonly transcribingSignal = signal(false);
  private readonly approvingSignal = signal(false);
  private readonly streamingIdSignal = signal<string | null>(null);
  private streamSubscription: Subscription | null = null;
  private openToken = 0;

  readonly conversations = this.conversationsSignal.asReadonly();
  readonly activeId = this.activeIdSignal.asReadonly();
  readonly messages = this.messagesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly loadingMessages = this.loadingMessagesSignal.asReadonly();
  readonly sending = this.sendingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly attachments = this.attachmentsSignal.asReadonly();
  readonly transcribing = this.transcribingSignal.asReadonly();
  readonly approving = this.approvingSignal.asReadonly();

  readonly activeConversation = computed(
    () =>
      this.conversationsSignal().find((conversation) => conversation.id === this.activeIdSignal()) ??
      null,
  );

  readonly readyAttachments = computed(() =>
    this.attachmentsSignal().filter((attachment) => attachment.status === 'ready'),
  );

  readonly uploading = computed(() =>
    this.attachmentsSignal().some(
      (attachment) => attachment.status === 'uploading' || attachment.status === 'processing',
    ),
  );

  loadConversations(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.gateway.list().subscribe({
      next: (conversations) => this.conversationsSignal.set(conversations),
      error: () => {
        this.errorSignal.set('No se pudieron cargar las conversaciones.');
        this.loadingSignal.set(false);
      },
      complete: () => this.loadingSignal.set(false),
    });
  }

  open(id: string): void {
    if (this.activeIdSignal() === id && this.messagesSignal().length > 0) {
      return;
    }

    this.stop();
    const token = ++this.openToken;
    this.activeIdSignal.set(id);
    this.messagesSignal.set([]);
    this.loadingMessagesSignal.set(true);
    this.errorSignal.set(null);
    this.attachmentsSignal.set([]);

    this.gateway.get(id).subscribe({
      next: (detail) => {
        if (token !== this.openToken || this.activeIdSignal() !== id) {
          return;
        }

        this.messagesSignal.set(detail.messages);
        this.mergeConversation(detail.conversation);
      },
      error: () => {
        if (token !== this.openToken) {
          return;
        }

        this.errorSignal.set('No se pudo cargar la conversación.');
        this.loadingMessagesSignal.set(false);
      },
      complete: () => {
        if (token === this.openToken) {
          this.loadingMessagesSignal.set(false);
        }
      },
    });
  }

  /** Opens an unsaved draft; the conversation is created on the first send. */
  startDraft(): void {
    this.stop();
    this.openToken += 1;
    this.activeIdSignal.set(null);
    this.messagesSignal.set([]);
    this.loadingMessagesSignal.set(false);
    this.errorSignal.set(null);
    this.attachmentsSignal.set([]);
  }

  create(title?: string): void {
    this.gateway.create({ title }).subscribe({
      next: (conversation) => {
        this.conversationsSignal.update((rows) => [conversation, ...rows]);
        this.activeIdSignal.set(conversation.id);
        this.messagesSignal.set([]);
        this.attachmentsSignal.set([]);
        this.errorSignal.set(null);
      },
      error: () => this.errorSignal.set('No se pudo crear la conversación.'),
    });
  }

  rename(id: string, title: string): void {
    this.gateway.rename(id, title).subscribe({
      next: (conversation) => this.mergeConversation(conversation),
      error: () => this.errorSignal.set('No se pudo renombrar la conversación.'),
    });
  }

  remove(id: string): void {
    this.gateway.remove(id).subscribe({
      next: () => {
        this.conversationsSignal.update((rows) => rows.filter((row) => row.id !== id));

        if (this.activeIdSignal() === id) {
          this.stop();
          this.activeIdSignal.set(null);
          this.messagesSignal.set([]);
        }
      },
      error: () => this.errorSignal.set('No se pudo borrar la conversación.'),
    });
  }

  send(content: string, attachmentIds: string[] = []): void {
    const text = content.trim();

    if (text === '') {
      return;
    }

    const activeId = this.activeIdSignal();

    if (activeId === null) {
      this.gateway.create({ title: titleFromContent(text) }).subscribe({
        next: (conversation) => {
          this.conversationsSignal.update((rows) => [conversation, ...rows]);
          this.activeIdSignal.set(conversation.id);
          this.messagesSignal.set([]);
          this.sendTo(conversation.id, text, attachmentIds);
        },
        error: () => this.errorSignal.set('No se pudo crear la conversación.'),
      });

      return;
    }

    this.sendTo(activeId, text, attachmentIds);
  }

  stop(): void {
    const streamingId = this.streamingIdSignal();
    this.streamSubscription?.unsubscribe();
    this.streamSubscription = null;
    this.sendingSignal.set(false);
    this.streamingIdSignal.set(null);

    if (streamingId !== null) {
      this.messagesSignal.update((messages) =>
        messages.filter(
          (message) =>
            !(
              message.id === streamingId &&
              message.content === '' &&
              message.approvals.length === 0 &&
              message.toolCalls.length === 0
            ),
        ),
      );
    }
  }

  upload(file: File): void {
    const activeId = this.activeIdSignal();

    if (activeId === null) {
      this.gateway.create().subscribe({
        next: (conversation) => {
          this.conversationsSignal.update((rows) => [conversation, ...rows]);
          this.activeIdSignal.set(conversation.id);
          this.messagesSignal.set([]);
          this.uploadTo(conversation.id, file);
        },
        error: () => this.errorSignal.set('No se pudo crear la conversación.'),
      });

      return;
    }

    this.uploadTo(activeId, file);
  }

  removeAttachment(id: string): void {
    this.attachmentsSignal.update((rows) => rows.filter((row) => row.id !== id));
  }

  clearAttachments(): void {
    this.attachmentsSignal.set([]);
  }

  transcribe(audio: Blob): Observable<CaroTranscription> {
    this.transcribingSignal.set(true);

    return this.gateway
      .transcribeAudio(audio)
      .pipe(finalize(() => this.transcribingSignal.set(false)));
  }

  decideApproval(approvalId: string, decision: CaroApprovalDecision): void {
    const activeId = this.activeIdSignal();

    if (activeId === null || this.approvingSignal()) {
      return;
    }

    this.approvingSignal.set(true);
    this.errorSignal.set(null);
    this.updateApprovalStatus(approvalId, decision === 'approve' ? 'approved' : 'rejected');

    const placeholderId = `streaming-${crypto.randomUUID()}`;
    const placeholder: CaroMessage = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      attachments: [],
      toolCalls: [],
      approvals: [],
      citations: [],
    };
    this.messagesSignal.update((messages) => [...messages, placeholder]);
    this.sendingSignal.set(true);
    this.streamingIdSignal.set(placeholderId);

    this.gateway.decideApproval(activeId, approvalId, decision).subscribe({
      next: (event) => this.handleEvent(placeholderId, event),
      error: () => {
        this.errorSignal.set('No se pudo procesar la aprobación.');
        this.updateApprovalStatus(approvalId, 'pending');
        this.sendingSignal.set(false);
        this.approvingSignal.set(false);
        this.streamingIdSignal.set(null);
      },
      complete: () => {
        this.sendingSignal.set(false);
        this.approvingSignal.set(false);
        this.streamingIdSignal.set(null);
      },
    });
  }

  dismissError(): void {
    this.errorSignal.set(null);
  }

  isStreaming(messageId: string): boolean {
    return this.sendingSignal() && this.streamingIdSignal() === messageId;
  }

  private sendTo(conversationId: string, content: string, attachmentIds: string[]): void {
    this.stop();
    const selectedIds =
      attachmentIds.length > 0
        ? attachmentIds
        : this.readyAttachments().map((attachment) => attachment.id);
    const attachments = this.attachmentsSignal().filter((attachment) =>
      selectedIds.includes(attachment.id),
    );
    const userMessage: CaroMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      attachments,
      toolCalls: [],
      approvals: [],
      citations: [],
    };
    const placeholder: CaroMessage = {
      id: `streaming-${crypto.randomUUID()}`,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      attachments: [],
      toolCalls: [],
      approvals: [],
      citations: [],
    };

    this.messagesSignal.update((messages) => [...messages, userMessage, placeholder]);
    this.attachmentsSignal.set([]);
    this.sendingSignal.set(true);
    this.streamingIdSignal.set(placeholder.id);
    this.errorSignal.set(null);
    this.streamSubscription?.unsubscribe();
    this.streamSubscription = this.gateway
      .send(conversationId, { content, attachmentIds: selectedIds })
      .subscribe({
        next: (event) => this.handleEvent(placeholder.id, event),
        error: () => {
          this.errorSignal.set('No se pudo enviar el mensaje.');
          this.sendingSignal.set(false);
          this.streamingIdSignal.set(null);
        },
        complete: () => {
          this.sendingSignal.set(false);
          this.streamingIdSignal.set(null);
        },
      });
  }

  private uploadTo(conversationId: string, file: File): void {
    const temporary: CaroAttachment = {
      id: `upload-${crypto.randomUUID()}`,
      kind: file.type.startsWith('audio/')
        ? 'audio'
        : file.type.startsWith('image/')
          ? 'image'
          : 'document',
      filename: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      status: 'uploading',
      text: null,
      durationSeconds: null,
      url: null,
      error: null,
      createdAt: new Date().toISOString(),
    };
    this.attachmentsSignal.update((rows) => [...rows, temporary]);

    this.gateway.uploadAttachment(conversationId, file).subscribe({
      next: (attachment) => {
        this.attachmentsSignal.update((rows) =>
          rows.map((row) => (row.id === temporary.id ? attachment : row)),
        );
      },
      error: () => {
        this.attachmentsSignal.update((rows) =>
          rows.map((row) =>
            row.id === temporary.id
              ? { ...row, status: 'failed', error: 'No se pudo procesar el archivo.' }
              : row,
          ),
        );
      },
    });
  }

  private handleEvent(placeholderId: string, event: CaroStreamEvent): void {
    switch (event.type) {
      case 'message.delta':
        this.messagesSignal.update((messages) =>
          messages.map((message) =>
            message.id === placeholderId
              ? { ...message, content: message.content + event.delta }
              : message,
          ),
        );
        break;
      case 'tool.start':
        this.messagesSignal.update((messages) =>
          messages.map((message) =>
            message.id === placeholderId
              ? { ...message, toolCalls: [...message.toolCalls, event.toolCall] }
              : message,
          ),
        );
        break;
      case 'tool.result':
        this.messagesSignal.update((messages) =>
          messages.map((message) =>
            message.id === placeholderId
              ? {
                  ...message,
                  toolCalls: message.toolCalls.map((tool) =>
                    tool.id === event.toolCall.id ? event.toolCall : tool,
                  ),
                }
              : message,
          ),
        );
        break;
      case 'approval.required':
        this.messagesSignal.update((messages) =>
          messages.map((message) =>
            message.id === placeholderId
              ? { ...message, approvals: [...message.approvals, event.approval] }
              : message,
          ),
        );
        break;
      case 'attachment.processed':
        this.attachmentsSignal.update((rows) => [...rows, event.attachment]);
        break;
      case 'message.done':
        this.messagesSignal.update((messages) =>
          messages.map((message) => (message.id === placeholderId ? event.message : message)),
        );
        {
          const current = this.conversationsSignal().find(
            (row) => row.id === this.activeIdSignal(),
          );

          if (current !== undefined) {
            this.mergeConversation({
              ...current,
              preview: event.message.content.replace(/\s+/g, ' ').slice(0, 90),
              updatedAt: event.message.createdAt,
              messageCount: this.messagesSignal().length,
            });
          }
        }
        break;
      case 'error':
        this.errorSignal.set(event.message);
        break;
    }
  }

  private updateApprovalStatus(
    approvalId: string,
    status: CaroMessage['approvals'][number]['status'],
  ): void {
    this.messagesSignal.update((messages) =>
      messages.map((message) => ({
        ...message,
        approvals: message.approvals.map((approval) =>
          approval.id === approvalId ? { ...approval, status } : approval,
        ),
      })),
    );
  }

  private mergeConversation(conversation: CaroConversation): void {
    this.conversationsSignal.update((rows) => {
      const exists = rows.some((row) => row.id === conversation.id);

      return exists
        ? rows.map((row) => (row.id === conversation.id ? conversation : row))
        : [conversation, ...rows];
    });
  }
}

function titleFromContent(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();

  if (normalized === '') {
    return 'Nueva conversación';
  }

  return normalized.length <= 80 ? normalized : `${normalized.slice(0, 79).trimEnd()}…`;
}
