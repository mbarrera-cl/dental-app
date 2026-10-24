import type { BarChartSpec } from '../../mcp/domain/bar-chart.js';

export type CaroMessageRole = 'user' | 'assistant';
export type CaroToolState = 'running' | 'success' | 'error';
export type CaroApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface CaroConversation {
  id: string;
  title: string;
  preview: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface CaroToolCall {
  id: string;
  name: string;
  label: string;
  state: CaroToolState;
  summary: string | null;
  /** Present when the tool produced a renderable chart (hexa_chart_bar). */
  chart?: BarChartSpec | null;
}

export interface CaroPendingApproval {
  id: string;
  tool: string;
  title: string;
  summary: string;
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
  attachments: never[];
  toolCalls: CaroToolCall[];
  approvals: CaroPendingApproval[];
  citations: CaroCitation[];
}

export interface CaroConversationDetail {
  conversation: CaroConversation;
  messages: CaroMessage[];
}

export interface CaroApprovalRecord extends CaroPendingApproval {
  conversationId: string;
  messageId: string;
  arguments: Record<string, unknown>;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
}

export type CaroStreamEvent =
  | { type: 'message.delta'; delta: string }
  | { type: 'tool.start'; toolCall: CaroToolCall }
  | { type: 'tool.result'; toolCall: CaroToolCall }
  | { type: 'approval.required'; approval: CaroPendingApproval }
  | { type: 'attachment.processed'; attachment: unknown }
  | { type: 'message.done'; message: CaroMessage }
  | { type: 'error'; message: string };

export interface CaroTranscription {
  text: string;
  confidence: number | null;
  durationSeconds: number | null;
}

export const DEFAULT_CONVERSATION_TITLE = 'Nueva conversación';
export const MAX_CONVERSATION_TITLE_LENGTH = 80;
export const APPROVAL_TTL_MS = 10 * 60_000;

export function deriveConversationTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();

  if (normalized === '') {
    return DEFAULT_CONVERSATION_TITLE;
  }

  return normalized.length <= MAX_CONVERSATION_TITLE_LENGTH
    ? normalized
    : `${normalized.slice(0, MAX_CONVERSATION_TITLE_LENGTH - 1).trimEnd()}…`;
}

export function previewOf(content: string): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return plain.length <= 90 ? plain : `${plain.slice(0, 89).trimEnd()}…`;
}
