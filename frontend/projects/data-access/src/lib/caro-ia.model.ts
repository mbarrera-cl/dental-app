/**
 * Contrato de CaroIA (UI-first). El backend implementará exactamente estos
 * tipos y eventos; la UI puede trabajar con el gateway simulado hasta entonces.
 */

export type CaroMessageRole = 'user' | 'assistant';
export type CaroAttachmentKind = 'document' | 'image' | 'audio';
export type CaroAttachmentStatus = 'uploading' | 'processing' | 'ready' | 'failed';
export type CaroToolState = 'running' | 'success' | 'error';
export type CaroApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface CaroConversation {
  id: string;
  title: string;
  /** Primeras palabras del último mensaje, para la lista/tabla. */
  preview: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface CaroAttachment {
  id: string;
  kind: CaroAttachmentKind;
  filename: string;
  mime: string;
  size: number;
  status: CaroAttachmentStatus;
  /** Texto extraído de documentos o transcripción de audio. */
  text: string | null;
  durationSeconds: number | null;
  /** Object URL for playback/download while the real backend serves it. */
  url: string | null;
  error: string | null;
  createdAt: string;
}

export type CaroChartValueFormat = 'number' | 'currency' | 'percent';

export interface CaroBarChartDatum {
  label: string;
  value: number;
}

/** Chart spec produced by the hexa_chart_bar MCP tool. */
export interface CaroBarChart {
  type: 'bar';
  title: string;
  description: string | null;
  valueFormat: CaroChartValueFormat;
  valueLabel: string | null;
  currency: string | null;
  data: CaroBarChartDatum[];
}

export interface CaroToolCall {
  id: string;
  /** Nombre técnico de la tool MCP, e.g. `hexa_quotes_list`. */
  name: string;
  /** Etiqueta humana, e.g. "Consultó presupuestos". */
  label: string;
  state: CaroToolState;
  summary: string | null;
  /** Presente cuando la tool produjo un gráfico renderizable. */
  chart?: CaroBarChart | null;
}

export interface CaroPendingApproval {
  id: string;
  tool: string;
  title: string;
  summary: string;
  /** Argumentos resumidos y seguros para mostrar en la tarjeta. */
  parameters: Array<{ label: string; value: string }>;
  status: CaroApprovalStatus;
  expiresAt: string;
}

export interface CaroCitation {
  toolCallId: string;
  label: string;
}

export interface CaroMessage {
  id: string;
  role: CaroMessageRole;
  content: string;
  createdAt: string;
  attachments: CaroAttachment[];
  toolCalls: CaroToolCall[];
  approvals: CaroPendingApproval[];
  citations: CaroCitation[];
}

export interface CaroConversationDetail {
  conversation: CaroConversation;
  messages: CaroMessage[];
}

export interface CaroTranscription {
  text: string;
  confidence: number | null;
  durationSeconds: number | null;
}

export interface CaroConversationQuery {
  query?: string;
  deleted?: 'exclude' | 'only';
}

export interface CaroCreateConversationInput {
  title?: string;
}

export interface CaroSendMessageInput {
  content: string;
  attachmentIds?: string[];
}

export type CaroApprovalDecision = 'approve' | 'reject';

/** Eventos del stream SSE de un turno de chat. */
export type CaroStreamEvent =
  | { type: 'message.delta'; delta: string }
  | { type: 'tool.start'; toolCall: CaroToolCall }
  | { type: 'tool.result'; toolCall: CaroToolCall }
  | { type: 'approval.required'; approval: CaroPendingApproval }
  | { type: 'attachment.processed'; attachment: CaroAttachment }
  | { type: 'message.done'; message: CaroMessage }
  | { type: 'error'; message: string };

export const DEFAULT_CONVERSATION_TITLE = 'Nueva conversación';

/** Agrupa conversaciones por fecha para la lista lateral (Hoy/Ayer/7 días). */
export type CaroConversationGroup = 'today' | 'yesterday' | 'last7' | 'older';

export function conversationGroup(updatedAt: string, now: Date = new Date()): CaroConversationGroup {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return 'older';
  }

  const startOfDay = (value: Date): number =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (diffDays <= 0) {
    return 'today';
  }

  if (diffDays === 1) {
    return 'yesterday';
  }

  return diffDays <= 7 ? 'last7' : 'older';
}
