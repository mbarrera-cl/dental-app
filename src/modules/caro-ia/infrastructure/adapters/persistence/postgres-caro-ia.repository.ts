import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresDatabase, isUuid } from '../../../../../shared/infrastructure/database/postgres-database.js';
import type {
  CaroApprovalRecord,
  CaroApprovalStatus,
  CaroCitation,
  CaroConversation,
  CaroConversationDetail,
  CaroMessage,
  CaroPendingApproval,
  CaroToolCall,
} from '../../../domain/caro-ia.models.js';
import {
  DEFAULT_CONVERSATION_TITLE,
  previewOf,
} from '../../../domain/caro-ia.models.js';
import {
  CaroIaRepositoryPort,
  type CreateApprovalInput,
  type CreateMessageInput,
} from '../../../application/caro-ia.repository.port.js';

interface ConversationRow {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  message_count: string | number;
  preview: string | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tool_calls: CaroToolCall[];
  citations: CaroCitation[];
  created_at: Date;
}

interface ApprovalRow {
  id: string;
  conversation_id: string;
  message_id: string;
  tool: string;
  title: string;
  summary: string;
  parameters: Array<{ label: string; value: string }>;
  arguments: Record<string, unknown>;
  status: string;
  expires_at: Date;
  decided_at: Date | null;
  decided_by: string | null;
  created_at: Date;
}

const CONVERSATION_COLUMNS = `
  c.id, c.title, c.created_at, c.updated_at,
  (SELECT COUNT(*) FROM caro_messages m WHERE m.conversation_id = c.id) AS message_count,
  (SELECT m.content FROM caro_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS preview
`;

@Injectable()
export class PostgresCaroIaRepository extends CaroIaRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async listConversations(userId: string): Promise<CaroConversation[]> {
    const rows = await this.db.query<ConversationRow>(
      `SELECT ${CONVERSATION_COLUMNS}
       FROM caro_conversations c
       WHERE c.user_id = $1 AND c.deleted_at IS NULL
       ORDER BY c.updated_at DESC, c.created_at DESC`,
      [userId],
    );

    return rows.map(toConversation);
  }

  async findConversation(userId: string, id: string): Promise<CaroConversation | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<ConversationRow>(
      `SELECT ${CONVERSATION_COLUMNS}
       FROM caro_conversations c
       WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL`,
      [id, userId],
    );

    return row === null ? null : toConversation(row);
  }

  async getDetail(userId: string, id: string): Promise<CaroConversationDetail | null> {
    const conversation = await this.findConversation(userId, id);

    if (conversation === null) {
      return null;
    }

    return { conversation, messages: await this.listMessages(id) };
  }

  async createConversation(userId: string, title: string): Promise<CaroConversation> {
    const id = randomUUID();
    const now = new Date();

    await this.db.execute(
      `INSERT INTO caro_conversations (id, user_id, title, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)`,
      [id, userId, title, now],
    );

    const conversation = await this.findConversation(userId, id);

    if (conversation === null) {
      throw new Error('The conversation could not be read after creation');
    }

    return conversation;
  }

  async renameConversation(
    userId: string,
    id: string,
    title: string,
  ): Promise<CaroConversation | null> {
    const existing = await this.findConversation(userId, id);

    if (existing === null) {
      return null;
    }

    await this.db.execute(
      `UPDATE caro_conversations
       SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL`,
      [title, id, userId],
    );

    return this.findConversation(userId, id);
  }

  async softDeleteConversation(userId: string, id: string): Promise<boolean> {
    const existing = await this.findConversation(userId, id);

    if (existing === null) {
      return false;
    }

    await this.db.execute(
      `UPDATE caro_conversations
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId],
    );

    return true;
  }

  async listMessages(conversationId: string): Promise<CaroMessage[]> {
    if (!isUuid(conversationId)) {
      return [];
    }

    const rows = await this.db.query<MessageRow>(
      `SELECT id, conversation_id, role, content, tool_calls, citations, created_at
       FROM caro_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC, id ASC`,
      [conversationId],
    );

    const approvals = await this.approvalsFor(conversationId);
    const byMessage = new Map<string, CaroPendingApproval[]>();

    for (const approval of approvals) {
      const list = byMessage.get(approval.messageId) ?? [];
      list.push(toPendingApproval(approval));
      byMessage.set(approval.messageId, list);
    }

    return rows.map((row) => toMessage(row, byMessage.get(row.id) ?? []));
  }

  async insertMessage(input: CreateMessageInput): Promise<CaroMessage> {
    const id = randomUUID();
    const createdAt = input.createdAt === undefined ? new Date() : new Date(input.createdAt);

    await this.db.execute(
      `INSERT INTO caro_messages
        (id, conversation_id, role, content, tool_calls, citations, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
      [
        id,
        input.conversationId,
        input.role,
        input.content,
        JSON.stringify(input.toolCalls ?? []),
        JSON.stringify(input.citations ?? []),
        createdAt,
      ],
    );

    return {
      id,
      role: input.role,
      content: input.content,
      createdAt: createdAt.toISOString(),
      attachments: [],
      toolCalls: input.toolCalls ?? [],
      approvals: [],
      citations: input.citations ?? [],
    };
  }

  async touchConversation(conversationId: string, updatedAt: string): Promise<void> {
    await this.db.execute('UPDATE caro_conversations SET updated_at = $1 WHERE id = $2', [
      new Date(updatedAt),
      conversationId,
    ]);
  }

  async setTitleIfDefault(conversationId: string, title: string): Promise<void> {
    await this.db.execute(
      `UPDATE caro_conversations
       SET title = $1, updated_at = NOW()
       WHERE id = $2 AND title = $3 AND deleted_at IS NULL`,
      [title, conversationId, DEFAULT_CONVERSATION_TITLE],
    );
  }

  async createApproval(input: CreateApprovalInput): Promise<void> {
    await this.db.execute(
      `INSERT INTO caro_approvals
        (id, conversation_id, message_id, tool, title, summary, parameters, arguments,
         status, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)`,
      [
        input.approval.id,
        input.conversationId,
        input.messageId,
        input.approval.tool,
        input.approval.title,
        input.approval.summary,
        JSON.stringify(input.approval.parameters),
        JSON.stringify(input.arguments),
        input.approval.status,
        new Date(input.approval.expiresAt),
        new Date(input.createdAt),
      ],
    );
  }

  async findApproval(
    userId: string,
    conversationId: string,
    approvalId: string,
  ): Promise<CaroApprovalRecord | null> {
    if (!isUuid(approvalId) || !isUuid(conversationId)) {
      return null;
    }

    const row = await this.db.queryOne<ApprovalRow>(
      `SELECT a.* FROM caro_approvals a
       JOIN caro_conversations c ON c.id = a.conversation_id
       WHERE a.id = $1 AND a.conversation_id = $2
         AND c.user_id = $3 AND c.deleted_at IS NULL`,
      [approvalId, conversationId, userId],
    );

    return row === null ? null : toApprovalRecord(row);
  }

  async decideApproval(
    approvalId: string,
    status: CaroApprovalStatus,
    decidedBy: string,
    decidedAt: string,
  ): Promise<boolean> {
    const changed = await this.db.execute(
      `UPDATE caro_approvals
       SET status = $1, decided_by = $2, decided_at = $3
       WHERE id = $4 AND status = 'pending'`,
      [status, decidedBy, new Date(decidedAt), approvalId],
    );

    return changed > 0;
  }

  async expireApproval(approvalId: string): Promise<void> {
    await this.db.execute(
      `UPDATE caro_approvals
       SET status = 'expired', decided_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [approvalId],
    );
  }

  async purgeOlderThan(cutoff: string): Promise<number> {
    return this.db.execute('DELETE FROM caro_conversations WHERE updated_at < $1', [
      new Date(cutoff),
    ]);
  }

  private async approvalsFor(conversationId: string): Promise<CaroApprovalRecord[]> {
    const rows = await this.db.query<ApprovalRow>(
      `SELECT * FROM caro_approvals
       WHERE conversation_id = $1
       ORDER BY created_at ASC, id ASC`,
      [conversationId],
    );

    return rows.map(toApprovalRecord);
  }
}

function toConversation(row: ConversationRow): CaroConversation {
  return {
    id: row.id,
    title: row.title,
    preview: row.preview === null ? null : previewOf(row.preview),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    messageCount: Number(row.message_count),
  };
}

function toMessage(row: MessageRow, approvals: CaroPendingApproval[]): CaroMessage {
  return {
    id: row.id,
    role: row.role === 'user' ? 'user' : 'assistant',
    content: row.content,
    createdAt: row.created_at.toISOString(),
    attachments: [],
    toolCalls: Array.isArray(row.tool_calls) ? row.tool_calls : [],
    approvals,
    citations: Array.isArray(row.citations) ? row.citations : [],
  };
}

function toPendingApproval(row: CaroApprovalRecord): CaroPendingApproval {
  return {
    id: row.id,
    tool: row.tool,
    title: row.title,
    summary: row.summary,
    parameters: row.parameters,
    status: row.status,
    expiresAt: row.expiresAt,
  };
}

function toApprovalRecord(row: ApprovalRow): CaroApprovalRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    tool: row.tool,
    title: row.title,
    summary: row.summary,
    parameters: Array.isArray(row.parameters) ? row.parameters : [],
    arguments: row.arguments && typeof row.arguments === 'object' ? row.arguments : {},
    status: row.status as CaroApprovalStatus,
    expiresAt: row.expires_at.toISOString(),
    decidedAt: row.decided_at === null ? null : row.decided_at.toISOString(),
    decidedBy: row.decided_by,
    createdAt: row.created_at.toISOString(),
  };
}
