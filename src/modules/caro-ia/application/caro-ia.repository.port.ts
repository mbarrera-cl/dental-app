import type {
  CaroApprovalRecord,
  CaroApprovalStatus,
  CaroCitation,
  CaroConversation,
  CaroConversationDetail,
  CaroMessage,
  CaroMessageRole,
  CaroPendingApproval,
  CaroToolCall,
} from '../domain/caro-ia.models.js';

export interface CreateMessageInput {
  conversationId: string;
  role: CaroMessageRole;
  content: string;
  toolCalls?: CaroToolCall[];
  citations?: CaroCitation[];
  createdAt?: string;
}

export interface CreateApprovalInput {
  conversationId: string;
  messageId: string;
  approval: CaroPendingApproval;
  arguments: Record<string, unknown>;
  createdAt: string;
}

/**
 * Driven port for CaroIA. Every query takes the owner id and every mutation
 * scopes by it, so a missing conversation and someone else's conversation are
 * indistinguishable at the boundary (404).
 */
export abstract class CaroIaRepositoryPort {
  abstract listConversations(userId: string): Promise<CaroConversation[]>;
  abstract findConversation(userId: string, id: string): Promise<CaroConversation | null>;
  abstract getDetail(userId: string, id: string): Promise<CaroConversationDetail | null>;
  abstract createConversation(userId: string, title: string): Promise<CaroConversation>;
  abstract renameConversation(
    userId: string,
    id: string,
    title: string,
  ): Promise<CaroConversation | null>;
  abstract softDeleteConversation(userId: string, id: string): Promise<boolean>;
  abstract listMessages(conversationId: string): Promise<CaroMessage[]>;
  abstract insertMessage(input: CreateMessageInput): Promise<CaroMessage>;
  abstract touchConversation(conversationId: string, updatedAt: string): Promise<void>;
  abstract setTitleIfDefault(conversationId: string, title: string): Promise<void>;
  abstract createApproval(input: CreateApprovalInput): Promise<void>;
  abstract findApproval(
    userId: string,
    conversationId: string,
    approvalId: string,
  ): Promise<CaroApprovalRecord | null>;
  /** Atomically claims a pending approval; false when it was already decided. */
  abstract decideApproval(
    approvalId: string,
    status: CaroApprovalStatus,
    decidedBy: string,
    decidedAt: string,
  ): Promise<boolean>;
  abstract expireApproval(approvalId: string): Promise<void>;
  /** Hard-deletes conversations last updated before `cutoff` (cascades messages and approvals). */
  abstract purgeOlderThan(cutoff: string): Promise<number>;
}
